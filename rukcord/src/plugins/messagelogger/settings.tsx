import SettingsTextInput from "@api/ui/components/SettingsTextInput";
import { Stack, TableRowGroup, TableSwitchRow, Text } from "@metro/common/components";
import { ScrollView } from "react-native";
import { useMessageLoggerSettings } from "./storage";
export default function LoggerSettings() {
    const s = useMessageLoggerSettings();
    const update = useMessageLoggerSettings.getState().updateSettings;
    return <ScrollView><Stack style={{padding:16}} spacing={16}>
        <TableRowGroup title="Logging">
            <TableSwitchRow label="Keep deleted messages" value={s.deleted?.enabled !== false} onValueChange={(v: boolean) => update({deleted:{...s.deleted,enabled:v}})} />
            <TableSwitchRow label="Mark deleted text" subLabel="Show a local [deleted] label. Voice message content stays intact."
                value={s.markDeleted !== false} onValueChange={(v: boolean) => update({markDeleted:v})} />
            <TableSwitchRow label="Keep edit history" value={s.edited?.enabled !== false} onValueChange={(v: boolean) => update({edited:{...s.edited,enabled:v}})} />
            <TableSwitchRow label="Display edits inline" value={s.inlineEdits !== false} onValueChange={(v: boolean) => update({inlineEdits:v})} />
            <TableSwitchRow label="Keep removed attachments" value={s.logDeletedAttachments !== false} onValueChange={(v: boolean) => update({logDeletedAttachments:v})} />
            <TableSwitchRow label="Save an extra log archive" value={!!s.databaseLogging} onValueChange={(v: boolean) => update({databaseLogging:v})} />
        </TableRowGroup>
        <TableRowGroup title="Filters">
            <TableSwitchRow label="Ignore bots" value={!!s.filters?.ignoreBots} onValueChange={(v: boolean) => update({filters:{...s.filters,ignoreBots:v}})} />
            <TableSwitchRow label="Ignore my messages" value={!!s.filters?.ignoreSelf} onValueChange={(v: boolean) => update({filters:{...s.filters,ignoreSelf:v}})} />
            <TableSwitchRow label="Ignore my edits only" value={!!s.filters?.ignoreSelfEdits} onValueChange={(v: boolean) => update({filters:{...s.filters,ignoreSelfEdits:v}})} />
        </TableRowGroup>
        {([['user','Ignore user IDs'],['channel','Ignore channel / category IDs'],['guild','Ignore server IDs']] as const).map(([key,label]) =>
            <TableRowGroup key={key} title={label}><SettingsTextInput value={s.ignoreLists?.[key] ?? ""}
                placeholder="IDs separated by commas or spaces" onChange={(v: string) => update({ignoreLists:{...s.ignoreLists,[key]:v}})} /></TableRowGroup>)}
        <Text variant="text-sm/normal">Keeps up to 500 logged messages locally. Only messages already cached on this device can be retained. Clear a message’s local history from its long-press menu. Downloaded attachment availability depends on Discord’s CDN.</Text>
    </Stack></ScrollView>;
}
