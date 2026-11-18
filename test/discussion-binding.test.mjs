// DSH boundary tests: explicit independent bindings, the published RemoteResult
// shape, and local record calls. No real services, sessions, files or model tokens.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const src = ['00-runtime','60-threads','62-models'].map(n => readFileSync(new URL(`../client/${n}.js`, import.meta.url), 'utf8')).join('\n');
const evaluate = new Function('require','window','fetch','services','registryCreate','registryPatch',src + `\npluginCtx = { get: key => services[key] }; atlasModelAccess.set(services.remote); return { atlasAskTargets, atlasSelectSessionModel, atlasFetchModelCatalog, atlasWithSession, atlasSendToSession, atlasRenameDiscussion, atlasResolveDiscussion, startThread, focusContext, contextBlock, DiscussionTab, EmbeddedConversation, Companion, installAtlasModelAccess };`);
const model = { provider:'fixture-provider', model:'fixture-model', effort:'brief' };
const catalog = { groups:[{ id:model.provider, name:'Fixture', models:[{ id:model.model, name:'Fixture model', reasoning:{ efforts:[{id:'brief',name:'Brief'}] } }] }],failures:[] };
const success = value => ({ok:true,value});
const topic = {id:'mc/worm',path:'/f/worm/research.md',title:'Worm algorithm'};
function scenario(overrides = {}) {
  const events=[], records=new Map(), services={}; let num=0;
  const log = (op, id, args) => events.push({op,id,args});
  services.remote = { modelCatalog:async () => {log('catalog');return success(catalog);}, selectModel:async s=>{log('model',s.sessionId,s);return success();} };
  services.workspaces = { create:async ({path})=>({id:path==='/'?'root':'fixture'}),archiveSession:async id=>log('archive',id), unarchiveSession:async id=>log('unarchive',id) };
  services.sessions = { create:async opts=>{const id='s'+ ++num;log('create',id,opts);return id;},retain:(id,{source})=>{
    log('retain',id,source);return {ready:Promise.resolve({session:{prompt: async(parts,mode)=>{log('prompt',id,{parts,mode});return success();},rename:async t=>{log('rename',id,t);return success();}}}), release:()=>log('release',id)}; } };
  Object.assign(services,overrides.services);
  const react = { createContext:()=>({}),createElement:(type,props,...children)=>({type,props,children}) };
  const client = evaluate(() => react,{confirm:msg=>{log('confirm',null,msg); return overrides.confirm!==false;},localStorage:{getItem:()=>null}},async (url,request) => {
    log('api',null,{url,body:request?.body});const obj = url.includes('/review/changes') ? {files:overrides.edits?[{edits:[{}]}]:[]} : {};
    return {ok:true,json:async()=>obj};
  },services,async rec=>{log('register',rec.id);if(overrides.createError)throw Error('disk full');records.set(rec.id,rec);return rec;},async(id,patch)=>{log('patch',id,patch);return {...records.get(id),...patch};});
  return {client,events,services,records};
}

test('model catalog is session-free; the exact advertised provider, model and effort apply before the first prompt',async()=>{
  const {client:c,events,records}=scenario(); await c.atlasFetchModelCatalog(); assert.deepEqual(events.map(e=>e.op),['catalog']);
  const created=await c.startThread({root:'/f',context:c.focusContext({topic}),origin:'desk',filing:'auto',candidates:[{topic}],model,question:'Why mix slowly?'});
  assert.deepEqual(events.map(e=>e.op),['catalog','create','retain','catalog','model','rename','register','api','prompt','release']);
  assert.deepEqual(events.find(e=>e.op==='model').args,{sessionId:created.id,provider:model.provider,model:model.model,reasoningEffort:'brief'});
  assert.deepEqual(records.get(created.id).model,model); assert.equal(created.topic.id,topic.id); assert.equal(created.origin,'desk');
  const msg=events.find(e=>e.op==='prompt');assert.equal(msg.id,created.id);assert.equal(msg.args.mode,'queue');assert.match(msg.args.parts[0].text, /Candidate topics: Worm algorithm\.\nAtlas filed this under Worm algorithm\. If another topic fits better, say so in your first sentence\./);
  assert.match(c.contextBlock({routing:{filing:'none',candidates:[]}}),/Candidate topics: None\.\nAtlas left it unfiled\. If another topic fits better, say so in your first sentence\./);
});

