import test from 'node:test';
import assert from 'node:assert/strict';
import * as patcher from 'sublimation';
import { componentTarget } from '../src/api/react/componentTarget.ts';
import { warmInChunks, notifySubscribers } from '../src/metro/internals/scheduling.ts';
import { createLazyPlugin, pluginLoadStats } from '../src/plugins/lazy.ts';
import { pluginDescriptor } from '../scripts/build/plugins/manifest.mjs';
import { compile, evaluate, tick } from './runtimeHarness.mjs';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

test('reproduces the reported render-is-not-a-function error and patches a function export correctly',()=>{
    function Messages(){return 'messages'}
    assert.throws(()=>patcher.after('render',Messages,()=>{}),/render is not a function in Function/);
    const module={default:Messages}, target=componentTarget(module);
    assert.equal(target.key,'default');
    const restore=patcher.after(target.key,target.parent,(_,value)=>'background '+value);
    assert.equal(module.default(),'background messages');restore();assert.equal(module.default,Messages);
});
test('component slots support classes, forwardRef, and nested memo wrappers',()=>{
    class Messages{render(){return 'class'}}
    const forward={render:()=>null};
    assert.equal(componentTarget({default:Messages}).parent,Messages.prototype);
    assert.equal(componentTarget({default:forward}).parent,forward);
    const memo={type:()=>null};assert.equal(componentTarget({default:{type:memo}}).parent,memo);
    assert.equal(componentTarget({default:{}}),null);
    const cycle={};cycle.type=cycle;assert.equal(componentTarget({default:cycle}),null);
});
test('a failed module subscriber does not stop other subscribers or remain registered',()=>{
    const calls=[],errors=[],subscriptions=new Map([[1,new Set([()=>{throw Error('hook mismatch')},()=>calls.push('stock continues')])]]);
    assert.doesNotThrow(()=>notifySubscribers(subscriptions,1,e=>errors.push(e)));
    assert.deepEqual(calls,['stock continues']);assert.equal(errors.length,1);assert.equal(subscriptions.has(1),false);
});
test('cache warmup yields within its time budget and can be cancelled',()=>{
    let clock=0;const queue=[],calls=[];
    const cancel=warmInChunks([1,2,3,4,5],id=>{calls.push(id);clock+=3},{schedule:fn=>queue.push(fn),now:()=>clock,report(){},budget:6});
    assert.equal(calls.length,0);queue.shift()();assert.deepEqual(calls,[1,2]);assert.equal(queue.length,1);
    cancel();queue.shift()();assert.deepEqual(calls,[1,2]);
});
test('cache warmup continues after a bad module and observes its batch limit',()=>{
    const queue=[],errors=[],calls=[];
    warmInChunks([1,2,3],id=>{calls.push(id);if(id===1)throw Error('bad module')},{schedule:fn=>queue.push(fn),now:()=>0,report:e=>errors.push(e),batch:2});
    queue.shift()();assert.deepEqual(calls,[1,2]);queue.shift()();assert.deepEqual(calls,[1,2,3]);assert.equal(errors.length,1);
});
const summary={name:'Feature',description:'Optional',version:'1',hasSettings:true,hasStart:true,hasEagerStart:false,devOnly:false,requiresRestart:false};
test('registering and browsing 60 disabled plugins performs zero module evaluations',()=>{
    let calls=0;const before=pluginLoadStats.loaded;
    const plugins=Object.fromEntries(Array.from({length:60},(_,i)=>[String(i),createLazyPlugin(String(i),summary,()=>{calls++;return {start(){},settings(){}}})]));
    Object.entries(plugins).forEach(([id,p])=>{assert.equal(p.id,id);void p.name;void p.description;void p.hasSettings;void p.devOnly;void p.eagerStart;});
    assert.equal(calls,0);assert.equal(pluginLoadStats.loaded,before);
    plugins['2'].start();plugins['2'].start();assert.equal(calls,1);assert.equal(pluginLoadStats.loaded,before+1);
});
test('lazy plugins preserve method this, never load on disabled stop, and reject invalid modules',()=>{
    let calls=0;const p=createLazyPlugin('x',summary,()=>({start(){calls++;assert.equal(this.id,'x')}}));
    assert.equal(p.stop,undefined);p.start();assert.equal(calls,1);
    const invalid=createLazyPlugin('bad',summary,()=>null);assert.throws(()=>invalid.start(),/Invalid plugin/);
});
test('manifest parser reads metadata without executing top-level code and ignores commented placeholders',()=>{
    const s='throw Error("must not run"); export default definePlugin({name:"Test",description:"ok",async start(){},settings:Settings,eagerStart(){},devOnly:true})';
    const d=pluginDescriptor(s,'index.ts','x');assert.equal(d.name,'Test');assert.equal(d.hasStart,true);assert.equal(d.hasEagerStart,true);assert.equal(d.hasSettings,true);assert.equal(d.devOnly,true);
    assert.equal(pluginDescriptor('/* export default definePlugin({}) */','index.ts','empty'),null);
});
const patchCode=await compile('src/api/patcher.ts',{
    'sublimation':'export const before=(...a)=>env.patcher.before(...a);export const after=(...a)=>env.patcher.after(...a);export const instead=(...a)=>env.patcher.instead(...a)',
});
test('deferred hook shape mismatches are contained and cancelled subscriptions are removed',()=>{
    let callback,unsubscribed=0;const {exports:p,errors}=evaluate(patchCode,{});
    const target={[p._patcherDelaySymbol]:cb=>{callback=cb;return()=>unsubscribed++}};
    const stop=p.after('render',target,()=>{});assert.doesNotThrow(()=>callback(function Messages(){}));assert.equal(errors.length,1);
    stop();assert.equal(unsubscribed,1);callback({render(){}});assert.equal(errors.length,1);
});
test('rejected async hook targets are caught rather than becoming unhandled rejections',async()=>{
    const {exports:p,errors}=evaluate(patchCode,{});p.after.await('render',Promise.reject(Error('missing')),()=>{});await tick();assert.equal(errors.length,1);
});
const noticeCode=await compile('src/api/ui/toasts.ts',{
    '@api/assets':'export const findAssetId=()=>0',
    '@api/native/bridge':'export const callBridgeMethod=(...a)=>env.notice(...a)',
    '@rukcord/i18n':'export const Strings={COPIED_TO_CLIPBOARD:"Copied"}',
});
test('Rukcord notices use the native bridge and handle failed delivery',async()=>{
    const {exports:p,errors}=evaluate(noticeCode,{notice:async()=>{throw Error('native failure')},loader:{hasNativeToast:true}});
    p.showToast('message');await tick();assert.equal(errors.length,1);
});
test('native notices send the expected method without invoking Discord toast renderers',async()=>{
    let args;const {exports:p}=evaluate(noticeCode,{notice:async(...a)=>{args=a},loader:{hasNativeToast:true}});
    p.showToast('Copied');await tick();assert.deepEqual(args,['ui.toast','Copied']);
});
test('packaged loader prelude preserves the native icon URL and exposes native notices',async()=>{
    const source=await readFile('../RukcordNative/Sources/payload-base.template.js','utf8');
    const context={__RUKCORD_LOADER__:{iconURL:'file:///bundle/rukcord-icon.png'}};
    vm.runInNewContext(source,context);
    assert.equal(context.__RUKCORD_LOADER__.iconURL,'file:///bundle/rukcord-icon.png');
    assert.equal(context.__RUKCORD_LOADER__.hasNativeToast,true);
});
