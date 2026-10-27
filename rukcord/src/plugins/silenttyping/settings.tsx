import { Stack, TableSwitchRow } from "@metro/common/components";
import { ScrollView } from "react-native";
import { useTypingSettings } from "./storage";
export default function TypingSettings() {
    const state = useTypingSettings();
    return <ScrollView><Stack style={{padding: 16}} spacing={12}>
        <TableSwitchRow label="Hide typing" subLabel="Turn off to send typing indicators while keeping the plugin loaded."
            value={state.isEnabled} onValueChange={(v: boolean) => state.updateSettings({isEnabled: v})} />
    </Stack></ScrollView>;
}
