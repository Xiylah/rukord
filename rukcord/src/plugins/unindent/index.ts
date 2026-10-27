// SPDX-License-Identifier: MPL-2.0
import { installOutgoingTransform } from "@api/outgoing";
import { unindentCode } from "@api/mobileTools";
import { definePlugin } from "@plugins";
let restore: (()=>void)|undefined;
export default definePlugin({id:"unindent",name:"Unindent",version:"1.0.0-rukcord",description:'Remove common indentation from outgoing fenced code blocks.',author:[{name:"Rukcord contributors",id:0n}],
    start(){if(!restore)restore=installOutgoingTransform(unindentCode,{});},stop(){restore?.();restore=undefined;}
});
