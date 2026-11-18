import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TEAM_PRESETS } from '../lib/team-templates.js';
// Installed DSH public shapes (modelCatalog/RemoteResult, retain().ready,
// workspaces.create, setEnabled(sessionId,true)); never access actual sessions.
const txt=(n)=>readFileSync(new URL(`../client/${n}.js`,import.meta.url),'utf8');
const src=txt('62-models')+'\n'+txt('66-teams');
function kit(){
  const calls=[],rows={phase:'ready',byId:{}};
  const k=new Function('externalStore','shortTitle','svc','atlasSendToSession',src+'\nreturn {atlasStartNativeTeam,atlasCrewCapabilities,atlasCrewErrors,atlasCrewDraft,atlasCrewFromTemplate,atlasTeamSeatStatus,atlasTeamRetrySeat};')(()=>({}),x=>x,()=>({list:{getSnapshot:()=>rows}}),async(id,text)=>calls.push(['send',id,text]));
  const topic={id:'fixture',title:'Fixture',file:'/fixture/research.md'}, overview={root:'/fixture',topics:{fixture:topic}};
  const draft=k.atlasCrewDraft(overview,{goal:'Check the fixture',topicId:'fixture',attachments:[{path:'/fixture/input.pdf'}]});draft.doneWhen='Both checks pass.';
  const route={provider:'demo',model:'fixture',effort:'deep'}, model={id:'fixture',name:'Test',reasoning:{efforts:[{id:'deep',name:'Deep'}]}};
  const catalog={default:{provider:'demo',model:'fixture'},routableProviders:['demo'],groups:[{id:'demo',models:[model]}]};
  const team={id:'team-a',created:1,seats:draft.seats,topic:draft.topic}; const ok=value=>({ok:true,value});
  const session={prompt:async (parts,mode)=>{calls.push(['prompt',parts,mode]);return ok({accepted:true});},rename:async title=>{calls.push(['rename',title]);return ok();}};
  const deps={catalog:async()=>{calls.push(['catalog']);return catalog;},select:async(id,choice)=>calls.push(['select',id,choice]),
    request:async(path,body,method)=>{calls.push(['request',path,body,method]);if(path==='review/baseline')return {watching:[team.topic.path]};return method==='PATCH'?{team:{...team,leadId:'lead-a',...body}}:{team,brief:'Exact rendered brief. Lead alone starts seats.'};},
    workspaces:{create:async args=>{calls.push(['workspace',args]);return {workspaceId:'ws'};}},
    sessions:{create:async opts=>{calls.push(['create',opts]);return 'lead-a';},retain:(id,opts)=>{calls.push(['retain',id,opts]);return {ready:Promise.resolve({session}),release:()=>calls.push(['release'])};}},
    teams:{setEnabled:async(...args)=>{calls.push(['enable',...args]);return ok();}}};
  return {k,calls,deps,draft,overview,session,catalog,route,team,rows,launch:()=>k.atlasStartNativeTeam({draft,root:overview.root,requestId:'launch-unique'},deps)};
}
test('native launch binds exactly one lead, enables its Agent Team, and sends the server-rendered brief only to that session',async()=>{
  const {calls,draft,launch,route}=kit();draft.leadModel=route;const r=await launch();assert.equal(r.leadId,'lead-a');
  assert.deepEqual(calls.map(c=>c[0]),['catalog','request','workspace','create','request','retain','select','enable','rename','request','prompt','request','release']);
  const first=calls[1];assert.equal(first[2].requestId,'launch-unique');assert.deepEqual(first[2].seats.map(s=>[s.name,s.model]),[['theorist',null],['referee',null]]);
  assert.deepEqual(calls[2],['workspace',{path:'/fixture'}]);assert.deepEqual(calls[3],['create',{workspaceId:'ws'}]);assert.deepEqual(calls[4],['request','teams/team-a',{leadId:'lead-a'},'PATCH']);assert.deepEqual(calls[6],['select','lead-a',route]);
  assert.deepEqual(calls[7],['enable','lead-a',true]);assert.match(calls[8][1],/^Atlas team · Fixture · /);assert.deepEqual(calls[9],['request','review/baseline',{session:'lead-a',files:[draft.topic.path]},undefined]);assert.deepEqual(calls[10],['prompt',[{type:'text',text:'Exact rendered brief. Lead alone starts seats.'}],'queue']);
});
test('global catalog is not seat authorization: rejects override, unusable provider, effort, missing service before scaffold',async()=>{
  for(const edit of [s=>{s.draft.seats[0].model=s.route;},s=>{s.draft.leadModel={...s.route,effort:'invented'};},s=>{s.catalog.routableProviders=[];},s=>{s.catalog.default={provider:'other',model:'unknown'};},s=>{s.deps.teams={};},s=>{s.deps.workspaces={};}]){
    const s=kit();edit(s);await assert.rejects(s.launch());assert.ok(s.calls.every(c=>c[0]==='catalog'));
  }
  const s=kit();await s.launch();assert.ok(!s.calls.some(c=>c[0]==='select')); // no override means no fabricated selection
});
test('failed, ambiguous or replayed launches never create another lead or replay a prompt',async()=>{
  for(const phase of ['enable','prompt','replay','patch']){
    const s=kit();if(phase==='enable')s.deps.teams.setEnabled=async()=>({ok:false,error:{message:'Teams refused'}});
    if(phase==='prompt')s.session.prompt=async()=>{s.calls.push(['attempt']);throw Error('Transport closed');};
    if(phase==='replay')s.deps.request=async()=>({team:{...s.team,leadId:'old'},brief:'existing',replayed:true});
    if(phase==='patch'){const req=s.deps.request;s.deps.request=async(p,b,m)=>{if(m==='PATCH')throw Error('Refused');return req(p,b,m);};}
    await assert.rejects(s.launch(),e=>e.team?.id==='team-a' && e.startedRequest && (phase!=='prompt' || e.attempted && /not confirmed/.test(e.message)));
    assert.equal(s.calls.filter(c=>c[0]==='create').length,phase==='replay'?0:1);assert.equal(s.calls.filter(c=>c[0]==='attempt').length,phase==='prompt'?1:0);assert.ok(!s.calls.some(c=>c[0]==='prompt'));assert.equal(s.calls.filter(c=>c[0]==='release').length,['enable','prompt'].includes(phase)?1:0);
  }
});
test('a missing, partial, wrong-case or rejected topic baseline blocks the first prompt and returns the bound lead',async()=>{
  for (const outcome of [null, {watching:[]}, {watching:['/fixture/other.md']}, {watching:['/fixture/RESEARCH.md']}, Error('baseline denied')]) {
    const s=kit(),request=s.deps.request;s.deps.request=async(p,b,m)=>{if(p!=='review/baseline')return request(p,b,m); if(outcome instanceof Error)throw outcome;return outcome;};
    await assert.rejects(s.launch(),e=>e.stage==='confirm topic review baseline' && e.team.leadId==='lead-a' && e.attempted===false);
    assert.ok(!s.calls.some(c=>c[0]==='prompt'));assert.equal(s.calls.at(-1)[0],'release');
  }
});
test('recording a receipt can fail after DSH has accepted: never resend and do not report it as an unsent prompt',async()=>{
  const s=kit(),request=s.deps.request;s.deps.request=async(p,b,m)=>{if(b.startedAt)throw Error('workspace changed');return request(p,b,m);};
  await assert.rejects(s.launch(),e=>e.accepted && e.team.leadId==='lead-a' && /DSH accepted the brief; do not resend/.test(e.message));assert.equal(s.calls.filter(c=>c[0]==='prompt').length,1);
});
test('template seats keep unique immutable meanings; invalid names, absent charter or forged custom role fail before submission',()=>{
  const {k,draft}=kit();assert.deepEqual(k.atlasCrewFromTemplate('literature-survey').map(s=>s.name),['literature','literature-2','referee']);
  for (const preset of TEAM_PRESETS) assert.deepEqual(k.atlasCrewFromTemplate(preset.id),preset.seats);
  assert.equal(k.atlasCrewFromTemplate('custom').length,0);assert.deepEqual(k.atlasCrewErrors(draft),{});
  const bad={...draft,topic:null,doneWhen:' ',seats:[{...draft.seats[0],name:'lead'},{...draft.seats[0],name:'com1'},{...draft.seats[1],role:'custom'}]};assert.deepEqual(Object.keys(k.atlasCrewErrors(bad)),['doneWhen','topic','seat0','seat1','seat2']);
  assert.ok(k.atlasCrewErrors({...draft,seats:[draft.seats[0],draft.seats[0]]}).seat1);assert.deepEqual(draft.inputs,['/fixture/input.pdf']);
});
test('seat evidence requires the correct parent catalog; no fake failures, timer or acknowledgement for unobservable/missing/foreign seats',async()=>{
  const {k,draft,team:t,rows,calls}=kit(),team={...t,leadId:'lead-a',created:1,startedAt:50},seat=draft.seats[0],lead={id:team.leadId,projectionValues:{subagentCatalog:[]}};rows.byId[team.leadId]=lead;
  assert.equal(k.atlasTeamSeatStatus(team,seat,{},999999).state,'unknown');assert.equal(k.atlasTeamSeatStatus(team,seat,{id:'lead-b',projectionValues:lead.projectionValues},999999).state,'unknown');
  assert.equal(k.atlasTeamSeatStatus(team,seat,lead,180049).state,'starting');assert.equal(k.atlasTeamSeatStatus(team,seat,lead,180050).state,'not-started');
  await k.atlasTeamRetrySeat(team,seat);assert.deepEqual(calls[0].slice(0,2),['send','lead-a']);assert.match(calls[0][2],/theorist/);
  lead.projectionValues.subagentCatalog.push({mode:'continuable',id:'real-child',name:seat.name,createdAt:8});assert.deepEqual(k.atlasTeamSeatStatus(team,seat,lead,999999,rows),{state:'unknown',id:'real-child',error:''});
  rows.byId['real-child']={parentId:'lead-a',running:true};assert.equal(k.atlasTeamSeatStatus(team,seat,lead,999999,rows).state,'running');rows.byId['real-child'].parentId='lead-b';assert.equal(k.atlasTeamSeatStatus(team,seat,lead,999999,rows).id,null);
  await assert.rejects(k.atlasTeamRetrySeat(team,seat));assert.equal(calls.length,1);
});
