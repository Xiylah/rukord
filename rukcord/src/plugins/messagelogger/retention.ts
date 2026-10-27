// SPDX-License-Identifier: MPL-2.0
import { editMessage, snapshotMessage } from "./model";

export function createRetention(limit = 500) {
    const entries = new Map<string, any>();
    const key = (channel: string, id: string) => `${channel}/${id}`;
    const get = (channel: string, id: string) => entries.get(key(channel, id));
    const set = (message: any) => {
        const copy = snapshotMessage(message);
        if (!copy.id || !copy.channel_id) return;
        const id = key(copy.channel_id, copy.id);
        entries.delete(id); entries.set(id, copy);
        while (entries.size > limit) entries.delete(entries.keys().next().value!);
    };
    const decorate = (message: any, settings: any = {}) => {
        const raw = snapshotMessage(message), saved = get(raw.channel_id, raw.id);
        if (!saved) return message;
        if (!saved.was_deleted && typeof raw.content === "string" && raw.content !== saved._rkCurrentContent && raw.content !== saved.content) {
            const updated = { ...raw, ...saved, ...editMessage(saved, raw, settings, new Date().toISOString()), author: raw.author ?? saved.author };
            set(updated);
            return updated;
        }
        return { ...raw, ...saved, author: raw.author ?? saved.author };
    };
    const numeric = (id: string) => typeof id === "string" && /^\d+$/.test(id);
    const compare = (a: any, b: any) => numeric(a.id) && numeric(b.id)
        ? BigInt(a.id) > BigInt(b.id) ? 1 : BigInt(a.id) < BigInt(b.id) ? -1 : 0
        : String(a.id).localeCompare(String(b.id));
    const page = (channelId: string, messages: any[], latest: boolean, settings: any = {}) => {
        const result = messages.map(message => decorate(message, settings));
        const present = new Set(result.map(m => m.id));
        const sorted = [...messages].sort(compare);
        const oldest = sorted[0], newest = sorted[sorted.length - 1];
        for (const saved of entries.values()) {
            if (saved.channel_id !== channelId || !saved.was_deleted || present.has(saved.id)) continue;
            if (oldest && numeric(saved.id) && numeric(oldest.id) && compare(saved, oldest) < 0) continue;
            if (!latest && newest && numeric(saved.id) && numeric(newest.id) && compare(saved, newest) > 0) continue;
            result.push(saved);
        }
        const descending = messages.length < 2 || compare(messages[0], messages[messages.length - 1]) >= 0;
        return result.sort((a, b) => descending ? compare(b, a) : compare(a, b));
    };
    return { get, set, decorate, page,
        remove: (channel: string, id: string) => entries.delete(key(channel, id)),
        values: () => Array.from(entries.values()),
        clear: () => entries.clear() };
}
