"""Build using ZIG_BIN, IOS_SDK and RCODESIGN_BIN; see BUILD.md."""
from pathlib import Path
import argparse
import os
import subprocess

parser = argparse.ArgumentParser(description="Build the native deb or IPA loader.")
parser.add_argument('--target', choices=('deb', 'ipa'), required=True)
args = parser.parse_args()

root = Path(__file__).resolve().parent.parent
zig, sdk, signer = (Path(os.environ[n]).resolve() for n in ('ZIG_BIN', 'IOS_SDK', 'RCODESIGN_BIN'))
repo, out = root / 'RukcordNative', root / 'native-build' / args.target
out.mkdir(parents=True, exist_ok=True)
env = os.environ.copy()
env['ZIG_GLOBAL_CACHE_DIR'] = str(out / 'zig-cache')
env['ZIG_LOCAL_CACHE_DIR'] = str(out / 'zig-local-cache')
base = [str(zig), 'cc', '-target', 'aarch64-ios.16.0', '-isysroot', str(sdk),
        '-F' + str(sdk / 'System/Library/Frameworks'), '-idirafter', str(sdk / 'usr/include'),
        '-DRUKCORD_IPA=' + ('1' if args.target == 'ipa' else '0'), '-fobjc-arc', '-fblocks', '-O2', '-Wno-deprecated-declarations',
        '-I' + str(repo / 'Headers'), '-DPACKAGE_VERSION=@"0.4.0-alpha.5"']
objects = []
for p in sorted((repo / 'Sources').iterdir()):
    if p.name == 'IPACompatibility.m' and args.target != 'ipa':
        continue
    if p.suffix not in ('.m', '.mm', '.x', '.xm'):
        continue
    src = repo / 'Generated' / (p.stem + ('.mm' if p.suffix == '.xm' else '.m')) if p.suffix in ('.x', '.xm') else p
    obj = out / (p.stem + '.o')
    cmd = base.copy()
    if src.suffix == '.mm':
        cmd += ['-std=c++17', '-nostdinc++', '-I' + str(sdk / 'usr/include/c++/v1')]
    subprocess.run(cmd + ['-c', str(src), '-o', str(obj)], env=env, check=True)
    objects.append(str(obj))
binary = out / 'Rukcord.dylib'
install_name = '@rpath/Rukcord.dylib' if args.target == 'ipa' else '/var/jb/Library/MobileSubstrate/DynamicLibraries/Rukcord.dylib'
link = [str(zig), 'cc', '-target', 'aarch64-ios.16.0', '-shared', '-isysroot', str(sdk),
        '-F' + str(sdk / 'System/Library/Frameworks'), '-L' + str(sdk / 'usr/lib'),
        '-Wl,-headerpad,0x1000', '-Wl,-undefined,dynamic_lookup',
        '-Wl,-install_name,' + install_name,
        '-nostdlib++', str(sdk / 'usr/lib/libc++.tbd'), '-lobjc']
for name in ('Foundation', 'UIKit', 'CoreGraphics', 'CoreText', 'CoreFoundation', 'UniformTypeIdentifiers', 'MediaPlayer'):
    link += ['-framework', name]
subprocess.run(link + objects + ['-o', str(binary)], env=env, check=True)
from audit_native_symbols import audit
audit(binary)
from align_ios_segments import align_image
from validate_ios_layout import validate
align_image(binary)
validate(binary)
sign_env = env.copy()
sign_env.pop('RCODESIGN_BIN', None)  # rcodesign interprets RCODESIGN_* as its own config.
subprocess.run([str(signer), 'sign', '--digest', 'sha1', '--digest', 'sha256', '--binary-identifier', 'local.rukcord.tweak', str(binary)], env=sign_env, check=True)

validate(binary)
