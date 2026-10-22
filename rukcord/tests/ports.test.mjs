import test from 'node:test';
import assert from 'node:assert/strict';
import { serializeRaw } from '../src/plugins/viewraw/serialize.ts';
import { editMessage, shouldLog, retainAttachments } from '../src/plugins/messagelogger/model.ts';
import { shouldMention } from '../src/plugins/noreplymention/policy.ts';
import { compile, evaluate } from './runtimeHarness.mjs';

test('raw export redacts recursively, sorts keys, and preserves input',()=>{
    const input={z:1,a:{phone:'private',email:'hidden',accessToken:'secret',name:'Ruk'},editHistory:['old'],attachments:[{id:'a',deleted:true}],_rkCurrentContent:'local'};
    const before=JSON.stringify(input), data=JSON.parse(serializeRaw(input));
    assert.deepEqual(Object.keys(data),['a','attachments','z']);
    assert.deepEqual(data.a,{name:'Ruk'});
    assert.deepEqual(data.attachments,[{id:'a'}]);
    assert.equal(JSON.stringify(input),before);
});
test('raw export supports disabling redaction and missing authors',()=>{
    assert.equal(JSON.parse(serializeRaw({author:{email:'e'}},{sortKeys:false,stripSensitiveData:false})).author.email,'e');
    assert.equal(JSON.parse(serializeRaw({id:'m'})).id,'m');
});
test('raw data shows original current content rather than inline logger markup',()=>{
    assert.equal(JSON.parse(serializeRaw({content:'[deleted] inline history',_rkCurrentContent:'current'})).content,'current');
});
test('raw export bounds cycles, huge strings, getters, and bigint',()=>{
    const value={id:42n,text:'x'.repeat(200000)}; value.self=value;
    Object.defineProperty(value,'bad',{enumerable:true,get(){throw Error('getter')}});
    const text=serializeRaw(value), data=JSON.parse(text);
    assert(text.length<160000); assert.equal(data.id,'42'); assert.equal(data.self,'[Circular]'); assert.equal(data.bad,'[Unreadable]');
});
test('ignore lists match complete IDs and support servers/categories',()=>{
    const m={id:'m',author:{id:'123'},channel_id:'c'};
    assert.equal(shouldLog(m,{ignoreLists:{user:'1234'}},'delete'),true);
    assert.equal(shouldLog(m,{ignoreLists:{user:'99,123'}},'delete'),false);
    assert.equal(shouldLog(m,{ignoreLists:{guild:'g'}},'delete',undefined,{guild_id:'g'}),false);
    assert.equal(shouldLog(m,{ignoreLists:{channel:'category'}},'delete',undefined,{parent_id:'category'}),false);
});
test('ephemeral messages and configured self/bot filters stay excluded',()=>{
    const m={id:'m',flags:64,author:{id:'self'}};
    assert.equal(shouldLog(m,{},'delete'),false);
    assert.equal(shouldLog({...m,flags:0},{filters:{ignoreSelf:true}},'delete','self'),false);
    assert.equal(shouldLog({...m,flags:0},{filters:{ignoreSelfEdits:true}},'delete','self'),true);
    assert.equal(shouldLog({...m,flags:0,author:{bot:true}},{filters:{ignoreBots:true}},'edit'),false);
});
test('edit history preserves latest content and stays bounded across repeated edits',()=>{
    let m={id:'m',content:'first'};
    for(let i=0;i<80;i++) m={...m,...editMessage(m,{id:'m',content:'current '+i+'x'.repeat(1000)},{},'now')};
    assert(m.content.endsWith('current 79'+'x'.repeat(1000)));
    assert(m.content.length<=24000); assert(m._rkHistory.length<=50);
    assert(m._rkHistory.reduce((n,e)=>n+e.content.length,0)<=24000);
});
test('attachment-only edits preserve removed attachments without mutating originals',()=>{
    const previous=[{id:'old',url:'a'},{id:'keep',url:'b'}], incoming=[{id:'keep',url:'b'}];
    const result=retainAttachments(previous,incoming,true);
    assert.equal(result[0]._rkDeleted,true); assert.equal(previous[0]._rkDeleted,undefined);
    assert.equal(retainAttachments(previous,undefined,true),undefined);
    assert.equal(retainAttachments(previous,incoming,false),incoming);
});
test('inline history can be disabled and partial updates are left partial',()=>{
    const edit=editMessage({content:'old'},{content:'new'},{inlineEdits:false},'now');
    assert.equal(edit.content,'new'); assert.equal(edit._rkHistory[0].content,'old');
    assert.deepEqual(editMessage({content:'old'},{id:'m',pinned:true},{},'now'),{id:'m',pinned:true});
});
test('reply defaults and user/role exemptions match exact IDs',()=>{
    assert.equal(shouldMention('123',[],{}),false);
    assert.equal(shouldMention('123',[],{userList:'1234'}),false);
    assert.equal(shouldMention('123',[],{userList:'99, 123'}),true);
    assert.equal(shouldMention('123',['role'],{roleList:'role'}),true);
    assert.equal(shouldMention('123',['role'],{roleList:'role',shouldPingListed:false}),false);
});

