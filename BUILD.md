# Build

These commands use Windows PowerShell. The Windows build is verified; other
hosts and the optional Theos route have not been verified here.

## Requirements

- Node.js 24, Python 3.11 or later, and Git
- [Zig 0.14.1](https://ziglang.org/download/)
- [Apple Codesign 0.29.0](https://github.com/indygreg/apple-platform-rs/releases/tag/apple-codesign%2F0.29.0), which provides `rcodesign`
- iPhoneOS16.5 SDK, obtained separately

The SDK revision used for verification is
`0222fd5413cf4b9af096f37b4621afa2688572f7` from
[theos/sdks](https://github.com/theos/sdks). Preserve its symlinks when checking
it out. If Windows checked them out as text files, set `THEOS_SDKS_ROOT` to the
SDK repository folder and run `python tools/resolve_sdk_links.py` once.
That script modifies only the SDK's link files to contain their target data.

From the repository root, install dependencies:

```powershell
python -m pip install -r requirements.txt
Push-Location rukcord
npm ci --legacy-peer-deps --ignore-scripts --no-audit --no-fund
Pop-Location
```

Set tool paths for this shell, using your actual locations:

```powershell
$env:ZIG_BIN = 'C:\Tools\zig-0.14.1\zig.exe'
$env:IOS_SDK = 'C:\Tools\sdks\iPhoneOS16.5.sdk'
$env:RCODESIGN_BIN = 'C:\Tools\apple-codesign\rcodesign.exe'
```

## Rootless deb

```powershell
python build.py deb
```

The package is written to `dist/deb/`. Install it with a rootless jailbreak
package manager. A Discord IPA is not required for this build.

## Sideload IPA

Provide an existing decrypted, unmodified Discord 349.0 arm64 IPA:

```powershell
python build.py ipa --base-ipa 'C:\Apps\Discord-349.0-decrypted.ipa'
```

The package and validation report are written to `dist/ipa/`. Sign the IPA
with your sideloading tool before installation. It is ad-hoc signed during
packaging and contains no Apple distribution certificate or provisioning
profile. App extensions are removed during packaging.

The packager currently accepts Discord 349.0 only. Changing that version check
does not establish compatibility with a newer Discord build. This route does
not preserve official Discord push notifications.

Both commands rebuild the client and native loader, then validate the package.
Their native object files are kept separately in `native-build/deb/` and
`native-build/ipa/`. Use `--output 'C:\Builds\Rukcord'` to choose an output folder.

## Checks

```powershell
Push-Location rukcord
npm test
Pop-Location
python tools/test_native_symbols.py
python tools/test_ipa_macho.py
python tools/test_ipa_validation.py
python tools/test_font_policy.py
```

The font-policy check needs `ZIG_BIN`. GitHub Actions runs the client build,
client tests, native-symbol tests and IPA injection and validation tests. It does not package
Discord or test on an iPhone. Package validation also does not replace device
testing.

## Native changes

Logos input files (`.x` and `.xm`) live in `RukcordNative/Sources/`.
The Python build uses their generated files in `RukcordNative/Generated/`.
After changing a hook declaration, regenerate the matching file with the Logos
internal generator before building. The included output was generated using
Logos revision `777925d1add4ee3485a2432a6f6d5e3ded59de7b`.
`RUKCORD_IPA` selects app-local resources and the sideload compatibility code.

For a configured Theos installation, build the JavaScript client, copy
`rukcord/dist/rukcord.min.js` to `RukcordNative/Resources/rukcord.js`, then run
`make -C RukcordNative package`. This optional route builds the deb only.

Export a source ZIP with `python tools/export_source.py`.
