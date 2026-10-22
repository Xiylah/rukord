import { getDebugInfo } from "@api/debug";
import { BundleUpdaterManager } from "@api/native/modules";
import { useSettings } from "@api/settings";
import { RukcordIcon } from "@assets";
import { NavigationNative } from "@metro/common";
import { usePluginSettings } from "@plugins";
import { pluginLoadStats } from "@plugins/lazy";
import { useMemo, useState } from "react";
import { Alert, Image, Pressable, ScrollView, Switch, Text, View } from "react-native";
import { Action, Label, Panel, usePalette } from "./design";
import Features from "./Features";
export default function RukcordHome() {
    const p = usePalette(), navigation = NavigationNative.useNavigation();
    const [tab, setTab] = useState("Home");
    const info = useMemo(() => getDebugInfo(), []);
    const { safeMode, developerSettings, updateSettings } = useSettings();
    const settings = usePluginSettings(s => s.settings);
    const active = Object.entries(settings).filter(([id, s]) => !id.startsWith("core.") && s.enabled).length;
    const open = async (title: string, load: () => Promise<any>) => {
        try {
            const { default: Component } = await load();
            navigation.push("RUKCORD_CUSTOM_PAGE", { title, render: () => <Component /> });
        }
        catch (error) {
            Alert.alert("Could not open", String(error));
        }
    };
    return <View style={{ flex: 1, backgroundColor: p.bg }}>
        <View style={{ padding: 18, paddingBottom: 8, flexDirection: "row", alignItems: "center", gap: 14 }}>
            <Image source={{ uri: RukcordIcon }} style={{ width: 72, height: 72 }} accessibilityLabel="Rukcord raccoon"/>
            <View style={{ flex: 1 }}><Label size={30} bold>Rukcord</Label><Label muted size={12}>{info.rukcord.version}</Label></View>
            <View style={{ backgroundColor: p.tint, padding: 10, borderRadius: 14 }}><Text style={{ color: p.accent, fontWeight: "700" }}>ALPHA</Text></View>
        </View>
        <View style={{ flexDirection: "row", paddingHorizontal: 14, paddingBottom: 10, gap: 6 }}>{["Home", "Features", "Appearance", "Tools"].map(value => <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: tab === value }} onPress={() => setTab(value)} style={{ flex: 1, paddingVertical: 12, borderRadius: 15, alignItems: "center", backgroundColor: tab === value ? p.accent : p.panel }}>
            <Text style={{ fontSize: 13, fontWeight: "700", color: tab === value ? p.bg : p.text }}>{value}</Text></Pressable>)}</View>
        {tab === "Features" ? <Features /> : <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 36, gap: 16 }}>
            {tab === "Home" && <>
                <Panel><Label size={25} bold>Features</Label><Label muted>{active} enabled</Label>
                    <Action title="Manage features" onPress={() => setTab("Features")}/></Panel>
                <View style={{ flexDirection: "row", gap: 12 }}><View style={{ flex: 1 }}><Action title="Appearance" detail="Themes and fonts" onPress={() => setTab("Appearance")}/></View>
                    <View style={{ flex: 1 }}><Action title="Tools" detail="Timestamps and diagnostics" onPress={() => setTab("Tools")}/></View></View>
                <Panel><View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><Label bold>Safe mode</Label>
                    <Switch accessibilityLabel="Safe mode" value={!!safeMode} trackColor={{ true: p.accent, false: p.line }} onValueChange={v => updateSettings({ safeMode: v })}/></View>
                    <Label muted>Pause optional features after reloading.</Label>
                    <Action title="Reload Discord" onPress={() => BundleUpdaterManager.reload()}/></Panel>
            </>}
            {tab === "Appearance" && <>
                <Action title="Custom theme" onPress={() => void open("Custom theme", () => import("./ThemeEditor"))}/>
                <Action title="Font styles" onPress={() => void open("Font styles", () => import("./FontPicker"))}/>
                <Action title="Saved themes" onPress={() => void open("Themes", () => import("../Themes"))}/>
                <Action title="Imported fonts" onPress={() => void open("Fonts", () => import("../Fonts"))}/>
                </>}
            {tab === "Tools" && <>
                <Action title="Timestamp builder" detail="Copy a localized timestamp" onPress={() => void open("Timestamp builder", () => import("@plugins/sendtimestamps/settings"))}/>
                <Action title="Runtime details" detail={`Discord ${info.discord.version} (${info.discord.build})`} onPress={() => void open("Runtime details", () => import("./About"))}/>
                <Panel><View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><Label bold>Developer tools</Label>
                    <Switch accessibilityLabel="Developer tools" value={developerSettings} onValueChange={v => updateSettings({ developerSettings: v })}/></View>
                    {!!developerSettings && <><Label muted>{pluginLoadStats.loaded} of {pluginLoadStats.registered} plugin modules loaded.</Label>
                        <Action title="Open developer tools" onPress={() => void open("Developer", () => import("../Developer"))}/></>}
                </Panel></>}
        </ScrollView>}
    </View>;
}
