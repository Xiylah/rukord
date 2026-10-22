import { getPluginSettingsComponent, isPluginCore, pluginInstances, startPlugin, stopPlugin, usePluginSettings } from "@plugins";
import { useSettings } from "@api/settings";
import { NavigationNative, clipboard } from "@metro/common";
import { useMemo, useState } from "react";
import { Alert, FlatList, Pressable, Switch, Text, TextInput, View } from "react-native";
import { Action, Label, Panel, usePalette } from "./design";
const featured = new Set(["messagelogger", "viewraw", "silenttyping", "noreplymention", "cleanurls", "sendtimestamps", "textreplace", "silentmessagetoggle", "unindent", "copystickerlinks", "copyuserurls", "copyemojimarkdown", "unsuppressembeds", "anonymizefilenames"]);
export default function Features() {
    const p = usePalette(), navigation = NavigationNative.useNavigation();
    const settings = usePluginSettings(s => s.settings), safe = useSettings(s => s.safeMode);
    const failures = usePluginSettings(s => s.failures);
    const [query, setQuery] = useState(""), [filter, setFilter] = useState("Featured"), [pending, setPending] = useState<string | null>(null);
    const developer = useSettings(s => s.developerSettings);
    const items = useMemo(() => Array.from(pluginInstances.values()).filter(plugin => !isPluginCore(plugin.id) && (!plugin.devOnly || developer)
        && (filter !== "Featured" || featured.has(plugin.id))
        && (filter !== "Active" || settings[plugin.id]?.enabled)
        && `${plugin.name} ${plugin.description}`.toLowerCase().includes(query.toLowerCase())), [query, filter, settings, developer]);
    const toggle = async (id: string, enabled: boolean) => {
        if (pending || safe)
            return;
        setPending(id);
        try {
            const plugin = pluginInstances.get(id)!;
            if (plugin.requiresRestart) {
                usePluginSettings.getState().updatePluginSetting(id, enabled);
                Alert.alert("Reload needed", "Reload Discord from Rukcord Home to apply this feature.");
            }
            else
                await (enabled ? startPlugin(id) : stopPlugin(id));
        }
        catch (error) {
            Alert.alert("Feature unavailable", String(error));
        }
        finally {
            setPending(null);
        }
    };
    const configure = (id: string) => {
        try {
            const Component = getPluginSettingsComponent(id);
            if (Component)
                navigation.push("RUKCORD_CUSTOM_PAGE", { title: pluginInstances.get(id)!.name, render: () => <Component /> });
        }
        catch (error) {
            Alert.alert("Settings unavailable", String(error));
        }
    };
    return <FlatList data={items} keyExtractor={plugin => plugin.id} initialNumToRender={7} maxToRenderPerBatch={7} windowSize={5} contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 36 }} keyboardShouldPersistTaps="handled" ListHeaderComponent={<View style={{ gap: 14, paddingBottom: 6 }}>
            <TextInput accessibilityLabel="Search features" placeholder="Search features" placeholderTextColor={p.muted} value={query} onChangeText={setQuery} style={{ color: p.text, backgroundColor: p.panel, padding: 15, borderRadius: 16, fontSize: 16 }}/>
            <View style={{ flexDirection: "row", gap: 8 }}>{["Featured", "Active", "All"].map(value => <Pressable key={value} onPress={() => setFilter(value)} accessibilityRole="button" accessibilityState={{ selected: filter === value }} style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 18, backgroundColor: filter === value ? p.accent : p.panel }}>
                <Text style={{ fontWeight: "600", color: filter === value ? p.bg : p.text }}>{value}</Text></Pressable>)}</View>
            {!!safe && <Panel><Label>Safe mode is on. Turn it off and reload before enabling features.</Label></Panel>}
            {!!Object.keys(failures ?? {}).length && <Action title="Copy plugin failure report" detail="Plugin IDs, error messages and times. No chat history." onPress={() => { clipboard.setString(JSON.stringify({ rukcord: "0.4.0-alpha.5", failures }, null, 2)); Alert.alert("Copied", "Share this report when reporting a broken feature."); }}/>}
        </View>} ListEmptyComponent={<Panel><Label muted>No features match this view.</Label></Panel>} renderItem={({ item }) => <Panel><View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ flex: 1 }}><Label bold size={18}>{item.name}</Label></View>
            <Switch accessibilityLabel={`Enable ${item.name}`} value={!!settings[item.id]?.enabled} disabled={!!pending || !!safe} trackColor={{ true: p.accent, false: p.line }} onValueChange={value => void toggle(item.id, value)}/></View>
            <Label muted>{item.description}</Label>
            {!!failures?.[item.id] && <Label muted>{`Unavailable: ${failures[item.id].message}. Disabled after failure; retry after updating.`}</Label>}
            {!!item.hasSettings && <Action title="Settings" detail={pending === item.id ? "Applyingâ€¦" : item.requiresRestart ? "Reload required after toggling" : undefined} onPress={() => configure(item.id)}/>}
        </Panel>}/>;
}
