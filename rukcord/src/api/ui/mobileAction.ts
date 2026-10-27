// SPDX-License-Identifier: MPL-2.0
import { addMessageAction } from "./messageActions";
import { showToast } from "./toasts";
import { clipboard } from "@metro/common";
import { Alert, Linking } from "react-native";

export function installCopyAction(id: string, label: string, getText: (message:any)=>string|null): ()=>void {
    return addMessageAction({id, label, visible:message=>!!getText(message),
        onPress:message=>{
            const text=getText(message);
            if (!text) return;
            try { clipboard.setString(text); showToast("Copied"); }
            catch { showToast("Copy failed"); }
        }});
}
export function installOpenAction(id: string, label: string, getURL: (message:any)=>string|null, thirdParty = false): ()=>void {
    let active=true;
    const restore=addMessageAction({id,label,visible:message=>!!getURL(message),onPress:message=>{
        const target=getURL(message);
        if (!active||!target) return;
        const open=()=>{
            if (!active) return;
            Promise.resolve(Linking.openURL(target)).catch(()=>{if(active)showToast("Could not open link");});
        };
        if(thirdParty)Alert.alert("Search with Google", "This shares the selected image link with Google.",[
            {text:"Cancel",style:"cancel"},{text:"Continue",onPress:open}]);
        else open();
    }});
    return ()=>{active=false;restore();};
}
