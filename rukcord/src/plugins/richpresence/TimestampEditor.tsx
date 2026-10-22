import { useEffect, useState } from "react";
import { TextInput, View } from "react-native";
import { Action, Label, Panel, usePalette } from "@rukcord/pages/Rukcord/design";
import { durationInput, timestampEdit } from "./timestamps";
import type { ActivityTimestamps } from "./storage";
export function TimestampField({ kind, value, onApply }: {
    kind: "start" | "end";
    value?: number;
    onApply: (value: number | undefined) => void;
}) {
    const p = usePalette();
    const initial = () => typeof value === "number" ? durationInput(kind === "start" ? Date.now() - value : value - Date.now()) : "";
    const [draft, setDraft] = useState(initial), [error, setError] = useState("");
    useEffect(() => { setDraft(initial()); setError(""); }, [value, kind]);
    const apply = () => {
        const result = timestampEdit(draft, kind, Date.now());
        if (!result.valid) {
            setError(result.error);
            return;
        }
        setError("");
        onApply(result.value);
    };
    return <Panel><Label bold>{kind === "start" ? "Start (elapsed)" : "End (remaining)"}</Label>
        <TextInput accessibilityLabel={kind === "start" ? "RPC start duration" : "RPC end duration"} value={draft} onChangeText={text => { setDraft(text); setError(""); }} onSubmitEditing={apply} autoCorrect={false} autoCapitalize="none" returnKeyType="done" placeholder="30m, 1h 30m, 2d" placeholderTextColor={p.muted} style={{ color: p.text, borderColor: p.line, borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 16 }}/>
        {!!error && <Label>{error}</Label>}
        <Label muted>{typeof value === "number" ? new Date(value).toLocaleString() : kind === "start" ? "Default: plugin start time" : "No end time"}</Label>
        <View style={{ flexDirection: "row", gap: 12 }}><View style={{ flex: 1 }}><Action title={kind === "start" ? "Apply start" : "Apply end"} onPress={apply}/></View>
            <View style={{ flex: 1 }}><Action title="Clear" onPress={() => { setDraft(""); setError(""); onApply(undefined); }}/></View></View>
    </Panel>;
}
export default function TimestampEditor({ timestamps, onChange }: {
    timestamps: ActivityTimestamps;
    onChange: (patch: Partial<ActivityTimestamps>) => void;
}) {
    return <View style={{ padding: 12, gap: 14 }}>
        <Label muted>Enter how long ago it started or how long until it ends, then apply. Bare numbers mean milliseconds.</Label>
        <TimestampField kind="start" value={timestamps.start} onApply={start => onChange({ start })}/>
        <TimestampField kind="end" value={timestamps.end} onApply={end => onChange({ end })}/>
    </View>;
}
