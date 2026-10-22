// SPDX-License-Identifier: MPL-2.0
// Mobile implementation of sorted, redacted raw-data viewing. Does not mutate input.
const PRIVATE = new Set(["email", "phone", "storeCountry", "personalConnectionId", "token", "accessToken", "refreshToken", "mfaEnabled", "hasBouncedEmail"]);
const LOCAL = new Set(["editHistory", "deleted", "was_deleted", "firstEditTimestamp"]);

export function serializeRaw(value: unknown, options = { sortKeys: true, stripSensitiveData: true }): string {
    const ancestors = new Set<object>();
    let entries = 0;
    function visit(value: any, depth: number): any {
        if (++entries > 5000) return "[Entry limit]";
        if (value === null || typeof value === "boolean" || typeof value === "number") return value;
        if (typeof value === "string") return value.length > 24_000 ? value.slice(0, 24_000) + "…[truncated]" : value;
        if (typeof value === "bigint") return String(value);
        if (typeof value !== "object") return undefined;
        if (depth > 12) return "[Depth limit]";
        if (ancestors.has(value)) return "[Circular]";
        ancestors.add(value);
        try {
            if (Array.isArray(value)) return value.slice(0, 1000).map(item => visit(item, depth + 1));
            const result: Record<string, any> = Object.create(null);
            const keys = Object.keys(value);
            if (options.sortKeys) keys.sort();
            for (const key of keys.slice(0, 1000)) {
                if (key.startsWith("_rk") || LOCAL.has(key) || options.stripSensitiveData && PRIVATE.has(key)) continue;
                try {
                    const item = visit(key === "content" && typeof value._rkCurrentContent === "string"
                        ? value._rkCurrentContent : value[key], depth + 1);
                    if (item !== undefined) result[key] = item;
                } catch { result[key] = "[Unreadable]"; }
            }
            return result;
        } finally { ancestors.delete(value); }
    }
    const text = JSON.stringify(visit(value, 0), null, 2) ?? "null";
    return text.length <= 160_000 ? text : JSON.stringify({ truncated: true, preview: text.slice(0, 60_000) }, null, 2);
}
