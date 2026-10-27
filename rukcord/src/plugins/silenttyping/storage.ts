import { createPluginStore } from "@api/storage";
export const { useStore: useTypingSettings } = createPluginStore("silenttyping", { isEnabled: true });
