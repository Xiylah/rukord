// SPDX-License-Identifier: MPL-2.0
import { addMessageAction } from "@api/ui/messageActions";
import { showSheet } from "@api/ui/sheets";
import { definePlugin } from "@plugins";
import { Contributors, Developers } from "@rukcord/Developers";
import { MessageStore } from "@metro/common/stores";
import Settings from "./settings";
let restore: (() => void) | undefined;
export default definePlugin({
    id: "viewraw", name: "ViewRaw", version: "2.0.0-rukcord",
    description: "Inspect and copy message JSON with sorting and sensitive-field redaction.",
    author: [Contributors.sapphire, Contributors.Vendicated, Contributors.Bwlok, Developers.j],
    settings: Settings,
    start() {
        if (restore) return;
        restore = addMessageAction({id: "rukcord-view-raw", label: "View Raw",
            onPress: message => showSheet("RukcordRawMessage", import("./RawSheet"), {
                message: MessageStore?.getMessage?.(message.channel_id ?? message.channelId, message.id) ?? message,
            })});
    },
    stop() { restore?.(); restore = undefined; },
});
