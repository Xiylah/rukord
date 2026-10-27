// SPDX-License-Identifier: MPL-2.0
const units:Record<string,number>={d:86400000,h:3600000,m:60000,s:1000,ms:1};
export function parseDuration(input:string):number|null{
    const text=input.trim().toLowerCase();
    if(!text||text.length>120)return null;
    if(/^\d+(?:\.\d+)?$/.test(text)){
        const value=Math.round(Number(text));return Number.isSafeInteger(value)?value:null;
    }
    const token=/(\d+(?:\.\d+)?)\s*(ms|d|h|m|s)/g;
    let total=0,end=0,match:RegExpExecArray|null;
    while((match=token.exec(text))){
        if(text.slice(end,match.index).trim())return null;
        total+=Number(match[1])*units[match[2]];end=token.lastIndex;
    }
    if(!end||text.slice(end).trim()||!Number.isSafeInteger(Math.round(total)))return null;
    return Math.round(total);
}
export function durationInput(ms:number):string{
    if(!Number.isFinite(ms))return "";
    let rest=Math.max(0,Math.round(ms));const parts:string[]=[];
    for(const unit of ["d","h","m","s","ms"]){const value=Math.floor(rest/units[unit]);if(value){parts.push(`${value}${unit}`);rest-=value*units[unit];}}
    return parts.join(" ")||"0ms";
}
export function timestampEdit(input:string,kind:"start"|"end",now:number):{valid:true;value:number|undefined}|{valid:false;error:string}{
    if(!input.trim())return {valid:true,value:undefined};
    const duration=parseDuration(input);
    if(duration===null)return {valid:false,error:"Use a duration such as 30m, 1h 30m, or 500ms."};
    const value=kind==="start"?now-duration:now+duration;
    if(!Number.isSafeInteger(value)||value<0||value>8.64e15)return {valid:false,error:"That time is outside the supported date range."};
    return {valid:true,value};
}
