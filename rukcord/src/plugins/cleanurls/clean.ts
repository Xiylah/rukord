// SPDX-License-Identifier: MPL-2.0
// Conservative built-in rules. Preserve signed URLs and original query encoding.
import { outsideCode } from "@api/outgoing";
const TRACKING=new Set(["fbclid","gclid","dclid","msclkid","igshid","mc_cid","mc_eid","_hsenc","_hsmi"]);
const SIGNED=/^(?:sig|signature|token|access_token|auth|authorization|expires|hmac|hash|x-amz-.+|x-goog-.+)$/i;
export function cleanUrl(url: string): string {
    const parts=/^(https?:\/\/[^/?#\s]+[^?#\s]*)(?:\?([^#\s]*))?(#.*)?$/i.exec(url);
    if(!parts||!parts[2])return url;
    const parameters=parts[2].split("&");
    const keys=parameters.map(p=>{try{return decodeURIComponent(p.split("=",1)[0].replace(/\+/g," ")).toLowerCase();}catch{return "";}});
    if(keys.some(key=>SIGNED.test(key)))return url;
    const keep=parameters.filter((_,i)=>!keys[i].startsWith("utm_")&&!TRACKING.has(keys[i]));
    return keep.length===parameters.length?url:parts[1]+(keep.length?"?"+keep.join("&"):"")+(parts[3]??"");
}
export function cleanMessage(text: string): string {
    return outsideCode(text,plain=>plain.replace(/https?:\/\/[^\s<>"`]+/gi,match=>{
        const punctuation=/[).,;!?\]]+$/.exec(match)?.[0]??"";
        const raw=punctuation?match.slice(0,-punctuation.length):match;
        return cleanUrl(raw)+punctuation;
    }));
}
