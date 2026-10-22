"""Package an existing, unencrypted Discord 349 IPA for local sideload signing.

Does not decrypt apps, obtain certificates, install, or upload anything.
Usage: python tools/package_ipa.py <base.ipa> <output-directory>
Set RCODESIGN_BIN to the existing rcodesign executable.
"""
from pathlib import Path, PurePosixPath
import hashlib
import json
import os
import plistlib
import shutil
import stat
import struct
import subprocess
import sys
import tempfile
import zipfile
from PIL import Image
from ipa_macho import commands, dependency_names, inject

ROOT=Path(__file__).resolve().parent.parent
LOAD='@executable_path/Frameworks/Rukcord.dylib'

def digest(p): return hashlib.sha256(p.read_bytes()).hexdigest()

def _package(base, destination, stage):
    base=base.resolve(); destination=destination.resolve()
    destination.mkdir(parents=True,exist_ok=True)
    removed=[]
    with zipfile.ZipFile(base) as archive:
        if archive.testzip() is not None: raise ValueError('Corrupt input archive')
        infos=[n for n in archive.namelist() if n.count('/')==2 and n.endswith('.app/Info.plist')]
        if len(infos)!=1: raise ValueError('Expected one main app')
        app_prefix=infos[0].rsplit('/',1)[0]+'/'
        metadata=plistlib.loads(archive.read(infos[0]))
        if metadata['CFBundleIdentifier']!='com.hammerandchisel.discord': raise ValueError('Expected Discord')
        if metadata['CFBundleShortVersionString']!='349.0': raise ValueError('This release pins Discord 349.0')
        executable=app_prefix+metadata['CFBundleExecutable']
        original=archive.read(executable)
        patched=inject(original,LOAD)  # validates cryptid=0 and preserves all section offsets
        for info in archive.infolist():
            name=info.filename
            path=PurePosixPath(name)
            if path.is_absolute() or '..' in path.parts or '\\' in name or ':' in name:
                raise ValueError('Unsafe ZIP path')
            if not name.startswith(app_prefix): continue
            if stat.S_ISLNK(info.external_attr>>16): raise ValueError('Input symlinks are not supported')
            relative=name[len(app_prefix):]
            if relative.startswith(('PlugIns/','Watch/')) or '_CodeSignature' in path.parts or path.name=='embedded.mobileprovision':
                removed.append(name); continue
            output=stage.joinpath(*path.parts)
            if info.is_dir(): output.mkdir(parents=True,exist_ok=True); continue
            output.parent.mkdir(parents=True,exist_ok=True)
            output.write_bytes(patched if name==executable else archive.read(name))
            mode=(info.external_attr>>16)&0o777
            if mode: output.chmod(mode)
    app=stage.joinpath(*PurePosixPath(app_prefix).parts)
    resources_source=ROOT/'RukcordNative/Resources/rukcord.js'
    resources_source.parent.mkdir(parents=True,exist_ok=True)
    shutil.copyfile(ROOT/'rukcord/dist/rukcord.min.js',resources_source)
    native=ROOT/'native-build/ipa/Rukcord.dylib'
    dependencies=dependency_names(native.read_bytes())
    assert not any('/var/jb' in p or 'Substrate' in p or 'libhooker' in p for p in dependencies)
    (app/'Frameworks').mkdir(exist_ok=True)
    shutil.copyfile(native,app/'Frameworks/Rukcord.dylib')
    resources=app/'RukcordResources.bundle'; resources.mkdir()
    shutil.copyfile(ROOT/'RukcordNative/Resources/rukcord.js',resources/'rukcord.js')
    shutil.copyfile(ROOT/'art/rukcord-mascot.png',resources/'rukcord-icon.png')
    prelude=(ROOT/'RukcordNative/Sources/payload-base.template.js').read_text().replace('@PACKAGE_VERSION@','0.4.0-alpha.5-ipa').replace('@TWEAK_NAME@','Rukcord')
    (resources/'payload-base.js').write_text(prelude,encoding='utf-8')
    (resources/'Info.plist').write_bytes(plistlib.dumps({
        'CFBundleIdentifier':'local.rukcord.resources','CFBundleName':'RukcordResources',
        'CFBundlePackageType':'BNDL','CFBundleVersion':'4','CFBundleShortVersionString':'0.4.0'}))
    legal=app/'RukcordLegal'; legal.mkdir()
    shutil.copytree(ROOT/'licenses',legal/'licenses')
    for source,name in [('RukcordNative/LICENSE','LICENSE-loader'),('rukcord/LICENSE','LICENSE-client'),
                        ('UPSTREAM-NOTICES.md','UPSTREAM-NOTICES.md')]:
        shutil.copyfile(ROOT/source,legal/name)
    icon=Image.open(ROOT/'art/rukcord-app-icon.png').convert('RGB')
    for filename,size in [('RukcordIcon60x60@2x.png',120),('RukcordIcon60x60@3x.png',180),
                          ('RukcordIcon76x76.png',76),('RukcordIcon76x76@2x.png',152),
                          ('RukcordIcon83.5x83.5@2x.png',167),('RukcordIcon1024.png',1024)]:
        icon.resize((size,size),Image.Resampling.LANCZOS).save(app/filename)
    metadata['CFBundleIdentifier']='local.rukcord.Discord'
    metadata['CFBundleDisplayName']=metadata['CFBundleName']='Rukcord'
    metadata['RukcordVersion']='0.4.0-alpha.5-ipa'
    metadata['CFBundleIcons']={'CFBundlePrimaryIcon':{'CFBundleIconFiles':['RukcordIcon60x60']}}
    metadata['CFBundleIcons~ipad']={'CFBundlePrimaryIcon':{'CFBundleIconFiles':['RukcordIcon76x76','RukcordIcon83.5x83.5']}}
    metadata['CFBundleIconFiles']=['RukcordIcon60x60']
    metadata.pop('CFBundleIconName',None)
    (app/'Info.plist').write_bytes(plistlib.dumps(metadata,fmt=plistlib.FMT_BINARY))
    # This artifact is ad-hoc signed only. A sideloading tool must add its own
    # Apple certificate, provisioning profile, app/keychain IDs and entitlements.
    entitlements=ROOT/'native-build/ipa/empty-entitlements.plist'
    entitlements.write_bytes(plistlib.dumps({}))
    env=os.environ.copy(); signer=env.pop('RCODESIGN_BIN')
    subprocess.run([signer,'sign','--digest','sha256','--entitlements-xml-file',
                    'main:'+str(entitlements.resolve()),'--timestamp-url','none',str(app)],env=env,check=True)
    assert LOAD in dependency_names((app/metadata['CFBundleExecutable']).read_bytes())
    assert (resources/'rukcord.js').read_bytes()==(ROOT/'RukcordNative/Resources/rukcord.js').read_bytes()
    assert metadata['MinimumOSVersion']=='16.0'
    ipa=destination/'Rukcord-0.4.0-alpha.5-ipa-Discord-349.0.ipa'
    macho_files=[]
    with zipfile.ZipFile(ipa,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as archive:
        for file in sorted(stage.rglob('*')):
            if not file.is_file(): continue
            name=file.relative_to(stage).as_posix()
            with file.open('rb') as stream: magic=stream.read(4)
            is_code=magic in (b'\xcf\xfa\xed\xfe',b'\xca\xfe\xba\xbe',b'\xbe\xba\xfe\xca')
            if is_code: macho_files.append(name)
            info=zipfile.ZipInfo(name,(2026,10,21,0,0,0)); info.create_system=3
            info.external_attr=(stat.S_IFREG|(0o755 if is_code else 0o644))<<16
            info.compress_type=zipfile.ZIP_DEFLATED
            archive.writestr(info,file.read_bytes(),compresslevel=6)
    with zipfile.ZipFile(ipa) as archive:
        assert archive.testzip() is None
        assert not any('/PlugIns/' in n or n.endswith('embedded.mobileprovision') for n in archive.namelist())
    validation={
        'artifact':ipa.name,'sha256':digest(ipa),'bytes':ipa.stat().st_size,
        'base_ipa_sha256':digest(base),'discord_version':'349.0','rukcord_version':'0.4.0-alpha.5-ipa',
        'minimum_ios_declared':'16.0','architecture':'arm64','loader':LOAD,
        'signing':'ad-hoc only; requires Apple signing and provisioning by sideload installer',
        'jailbreak_dependencies':False,'bundled_payload_matches_client_build':True,
        'native_dependencies':dependencies,'zip_crc':'all passed','macho_files':macho_files,
        'removed_extensions':sorted({n.split('.appex/')[0]+'.appex' for n in removed if '.appex/' in n}),
        'physical_device_tested':False,'ios_27_verified':False,
        'limits':['No included app extensions, push entitlement, provisioning profile or distribution certificate.',
                  'No claim of guaranteed iOS 16-27 or all-device runtime compatibility.',
                  'Passkeys, Apple-group/keychain services, calls and file pickers need device verification.']}
    (destination/'IPA-VALIDATION.json').write_text(json.dumps(validation,indent=2)+'\n')
    print(json.dumps({'artifact':str(ipa),'bytes':ipa.stat().st_size,'sha256':validation['sha256']},indent=2))

def package(base, destination):
    build = ROOT / 'native-build/ipa'
    build.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='ipa-stage-', dir=build) as temporary:
        return _package(base, destination, Path(temporary))

if __name__=='__main__': package(Path(sys.argv[1]),Path(sys.argv[2]))
