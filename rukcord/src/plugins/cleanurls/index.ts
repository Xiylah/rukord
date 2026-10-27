// SPDX-License-Identifier: MPL-2.0
import { installOutgoingTransform } from "@api/outgoing";
import { definePlugin } from "@plugins";
import { Contributors, Developers } from "@rukcord/Developers";
import { cleanMessage } from "./clean";
let restore: (()=>void)|undefined;
export default definePlugin({
    id:"cleanurls",name:"ClearURLs",version:"2.0.0-rukcord",
    description:"Strip common tracking parameters on send/edit without a background rule download. Signed links and code stay intact.",
    author:[Developers.cocobo1,Contributors.nexpid],
    start(){if(!restore)restore=installOutgoingTransform(cleanMessage);},
    stop(){restore?.();restore=undefined;},
});
