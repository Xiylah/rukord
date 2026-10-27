// SPDX-License-Identifier: MPL-2.0
import { addMessageAction } from "@api/ui/messageActions";
import { showToast } from "@api/ui/toasts";
import { httpURL } from "@api/mobileTools";
import { clipboard } from "@metro/common";
import { definePlugin } from "@plugins";
let restore:(()=>void)|undefined;
const limit=128*1024;
export function textAttachment(message:any){
    return (Array.isArray(message?.attachments)?message.attachments:[]).find((a:any)=>{
        if(!httpURL(a?.url)||typeof a?.size!=="number"||a.size<0||a.size>limit||!/\.(txt|md|json|csv|log|ya?ml|xml|js|ts|py|css|html|ini|toml)$/i.test(a?.filename??""))return false;
        return /^https:\/\/(cdn\.discordapp\.com|media\.discordapp\.net)\//.test(a.url);
    });
}
export default definePlugin({id:"copyfilecontents",name:"CopyFileContents",version:"1.0.0-rukcord",
    description:"Copy the first small text attachment (128 KiB maximum) from a message.",author:[{name:"Rukcord contributors",id:0n}],
    start(){
        if(restore)return;
        if(typeof fetch!=="function"||typeof AbortController!=="function")throw new Error("Cancellable attachment downloads are unavailable");
        let active=true,busy=false;const requests=new Set<AbortController>();
        const remove=addMessageAction({id:"rukcord-copy-file",label:"Copy text attachment contents",visible:m=>!!textAttachment(m),onPress:async message=>{
            const attachment=textAttachment(message);if(!attachment||busy||!active)return;
            busy=true;const controller=new AbortController();requests.add(controller);
            const timer=setTimeout(()=>controller.abort(),10_000);
            try{
                const response=await fetch(attachment.url,{signal:controller.signal,credentials:"omit",redirect:"error"});
                const length=response.headers.get("content-length"),declared=Number(length);
                if(!response.ok||length===null||!Number.isFinite(declared)||declared<0||declared>limit)throw new Error("Attachment unavailable or too large");
                const text=await response.text();
                if(text.length>limit||text.includes("\u0000"))throw new Error("Attachment is not a small text file");
                if(active){clipboard.setString(text);showToast("File contents copied");}
            }catch{if(active)showToast("Could not copy text attachment");}
            finally{clearTimeout(timer);requests.delete(controller);busy=false;}
        }});
        restore=()=>{active=false;for(const request of requests)request.abort();requests.clear();remove();};
    },stop(){restore?.();restore=undefined;}
});
