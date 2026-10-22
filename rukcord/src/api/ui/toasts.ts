import { findAssetId } from "@api/assets";
import { callBridgeMethod } from "@api/native/bridge";
import { Strings } from "@rukcord/i18n";

export const showToast = (content: string, _asset?: number) => {
    // Do not send legacy payload objects into Discord 350's Mana toast renderer.
    const loader = (globalThis as any).__RUKCORD_LOADER__;
    if (!loader?.hasNativeToast) { console.info("[Rukcord]", content); return; }
    void callBridgeMethod("ui.toast", String(content)).catch(error => console.error("[Rukcord] Notification unavailable:", error));
};
showToast.showCopyToClipboard = (message = Strings.COPIED_TO_CLIPBOARD) => {
    showToast(message, findAssetId("toast_copy_link"));
};
