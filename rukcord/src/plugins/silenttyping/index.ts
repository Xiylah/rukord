// SPDX-License-Identifier: MPL-2.0
// Native behavior port; upstream credits are retained in UPSTREAM-NOTICES.md.
import { instead } from "@api/patcher";
import { findByProps } from "@metro/wrappers";
import { definePlugin } from "@plugins";
import { Contributors } from "@rukcord/Developers";
import Settings from "./settings";
import { useTypingSettings } from "./storage";
let restore: (() => unknown) | undefined;
export default definePlugin({
    id: "silenttyping", name: "SilentTyping", version: "2.0.0-rukcord",
    description: "Hide typing indicators, with a live privacy toggle.",
    author: [Contributors.redstonekasi], settings: Settings,
    start() {
        if (restore) return;
        const typing = findByProps("startTyping", "stopTyping");
        if (!typing || typeof typing.startTyping !== "function") throw new Error("Typing controls are unavailable on this Discord version");
        restore = instead("startTyping", typing, (args, original) => {
            if (useTypingSettings.getState().isEnabled !== false) return;
            return original(...args);
        });
        // stopTyping is intentionally left working, so an existing indicator can expire.
    },
    stop() { restore?.(); restore = undefined; },
});
