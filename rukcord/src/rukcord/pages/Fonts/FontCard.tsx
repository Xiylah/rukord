import { systemFontName } from "@api/appearance";
import { findAssetId } from "@api/assets";
import { readFile } from "@api/native/fs";
import { requestFontRestart } from "@api/fontRestart";
import { createStyles, TextStyleSheet } from "@api/ui/styles";
import { Strings } from "@i18n";
import { lazyDestructure } from "@lib/utils/lazy";
import { findByProps } from "@metro";
import { FluxDispatcher, NavigationNative, tokens } from "@metro/common";
import { Button, Card, IconButton, Stack, Text } from "@metro/common/components";
import { FontDefinition, selectFont, useFonts } from "@plugins/_core/painter/fonts";
import { CardWrapper } from "@rukcord/pages/Addon/AddonCard";
import { useEffect, useMemo, useState } from "react";
import { PixelRatio, Text as NativeText, View } from "react-native";

import FontEditor from "./FontEditor";
import previewHtml from "./preview.html";

const { useToken } = lazyDestructure(() => findByProps("useToken"));

const useStyles = createStyles({
    full: {
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%"
    }
});

function FontPreview({ font }: { font: FontDefinition; }) {
    const [loaded, setLoaded] = useState(false);
    const [WebView, setWebView] = useState<any>(null);
    const [isReady, setIsReady] = useState(false);
    const styles = useStyles();

    const [fontUri, setFontUri] = useState<string | null>(null);

    const TEXT_DEFAULT = useToken(tokens.colors.TEXT_DEFAULT);
    const { fontFamily: fontFamilyList, fontSize } = TextStyleSheet["text-md/medium"];
    const fontFamily = fontFamilyList!.split(/,/g)[0];

    useEffect(() => {
        const webViewModule = findByProps("WebView");
        if (webViewModule?.WebView) {
            setWebView(() => webViewModule.WebView);
        }
    }, []);

    useEffect(() => {
        const getFontUri = async () => {
            const url = font.main[fontFamily];
            if (!url || systemFontName(url)) return;

            let ext = url.split(".").pop()?.toLowerCase();
            if (ext !== "ttf" && ext !== "otf") ext = "ttf";

            const path = `downloads/fonts/${font.name}/${fontFamily}.${ext}`;

            try {
                const base64Data = await readFile(path, { encoding: "base64" });
                const mimeType = ext === "otf" ? "opentype" : "truetype";
                setFontUri(`data:font/${mimeType};base64,${base64Data}`);
            } catch (e) {
                console.error("Failed to load font for preview:", e);
            }
        };

        getFontUri();
    }, [font, fontFamily]);

    useEffect(() => {
        if (WebView && fontUri) {
            setIsReady(true);
        }
    }, [WebView, fontUri]);

    const props = useMemo(() => ({
        family: fontUri,
        size: fontSize! * PixelRatio.getFontScale(),
        color: TEXT_DEFAULT,
        text: Strings.PREVIEW_TEXT,
    }), [fontUri, fontSize, TEXT_DEFAULT]);

    const systemFamily = Object.values(font.main).map(systemFontName).find(Boolean);
    if (systemFamily) return <NativeText style={{ color: TEXT_DEFAULT, fontSize, fontFamily: systemFamily }}>{Strings.PREVIEW_TEXT}</NativeText>;
    if (isReady && WebView) {
        return (
            <View style={{ width: "100%", height: 32 }}>
                <WebView
                    onMessage={() => setLoaded(true)}
                    source={{
                        html: previewHtml.replace("$$props", JSON.stringify(props))
                    }}
                    javaScriptEnabled
                    scrollEnabled={false}
                    overScrollMode="never"
                    showsHorizontalScrollIndicator={false}
                    showsVerticalScrollIndicator={false}
                    pointerEvents="none"
                    style={[styles.full, { backgroundColor: "transparent", opacity: Number(loaded) }]}
                />
                {!loaded && (
                    <View style={[styles.full, { justifyContent: "center", alignItems: "center" }]}>
                        <Text color="text-muted" variant="heading-lg/semibold">
                            {Strings.LOADING}
                        </Text>
                    </View>
                )}
            </View>
        );
    } else if (!isReady) {
        return (
            <View style={{ width: "100%", height: 32 }}>
                <View style={[styles.full, { justifyContent: "center", alignItems: "center" }]}>
                    <Text color="text-muted" variant="heading-lg/semibold">
                        {Strings.LOADING_PREVIEW}
                    </Text>
                </View>
            </View>
        );
    } else {
        return (
            <View style={{ width: "100%", height: 32 }}>
                <View style={[styles.full, { justifyContent: "center", alignItems: "center" }]}>
                    <Text color="text-muted" variant="heading-lg/semibold">
                        {Strings.PREVIEW_NOT_SUPPORTED}
                    </Text>
                </View>
            </View>
        );
    }
}

export default function FontCard({ item: font }: CardWrapper<FontDefinition>) {
    const selectedFont = useFonts(state => state.fonts.__selected);
    const navigation = NavigationNative.useNavigation();
    const selected = selectedFont === font.name;

    return (
        <Card>
            <Stack spacing={16}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <View>
                        <Text variant="heading-lg/semibold">
                            {font.name}
                        </Text>
                        {/* TODO: Text wrapping doesn't work well */}
                        {/* <Text color="text-muted" variant="text-sm/semibold">
                            {font.description}
                        </Text> */}
                    </View>
                    <View style={{ marginLeft: "auto" }}>
                        <Stack spacing={12} direction="horizontal">
                            <IconButton
                                onPress={() => {
                                    navigation.push("RUKCORD_CUSTOM_PAGE", {
                                        title: Strings.EDIT_FONT,
                                        render: () => <FontEditor name={font.name} />
                                    });
                                }}
                                size="sm"
                                variant="secondary"
                                disabled={selected || !!font.builtin}
                                icon={findAssetId("WrenchIcon")}
                            />
                            <Button
                                size="sm"
                                variant={selected ? "secondary" : "primary"}
                                text={selected ? Strings.UNAPPLY : Strings.APPLY}
                                onPress={async () => {
                                    await selectFont(selected ? null : font.name);
                                    // todo: move this out of ui
                                    FluxDispatcher.dispatch({ type: "RUKCORD_SETTING_UPDATED" });
                                    requestFontRestart();
                                }}
                            />
                        </Stack>
                    </View>
                </View>
                <FontPreview font={font} />
            </Stack>
        </Card>
    );
}
