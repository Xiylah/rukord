import test from "node:test";
import assert from "node:assert/strict";
import { resolveFileUtils, installHooks } from "../src/plugins/bypassuploadlimit/patches/capabilities.ts";

test("Discord 350 upload exports do not require anyFileTooLarge", () => {
    const utils = { maxFileSize() {}, getUploadFileSizeSum() {} };
    const queries = [];
    assert.equal(resolveFileUtils((...keys) => { queries.push(keys); return utils; }), utils);
    assert.deepEqual(queries, [["maxFileSize", "getUploadFileSizeSum"]]);
});
test("upload size lookup supports older export shapes", () => {
    const utils = { maxFileSize() {} };
    assert.equal(resolveFileUtils((...keys) => keys.length === 1 ? utils : undefined), utils);
    assert.throws(() => resolveFileUtils(() => ({ maxFileSize: null })), /unavailable/);
});
test("failed hook installation rolls back in reverse order", () => {
    const active = [];
    const install = n => () => { active.push(n); return () => { assert.equal(active.pop(), n); return true; }; };
    assert.throws(() => installHooks([install(1), install(2), () => { throw Error("read-only export"); }]), /read-only/);
    assert.deepEqual(active, []);
});
test("successful hooks remain installed until stopped", () => {
    let active = false;
    const undo = installHooks([() => { active = true; return () => { active = false; return true; }; }]);
    assert.equal(active, true);
    undo.forEach(fn => fn());
    assert.equal(active, false);
});
