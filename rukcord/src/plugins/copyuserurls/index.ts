// SPDX-License-Identifier: MPL-2.0
import { installCopyAction } from "@api/ui/mobileAction";
import { emojiMarkdown, stickerURLs, userURL, attachmentNames, exactTimestamp } from "@api/mobileTools";
import { definePlugin } from "@plugins";
let restore: (()=>void)|undefined;
export default definePlugin({id:"copyuserurls", name:"CopyUserURLs",version:"1.0.0-rukcord",
    description:'Copy the message author’s Discord profile link.',author:[{name:"Rukcord contributors",id:0n}],
    start(){if(!restore)restore=installCopyAction("rukcord-copyuserurls","CopyUserURLs",message=>userURL(message)||null);},
    stop(){restore?.();restore=undefined;}
});
