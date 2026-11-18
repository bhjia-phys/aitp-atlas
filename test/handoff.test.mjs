import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
// Only synthetic WorkspaceView/Session fixtures; no real DSH state or filesystem probes.
const code=readFileSync(new URL('../client/63-handoff.js',import.meta.url),'utf8');
const {handoffWorkspaceChoices:choices,handoffPointerText:pointers,handoffDiscussion:send}=new Function(code+'\nreturn {handoffWorkspaceChoices,handoffPointerText,handoffDiscussion};')();
const snap={phase:'ready',state:'idle',items:[{workspaceId:'ws-a',title:'Study',path:'/fixture/a',sessionIds:['source']},{workspaceId:'ws-b',title:'Study',path:'/fixture/b',sessionIds:[]}]};
const record={id:'source',title:'Study',topic:{path:'/fixture/a/topic/research.md'},question:'private raw question', context:{topic:{path:'stale'},doc:{path:'/fixture/a/p1.pdf'},page:'4',section:'Figure 1',selection:'private quote',transcript:'private source',attachments:[{path:'/fixture/a/plan.md',label:'private attachment body'}]}};
function setup(overrides={}) {
  const effects=[];
  return {effects, req:{record, confirmed:true, targetId:'ws-b', workspaces:{list:{getSnapshot:()=>snap}},
    sessions:{create:async opts=>{effects.push(['create',opts]);return 'child';},retain:(id,opts)=>{effects.push(['retain',id,opts]);return {ready:Promise.resolve({session:{rename:()=>{},prompt:async(...args)=>{effects.push(['send',...args]);return {ok:true};}}}),release:()=>effects.push(['release'])};}},
    patchRecord:async(...args)=>effects.push(['link',...args]),createRecord:async r=>effects.push(['register',r]),...overrides}};
}
test('target selection requires a ready, current, unambiguous DSH source membership; rejects self and stale rows',()=>{
  assert.deepEqual(choices(snap,'source').map(w=>w.workspaceId),['ws-b']);
  for(const data of [{...snap,phase:'pending'},{...snap,state:'error'},{...snap,items:[snap.items[0],{...snap.items[1],sessionIds:['source']}]}]) assert.deepEqual(choices(data,'source'),[]);
  assert.deepEqual(choices(snap,'unknown'),[]); assert.deepEqual(choices(snap,'source','ws-b'),[]);
});
test('handoff contains only approved pointers and original session identity, never old selection, transcript or prompt',()=>{
  assert.match(pointers(record),/Original DSH session: source/); assert.match(pointers(record),/Document: \/fixture\/a\/p1.pdf\nPage: 4/); assert.match(pointers(record),/Reference: \/fixture\/a\/plan.md/); assert.doesNotMatch(pointers(record),/private|stale/);
  assert.match(pointers({...record,topic:null}),/Filed topic: Unfiled/);
  assert.doesNotMatch(pointers(record, 'yes'),/private/); assert.match(pointers(record,true),/Original question: private raw question/);
  assert.doesNotMatch(pointers(record,true),/private (quote|attachment|source)/); assert.match(pointers(record),/session_event_search and session_event_read.*only if authorized/);
});
test('no side effects on missing confirmation or service, same workspace, missing target or existing continuation',async()=>{
  for(const opt of [{confirmed:false},{confirmed:undefined},{targetId:''},{targetId:'ws-a'},{targetId:'deleted'},{currentWorkspaceId:'different'},{sessions:{}},{workspaces:{}},{record:{...record,movedTo:'existing'}}]){
    const{effects,req}=setup(opt); await assert.rejects(()=>send(req)); assert.deepEqual(effects,[]);
  }
});
test('only chosen workspace creates; at-most-once link precedes send, new session receives metadata only, retain always released',async()=>{
  const {effects,req}=setup(); assert.equal(await send(req),'child');
  assert.deepEqual(effects.map(e=>e[0]),['create','link','register','retain','send','release']);
  assert.deepEqual(effects[0][1],{workspaceId:'ws-b'}); assert.deepEqual(effects[1].slice(1),['source',{movedTo:'child'}]);
  assert.deepEqual(effects[2][1].context,{}); assert.equal(effects[2][1].topic,null);
  assert.deepEqual(effects[4].slice(1),[[{type:'text',text:pointers(record)}],'queue']);
});
test('partial creation reports actual id and never automatically resends; conflicting old link prevents first send',async()=>{
  const {effects,req}=setup({patchRecord:async()=>{throw Error('Already continued');}});
  await assert.rejects(()=>send(req),e=>e.sessionId==='child'&&e.message.includes('No hand-off was sent'));
  assert.deepEqual(effects.map(e=>e[0]),['create']);
  let releases=0, attempts=0;
  const {req:denied}=setup({sessions:{create:async()=> 'child',retain:()=>({ready:Promise.resolve({session:{prompt:async()=>{attempts++;throw Error('Disconnected');}}}),release:()=>releases++})}});
  await assert.rejects(()=>send(denied),e=>e.sessionId==='child'&&e.message.includes('Delivery was not confirmed'));
  assert.equal(releases,1); assert.equal(attempts,1);
});
