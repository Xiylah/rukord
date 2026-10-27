import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BUILTIN_FONTS, builtinFont, changeThemeBase, CUSTOM_THEME_ID, normalizeColor, systemFontName, THEME_PRESETS, themeDraft, themeManifest } from '../src/api/appearance.ts';
import { compile, evaluate } from './runtimeHarness.mjs';

test('custom colors accept hex with optional # and reject incomplete or invalid input', () => {
    assert.equal(normalizeColor(' abc '),'#AABBCC');
    assert.equal(normalizeColor('#a0B1c2'),'#A0B1C2');
    for (const value of ['#','12','12345','1234567','red','url(x)']) assert.equal(normalizeColor(value),null);
});
test('theme draft round-trips through saved data and does not mutate presets', () => {
    for(const preset of Object.values(THEME_PRESETS)) {
        const draft={...preset,accent:'#abc'};
        const manifest=themeManifest(draft);
        assert.equal(manifest.spec,2);
        assert.equal(themeDraft(manifest).accent,'#AABBCC');
        assert.equal(manifest.semanticColors.BG_BASE_PRIMARY[0],preset.background);
        assert.equal(manifest.semanticColors.BG_BASE_PRIMARY[1],preset.background);
        assert.equal(manifest.rawColors.BRAND_500,'#AABBCC');
        assert.equal(draft.accent,'#abc');
    }
});
test('invalid saved themes fall back and invalid edits cannot create manifests', () => {
    assert.deepEqual(themeDraft(null),THEME_PRESETS.Dark);
    assert.deepEqual(themeDraft({rukcordEditor:{mode:'other'}}),THEME_PRESETS.Dark);
    assert.throws(()=>themeManifest({...THEME_PRESETS.Dark,text:'#12'}),/text color/);
    assert.throws(()=>themeManifest({...THEME_PRESETS.Dark,mode:'other'}),/base/);
});
test('changing the base changes the palette and retains the chosen accent',()=>{
    const light=changeThemeBase({...THEME_PRESETS.Dark,accent:'#123456'},'light');
    assert.equal(light.mode,'light');assert.equal(light.background,THEME_PRESETS.Light.background);
    assert.equal(light.surface,THEME_PRESETS.Light.surface);assert.equal(light.text,THEME_PRESETS.Light.text);
    assert.equal(light.accent,'#123456');
    const dark=changeThemeBase(light,'dark');assert.equal(dark.background,THEME_PRESETS.Dark.background);
    const custom={...dark,surface:'#223344'};assert.equal(changeThemeBase(custom,'dark'),custom);
});
test('background/panel edits map to current Discord base and surface tokens for both modes',()=>{
    for(const mode of ['dark','light']){
        const manifest=themeManifest({...THEME_PRESETS.Dark,mode,background:'#123456',surface:'#654321'});
        for(const key of ['BACKGROUND_BASE_LOWEST','BACKGROUND_BASE_LOWER','BACKGROUND_BASE_LOW'])assert.deepEqual(manifest.semanticColors[key],['#123456','#123456']);
        for(const key of ['BACKGROUND_SURFACE_HIGH','BACKGROUND_SURFACE_HIGHEST'])assert.deepEqual(manifest.semanticColors[key],['#654321','#654321']);
    }
});
test('every built-in font has regular/bold/italic mapping supported by both native sources', () => {
    const source=readFileSync('../RukcordNative/Sources/Fonts.x','utf8');
    const generated=readFileSync('../RukcordNative/Generated/Fonts.m','utf8');
    for(const font of BUILTIN_FONTS) {
        const definition=builtinFont(font.id);
        assert.equal(systemFontName(definition.main['ggsans-Normal']),font.regular);
        assert.equal(systemFontName(definition.main['ggsans-Bold']),font.bold);
        assert.equal(systemFontName(definition.main['ggsans-Italic']),font.italic);
        for(const value of Object.values(definition.main)) {
            const name=systemFontName(value);
            assert.ok(name);
            assert.ok(source.includes('@"'+name+'"'));
            assert.ok(generated.includes('@"'+name+'"'));
        }
    }
    assert.equal(systemFontName('system:Unknown'),null);
    assert.equal(systemFontName('https://example.org/font.ttf'),null);
    assert.throws(()=>builtinFont('missing'));
});
test('built-in definitions cover Discord heading, variable and weighted system font paths',()=>{
    const font=builtinFont('georgia');
    assert.equal(systemFontName(font.main['ggsans-vf']),'Georgia');
    assert.equal(systemFontName(font.main['ABCGintoDiscordNord-Bold']),'Georgia-Bold');
    assert.equal(systemFontName(font.main['ABCGintoNord-ExtraBoldItalic']),'Georgia-BoldItalic');
    assert.equal(systemFontName(font.main.systemFontBold),'Georgia-Bold');
    assert.equal(systemFontName(font.main.systemFontItalic),'Georgia-Italic');
});

