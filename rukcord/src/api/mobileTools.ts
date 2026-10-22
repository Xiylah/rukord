// SPDX-License-Identifier: MPL-2.0
// Native behavior equivalents; no desktop DOM or Webpack patch expressions.
export const isSnowflake = (id: unknown): id is string => typeof id === "string" && /^\d{17,20}$/.test(id);
export function httpURL(value: unknown): string | null {
    if (typeof value !== "string" || value.length > 8192) return null;
    // Avoid relying on optional URL.username/hostname implementations in RN.
    return /^https?:\/\/(?:[A-Za-z0-9_-]+\.)*[A-Za-z0-9_-]+(?::\d{1,5})?(?:[/?#][^\s\x00-\x1f\x7f]*)?$/.test(value) ? value : null;
}
export function attachmentURLs(message: any, voiceOnly = false): string[] {
    const items = Array.isArray(message?.attachments) ? message.attachments : [];
    if (voiceOnly && !(Number(message?.flags) & 8192)) return [];
    return [...new Set<string>(items.slice(0, 30).map((item: any) => httpURL(item?.url)).filter(Boolean))];
}
export function stickerURLs(message: any): string[] {
    const items = message?.stickerItems ?? message?.sticker_items;
    if (!Array.isArray(items)) return [];
    const extensions: Record<number,string> = {1:"png",2:"png",3:"json",4:"gif"};
    return items.slice(0, 20).flatMap(item => {
        const ext = extensions[item?.format_type ?? item?.formatType];
        if (!isSnowflake(item?.id) || !ext) return [];
        const host = ext === "gif" ? "media.discordapp.net" : "cdn.discordapp.com";
        return [`https://${host}/stickers/${item.id}.${ext}?size=512`];
    });
}
export function emojiMarkdown(message: any): string[] {
    if (typeof message?.content !== "string") return [];
    return [...new Set((message.content.slice(0, 50_000).match(/<a?:[A-Za-z0-9_]{2,32}:\d{17,20}>/g) ?? []) as string[])].slice(0, 50);
}
export function userURL(message: any): string | null {
    return isSnowflake(message?.author?.id) ? `https://discord.com/users/${message.author.id}` : null;
}
export function avatarURL(message: any): string | null {
    const author = message?.author;
    if (!isSnowflake(author?.id) || typeof author.avatar !== "string" || !/^(a_)?[a-f0-9]{32}$/.test(author.avatar)) return null;
    return `https://cdn.discordapp.com/avatars/${author.id}/${author.avatar}.${author.avatar.startsWith("a_")?"gif":"png"}?size=1024`;
}
export function attachmentNames(message: any): string[] {
    return (Array.isArray(message?.attachments) ? message.attachments : []).slice(0,30)
        .map((a:any) => a?.filename).filter((n:any) => typeof n === "string" && n.length <= 512);
}
export function imageURLs(message: any): string[] {
    return (Array.isArray(message?.attachments) ? message.attachments : []).slice(0,30)
        .filter((a:any) => /^image\//i.test(a?.content_type ?? a?.contentType ?? "") || /\.(png|jpe?g|gif|webp|avif)$/i.test(a?.filename ?? ""))
        .map((a:any) => httpURL(a?.url)).filter(Boolean);
}
export function exactTimestamp(message: any): string | null {
    const value = message?.timestamp;
    const millis = typeof value?.valueOf === "function" ? value.valueOf() : value;
    let date = new Date(millis == null ? NaN : millis);
    if (!Number.isFinite(date.getTime()) && isSnowflake(message?.id)) date = new Date(Number((BigInt(message.id) >> 22n) + 1420070400000n));
    return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}
export function unindentCode(content: string): string {
    if (content.length > 50_000) return content;
    return content.replace(/```([^\n`]*)\n([\s\S]*?)\n```/g, (block, language, body) => {
        const lines = body.replace(/\t/g,"    ").split("\n");
        const indents = lines.filter((line:string)=>line.trim()).map((line:string)=>/^ */.exec(line)![0].length);
        const amount = indents.length ? Math.min(...indents) : 0;
        return amount ? `\`\`\`${language}\n${lines.map((line:string)=>line.slice(Math.min(amount,/^ */.exec(line)![0].length))).join("\n")}\n\`\`\`` : block;
    });
}
export function silentContent(content: string): string {
    return !content.trim() || /^\s*@silent(?:\s|$)/.test(content) ? content : `@silent ${content}`;
}
export function textRules(content: string, rules: any[]): string {
    if (content.length > 50_000 || !Array.isArray(rules)) return content;
    let next = content;
    for (const rule of rules.slice(0,100)) {
        const find = rule?.find ?? rule?.match;
        if (typeof find !== "string" || !find || find.length > 512 || typeof rule?.replace !== "string") continue;
        if (rule.onlyIfIncludes && !next.includes(rule.onlyIfIncludes)) continue;
        // Existing regex rules are retained; syntax errors cannot block sending.
        try {
            next = rule.regex ? next.replace(new RegExp(find, rule.flags ?? "g"), rule.replace.replace(/\\n/g,"\n"))
                : next.split(find).join(rule.replace.replace(/\\n/g,"\n"));
            if (next.length > 50_000) return content;
        } catch { /* invalid rule is skipped */ }
    }
    return next;
}
