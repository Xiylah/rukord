import test from "node:test";
import assert from "node:assert/strict";
import { proxyLazy, getProxyFactory, lazyDestructure } from "../src/lib/utils/lazy.ts";
globalThis.__DEV__ = false;
test("lazy property access follows a replaced export as Rain does", () => {
    let current = { title: "first" };
    const proxy = proxyLazy(() => current);
    assert.equal(proxy.title, "first");
    current = { title: "second" };
    assert.equal(proxy.title, "second");
});
test("lazy component calls follow a replaced component", () => {
    let current = () => "first";
    const proxy = proxyLazy(() => current);
    assert.equal(proxy(), "first");
    current = () => "second";
    assert.equal(proxy(), "second");
});
test("explicit factory resolution is memoized separately from live proxy access", () => {
    let calls = 0;
    const proxy = proxyLazy(() => ({ generation: ++calls }));
    const resolve = getProxyFactory(proxy);
    assert.equal(resolve(), resolve());
    assert.equal(calls, 1);
    assert.equal(proxy.generation, 2);
});
test("failed resolutions remain retryable", () => {
    let calls = 0;
    const proxy = proxyLazy(() => { if (++calls === 1) throw Error("not ready"); return { ready: true }; });
    assert.throws(() => proxy.ready, /not ready/);
    assert.equal(proxy.ready, true);
});
test("lazy destructuring follows replacement of source properties", () => {
    const source = { row: { title: "first" } };
    const { row } = lazyDestructure(() => source);
    assert.equal(row.title, "first");
    source.row = { title: "second" };
    assert.equal(row.title, "second");
});
