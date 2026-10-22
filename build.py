"""Build a rootless deb or a sideloadable IPA. See BUILD.md for setup."""
import argparse
import os
from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parent


def run(*command, cwd=ROOT):
    subprocess.run([str(part) for part in command], cwd=cwd, check=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('target', choices=('deb', 'ipa'))
    parser.add_argument('--base-ipa', type=Path, help='Decrypted Discord 349.0 IPA, required for the IPA build')
    parser.add_argument('--output', type=Path, help='Output folder, defaults to dist/deb or dist/ipa')
    args = parser.parse_args()

    if args.target == 'ipa' and (not args.base_ipa or not args.base_ipa.is_file()):
        parser.error('The IPA build requires --base-ipa pointing to an existing decrypted Discord 349.0 IPA.')
    if args.target == 'deb' and args.base_ipa:
        parser.error('--base-ipa is only used for the IPA build.')
    for name in ('ZIG_BIN', 'IOS_SDK', 'RCODESIGN_BIN'):
        value = os.environ.get(name)
        if not value or not Path(value).exists() or not Path(value).is_absolute():
            parser.error(f'Set {name} to an existing absolute path. See BUILD.md.')
    node = shutil.which('node')
    if not node:
        parser.error('Install Node.js 24 and add it to PATH.')
    if int(subprocess.check_output([node, '--version'], text=True).strip().lstrip('v').split('.')[0]) < 24:
        parser.error('Node.js 24 or later is required.')
    if not (ROOT / 'rukcord/node_modules/esbuild').is_dir():
        parser.error('Install client dependencies first using the npm ci command in BUILD.md.')
    if args.target == 'ipa':
        try:
            import PIL  # noqa: F401
        except ImportError:
            parser.error('Install Python dependencies: python -m pip install -r requirements.txt')

    output = (args.output or ROOT / 'dist' / args.target).resolve()
    output.mkdir(parents=True, exist_ok=True)
    run(node, 'scripts/build.mjs', '--release-branch', 'main', '--build-minify', cwd=ROOT / 'rukcord')
    run(sys.executable, ROOT / 'tools/build_native.py', '--target', args.target)
    run(sys.executable, ROOT / 'tools/verify_signature.py', '--target', args.target)

    if args.target == 'deb':
        run(sys.executable, ROOT / 'tools/package_deb.py')
        package = ROOT / 'dist/local.rukcord.tweak_0.4.0~alpha5_iphoneos-arm64.deb'
        run(sys.executable, ROOT / 'tools/validate_deb.py', package)
        destination = output / package.name
        if package.resolve() != destination:
            shutil.copyfile(package, destination)
    else:
        run(sys.executable, ROOT / 'tools/package_ipa.py', args.base_ipa.resolve(), output)
        destination = output / 'Rukcord-0.4.0-alpha.5-ipa-Discord-349.0.ipa'
        run(sys.executable, ROOT / 'tools/validate_ipa.py', destination)
    print(f'Built: {destination}')


if __name__ == '__main__':
    try:
        main()
    except (OSError, subprocess.CalledProcessError) as error:
        sys.exit(f'Build failed: {error}')
