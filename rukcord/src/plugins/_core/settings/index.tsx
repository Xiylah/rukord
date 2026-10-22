import { findAssetId } from "@api/assets";
import { patchAssets } from "@api/assets/patches";
import { useSettings } from "@api/settings";
import { resolveSemanticColor, semanticColors } from "@api/ui/components/color";
import { RukcordIcon } from "@assets";
import { findByPropsLazy } from "@metro";
import { definePlugin } from "@plugins";
import { Developers } from "@rukcord/Developers";
import { Strings } from "@rukcord/i18n";
import { checkForUpdate } from "@rukcord/pages/Updater";
import { version } from "rukcord-build-info";
import React, { lazy } from "react";
import { Image, type ImageURISource } from "react-native";

import { patchTabsUI } from "./patches/tabs";
import settings from "./settings";

export default definePlugin({
    name: Strings.PLUGIN__CORE_SETTINGS,
    description: Strings.PLUGIN__CORE_SETTINGS_DESC,
    author: [Developers.cocobo1],
    id: "settings",
    version: "1.0.0",
    start() {
        patchAssets(findByPropsLazy("registerAsset"));
        patchSettings();
        initSettings();
    },
    settings: settings
});

function initSettings() {
    // todo: i18n ALL of settings
    registerSection({
        name: "Rukcord",
        items: [
            {
                key: "RUKCORD",
                title: () => Strings.RUKCORD,
                icon: { uri: RukcordIcon },
                render: () => import("@rukcord/pages/Rukcord"),
                useTrailing: () => {
                    if (checkForUpdate()) return <Image source={findAssetId("ic_warning_24px")} style={{ width: 26, height: 26, tintColor: resolveSemanticColor(semanticColors.STATUS_WARNING) }} />;
                    return `(${version})`;
                }
            },
        ]
    });
}

export interface RowConfig {
    key: string;
    title: () => string;
    onPress?: () => any;
    render?: Parameters<typeof lazy>[0];
    icon?: ImageURISource | number;
    IconComponent?: React.ReactNode,
    usePredicate?: () => boolean,
    useTrailing?: () => string | React.ReactNode,
    rawTabsConfig?: Record<string, any>;
}

export const registeredSections = {} as {
    [key: string]: RowConfig[];
};

export function registerSection(section: { name: string; items: RowConfig[]; }) {
    const existing = registeredSections[section.name] || [];
    registeredSections[section.name] = [...existing, ...section.items];
    return () => {
        registeredSections[section.name] = registeredSections[section.name]?.filter(
            item => !section.items.some(newItem => newItem.key === item.key)
        ) || [];
    };
}

/**
 * @internal
 */
export function patchSettings() {
    const unpatches = new Array<() => boolean>;
    patchTabsUI(unpatches);
    return () => unpatches.forEach(u => u());
}
