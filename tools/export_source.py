"""Export source files without dependencies, caches or generated bundles."""
from pathlib import Path
import os,zipfile
root=Path(__file__).resolve().parent.parent
skip={"node_modules","native-build","dist","packages",".theos",".git","__pycache__",".layout-test"}
target=root/"dist/Rukcord-0.6.1a-source.zip";target.parent.mkdir(exist_ok=True)
with zipfile.ZipFile(target,"w",zipfile.ZIP_DEFLATED) as archive:
    for folder,dirs,files in os.walk(root,followlinks=False):
        dirs[:]=sorted(name for name in dirs if name not in skip and not name.startswith("ipa-stage") and not (name == "build" and Path(folder).relative_to(root).as_posix() != "rukcord/scripts"))
        for name in sorted(files):
            file=Path(folder)/name;relative=file.relative_to(root).as_posix()
            if name.endswith((".log",".pyc")) or relative in {"RukcordNative/Resources/rukcord.js","RukcordNative/Resources/payload-base.js"}:continue
            archive.write(file,"Rukcord/"+relative)
print(target)
