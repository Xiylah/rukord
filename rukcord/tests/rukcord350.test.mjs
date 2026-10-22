import assert from 'node:assert/strict';
import test from 'node:test';
import { invokeRukcordBridge } from '../src/api/native/bridge-call.ts';
import { isTargetDiscord } from '../src/rukcord/compatibility.ts';

const noLegacy = () => { throw new Error('Legacy transport should not be used'); };
test('JSI async is preferred and receives the native envelope', async () => {
    let received;
    const host = {
        __RUKCORD_BRIDGE_CALL_ASYNC__: async p => { received = p; return { result: 42 }; },
        __RUKCORD_BRIDGE_CALL_SYNC__: noLegacy,
    };
    assert.equal(await invokeRukcordBridge(host, noLegacy, 'example', ['a']), 42);
    assert.deepEqual(received, { rukcord: { method: 'example', args: ['a'] } });
});
test('sync JSI is supported', async () => {
    assert.equal(await invokeRukcordBridge({ __RUKCORD_BRIDGE_CALL_SYNC__: () => ({ result: null }) }, noLegacy, 'x', []), null);
});
test('older loaders can still use FileReader', async () => {
    assert.equal(await invokeRukcordBridge({}, async () => ({ result: false }), 'x', []), false);
});
test('native errors propagate without retrying a mutating operation', async () => {
    await assert.rejects(invokeRukcordBridge({ __RUKCORD_BRIDGE_CALL_ASYNC__: () => { throw new Error('failed'); } }, noLegacy, 'x', []), /failed/);
    await assert.rejects(invokeRukcordBridge({ __RUKCORD_BRIDGE_CALL_ASYNC__: () => ({ error: 'denied' }) }, noLegacy, 'x', []), /denied/);
});
test('malformed native responses fail explicitly', async () => {
    for (const response of [null, undefined, 42, {}, 'bad']) {
        await assert.rejects(invokeRukcordBridge({ __RUKCORD_BRIDGE_CALL_SYNC__: () => response }, noLegacy, 'x', []));
    }
});
test('only the requested iOS release bypasses the version warning', () => {
    assert.equal(isTargetDiscord('ios', '350.0'), true);
    assert.equal(isTargetDiscord('ios', '349.0'), true);
    assert.equal(isTargetDiscord('ios', '350.0.0'), true);
    for (const v of ['350.1', '351.0', '348.0', '350.0-beta', '', null, 350]) {
        assert.equal(isTargetDiscord('ios', v), false);
    }
    assert.equal(isTargetDiscord('android', '350.0'), false);
});
