import { BUILTIN_FONTS, builtinFont } from "@api/appearance";
import { requestFontRestart } from "@api/fontRestart";
import { useSettings } from "@api/settings";
import { FluxDispatcher } from "@metro/common";
import { saveFont, selectFont, useFonts } from "@plugins/_core/painter/fonts";
import { useRef, useState } from "react";
import { Alert, Platform, ScrollView, Text, View } from "react-native";
import { Action, Label, Panel, usePalette } from "./design";
export default function FontPicker() {
    const p = usePalette(), safe = useSettings(s => s.safeMode);
    const selected = useFonts(s => s.fonts.__selected);
    const [busy, setBusy] = useState(false), [error, setError] = useState("");
    const saving = useRef(false);
    const apply = async (id: string | null) => {
        if (saving.current || safe)
            return;
        saving.current = true;
        setBusy(true);
        setError("");
        try {
            const definition = id ? builtinFont(id) : null;
            if (definition) {
                const existing = useFonts.getState().fonts[definition.name];
                if (existing && existing.builtin !== id)
                    throw new Error("A different font already uses this name. Rename it in Fonts first.");
                if (!existing)
                    await saveFont(definition);
                else
                    useFonts.getState().setFont(definition.name, definition);
            }
            await selectFont(definition?.name ?? null);
            FluxDispatcher.dispatch({ type: "RUKCORD_SETTING_UPDATED" });
            requestFontRestart();
        }
        catch (e) {
            setError(String(e));
        }
        finally {
            saving.current = false;
            setBusy(false);
        }
    };
    return <ScrollView style={{ flex: 1, backgroundColor: p.bg }} contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}>
        <Label muted>Choose an iPhone font. Close and reopen Discord after applying.</Label>
        {BUILTIN_FONTS.map(font => <Panel key={font.id}>
            <Label bold>{font.name}{selected === builtinFont(font.id).name ? " · Selected" : ""}</Label>
            <View style={{ gap: 8 }}><Text style={{ color: p.text, fontFamily: font.regular, fontSize: 19 }}>The quick brown fox jumps over the lazy dog.</Text>
                <Text style={{ color: p.text, fontFamily: font.bold, fontSize: 19 }}>Bold text</Text></View>
            <Action title="Apply" disabled={busy || !!safe || Platform.OS !== "ios"} onPress={() => void apply(font.id)}/>
        </Panel>)}
        {!!error && <Label>{error}</Label>}{!!safe && <Label>Turn off safe mode and reload to apply a font.</Label>}
        <Action title="Restore default font" disabled={busy || !!safe} onPress={() => void apply(null)}/>
    </ScrollView>;
}