const storeMock=`export const create=()=>initializer=>{let state;const set=next=>state={...state,...(typeof next==='function'?next(state):next)};const get=()=>state;state=initializer(set,get);const use=selector=>selector?selector(state):state;use.getState=get;use.setState=set;return use}`;
const persistence={'zustand':storeMock,'zustand/middleware':'export const persist=x=>x;export const createJSONStorage=x=>x',
    '@api/storage':'export const createFileStorage=()=>({});export const waitForHydration=async()=>{}'};
const fontCode=await compile('src/plugins/_core/painter/fonts.ts',{
    ...persistence,
    '@api/native/fs':'export const clearFolder=async()=>{};export const downloadFile=(...x)=>env.downloads.push(x);export const fileExists=async()=>false;export const removeFile=async()=>{if(env.failWrite)throw Error("write failed")};export const writeFile=async()=>{if(env.failWrite)throw Error("write failed")}',
    '@lib/utils':'export const safeFetch=()=>{throw Error("Unexpected fetch")}',
});
test('built-in fonts save offline and selecting/default restoration persist the selection',async()=>{
    const env={downloads:[]};const api=evaluate(fontCode,env).exports;
    const definition=builtinFont('georgia');
    await api.saveFont(definition);await api.selectFont(definition.name);
    assert.equal(api.useFonts.getState().fonts.__selected,definition.name);
    assert.equal(env.downloads.length,0);
    await api.selectFont(null);assert.equal(api.useFonts.getState().fonts.__selected,undefined);
});
test('failed native writes retain the previous font selection',async()=>{
    const env={downloads:[],failWrite:false};const api=evaluate(fontCode,env).exports;
    await api.saveFont(builtinFont('georgia'));await api.selectFont('Rukcord Georgia');
    env.failWrite=true;
    await assert.rejects(api.selectFont(null),/write failed/);
    assert.equal(api.useFonts.getState().fonts.__selected,'Rukcord Georgia');
});
test('remote imports still download, invalid system families never become saved fonts',async()=>{
    const env={downloads:[]};const api=evaluate(fontCode,env).exports;
    await api.saveFont({spec:1,name:'Remote',main:{'ggsans-Normal':'https://example.org/font.ttf'}});
    assert.equal(env.downloads.length,1);
    await assert.rejects(api.saveFont({spec:1,name:'Bad',main:{'ggsans-Normal':'system:Unknown'}}));
    assert.equal(api.useFonts.getState().fonts.Bad,undefined);
});
const themeCode=await compile('src/plugins/_core/painter/themes/index.ts',{
    ...persistence,
    '@api/native/fs':'export const writeFile=async()=>{}',
    '@api/native/loader':'export const getStoredTheme=()=>null;export const getThemeFilePath=()=>null;export const isPyonLoader=()=>false',
    '@api/settings':'export const useSettings={getState:()=>({})}',
    '@lib/utils':'export const safeFetch=(url)=>{env.fetches.push(url);return Promise.resolve({json:async()=>({spec:2,name:"Remote"})})}',
    '@metro/common':'export const FluxDispatcher={dispatch:()=>{}}',
    'react-native':'export const Platform={OS:"ios"}',
    './colors':'export default ()=>{}',
    './parser':'export const normalizeToHex=x=>x;export const applyAndroidAlphaKeys=()=>{}',
    './preferences':'export const waitForColorsPrefHydration=async()=>{}',
    './updater':'export const updateColor=()=>{}',
});
test('local themes persist/apply without fetching and remote themes still update',async()=>{
    const env={fetches:[]};const api=evaluate(themeCode,env).exports;
    api.useThemes.getState().setTheme(CUSTOM_THEME_ID,{id:CUSTOM_THEME_ID,selected:false,data:themeManifest(THEME_PRESETS.Purple)});
    await api.useThemes.getState().selectTheme(CUSTOM_THEME_ID);
    assert.equal(api.getCurrentTheme().id,CUSTOM_THEME_ID);
    await api.fetchTheme(CUSTOM_THEME_ID,true);
    await api.useThemes.getState().hotFetchTheme(CUSTOM_THEME_ID,true);
    await api.updateThemes();assert.equal(env.fetches.length,0);
    await api.installTheme('https://example.org/theme.json');
    await api.updateThemes();
    assert.equal(env.fetches.length,2);
    assert.equal(api.getCurrentTheme().id,CUSTOM_THEME_ID);
    await api.selectTheme(null);assert.equal(api.getCurrentTheme(),null);
});