const typingCode=await compile('src/plugins/silenttyping/index.ts',{
    '@metro/wrappers':'export const findByProps=()=>env.typing',
    './storage':'export const useTypingSettings={getState:()=>env.settings}',
});
test('SilentTyping toggles live and restores original behavior on disable',()=>{
    const sent=[], env={settings:{isEnabled:true},typing:{startTyping:(...a)=>{sent.push(a);return 'sent'},stopTyping:()=>{sent.push('stop')}}};
    const original=env.typing.startTyping, p=evaluate(typingCode,env).exports.default;
    p.start(); p.start(); env.typing.startTyping('a'); assert.equal(sent.length,0);
    env.typing.stopTyping(); assert.equal(sent[0],'stop');
    env.settings.isEnabled=false; assert.equal(env.typing.startTyping('b'),'sent');
    p.stop(); assert.equal(env.typing.startTyping,original); p.start(); p.stop(); assert.equal(env.typing.startTyping,original);
});
test('SilentTyping fails explicitly when the native capability is missing',()=>{
    const p=evaluate(typingCode,{typing:null,settings:{}}).exports.default;
    assert.throws(()=>p.start(),/unavailable/); p.stop();
});

const replyCode=await compile('src/plugins/noreplymention/index.ts',{
    '@metro':'export const findByProps=()=>env.replies',
    '@metro/common/stores':'export const GuildMemberStore={getMember:(...a)=>env.member(...a)}',
    './storage':'export const useReplySettings={getState:()=>env.settings}',
});
test('NoReplyMention patches native reply defaults, honors roles, preserves input and restores on disable',()=>{
    const received=[], env={settings:{roleList:'allowed'},member:()=>({roles:['allowed']}),replies:{createPendingReply:r=>received.push(r)}};
    const original=env.replies.createPendingReply, p=evaluate(replyCode,env).exports.default;
    const input={channel:{guild_id:'g'},message:{author:{id:'u'}},shouldMention:true};
    p.start();p.start();env.replies.createPendingReply({...input,channel:{}}); assert.equal(received.at(-1).shouldMention,false);
    env.replies.createPendingReply(input); assert.equal(received.at(-1).shouldMention,true); assert.equal(input.shouldMention,true);
    p.stop();assert.equal(env.replies.createPendingReply,original);
});
test('reply lookup failures leave Discord input unchanged',()=>{
    let received; const env={settings:{},member:()=>{throw Error('unavailable')},replies:{createPendingReply:r=>received=r}};
    const p=evaluate(replyCode,env).exports.default; const input={channel:{guild_id:'g'},message:{author:{id:'u'}},shouldMention:true};
    p.start();env.replies.createPendingReply(input);assert.equal(received,input);p.stop();
});
