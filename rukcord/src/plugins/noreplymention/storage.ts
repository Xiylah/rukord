import { createPluginStore } from "@api/storage";
export const { useStore: useReplySettings } = createPluginStore("noreplymention", {
    userList: "", roleList: "", shouldPingListed: true,
});
