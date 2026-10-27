// SPDX-License-Identifier: MPL-2.0
import { installCopyAction } from "@api/ui/mobileAction";
import { emojiMarkdown, stickerURLs, userURL, attachmentNames, exactTimestamp } from "@api/mobileTools";
import { definePlugin } from "@plugins";
let restore: (()=>void)|undefined;
export default definePlugin({id:"replytimestamp", name:"ReplyTimestamp",version:"1.0.0-rukcord",
    description:'Copy the exact time of a cached replied-to message.',author:[{name:"Rukcord contributors",id:0n}],
    start(){if(!restore)restore=installCopyAction("rukcord-replytimestamp","ReplyTimestamp",message=>exactTimestamp(message.referenced_message ?? message.referencedMessage)||null);},
    stop(){restore?.();restore=undefined;}
});
