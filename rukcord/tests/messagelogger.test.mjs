import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { compile, evaluate, tick } from './runtimeHarness.mjs';

const code=await compile('src/plugins/messagelogger/index.ts',{
    '@api/native/fs':'export const fileExists=async()=>env.retainedFile!==undefined; export const readFile=async()=>env.retainedFile; export const writeFile=async(path,data)=>{env.retainedFile=data}',
    '@metro':'export const findByProps=()=>env.dispatcher',
    '@metro/common/stores':'export const MessageStore={getMessage:(...a)=>env.getMessage(...a)}; export const UserStore={getCurrentUser:()=>({id:"self"})}; export const ChannelStore={getChannel:id=>env.channels[id]}',
    '@api/ui/messageActions':'export const addMessageAction=action=>{env.actions.push(action);return()=>env.actions.splice(env.actions.indexOf(action),1)}',
    './storage':'export const useMessageLoggerSettings={getState:()=>env.settings}',
    './database':'export const addLogEntry=(...a)=>env.write(...a); export const repairCorruptedLogs=()=>env.repair(); export const removeMessageLogs=(...a)=>env.clear(...a)',
});
const message=(id='m',extra={})=>({id,channel_id:'c',content:'original',flags:0,author:{id:'u'},...extra});
function fixture(settings={},options={}) {
    const cache=new Map(),events=[],writes=[],actions=[];
    const env={settings:{deleted:{enabled:true},edited:{enabled:true},...settings},actions,channels:{},
        getMessage:(c,id)=>cache.get(c+'/'+id),
        write:options.write??(async e=>writes.push(e)),repair:options.repair??(async()=>true),clear:options.clear??(async()=>{})};
    const normalize=m=>options.strictRecords?Object.fromEntries(Object.entries(m).filter(([key])=>!key.startsWith('_rk')&&key!=='was_deleted')):m;
    env.dispatcher={_subscriptions:{},dispatch(e){
        events.push(e);
        if(e.type==='MESSAGE_UPDATE') { const m=e.message; cache.set((m.channel_id??m.channelId)+'/'+m.id,normalize({...cache.get((m.channel_id??m.channelId)+'/'+m.id),...m})); }
        if(e.type==='LOAD_MESSAGES_SUCCESS'||e.type==='LOAD_MESSAGES_SUCCESS_CACHED') {
            const channel=e.channelId??e.channel_id;
            for(const key of cache.keys())if(key.startsWith(channel+'/'))cache.delete(key);
            for(const m of e.messages)cache.set(channel+'/'+m.id,normalize(m));
        }
        if(e.type==='MESSAGE_DELETE')cache.delete((e.channelId??e.channel_id)+'/'+e.id);
        if(e.type==='MESSAGE_DELETE_BULK')for(const id of e.ids)cache.delete((e.channelId??e.channel_id)+'/'+id);
        return 'dispatched';
    }};
    const original=env.dispatcher.dispatch, result=evaluate(code,env);
    return {env,cache,events,writes,actions,original,errors:result.errors,p:result.exports.default,
        put(m){cache.set((m.channel_id??m.channelId)+'/'+m.id,m)},
        send(e){return env.dispatcher.dispatch(e)},get(id='m'){return cache.get('c/'+id)}};
}

