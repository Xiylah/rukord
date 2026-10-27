import { Stack, TableSwitchRow } from "@metro/common/components";
import { ScrollView } from "react-native";
import { useRawSettings } from "./storage";
export default function RawSettings() {
    const state = useRawSettings();
    return <ScrollView><Stack style={{padding: 16}} spacing={12}>
        <TableSwitchRow label="Sort keys" value={state.sortKeys} onValueChange={(v: boolean) => state.updateSettings({sortKeys: v})} />
        <TableSwitchRow label="Strip sensitive data" subLabel="Remove email, phone and credential fields before displaying or copying."
            value={state.stripSensitiveData} onValueChange={(v: boolean) => state.updateSettings({stripSensitiveData: v})} />
    </Stack></ScrollView>;
}
