// SPDX-License-Identifier: MPL-2.0
// Keep local history separately from Discord message records.
import { instead } from "@api/patcher";
import { addMessageAction } from "@api/ui/messageActions";
import { findByProps } from "@metro";
import { ChannelStore, MessageStore, UserStore } from "@metro/common/stores";
import { definePlugin } from "@plugins";
import { Contributors, Developers } from "@rukcord/Developers";
import { addLogEntry, removeMessageLogs, repairCorruptedLogs } from "./database";
import { deletedMessage, editMessage, shouldLog, snapshotMessage } from "./model";
import { retainedMessages as retained, loadRetainedMessages, saveRetainedMessages, flushRetainedMessages } from "./retainedStore";
import Settings from "./settings";
import { useMessageLoggerSettings } from "./storage";

let restore: (() => unknown) | undefined;
let restoreAction: (() => void) | undefined;
let generation = 0;
function persist(message: any, type: "DELETE" | "UPDATE") {
    if (!useMessageLoggerSettings.getState().databaseLogging) return;
    void addLogEntry({timestamp: new Date().toISOString(), type,
        messageId: message.id, channelId: message.channel_id ?? message.channelId,
        author: {id: message.author?.id ?? "", username: message.author?.username ?? "",
            discriminator: message.author?.discriminator ?? "", bot: !!message.author?.bot},
        content: message._rkCurrentContent ?? message.content ?? "",
        attachments: Array.isArray(message.attachments) ? message.attachments.map((a: any) => a?.url).filter((u: unknown) => typeof u === "string") : [],
    }).catch(error => console.error("[MessageLogger] Could not persist log:", error));
}

function permitted(message: any, kind: "edit" | "delete", settings: any) {
    const channel = ChannelStore?.getChannel?.(message.channel_id ?? message.channelId);
    return shouldLog(message, settings, kind, UserStore?.getCurrentUser?.()?.id, channel);
}

