"""Package a supplied decrypted Discord app. The installer must re-sign it."""
from pathlib import Path, PurePosixPath
import hashlib
import json
import os
import plistlib
import shutil
import stat
import subprocess
import tempfile
import zipfile
from PIL import Image
from ipa_macho import dependency_names, inject

ROOT = Path(__file__).resolve().parent.parent
LOAD = '@executable_path/Frameworks/Rukcord.dylib'
VERSION = '0.6.0-alpha.6'

def package(base, destination, upgrade_rukcord=False):
    base, destination = Path(base).resolve(), Path(destination).resolve()
    destination.mkdir(parents=True, exist_ok=True)
    (ROOT/'build/ipa').mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='stage-', dir=ROOT/'build/ipa', ignore_cleanup_errors=True) as temporary:
        stage = Path(temporary)
        with zipfile.ZipFile(base) as archive:
            if archive.testzip() is not None: raise ValueError('Corrupt input IPA')
            infos = [name for name in archive.namelist() if name.count('/') == 2 and name.endswith('.app/Info.plist')]
            if len(infos) != 1: raise ValueError('Expected one main app')
            metadata = plistlib.loads(archive.read(infos[0]))
            upgrading = upgrade_rukcord and metadata.get('CFBundleIdentifier') == 'local.rukcord.Discord' and isinstance(metadata.get('RukcordVersion'), str)
            if not upgrading and metadata['CFBundleIdentifier'] != 'com.hammerandchisel.discord': raise ValueError('Expected decrypted Discord, or use --upgrade-rukcord for a previous Rukcord IPA')
            version = metadata['CFBundleShortVersionString']
            if version not in ('349.0', '350.0', '351.0'): raise ValueError('This alpha targets Discord 349, 350 and 351')
            prefix = infos[0].rsplit('/', 1)[0] + '/'
            executable = prefix + metadata['CFBundleExecutable']
            original_binary = archive.read(executable)
            if upgrading:
                if dependency_names(original_binary).count(LOAD) != 1: raise ValueError('Expected exactly one Rukcord loader in the previous IPA')
                patched = original_binary
            else:
                patched = inject(original_binary, LOAD)
            for info in archive.infolist():
                name, path = info.filename, PurePosixPath(info.filename)
                if path.is_absolute() or '..' in path.parts or '\\' in name or ':' in name: raise ValueError('Unsafe ZIP path')
                if not name.startswith(prefix): continue
                if stat.S_ISLNK(info.external_attr >> 16): raise ValueError('Input symlinks are unsupported')
                relative = name[len(prefix):]
                if upgrading and (relative.startswith(('RukcordResources.bundle/', 'RukcordLegal/')) or relative.startswith('RukcordIcon')): continue
                if relative.startswith(('PlugIns/', 'Watch/')) or '_CodeSignature' in path.parts or path.name == 'embedded.mobileprovision': continue
                output = stage.joinpath(*path.parts)
                if info.is_dir(): output.mkdir(parents=True, exist_ok=True); continue
                output.parent.mkdir(parents=True, exist_ok=True)
                output.write_bytes(patched if name == executable else archive.read(name))
                mode = (info.external_attr >> 16) & 0o777
                if mode: output.chmod(mode)
        app = stage.joinpath(*PurePosixPath(prefix).parts)
        native = ROOT/'native-build/ipa/Rukcord.dylib'
        dependencies = dependency_names(native.read_bytes())
        if any('/var/jb' in item or 'Substrate' in item or 'libhooker' in item for item in dependencies): raise ValueError('IPA loader contains jailbreak dependencies')
        (app/'Frameworks').mkdir(exist_ok=True)
        shutil.copyfile(native, app/'Frameworks/Rukcord.dylib')
        resources = app/'RukcordResources.bundle'; resources.mkdir()
        shutil.copyfile(ROOT/'rukcord/dist/rukcord.min.js', resources/'rukcord.js')
        template = (ROOT/'RukcordNative/Sources/payload-base.template.js').read_text()
        (resources/'payload-base.js').write_text(template.replace('@PACKAGE_VERSION@', VERSION).replace('@TWEAK_NAME@', 'Rukcord'), encoding='utf-8')
        shutil.copyfile(ROOT/'art/rukcord-mascot.png', resources/'rukcord-icon.png')
        (resources/'Info.plist').write_bytes(plistlib.dumps({'CFBundleIdentifier': 'local.rukcord.resources', 'CFBundlePackageType': 'BNDL', 'CFBundleVersion': '6'}))
        shutil.copytree(ROOT/'licenses', app/'RukcordLegal')
        shutil.copyfile(ROOT/'rukcord/LICENSE', app/'RukcordLegal/LICENSE-client')
        shutil.copyfile(ROOT/'RukcordNative/LICENSE', app/'RukcordLegal/LICENSE-loader')
        shutil.copyfile(ROOT/'UPSTREAM-NOTICES.md', app/'RukcordLegal/UPSTREAM-NOTICES.md')
        icon = Image.open(ROOT/'art/rukcord-app-icon.png').convert('RGB')
        for name, size in [('60x60@2x', 120), ('60x60@3x', 180), ('76x76', 76), ('76x76@2x', 152), ('83.5x83.5@2x', 167)]:
            icon.resize((size, size), Image.Resampling.LANCZOS).save(app/f'RukcordIcon{name}.png')
        metadata.update(CFBundleIdentifier='local.rukcord.Discord', CFBundleDisplayName='Rukcord', CFBundleName='Rukcord', RukcordVersion=VERSION)
        if tuple(map(int, metadata.get('MinimumOSVersion', '16.0').split('.'))) < (16, 0): metadata['MinimumOSVersion'] = '16.0'
        metadata['NSAppleMusicUsageDescription'] = 'Use your current song for music status when you enable it.'
        metadata['CFBundleIcons'] = {'CFBundlePrimaryIcon': {'CFBundleIconFiles': ['RukcordIcon60x60']}}
        metadata['CFBundleIcons~ipad'] = {'CFBundlePrimaryIcon': {'CFBundleIconFiles': ['RukcordIcon76x76', 'RukcordIcon83.5x83.5']}}
        metadata['CFBundleIconFiles'] = ['RukcordIcon60x60']; metadata.pop('CFBundleIconName', None)
        (app/'Info.plist').write_bytes(plistlib.dumps(metadata, fmt=plistlib.FMT_BINARY))
        entitlements = ROOT/'build/ipa/empty-entitlements.plist'; entitlements.write_bytes(plistlib.dumps({}))
        env = os.environ.copy(); signer = env.pop('RCODESIGN_BIN')
        subprocess.run([signer, 'sign', '--digest', 'sha256', '--entitlements-xml-file', 'main:' + str(entitlements), '--timestamp-url', 'none', str(app)], env=env, check=True)
        if LOAD not in dependency_names((app/metadata['CFBundleExecutable']).read_bytes()): raise ValueError('Missing loader command')
        output = destination/f'Rukcord-{VERSION}-Discord-{version}.ipa'
        with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
            for path in sorted(stage.rglob('*')):
                if not path.is_file(): continue
                data = path.read_bytes()
                code = data[:4] in (b'\xcf\xfa\xed\xfe', b'\xca\xfe\xba\xbe', b'\xbe\xba\xfe\xca')
                info = zipfile.ZipInfo(path.relative_to(stage).as_posix(), (2026, 10, 21, 0, 0, 0)); info.create_system = 3
                info.external_attr = (stat.S_IFREG | (0o755 if code else 0o644)) << 16
                info.compress_type = zipfile.ZIP_DEFLATED; archive.writestr(info, data)
        with zipfile.ZipFile(output) as archive:
            if archive.testzip() is not None: raise ValueError('Output CRC failed')
        report = {'artifact': output.name, 'sha256': hashlib.sha256(output.read_bytes()).hexdigest(), 'discord': version, 'minimum_ios': metadata['MinimumOSVersion'], 'physical_device_tested': False, 'signing': 'ad-hoc; sideload installer must sign and provision', 'push_notifications': 'not provisioned', 'native_dependencies': dependencies}
        output.with_suffix('.validation.json').write_text(json.dumps(report, indent=2)+'\n')
        return output

if __name__ == '__main__':
    import sys
    print(package(sys.argv[1], sys.argv[2], upgrade_rukcord='--upgrade-rukcord' in sys.argv[3:]))