test('logger handles single deletion without automod errors or invented message flags',async()=>{
    const f=fixture();f.put(message());await f.p.start();f.send({type:'MESSAGE_DELETE',channelId:'c',id:'m'});
    assert.equal(f.get().was_deleted,true);assert.equal(f.get().flags,0);
    assert.equal(f.get().content,'[deleted] original');assert.equal(f.get()._rkCurrentContent,'original');
    assert.equal(f.events.length,1);assert.equal(f.events[0].type,'MESSAGE_UPDATE');f.p.stop();
});
test('voice deletion keeps the real voice flag and attachment fields',async()=>{
    const f=fixture();f.put(message('voice',{content:'',flags:8192,attachments:[{id:'a',url:'voice',waveform:'abc'}]}));await f.p.start();
    f.send({type:'MESSAGE_DELETE',channelId:'c',id:'voice'});assert.equal(f.get('voice').flags,8192);assert.equal(f.get('voice').content,'');assert.equal(f.get('voice').attachments[0].waveform,'abc');f.p.stop();
});
test('mixed bulk deletions retain eligible messages and delete ignored/ephemeral messages',async()=>{
    const f=fixture({ignoreLists:{user:'ignored'}});f.put(message('a'));f.put(message('b',{author:{id:'ignored'}}));f.put(message('e',{flags:64}));await f.p.start();
    f.send({type:'MESSAGE_DELETE_BULK',channelId:'c',ids:['a','b','e','missing']});
    assert.equal(f.get('a').was_deleted,true);assert.equal(f.get('b'),undefined);assert.equal(f.get('e'),undefined);
    assert.deepEqual([...f.events.at(-1).ids],['b','e','missing']);f.p.stop();
});
test('updates without author data use cached author for self and bot filters',async()=>{
    const f=fixture({filters:{ignoreSelfEdits:true}});f.put(message('m',{author:{id:'self'}}));await f.p.start();
    f.send({type:'MESSAGE_UPDATE',message:{id:'m',channel_id:'c',content:'new'}});
    assert.equal(f.get().content,'new');assert.equal(f.get()._rkHistory,undefined);f.p.stop();
});
test('partial edits of ephemeral messages are never logged',async()=>{
    const f=fixture();f.put(message('m',{flags:64}));await f.p.start();
    f.send({type:'MESSAGE_UPDATE',message:{id:'m',channel_id:'c',content:'new'}});
    assert.equal(f.get()._rkHistory,undefined);f.p.stop();
});
test('edit history is separate from latest raw content; attachment-only updates also retain removals',async()=>{
    const f=fixture({inlineEdits:false});f.put(message('m',{attachments:[{id:'a',url:'removed'}]}));await f.p.start();
    f.send({type:'MESSAGE_UPDATE',message:{id:'m',channel_id:'c',content:'new'}});
    assert.equal(f.get()._rkCurrentContent,'new');assert.equal(f.get()._rkHistory[0].content,'original');
    f.send({type:'MESSAGE_UPDATE',message:{id:'m',channel_id:'c',attachments:[]}});
    assert.equal(f.get().attachments[0]._rkDeleted,true);assert.equal(f.get().content,'new');f.p.stop();
});
test('server/category ignore filters apply to cached messages',async()=>{
    const f=fixture({ignoreLists:{guild:'g'}});f.env.channels.c={guild_id:'g'};f.put(message());await f.p.start();f.send({type:'MESSAGE_DELETE',channelId:'c',id:'m'});
    assert.equal(f.get(),undefined);f.p.stop();
});
test('database startup failures and event write rejections are handled',async()=>{
    const f=fixture({databaseLogging:true},{repair:async()=>{throw Error('read failure')},write:async()=>{throw Error('disk full')}});f.put(message());
    await f.p.start();f.send({type:'MESSAGE_DELETE',channelId:'c',id:'m'});await tick();assert.equal(f.get().was_deleted,true);assert(f.errors.length>=2);f.p.stop();
});
test('disabling during delayed startup prevents patch installation',async()=>{
    let resolve;const f=fixture({databaseLogging:true},{repair:()=>new Promise(r=>resolve=r)});const starting=f.p.start();await new Promise(setImmediate);f.p.stop();resolve();await starting;
    assert.equal(f.env.dispatcher.dispatch,f.original);assert.equal(f.actions.length,0);
});
test('enable/disable is idempotent and teardown restores stock deletions',async()=>{
    const f=fixture();await f.p.start();await f.p.start();assert.equal(f.actions.length,1);f.p.stop();f.p.stop();assert.equal(f.env.dispatcher.dispatch,f.original);
    assert.equal(f.actions.length,0);f.put(message());f.send({type:'MESSAGE_DELETE',channelId:'c',id:'m'});assert.equal(f.get(),undefined);
});
test('clear-history action restores current edit content and removes retained deletions',async()=>{
    const f=fixture();f.put(message());await f.p.start();f.send({type:'MESSAGE_UPDATE',message:{id:'m',channel_id:'c',content:'new'}});
    assert.equal(f.actions[0].visible(f.get()),true);f.actions[0].onPress(f.get());assert.equal(f.get().content,'new');assert.equal(f.get()._rkHistory.length,0);
    f.send({type:'MESSAGE_DELETE',channelId:'c',id:'m'});f.actions[0].onPress(f.get());assert.equal(f.get(),undefined);f.p.stop();
});
test('oversized bulk events fail open instead of blocking Discord',async()=>{
    const f=fixture();await f.p.start();f.send({type:'MESSAGE_DELETE_BULK',channelId:'c',ids:Array.from({length:1001},(_,i)=>String(i))});assert.equal(f.events[0].type,'MESSAGE_DELETE_BULK');f.p.stop();
});
test('missing message capabilities reject enabling instead of claiming success',async()=>{
    const f=fixture();f.env.dispatcher=null;await assert.rejects(f.p.start(),/unavailable/);f.p.stop();
});

