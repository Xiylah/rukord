// SPDX-License-Identifier: MPL-2.0
import { installOutgoingTransform } from "@api/outgoing";
import { textRules } from "@api/mobileTools";
import { definePlugin } from "@plugins";
import { useTextReplaceSettings } from "./storage";
import settings from "./settings";
let restore: (()=>void)|undefined;
export default definePlugin({id:"textreplace",name:"TextReplace",version:"2.0.0-rukcord",
    description:"Replace outgoing text on sends and edits, preserving existing rules and drafts.",author:[{name:"Rukcord contributors",id:0n}],settings,
    start(){if(!restore)restore=installOutgoingTransform(content=>textRules(content,useTextReplaceSettings.getState().rules));},
    stop(){restore?.();restore=undefined;}
});
