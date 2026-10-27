import { createPluginStore } from "@api/storage";

interface RukcordEnhancementsSettings {
	transformEmoji: boolean;
	transformSticker: boolean;
}

export const {
    useStore: useRukcordEnhancementsSettings,
    settings: rukcordenhancementsSettings,
} = createPluginStore<RukcordEnhancementsSettings>("_core.rukcordenhancements", {
    transformEmoji: true,
    transformSticker: true,
});
