import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,promises as fs} from 'node:fs';
import path from 'node:path';
import {makeFixture,snapshot,seedTeamArtifacts} from './fixture.mjs';
import {createDiscussions} from '../lib/discussions.js';
import {createTeams} from '../lib/teams.js';

const client=n=>readFileSync(new URL('../client/'+n+'.js',import.meta.url),'utf8');
const pathUtils=client('72-tabs').split('function tabRootKey(')[1].split('function tabStorageKey')[0];
const makeClient=new Function('state',`function tabRootKey(${pathUtils}\n${client('23-inquiry-data')}\n${client('25-inquiry-return')}\n
 const teamIndexStore={get:()=>state.teams}, registryState={get:()=>state.registry}, svc=k=>state[k];
 function atlasRequireResult(r){if(!r?.ok)throw Error('no receipt');}
 return {linked:inquiryLinkedTeams,inventory:inquiryReturnInventory,send:inquiryReturnSend,binding:inquiryReturnBinding};`);
const origin={discussionId:'discussion-a',proposalId:'reply-54'}, code=n=>e=>e.statusCode===n;
async function fixture(t){
  const fx=await makeFixture(); t.after(fx.cleanup);
  const file=fx.file('topics/mc/worm/research.md'),topic={id:'mc/worm',title:'Worm',path:file};
  const atlas={root:fx.root,topics:new Map([[topic.id,{...topic,file}]])},settings={root:fx.root,stateDir:fx.file('ui')},teams=createTeams(settings),registry=createDiscussions(settings);
  await registry.create(atlas,{id:origin.discussionId,title:'Original question',origin:'desk',context:{inquiry:{currentQuestion:'When is this estimator reliable?'}}});
  return {fx,atlas,settings,teams,registry,draft:{topic,origin,requestId:'attempt-a',goal:'Check estimator',doneWhen:'Decisive limit matched.',template:'custom',seats:[{name:'numerics',role:'numerics'},{name:'referee',role:'referee'}]}};
}

test('preview/cancel leaves no link; concurrent creation, edited retry and reload identify the actual partial team without starting another',async t=>{
  const {fx,atlas,settings,teams,registry,draft}=await fixture(t),before=await snapshot(fx.base);
  await teams.preview(atlas,draft);assert.deepEqual(await snapshot(fx.base),before);
  assert.deepEqual((await teams.list(atlas)).teams,[]);
  const retry={...draft,requestId:'attempt-b',goal:'Revised charter'};
  const [a,b]=await Promise.all([teams.create(atlas,draft),createTeams(settings).create(atlas,retry)]);
  assert.deepEqual([a.replayed,b.replayed],[false,true]);assert.equal(a.team.id,b.team.id);assert.equal(a.team.leadId,null);assert.equal(a.team.startedAt,undefined);
  assert.deepEqual(a.team.origin,origin);assert.equal((await fs.readdir(path.dirname(a.team.runDir))).length,1);
  const client=makeClient({}), index=(await createTeams(settings).list(atlas)).teams;
  assert.deepEqual(client.linked(index,origin.discussionId,origin.proposalId).map(t=>t.id),[a.team.id]);
  assert.deepEqual(client.linked(index,'other-inquiry'),[]);assert.deepEqual(client.linked(index,origin.discussionId,'reply-58'),[]);
  assert.deepEqual(client.linked([{...index[0],legacy:true},{...index[0],projectionOnly:true}],origin.discussionId),[]);
  assert.equal((await createTeams(settings).create(atlas,{...retry,requestId:'after-reload'})).replayed,true);
  assert.equal((await registry.list())[0].teamId,null,'no independent second link or status on the discussion');
  await assert.rejects(teams.patch(a.team.id,{origin:{discussionId:'other',proposalId:'reply-45'}}),code(400));
  await assert.rejects(teams.create(atlas,{...draft,origin:{...origin,proposalId:'reply-55'}}),code(409));
  const next=await teams.create(atlas,{...draft,goal:'Another question',requestId:'attempt-c',origin:{...origin,proposalId:'reply-55'}});assert.notEqual(a.team.id,next.team.id);
});

