import test from "node:test";
import assert from "node:assert/strict";
import { compile, evaluate } from "./runtimeHarness.mjs";
const code = await compile("src/metro/internals/caches.ts", {
    "@api/native/fs": "export const fileExists=async()=>env.cache!==undefined;export const readFile=async()=>JSON.stringify(env.cache);export const writeFile=async()=>{}",
    "@api/native/modules": "globalThis.window=env.window;export const NativeClientInfoModule={getConstants:()=>({Build:'350'})}",
    "es-toolkit": "export const debounce=fn=>fn",
    "./modules": "export const requireModule=id=>env.visited.push(id)"
});
const wait = () => new Promise(resolve => setTimeout(resolve, 40));
function setup(cache) {
    const env = { visited: [], window: { modules: Object.fromEntries(Array.from({length:300},(_,i)=>[i,{}])) }, cache };
    return { env, api: evaluate(code, env).exports };
}
test("cold startup discovers all module IDs in Rain's scheduled pass", async () => {
    const { env, api } = setup();
    await api.initMetroCache();
    assert.equal(api.getMetroCache()._v, 3);
    assert.equal(env.visited.length, 0);
    await wait();
    assert.deepEqual(env.visited, Array.from({length:300},(_,i)=>i));
});
test("the previous experimental cache is invalidated, while a matching new cache skips warmup", async () => {
    const previous = setup({_v:2,_buildNumber:'350',_modulesCount:300,flagsIndex:{},findIndex:{},polyfillIndex:{}});
    await previous.api.initMetroCache();
    assert.equal(previous.api.getMetroCache()._v, 3);
    await wait();
    assert.equal(previous.env.visited.length, 300);
    const good = {_v:3,_buildNumber:'350',_modulesCount:300,flagsIndex:{},findIndex:{},polyfillIndex:{}};
    const current = setup(good);
    await current.api.initMetroCache();
    await wait();
    assert.equal(current.env.visited.length, 0);
    assert.equal(current.api.getMetroCache()._v, 3);
});
