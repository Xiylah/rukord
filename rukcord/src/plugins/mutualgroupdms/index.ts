// SPDX-License-Identifier: MPL-2.0
import { addMessageAction } from "@api/ui/messageActions";
import { findByStoreName } from "@metro";
import { definePlugin } from "@plugins";
import { Alert } from "react-native";
let restore:(()=>void)|undefined;
export default definePlugin({id:"mutualgroupdms",name:"MutualGroupDMs",version:"1.0.0-rukcord",
    description:"List cached group DMs shared with a message’s author. No server requests.",author:[{name:"Rukcord contributors",id:0n}],
    start(){
        if(restore)return;
        const channels=findByStoreName("ChannelStore");
        if(typeof channels?.getMutablePrivateChannels!=="function")throw new Error("Private-channel cache is unavailable");
        restore=addMessageAction({id:"rukcord-mutual-groups",label:"Shared group DMs",visible:m=>!!m?.author?.id,onPress:message=>{
            const groups=Object.values(channels.getMutablePrivateChannels()??{}).filter((c:any)=>c?.type===3&&Array.isArray(c.recipients)&&c.recipients.includes(message.author.id)) as any[];
            Alert.alert("Shared group DMs",groups.length?groups.slice(0,30).map(c=>c.name||`Group ${c.id}`).join("\n"):"No shared groups in the local cache.");
        }});
    },stop(){restore?.();restore=undefined;}
});
