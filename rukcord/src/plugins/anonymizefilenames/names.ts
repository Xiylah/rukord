// SPDX-License-Identifier: MPL-2.0
let sequence=0;
export function anonymizedName(original: string, settings: {useCustomName?:boolean; customName?:string}): string {
    const extension=/\.[A-Za-z0-9]{1,12}$/.exec(original)?.[0]??"";
    const custom=String(settings.customName??"").replace(/[\x00-\x1f\x7f/\\:]/g,"_").trim().slice(0,100);
    const base=settings.useCustomName&&custom ? custom.replace(/\.[A-Za-z0-9]{1,12}$/,"")
        : `upload-${Date.now().toString(36)}-${(++sequence).toString(36)}-${Math.random().toString(36).slice(2,8)}`;
    return (original.startsWith("SPOILER_")&&!base.startsWith("SPOILER_")?"SPOILER_":"")+base+extension;
}