const parserCode=await compile('src/plugins/_core/painter/themes/parser.ts',{
    'chroma-js':'const color=x=>({hex:()=>x.toLowerCase(),alpha:()=>color(x)});color.valid=x=>/^#[a-f0-9]{6}$/i.test(x);export default color',
    '@metro':'export const findByProps=()=>({RawColor:{}})',
    './preferences':'export const colorsPref=env.preferences',
    'react-native':'export const Platform={OS:"ios"};export const processColor=x=>x',
});
const resolverCode=await compile('src/plugins/_core/painter/themes/patches/resolver.ts',{
    'chroma-js':'export default x=>({alpha:()=>({hex:()=>x})})',
    '@api/native/modules':'export const NativeThemeModule={updateTheme:()=>{}}',
    '@metro':'export const findByProps=key=>key==="SemanticColor"?env.tokens:{ThemeTypes:{DARKER:"darker",LIGHT:"light"}}',
    '../updater':'export const _colorRef=env.colorRef',
});
test('actual parser/resolver returns edited backgrounds and panels in both base modes',()=>{
    for(const mode of ['dark','light']){
        const draft={...THEME_PRESETS.Dark,mode,background:'#123456',surface:'#654321'};
        const parsed=evaluate(parserCode,{preferences:{type:mode}}).exports.parseColorManifest(themeManifest(draft));
        assert.equal(parsed.reference,mode==='dark'?'darker':'light');
        const tokens={RawColor:{DEFAULT:'#000000'},SemanticColor:{},default:{meta:{resolveSemanticColor:()=>"original"}}};
        const symbol=Symbol('color');
        for(const name of ['BACKGROUND_BASE_LOWEST','BACKGROUND_BASE_LOWER','BACKGROUND_BASE_LOW','BACKGROUND_SURFACE_HIGH','BACKGROUND_SURFACE_HIGHEST'])tokens.SemanticColor[name]={darker:{raw:'DEFAULT',opacity:1},light:{raw:'DEFAULT',opacity:1}};
        const env={tokens,colorRef:{key:'rukcord-theme-test',current:parsed}};
        const unpatch=evaluate(resolverCode,env).exports.default();
        for(const name of Object.keys(tokens.SemanticColor))assert.equal(tokens.default.meta.resolveSemanticColor('rukcord-theme-test',{[symbol]:name}),name.includes('BASE')?'#123456':'#654321');
        unpatch();
    }
});
const designCode=await compile('src/rukcord/pages/Rukcord/design.tsx',{
    '@api/settings':'export const useSettings=select=>select({safeMode:env.safe})',
    '@plugins/_core/painter/themes':'export const useThemes=select=>select(env.store)',
    '@plugins/_core/painter/themes/preferences':'export const useColorsPref=select=>select({type:env.base})',
    'react-native':'export const useColorScheme=()=>"dark";export const Pressable="Pressable",Text="Text",View="View"',
    'react/jsx-runtime':'export const jsx=()=>{};export const jsxs=jsx',
});
test('Rukcord settings use saved custom backgrounds/panels and safe mode bypasses them',()=>{
    const env={safe:false,base:'light',store:{themes:{[CUSTOM_THEME_ID]:{selected:true,data:themeManifest({...THEME_PRESETS.Dark,background:'#123456',surface:'#654321'})}}}};
    const api=evaluate(designCode,env).exports;
    assert.equal(api.usePalette().bg,'#123456');assert.equal(api.usePalette().panel,'#654321');
    env.safe=true;assert.notEqual(api.usePalette().bg,'#123456');
});
const fontPickerCode=await compile('src/rukcord/pages/Rukcord/FontPicker.tsx',{
    '@api/fontRestart':'export const requestFontRestart=()=>{env.alerts++}',
    '@api/native/modules':'export const BundleUpdaterManager={reload:()=>{}}',
    '@api/settings':'export const useSettings=select=>select({safeMode:false})',
    '@metro/common':'export const FluxDispatcher={dispatch:()=>{}}',
    '@plugins/_core/painter/fonts':'export const saveFont=(...args)=>env.fonts.saveFont(...args);export const selectFont=(...args)=>env.fonts.selectFont(...args);export const useFonts=select=>select(env.fonts.useFonts.getState());useFonts.getState=()=>env.fonts.useFonts.getState()',
    'react':'export const useState=x=>[x,()=>{}];export const useRef=x=>({current:x})',
    'react-native':'export const Alert={alert:()=>{env.alerts++}};export const Platform={OS:"ios"};export const ScrollView="ScrollView",Text="Text",View="View"',
    './discordDesign':'export const Action="Action",Label="Label",Panel="Panel";export const usePalette=()=>({})',
    'react/jsx-runtime':'export const jsx=(type,props)=>({type,props});export const jsxs=jsx',
});
test('reapplying an installed alpha.3 preset upgrades its saved mappings before selection',async()=>{
    const fonts=evaluate(fontCode,{downloads:[]}).exports;
    fonts.useFonts.getState().setFont('Rukcord Avenir Next',{...builtinFont('avenir'),main:{'ggsans-Normal':'system:AvenirNext-Regular'}});
    const env={fonts,alerts:0};const Picker=evaluate(fontPickerCode,env).exports.default;
    const actions=[];
    function visit(node){if(!node||typeof node!=='object')return;if(node.type==='Action')actions.push(node);for(const child of [node.props?.children].flat(Infinity))visit(child)}
    visit(Picker());actions.find(node=>node.props.title==='Apply').props.onPress();
    await new Promise(setImmediate);
    assert.equal(fonts.useFonts.getState().fonts.__selected,'Rukcord Avenir Next');
    assert.equal(fonts.useFonts.getState().fonts['Rukcord Avenir Next'].main.systemFont,'system:AvenirNext-Regular');
    assert.equal(env.alerts,1);
});
test('restoring the default removes the selection and requests a process restart',async()=>{
    const fonts=evaluate(fontCode,{downloads:[]}).exports;
    await fonts.saveFont(builtinFont('georgia'));await fonts.selectFont('Rukcord Georgia');
    const env={fonts,alerts:0};const Picker=evaluate(fontPickerCode,env).exports.default;
    let reset;
    function visit(node){if(!node||typeof node!=='object')return;if(node.type==='Action'&&node.props.title==='Restore default font')reset=node;for(const child of [node.props?.children].flat(Infinity))visit(child)}
    visit(Picker());reset.props.onPress();await new Promise(setImmediate);
    assert.equal(fonts.useFonts.getState().fonts.__selected,undefined);assert.equal(env.alerts,1);
});
const restartCode=await compile('src/api/fontRestart.ts',{
    '@api/native/bridge':'export const callBridgeMethod=async method=>{env.calls.push(method);if(env.fail)throw Error("unavailable")}',
    'react-native':'export const Alert={alert:(...args)=>env.prompts.push(args)}',
});
test('font restart waits for the explicit Close action and uses the process-close bridge',async()=>{
    const env={prompts:[],calls:[]};const api=evaluate(restartCode,env).exports;
    api.requestFontRestart();assert.equal(env.calls.length,0);
    const buttons=env.prompts[0][2];assert.equal(buttons[0].text,'Later');
    await buttons.find(button=>button.text==='Close Discord').onPress();
    assert.equal(env.calls.length,1);assert.equal(env.calls[0],'updater.reload');
});
test('a failed native close explains manual app-switcher restart without soft reloading',async()=>{
    const env={prompts:[],calls:[],fail:true};const api=evaluate(restartCode,env).exports;
    api.requestFontRestart();await env.prompts[0][2].find(button=>button.text==='Close Discord').onPress();
    assert.equal(env.prompts[1][0],'Close Discord manually');assert.equal(env.calls.length,1);
});
