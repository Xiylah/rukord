import { callBridgeMethod } from "@api/native/bridge";
import { Alert } from "react-native";
export function requestFontRestart() {
    Alert.alert("Restart Discord", "Close Discord, then open it again to apply the font. Reload alone can keep the previous font cached.", [
        { text: "Later", style: "cancel" },
        { text: "Close Discord", onPress: async () => {
                try {
                    await callBridgeMethod("updater.reload");
                }
                catch {
                    Alert.alert("Close Discord manually", "Swipe Discord closed from the app switcher, then reopen it.");
                }
            } },
    ]);
}
