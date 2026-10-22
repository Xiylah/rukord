// SPDX-License-Identifier: MPL-2.0
import { instead } from "@api/patcher";
import { findByStoreName } from "@metro";
import { definePlugin } from "@plugins";
let restore:(()=>unknown)|undefined;
export default definePlugin({id:"alwaystrust",name:"AlwaysTrust",version:"2.0.0-rukcord",
    description:"Skip Discord's untrusted-domain confirmation while enabled.",author:[{name:"Rukcord contributors",id:0n}],
    start(){
        if(restore)return;
        const store=findByStoreName("MaskedLinkStore");
        if(typeof store?.isTrustedDomain!=="function")throw new Error("Trusted-domain hook is unavailable on this Discord version");
        restore=instead("isTrustedDomain",store,()=>true);
    },stop(){restore?.();restore=undefined;}
});
