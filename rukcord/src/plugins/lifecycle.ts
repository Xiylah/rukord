// SPDX-License-Identifier: MPL-2.0

type Method = "start" | "eagerStart";
type Plugin = {
    start?(): unknown;
    eagerStart?(): unknown;
    stop?(): unknown;
};
type Callbacks = { success(): void; failure(error: unknown): void };
type Phase = "idle" | Method | "active" | "stopping" | "failed" | "reload-required";
interface State {
    phase: Phase;
    completed: Set<Method>;
    queue: Promise<void>;
    error?: string;
    cleanupError?: string;
}

// A deadline releases our wait. It cannot interrupt synchronous JavaScript or
// cancel a plugin's asynchronous work, so failed teardown requires a reload.
function waitForCleanup(plugin: Plugin, milliseconds: number): Promise<void> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("Plugin cleanup timed out. Reload Discord before enabling it again.")), milliseconds);
        Promise.resolve().then(() => plugin.stop?.call(plugin)).then(() => {
            clearTimeout(timer);
            resolve();
        }, error => {
            clearTimeout(timer);
            reject(error);
        });
    });
}

export function createLifecycleGuard(cleanupTimeoutMs = 4000) {
    const states = new WeakMap<Plugin, State>();
    function stateFor(plugin: Plugin): State {
        let state = states.get(plugin);
        if (!state) {
            state = { phase: "idle", completed: new Set(), queue: Promise.resolve() };
            states.set(plugin, state);
        }
        return state;
    }
    function enqueue(plugin: Plugin, operation: (state: State) => Promise<void>) {
        const state = stateFor(plugin);
        const result = state.queue.then(() => operation(state));
        // One rejected operation must not poison the queue for later cleanup.
        state.queue = result.catch(() => {});
        return result;
    }
    async function cleanup(plugin: Plugin, state: State) {
        state.phase = "stopping";
        try {
            await waitForCleanup(plugin, cleanupTimeoutMs);
            state.completed.clear();
            state.phase = "idle";
        } catch (error) {
            state.completed.clear();
            state.cleanupError = String(error);
            state.phase = "reload-required";
            throw error;
        }
    }
    return {
        start(plugin: Plugin, method: Method, callbacks: Callbacks): Promise<void> {
            return enqueue(plugin, async state => {
                if (state.phase === "reload-required") {
                    const error = new Error("Plugin cleanup did not finish safely. Reload Discord before enabling it again.");
                    callbacks.failure(error);
                    throw error;
                }
                if (state.completed.has(method)) {
                    callbacks.success();
                    return;
                }
                state.phase = method;
                try {
                    await plugin[method]?.call(plugin);
                } catch (error) {
                    state.error = String(error);
                    try {
                        await cleanup(plugin, state);
                        state.phase = "failed";
                    } catch (cleanupError) {
                        console.error("[Rukcord] Plugin cleanup failed", cleanupError);
                    }
                    // Preserve the startup error even when teardown also fails.
                    callbacks.failure(error);
                    throw error;
                }
                state.completed.add(method);
                state.phase = "active";
                state.error = undefined;
                state.cleanupError = undefined;
                callbacks.success();
            });
        },
        stop(plugin: Plugin): Promise<void> {
            return enqueue(plugin, async state => {
                if (state.phase === "reload-required")
                    throw new Error("Plugin cleanup did not finish safely. Reload Discord.");
                if (state.completed.size === 0) return;
                await cleanup(plugin, state);
            });
        },
        status(plugin: Plugin) {
            const state = states.get(plugin);
            return {
                phase: state?.phase ?? "idle",
                completed: [...(state?.completed ?? [])],
                error: state?.error,
                cleanupError: state?.cleanupError,
            };
        },
    };
}

const guard = createLifecycleGuard();
export const guardedLifecycle = guard.start;
export const stopLifecycle = guard.stop;
export const getLifecycleStatus = guard.status;
