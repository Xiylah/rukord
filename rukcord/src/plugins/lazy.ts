// SPDX-License-Identifier: MPL-2.0
// Registration and feature browsing do not evaluate a plugin's Metro imports.
export interface PluginDescriptor {
    name: string; description: string; version: string;
    hasSettings: boolean; hasStart: boolean; hasEagerStart: boolean;
    devOnly: boolean; requiresRestart: boolean; platforms?: string[];
}
export const pluginLoadStats = { registered: 0, loaded: 0 };

export function createLazyPlugin(id: string, descriptor: PluginDescriptor, factory: () => any): any {
    ++pluginLoadStats.registered;
    let instance: any;
    const load = () => {
        if (!instance) {
            const candidate = factory();
            if (!candidate || typeof candidate !== "object") throw new Error(`[${id}] Invalid plugin module`);
            candidate.id = id;
            instance = candidate;
            ++pluginLoadStats.loaded;
        }
        return instance;
    };
    const summary = { id, ...descriptor };
    return new Proxy(summary, {
        get(target, key) {
            if (Object.prototype.hasOwnProperty.call(target, key)) return (target as any)[key];
            if (key === "start" && !descriptor.hasStart || key === "eagerStart" && !descriptor.hasEagerStart) return undefined;
            if (key === "stop" && !instance) return undefined;
            const plugin = load();
            const value = plugin[key];
            return typeof value === "function" ? value.bind(plugin) : value;
        },
    });
}
