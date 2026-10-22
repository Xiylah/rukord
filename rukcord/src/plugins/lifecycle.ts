// SPDX-License-Identifier: MPL-2.0
export async function guardedLifecycle(plugin: any, method: "start"|"eagerStart", callbacks: {
    success(): void; failure(error: unknown): void;
}): Promise<void> {
    try {
        const run=plugin[method];
        if(run)await run();
        callbacks.success();
    }catch(error){
        // Optional plugins can partially install before throwing. Always attempt
        // teardown before marking them unavailable; preserve the original error.
        try{await plugin.stop?.();}catch(cleanup){console.error("[Rukcord] Plugin cleanup failed",cleanup);}
        callbacks.failure(error);
        throw error;
    }
}
