import test from "node:test";
import assert from "node:assert/strict";
import { compile, evaluate } from "./runtimeHarness.mjs";
const { createRetention } = evaluate(await compile("src/plugins/messagelogger/retention.ts"), {}).exports;
const message = (id, channel_id = "c") => ({ id, channel_id, content: "retained", was_deleted: true });
test("retained deletions stay within the fetched timeline window and channel", () => {
    const logs = createRetention();
    for (const id of ["50","150","250","350"]) logs.set(message(id));
    logs.set(message("175","other"));
    assert.deepEqual(logs.page("c", [message("300"),message("100")], false).map(m=>m.id), ["300","250","150","100"]);
    assert.deepEqual(logs.page("c", [message("300"),message("100")], true).map(m=>m.id), ["350","300","250","150","100"]);
});
test("ascending timeline pages keep their order and duplicate message IDs are not inserted", () => {
    const logs = createRetention();logs.set(message("150"));
    const result=logs.page("c",[message("100"),message("150"),message("300")],false);
    assert.deepEqual(result.map(m=>m.id),["100","150","300"]);
});
test("retention is bounded and explicit clearing removes the saved snapshot", () => {
    const logs = createRetention(2);
    logs.set(message("100"));logs.set(message("200"));logs.set(message("300"));
    assert.equal(logs.get("c","100"),undefined);
    logs.remove("c","200");
    assert.equal(logs.get("c","200"),undefined);
    assert.equal(logs.values().length,1);
});

test("a newer server edit after reconnect remains visible alongside the retained history", () => {
    const logs = createRetention();
    logs.set({id:"200",channel_id:"c",content:"old history\nsecond",_rkCurrentContent:"second",_rkHistory:[{content:"first",timestamp:"then"}]});
    const updated=logs.page("c",[{id:"200",channel_id:"c",content:"third"}],true)[0];
    assert.match(updated.content,/first/);assert.match(updated.content,/second/);assert.match(updated.content,/third/);
    assert.equal(logs.get("c","200")._rkCurrentContent,"third");
});