export default definePlugin({
    id: "messagelogger", name: "MessageLogger", version: "3.0.0-rukcord",
    description: "Keep cached deleted messages, edit history and removed attachments locally.",
    author: [Contributors.LampDelivery, Developers.kmmiio99o], settings: Settings,
    async start() {
        if (restore) return;
        const token = ++generation;
        const dispatcher = findByProps("dispatch", "_subscriptions");
        if (!dispatcher || typeof dispatcher.dispatch !== "function" || typeof MessageStore?.getMessage !== "function") {
            throw new Error("Message logging is unavailable on this Discord build");
        }
        try { await loadRetainedMessages(() => token === generation); }
        catch (error) { console.error("[MessageLogger] Could not restore local history:", error); }
        if (token !== generation) return;
        if (useMessageLoggerSettings.getState().databaseLogging) {
            try { await repairCorruptedLogs(); }
            catch (error) { console.error("[MessageLogger] Repair failed:", error); }
        }
        if (token !== generation || restore) return;
        restore = instead("dispatch", dispatcher, (args, original) => {
            const event = args[0];
            if (!event || event.rukcordLoggerBypass || event.otherPluginBypass) return original(...args);
            const settings = useMessageLoggerSettings.getState();
            try {
                if (event.type === "MESSAGE_DELETE" || event.type === "MESSAGE_DELETE_BULK") {
                    const channelId = event.channelId ?? event.channel_id;
                    const ids: string[] = event.type === "MESSAGE_DELETE_BULK" ? event.ids : [event.id];
                    if (!channelId || !Array.isArray(ids) || ids.length > 1000) return original(...args);
                    const keep: any[] = [], remove: string[] = [];
                    for (const id of ids) {
                        const message = retained.get(channelId, id) ?? MessageStore.getMessage(channelId, id);
                        if (!message || !permitted(message, "delete", settings)) { remove.push(id); continue; }
                        keep.push(deletedMessage(message, settings, new Date().toISOString()));
                    }
                    for (const message of keep) {
                        retained.set(message);
                        saveRetainedMessages();
                        original({...event, type: "MESSAGE_UPDATE", message, rukcordLoggerBypass: true});
                        persist(message, "DELETE");
                    }
                    if (!keep.length) return original(...args);
                    if (remove.length) return original({...event, ids: remove});
                    return;
                }
                if (event.type === "MESSAGE_UPDATE" && event.message?.id) {
                    const incoming = event.message;
                    const channelId = incoming.channel_id ?? incoming.channelId;
                    const cached = MessageStore.getMessage(channelId, incoming.id);
                    const saved = retained.get(channelId, incoming.id);
                    const previous = saved ?? cached;
                    if (!previous || !permitted({...previous, ...incoming, flags: incoming.flags ?? previous.flags,
                        author: incoming.author ?? previous.author}, "edit", settings)) return original(...args);
                    const message = editMessage(previous, incoming, settings, new Date().toISOString());
                    if (message._rkHistory || saved) {
                        const full = { ...snapshotMessage(previous), ...message };
                        // Repeated/partial updates must not replace the rendered history with raw text.
                        if (saved && !message._rkHistory) {
                            Object.assign(full, { _rkHistory: saved._rkHistory, _rkCurrentContent: saved._rkCurrentContent,
                                was_deleted: saved.was_deleted, content: saved.content });
                        }
                        retained.set(full);
                        saveRetainedMessages();
                        Object.assign(message, full);
                    }
                    if (message._rkHistory !== previous._rkHistory && message._rkHistory) persist({...previous, ...message}, "UPDATE");
                    return original({...event, message});
                }
                if ((event.type === "LOAD_MESSAGES_SUCCESS" || event.type === "LOAD_MESSAGES_SUCCESS_CACHED") && Array.isArray(event.messages)) {
                    const channelId = event.channelId ?? event.channel_id;
                    if (channelId) return original({ ...event, messages: retained.page(channelId, event.messages, event.isBefore !== true && event.hasMoreAfter !== true, settings) });
                }
            } catch (error) {
                console.error("[MessageLogger] Event left to Discord after logging failed:", error);
            }
            return original(...args);
        });
        // The native sheet adapter is optional: logging can run on builds where
        // message sheets changed, without injecting unverified row elements.
        try {
            restoreAction = addMessageAction({id: "rukcord-clear-message-history", label: "Clear message log",
                visible: m => {
                    const current = retained.get(m.channel_id ?? m.channelId, m.id) ?? MessageStore.getMessage(m.channel_id ?? m.channelId, m.id) ?? m;
                    return !!(current.was_deleted || current._rkHistory?.length || current.attachments?.some((a: any) => a._rkDeleted));
                },
                onPress: message => {
                    const channelId = message.channel_id ?? message.channelId;
                    const current = retained.get(channelId, message.id) ?? MessageStore.getMessage(channelId, message.id) ?? message;
                    retained.remove(channelId, message.id);
                    flushRetainedMessages();
                    if (current.was_deleted) dispatcher.dispatch({type: "MESSAGE_DELETE", channelId, id: current.id, rukcordLoggerBypass: true});
                    else dispatcher.dispatch({type: "MESSAGE_UPDATE", rukcordLoggerBypass: true,
                        message: {...current, content: current._rkCurrentContent ?? current.content, _rkHistory: [],
                            attachments: current.attachments?.filter((a: any) => !a._rkDeleted)}});
                    if (settingsDatabaseEnabled()) void removeMessageLogs(channelId, current.id).catch(error => console.error("[MessageLogger] Clear failed:", error));
                }});
        } catch (error) { console.error("[MessageLogger] History menu unavailable:", error); }
    },
    stop() { ++generation; const running = !!restore; restore?.(); restore = undefined; restoreAction?.(); restoreAction = undefined; if (running) flushRetainedMessages(); retained.clear(); },
});
function settingsDatabaseEnabled() { return !!useMessageLoggerSettings.getState().databaseLogging; }
