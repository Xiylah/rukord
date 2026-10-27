# Build

Requires Node 24 and Python 3 with Pillow. Native builds use Zig 0.14.1,
iPhoneOS16.5 SDK and Apple Codesign 0.29.0. Set `ZIG_BIN`, `IOS_SDK` and
`RCODESIGN_BIN` to their absolute paths. Toolchains and Discord binaries are
not included.

```sh
cd rukcord
npm ci --legacy-peer-deps --ignore-scripts --no-audit --no-fund
node scripts/build.mjs --release-branch main --build-minify
npm test
cd ..
python tools/build_windows.py --target deb
python tools/verify_signature.py
python tools/test_native_symbols.py
python tools/test_font_policy.py
```

```sh
python tools/package_deb.py
python tools/validate_deb.py dist/local.rukcord.tweak_0.6.0~alpha6_iphoneos-arm64.deb
```

For a sideload IPA, supply your own decrypted Discord 350 IPA:

```sh
python tools/build_windows.py --target ipa
python tools/package_ipa.py /absolute/path/Discord-350-decrypted.ipa dist
python tools/validate_ipa.py dist/Rukcord-0.6.0-alpha.6-Discord-350.0.ipa
```

The two native builds use separate outputs. The IPA build always loads its
bundled resources, including on jailbroken phones. The packaging tool rejects
encrypted executables. Your sideload installer must sign and provision the IPA.
The IPA keeps the Rukcord display name and uses `local.rukcord.Discord`.
Push notifications are not provisioned. No iOS 27 compatibility claim is made.


For Theos, copy `rukcord/dist/rukcord.min.js` to
`RukcordNative/Resources/rukcord.js`, then run `make -C RukcordNative package`.
The Theos build has not been verified here.

Generated native hooks are included for the Python build. After editing `.x`
or `.xm` hook declarations, regenerate the matching files in `Generated/` with
Logos internal generator 777925d1add4ee3485a2432a6f6d5e3ded59de7b.
The iPhoneOS16.5 SDK source revision is 0222fd5413cf4b9af096f37b4621afa2688572f7.
`resolve_sdk_links.py` handles SDK checkouts represented by link files.

Export sources: `python tools/export_source.py`.
Archive checks do not replace testing inside Discord on an iPhone.

To rebuild a previous Rukcord IPA, pass `--upgrade-rukcord` after the output
directory. This replaces Rukcord resources and keeps the existing loader command.
