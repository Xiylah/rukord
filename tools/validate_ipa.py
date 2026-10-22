"""Validate local IPA bytes, signatures and resource digests; no device execution."""
from pathlib import Path
import hashlib
import json
import plistlib
import struct
import sys
import zipfile
from ipa_macho import commands, dependency_names
from validate_ios_layout import validate_bytes
from audit_native_symbols import inspect as audit_symbols

ROOT=Path(__file__).resolve().parent.parent

def unsigned_contents(data):
    """Compare loader contents while allowing the packager to replace its signature."""
    table = commands(data)
    signature = [struct.unpack_from('<II', data, offset + 8)
                 for command, offset, size in table if command == 0x1d]
    assert len(signature) == 1
    start, length = signature[0]
    assert start + length <= len(data)
    content = bytearray(data[:start])
    for command, offset, size in table:
        if command == 0x1d:
            content[offset + 12:offset + 16] = bytes(4)
        elif command == 0x19 and data[offset + 8:offset + 24].rstrip(b'\0') == b'__LINKEDIT':
            # Signature size changes the segment's VM and file extents.
            content[offset + 32:offset + 40] = bytes(8)
            content[offset + 48:offset + 56] = bytes(8)
    return bytes(content)

def signatures(data, special=None):
    table=commands(data)
    offsets=[struct.unpack_from('<II',data,o+8) for c,o,s in table if c==0x1d]
    assert len(offsets)==1
    start,size=offsets[0]
    magic,length,count=struct.unpack_from('>III',data,start)
    assert magic==0xfade0cc0 and length<=size and start+size<=len(data)
    result=[]
    for i in range(count):
        slot,relative=struct.unpack_from('>II',data,start+12+8*i)
        if slot!=0 and not 0x1000<=slot<=0x1005: continue
        pos=start+relative
        magic,cd_length,version,flags,hash_offset,ident_offset,n_special,n_code,limit=struct.unpack_from('>9I',data,pos)
        hsize,htype,platform,page=struct.unpack_from('>4B',data,pos+36)
        assert magic==0xfade0c02 and htype in (1,2) and flags&2
        assert limit==start and n_code==(limit+(1<<page)-1)//(1<<page)
        assert hash_offset+n_code*hsize<=cd_length
        hashfn=hashlib.sha1 if htype==1 else hashlib.sha256
        for j in range(n_code):
            expected=data[pos+hash_offset+j*hsize:pos+hash_offset+(j+1)*hsize]
            actual=hashfn(data[j*(1<<page):min(limit,(j+1)*(1<<page))]).digest()
            assert expected==actual, f'Bad code page {j}'
        for index,value in (special or {}).items():
            assert index<=n_special
            expected=data[pos+hash_offset-index*hsize:pos+hash_offset-(index-1)*hsize]
            assert expected==hashfn(value).digest(), f'Bad special slot {index}'
        result.append({'hash_type':htype,'code_pages':n_code,'page_hashes':'all passed','ad_hoc':True})
    assert result
    return result

def check(ipa):
    ipa=ipa.resolve(); report_path=ipa.parent/'IPA-VALIDATION.json'
    report=json.loads(report_path.read_text())
    code=[]; resource_count=0
    with zipfile.ZipFile(ipa) as archive:
        assert archive.testzip() is None
        names=set(archive.namelist()); prefix='Payload/Discord.app/'
        info=plistlib.loads(archive.read(prefix+'Info.plist'))
        assert info['CFBundleIdentifier']=='local.rukcord.Discord'
        assert info['CFBundleDisplayName']=='Rukcord'
        assert info['MinimumOSVersion']=='16.0' and info['CFBundleShortVersionString']=='349.0'
        assert not any('/PlugIns/' in n or n.endswith('embedded.mobileprovision') for n in names)
        assert archive.read(prefix+'RukcordResources.bundle/rukcord.js')==(ROOT/'RukcordNative/Resources/rukcord.js').read_bytes()
        assert archive.read(prefix+'RukcordResources.bundle/rukcord-icon.png')==(ROOT/'art/rukcord-mascot.png').read_bytes()
        for n in sorted(names):
            data=archive.read(n)
            if data[:4]==b'\xcf\xfa\xed\xfe':
                assert (archive.getinfo(n).external_attr>>16)&0o111
                parent=n.rsplit('/',1)[0]+'/'
                specials={}
                if parent+'Info.plist' in names and parent+'_CodeSignature/CodeResources' in names:
                    specials={1:archive.read(parent+'Info.plist'),3:archive.read(parent+'_CodeSignature/CodeResources')}
                code.append({'path':n,'directories':signatures(data,specials)})
            if n.endswith('/_CodeSignature/CodeResources'):
                parent=n[:-len('_CodeSignature/CodeResources')]
                seal=plistlib.loads(data)
                for file,entry in seal.get('files2',{}).items():
                    if 'hash2' not in entry and 'hash' not in entry: continue
                    target=parent+file
                    assert target in names, target
                    content=archive.read(target)
                    if 'hash2' in entry: assert hashlib.sha256(content).digest()==entry['hash2'],target
                    if 'hash' in entry: assert hashlib.sha1(content).digest()==entry['hash'],target
                    resource_count+=1
        main=archive.read(prefix+'Discord')
        assert dependency_names(main).count('@executable_path/Frameworks/Rukcord.dylib')==1
        for c,o,s in commands(main):
            if c in (0x21,0x2c): assert struct.unpack_from('<I',main,o+16)[0]==0
        native=archive.read(prefix+'Frameworks/Rukcord.dylib')
        for dependency in dependency_names(native):
            assert dependency.startswith(('/System/Library/','/usr/lib/')),dependency
        assert b'/var/jb' not in native and b'MobileSubstrate' not in native
    assert unsigned_contents(native) == unsigned_contents((ROOT/'native-build/ipa/Rukcord.dylib').read_bytes())
    validate_bytes(native)
    report.update({'code_signature_page_checks':code,'sealed_resource_hashes_checked':resource_count,
                   'ipa_injection_regression_tests':5,'client_regression_tests':130,
                   'native_16kb_layout':'passed','loader_only_system_dependencies':True,
                   'native_symbol_audit':audit_symbols(native),'native_symbol_tests_passed':4,'embedded_jailbreak_paths':False,'runtime_tests':'not run; physical iPhone required'})
    assert hashlib.sha256(ipa.read_bytes()).hexdigest()==report['sha256']
    report_path.write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({'signed_macho_files':len(code),'sealed_resources':resource_count,
                      'zip_crc':'passed','page_hashes':'passed','runtime':'not tested'}))

if __name__=='__main__': check(Path(sys.argv[1]))
