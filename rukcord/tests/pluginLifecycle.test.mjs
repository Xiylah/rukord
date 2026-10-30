import test from "node:test";
import assert from "node:assert/strict";
import { createLifecycleGuard } from "../src/plugins/lifecycle.ts";

const callbacks = () => ({success(){},failure(){}});
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject};}

test("duplicate starts install once and preserve the plugin receiver",async()=>{
    const guard=createLifecycleGuard(),plugin={calls:0,start(){this.calls++}};
    await Promise.all([guard.start(plugin,"start",callbacks()),guard.start(plugin,"start",callbacks())]);
    assert.equal(plugin.calls,1);assert.equal(guard.status(plugin).phase,"active");
});
test("eager and regular starts run once each, and disabling permits a new start",async()=>{
    const guard=createLifecycleGuard(),calls=[],plugin={eagerStart(){calls.push("eager")},start(){calls.push("start")},stop(){calls.push("stop")}};
    await guard.start(plugin,"eagerStart",callbacks());await guard.start(plugin,"start",callbacks());
    await Promise.all([guard.stop(plugin),guard.stop(plugin)]);await guard.start(plugin,"start",callbacks());
    assert.deepEqual(calls,["eager","start","stop","start"]);
});
test("disable waits for an in-flight start before removing its hooks",async()=>{
    const guard=createLifecycleGuard(),wait=deferred(),calls=[],plugin={async start(){calls.push("begin");await wait.promise;calls.push("installed")},stop(){calls.push("removed")}};
    const start=guard.start(plugin,"start",callbacks()),stop=guard.stop(plugin);
    await Promise.resolve();assert.deepEqual(calls,["begin"]);
    wait.resolve();await Promise.all([start,stop]);assert.deepEqual(calls,["begin","installed","removed"]);
});
test("different plugins do not share a lifecycle queue",async()=>{
    const guard=createLifecycleGuard(),wait=deferred(),a={start:()=>wait.promise},b={start(){}};
    const pending=guard.start(a,"start",callbacks());await guard.start(b,"start",callbacks());
    assert.equal(guard.status(a).phase,"start");assert.equal(guard.status(b).phase,"active");wait.resolve();await pending;
});
test("startup rollback preserves the original failure and allows retry after successful cleanup",async()=>{
    const guard=createLifecycleGuard(),original=Error("missing export");let fail=true,stops=0,recorded;
    const plugin={start(){if(fail)throw original},stop(){stops++}};
    await assert.rejects(guard.start(plugin,"start",{success(){},failure(e){recorded=e}}),e=>e===original);
    assert.equal(recorded,original);assert.equal(stops,1);assert.equal(guard.status(plugin).phase,"failed");
    fail=false;await guard.start(plugin,"start",callbacks());assert.equal(guard.status(plugin).error,undefined);
});
test("hung rollback releases the lifecycle wait and requires reload",async()=>{
    const guard=createLifecycleGuard(10),original=Error("startup"),plugin={start(){throw original},stop(){return new Promise(()=>{})}};
    const old=console.error;console.error=()=>{};
    try {await assert.rejects(guard.start(plugin,"start",callbacks()),e=>e===original);}finally{console.error=old;}
    assert.equal(guard.status(plugin).phase,"reload-required");assert.match(guard.status(plugin).cleanupError,/timed out/);
    await assert.rejects(guard.start(plugin,"start",callbacks()),/Reload Discord/);
});
test("late cleanup completion cannot make a timed-out plugin startable again",async()=>{
    const guard=createLifecycleGuard(10),wait=deferred(),plugin={start(){},stop:()=>wait.promise};
    await guard.start(plugin,"start",callbacks());await assert.rejects(guard.stop(plugin),/timed out/);
    wait.resolve();await Promise.resolve();await Promise.resolve();
    await assert.rejects(guard.start(plugin,"start",callbacks()),/Reload Discord/);
});
test("cleanup exceptions block re-enabling and do not run teardown twice",async()=>{
    const guard=createLifecycleGuard();let stops=0;const plugin={start(){},stop(){stops++;throw Error("teardown")}};
    await guard.start(plugin,"start",callbacks());await assert.rejects(guard.stop(plugin),/teardown/);
    await assert.rejects(guard.stop(plugin),/Reload Discord/);assert.equal(stops,1);
});
test("late cleanup rejection is handled after a timeout",async()=>{
    const guard=createLifecycleGuard(10),wait=deferred(),plugin={start(){},stop:()=>wait.promise};
    await guard.start(plugin,"start",callbacks());await assert.rejects(guard.stop(plugin),/timed out/);
    wait.reject(Error("late"));await new Promise(resolve=>setTimeout(resolve,0));
    assert.equal(guard.status(plugin).phase,"reload-required");
});
test("diagnostic snapshots cannot mutate lifecycle state",async()=>{
    const guard=createLifecycleGuard(),plugin={start(){}};await guard.start(plugin,"start",callbacks());
    guard.status(plugin).completed.length=0;assert.deepEqual(guard.status(plugin).completed,["start"]);
});
