import { hideSheet } from "@api/ui/sheets";
import { ActionSheet, BottomSheetTitleHeader, TableRow, TableRowGroup } from "@metro/common/components";
import FontPicker from "../Rukcord/FontPicker";
import { useSettings } from "@api/settings";
import { Strings } from "@i18n";
import { NavigationNative } from "@metro/common";
import { FontDefinition, useFonts } from "@plugins/_core/painter/fonts";
import AddonPage from "@rukcord/pages/Addon/AddonPage";

import FontBrowser from "../Browser/Fonts";
import FontCard from "./FontCard";
import FontEditor from "./FontEditor";

export default function Fonts() {
    useSettings();
    const fonts = useFonts(state => state.fonts);
    const navigation = NavigationNative.useNavigation();

    return (

        <AddonPage<FontDefinition>
            title={Strings.FONTS}
            searchKeywords={["name", "description"]}
            sortOptions={{
                [Strings.SORT_NAME_AZ]: (a, b) => a.name.localeCompare(b.name),
                [Strings.SORT_NAME_ZA]: (a, b) => b.name.localeCompare(a.name)
            }}
            items={Object.values(fonts).filter((font): font is FontDefinition => typeof font === "object" && font !== null)}
            CardComponent={FontCard}
            OptionsActionSheetComponent={() => <ActionSheet><BottomSheetTitleHeader title={Strings.OPTIONS} />
                <TableRowGroup title={Strings.CUSTOMISATION}><TableRow label="Font styles" arrow onPress={() => { hideSheet("AddonMoreSheet"); navigation.push("RUKCORD_CUSTOM_PAGE", { title: "Font styles", render: () => <FontPicker /> }); }} /></TableRowGroup>
            </ActionSheet>}
            installBrowserAction={{
                label: Strings.IMPORT_FROM_BROWSER,
                onPress: () => {
                    navigation.push("RUKCORD_CUSTOM_PAGE", {
                        title: Strings.ADDON_BROWSER,
                        render: () => <FontBrowser />
                    });
                }
            }}
            installAction={{
                label: Strings.IMPORT_FROM_URL,
                onPress: () => {
                    navigation.push("RUKCORD_CUSTOM_PAGE", {
                        title: Strings.IMPORT_FONT,
                        render: () => <FontEditor />
                    });
                }
            }}
        />
    );
}
