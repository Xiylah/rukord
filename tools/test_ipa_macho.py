import struct
import unittest
from ipa_macho import inject, commands, dependency_names

def image(cryptid=0, padding=True):
    header = struct.pack('<8I',0xfeedfacf,0x100000c,0,2,2,176,0,0)
    segment = struct.pack('<II16sQQQQIIII',0x19,152,b'__TEXT',0,4096,0,4096,7,5,1,0)
    section = struct.pack('<16s16sQQIIIIIIII',b'__text',b'__TEXT',512,8,512,2,0,0,0,0,0,0)
    crypt = struct.pack('<6I',0x2c,24,512,8,cryptid,0)
    return header + segment + section + crypt + (bytes(304) if padding else b'X'*304) + b'CODEHERE'

class InsertionTests(unittest.TestCase):
    def test_insert_preserves_code_and_offsets(self):
        original=image(); result=inject(original,'@executable_path/Frameworks/Rukcord.dylib')
        self.assertEqual(result[512:],original[512:])
        self.assertEqual(len(result),len(original))
        self.assertEqual(len(commands(result)),3)
        self.assertEqual(dependency_names(result),['@executable_path/Frameworks/Rukcord.dylib'])
    def test_refuses_encrypted_executable(self):
        with self.assertRaisesRegex(ValueError,'Encrypted'): inject(image(1),'x')
    def test_refuses_occupied_header_padding(self):
        with self.assertRaisesRegex(ValueError,'padding'): inject(image(padding=False),'x')
    def test_refuses_duplicate_insertion(self):
        with self.assertRaisesRegex(ValueError,'already'): inject(inject(image(),'x'),'x')
    def test_refuses_invalid_command_size(self):
        data=bytearray(image()); struct.pack_into('<I',data,36,0)
        with self.assertRaisesRegex(ValueError,'command'): inject(data,'x')

if __name__ == '__main__': unittest.main()
