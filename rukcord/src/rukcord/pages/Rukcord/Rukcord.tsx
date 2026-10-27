import { getDebugInfo } from "@api/debug";
import { BundleUpdaterManager } from "@api/native/modules";
import { useSettings } from "@api/settings";
import { RukcordIcon } from "@assets";
import { NavigationNative } from "@metro/common";
import { useMemo } from "react";
import { Alert, Image, ScrollView, Switch, View } from "react-native";
import { Action, Label, Panel, usePalette } from "./design";

export default function RukcordHome() {
    const p = usePalette(), navigation = NavigationNative.useNavigation();
    const info = useMemo(() => getDebugInfo(), []);
    const { safeMode, updateSettings } = useSettings();
    const open = async (title: string, load: () => Promise<any>) => {
        try {
            const { default: Component } = await load();
            navigation.push("RUKCORD_CUSTOM_PAGE", { title, render: () => <Component /> });
        } catch (error) { Alert.alert("Could not open", String(error)); }
    };
    return <ScrollView style={{ flex: 1, backgroundColor: p.bg }} contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 36 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <Image source={{ uri: RukcordIcon }} style={{ width: 56, height: 56 }} accessibilityLabel="Rukcord raccoon" />
            <View><Label size={25} bold>Rukcord</Label><Label muted>{info.rukcord.version}</Label></View>
        </View>
        <Panel><View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Label bold>Safe mode</Label><Switch accessibilityLabel="Safe mode" value={!!safeMode} onValueChange={v => updateSettings({ safeMode: v })} />
        </View><Label muted>Pause optional features after reloading.</Label>
            <Action title="Reload Discord" onPress={() => BundleUpdaterManager.reload()} />
        </Panel>
        <Action title="Timestamp builder" onPress={() => void open("Timestamp builder", () => import("@plugins/sendtimestamps/settings"))} />
        <Action title="About" detail={`Discord ${info.discord.version} (${info.discord.build})`} onPress={() => void open("About", () => import("./About"))} />
    </ScrollView>;
}
