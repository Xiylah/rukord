"""Regression check: extract like dpkg, without creating implicit parents."""
from pathlib import Path, PurePosixPath
import io
import tarfile
import tempfile
import sys

def data_archive(package):
    raw = Path(package).read_bytes()
    assert raw.startswith(b'!<arch>\n')
    cursor = 8
    while cursor < len(raw):
        header = raw[cursor:cursor + 60]
        size = int(header[48:58])
        if header[:16].decode().strip().rstrip('/') == 'data.tar.gz':
            return raw[cursor + 60:cursor + 60 + size]
        cursor += 60 + size + size % 2
    raise AssertionError('Missing data archive')

def strict_extract(package, destination):
    with tarfile.open(fileobj=io.BytesIO(data_archive(package)), mode='r:gz') as archive:
        for member in archive:
            relative = PurePosixPath(member.name)
            assert not relative.is_absolute() and '..' not in relative.parts
            target = destination.joinpath(*relative.parts)
            if member.isdir():
                if not target.exists():
                    target.mkdir()  # Deliberately no parents=True.
            elif member.isfile():
                with target.open('wb') as stream:
                    stream.write(archive.extractfile(member).read())
            else:
                raise AssertionError('Unexpected archive member type')

def main():
    fixed = Path(sys.argv[1])
    broken = Path(sys.argv[2]) if len(sys.argv) > 2 else None
    scratch = Path(__file__).resolve().parent / '.layout-test'
    scratch.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(dir=scratch) as temporary:
        temporary = Path(temporary)
        assert temporary.resolve().is_relative_to(scratch.resolve())
        if broken:
            previous = temporary / 'previous'
            previous.mkdir()
            for directory in ('var/jb/Library/MobileSubstrate/DynamicLibraries',
                              'var/jb/Library/Application Support/RukcordResources.bundle',
                              'var/jb/usr/share/doc'):
                (previous / directory).mkdir(parents=True, exist_ok=True)
            try:
                strict_extract(broken, previous)
            except FileNotFoundError as error:
                assert 'local.rukcord.tweak' in str(error)
                print('Original package reproduces the missing documentation-directory failure')
            else:
                raise AssertionError('Expected original package to fail')
        clean = temporary / 'clean'
        clean.mkdir()
        strict_extract(fixed, clean)
        assert (clean / 'var/jb/usr/share/doc/local.rukcord.tweak/LICENSE-jsi').is_file()
        assert (clean / 'var/jb/Library/MobileSubstrate/DynamicLibraries/Rukcord.dylib').is_file()
        print('Fixed package extracts into an empty filesystem without implicit directory creation')

if __name__ == '__main__':
    main()
