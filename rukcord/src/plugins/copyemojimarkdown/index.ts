// SPDX-License-Identifier: MPL-2.0
import { installCopyAction } from "@api/ui/mobileAction";
import { emojiMarkdown, stickerURLs, userURL, attachmentNames, exactTimestamp } from "@api/mobileTools";
import { definePlugin } from "@plugins";
let restore: (()=>void)|undefined;
export default definePlugin({id:"copyemojimarkdown", name:"CopyEmojiMarkdown",version:"1.0.0-rukcord",
    description:'Copy custom emoji markup from a message.',author:[{name:"Rukcord contributors",id:0n}],
    start(){if(!restore)restore=installCopyAction("rukcord-copyemojimarkdown","CopyEmojiMarkdown",message=>emojiMarkdown(message).join(" ")||null);},
    stop(){restore?.();restore=undefined;}
});
