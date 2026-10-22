// SPDX-License-Identifier: MPL-2.0
import { installOpenAction } from "@api/ui/mobileAction";
import { attachmentURLs, avatarURL, imageURLs } from "@api/mobileTools";
import { definePlugin } from "@plugins";
let restore: (()=>void)|undefined;
export default definePlugin({id:"reverseimagesearch",name:"ReverseImageSearch",version:"2.0.0-rukcord",description:'Search an attachment using Google Lens after confirmation.',
    author:[{name:"Rukcord contributors",id:0n}],
    start(){if(!restore)restore=installOpenAction("rukcord-reverseimagesearch","ReverseImageSearch",message=>imageURLs(message)[0] ? "https://lens.google.com/uploadbyurl?url="+encodeURIComponent(imageURLs(message)[0]) : null||null,true);},
    stop(){restore?.();restore=undefined;}
});
