import { ThemeManifest } from "@plugins/_core/painter/themes/types";

// @ts-ignore
const pyonLoaderIdentity = globalThis.__PYON_LOADER__;

// @ts-ignore
const rukcordLoaderIdentity = globalThis.__RUKCORD_LOADER__;

export interface ThemeInfo {
    id: string;
    selected: boolean;
    data: ThemeManifest;
}

export function isPyonLoader() {
    return pyonLoaderIdentity != null;
}

export function isRukcordLoader() {
    return rukcordLoaderIdentity != null;
}

export function getLoaderIdentity() {
    if (isPyonLoader()) {
        return pyonLoaderIdentity;
    }
    if (isRukcordLoader()) {
        return rukcordLoaderIdentity;
    }

    return null;
}

export function getLoaderName() {
    if (isPyonLoader()) return pyonLoaderIdentity.loaderName;
    if (isRukcordLoader()) return rukcordLoaderIdentity.loaderName;

    return "Unknown";
}

export function getLoaderVersion(): string | null {
    if (isPyonLoader()) return pyonLoaderIdentity.loaderVersion;
    if (isRukcordLoader()) return rukcordLoaderIdentity.loaderVersion;
    return null;
}

export function isLoaderConfigSupported() {
    if (isRukcordLoader()) {
        return true;
    }
    if (isPyonLoader()) {
        return true;
    }

    return false;
}

export function getThemeFilePath() {
    if (isRukcordLoader() || isPyonLoader()) {
        return "current-theme.json";
    }
    return null;
}

export function isReactDevToolsPreloaded() {
    return Boolean(window.__REACT_DEVTOOLS__);
}

export function getReactDevToolsProp(): string | null {
    if (!isReactDevToolsPreloaded()) return null;


    return null;
}

export function getReactDevToolsVersion() {
    if (!isReactDevToolsPreloaded()) return null;

    if (isRukcordLoader()) {
        return window.__REACT_DEVTOOLS__.version || null;
    }
    if (isPyonLoader()) {
        return window.__REACT_DEVTOOLS__.version || null;
    }

    return null;
}

export function getSysColors() {
    if (isRukcordLoader()) {
        return rukcordLoaderIdentity.sysColors;
    }
    if (isPyonLoader()) {
        return pyonLoaderIdentity.sysColors;
    }
}

export function getStoredTheme(): ThemeInfo | null {
    if (isRukcordLoader()) {
        return rukcordLoaderIdentity.storedTheme;
    }
    if (isPyonLoader()) {
        return pyonLoaderIdentity.storedTheme;
    }

    return null;
}

export function isChatBubblesSupported() {
    if (isRukcordLoader()) {
        return rukcordLoaderIdentity.isChatBubblesSupported;
    }
    else {
        return false;
    }
}

export function isSysColorsSupported() {
    if (isRukcordLoader()) {
        return rukcordLoaderIdentity.isSysColorsSupported;
    }
    if (isPyonLoader()) {
        return pyonLoaderIdentity.isSysColorsSupported;
    }
}

export function getLoaderConfigPath() {
    return "loader-rukcord.json";
}
