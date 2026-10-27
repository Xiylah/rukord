import test from "node:test";
import assert from "node:assert/strict";
import { compile, evaluate } from "./runtimeHarness.mjs";
const code = await compile("src/plugins/_core/settings/patches/tabs.tsx", {
    "@api/settings": "export const useSettings={getState:()=>({settingsPosition:'TOP'})}",
    "@metro/common/components": "export const TableRow={Icon:'DiscordRowIcon'}",
    "@api/ui/components/color": "export const semanticColors={INTERACTIVE_NORMAL:'icon'};export const resolveSemanticColor=()=>'#aaaaaa'",
    "react-native": "export const Image='NativeImage'",
    "@metro/wrappers": "export const findByPropsLazy=(key)=>env.modules[key]",
    "react/jsx-runtime": "export const jsx=(type,props)=>({type,props});export const jsxs=jsx",
    "react": "export default {createElement:(...args)=>args}",
    "..": "export const registeredSections=env.sections;",
    "./shared": "export const CustomPageRenderer=()=>null;export const wrapOnPress=(press,nav,load,title)=>()=>env.open.push(title)"
});
function fixture() {
    const base = { ACCOUNT: { type: "stock" } };
    const constants = { SETTING_RENDERER_CONFIG: base };
    const list = { createList: config => ({ sections: config.sections }) };
    const sections = { Rukcord: ["Rukcord", "Plugins", "Themes", "Fonts", "Developer"].map(key => ({ key, title: () => key, render: () => null })) };
    const env = { sections, open: [], modules: { SETTING_RENDERER_CONFIG: constants, createList: list } };
    const { exports } = evaluate(code, env);
    const undo = [];
    exports.patchTabsUI(undo);
    return { constants, list, undo, env, base };
}
test("Rain-style registry exposes custom rows without mutating stock definitions", () => {
    const f = fixture();
    const first = f.constants.SETTING_RENDERER_CONFIG;
    assert.notEqual(first, f.base);
    assert.equal(f.base.Plugins, undefined);
    for (let i = 0; i < 1000; i++) assert.equal(f.constants.SETTING_RENDERER_CONFIG.ACCOUNT, f.base.ACCOUNT);
    assert.equal(first.ACCOUNT, f.base.ACCOUNT);
    for (let i = 0; i < 100; i++) {
        const icon = first.Plugins.IconComponent();
        assert.equal(icon.type, "DiscordRowIcon");
    }
    first.Plugins.onPress();
    assert.deepEqual(f.env.open, ["Plugins"]);
});
test("settings group uses Discord's shared section list and does not duplicate on reopening", () => {
    const f = fixture();
    const config = { sections: [{ label: "Account", settings: ["ACCOUNT"] }] };
    const result = f.list.createList(config);
    assert.equal(result.sections, config.sections);
    assert.deepEqual(Array.from(config.sections[0].settings), ["Rukcord", "Plugins", "Themes", "Fonts", "Developer"]);
    f.list.createList(config);
    assert.equal(config.sections.filter(section => section.label === "Rukcord").length, 1);
    const other = { sections: [{ settings: ["VOICE"] }] };
    f.list.createList(other);
    assert.equal(other.sections.length, 1);
});
test("Rain-style registry supports later section registration and removes hooks cleanly", () => {
    const f = fixture();
    f.env.sections.Rukcord.push({ key: "EXTRA", title: () => "Extra", render: () => null });
    assert.equal(typeof f.constants.SETTING_RENDERER_CONFIG.EXTRA.onPress, "function");
    f.undo.forEach(fn => fn());
    assert.equal(f.constants.SETTING_RENDERER_CONFIG, f.base);
    const config = { sections: [{ settings: ["ACCOUNT"] }] };
    f.list.createList(config);
    assert.equal(config.sections.length, 1);
});
