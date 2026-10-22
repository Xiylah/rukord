// SPDX-License-Identifier: MPL-2.0
import { findByProps } from "@metro";
import { definePlugin } from "@plugins";
let restore: (()=>void)|undefined;
export default definePlugin({id:"dontroundmytimestamps",name:"DontRoundMyTimestamps",version:"1.0.0-rukcord",
    description:"Round relative times down; restore the previous rounding function on disable.",author:[{name:"Rukcord contributors",id:0n}],
    start(){
        if(restore)return;
        const moment=findByProps("relativeTimeRounding","relativeTimeThreshold");
        if(typeof moment?.relativeTimeRounding!=="function")throw new Error("Relative time formatting is unavailable on this Discord version");
        const original=moment.relativeTimeRounding();
        if(typeof original!=="function")throw new Error("Unsupported relative-time formatter");
        moment.relativeTimeRounding(Math.floor);
        restore=()=>{if(moment.relativeTimeRounding()===Math.floor)moment.relativeTimeRounding(original);};
    },stop(){restore?.();restore=undefined;}
});
