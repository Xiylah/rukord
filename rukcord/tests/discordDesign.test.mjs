import test from "node:test";
import assert from "node:assert/strict";
import { compile, evaluate } from "./runtimeHarness.mjs";
const jsx = "export const jsx=(type,props)=>({type,props});export const jsxs=jsx";
const designCode = await compile("src/rukcord/pages/Rukcord/discordDesign.tsx", {
    "@api/ui/components/color": "export const semanticColors=new Proxy({}, {get:(_,key)=>key})",
    "@api/ui/styles": "export const createStyles=sheet=>()=>Object.fromEntries(Object.entries(sheet).map(([key,value])=>[key,{color:env.colors[value.color]}]))",
    "@metro/common/components": "export const Button='DiscordButton',Card='DiscordCard',Text='DiscordText'",
    "react-native": "export const View='View'",
    "react/jsx-runtime": jsx
});
test("non-brand pages follow Discord's current semantic colors", () => {
    const env = { colors: { BACKGROUND_PRIMARY: "#313338", TEXT_NORMAL: "#ffffff", TEXT_LINK: "#00aaff" } };
    const api = evaluate(designCode, env).exports;
    assert.equal(api.usePalette().bg, "#313338");
    assert.equal(api.usePalette().accent, "#00aaff");
    env.colors.BACKGROUND_PRIMARY = "#ffffff";
    env.colors.TEXT_NORMAL = "#111111";
    assert.equal(api.usePalette().bg, "#ffffff");
    assert.equal(api.usePalette().text, "#111111");
});
test("panels and actions use Discord controls without a fixed purple style", () => {
    const api = evaluate(designCode, { colors: {} }).exports;
    assert.equal(api.Panel({ children: "child" }).type, "DiscordCard");
    const action = api.Action({ title: "Apply", onPress() {} });
    assert.equal(action.props.children[0].type, "DiscordButton");
    assert.equal(action.props.children[0].props.variant, "secondary");
    assert.equal(action.props.children[0].props.style, undefined);
});
const mocks = {
    "@api/ui/sheets": "export const hideSheet=key=>env.events.push(['hide',key])",
    "@api/assets": "export const findAssetId=()=>1",
    "@api/settings": "export const useSettings=fn=>fn?fn({safeMode:false}):{}",
    "@i18n": "export const Strings=new Proxy({}, {get:(_,key)=>key})",
    "@metro/common": "export const NavigationNative={useNavigation:()=>({push:(...args)=>env.events.push(['push',...args])})}",
    "@metro/common/components": "export const ActionSheet='ActionSheet',BottomSheetTitleHeader='Header',TableRadioGroup='RadioGroup',TableRadioRow='RadioRow',TableRow='Row',TableRowGroup='Group',TableRowIcon='Icon',TableSwitchRow='Switch'",
    "@plugins/_core/painter/plus/stuff/loader": "export default ()=>{}",
    "@plugins/_core/painter/themes": "export const getCurrentTheme=()=>null,installTheme=()=>{};export const useThemes=fn=>fn({themes:{}})",
    "@plugins/_core/painter/themes/preferences": "export const useColorsPref=()=>({})",
    "@plugins/_core/painter/themes/updater": "export const updateColor=()=>{}",
    "@plugins/_core/painter/fonts": "export const useFonts=fn=>fn({fonts:{}})",
    "@rukcord/pages/Addon/AddonPage": "export default 'AddonPage'",
    "@rukcord/pages/Browser/Themes": "export default 'ThemeBrowser'",
    "../Browser/Fonts": "export default 'FontBrowser'",
    "./ThemeCard": "export default 'ThemeCard'",
    "./FontCard": "export default 'FontCard'",
    "./FontEditor": "export default 'FontEditor'",
    "../Rukcord/ThemeEditor": "export default 'ThemeEditor'",
    "../Rukcord/FontPicker": "export default 'FontPicker'",
    "react-native": "export const View='View'",
    "react/jsx-runtime": jsx
};
for (const [page,title] of [["Themes","Custom theme"],["Fonts","Font styles"]]) {
    const code = await compile(`src/rukcord/pages/${page}/index.tsx`, mocks);
    test(`${page} has no duplicate top button; the editor remains in native options`, () => {
        const env = { events: [] };
        const Page = evaluate(code, env).exports.default;
        const rendered = Page();
        assert.equal(rendered.type, "AddonPage");
        const sheet = rendered.props.OptionsActionSheetComponent();
        const rows = [];
        function visit(node) { if (!node || typeof node !== "object") return; if (node.type === "Row") rows.push(node); for (const child of [node.props?.children].flat(Infinity)) visit(child); }
        visit(sheet);
        const editor = rows.find(row => row.props.label === title);
        assert.ok(editor);
        editor.props.onPress();
        assert.equal(env.events[0][0], "hide");
        assert.equal(env.events[1][1], "RUKCORD_CUSTOM_PAGE");
        assert.equal(env.events[1][2].title, title);
    });
}
