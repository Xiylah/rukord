"""Build a rootless Debian package without depending on host dpkg."""
from pathlib import Path
import gzip
import hashlib
import io
import plistlib
import tarfile

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'dist'
NATIVE = ROOT / 'RukcordNative'
VERSION = '0.6.0~alpha6'

def tar_gz(files):
    out = io.BytesIO()
    with tarfile.open(fileobj=out, mode='w', format=tarfile.USTAR_FORMAT) as tf:
        # dpkg requires parent directories to be archive members. tarfile's
        # extractall() creates missing parents, which masked this in revision 1.
        directories = {'.'}
        for name, _, _ in files:
            parent = Path(name).parent
            while parent != Path('.'):
                directories.add(parent.as_posix())
                parent = parent.parent
        for name in sorted(directories, key=lambda p: (len(Path(p).parts), p)):
            info = tarfile.TarInfo('./' if name == '.' else './' + name + '/')
            info.type, info.mode, info.uid, info.gid = tarfile.DIRTYPE, 0o755, 0, 0
            info.uname, info.gname, info.mtime = 'root', 'wheel', 0
            tf.addfile(info)
        for name, data, mode in sorted(files):
            info = tarfile.TarInfo('./' + name)
            info.size, info.mode, info.uid, info.gid = len(data), mode, 0, 0
            info.uname, info.gname, info.mtime = 'root', 'wheel', 0
            tf.addfile(info, io.BytesIO(data))
    return gzip.compress(out.getvalue(), mtime=0)

def ar_entry(name, data):
    header = f'{name + "/":<16}{0:<12}{0:<6}{0:<6}{100644:<8}{len(data):<10}`\n'.encode('ascii')
    assert len(header) == 60
    return header + data + (b'\n' if len(data) % 2 else b'')

def build():
    OUT.mkdir(exist_ok=True)
    resources = NATIVE / 'Resources'
    resources.mkdir(exist_ok=True)
    payload = (ROOT / 'rukcord/dist/rukcord.min.js').read_bytes()
    (resources / 'rukcord.js').write_bytes(payload)
    icon = (ROOT / 'art/rukcord-mascot.png').read_bytes()
    (resources / 'rukcord-icon.png').write_bytes(icon)
    base = (NATIVE / 'Sources/payload-base.template.js').read_text().replace('@PACKAGE_VERSION@', VERSION).replace('@TWEAK_NAME@', 'Rukcord')
    info = plistlib.dumps({
        'CFBundleIdentifier': 'local.rukcord.resources',
        'CFBundleName': 'RukcordResources', 'CFBundlePackageType': 'BNDL',
        'CFBundleVersion': '6', 'CFBundleShortVersionString': '0.6.0',
        'CFBundleIconFile': 'rukcord-icon.png',
    })
    files = [
        ('var/jb/Library/MobileSubstrate/DynamicLibraries/Rukcord.dylib', (ROOT/'native-build/Rukcord.dylib').read_bytes(), 0o755),
        ('var/jb/Library/MobileSubstrate/DynamicLibraries/Rukcord.plist', (NATIVE/'Rukcord.plist').read_bytes(), 0o644),
        ('var/jb/Library/Application Support/RukcordResources.bundle/rukcord.js', payload, 0o644),
        ('var/jb/Library/Application Support/RukcordResources.bundle/rukcord-icon.png', icon, 0o644),
        ('var/jb/Library/Application Support/RukcordResources.bundle/payload-base.js', base.encode(), 0o644),
        ('var/jb/Library/Application Support/RukcordResources.bundle/Info.plist', info, 0o644),
        ('var/jb/usr/share/doc/local.rukcord.tweak/LICENSE-loader', (NATIVE/'LICENSE').read_bytes(), 0o644),
        ('var/jb/usr/share/doc/local.rukcord.tweak/LICENSE-rukcord', (ROOT/'rukcord/LICENSE').read_bytes(), 0o644),
        ('var/jb/usr/share/doc/local.rukcord.tweak/THIRD-PARTY-NOTICES', (ROOT/'licenses/THIRD-PARTY-NOTICES.txt').read_bytes(), 0o644),
        ('var/jb/usr/share/doc/local.rukcord.tweak/LICENSE-jsi', (ROOT/'licenses/LICENSE-jsi').read_bytes(), 0o644),
        ('var/jb/usr/share/doc/local.rukcord.tweak/README', (ROOT/'README.md').read_bytes(), 0o644),
        ('var/jb/usr/share/doc/local.rukcord.tweak/UPSTREAM-NOTICES', (ROOT/'UPSTREAM-NOTICES.md').read_bytes(), 0o644),
    ]
    control = (NATIVE / 'control').read_text().rstrip() + '\n'
    control += f'Installed-Size: {sum(len(d) for _, d, _ in files)//1024+1}\n'
    checksums = ''.join(f'{hashlib.md5(d).hexdigest()}  {name}\n' for name, d, _ in sorted(files))
    members = [('debian-binary', b'2.0\n'),
               ('control.tar.gz', tar_gz([('control', control.encode(), 0o644), ('md5sums', checksums.encode(), 0o644)])),
               ('data.tar.gz', tar_gz(files))]
    content = b'!<arch>\n' + b''.join(ar_entry(n, d) for n, d in members)
    path = OUT / f'local.rukcord.tweak_{VERSION}_iphoneos-arm64.deb'
    path.write_bytes(content)
    print(path.name, len(content), 'bytes')
    return path

if __name__ == '__main__':
    build()
