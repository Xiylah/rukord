import { useState } from "react";
import { ScrollView, Switch, TextInput } from "react-native";
import { Action, Label, Panel, usePalette } from "@rukcord/pages/Rukcord/discordDesign";
import { textRules } from "@api/mobileTools";
import { useTextReplaceSettings } from "./storage";
export default function TextRulesSettings(){
    const p=usePalette(),settings=useTextReplaceSettings(),[sample,setSample]=useState("");
    const rules=settings.rules??[];
    const update=(index:number,patch:any)=>settings.updateSettings({rules:rules.map((rule,i)=>i===index?{...rule,...patch}:rule)});
    const field=(value:string,onChangeText:(v:string)=>void,label:string)=><TextInput accessibilityLabel={label} placeholder={label}
        placeholderTextColor={p.muted} value={value??""} onChangeText={onChangeText}
        style={{color:p.text,borderColor:p.line,borderWidth:1,borderRadius:10,padding:12}}/>;
    return <ScrollView contentContainerStyle={{padding:16,gap:14,paddingBottom:32}} keyboardShouldPersistTaps="handled">
        <Label size={26} bold>Your words. Your rules.</Label>
        <Label muted>Rules run in order on sends and edits. Existing saved rules are retained.</Label>
        {rules.map((rule,index)=>{
            let invalid="";try{if(rule.regex&&rule.match)new RegExp(rule.match,rule.flags);}catch(error){invalid=String(error);}
            return <Panel key={index}>
                {field(rule.name,value=>update(index,{name:value}),"Rule name")}
                {field(rule.match,value=>update(index,{match:value}),"Find")}
                {field(rule.replace,value=>update(index,{replace:value}),"Replace")}
                <Label>Use a regular expression</Label><Switch value={!!rule.regex} onValueChange={value=>update(index,{regex:value})}/>
                {rule.regex&&field(rule.flags,value=>update(index,{flags:value}),"Regex flags")}
                {!!invalid&&<Label muted>{invalid}</Label>}
                <Action title="Remove rule" onPress={()=>settings.updateSettings({rules:rules.filter((_,i)=>i!==index)})}/>
            </Panel>;
        })}
        <Action title="Add rule" disabled={rules.length>=100} onPress={()=>settings.updateSettings({rules:[...rules,{name:"New rule",match:"",flags:"g",replace:"",regex:false}]})}/>
        <Panel><Label bold>Try your rules</Label>{field(sample,setSample,"Preview text")}<Label>{textRules(sample,rules)}</Label></Panel>
    </ScrollView>;
}
