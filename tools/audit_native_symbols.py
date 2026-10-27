"""Fail the native build on unexpected flat-namespace unresolved symbols.

JSI is deliberately supplied by the pinned Discord host. Everything else must
be linked to a system library or defined in this image. -undefined dynamic_lookup
alone otherwise conceals misspelled functions and C/Objective-C++ ABI mismatches.
"""
from pathlib import Path
import json
import struct
import sys

HOST_SYMBOLS = {
    '__ZN8facebook3jsi5ValueD1Ev', '__ZN8facebook3jsi6BufferD2Ev',
    '__ZNKR8facebook3jsi5Value8asObjectERNS0_8IRuntimeE',
    '__ZNKR8facebook3jsi5Value8asStringERNS0_8IRuntimeE',
    '__ZNKR8facebook3jsi6Object7asArrayERNS0_8IRuntimeE',
    '__ZNO8facebook3jsi5Value8asStringERNS0_8IRuntimeE',
    '__ZTIN8facebook3jsi6BufferE', '__ZTIN8facebook3jsi7JSErrorE',
    '__ZN8facebook3jsi5ValueC1EOS1_',
    '__ZN8facebook3jsi7JSErrorC1ERNS0_8IRuntimeENSt3__112basic_stringIcNS4_11char_traitsIcEENS4_9allocatorIcEEEE',
    '__ZN8facebook3jsi7JSErrorD1Ev',
    '__ZNK8facebook3jsi6Object21getPropertyAsFunctionERNS0_8IRuntimeEPKc',
    '__ZNO8facebook3jsi6Object10asFunctionERNS0_8IRuntimeE',
}

def inspect(data):
    assert data[:4]==b'\xcf\xfa\xed\xfe'
    offset=32; symtab=None
    for _ in range(struct.unpack_from('<I',data,16)[0]):
        command,size=struct.unpack_from('<II',data,offset)
        assert size>=8 and offset+size<=len(data)
        if command==2: symtab=struct.unpack_from('<4I',data,offset+8)
        offset+=size
    assert symtab is not None
    symbols,count,strings,string_size=symtab
    assert symbols+count*16<=len(data) and strings+string_size<=len(data)
    defined=set(); flat=set()
    for i in range(count):
        string,kind,section,description,value=struct.unpack_from('<IBBHQ',data,symbols+i*16)
        if not string or kind&0xe0: continue  # skip STAB/debug entries
        assert string<string_size
        name=data[strings+string:strings+string_size].split(b'\0',1)[0].decode()
        if kind&0xe: defined.add(name)
        elif description>>8 in (0,254,255): flat.add(name)
    unresolved=flat-defined
    unexpected=unresolved-HOST_SYMBOLS
    if unexpected: raise ValueError('Unexpected unresolved native symbols: '+', '.join(sorted(unexpected)))
    assert '_showRukcordNotification' in defined, 'Notification C implementation missing'
    assert '__Z23showRukcordNotificationP8NSString' not in flat, 'Notification caller has C++ linkage'
    return {'unexpected_unresolved_symbols':[], 'host_jsi_symbols':sorted(unresolved),
            'notification_c_symbol_defined':True,'notification_cpp_reference':False}

def audit(path):
    path=Path(path)
    result=inspect(path.read_bytes())
    path.with_suffix('.symbols.json').write_text(json.dumps(result,indent=2)+'\n')
    print('Native symbol audit passed: notification has C linkage; only allowlisted host JSI remains unresolved')
    return result

if __name__=='__main__': audit(sys.argv[1])
