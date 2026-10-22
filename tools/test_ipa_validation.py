"""Signing may replace signatures, but must preserve the loader contents."""
import struct
import unittest
from validate_ipa import unsigned_contents


def image(signature_size=64, vm_size=4096):
    header = struct.pack('<8I', 0xfeedfacf, 0x100000c, 0, 6, 2, 88, 0, 0)
    segment = struct.pack('<II16sQQQQiiII', 0x19, 72, b'__LINKEDIT',
                          0, vm_size, 120, 136 + signature_size, 1, 1, 0, 0)
    signature = struct.pack('<4I', 0x1d, 16, 256, signature_size)
    return header + segment + signature + b'C' * 136 + b'S' * signature_size


class LoaderComparison(unittest.TestCase):
    def test_accepts_replaced_signature_and_linkedit_extents(self):
        self.assertEqual(unsigned_contents(image()), unsigned_contents(image(128, 8192)))

    def test_rejects_modified_code(self):
        changed = bytearray(image(128))
        changed[200] ^= 1
        self.assertNotEqual(unsigned_contents(image()), unsigned_contents(changed))

    def test_rejects_modified_header(self):
        changed = bytearray(image(128))
        changed[24] ^= 1
        self.assertNotEqual(unsigned_contents(image()), unsigned_contents(changed))


if __name__ == '__main__':
    unittest.main()
