"""Verify ad-hoc Mach-O code page hashes and compare unsigned content."""
import struct
import hashlib
from ipa_macho import commands

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
