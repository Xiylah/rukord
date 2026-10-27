import SettingsTextInput from "@api/ui/components/SettingsTextInput";
import { Stack, TableSwitchRow, TableRowGroup } from "@metro/common/components";
import { ScrollView } from "react-native";
import { useReplySettings } from "./storage";
export default function ReplySettings() {
    const s = useReplySettings();
    return <ScrollView><Stack style={{padding:16}} spacing={16}>
        <TableSwitchRow label="Only ping listed users / roles" subLabel="Turn off to never ping listed users / roles instead. You can still change the reply ping manually."
            value={s.shouldPingListed} onValueChange={(v: boolean) => s.updateSettings({shouldPingListed:v})} />
        <TableRowGroup title="User IDs (commas or spaces)"><SettingsTextInput value={s.userList} onChange={(v: string) => s.updateSettings({userList:v})} /></TableRowGroup>
        <TableRowGroup title="Role IDs (commas or spaces)"><SettingsTextInput value={s.roleList} onChange={(v: string) => s.updateSettings({roleList:v})} /></TableRowGroup>
    </Stack></ScrollView>;
}
