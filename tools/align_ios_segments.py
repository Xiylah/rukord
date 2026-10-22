"""Pad segment extents in place for a 16 KB iOS VM, before code signing.

No section or segment address is moved. Only existing zero-filled gaps may be
claimed as padding; otherwise refuse the image rather than relocating code.
"""
from pathlib import Path
import struct
import sys

PAGE = 0x4000

def align_image(path):
    path = Path(path)
    data = bytearray(path.read_bytes())
    assert struct.unpack_from('<I', data)[0] == 0xfeedfacf
    cursor = 32
    segments = []
    for _ in range(struct.unpack_from('<I', data, 16)[0]):
        command, size = struct.unpack_from('<II', data, cursor)
        if command == 0x19:
            name, va, vm, offset, length, maximum, initial, sections, flags = struct.unpack_from('<16sQQQQiiII', data, cursor + 8)
            segments.append((cursor, name.rstrip(b'\0').decode(), va, vm, offset, length))
        cursor += size
    changes = []
    for i, (cursor, name, va, vm, offset, length) in enumerate(segments):
        assert va % PAGE == offset % PAGE == 0, (name, 'unaligned start')
        new_vm = (vm + PAGE - 1) & -PAGE
        # The final LINKEDIT file extent may end at EOF; its VM size is aligned.
        new_length = length if name == '__LINKEDIT' else (length + PAGE - 1) & -PAGE
        if i + 1 < len(segments):
            _, _, next_va, _, next_offset, _ = segments[i + 1]
            assert va + new_vm <= next_va, (name, 'VM overlap')
            assert offset + new_length <= next_offset, (name, 'file overlap')
        assert offset + new_length <= len(data)
        assert not any(data[offset + length:offset + new_length]), (name, 'nonzero padding')
        struct.pack_into('<Q', data, cursor + 32, new_vm)
        struct.pack_into('<Q', data, cursor + 48, new_length)
        if (vm, length) != (new_vm, new_length):
            changes.append((name, vm, new_vm, length, new_length))
    path.write_bytes(data)
    for row in changes:
        print('Aligned segment:', row)

if __name__ == '__main__':
    align_image(sys.argv[1])
