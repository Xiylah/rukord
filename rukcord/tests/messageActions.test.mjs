import test from 'node:test';
import assert from 'node:assert/strict';
import { compile, evaluate, tick } from './runtimeHarness.mjs';
const code=await compile('src/api/ui/messageActions.tsx',{
    '@lib/utils':'export const findInReactTree=(...a)=>env.find(...a)',
    '@metro':'export const findByProps=()=>env.sheets',
    '@metro/common':'export const React={createElement:(type,props)=>({type,key:props.key,props}),isValidElement:x=>!!x?.type}',
    '@metro/common/components':'export const Forms={FormRow:function FormRow(){}}',
});
function fixture(){
    const clicked=[], env={sheets:{openLazy(){},hideActionSheet(){}},find:(tree,fn)=>{
        if(fn(tree.buttons))return tree.buttons;if(fn(tree.groups))return tree.groups;
    }};
    const api=evaluate(code,env).exports;
    return {env,clicked,api};
}
test('message actions follow the newest message on a reused lazy module',async()=>{
    const f=fixture(); const module={default:()=>({buttons:[{type:{name:'ButtonRow'}}]})};
    const original=module.default;
    const stop=f.api.addMessageAction({id:'raw',label:'Raw',onPress:m=>f.clicked.push(m.id)});
    f.env.sheets.openLazy(Promise.resolve(module),'MessageLongPressActionSheet',{message:{id:'first'}});await tick();
    let tree=module.default();tree.buttons.at(-1).props.onPress();assert.deepEqual(f.clicked,['first']);
    f.env.sheets.openLazy(Promise.resolve(module),'MessageLongPressActionSheet',{message:{id:'second'}});await tick();
    tree=module.default();assert.equal(tree.buttons.length,2);tree.buttons.at(-1).props.onPress();assert.deepEqual(f.clicked,['first','second']);
    stop();assert.equal(module.default,original);
});
test('late lazy resolutions cannot add patches after disable',async()=>{
    const f=fixture();let resolve;const lazy=new Promise(r=>resolve=r), module={default:()=>({})}, original=module.default;
    const stop=f.api.addMessageAction({id:'raw',label:'Raw',onPress(){}});
    f.env.sheets.openLazy(lazy,'MessageLongPressActionSheet',{message:{id:'m'}});stop();resolve(module);await tick();assert.equal(module.default,original);
});
test('native row actions reuse the row type without copying destructive props',async()=>{
    const f=fixture(); function NativeRow(){};
    const module={default:()=>({groups:[{type:{name:'ActionSheetRowGroup'}},{props:{children:[{type:NativeRow,props:{label:'Delete',destructive:true}}]}}]})};
    const stop=f.api.addMessageAction({id:'raw',label:'Raw',onPress(){}});
    f.env.sheets.openLazy(Promise.resolve(module),'MessageLongPressActionSheet',{message:{id:'m'}});await tick();
    const row=module.default().groups[1].props.children.at(-1);
    assert.equal(row.type,NativeRow);assert.equal(row.props.destructive,undefined);assert.equal(row.props.label,'Raw');stop();
});
test('unsupported action sheet layout is left intact',async()=>{
    const f=fixture(), tree={unknown:true}, module={default:()=>tree};
    const stop=f.api.addMessageAction({id:'raw',label:'Raw',onPress(){}});
    f.env.sheets.openLazy(Promise.resolve(module),'MessageLongPressActionSheet',{message:{id:'m'}});await tick();
    assert.equal(module.default(),tree);stop();
});
test('lazy sheet patches are bounded when Discord returns fresh module objects',async()=>{
    const f=fixture(), modules=Array.from({length:70},()=>({default:()=>({})})), first=modules[0].default;
    const stop=f.api.addMessageAction({id:'raw',label:'Raw',onPress(){}});
    for(const module of modules){f.env.sheets.openLazy(Promise.resolve(module),'MessageLongPressActionSheet',{message:{id:'m'}});await tick();}
    assert.equal(modules[0].default,first);stop();
});

test('failed visibility predicates leave the stock action sheet intact',async()=>{
    const f=fixture(),tree={buttons:[{type:{name:'ButtonRow'}}]},module={default:()=>tree};
    const stop=f.api.addMessageAction({id:'bad',label:'Bad',visible(){throw Error('unsupported')},onPress(){}});
    f.env.sheets.openLazy(Promise.resolve(module),'MessageLongPressActionSheet',{message:{id:'m'}});await tick();
    assert.equal(module.default(),tree);assert.equal(tree.buttons.length,1);stop();
});

test('asynchronous message-action failures are contained',async()=>{
    const f=fixture(),module={default:()=>({buttons:[{type:{name:'ButtonRow'}}]})};
    const stop=f.api.addMessageAction({id:'bad',label:'Bad',async onPress(){throw Error('network failed')}});
    f.env.sheets.openLazy(Promise.resolve(module),'MessageLongPressActionSheet',{message:{id:'m'}});await tick();
    module.default().buttons.at(-1).props.onPress();await tick();stop();
});
