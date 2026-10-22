// SPDX-License-Identifier: MPL-2.0
// Mobile behavior port: reply defaults and exact user/role exemptions.
import { before } from "@api/patcher";
import { findByProps } from "@metro";
import { GuildMemberStore } from "@metro/common/stores";
import { definePlugin } from "@plugins";
import { shouldMention } from "./policy";
import Settings from "./settings";
import { useReplySettings } from "./storage";
let restore: (() => unknown) | undefined;
export default definePlugin({
    id: "noreplymention", name: "NoReplyMention", version: "1.0.0-rukcord",
    description: "Default replies to no ping, with optional user and role exemptions.",
    author: [{name: "Rukcord", id: 0n}], settings: Settings,
    start() {
        if (restore) return;
        const replies = findByProps("createPendingReply");
        if (!replies || typeof replies.createPendingReply !== "function") throw new Error("Reply controls are unavailable on this Discord build");
        restore = before("createPendingReply", replies, args => {
            const reply = args[0];
            if (!reply?.message?.author?.id) return;
            try {
                const guildId = reply.channel?.guild_id;
                const roles = guildId ? GuildMemberStore?.getMember?.(guildId, reply.message.author.id)?.roles : [];
                return [{...reply, shouldMention: shouldMention(reply.message.author.id, roles, useReplySettings.getState())}, ...args.slice(1)];
            } catch (error) { console.error("[NoReplyMention] Leaving reply unchanged:", error); }
        });
    },
    stop() { restore?.(); restore = undefined; },
});
