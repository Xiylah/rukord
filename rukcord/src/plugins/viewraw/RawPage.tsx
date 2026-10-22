import { Codeblock } from "@api/ui/components";
import { showToast } from "@api/ui/toasts";
import { clipboard } from "@metro/common";
import { Stack, TableRow, TableRowGroup } from "@metro/common/components";
import { ScrollView } from "react-native";
import { serializeRaw } from "./serialize";
import { useRawSettings } from "./storage";

export default function RawPage({message}: {message: any}) {
    const settings = useRawSettings();
    const raw = serializeRaw(message, settings);
    const content = typeof message?._rkCurrentContent === "string" ? message._rkCurrentContent : message?.content ?? "";
    const copy = (text: string) => { clipboard.setString(text); showToast("Copied to clipboard"); };
    return <ScrollView contentContainerStyle={{padding: 16}}><Stack spacing={16}>
        <TableRowGroup title="Message data">
            <TableRow label="Copy raw content" onPress={() => copy(content)} />
            <TableRow label="Copy JSON" onPress={() => copy(raw)} />
        </TableRowGroup>
        <Codeblock selectable>{content}</Codeblock>
        <Codeblock selectable>{raw}</Codeblock>
    </Stack></ScrollView>;
}
