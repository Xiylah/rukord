import { ScrollView, Switch, TextInput } from "react-native";
import { Label, Panel, usePalette } from "@rukcord/pages/Rukcord/discordDesign";
import { useAnonymizeSettings } from "./storage";
export default function FilenameSettings(){
    const settings=useAnonymizeSettings(),p=usePalette();
    return <ScrollView contentContainerStyle={{padding:16,gap:14}}>
        <Panel><Label bold>Use a custom filename</Label><Switch value={settings.useCustomName}
            onValueChange={value=>settings.updateSettings({useCustomName:value})}/>
            <Label muted>Random names are used when this is off. Original extensions and spoiler markers are preserved.</Label></Panel>
        {settings.useCustomName&&<Panel><Label>Filename</Label><TextInput value={settings.customName}
            accessibilityLabel="Custom upload filename" onChangeText={value=>settings.updateSettings({customName:value})}
            style={{color:p.text,padding:12,borderWidth:1,borderColor:p.line,borderRadius:12}}/></Panel>}
    </ScrollView>;
}
