// SPDX-License-Identifier: MPL-2.0
import { installOutgoingTransform } from "@api/outgoing";
import { silentContent } from "@api/mobileTools";
import { definePlugin } from "@plugins";
let restore: (()=>void)|undefined;
export default definePlugin({id:"silentmessagetoggle",name:"SilentMessageToggle",version:"1.0.0-rukcord",description:'Send new text messages with @silent while enabled. No edit changes.',author:[{name:"Rukcord contributors",id:0n}],
    start(){if(!restore)restore=installOutgoingTransform(silentContent,{edits:false});},stop(){restore?.();restore=undefined;}
});
