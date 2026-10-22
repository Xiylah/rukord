import { getDebugInfo } from "@api/debug";
import { useSettings } from "@api/settings";
import { openAlert } from "@api/ui/alerts";
import { CodebergIcon, RukcordIcon } from "@assets";
import { Strings } from "@i18n";
import { AlertActionButton, AlertActions, AlertModal, Stack, TableRow, TableRowGroup } from "@metro/common/components";
import { customBuild, isTargetDiscord } from "@rukcord/compatibility";
import { Linking, Platform, ScrollView } from "react-native";

// This private build is distributed as a pinned package, not an upstream update.
export async function downloadUpdate() {
    openAlert("rukcord350-package-update", <AlertModal
        title="Rukcord alpha"
        content="Install a newer Rukcord package to update this build."
        actions={<AlertActions><AlertActionButton text="OK" variant="primary" /></AlertActions>}
    />);
}

export function checkForUpdate() { return false; }

export function versionCheck() {
    const info = getDebugInfo();
    if (isTargetDiscord(Platform.OS, info.discord.version)) return;
    if (useSettings.getState().disableUpdateWarnings) return;
    openAlert("rukcord350-unverified-version", <AlertModal
        title="Untested Discord version"
        content={`This experimental build targets Discord 349.0 and 350.0 on iOS. You are running ${info.discord.version} (${info.discord.build}).`}
        actions={<AlertActions><AlertActionButton text={Strings.CONTINUE_ANYWAYS} variant="destructive" /></AlertActions>}
    />);
}

export default function Updater() {
    const debugInfo = getDebugInfo();

    return (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 38 }}>
            <Stack style={{ paddingVertical: 24, paddingHorizontal: 12 }} spacing={24}>
                <TableRowGroup title={Strings.INFO}>
                    <TableRow label="Target" trailing={<TableRow.TrailingText text={`Discord ${customBuild.target} / iOS`} />} />
                    <TableRow label="Validation" trailing={<TableRow.TrailingText text={customBuild.status} />} />
                    <TableRow
                        label={Strings.RUKCORD}
                        icon={<TableRow.Icon source={{ uri: RukcordIcon }} />}
                        trailing={<TableRow.TrailingText text={debugInfo.rukcord.version} />}
                    />
                </TableRowGroup>

            </Stack>
        </ScrollView>
    );
}