test('origin syntax, non-inquiry, foreign session and mismatched workspace fail without a registered team',async t=>{
  const {fx,atlas,settings,teams,registry,draft}=await fixture(t);
  await registry.create(atlas,{id:'ordinary',origin:'ask'});
  const other=fx.file('other-root');await fs.mkdir(other);await createDiscussions({...settings,root:other}).create({...atlas,root:other},{id:'elsewhere',origin:'desk',context:{inquiry:{}}});
  for(const p of [null,'reply-01','reply-2/../3','reply--1','reply-9007199254740992'])await assert.rejects(teams.create(atlas,{...draft,origin:{...origin,proposalId:p}}),code(400));
  await assert.rejects(teams.create(atlas,{...draft,origin:{...origin,discussionId:'../bad'}}),code(400));
  for(const id of ['ordinary','elsewhere'])await assert.rejects(teams.create(atlas,{...draft,origin:{...origin,discussionId:id}}),code(403));
  assert.deepEqual((await teams.list(atlas)).teams,[]);
  await assert.rejects(teams.create({...atlas,root:other},draft),code(403));
  const {origin:_,...normal}=draft; const created=await teams.create(atlas,normal);assert.equal(created.team.origin,undefined);
});

test('return reads authored reports and reviews, excludes malformed/ambiguous/path escapes, quotes an assessment into the original session only',async t=>{
  const {atlas,fx,teams,draft,registry}=await fixture(t),root=fx.root,{team}=await teams.create(atlas,draft);
  const id=origin.discussionId, sent=[];
  const binding={sessionId:id,session:{prompt:async(...args)=>{sent.push(args);return {ok:true};}}};
  const rows={phase:'ready',byId:{[id]:{id,cwd:root}}}, ws={phase:'ready',items:[{path:root,sessionIds:[id]}]};
  const state={teams:{root,records:[team]},registry:{root,records:await registry.list()},sessions:{binding:v=>v===id?binding:null,list:{getSnapshot:()=>rows}},workspaces:{list:{getSnapshot:()=>ws}}};
  const c=makeClient(state),read=()=>teams.artifacts(atlas,team.id),verify=()=>c.binding(root,team);
  assert.deepEqual(c.inventory(root,team,await read()).records,[],'empty run has no invented output');
  await seedTeamArtifacts(fx,team.runDir);const data=await read(), shown=c.inventory(root,team,data).records;
  assert.deepEqual(shown.map(x=>x.id),['R01','V01']);assert.deepEqual(data.origin,team.origin);
  // An explicit send uses the current file content/revision, never metadata from a card.
  await c.send({root,team,shown:shown.map(x=>({...x,title:'faker'})),read,verify});assert.equal(sent.length,1);
  const [[{text}],mode]=sent[0];assert.equal(mode,'queue');assert.match(text,/dimensionless coefficient/);assert.match(text,/Dimensional consistency/);assert.match(text,/holds/);assert.match(text,/Independent fixture review/);assert.match(text,/not independent certification/);assert.doesNotMatch(text,/faker/);
  for(const bad of [{root:fx.base},{teamId:'other'},{origin:{...origin,proposalId:'reply-1'}}])assert.throws(()=>c.inventory(root,team,{...data,...bad}),/Cannot verify/);
  const extra={...data.reports[0],id:'R02'};
  for (const bad of [{...extra,path:fx.file('outside.md')},{...extra,path:path.join(team.runDir,'reviews','escape.md')},{...extra,revision:''},{...extra,path:team.runDir+'/reports/../outside.md'},{...extra,formatted:false}]){
    const items=c.inventory(root,team,{...data,reports:[...data.reports,bad]});assert.equal(items.partial,true);assert.deepEqual(items.records.map(r=>r.id),['R01','V01']);
  }
  const duplicate=c.inventory(root,team,{...data,reports:[...data.reports,...data.reports]});assert.equal(duplicate.partial,true);assert.deepEqual(duplicate.records.map(r=>r.id),['V01']);
  await fs.appendFile(shown[0].path,'\nResearcher changed this report.\n');await assert.rejects(c.send({root,team,shown,read,verify}),/changed/);assert.equal(sent.length,1);
  const now=c.inventory(root,team,await read()).records;
  const switchOwner=async()=>{const d=await read();ws.items[0].path=fx.base;return d;};
  await assert.rejects(c.send({root,team,shown:now,read:switchOwner,verify}),/original/);assert.equal(sent.length,1);
  ws.items[0].path=root;ws.items.push({path:fx.base,sessionIds:[id]});assert.throws(verify,/original/);ws.items.pop();
  rows.byId[id].parentId='another';assert.throws(verify,/original/);delete rows.byId[id].parentId;
  state.registry.records[0].status='resolved';assert.throws(verify,/original/);state.registry.records[0].status='open';
  await assert.rejects(c.send({root,team,shown:[],read,verify}),/Choose between/);
  state.sessions.binding=()=>({...binding});await assert.rejects(c.send({root,team,shown:now,read,verify}),/changed/);assert.equal(sent.length,1);
});
