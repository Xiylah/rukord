import { clipboard } from "@metro/common";
import { useState } from "react";
import { ScrollView, TextInput, View } from "react-native";
import { Action, Label, Panel, usePalette } from "@rukcord/pages/Rukcord/design";
import { localInput, localSeconds, timestamp, timeStyles } from "./time";
export default function TimestampBuilder(){
    const p=usePalette(),[input,setInput]=useState(()=>localInput(new Date())),[copied,setCopied]=useState("");
    const seconds=localSeconds(input);
    const names={t:"Short time",T:"Time with seconds",d:"Short date",D:"Long date",f:"Date and time",F:"Full date and time",R:"Relative time"};
    return <ScrollView style={{backgroundColor:p.bg}} contentContainerStyle={{padding:18,gap:16,paddingBottom:32}}>
        <Label size={26} bold>One time. Every timezone.</Label>
        <Panel><Label muted>Enter your local date and time</Label>
            <TextInput accessibilityLabel="Local date and time" value={input} onChangeText={setInput} placeholder="YYYY-MM-DD HH:mm" placeholderTextColor={p.muted}
                style={{color:p.text,borderColor:p.line,borderWidth:1,borderRadius:12,padding:14,fontSize:17}}/>
            <Action title="Use current time" onPress={()=>setInput(localInput(new Date()))}/>
            <Label muted>{seconds===null?"Enter a valid local date and time.":new Date(seconds*1000).toLocaleString()}</Label></Panel>
        {timeStyles.map(style=><Action key={style} title={names[style]} disabled={seconds===null}
            detail={copied===style?"Copied":timestamp(input,style)??""} onPress={()=>{clipboard.setString(timestamp(input,style)!);setCopied(style);}}/>)}
        <Panel><Label bold>Optional message shortcut</Label><Label muted>{"Enable SendTimestamps, then type {{time:2026-10-21 20:15|R}}. Code blocks stay untouched. A viewer sees the result in their timezone."}</Label></Panel>
    </ScrollView>;
}
