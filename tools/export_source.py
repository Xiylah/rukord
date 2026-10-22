"""Export source files without dependencies, private files or build outputs."""
import os
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parent.parent
SKIP_DIRS = {
    'node_modules', 'native-build', 'dist', 'packages', '.theos', '.git',
    '__pycache__', '.layout-test', '.venv', 'venv',
}
SKIP_SUFFIXES = {'.log', '.pyc', '.ipa', '.deb', '.p12', '.p8', '.mobileprovision'}
GENERATED = {'RukcordNative/Resources/rukcord.js', 'RukcordNative/Resources/payload-base.js'}
target = ROOT / 'dist/Rukcord-source.zip'
target.parent.mkdir(exist_ok=True)

with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED) as archive:
    for folder, dirs, files in os.walk(ROOT, followlinks=False):
        dirs[:] = sorted(name for name in dirs if name not in SKIP_DIRS and not name.startswith('ipa-stage'))
        for name in sorted(files):
            file = Path(folder) / name
            relative = file.relative_to(ROOT).as_posix()
            if file.suffix.lower() in SKIP_SUFFIXES or name == '.env' or relative in GENERATED:
                continue
            archive.write(file, 'Rukcord/' + relative)
print(target)
