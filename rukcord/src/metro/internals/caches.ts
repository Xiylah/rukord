import { fileExists, readFile, writeFile } from "@api/native/fs";
import { NativeClientInfoModule } from "@api/native/modules";
import { debounce } from "es-toolkit";
import { warmInChunks } from "./scheduling";

import { ModuleFlags, ModulesMapInternal } from "./enums";

const CACHE_VERSION = 2;
let cancelWarmup: (() => void) | undefined;
const RUKCORD_METRO_CACHE_PATH = "caches/metro_modules.json";

type ModulesMap = {
    [flag in number | `_${ModulesMapInternal}`]?: ModuleFlags;
};

let _metroCache = null as unknown as ReturnType<typeof buildInitCache>;

export const getMetroCache = () => _metroCache;

function buildInitCache() {
    const cache = {
        _v: CACHE_VERSION,
        _buildNumber: NativeClientInfoModule.getConstants().Build,
        _modulesCount: Object.keys(window.modules).length,
        flagsIndex: {} as Record<string, number>,
        findIndex: {} as Record<string, ModulesMap | undefined>,
        polyfillIndex: {} as Record<string, ModulesMap | undefined>
    } as const;

    _metroCache = cache;
    cancelWarmup?.();
    cancelWarmup = warmInChunks(Object.keys(window.modules), id => {
        require("./modules").requireModule(Number(id));
    }, { schedule: callback => setTimeout(callback, 0), now: () => Date.now(),
         report: error => console.error("[Rukcord] Cache warmup skipped a module:", error) });
    return cache;
}

/** @internal */
export async function initMetroCache() {
    try {
        if (!await fileExists(RUKCORD_METRO_CACHE_PATH)) return void buildInitCache();
        const rawCache = await readFile(RUKCORD_METRO_CACHE_PATH);
        _metroCache = JSON.parse(rawCache);
        if (_metroCache._v !== CACHE_VERSION) {
            _metroCache = null!;
            throw "cache invalidated; cache version outdated";
        }
        if (_metroCache._buildNumber !== NativeClientInfoModule.getConstants().Build) {
            _metroCache = null!;
            throw "cache invalidated; version mismatch";
        }
        if (_metroCache._modulesCount !== Object.keys(window.modules).length) {
            _metroCache = null!;
            throw "cache invalidated; modules count mismatch";
        }
    } catch {
        buildInitCache();
    }
}

const saveCache = debounce(() => {
    void writeFile(RUKCORD_METRO_CACHE_PATH, JSON.stringify(_metroCache)).catch(error => console.error("[Rukcord] Could not save Metro cache:", error));
}, 1000);

function extractExportsFlags(moduleExports: any) {
    if (!moduleExports) return undefined;
    const bit = ModuleFlags.EXISTS;
    return bit;
}

/** @internal */
export function indexExportsFlags(moduleId: number, moduleExports: any) {
    const flags = extractExportsFlags(moduleExports);
    if (flags && flags !== ModuleFlags.EXISTS) {
        _metroCache.flagsIndex[moduleId] = flags;
    }
}

/** @internal */
export function indexBlacklistFlag(id: number) {
    _metroCache.flagsIndex[id] |= ModuleFlags.BLACKLISTED;
}

/** @internal */
export function indexAssetModuleFlag(id: number) {
    _metroCache.flagsIndex[id] |= ModuleFlags.ASSET;
}

/** @internal */
export function getCacherForUniq(uniq: string, allFind: boolean) {
    const indexObject = _metroCache.findIndex[uniq] ??= {};

    return {
        cacheId(moduleId: number, exports: any) {
            indexObject[moduleId] ??= extractExportsFlags(exports);
            saveCache();
        },
        finish(notFound: boolean) {
            if (allFind) indexObject[`_${ModulesMapInternal.FULL_LOOKUP}`] = 1;
            if (notFound) indexObject[`_${ModulesMapInternal.NOT_FOUND}`] = 1;
            saveCache();
        }
    };
}

/** @internal */
export function getPolyfillModuleCacher(name: string) {
    const indexObject = _metroCache.polyfillIndex[name] ??= {};

    return {
        getModules() {
            return require("@metro/internals/modules").getCachedPolyfillModules(name);
        },
        cacheId(moduleId: number) {
            indexObject[moduleId] = 1;
            saveCache();
        },
        finish() {
            indexObject[`_${ModulesMapInternal.FULL_LOOKUP}`] = 1;
            saveCache();
        }
    };
}

export function invalidateCache() {
    _metroCache = buildInitCache();
    saveCache.flush?.();
}
