"""Check deb layout, checksums, payload, native loader and license files."""
from pathlib import Path, PurePosixPath
import hashlib,io,json,plistlib,sys,tarfile,tempfile
from test_deb_layout import strict_extract
from audit_native_symbols import inspect
from validate_ios_layout import validate

ROOT=Path(__file__).resolve().parent.parent

def read_deb(path):
    raw=path.read_bytes()
    assert raw.startswith(b'!<arch>\n')
    cursor=8;members={}
    while cursor<len(raw):
        header=raw[cursor:cursor+60]
        assert len(header)==60 and header[-2:]==b'`\n'
        size=int(header[48:58]);name=header[:16].decode().strip().rstrip('/')
        assert name not in members and cursor+60+size<=len(raw)
        members[name]=raw[cursor+60:cursor+60+size]
        cursor+=60+size+size%2
    assert cursor==len(raw) and members['debian-binary']==b'2.0\n'
    def unpack(content):
        result={}
        with tarfile.open(fileobj=io.BytesIO(content),mode='r:gz') as archive:
            for entry in archive:
                name=PurePosixPath(entry.name)
                assert not name.is_absolute() and '..' not in name.parts
                assert entry.isdir() or entry.isfile()
                if entry.isfile():result[str(name)]=archive.extractfile(entry).read()
        return result
    control=unpack(members['control.tar.gz']);data=unpack(members['data.tar.gz'])
    fields=dict(line.split(': ',1) for line in control['control'].decode().splitlines())
    checksums=control['md5sums'].decode().splitlines()
    assert len(checksums)==len(data)
    for line in checksums:
        digest,name=line.split('  ',1)
        assert hashlib.md5(data[name]).hexdigest()==digest
    with tempfile.TemporaryDirectory() as folder:strict_extract(path,Path(folder))
    return fields,data

def check(path):
    fields,data=read_deb(path)
    assert fields['Package']=='local.rukcord.tweak' and fields['Architecture']=='iphoneos-arm64'
    assert fields['Version']==dict(line.split(': ',1) for line in (ROOT/'RukcordNative/control').read_text().splitlines())['Version']
    resources='var/jb/Library/Application Support/RukcordResources.bundle/'
    assert data[resources+'rukcord.js']==(ROOT/'rukcord/dist/rukcord.min.js').read_bytes()
    assert plistlib.loads(data[resources+'Info.plist'])['CFBundleIdentifier']=='local.rukcord.resources'
    native=ROOT/'native-build/Rukcord.dylib'
    assert data['var/jb/Library/MobileSubstrate/DynamicLibraries/Rukcord.dylib']==native.read_bytes()
    validate(native);inspect(native.read_bytes())
    for name in ('LICENSE-loader','LICENSE-rukcord','LICENSE-jsi','THIRD-PARTY-NOTICES'):
        assert data['var/jb/usr/share/doc/local.rukcord.tweak/'+name]
    print(json.dumps({'package':path.name,'layout':'passed','md5':'passed','payload':'matched','native':'matched'}))

if __name__=='__main__':check(Path(sys.argv[1]))
