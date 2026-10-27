import struct
import unittest
from audit_native_symbols import inspect

def image(extra):
    symbols=[('_showRukcordNotification',0xf,0,4096)]+extra
    strings=b'\0'; entries=b''
    for name,kind,ordinal,value in symbols:
        entries+=struct.pack('<IBBHQ',len(strings),kind,1 if kind&0xe else 0,ordinal<<8,value)
        strings+=name.encode()+b'\0'
    return (struct.pack('<8I',0xfeedfacf,0x100000c,0,6,1,24,0,0)+
        struct.pack('<6I',2,24,56,len(symbols),56+len(entries),len(strings))+entries+strings)

class NativeSymbols(unittest.TestCase):
    def test_accepts_c_definition_and_pinned_jsi(self):
        self.assertTrue(inspect(image([('__ZN8facebook3jsi5ValueD1Ev',1,0,0)]))['notification_c_symbol_defined'])
    def test_rejects_reported_cpp_reference(self):
        with self.assertRaisesRegex(ValueError,'showRukcordNotification'):
            inspect(image([('__Z23showRukcordNotificationP8NSString',1,0,0)]))
    def test_rejects_other_accidentally_unresolved_local_function(self):
        with self.assertRaisesRegex(ValueError,'missingFunction'):
            inspect(image([('_missingFunction',1,0,0)]))
    def test_accepts_local_symbol_defined_in_same_image(self):
        inspect(image([('_localFunction',1,0,0),('_localFunction',0xf,0,8192)]))

if __name__=='__main__': unittest.main()
