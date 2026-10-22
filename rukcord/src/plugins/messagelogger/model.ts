// SPDX-License-Identifier: MPL-2.0
// Mobile behavior port: private metadata, exact ignore IDs and bounded history.
export const HISTORY_LIMIT = 24_000;
const ids = (input: unknown) => new Set(typeof input === "string" ? input.split(/[\s,]+/).filter(Boolean) : []);

export function deletedMessage(message: any, settings: any, now: string): any {
    const content = message._rkCurrentContent ?? message.content;
    return {...message, was_deleted: true, _rkDeletedAt: now, _rkCurrentContent: content,
        // Voice messages must keep their empty content and actual voice flags.
        content: settings.markDeleted !== false && !((message.flags ?? 0) & 8192) && typeof content === "string"
            ? `[deleted] ${content}` : message.content,
        attachments: Array.isArray(message.attachments) ? message.attachments.map((a: any) => ({...a, _rkDeleted: true})) : message.attachments};
}

export function shouldLog(message: any, settings: any, kind: "edit" | "delete", selfId?: string, channel?: any): boolean {
    if (!message?.id || ((message.flags ?? 0) & 64)) return false;
    if (kind === "edit" && settings.edited?.enabled === false || kind === "delete" && settings.deleted?.enabled === false) return false;
    if (settings.filters?.ignoreBots && (message.author?.bot || message.author?.system)) return false;
    if ((settings.filters?.ignoreSelf || kind === "edit" && settings.filters?.ignoreSelfEdits)
        && selfId && message.author?.id === selfId) return false;
    return !ids(settings.ignoreLists?.user).has(message.author?.id)
        && !ids(settings.ignoreLists?.channel).has(message.channel_id ?? message.channelId)
        && !ids(settings.ignoreLists?.channel).has(channel?.parent_id)
        && !ids(settings.ignoreLists?.guild).has(channel?.guild_id ?? message.guild_id);
}

export function retainAttachments(previous: any[], incoming: any[] | undefined, enabled: boolean): any[] | undefined {
    if (incoming === undefined || !enabled) return incoming;
    const current = Array.isArray(incoming) ? incoming : [];
    const old = Array.isArray(previous) ? previous : [];
    const live = new Set(current.map(a => a?.id ?? a?.url));
    return [...old.filter(a => a && !live.has(a.id ?? a.url)).map(a => ({...a, _rkDeleted: true})), ...current].slice(-100);
}

export function editMessage(previous: any, incoming: any, settings: any, now: string): any {
    const oldContent = previous._rkCurrentContent ?? previous.content;
    const newContent = incoming.content;
    const result = {...incoming};
    if (typeof oldContent === "string" && typeof newContent === "string" && oldContent !== newContent) {
        const history = [...(Array.isArray(previous._rkHistory) ? previous._rkHistory : []), {timestamp: now, content: oldContent}].slice(-50);
        let budget = HISTORY_LIMIT;
        const kept = [];
        for (let i=history.length-1; i>=0 && budget>0; i--) {
            const content = typeof history[i]?.content === "string" ? history[i].content.slice(-budget) : "";
            budget -= content.length; kept.unshift({...history[i],content});
        }
        result._rkHistory = kept;
        result._rkCurrentContent = newContent;
        if (settings.inlineEdits !== false) {
            const separator = settings.edited?.showSeparator === false ? "\n" : "\n`[ EDITED ]`\n";
            const oldText = kept.map(e => e.content).join(separator);
            const room = Math.max(0, HISTORY_LIMIT - newContent.length - separator.length);
            result.content = (room ? oldText.slice(-room) + separator : "") + newContent;
        }
    }
    if (Array.isArray(incoming.attachments)) result.attachments = retainAttachments(previous.attachments, incoming.attachments, settings.logDeletedAttachments !== false);
    return result;
}
