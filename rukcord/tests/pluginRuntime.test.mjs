import test from "node:test";
import assert from "node:assert/strict";
import {compile,evaluate} from "./runtimeHarness.mjs";
const code=await compile("src/plugins/index.ts",{
    "@api/settings":"export const useSettings={getState:()=>env.settings}",
    "@api/storage":"export const createFileStorage=()=>({});export const waitForHydration=async()=>{}",
    "@api/ui/toasts":"export const showToast=x=>env.notices.push(x)",
    "@lib/utils/logger":"export const logger={log(){}}",
    "zustand":"export const create=()=>init=>{let state;const set=update=>{state={...state,...(typeof update==='function'?update(state):update)}};const get=()=>state;state=init(set,get);return {getState:get}}",
    "zustand/middleware":"export const persist=init=>init;export const createJSONStorage=()=>({})",
    "#rukcord-plugins":"export default {}",
});
function fixture(){const env={settings:{safeMode:false},notices:[]};return {env,api:evaluate(code,env).exports};}
test("failed stop persists the disabled choice, records diagnostics, and prevents duplicate hooks",async()=>{
    const {api}=fixture();let starts=0;api.pluginInstances.set("sample",{start(){starts++},stop(){throw Error("failed stop")}});
    await api.startPlugin("sample");await api.startPlugin("sample");assert.equal(starts,1);
    await assert.rejects(api.stopPlugin("sample"),/failed stop/);assert.equal(api.isPluginEnabled("sample"),false);
    const report=api.getPluginRuntimeReport();assert.equal(report.plugins[0].phase,"reload-required");assert.match(report.plugins[0].failure.message,/failed stop/);
    await assert.rejects(api.startPlugin("sample"),/Reload Discord/);assert.equal(starts,1);
});
test("safe mode skips optional plugins and reports their saved enabled choice",async()=>{
    const {api,env}=fixture();env.settings.safeMode=true;let calls=0;
    api.pluginInstances.set("sample",{start(){calls++}});api.usePluginSettings.getState().updatePluginSetting("sample",true);
    await api.startPlugin("sample");assert.equal(calls,0);
    assert.equal(api.getPluginRuntimeReport().safeMode,true);assert.equal(api.getPluginRuntimeReport().plugins[0].phase,"idle");
});
test("successful disable clears old failure and returns the runtime to idle",async()=>{
    const {api}=fixture();api.pluginInstances.set("sample",{start(){},stop(){}});
    await api.startPlugin("sample");api.usePluginSettings.getState().recordFailure("sample",Error("old"));
    await api.stopPlugin("sample");const row=api.getPluginRuntimeReport().plugins[0];assert.equal(row.phase,"idle");assert.equal(row.enabled,false);assert.equal(row.failure,undefined);
});
