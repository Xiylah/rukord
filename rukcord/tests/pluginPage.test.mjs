import test from "node:test";
import assert from "node:assert/strict";
import { compile, evaluate } from "./runtimeHarness.mjs";
const code = await compile("src/rukcord/pages/Rukcord/Features.tsx", {
    "@api/assets": "export const findAssetId=()=>1",
    "@api/settings": "export const useSettings=fn=>fn({safeMode:false,developerSettings:false})",
    "@api/ui/components/color": "export const semanticColors={BACKGROUND_PRIMARY:'discord-background'}",
    "@api/ui/styles": "export const createStyles=sheet=>()=>({container:env.styleId})",
    "@api/ui/components/Search": "export default 'DiscordSearch'",
    "@metro/common": "export const NavigationNative={useNavigation:()=>({push(){}})};export const clipboard={setString(){}}",
    "@metro/common/components": "export const Button='DiscordButton',Card='DiscordCard',IconButton='DiscordIconButton',TableSwitch='DiscordSwitch',Text='DiscordText'",
    "@plugins": "export const pluginInstances=new Map([['test',{id:'test',name:'Test',description:'Description',hasSettings:true}]]);export const isPluginCore=()=>false;export const usePluginSettings=fn=>fn({settings:{},failures:{}});export const getPluginSettingsComponent=()=>null;export const startPlugin=()=>{};export const stopPlugin=()=>{}",
    "react": "export const useMemo=fn=>fn();export const useState=x=>[x,()=>{}]",
    "react-native": "export const Alert={alert(){}};export const FlatList='FlatList',View='View'",
    "react/jsx-runtime": "export const jsx=(type,props)=>({type,props});export const jsxs=jsx"
});
test("Plugins applies Discord stylesheet IDs directly, with native search, buttons and switches", () => {
    const env = { styleId: 42 };
    const Page = evaluate(code, env).exports.default;
    const tree = Page();
    assert.equal(tree.props.style, 42);
    const header = tree.props.ListHeaderComponent;
    assert.equal(header.props.children[0].type, 'DiscordSearch');
    const row = tree.props.renderItem({item:{id:'test',name:'Test',description:'Description',hasSettings:true}});
    assert.equal(row.type, 'DiscordCard');
    const controls = row.props.children.props.children[0].props.children;
    assert.equal(controls[1].type, 'DiscordIconButton');
    assert.equal(controls[2].type, 'DiscordSwitch');
    assert.equal(controls[2].props.trackColor, undefined);
    env.styleId = 91;
    assert.equal(Page().props.style, 91);
});