test('history survives a store that discards plugin metadata and repeated server updates',async()=>{
    const f=fixture({}, {strictRecords:true});f.put(message());await f.p.start();
    f.send({type:'MESSAGE_UPDATE',message:{id:'m',channel_id:'c',content:'second'}});
    assert.equal(f.get()._rkHistory,undefined);
    f.send({type:'MESSAGE_UPDATE',message:{id:'m',channel_id:'c',content:'second',pinned:true}});
    assert.match(f.get().content,/original/);assert.match(f.get().content,/second/);
    f.send({type:'MESSAGE_UPDATE',message:{id:'m',channel_id:'c',content:'third'}});
    assert.match(f.get().content,/original/);assert.match(f.get().content,/second/);assert.match(f.get().content,/third/);
    assert.equal(f.actions[0].visible(f.get()),true);
    f.actions[0].onPress(f.get());assert.equal(f.get().content,'third');assert.equal(f.actions[0].visible(f.get()),false);f.p.stop();
});
test('deleted messages survive a channel reload and disappear only when their log is cleared',async()=>{
    const f=fixture({}, {strictRecords:true});f.put(message('200'));await f.p.start();
    f.send({type:'MESSAGE_DELETE',channelId:'c',id:'200'});
    f.send({type:'LOAD_MESSAGES_SUCCESS',channelId:'c',messages:[message('300'),message('100')]});
    assert.equal(f.get('200').content,'[deleted] original');assert.equal(f.actions[0].visible(f.get('200')),true);
    f.actions[0].onPress(f.get('200'));assert.equal(f.get('200'),undefined);
    f.send({type:'LOAD_MESSAGES_SUCCESS',channelId:'c',messages:[message('300'),message('100')]});
    assert.equal(f.get('200'),undefined);f.p.stop();
});
test('retained history is saved across plugin restarts and clearing it is persisted',async()=>{
    const f=fixture({}, {strictRecords:true});f.put(message());await f.p.start();
    f.send({type:'MESSAGE_UPDATE',message:{id:'m',channel_id:'c',content:'new'}});f.p.stop();
    f.cache.clear();await f.p.start();f.send({type:'LOAD_MESSAGES_SUCCESS',channelId:'c',messages:[message('m',{content:'new'})]});
    assert.match(f.get().content,/original/);f.actions[0].onPress(f.get());f.p.stop();
    f.cache.clear();await f.p.start();f.send({type:'LOAD_MESSAGES_SUCCESS',channelId:'c',messages:[message('m',{content:'new'})]});
    assert.equal(f.get().content,'new');assert.equal(f.actions[0].visible(f.get()),false);f.p.stop();
});
test('record prototype getters are copied into a valid message update',async()=>{
    class Record {
        get id(){return 'm'}get channelId(){return 'c'}get content(){return 'original'}get author(){return {id:'u'}}get flags(){return 0}
    }
    const f=fixture({}, {strictRecords:true});f.put(new Record());await f.p.start();
    f.send({type:'MESSAGE_DELETE',channelId:'c',id:'m'});assert.equal(f.get().content,'[deleted] original');f.p.stop();
});

const databaseCode = await compile('src/plugins/messagelogger/database.ts', {
    '@api/native/fs': 'export const fileExists=(...a)=>globalThis.io.exists(...a); export const readFile=(...a)=>globalThis.io.read(...a); export const writeFile=(...a)=>globalThis.io.write(...a)',
});
function databaseFixture(initial) {
    let value = initial;
    const io = { exists: async () => value != null, read: async () => value,
        write: async (path, data) => { await Promise.resolve(); value = data; } };
    const context = { io, module: { exports: {} } };
    vm.runInNewContext(databaseCode, context);
    return context.module.exports;
}
const entry = id => ({ messageId: id, channelId: 'c', timestamp: '2026-10-20T00:00:00Z', type: 'DELETE', author: { id: 'u' } });
test('wrapped persistent logs survive reads and repair', async () => {
    const db = databaseFixture(JSON.stringify({ version: 1, logs: [entry('old')] }));
    assert.equal((await db.getLogEntries()).length, 1);
    assert.equal(await db.repairCorruptedLogs(), true);
    assert.equal((await db.getLogEntries())[0].messageId, 'old');
});
test('concurrent writes retain all entries instead of racing read-modify-write', async () => {
    const db = databaseFixture(null);
    await Promise.all(Array.from({ length: 50 }, (_, n) => db.addLogEntry(entry(String(n)))));
    const logs = await db.getLogEntries(undefined, 1000);
    assert.equal(logs.length, 50);
    assert.equal(new Set(logs.map(e => e.messageId)).size, 50);
});

test('clearing one saved history preserves other channels/messages',async()=>{
    const db=databaseFixture(JSON.stringify({version:1,logs:[entry('one'),entry('two'),{...entry('one'),channelId:'other'}]}));
    await db.removeMessageLogs('c','one');const logs=await db.getLogEntries();assert.equal(logs.length,2);assert(logs.some(e=>e.channelId==='other'));
});
