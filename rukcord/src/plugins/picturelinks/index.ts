// SPDX-License-Identifier: MPL-2.0
import { installOpenAction } from "@api/ui/mobileAction";
import { attachmentURLs, avatarURL, imageURLs } from "@api/mobileTools";
import { definePlugin } from "@plugins";
let restore: (()=>void)|undefined;
export default definePlugin({id:"picturelinks",name:"ViewIcons",version:"2.0.0-rukcord",description:'Open the message author’s full-size avatar. Replaces PictureLinks.',
    author:[{name:"Rukcord contributors",id:0n}],
    start(){if(!restore)restore=installOpenAction("rukcord-picturelinks","ViewIcons",message=>avatarURL(message)||null,false);},
    stop(){restore?.();restore=undefined;}
});
