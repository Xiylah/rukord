// SPDX-License-Identifier: MPL-2.0
import { before } from "@api/patcher";
import { findByProps } from "@metro";
import { definePlugin } from "@plugins";
import { anonymizeSettings } from "./storage";
import { anonymizedName } from "./names";
import settings from "./settings";
let restore:(()=>unknown)|undefined;
export default definePlugin({id:"anonymizefilenames",name:"AnonymiseFileNames",version:"2.0.0-rukcord",
    description:"Rename uploads before compression while preserving their file extension.",author:[{name:"Rukcord contributors",id:0n}],settings,
    start(){
        if(restore)return;
        const upload=findByProps("CloudUpload")?.CloudUpload?.prototype;
        if(typeof upload?.reactNativeCompressAndExtractData!=="function")throw new Error("Upload naming hook is unavailable on this Discord version");
        restore=before("reactNativeCompressAndExtractData",upload,function(this:any){
            if(typeof this?.item?.filename!=="string"||!this.item.filename)return;
            this.item={...this.item,filename:anonymizedName(this.item.filename,anonymizeSettings)};
        });
    },stop(){restore?.();restore=undefined;}
});