test('no unauthorized effort/model is invented; missing model service permits only an unmodified DSH default',async()=>{
  const {client:c,events}=scenario();await assert.rejects(c.atlasSelectSessionModel('s-one',{...model,effort:'made-up'}),/no longer available/);
  await assert.rejects(c.atlasSelectSessionModel('s-one',{...model,model:'other'}),/no longer available/);assert.ok(!events.some(e=>e.op==='model'));
  const degraded=scenario({services:{remote:null}});await assert.rejects(degraded.client.atlasFetchModelCatalog(),/unavailable/);
  await degraded.client.startThread({root:'/f',context:{},question:'Default'});assert.ok(degraded.events.some(e=>e.op==='prompt'));
  await assert.rejects(degraded.client.startThread({root:'/f',context:{},question:'Explicit',model}),/unavailable/);assert.equal(degraded.events.filter(e=>e.op==='prompt').length,1);
});

test('a registry failure leaves a recoverable DSH id, releases the reference and sends zero prompts',async()=>{
  const {client:c,events}=scenario({createError:true});await assert.rejects(c.startThread({root:'/f',context:{},question:'Do not send'}), e=>e.sessionId==='s1' && /disk full/.test(e.message));
  assert.equal(events.filter(e=>e.op==='release').length,1);assert.ok(!events.some(e=>e.op==='prompt'));
});

test('two queued turns bind to independent exact ids; an evicted shell never constructs an embedded conversation',async()=>{
  const {client:c,events,services}=scenario();let finishA;const retain=services.sessions.retain;services.sessions.retain=(id,opts)=>{const ref=retain(id,opts);if(id==='A'){const ready=ref.ready;ref.ready=new Promise(resolve=>{finishA=()=>resolve(ready);});}return ref;};
  const pending=c.atlasSendToSession('A','A only'); await c.atlasSendToSession('B','B only'); finishA();await pending;
  assert.deepEqual(events.filter(e=>e.op==='prompt').map(e=>[e.id,e.args.parts[0].text,e.args.mode]),[['B','B only','queue'],['A','A only','queue']]);
  assert.deepEqual(events.filter(e=>e.op==='release').map(e=>e.id),['B','A']);
  const count=events.length;const evicted=c.DiscussionTab({sessionId:'A',retained:false});assert.equal(evicted.type,'div');assert.match(evicted.children[0],/Reopening/);assert.equal(events.length,count);
  const live=c.DiscussionTab({sessionId:'A',retained:true});assert.equal(live.type,c.Companion);assert.equal(live.props.threadId,'A');
});

test('inline rename, guarded resolve and reopen mutate the matching DSH session and registry record',async()=>{
  const blocked=scenario({edits:true,confirm:false}), r={id:'s',status:'open',title:'Old',topic:null,context:{}};
  assert.equal(await blocked.client.atlasResolveDiscussion(r,'resolved'),false);assert.deepEqual(blocked.events.map(e=>e.op),['api','confirm']);
  const {client:c,events}=scenario({edits:true});await c.atlasRenameDiscussion(r,'New title');
  assert.deepEqual(events.map(e=>e.op),['retain','rename','release','patch']);assert.deepEqual(events.at(-1).args,{title:'New title'});
  assert.equal(await c.atlasResolveDiscussion(r,'resolved'),true);assert.deepEqual(events.slice(4).map(e=>e.op),['api','confirm','archive','patch','api']);assert.match(events.at(-1).args.url,/review\/forget/);
  await c.atlasResolveDiscussion({...r,status:'resolved'},'open');assert.deepEqual(events.slice(-2).map(e=>e.op),['unarchive','patch']);assert.deepEqual(events.at(-1).args,{status:'open'});
});

test('Ask in offers open targets first, recent next, without deleted, team or resolved sessions',()=>{
  const {client:c}=scenario(), ids=['a','b','c','gone','team','resolved'];const records=ids.map((id,n)=>({id,updated:n,title:id,status:id==='resolved'?'resolved':'open',kind:id==='team'?'team':null}));
  const byId=Object.fromEntries(ids.filter(i=>i!=='gone').map(i=>[i,{}]));
  assert.deepEqual(c.atlasAskTargets(records,{byId,phase:'ready'},['b','a'],[]).map(t=>t.id),['b','a','c']);
});
