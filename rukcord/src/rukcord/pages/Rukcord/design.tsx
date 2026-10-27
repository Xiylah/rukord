import { CUSTOM_THEME_ID, themeDraft } from "@api/appearance";
import { useSettings } from "@api/settings";
import { useThemes } from "@plugins/_core/painter/themes";
import { useColorsPref } from "@plugins/_core/painter/themes/preferences";
import { Pressable, Text, View, useColorScheme } from "react-native";
export function usePalette() {
    const systemScheme = useColorScheme();
    const base = useColorsPref(s => s.type);
    const safe = useSettings(s => s.safeMode);
    const custom = useThemes(s => s.themes[CUSTOM_THEME_ID]);
    if (!safe && custom?.selected) {
        const draft = themeDraft(custom.data);
        return { bg: draft.background, panel: draft.surface, text: draft.text, muted: draft.muted, accent: draft.accent, line: draft.muted + "45", tint: draft.accent + "20" };
    }
    const dark = (safe ? systemScheme : base ?? systemScheme) !== "light";
    return dark ? { bg: "#121016", panel: "#201b29", text: "#f6f2ff", muted: "#bcb3c9", accent: "#b9a2ff", line: "#393042", tint: "#302342" }
        : { bg: "#f5f1fa", panel: "#ffffff", text: "#241a33", muted: "#6b5e78", accent: "#6b43bb", line: "#e1d7ec", tint: "#eee4ff" };
}
export function Label({ children, muted = false, size = 15, bold = false }: any) {
    const p = usePalette();
    return <Text style={{ color: muted ? p.muted : p.text, fontSize: size, fontWeight: bold ? "700" : "400", lineHeight: size * 1.4 }}>{children}</Text>;
}
export function Panel({ children }: any) {
    const p = usePalette();
    return <View style={{ padding: 18, borderRadius: 22, backgroundColor: p.panel, borderWidth: 1, borderColor: p.line, gap: 12 }}>{children}</View>;
}
export function Action({ title, detail, onPress, disabled = false }: any) {
    const p = usePalette();
    return <Pressable accessibilityRole="button" accessibilityLabel={title} disabled={disabled} onPress={onPress} style={({ pressed }: any) => ({ padding: 15, borderRadius: 16, backgroundColor: p.tint, opacity: disabled ? 0.45 : pressed ? 0.7 : 1, gap: 3 })}>
        <Text style={{ color: p.accent, fontWeight: "700", fontSize: 16 }}>{title}</Text>
        {!!detail && <Label muted size={13}>{detail}</Label>}
    </Pressable>;
}
