import { useSettings } from "@api/settings";
import { createFileStorage, waitForHydration } from "@api/storage";
import { showToast } from "@api/ui/toasts";
import { logger } from "@lib/utils/logger";
import { JSX } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { getLifecycleStatus, guardedLifecycle, stopLifecycle } from "./lifecycle";
import * as t from "./types";

export const pluginInstances = new Map<string, t.rukcordPlugin>();
let _setupPromise: Promise<void> | null = null;

// these are the things we use to set how quickly plugins start
const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 32;

interface PluginSettingsStore {
    failures: Record<string, {message:string; time:string}>;
    recordFailure: (id:string, error:unknown)=>void;
    clearFailure: (id:string)=>void;
    settings: t.PluginSettingsStorage;
    _hasHydrated: boolean;
    updatePluginSetting: (id: string, enabled: boolean) => void;
    getPluginSetting: (id: string) => { enabled: boolean } | undefined;
    setHasHydrated: (state: boolean) => void;
}

export const usePluginSettings = create<PluginSettingsStore>()(
    persist(
        (set, get) => ({
            failures: {},
            recordFailure: (id,error)=>set(state=>({ failures:{ ...state.failures,[id]:{ message:String(error).slice(0,300),time:new Date().toISOString() } } })),
            clearFailure: id=>set(state=>{ const failures={ ...state.failures };delete failures[id];return { failures }; }),
            settings: {},
            _hasHydrated: false,
            updatePluginSetting: (id: string, enabled: boolean) => {
                if (get().settings[id]?.enabled === enabled) return;
                set(state => ({
                    settings: {
                        ...state.settings,
                        [id]: { enabled },
                    },
                }));
            },
            getPluginSetting: (id: string) => get().settings[id],
            setHasHydrated: (state: boolean) => set({ _hasHydrated: state }),
        }),
        {
            name: "plugin-settings",
            storage: createJSONStorage(() => createFileStorage("plugins/settings.json")),
            onRehydrateStorage: () => state => {
                state?.setHasHydrated(true);
            },
        }
    )
);

export const pluginSettings = new Proxy({} as t.PluginSettingsStorage, {
    get: (_, prop: string) => usePluginSettings.getState().settings[prop],
    set: (_, prop: string, value: { enabled: boolean }) => {
        usePluginSettings.getState().updatePluginSetting(prop, value.enabled);
        return true;
    },
});

function assert<T>(condition: T, id: string, attempt: string): asserts condition {
    if (!condition) throw new Error(`[${id}] Attempted to ${attempt}`);
}

async function runPluginLifecycle(id: string, method: "start" | "eagerStart"): Promise<void> {
    const instance = pluginInstances.get(id);
    assert(instance, id, `run ${method} on unknown plugin`);

    const settings = useSettings.getState();
    if (settings.safeMode && !isPluginCore(id)) {
        logger.log(`[${id}] Skipped in safe mode`);
        return;
    }

    await guardedLifecycle(instance, method, { success() {
        const run = instance[method];
        if (method === "start" || run) usePluginSettings.getState().updatePluginSetting(id, true);
        usePluginSettings.getState().clearFailure(id);
    }, failure(error) {
        usePluginSettings.getState().recordFailure(id,error);
        if(!isPluginCore(id))usePluginSettings.getState().updatePluginSetting(id,false);
        const errorMsg = `[${id}] Failed: ${error}`;
        method === "start" ? showToast(errorMsg) : console.error(errorMsg, error);
    } });
}

export const startPlugin = (id: string): Promise<void> => runPluginLifecycle(id, "start");
export const startEagerPlugin = (id: string): Promise<void> => runPluginLifecycle(id, "eagerStart");

export async function stopPlugin(id: string): Promise<void> {
    const instance = pluginInstances.get(id);
    assert(instance, id, "stop a non-started plugin");

    try {
        await stopLifecycle(instance);
        usePluginSettings.getState().clearFailure(id);
    } catch (error) {
        usePluginSettings.getState().recordFailure(id, error);
        console.error(`[${id}] Failed to stop:`, error);
        throw error;
    } finally {
        // Persist the disabled choice even if teardown needs a reload.
        usePluginSettings.getState().updatePluginSetting(id, false);
    }
}

export const findPluginById = (id: string): boolean => pluginInstances.has(id);

export const isPluginCore = (id: string): boolean => id.startsWith("core.");

export function isPluginEnabled(id: string): boolean {
    const setting = usePluginSettings.getState().settings[id];
    return setting?.enabled ?? isPluginCore(id);
}

function ensureSetup(): Promise<void> {
    if (_setupPromise) return _setupPromise;

    _setupPromise = (async () => {
        const [{ default: rukcordPlugins }] = await Promise.all([
            import("#rukcord-plugins"),
            waitForHydration(usePluginSettings),
        ]);

        for (const [id, plugin] of Object.entries(rukcordPlugins)) {
            const instance = plugin as t.rukcordPlugin;
            if (!instance) continue;

            instance.id = id;

            pluginInstances.set(id, instance);
        }
    })();

    return _setupPromise;
}

// tldr: plugins were causing discord to start slow as they made the load take longer even though they technically were lazy, so we now do this to let the app render :P
async function startBatched(ids: string[], method: "start" | "eagerStart"): Promise<void> {
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
        const batch = ids.slice(i, i + BATCH_SIZE);

        await Promise.allSettled(
            batch.map(async id => {
                try {
                    await (method === "start" ? startPlugin(id) : startEagerPlugin(id));
                } catch (error) {
                    logger.log(`Failed to ${method} ${id}:`, error);
                }
            })
        );

        if (i + BATCH_SIZE < ids.length) {
            await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
        }
    }
}

export async function initPlugins(): Promise<void> {
    await ensureSetup();

    const ids = Array.from(pluginInstances.keys()).filter(isPluginEnabled);
    await startBatched(ids, "start");
}

export async function initEagerPlugins(): Promise<void> {
    await ensureSetup();

    const ids = Array.from(pluginInstances.keys()).filter(isPluginEnabled);
    await Promise.allSettled(
        ids.map(async id => {
            try { await startEagerPlugin(id); }
            catch (error) { logger.log(`Failed to eagerStart ${id}:`, error); }
        })
    );
}

export function definePlugin(instance: t.rukcordPlugin): t.rukcordPlugin {
    // @ts-expect-error
    instance[Symbol.for("rukcord.plugin")] = true;
    return instance;
}

export function getPluginSettingsComponent(id: string): (() => JSX.Element) | null {
    return pluginInstances.get(id)?.settings || null;
}

export function getPluginRuntimeReport() {
    const { settings, failures } = usePluginSettings.getState();
    return {
        schema: 1,
        safeMode: !!useSettings.getState().safeMode,
        plugins: Array.from(pluginInstances, ([id, plugin]) => ({
            id,
            enabled: settings[id]?.enabled ?? isPluginCore(id),
            ...getLifecycleStatus(plugin),
            failure: failures[id],
        })),
    };
}
