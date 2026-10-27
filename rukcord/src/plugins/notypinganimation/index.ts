// SPDX-License-Identifier: MPL-2.0
import { instead } from "@api/patcher";
import { componentTarget } from "@api/react/componentTarget";
import { findByName } from "@metro";
import { React } from "@metro/common";
import { Text } from "react-native";
import { definePlugin } from "@plugins";
let restore:(()=>unknown)|undefined;
export default definePlugin({id:"notypinganimation",name:"NoTypingAnimation",version:"1.0.0-rukcord",requiresRestart:true,
    description:"Replace supported typing-dot components with static dots. Reload required.",author:[{name:"Rukcord contributors",id:0n}],
    start(){
        if(restore)return;
        let target:null|{parent:any;key:string}=null;
        for(const name of ["TypingDots","TypingIndicatorDots"]){target=componentTarget(findByName(name,false));if(target)break;}
        if(!target)throw new Error("Native typing-dot component is unavailable on this Discord version");
        restore=instead(target.key,target.parent,()=>React.createElement(Text,{accessibilityLabel:"Typing"},"•••"));
    },stop(){restore?.();restore=undefined;}
});
