import { definePlugin } from "@plugins";
import { Contributors,Developers } from "@rukcord/Developers";
import { Strings } from "@rukcord/i18n";

import { patchConsole, patchMiscellaneous, patchModDetection,patchNetwork, patchSentry } from "./notrack";
import patchEmojiActionSheet from "./realmoji/patches/patchEmojiActionSheet";
import transformEmoji from "./realmoji/patches/transformEmoji";
import transformSticker from "./realmoji/patches/transformSticker";
import settings from "./settings";

let patches: any[] = [];

export default definePlugin({
    name: Strings.PLUGIN__CORE_RUKCORDENHANCEMENTS,
    description: Strings.PLUGIN__CORE_RUKCORDENHANCEMENTS_DESC,
    author: [Developers.cocobo1, Developers.j, Contributors.rico040, Contributors.redstonekasi],
    id: "rukcordenhancements",
    version: "1.0.0",
    eagerStart() {
        // NoTrack
        patches = [
            patchNetwork(),
            patchConsole(),
            patchMiscellaneous(),
            patchSentry(),
            patchModDetection(),
        ].filter(Boolean);
    },
    start() {
        // Realmoji
        patches.push(...transformEmoji);
        patches.push(...transformSticker);
        patches.push(patchEmojiActionSheet());
    },
    settings: settings
});
