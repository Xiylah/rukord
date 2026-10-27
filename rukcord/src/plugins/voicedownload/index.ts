// SPDX-License-Identifier: MPL-2.0
import { installOpenAction } from "@api/ui/mobileAction";
import { attachmentURLs, avatarURL, imageURLs } from "@api/mobileTools";
import { definePlugin } from "@plugins";
let restore: (()=>void)|undefined;
export default definePlugin({id:"voicedownload",name:"VoiceDownload",version:"2.0.0-rukcord",description:'Open a voice message attachment for saving with iOS.',
    author:[{name:"Rukcord contributors",id:0n}],
    start(){if(!restore)restore=installOpenAction("rukcord-voicedownload","VoiceDownload",message=>attachmentURLs(message,true)[0]||null,false);},
    stop(){restore?.();restore=undefined;}
});
