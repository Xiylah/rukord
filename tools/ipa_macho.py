"""Strict, no-relocation loader insertion for a thin arm64 Mach-O."""
import struct

def commands(data):
    if data[:4] != b'\xcf\xfa\xed\xfe':
        raise ValueError('Expected thin little-endian Mach-O 64')
    if struct.unpack_from('<I', data, 4)[0] != 0x100000c:
        raise ValueError('Expected arm64')
    count, size = struct.unpack_from('<II', data, 16)
    end = 32 + size
    if end > len(data): raise ValueError('Invalid command region')
    offset = 32
    result = []
    for _ in range(count):
        command, length = struct.unpack_from('<II', data, offset)
        if length < 8 or length % 8 or offset + length > end:
            raise ValueError('Invalid load command')
        result.append((command, offset, length))
        offset += length
    if offset != end: raise ValueError('Command size mismatch')
    return result

def dependency_names(data):
    return [data[o + struct.unpack_from('<I', data, o+8)[0]:o+s].split(b'\0')[0].decode()
            for c,o,s in commands(data) if c in (0xc,0x80000018,0x8000001f,0x80000023)]

def inject(data, name):
    table = commands(data)
    if name in dependency_names(data): raise ValueError('Loader already injected')
    sections = []
    for c,o,s in table:
        if c in (0x21,0x2c) and struct.unpack_from('<I',data,o+16)[0]:
            raise ValueError('Encrypted executables are not accepted')
        if c == 0x19:
            count = struct.unpack_from('<I',data,o+64)[0]
            if 72 + count*80 > s: raise ValueError('Invalid section table')
            for j in range(count):
                section = o + 72 + j*80
                offset = struct.unpack_from('<I',data,section+48)[0]
                if offset: sections.append(offset)
    if not sections: raise ValueError('No file-backed sections')
    payload = name.encode() + b'\0'
    length = (24 + len(payload) + 7) & ~7
    end = 32 + struct.unpack_from('<I',data,20)[0]
    if end + length > min(sections) or any(data[end:end+length]):
        raise ValueError('Insufficient zero header padding; refusing relocation')
    result = bytearray(data)
    result[end:end+length] = struct.pack('<6I',0xc,length,24,2,0x10000,0x10000) + payload + bytes(length-24-len(payload))
    struct.pack_into('<II',result,16,len(table)+1,end-32+length)
    assert len(result) == len(data) and result[min(sections):] == data[min(sections):]
    commands(result)
    return bytes(result)
