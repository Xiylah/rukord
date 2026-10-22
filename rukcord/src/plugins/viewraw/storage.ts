import { createPluginStore } from "@api/storage";
export const { useStore: useRawSettings } = createPluginStore("viewraw", {
    sortKeys: true,
    stripSensitiveData: true,
});
