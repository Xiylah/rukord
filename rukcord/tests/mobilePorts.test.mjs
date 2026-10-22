import test from 'node:test';
import assert from 'node:assert/strict';
import {compile,evaluate,tick} from './runtimeHarness.mjs';
import * as tools from '../src/api/mobileTools.ts';
import {guardedLifecycle} from '../src/plugins/lifecycle.ts';
import {anonymizedName} from '../src/plugins/anonymizefilenames/names.ts';

const id='123456789012345678';
test('copy utilities validate IDs and protocols and preserve signed attachment URLs',()=>{
    const url='https://cdn.discordapp.com/attachments/1/file.png?ex=a&hm=b';
    assert.deepEqual(tools.attachmentURLs({attachments:[{url},{url},{url:'javascript:alert(1)'}]}),[url]);
    assert.equal(tools.userURL({author:{id}}),`https://discord.com/users/${id}`);
    assert.equal(tools.userURL({author:{id:'not-an-id'}}),null);
    assert.equal(tools.httpURL('https://user:pass@example.com'),null);
    assert.deepEqual(tools.attachmentURLs({flags:0,attachments:[{url}]},true),[]);
    assert.deepEqual(tools.attachmentURLs({flags:8192,attachments:[{url}]},true),[url]);
});
test('stickers preserve their format and reject unsupported types',()=>{
    assert.match(tools.stickerURLs({stickerItems:[{id,format_type:4}]})[0],/media\.discordapp\.net.+\.gif/);
    assert.match(tools.stickerURLs({sticker_items:[{id,format_type:3}]})[0],/\.json/);
    assert.deepEqual(tools.stickerURLs({stickerItems:[{id,format_type:9},{id:'bad',format_type:1}]}),[]);
});
test('emoji and avatar tools do not manufacture missing data',()=>{
    const emoji=`<a:party:${id}>`;
    assert.deepEqual(tools.emojiMarkdown({content:emoji+' '+emoji}),[emoji]);
    assert.equal(tools.avatarURL({author:{id,avatar:'a_'+'a'.repeat(32)}}),`https://cdn.discordapp.com/avatars/${id}/a_${'a'.repeat(32)}.gif?size=1024`);
    assert.equal(tools.avatarURL({author:{id,avatar:'../x'}}),null);
});
test('timestamps support native date values, snowflake fallback, and missing data',()=>{
    assert.equal(tools.exactTimestamp({timestamp:'2026-10-21T10:00:00Z'}),'2026-10-21T10:00:00.000Z');
    assert.equal(tools.exactTimestamp({}),null);
    assert.equal(tools.exactTimestamp({id}),new Date(Number((BigInt(id)>>22n)+1420070400000n)).toISOString());
});
test('unindent handles common whitespace, tabs, empty lines and leaves prose/inline code intact',()=>{
    assert.equal(tools.unindentCode('before\n```js\n    one\n      two\n\n```\nafter'),'before\n```js\none\n  two\n\n```\nafter');
    assert.equal(tools.unindentCode('``x`` text'),'``x`` text');
    assert.equal(tools.unindentCode('```\n\tone\n\ttwo\n```'),'```\none\ntwo\n```');
});
test('silent messages do not duplicate the directive or alter attachment-only blank text',()=>{
    assert.equal(tools.silentContent('hello'),'@silent hello');
    assert.equal(tools.silentContent('@silent hello'),'@silent hello');
    assert.equal(tools.silentContent('  '),'  ');
});
test('TextReplace retains legacy rules, conditions and invalid-regex fail-open behavior',()=>{
    const rules=Object.freeze([Object.freeze({match:'one',replace:'two',regex:false}),Object.freeze({match:'[',replace:'bad',regex:true}),Object.freeze({find:'two',replace:'three',onlyIfIncludes:'hello'})]);
    assert.equal(tools.textRules('one',rules),'two');
    assert.equal(tools.textRules('hello one',rules),'hello three');
    assert.equal(tools.textRules('abc',[{match:'a',replace:'x'.repeat(50001)}]),'abc');
});
test('anonymized filenames preserve extensions and spoiler behavior while sanitizing paths',()=>{
    assert.equal(anonymizedName('SPOILER_cat.png',{useCustomName:true,customName:'safe.jpg'}),'SPOILER_safe.png');
    assert.equal(anonymizedName('cat.png',{useCustomName:true,customName:'folder/secret'}),'folder_secret.png');
    assert.notEqual(anonymizedName('a.txt',{}),anonymizedName('a.txt',{}));
});
test('lifecycle failure tears down partial hooks, records the original error and rejects',async()=>{
    const calls=[],failure=Error('missing hook');
    await assert.rejects(()=>guardedLifecycle({start(){calls.push('start');throw failure},stop(){calls.push('stop')}},'start',{
        success(){calls.push('success')},failure(e){assert.equal(e,failure);calls.push('failure')}}),/missing hook/);
    assert.deepEqual(calls,['start','stop','failure']);
});
test('lifecycle cleanup failure does not replace the startup error',async()=>{
    const old=console.error;console.error=()=>{};
    try{await assert.rejects(()=>guardedLifecycle({start(){throw Error('original')},stop(){throw Error('cleanup')}},'start',{success(){},failure(){}}),/original/);}
    finally{console.error=old;}
});

