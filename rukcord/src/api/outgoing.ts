// SPDX-License-Identifier: MPL-2.0
import { before } from "@api/patcher";
import { findByProps } from "@metro/wrappers";

export function outsideCode(text: string, transform: (plain: string) => string): string {
    if (text.length > 50_000) return text;
    return text.split(/(```[\s\S]*?(?:```|$)|`[^`\n]*(?:`|$))/g)
        .map((part,index)=>index%2?part:transform(part)).join("");
}

export function installOutgoingTransform(transform: (text: string) => string, options: {edits?: boolean} = {}): () => void {
    const messages=findByProps("sendMessage","editMessage","startEditMessage");
    if(typeof messages?.sendMessage!=="function"||typeof messages?.editMessage!=="function") throw new Error("Outgoing message hooks are unavailable on this Discord version");
    const patches: Array<()=>unknown>=[];
    try{
        for(const [method,index] of [["sendMessage",1],["editMessage",2]] as const){
            if (method === "editMessage" && options.edits === false) continue;
            patches.push(before(method,messages,args=>{
                const message=args[index];
                if(typeof message?.content!=="string")return;
                try{
                    const content=transform(message.content);
                    if(content===message.content)return;
                    const next=args.slice();next[index]={...message,content};return next;
                }catch(error){console.error("[Rukcord] Message transform failed; sending original:",error);}
            }));
        }
    }catch(error){patches.forEach(unpatch=>unpatch());throw error;}
    return ()=>{patches.splice(0).forEach(unpatch=>unpatch());};
}
