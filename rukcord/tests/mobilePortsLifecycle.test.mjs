import test from 'node:test';
import assert from 'node:assert/strict';
import {compile,evaluate,tick} from './runtimeHarness.mjs';
const id='123456789012345678';

const copyIds=['copyemojimarkdown','copystickerlinks','copyuserurls','imagefilename','replytimestamp'];
for(const name of copyIds){
    const code=await compile(`src/plugins/${name}/index.ts`,{'@api/ui/mobileAction':'export const installCopyAction=(...args)=>{env.args=args;env.starts++;return()=>env.stops++}'});
    test(`${name} registers one native action and tears down once`,()=>{
        const env={starts:0,stops:0};const plugin=evaluate(code,env).exports.default;
        plugin.start();plugin.start();assert.equal(env.starts,1);assert.equal(env.args[0],`rukcord-${name}`);
        plugin.stop();plugin.stop();assert.equal(env.stops,1);
    });
}
for(const name of ['voicedownload','picturelinks','reverseimagesearch']){
    const code=await compile(`src/plugins/${name}/index.ts`,{'@api/ui/mobileAction':'export const installOpenAction=(...args)=>{env.args=args;env.starts++;return()=>env.stops++}'});
    test(`${name} has one open action with correct third-party confirmation`,()=>{
        const env={starts:0,stops:0};const plugin=evaluate(code,env).exports.default;
        plugin.start();plugin.start();assert.equal(env.starts,1);assert.equal(env.args[3],name==='reverseimagesearch');
        plugin.stop();plugin.stop();assert.equal(env.stops,1);
    });
}
for(const name of ['unindent','silentmessagetoggle']){
    const code=await compile(`src/plugins/${name}/index.ts`,{'@api/outgoing':'export const installOutgoingTransform=(...args)=>{env.args=args;env.starts++;return()=>env.stops++}'});
    test(`${name} installs once and uses the intended send/edit scope`,()=>{
        const env={starts:0,stops:0};const plugin=evaluate(code,env).exports.default;
        plugin.start();plugin.start();assert.equal(env.starts,1);
        if(name==='silentmessagetoggle')assert.equal(env.args[1].edits,false);
        plugin.stop();plugin.stop();assert.equal(env.stops,1);
    });
}
const timeCode=await compile('src/plugins/dontroundmytimestamps/index.ts',{'@metro':'export const findByProps=()=>env.moment'});
test('relative-time rounding restores the pre-plugin formatter',()=>{
    const original=x=>x;let rounding=original;
    const env={moment:{relativeTimeRounding(fn){if(fn)rounding=fn;return rounding}}};
    const plugin=evaluate(timeCode,env).exports.default;plugin.start();assert.equal(rounding(2.9),2);plugin.stop();assert.equal(rounding,original);
});
test('relative-time plugin clearly rejects missing capabilities',()=>{
    const plugin=evaluate(timeCode,{moment:{}}).exports.default;assert.throws(()=>plugin.start(),/unavailable/);plugin.stop();
});
const dotsCode=await compile('src/plugins/notypinganimation/index.ts',{
    '@metro':'export const findByName=()=>env.module',
    '@metro/common':'export const React={createElement:(type,props,children)=>({type,props,children})}',
    'react-native':'export const Text="Text"',
});
test('static typing dots avoid executing the old animation and restore it',()=>{
    let runs=0;const original=()=>{runs++;return 'animation'};const env={module:{default:original}};
    const plugin=evaluate(dotsCode,env).exports.default;plugin.start();assert.equal(env.module.default().children,'•••');assert.equal(runs,0);
    plugin.stop();assert.equal(env.module.default,original);
});
const uploadCode=await compile('src/plugins/anonymizefilenames/index.ts',{
    '@metro':'export const findByProps=()=>env.uploads',
    './storage':'export const anonymizeSettings=env.settings','./settings':'export default null',
});
test('upload naming preserves the input item object and restores its hook',()=>{
    class CloudUpload{reactNativeCompressAndExtractData(){return this.item.filename}}
    const original=CloudUpload.prototype.reactNativeCompressAndExtractData;
    const env={uploads:{CloudUpload},settings:{useCustomName:true,customName:'private'}};
    const plugin=evaluate(uploadCode,env).exports.default;plugin.start();
    const upload=new CloudUpload(),input=Object.freeze({filename:'SPOILER_photo.jpg',uri:'file:///kept'});upload.item=input;
    assert.equal(upload.reactNativeCompressAndExtractData(),'SPOILER_private.jpg');assert.equal(input.filename,'SPOILER_photo.jpg');assert.equal(upload.item.uri,'file:///kept');
    plugin.stop();assert.equal(CloudUpload.prototype.reactNativeCompressAndExtractData,original);
});
const trustCode=await compile('src/plugins/alwaystrust/index.ts',{'@metro':'export const findByStoreName=()=>env.store'});
test('AlwaysTrust restores stock trust decisions on disable',()=>{
    const original=()=>false,env={store:{isTrustedDomain:original}};const plugin=evaluate(trustCode,env).exports.default;
    plugin.start();assert.equal(env.store.isTrustedDomain(),true);plugin.stop();assert.equal(env.store.isTrustedDomain,original);
});
const openCode=await compile('src/api/ui/mobileAction.ts',{
    './messageActions':'export const addMessageAction=x=>{env.action=x;return()=>env.stops++}',
    './toasts':'export const showToast=x=>env.notices.push(x)',
    '@metro/common':'export const clipboard={setString:x=>env.copies.push(x)}',
    'react-native':'export const Alert={alert:(...x)=>env.alerts.push(x)};export const Linking={openURL:x=>{env.opens.push(x);return env.openResult??Promise.resolve()}}',
});
test('reverse-image links are opened only after confirmation and not after disable',()=>{
    const env={alerts:[],opens:[],notices:[],stops:0};const api=evaluate(openCode,env).exports;
    const stop=api.installOpenAction('id','Search',()=> 'https://lens.google.com/example',true);
    env.action.onPress({});assert.equal(env.opens.length,0);env.alerts[0][2][1].onPress();assert.equal(env.opens.length,1);
    env.action.onPress({});stop();env.alerts[1][2][1].onPress();assert.equal(env.opens.length,1);
});
test('failed browser opens are handled without unhandled rejections',async()=>{
    const env={alerts:[],opens:[],notices:[],stops:0,openResult:Promise.reject(Error('no handler'))};
    const api=evaluate(openCode,env).exports,stop=api.installOpenAction('id','Open',()=> 'https://example.com');
    env.action.onPress({});await tick();assert.equal(env.notices[0],'Could not open link');stop();
});
