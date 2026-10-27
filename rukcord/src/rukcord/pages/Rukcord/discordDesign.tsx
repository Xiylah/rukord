import { semanticColors } from "@api/ui/components/color";
import { createStyles } from "@api/ui/styles";
import { Button, Card, Text } from "@metro/common/components";
import { View } from "react-native";

const useColors = createStyles({
    bg: { color: semanticColors.BACKGROUND_PRIMARY },
    panel: { color: semanticColors.BACKGROUND_SECONDARY },
    text: { color: semanticColors.TEXT_NORMAL },
    muted: { color: semanticColors.TEXT_MUTED },
    accent: { color: semanticColors.TEXT_LINK },
    line: { color: semanticColors.BACKGROUND_MODIFIER_ACCENT },
    tint: { color: semanticColors.BACKGROUND_TERTIARY }
});
export function usePalette() {
    const styles = useColors();
    return { bg: styles.bg.color, panel: styles.panel.color, text: styles.text.color,
        muted: styles.muted.color, accent: styles.accent.color, line: styles.line.color, tint: styles.tint.color };
}
export function Label({ children, muted = false, size = 15, bold = false }: any) {
    return <Text color={muted ? "text-muted" : "text-normal"} style={{ fontSize: size, fontWeight: bold ? "700" : "400" }}>{children}</Text>;
}
export function Panel({ children }: any) {
    return <Card><View style={{ gap: 12 }}>{children}</View></Card>;
}
export function Action({ title, detail, onPress, disabled = false }: any) {
    return <View style={{ gap: 4 }}><Button text={title} variant="secondary" disabled={disabled} onPress={onPress} />
        {!!detail && <Label muted size={13}>{detail}</Label>}</View>;
}
