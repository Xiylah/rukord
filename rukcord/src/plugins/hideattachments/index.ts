// SPDX-License-Identifier: MPL-2.0
import { after } from "@api/patcher";
import { findByName } from "@metro";
import { definePlugin } from "@plugins";
let restore:(()=>unknown)|undefined;
export function withoutAttachments(result:any){
    return Array.isArray(result?.message?.attachments)&&result.message.attachments.length
        ?{...result,message:{...result.message,attachments:[]}}:undefined;
}
export default definePlugin({id:"hideattachments",name:"HideAttachments",version:"1.0.0-rukcord",requiresRestart:true,
    description:"Hide attachment rows without deleting files or modifying cached messages. Reload required.",author:[{name:"Rukcord contributors",id:0n}],
    start(){
        if(restore)return;
        const row=findByName("RowManager")?.prototype;
        if(typeof row?.generate!=="function")throw new Error("Native attachment row hook is unavailable");
        restore=after("generate",row,(_,result)=>withoutAttachments(result));
    },stop(){restore?.();restore=undefined;}
});
