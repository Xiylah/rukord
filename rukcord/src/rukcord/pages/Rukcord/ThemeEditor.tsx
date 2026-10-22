import { changeThemeBase, CUSTOM_THEME_ID, normalizeColor, THEME_PRESETS, themeDraft, themeManifest, ThemeDraft } from "@api/appearance";
import { useSettings } from "@api/settings";
import { FluxDispatcher } from "@metro/common";
import { useThemes } from "@plugins/_core/painter/themes";
import { useColorsPref } from "@plugins/_core/painter/themes/preferences";
import { useRef, useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Action, Label, Panel, usePalette } from "./design";
const SWATCHES = ["#000000", "#17171C", "#292036", "#FFFFFF", "#F4F4F8", "#9E8CFF", "#8BB8FF", "#88D6AE", "#F3A7C0"];
export default function ThemeEditor() {
    const p = usePalette(), safe = useSettings(s => s.safeMode);
    const [draft, setDraft] = useState(() => themeDraft(useThemes.getState().themes[CUSTOM_THEME_ID]?.data));
    const [busy, setBusy] = useState(false), [error, setError] = useState("");
    const saving = useRef(false);
    const preview = Object.fromEntries(Object.entries(draft).map(([key, value]) => [key, normalizeColor(value) ?? THEME_PRESETS.Dark[key as keyof ThemeDraft]])) as ThemeDraft;
    const apply = async (reset = false) => {
        if (saving.current || safe)
            return;
        let data: ReturnType<typeof themeManifest> | undefined;
        try {
            if (!reset)
                data = themeManifest(draft);
        }
        catch (e) {
            setError(String(e));
            return;
        }
        saving.current = true;
        setBusy(true);
        setError("");
        const store = useThemes.getState(), previous = store.themes, pref = useColorsPref.getState().type;
        try {
            useColorsPref.getState().setType(reset ? undefined : draft.mode);
            if (data)
                store.setTheme(CUSTOM_THEME_ID, { id: CUSTOM_THEME_ID, selected: false, data });
            await store.selectTheme(reset ? null : CUSTOM_THEME_ID);
            FluxDispatcher.dispatch({ type: "RUKCORD_SETTING_UPDATED" });
            Alert.alert(reset ? "Default theme restored" : "Theme applied");
        }
        catch (e) {
            useThemes.setState({ themes: previous });
            useColorsPref.getState().setType(pref);
            try {
                await store.selectTheme(Object.values(previous).find(theme => theme.selected)?.id ?? null);
            }
            catch { }
            setError(String(e));
        }
        finally {
            saving.current = false;
            setBusy(false);
        }
    };
    return <ScrollView style={{ flex: 1, backgroundColor: p.bg }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}>
        <Panel><Label bold>Presets</Label><View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{Object.entries(THEME_PRESETS).map(([name, preset]) => <Pressable key={name} accessibilityRole="button" accessibilityLabel={`${name} preset`} disabled={busy} onPress={() => { setDraft({ ...preset }); setError(""); }} style={{ backgroundColor: p.tint, borderRadius: 12, padding: 12 }}><Label>{name}</Label></Pressable>)}</View></Panel>
        <View style={{ padding: 18, gap: 14, borderRadius: 18, backgroundColor: preview.background, borderColor: p.line, borderWidth: 1 }}>
            <Text style={{ color: preview.muted, fontSize: 13 }}>Preview</Text>
            <View style={{ backgroundColor: preview.surface, padding: 14, borderRadius: 12, gap: 8 }}>
                <Text style={{ color: preview.accent, fontWeight: "700", fontSize: 17 }}>Rukcord</Text>
                <Text style={{ color: preview.text, fontSize: 16 }}>This is how your messages will look.</Text>
                <Text style={{ color: preview.muted, fontSize: 13 }}>Today at 12:00</Text>
            </View>
        </View>
        <Panel><Label bold>Base</Label><View style={{ flexDirection: "row", gap: 8 }}>{(["dark", "light"] as const).map(mode => <Pressable key={mode} accessibilityRole="radio" accessibilityState={{ checked: draft.mode === mode }} disabled={busy} onPress={() => setDraft(changeThemeBase(draft, mode))} style={{ padding: 12, borderRadius: 12, backgroundColor: draft.mode === mode ? p.accent : p.tint }}><Text style={{ color: draft.mode === mode ? p.bg : p.text }}>{mode === "dark" ? "Dark" : "Light"}</Text></Pressable>)}</View></Panel>
        {([['background', 'Background'], ['surface', 'Panels'], ['text', 'Text'], ['muted', 'Secondary text'], ['accent', 'Accent']] as const).map(([key, label]) => <Panel key={key}>
            <Label bold>{label}</Label><View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
                <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: preview[key], borderWidth: 1, borderColor: p.line }}/>
                <TextInput accessibilityLabel={`${label} color`} value={draft[key]} editable={!busy} onChangeText={value => { setDraft({ ...draft, [key]: value }); setError(""); }} autoCapitalize="characters" autoCorrect={false} maxLength={7} placeholder="#9E8CFF" placeholderTextColor={p.muted} style={{ flex: 1, color: p.text, backgroundColor: p.tint, padding: 12, borderRadius: 12 }}/>
            </View><View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>{SWATCHES.map(color => <Pressable key={color} accessibilityRole="button" accessibilityLabel={`${label} ${color}`} disabled={busy} onPress={() => setDraft({ ...draft, [key]: color })} style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: color, borderWidth: 2, borderColor: normalizeColor(draft[key]) === color ? p.accent : p.line }}/>)}</View>
        </Panel>)}
        {!!error && <Label>{error}</Label>}{!!safe && <Label>Turn off safe mode and reload to apply a theme.</Label>}
        <Action title={busy ? "Applying…" : "Save & apply"} disabled={busy || !!safe} onPress={() => void apply()}/>
        <Action title="Restore default theme" disabled={busy || !!safe} onPress={() => void apply(true)}/>
    </ScrollView>;
}