const textCode=await compile('src/plugins/textreplace/index.ts',{
    '@api/outgoing':'export const installOutgoingTransform=(fn)=>env.install(fn)',
    './storage':'export const useTextReplaceSettings={getState:()=>env.settings}', './settings':'export default null',
});
test('replacement TextReplace installs once and reads live rule settings',()=>{
    let transform,installs=0,stops=0;const env={settings:{rules:[{match:'hi',replace:'hello'}]},install(fn){installs++;transform=fn;return()=>stops++}};
    const plugin=evaluate(textCode,env).exports.default;plugin.start();plugin.start();assert.equal(installs,1);
    assert.equal(transform('hi'),'hello');env.settings.rules=[{match:'hi',replace:'bye'}];assert.equal(transform('hi'),'bye');
    plugin.stop();plugin.stop();assert.equal(stops,1);
});
const imageCode=await compile('src/plugins/showimagelinks/index.ts',{'@metro':'export const findByName=()=>env.RowManager'});
test('ImageLink transforms frozen native rows without changing cached data',()=>{
    const reveal=evaluate(imageCode,{}).exports.revealImageLinks;
    const original=Object.freeze({message:Object.freeze({content:Object.freeze([]),embeds:Object.freeze([{type:'image',url:'https://example.com/image.png'}])})});
    const next=reveal({rowType:1},original);assert.equal(next.message.content[0].target,'https://example.com/image.png');
    assert.equal(original.message.content.length,0);assert.equal(reveal({rowType:2},original),undefined);
});
const hideCode=await compile('src/plugins/hideattachments/index.ts',{'@metro':'export const findByName=()=>env.RowManager'});
test('HideAttachments changes only the rendered attachment list',()=>{
    const hide=evaluate(hideCode,{}).exports.withoutAttachments;
    const attachments=Object.freeze([{url:'https://example.com/a'}]),message=Object.freeze({attachments,content:'kept'}),original=Object.freeze({message});
    const result=hide(original);assert.equal(result.message.content,'kept');assert.equal(result.message.attachments.length,0);assert.equal(original.message.attachments.length,1);
});
const fileCode=await compile('src/plugins/copyfilecontents/index.ts',{
    '@api/ui/messageActions':'export const addMessageAction=x=>{env.action=x;return()=>{}}',
    '@api/ui/toasts':'export const showToast=x=>env.notices.push(x)',
    '@metro/common':'export const clipboard={setString:x=>env.copies.push(x)}',
});
test('CopyFileContents accepts only bounded text files on Discord media hosts',()=>{
    const check=evaluate(fileCode,{}).exports.textAttachment;
    const good={filename:'notes.txt',size:12,url:'https://cdn.discordapp.com/attachments/1/notes.txt?sig=x'};
    assert.equal(check({attachments:[good]}),good);
    for(const patch of [{size:128*1024+1},{size:-1},{filename:'image.png'},{url:'https://evil.example/notes.txt'},{url:'http://cdn.discordapp.com/notes.txt'}])
        assert.equal(check({attachments:[{...good,...patch}]}),undefined);
});
const embedCode=await compile('src/plugins/unsuppressembeds/index.ts',{
    '@api/ui/messageActions':'export const addMessageAction=x=>{env.action=x;return()=>env.stops++}',
    '@api/ui/alerts':'export const showConfirmationAlert=x=>env.alerts.push(x)',
    '@api/ui/toasts':'export const showToast=x=>env.notices.push(x)',
    '@metro':'export const findByProps=()=>env.api',
    '@metro/common/stores':'export const UserStore={getCurrentUser:()=>env.user}',
});
function embeds(){const env={user:{id},alerts:[],notices:[],stops:0,requests:[],api:{async patch(request){env.requests.push(request)}}};
    const plugin=evaluate(embedCode,env).exports.default;plugin.start();return{env,plugin,message:{id:'223456789012345678',channel_id:'323456789012345678',author:{id},flags:68}};}
test('UnsuppressEmbeds requires ownership and confirmation and preserves unrelated flags',async()=>{
    const f=embeds();assert.equal(f.env.action.visible({...f.message,author:{id:'423456789012345678'}}),false);
    f.env.action.onPress(f.message);assert.equal(f.env.requests.length,0);await f.env.alerts[0].onConfirm();
    assert.equal(f.env.requests[0].body.flags,64);assert.deepEqual(f.env.notices,['Embeds restored']);f.plugin.stop();
});
test('UnsuppressEmbeds cancels stale confirmation after account changes or disable',async()=>{
    const f=embeds();f.env.action.onPress(f.message);f.env.user={id:'423456789012345678'};await f.env.alerts[0].onConfirm();assert.equal(f.env.requests.length,0);
    f.env.user={id};f.env.action.onPress(f.message);f.plugin.stop();await f.env.alerts[1].onConfirm();assert.equal(f.env.requests.length,0);
});
