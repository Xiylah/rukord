// Data-only helpers shared by the appearance editors and font downloader.
export const CUSTOM_THEME_ID = "local:rukcord-custom";
export type ThemeDraft = {
    mode: "dark" | "light";
    background: string;
    surface: string;
    text: string;
    muted: string;
    accent: string;
};
export const THEME_PRESETS: Record<string, ThemeDraft> = {
    Dark: { mode: "dark", background: "#17171C", surface: "#24242C", text: "#F4F4F7", muted: "#B5B5C3", accent: "#9E8CFF" },
    Black: { mode: "dark", background: "#000000", surface: "#151515", text: "#F5F5F5", muted: "#B8B8B8", accent: "#8BB8FF" },
    Purple: { mode: "dark", background: "#171221", surface: "#292036", text: "#F6F0FF", muted: "#C0B2D2", accent: "#C6A4FF" },
    Light: { mode: "light", background: "#F4F4F8", surface: "#FFFFFF", text: "#242430", muted: "#626274", accent: "#6242BD" },
};
export function changeThemeBase(draft: ThemeDraft, mode: "dark" | "light"): ThemeDraft {
    if (draft.mode === mode)
        return draft;
    return { ...THEME_PRESETS[mode === "light" ? "Light" : "Dark"], accent: draft.accent };
}
export function normalizeColor(value: string): string | null {
    const text = value.trim();
    if (/^#?[\da-f]{6}$/i.test(text))
        return "#" + text.replace(/^#/, "").toUpperCase();
    if (/^#?[\da-f]{3}$/i.test(text))
        return "#" + text.replace(/^#/, "").split("").map(x => x + x).join("").toUpperCase();
    return null;
}
export function themeManifest(draft: ThemeDraft) {
    if (draft.mode !== "dark" && draft.mode !== "light")
        throw new Error("Choose a light or dark base.");
    const colors: Record<string, string> = {};
    for (const key of ["background", "surface", "text", "muted", "accent"] as const) {
        const color = normalizeColor(draft[key]);
        if (!color)
            throw new Error(`Enter a valid ${key} color, such as #9E8CFF.`);
        colors[key] = color;
    }
    const semanticColors: Record<string, string[]> = {};
    const assign = (keys: string[], color: string) => keys.forEach(key => semanticColors[key] = [color, color]);
    assign(["BACKGROUND_PRIMARY", "BACKGROUND_MOBILE_PRIMARY", "BG_BASE_PRIMARY", "BACKGROUND_BASE_LOWEST", "BACKGROUND_BASE_LOWER", "BACKGROUND_BASE_LOW"], colors.background);
    assign(["BACKGROUND_SECONDARY", "BACKGROUND_SECONDARY_ALT", "BACKGROUND_TERTIARY", "BACKGROUND_FLOATING", "BACKGROUND_MOBILE_SECONDARY", "CHANNELTEXTAREA_BACKGROUND", "BG_BASE_SECONDARY", "BG_BASE_TERTIARY", "BG_SURFACE_RAISED", "BG_SURFACE_OVERLAY", "BACKGROUND_SURFACE_HIGH", "BACKGROUND_SURFACE_HIGHEST", "BACKGROUND_CODE", "BACKGROUND_APP_LAUNCHER_CARD_DEFAULT", "BACKGROUND_APP_LAUNCHER_ROW_DEFAULT"], colors.surface);
    assign(["TEXT_NORMAL", "TEXT_DEFAULT", "HEADER_PRIMARY", "INTERACTIVE_NORMAL", "INTERACTIVE_ACTIVE", "CHANNELS_DEFAULT", "MOBILE_TEXT_HEADING_PRIMARY"], colors.text);
    assign(["TEXT_MUTED", "HEADER_SECONDARY", "INTERACTIVE_MUTED", "MOBILE_TEXT_HEADING_SECONDARY"], colors.muted);
    assign(["TEXT_LINK", "TEXT_BRAND", "INTERACTIVE_BRAND", "CHANNEL_ICON", "BACKGROUND_ACCENT", "BUTTON_FILLED_BRAND_BACKGROUND"], colors.accent);
    const rawColors = { BRAND_360: colors.accent, BRAND_500: colors.accent, BRAND_560: colors.accent, BRAND_600: colors.accent };
    return { spec: 2 as const, name: "Custom theme", semanticColors, rawColors, rukcordEditor: { ...draft, ...colors } };
}
export function themeDraft(data: unknown): ThemeDraft {
    try {
        const draft = (data as {
            rukcordEditor: ThemeDraft;
        }).rukcordEditor;
        const normalized = themeManifest(draft).rukcordEditor;
        return normalized;
    }
    catch {
        return { ...THEME_PRESETS.Dark };
    }
}
export const BUILTIN_FONTS = [
    { id: "avenir", name: "Avenir Next", regular: "AvenirNext-Regular", medium: "AvenirNext-Medium", bold: "AvenirNext-Bold", italic: "AvenirNext-Italic", boldItalic: "AvenirNext-BoldItalic" },
    { id: "georgia", name: "Georgia", regular: "Georgia", medium: "Georgia", bold: "Georgia-Bold", italic: "Georgia-Italic", boldItalic: "Georgia-BoldItalic" },
    { id: "menlo", name: "Menlo", regular: "Menlo-Regular", medium: "Menlo-Regular", bold: "Menlo-Bold", italic: "Menlo-Italic", boldItalic: "Menlo-BoldItalic" },
] as const;
export function systemFontName(value: string): string | null {
    if (!value.startsWith("system:"))
        return null;
    const name = value.slice(7);
    return BUILTIN_FONTS.some(font => [font.regular, font.medium, font.bold, font.italic, font.boldItalic].includes(name as never)) ? name : null;
}
export function builtinFont(id: string) {
    const font = BUILTIN_FONTS.find(font => font.id === id);
    if (!font)
        throw new Error("Choose a font from the list.");
    const main: Record<string, string> = {};
    for (const prefix of ["ggsans", "NotoSans"]) {
        for (const [weight, name] of Object.entries({ Normal: font.regular, Regular: font.regular, Medium: font.medium, Semibold: font.bold, Bold: font.bold, ExtraBold: font.bold, NormalItalic: font.italic, Italic: font.italic, MediumItalic: font.italic, BoldItalic: font.boldItalic, SemiboldItalic: font.boldItalic })) {
            main[`${prefix}-${weight}`] = "system:" + name;
        }
    }
    main['ggsans-vf'] = "system:" + font.regular;
    for (const family of ['ABCGintoDiscordNord-Bold', 'ABCGintoDiscordNord-BlackItalic', 'ABCGintoDiscordNord-BoldItalic', 'ABCGintoNord-ExtraBold', 'ABCGintoNord-ExtraBoldItalic'])
        main[family] = "system:" + (family.includes('Italic') ? font.boldItalic : font.bold);
    main.systemFont = "system:" + font.regular;
    main.systemFontMedium = "system:" + font.medium;
    main.systemFontBold = "system:" + font.bold;
    main.systemFontItalic = "system:" + font.italic;
    main.systemFontBoldItalic = "system:" + font.boldItalic;
    return { spec: 1 as const, name: `Rukcord ${font.name}`, builtin: id, main };
}
