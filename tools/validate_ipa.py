"""Validate archives and signing without claiming iPhone runtime coverage."""
from pathlib import Path, PurePosixPath
import hashlib
import io
import json
import plistlib
import sys
import tarfile
import zipfile
from signatures import signatures, unsigned_contents
from ipa_macho import dependency_names
from validate_ios_layout import validate_bytes

ROOT = Path(__file__).resolve().parent.parent

def ipa(path):
    code = 0; seals = 0
    with zipfile.ZipFile(path) as archive:
        assert archive.testzip() is None
        names = set(archive.namelist()); prefix = 'Payload/Discord.app/'
        metadata = plistlib.loads(archive.read(prefix+'Info.plist'))
        assert metadata['CFBundleDisplayName'] == 'Rukcord' and metadata['CFBundleIdentifier'] == 'local.rukcord.Discord'
        assert not any('/PlugIns/' in name or name.endswith('embedded.mobileprovision') for name in names)
        assert archive.read(prefix+'RukcordResources.bundle/rukcord.js') == (ROOT/'rukcord/dist/rukcord.min.js').read_bytes()
        for name in names:
            data = archive.read(name)
            if data[:4] == b'\xcf\xfa\xed\xfe':
                parent = name.rsplit('/', 1)[0]+'/'
                special = {slot: archive.read(parent+file) for slot, file in [(1, 'Info.plist'), (3, '_CodeSignature/CodeResources')] if parent+file in names}
                signatures(data, special); code += 1
            if name.endswith('/_CodeSignature/CodeResources'):
                parent = name[:-len('_CodeSignature/CodeResources')]
                for file, entry in plistlib.loads(data).get('files2', {}).items():
                    if 'hash2' not in entry and 'hash' not in entry: continue
                    resource = archive.read(parent+file)
                    if 'hash2' in entry: assert hashlib.sha256(resource).digest() == entry['hash2']
                    if 'hash' in entry: assert hashlib.sha1(resource).digest() == entry['hash']
                    seals += 1
        main = archive.read(prefix+metadata['CFBundleExecutable'])
        assert dependency_names(main).count('@executable_path/Frameworks/Rukcord.dylib') == 1
        native = archive.read(prefix+'Frameworks/Rukcord.dylib')
        assert unsigned_contents(native) == unsigned_contents((ROOT/'native-build/ipa/Rukcord.dylib').read_bytes())
        validate_bytes(native)
        assert all(name.startswith(('/usr/lib/', '/System/Library/')) for name in dependency_names(native))
        assert archive.read(prefix+'RukcordLegal/LICENSE-jsi')
    return {'signed_macho_files': code, 'sealed_resources': seals, 'signature_pages': 'passed', 'payload': 'matched', 'native_layout': 'passed', 'zip_crc': 'passed'}

def check(path):
    result = ipa(path)
    result.update(artifact=path.name, sha256=hashlib.sha256(path.read_bytes()).hexdigest(), physical_device_tested=False)
    path.with_suffix('.checks.json').write_text(json.dumps(result, indent=2)+'\n')
    print(json.dumps(result))
    return result

if __name__ == '__main__':
    for argument in sys.argv[1:]: check(Path(argument))
