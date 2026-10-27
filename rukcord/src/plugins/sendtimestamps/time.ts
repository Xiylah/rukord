// SPDX-License-Identifier: MPL-2.0
import { outsideCode } from "@api/outgoing";
export const timeStyles=["t","T","d","D","f","F","R"] as const;
export function localInput(date: Date): string {
    const pad=(n: number)=>String(n).padStart(2,"0");
    return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
export function localSeconds(input: string): number|null {
    const m=/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(input.trim());
    if(!m)return null;
    const [year,month,day,hour,minute,second]=m.slice(1).map(n=>Number(n??0));
    if(year<1970||year>2100)return null;
    const date=new Date(year,month-1,day,hour,minute,second);
    if(date.getFullYear()!==year||date.getMonth()!==month-1||date.getDate()!==day||date.getHours()!==hour||date.getMinutes()!==minute||date.getSeconds()!==second)return null;
    return Math.floor(date.getTime()/1000);
}
export function timestamp(input: string, style: string): string|null {
    const seconds=localSeconds(input);
    return seconds!==null&&(timeStyles as readonly string[]).includes(style)?`<t:${seconds}:${style}>`:null;
}
export function expandTimes(text: string): string {
    return outsideCode(text,plain=>plain.replace(/\{\{time:([^{}|]+?)(?:\|([tTdDfFR]))?\}\}/g,
        (whole,input,style)=>timestamp(input,style??"f")??whole));
}
