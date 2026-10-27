from pathlib import Path
import subprocess, shutil, os
repo=Path(os.environ['THEOS_SDKS_ROOT']).resolve();sdk=repo/'iPhoneOS16.5.sdk'
rows=subprocess.check_output(['git','-C',str(repo),'ls-files','-s','-z']).decode().split('\0')
links={}
for row in rows:
    if not row.startswith('120000 '):continue
    name=row.split('\t',1)[1]
    if not name.startswith('iPhoneOS16.5.sdk/'):continue
    p=repo/name
    if p.is_file(): links[p]=p.read_text().strip()
count=0
for p,target in links.items():
    t=(p.parent/target).resolve()
    if not t.is_relative_to(sdk):raise RuntimeError(f'Out-of-SDK link {p}: {target}')
    visited=set()
    while t in links:
        if t in visited:raise RuntimeError('Link cycle')
        visited.add(t);t=(t.parent/links[t]).resolve()
    if t.is_file():
        p.write_bytes(t.read_bytes());count+=1
    else: print('Unresolved link:',p.relative_to(sdk),target)
print('Materialized',count,'SDK header/library symlinks')
