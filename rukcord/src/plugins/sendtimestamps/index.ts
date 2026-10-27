// SPDX-License-Identifier: MPL-2.0
import { installOutgoingTransform } from "@api/outgoing";
import { definePlugin } from "@plugins";
import { expandTimes } from "./time";
import Settings from "./settings";
let restore: (()=>void)|undefined;
export default definePlugin({
    id:"sendtimestamps",name:"SendTimestamps",version:"1.0.0-rukcord",
    description:"Build local-time timestamps or expand explicit time shortcuts before sending.",
    author:[{name:"Rukcord",id:0n}],settings:Settings,
    start(){if(!restore)restore=installOutgoingTransform(expandTimes);},
    stop(){restore?.();restore=undefined;},
});
