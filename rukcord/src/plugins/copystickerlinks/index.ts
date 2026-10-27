// SPDX-License-Identifier: MPL-2.0
import { installCopyAction } from "@api/ui/mobileAction";
import { emojiMarkdown, stickerURLs, userURL, attachmentNames, exactTimestamp } from "@api/mobileTools";
import { definePlugin } from "@plugins";
let restore: (()=>void)|undefined;
export default definePlugin({id:"copystickerlinks", name:"CopyStickerLinks",version:"1.0.0-rukcord",
    description:'Copy sticker media links from a message.',author:[{name:"Rukcord contributors",id:0n}],
    start(){if(!restore)restore=installCopyAction("rukcord-copystickerlinks","CopyStickerLinks",message=>stickerURLs(message).join("\n")||null);},
    stop(){restore?.();restore=undefined;}
});
