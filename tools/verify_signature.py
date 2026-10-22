import struct,hashlib,json,argparse
from pathlib import Path
parser=argparse.ArgumentParser()
parser.add_argument('--target',choices=('deb','ipa'),required=True)
args=parser.parse_args()
out=Path(__file__).resolve().parent.parent/'native-build'/args.target
p=out/'Rukcord.dylib';d=p.read_bytes();o=32;n=struct.unpack_from('<I',d,16)[0]
for _ in range(n):
    cmd,size=struct.unpack_from('<II',d,o)
    if cmd==0x1d:off,sz=struct.unpack_from('<II',d,o+8)
    o+=size
magic,length,count=struct.unpack_from('>III',d,off);assert magic==0xfade0cc0
verified=[]
for i in range(count):
    slot,rel=struct.unpack_from('>II',d,off+12+8*i)
    if slot not in (0,0x1000):continue
    pos=off+rel
    vals=struct.unpack_from('>9I4BI',d,pos)
    magic,length,ver,flags,hashOff,identOff,nSpecial,nCode,limit,hsize,htype,platform,page,spare=vals
    assert magic==0xfade0c02 and flags&2 and (htype,hsize) in ((1,20),(2,32))
    assert limit==off
    for j in range(nCode):
        block=d[j*(1<<page):min((j+1)*(1<<page),limit)]
        actual=(hashlib.sha1(block) if htype==1 else hashlib.sha256(block)).digest();expected=d[pos+hashOff+j*hsize:pos+hashOff+(j+1)*hsize]
        assert actual==expected,f'Invalid signature page {j}'
    verified.append({'flags':hex(flags),'code_pages':nCode,'page_size':1<<page,'code_limit':limit,'hash_type':htype,'page_hashes':'all verified'})
assert verified
(out/'signature-validation.json').write_text(json.dumps(verified,indent=2))
print(json.dumps(verified))
