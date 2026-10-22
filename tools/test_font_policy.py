"""Execute the actual native font-weight policy as portable WebAssembly."""
from pathlib import Path
import os,subprocess,shutil
root=Path(__file__).resolve().parent.parent
out=root/'native-build/font-policy-test';out.mkdir(parents=True,exist_ok=True)
source=out/'probe.c';binary=out/'probe.wasm'
source.write_text('#include "FontPolicy.h"\nint role(double weight,int bold,int italic){return RukcordChooseFontRole(weight,bold,italic);}\n')
env=os.environ.copy();env['ZIG_GLOBAL_CACHE_DIR']=str(out/'zig-cache');env['ZIG_LOCAL_CACHE_DIR']=str(out/'zig-local-cache')
subprocess.run([env['ZIG_BIN'],'cc','-target','wasm32-freestanding','-nostdlib','-O2','-I'+str(root/'RukcordNative/Headers'),str(source),'-Wl,--no-entry','-Wl,--export=role','-o',str(binary)],env=env,check=True)
script='''const fs=require('fs');const assert=require('assert/strict');
WebAssembly.instantiate(fs.readFileSync(process.argv[1])).then(({instance})=>{
 const role=instance.exports.role;
 const cases=[[0,0,0,0],[.23,0,0,1],[.3,0,0,2],[.4,0,0,2],[400,0,0,0],[500,0,0,1],[600,0,0,2],[700,0,0,2],[300,0,0,0],[-.8,0,0,0],[NaN,0,0,0],[Infinity,0,0,0],[-Infinity,0,0,0],[0,1,0,2],[0,0,1,3],[0,1,1,4],[400,0,1,3],[700,0,1,4]];
 for(const [weight,bold,italic,expected] of cases)assert.equal(role(weight,bold,italic),expected,String([weight,bold,italic]));
 console.log('Native font policy: '+cases.length+' executed cases passed');
}).catch(e=>{console.error(e);process.exitCode=1});'''
subprocess.run([os.environ.get('NODE_BIN') or shutil.which('node'),'--no-warnings','-e',script,str(binary)],check=True)
