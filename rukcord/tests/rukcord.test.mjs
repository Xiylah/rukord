import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { build } from 'esbuild';

// Exercise the actual storage wrappers against a native file-module fixture.
// Reading/writing/removing Rukcord settings must never address the original framework's directory.
const result = await build({
    entryPoints: ['src/api/native/fs.ts'], bundle: true, platform: 'node',
    format: 'cjs', write: false,
    plugins: [{ name: 'native-fixture', setup(builder) {
        builder.onResolve({ filter: /^\.\/(loader|modules)$/ }, args => ({ path: args.path, namespace: 'fixture' }));
        builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({
            contents: args.path === './loader'
                ? 'export const isRukcordLoader=()=>true; export const isPyonLoader=()=>false;'
                : 'export const NativeFileModule=globalThis.native;', loader: 'js',
        }));
    } }],
});

test('Rukcord filesystem operations stay isolated from the original framework', async () => {
    const calls = [], files = new Map([['/docs/rain/settings.json', 'existing upstream settings']]);
    const native = {
        getConstants: () => ({ DocumentsDirPath: '/docs' }),
        fileExists: async path => { calls.push(path); return files.has(path); },
        writeFile: async (kind, path, data) => { calls.push(path); files.set('/docs/' + path, data); },
        readFile: async path => { calls.push(path); return files.get(path); },
        removeFile: async (kind, path) => { calls.push(path); files.delete('/docs/' + path); },
        clearFolder: async (kind, path) => { calls.push(path); },
    };
    const context = { native, module: { exports: {} } };
    vm.runInNewContext(result.outputFiles[0].text, context);
    const fs = context.module.exports;
    assert.equal(await fs.fileExists('settings.json'), false);
    await fs.writeFile('settings.json', '{"state":{"safeMode":true},"version":0}');
    assert.equal(await fs.fileExists('settings.json'), true);
    assert.match(await fs.readFile('settings.json'), /safeMode/);
    await fs.removeFile('settings.json');
    await fs.removeCacheFile('example');
    await fs.clearFolder('themes');
    assert.equal(files.get('/docs/rain/settings.json'), 'existing upstream settings');
    assert(calls.every(path => path.startsWith('rukcord/') || path.startsWith('/docs/rukcord/')));
});
