import test from 'node:test';
import assert from 'node:assert/strict';
import { compile, evaluate } from './runtimeHarness.mjs';
const mocks={'@metro/wrappers':'export const findByProps=()=>env.messages'};
const clean=evaluate(await compile('src/plugins/cleanurls/clean.ts',mocks),{}).exports;
const time=evaluate(await compile('src/plugins/sendtimestamps/time.ts',mocks),{}).exports;
const hooks=await compile('src/api/outgoing.ts',mocks);
test('ClearURLs removes common tracking keys while preserving query order/encoding and anchors',()=>{
    assert.equal(clean.cleanUrl('https://example.com/a?q=a%20b&utm_source=x&fbclid=y#part'),'https://example.com/a?q=a%20b#part');
    assert.equal(clean.cleanUrl('https://example.com/?utm_medium=x'),'https://example.com/');
    assert.equal(clean.cleanUrl('https://example.com/?q=keep'),'https://example.com/?q=keep');
});
test('signed links and code spans/fences are untouched',()=>{
    const signed='https://example.com/?utm_source=x&X-Amz-Signature=abc';assert.equal(clean.cleanUrl(signed),signed);
    const code='`https://example.com/?utm_source=x`';assert.equal(clean.cleanMessage(code),code);
    const fence='```\nhttps://example.com/?utm_source=x';assert.equal(clean.cleanMessage(fence),fence);
    assert.equal(clean.cleanMessage('See https://example.com/?utm_source=x).'),'See https://example.com/).');
});
test('timestamp parser validates real calendar dates and supported formats',()=>{
    const seconds=time.localSeconds('2026-10-21 20:15');assert.equal(typeof seconds,'number');
    assert.equal(time.timestamp('2026-10-21 20:15','R'),`<t:${seconds}:R>`);
    for(const input of ['2026-02-30 10:00','2026-13-01 10:00','2026-01-01 25:00','bad'])assert.equal(time.localSeconds(input),null);
    assert.equal(time.timestamp('2026-10-21 20:15','bad'),null);
});
test('timestamp shortcuts expand explicitly and leave code/invalid dates intact',()=>{
    const token='{{time:2026-10-21 20:15|R}}',expected=time.timestamp('2026-10-21 20:15','R');
    assert.equal(time.expandTimes('Meet '+token),'Meet '+expected);
    assert.equal(time.expandTimes('`'+token+'`'),'`'+token+'`');
    assert.equal(time.expandTimes('{{time:bad|R}}'),'{{time:bad|R}}');
});
test('outgoing hooks transform sends/edits without changing cached drafts and cleanly stop',()=>{
    const calls=[],messages={sendMessage:(...a)=>calls.push(a),editMessage:(...a)=>calls.push(a),startEditMessage(){}};
    const api=evaluate(hooks,{messages}).exports, original=messages.sendMessage;
    const stop=api.installOutgoingTransform(text=>text+'!'),draft={content:'hello',other:42};
    messages.sendMessage('c',draft);messages.editMessage('c','m',draft);
    assert.equal(calls[0][1].content,'hello!');assert.equal(calls[1][2].content,'hello!');assert.equal(draft.content,'hello');
    stop();stop();assert.equal(messages.sendMessage,original);
});
test('failed message transforms pass original arguments through',()=>{
    let received;const messages={sendMessage:(c,m)=>received=m,editMessage(){},startEditMessage(){}};
    const api=evaluate(hooks,{messages}).exports,stop=api.installOutgoingTransform(()=>{throw Error('bad rule')});
    const draft={content:'hello'};messages.sendMessage('c',draft);assert.equal(received,draft);stop();
});

test('send-only transforms never prefix edited messages',()=>{
    const calls=[],messages={sendMessage:(...a)=>calls.push(a),editMessage:(...a)=>calls.push(a),startEditMessage(){}};
    const api=evaluate(hooks,{messages}).exports,stop=api.installOutgoingTransform(text=>'@silent '+text,{edits:false});
    const draft=Object.freeze({content:'hello'});messages.sendMessage('c',draft);messages.editMessage('c','m',draft);
    assert.equal(calls[0][1].content,'@silent hello');assert.equal(calls[1][2],draft);stop();
});
