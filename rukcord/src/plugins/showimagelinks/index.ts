// SPDX-License-Identifier: MPL-2.0
import { after } from "@api/patcher";
import { httpURL } from "@api/mobileTools";
import { findByName } from "@metro";
import { definePlugin } from "@plugins";
let restore:(()=>unknown)|undefined;
export function revealImageLinks(row:any,result:any){
    const message=result?.message;
    if(row?.rowType!==1||!Array.isArray(message?.content)||message.content.length||!Array.isArray(message.embeds))return;
    const urls=message.embeds.filter((e:any)=>e?.type==="image"||e?.type==="gifv").map((e:any)=>httpURL(e?.url)).filter(Boolean).slice(0,20);
    if(!urls.length)return;
    const content:any[]=[];
    for(const url of urls){if(content.length)content.push({type:"text",content:"\n"});content.push({type:"link",content:[{type:"text",content:url}],target:url});}
    return {...result,message:{...message,content}};
}
export default definePlugin({id:"showimagelinks",name:"ImageLink",version:"2.0.0-rukcord",
    description:"Keep hidden image-only URLs visible without changing cached message data.",author:[{name:"Rukcord contributors",id:0n}],
    start(){
        if(restore)return;
        const row=findByName("RowManager")?.prototype;
        if(typeof row?.generate!=="function")throw new Error("Message row hook is unavailable on this Discord version");
        restore=after("generate",row,([data],result)=>revealImageLinks(data,result));
    },stop(){restore?.();restore=undefined;}
});
