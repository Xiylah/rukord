from pathlib import Path
import struct
import sys

def validate(path):
    return validate_bytes(Path(path).read_bytes())

def validate_bytes(data):
    cursor = 32
    ranges = []
    text = None
    init_sections = []
    for _ in range(struct.unpack_from('<I', data, 16)[0]):
        command, size = struct.unpack_from('<II', data, cursor)
        if command == 0x19:
            raw, va, vm, offset, length, maximum, initial, count, flags = struct.unpack_from('<16sQQQQiiII', data, cursor + 8)
            name = raw.rstrip(b'\0').decode()
            assert va % 0x4000 == 0 and vm % 0x4000 == 0, (name, 'VM extent not 16 KB aligned')
            assert offset % 0x4000 == 0, (name, 'file start not 16 KB aligned')
            if name != '__LINKEDIT':
                assert length % 0x4000 == 0, (name, 'file extent not 16 KB aligned')
            assert length <= vm and offset + length <= len(data)
            ranges.append((va, va + vm, offset, offset + length))
            if name == '__TEXT':
                assert maximum == initial == 5, 'Code must be read/execute, not writable'
                text = (va, va + vm)
            for i in range(count):
                section = cursor + 72 + 80 * i
                address, section_size = struct.unpack_from('<QQ', data, section + 32)
                file_offset = struct.unpack_from('<I', data, section + 48)[0]
                section_flags = struct.unpack_from('<I', data, section + 64)[0]
                assert va <= address and address + section_size <= va + vm
                kind = section_flags & 0xff
                if kind in (9, 0x16): # Pointers or newer S_INIT_FUNC_OFFSETS
                    init_sections.append((file_offset, section_size, kind))
        cursor += size
    assert text and init_sections
    for earlier, later in zip(ranges, ranges[1:]):
        assert earlier[1] <= later[0] and earlier[3] <= later[2], 'Overlapping segments'
    for offset, length, kind in init_sections:
        stride = 8 if kind == 9 else 4
        for at in range(offset, offset + length, stride):
            pointer = struct.unpack_from('<Q' if stride == 8 else '<I', data, at)[0]
            if kind == 0x16:
                pointer += text[0]
            assert text[0] <= pointer < text[1], 'Initializer lies outside executable segment'
    return True

if __name__ == '__main__':
    validate(sys.argv[1])
    print('iOS 16 KB segment extents, protections, and initializer locations verified')
