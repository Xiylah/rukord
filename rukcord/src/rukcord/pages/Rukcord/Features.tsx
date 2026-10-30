import { findAssetId } from "@api/assets";
import { getPluginSettingsComponent, isPluginCore, pluginInstances, startPlugin, stopPlugin, usePluginSettings } from "@plugins";
import { useSettings } from "@api/settings";
import { NavigationNative, clipboard } from "@metro/common";
import { useMemo, useState } from "react";
import { semanticColors } from "@api/ui/components/color";
import { createStyles } from "@api/ui/styles";
import Search from "@api/ui/components/Search";
import { Button, Card, IconButton, TableSwitch, Text } from "@metro/common/components";
import { Alert, FlatList, View } from "react-native";
const useStyles = createStyles({ container: { flex: 1, backgroundColor: semanticColors.BACKGROUND_PRIMARY } });
const featured = new Set(["messagelogger", "viewraw", "silenttyping", "noreplymention", "cleanurls", "sendtimestamps", "textreplace", "silentmessagetoggle", "unindent", "copystickerlinks", "copyuserurls", "copyemojimarkdown", "unsuppressembeds", "anonymizefilenames"]);
export default function Features() {
    const styles = useStyles(), navigation = NavigationNative.useNavigation();
    const settings = usePluginSettings(s => s.settings), safe = useSettings(s => s.safeMode);
    const failures = usePluginSettings(s => s.failures);
    const [query, setQuery] = useState(""), [filter, setFilter] = useState("All"), [pending, setPending] = useState<string | null>(null);
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
    return <FlatList style={styles.container} data={items} keyExtractor={plugin => plugin.id} initialNumToRender={7} maxToRenderPerBatch={7} windowSize={5}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 36 }} keyboardShouldPersistTaps="handled"
        ListHeaderComponent={<View style={{ gap: 12, paddingBottom: 6 }}>
            <Search placeholder="Search plugins" onChangeText={setQuery} />
            <View style={{ flexDirection: "row", gap: 8 }}>{["All", "Active", "Featured"].map(value =>
                <Button key={value} text={value} size="sm" variant={filter === value ? "primary" : "secondary"} onPress={() => setFilter(value)} />)}</View>
            {!!safe && <Text color="text-muted" variant="text-sm/normal">Safe mode is on. Turn it off and reload before enabling plugins.</Text>}
            {!!Object.keys(failures ?? {}).length && <Button text="Copy plugin failure report" variant="secondary" onPress={() => {
                clipboard.setString(JSON.stringify({ rukcord: "0.6.1a", failures }, null, 2)); Alert.alert("Copied");
            }} />}
        </View>}
        ListEmptyComponent={<Text color="text-muted" variant="text-md/normal">No plugins match this view.</Text>}
        renderItem={({ item }) => <Card><View style={{ gap: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={{ flex: 1 }}><Text variant="heading-md/semibold">{item.name}</Text></View>
                {!!item.hasSettings && <IconButton accessibilityLabel={`Settings for ${item.name}`} size="sm" variant="secondary" icon={findAssetId("SettingsIcon")} onPress={() => configure(item.id)} />}
                <TableSwitch accessibilityLabel={`Enable ${item.name}`} value={!!settings[item.id]?.enabled} disabled={!!pending || !!safe} onValueChange={value => void toggle(item.id, value)} />
            </View>
            <Text color="text-muted" variant="text-sm/normal">{item.description}</Text>
            {!!failures?.[item.id] && <Text color="text-muted" variant="text-sm/normal">{failures[item.id].message}</Text>}
        </View></Card>} />;
}
