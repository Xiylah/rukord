// SPDX-License-Identifier: MPL-2.0
import { addMessageAction } from "@api/ui/messageActions";
import { showConfirmationAlert } from "@api/ui/alerts";
import { showToast } from "@api/ui/toasts";
import { isSnowflake } from "@api/mobileTools";
import { findByProps } from "@metro";
import { UserStore } from "@metro/common/stores";
import { definePlugin } from "@plugins";
let restore:(()=>void)|undefined;
export default definePlugin({id:"unsuppressembeds",name:"UnsuppressEmbeds",version:"1.0.0-rukcord",
    description:"Restore embeds on your own messages, with confirmation. Server permissions still apply.",author:[{name:"Rukcord contributors",id:0n}],
    start(){
        if(restore)return;
        const api=findByProps("getAPIBaseURL","patch");
        if(typeof api?.patch!=="function")throw new Error("Message editing API is unavailable");
        let active=true;const pending=new Set<string>();
        const eligible=(m:any)=>isSnowflake(m?.id)&&isSnowflake(m?.channel_id??m?.channelId)&&
            m?.author?.id===UserStore.getCurrentUser()?.id&&!!(Number(m?.flags)&4);
        const remove=addMessageAction({id:"rukcord-unsuppress",label:"Restore embeds",visible:eligible,onPress:message=>{
            if(!eligible(message)||!active)return;
            showConfirmationAlert({title:"Restore embeds?",content:"Restore link previews on this message?",confirmText:"Restore",cancelText:"Cancel",
                async onConfirm(){
                    if(!active||!eligible(message)||pending.has(message.id))return;
                    pending.add(message.id);
                    try{await api.patch({url:`/channels/${message.channel_id??message.channelId}/messages/${message.id}`,body:{flags:Number(message.flags)&~4}});
                        if(active)showToast("Embeds restored");}
                    catch{if(active)showToast("Could not restore embeds");}
                    finally{pending.delete(message.id);}
                },onCancel(){}});
        }});
        restore=()=>{active=false;remove();};
    },stop(){restore?.();restore=undefined;}
});
