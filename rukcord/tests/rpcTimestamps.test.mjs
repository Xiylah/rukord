import test from 'node:test';
import assert from 'node:assert/strict';
import {parseDuration,durationInput,timestampEdit} from '../src/plugins/richpresence/timestamps.ts';
import {compile,evaluate} from './runtimeHarness.mjs';

test('RPC durations accept individual and compound units including formatted values',()=>{
    assert.equal(parseDuration('30m'),1800000);assert.equal(parseDuration('1h 30m'),5400000);
    assert.equal(parseDuration('1h30m'),5400000);assert.equal(parseDuration('1.5h'),5400000);
    assert.equal(parseDuration('500'),500);assert.equal(parseDuration('2d 3h 4m 5s 6ms'),183845006);
});
test('formatted durations round-trip without truncating seconds or milliseconds',()=>{
    for(const value of [0,1,500,59999,60000,3661500,183845006])assert.equal(parseDuration(durationInput(value)),value);
});
test('invalid, negative, partial and unsafe values cannot change timestamps',()=>{
    for(const input of ['1h nope','-3m','1.','Infinity','1h 2','9'.repeat(200)])assert.equal(parseDuration(input),null);
    assert.equal(timestampEdit('bad','end',100000).valid,false);
    assert.equal(timestampEdit('2d','start',100000).valid,false);
});
test('start is measured backwards, end forwards, and empty input clears',()=>{
    const now=1792590000000;
    assert.deepEqual(timestampEdit('30m','start',now),{valid:true,value:now-1800000});
    assert.deepEqual(timestampEdit('1h 30m','end',now),{valid:true,value:now+5400000});
    assert.deepEqual(timestampEdit('','end',now),{valid:true,value:undefined});
});

const code=await compile('src/plugins/richpresence/TimestampEditor.tsx',{
    'react':'export const useState=x=>env.useState(x);export const useEffect=(fn,deps)=>env.useEffect(fn,deps)',
    'react/jsx-runtime':'export const jsx=(type,props,key)=>({type,props,key});export const jsxs=jsx',
    'react-native':'export const TextInput="NativeInput";export const View="View"',
    '@rukcord/pages/Rukcord/discordDesign':'export const Action="Action",Label="Label",Panel="Panel";export const usePalette=()=>({})',
});
function fixture(kind='start',value=1792590000000-1800000){
    const states=[],deps=[],effects=[],calls=[];let cursor=0;
    const env={now:1792590000000,useState(initial){const index=cursor++;if(!(index in states))states[index]=typeof initial==='function'?initial():initial;
        return[states[index],next=>states[index]=typeof next==='function'?next(states[index]):next]},
        useEffect(fn,next){const index=cursor++;if(!deps[index]||next.some((x,i)=>x!==deps[index][i])){deps[index]=next;effects.push(fn)}}};
    const Field=evaluate('Date.now=()=>env.now;\n'+code,env).exports.TimestampField;
    function draw(){cursor=0;const tree=Field({kind,value,onApply:x=>calls.push(x)});while(effects.length)effects.shift()();return tree;}
    function all(tree,predicate){let result=[];if(tree&&predicate(tree))result.push(tree);const children=tree?.props?.children;
        for(const child of [children].flat(Infinity))if(child&&typeof child==='object')result.push(...all(child,predicate));return result;}
    const input=()=>all(draw(),x=>x.type==='NativeInput')[0];
    const action=label=>all(draw(),x=>x.type==='Action'&&x.props.title===label)[0];
    return{calls,input,action,draw};
}
test('typing a partial RPC duration keeps the raw draft without saving or rewriting it',()=>{
    const f=fixture();f.draw();f.input().props.onChangeText('1h 3');assert.equal(f.input().props.value,'1h 3');assert.equal(f.calls.length,0);
    f.input().props.onChangeText('1h 30m');assert.equal(f.input().props.value,'1h 30m');
    f.action('Apply start').props.onPress();assert.equal(f.calls[0],1792590000000-5400000);
});
test('RPC end duration applies the future value and Clear removes it',()=>{
    const f=fixture('end',1792590000000+3600000);f.draw();f.input().props.onChangeText('2h');
    f.action('Apply end').props.onPress();assert.equal(f.calls[0],1792590000000+7200000);
    f.action('Clear').props.onPress();assert.equal(f.calls[1],undefined);assert.equal(f.input().props.value,'');
});
test('invalid RPC drafts stay editable and cannot overwrite saved timestamps',()=>{
    const f=fixture();f.draw();f.input().props.onChangeText('1h bad');f.action('Apply start').props.onPress();
    assert.equal(f.calls.length,0);assert.equal(f.input().props.value,'1h bad');
});
