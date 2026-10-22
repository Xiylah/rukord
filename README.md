# Rukcord

This repository builds Rukcord **0.4.0-alpha.5**:

| Build | Install method | Discord version |
| --- | --- | --- |
| Deb | Rootless jailbreak, including Dopamine | 349/350 |
| IPA | Sideloading | 349.0 |

The native loader requires iOS 16 or later. Discord 351 and iOS 27 have not
been validated. Individual plugins may need changes between Discord versions.

## Build

Follow [BUILD.md](BUILD.md) to install dependencies and configure the toolchain.

```sh
python build.py deb
python build.py ipa --base-ipa /path/to/decrypted-discord-349.ipa
```

Outputs are written to `dist/deb/` and `dist/ipa/`. The IPA needs signing with
your sideloading tool. Supply your own decrypted Discord IPA; Discord binaries,
Apple SDKs and signing certificates are not included.

## Source

- `RukcordNative/`: loader, native hooks and deb metadata
- `rukcord/`: client, settings and plugins
- `tools/`: build and validation scripts
- `art/`: mascot and icons
- `licenses/`: dependency licenses

Font changes require closing and reopening Discord. Ordinary sideloading does
not provide Discord's official push-notification provisioning.

## Credits and licenses

See [UPSTREAM-NOTICES.md](UPSTREAM-NOTICES.md), the
[native license](RukcordNative/LICENSE), and the [client license](rukcord/LICENSE).
Keep the original copyright and dependency notices when redistributing.
