import test from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {makeFixture,snapshot} from './fixture.mjs';
import {createTeams} from '../lib/teams.js';
const decision='---\nkind: decision\nid: D01\nfrom: lead\nstatus: open\nquestion: Compare the smaller lattice?\noptions:\n  A: Wait for the researcher\n  B: Use existing observations\nrecommendation: B\n---\n\n# Which evidence?\n\nstatus: open\n';
async function fixture(t){const fx=await makeFixture(); t.after(fx.cleanup);const file=fx.file('topics/mc/worm/research.md'),topic={id:'mc/worm',title:'Worm',path:file};
  const atlas={root:fx.root,topics:new Map([[topic.id,{...topic,file}]])},settings={root:fx.root,stateDir:fx.file('ui')},api=createTeams(settings);
  const draft={topic,requestId:'launch-1',name:'Ward check',goal:'Does this relation hold?',doneWhen:'Test its limit.',template:'custom',seats:[{name:'referee',role:'referee'}]};
  return {fx,api,settings,draft,atlas};}
const code=status=>e=>e.statusCode===status;

test('preview is read-only; concurrent explicit Start writes the charter once, safe collisions, seat append, lead binding and event cursors',async t=>{
  const {fx,api,settings,draft,atlas}=await fixture(t), snap=await snapshot(fx.base);
  const preview=await api.preview(atlas,draft);assert.deepEqual(await snapshot(fx.base),snap);
  const b=createTeams(settings);const [first,retry]=await Promise.all([api.create(atlas,draft),b.create(atlas,draft)]);
  assert.equal(first.replayed,false);assert.equal(retry.replayed,true);const team=first.team;
  assert.equal(first.brief,preview.brief);assert.equal(team.id,retry.team.id);assert.ok(first.seatCalls[0].prompt.includes('roles/referee.md'));
  assert.ok((await fs.stat(path.join(team.runDir,'work','lead'))).isDirectory());
  const charter=path.join(team.runDir,'charter.md');const original=await fs.readFile(charter,'utf8');
  await assert.rejects(api.create(atlas,{...draft,requestId:'also'}),code(409)); await assert.rejects(api.create(atlas,{...draft,goal:'Different'}),code(409));
  assert.equal((await api.patch(team.id,{leadId:'dsh-lead'})).team.leadId,'dsh-lead');await assert.rejects(b.patch(team.id,{leadId:'another'}),code(409));
  const seat={name:'new-member',role:'numerics',task:'Compare saved measurements.'},one=await api.addSeat(atlas,team.id,seat);
  assert.equal(one.call.name,'new-member');assert.ok(one.call.prompt.includes(seat.task));assert.equal((await b.addSeat(atlas,team.id,seat)).replayed,true);
  await assert.rejects(b.addSeat(atlas,team.id,{...seat,task:'Different'}),code(409));
  assert.equal(await fs.readFile(charter,'utf8'),original,'appending a member must not overwrite the original charter');
  const event={id:'obs:task-3:complete',type:'board',text:'Observed complete',taskId:'task-3'};
  await Promise.all([api.observe(team.id,[event]),b.observe(team.id,[event])]);assert.equal((await api.events(team.id)).events.length,1);
  const logged=(await api.events(team.id)).events[0];assert.equal(logged.observed,true);assert.deepEqual((await api.events(team.id,logged.at)).events,[]);
  assert.equal((await b.list(atlas)).teams[0].closing,false);
});

test('decision revision, duplicate IDs, concurrent responders, reload and no implicit execution or duplicate notification',async t=>{
  const {api,settings,draft,atlas}=await fixture(t),{team}=await api.create(atlas,draft);const dir=path.join(team.runDir,'decisions');
  const file=path.join(dir,'something-not-the-id.md'); await fs.writeFile(file,decision);const [shown]=(await api.artifacts(atlas,team.id)).decisions;
  assert.equal(shown.id,'D01');assert.equal((await api.needs(atlas)).decisions[0].question,shown.question);
  const body={choice:'B',note:'Use the saved comparison.',revision:shown.revision};
  const dup=path.join(dir,'duplicate.md');await fs.writeFile(dup,decision);await assert.rejects(api.answer(atlas,team.id,'D01',body),code(409));await fs.unlink(dup);
  await fs.writeFile(file,decision+'\nHuman annotation.\n');await assert.rejects(api.answer(atlas,team.id,'D01',body),code(409));
  body.revision=(await api.artifacts(atlas,team.id)).decisions[0].revision;
  await assert.rejects(api.answer(atlas,team.id,'D01',{...body,choice:'C'}),code(400));
  const b=createTeams(settings),[first,replay]=await Promise.all([api.answer(atlas,team.id,'D01',body),b.answer(atlas,team.id,'D01',body)]);
  assert.deepEqual([first.replayed,replay.replayed],[false,true]);assert.equal(first.message,'Decision D01 answered: B. Use the saved comparison.');
  assert.ok(first.decision.status==='answered');assert.equal((await api.needs(atlas)).decisions.length,0);
  const text=await fs.readFile(file,'utf8');assert.equal((text.match(/## Answer \(/g)||[]).length,1);assert.match(text,/status: open\n\nHuman annotation/);
  await assert.rejects(b.answer(atlas,team.id,'D01',{...body,choice:'A'}),code(409));
});

test('partially unreadable artifacts keep verified decisions visible; only uncertainty in decisions prevents answering',async t=>{
  const {api,atlas,draft}=await fixture(t),{team}=await api.create(atlas,draft),run=team.runDir;
  const decisionFile=path.join(run,'decisions','chosen.md');await fs.writeFile(decisionFile,decision);
  await fs.writeFile(path.join(run,'reports','large.md'),'x'.repeat(512*1024+1));await fs.unlink(path.join(run,'state.md'));
  const partial=await api.artifacts(atlas,team.id);assert.deepEqual(partial.errors.map(e=>e.area),['reports','state']);assert.equal(partial.decisions[0].answerable,true);
  const [summary]=(await api.list(atlas)).teams;assert.equal(summary.counts.openDecisions,1);assert.equal(summary.partial,true);
  const sibling=path.join(run,'decisions','oversized.md'); await fs.writeFile(sibling,'x'.repeat(512*1024+1));
  const needs=await api.needs(atlas);assert.equal(needs.decisions.length,1);assert.equal(needs.decisions[0].answerable,false);assert.ok(needs.teamErrors.length);
  const body={revision:partial.decisions[0].revision,choice:'A',note:''};await assert.rejects(api.answer(atlas,team.id,'D01',body),e=>e.statusCode===409 && /partial/.test(e.message));
  await fs.unlink(sibling);assert.equal((await api.answer(atlas,team.id,'D01',body)).decision.status,'answered');
});

test('confined regular files: reject cross-root topic, linked runs, artifact links and occupied role cards',async t=>{
  const {fx,api,settings,draft,atlas}=await fixture(t);
  await assert.rejects(api.create(atlas,{...draft,topic:{...draft.topic,path:fx.file('private.md')}}),code(403));
  await assert.rejects(api.create(atlas,{...draft,seats:[{name:'../escape',role:'numerics'}]}),code(400));
  const external=fx.file('outside');await fs.mkdir(external);const runs=path.join(path.dirname(draft.topic.path),'runs');await fs.symlink(external,runs,'junction');
  await assert.rejects(api.create(atlas,draft),code(403));assert.deepEqual(await fs.readdir(external),[]);await fs.unlink(runs);
  const {team}=await api.create(atlas,draft),existing=path.join(team.runDir,'roles','writer.md');await fs.writeFile(existing,'original');
  await assert.rejects(api.addSeat(atlas,team.id,{name:'writer',role:'writer'}),code(409));assert.equal(await fs.readFile(existing,'utf8'),'original');
  const linked=path.join(team.runDir,'decisions','inbound.md'),secret=fx.file('outside/secret.md');await fs.writeFile(secret,decision);await fs.link(secret,linked);
  const partial=await api.artifacts(atlas,team.id);assert.ok(partial.errors.some(e=>e.area==='decisions'));assert.equal(partial.decisions.length,0);
  await assert.rejects(api.answer(atlas,team.id,'D01',{choice:'A',note:'',revision:'0'.repeat(64)}),e=>e.statusCode===409 && /partial/.test(e.message));
  assert.equal(await fs.readFile(secret,'utf8'),decision);assert.ok((await api.list(atlas)).teams[0].artifactError);
  const elsewhere=createTeams({...settings,root:external});assert.deepEqual(await elsewhere.list({...atlas,root:external}),{teams:[]});
});

test('a second Host or crash-left lock is never stolen and readonly requests do not need it',async t=>{
  const {api,atlas,draft,settings}=await fixture(t),{team}=await api.create(atlas,draft);
  const parents=path.join(settings.stateDir,'workspaces'),[sub]=await fs.readdir(parents), lock=path.join(parents,sub,'teams.write.lock');
  await fs.writeFile(lock,'other host is still publishing',{flag:'wx'});
  await assert.rejects(api.patch(team.id,{paused:true}),e=>e.statusCode===409 && /locked/.test(e.message));
  assert.equal(await fs.readFile(lock,'utf8'),'other host is still publishing');assert.equal((await api.list(atlas)).teams[0].paused,false);
});

test('incremental legacy team import is read-only and never follows legacy run pointers',async t=>{
  const {api,atlas,draft,fx}=await fixture(t);await api.create(atlas,draft);const snap=await snapshot(fx.root);
  const old={id:'old-1',kind:'team',title:'Imported',context:{topic:draft.topic},reportDir:fx.file('outside')};
  const ack=await api.import(atlas,[old,{...old,id:'old-2',context:{topic:{...draft.topic,path:'outside'}}}]);assert.equal(ack.imported,1);assert.equal(ack.rejected[0].id,'old-2');
  const retry=await api.import(atlas,[old,{...old,id:'old-2'}]);assert.equal(retry.imported,1);assert.equal(retry.existing,1);
  const imported=(await api.list(atlas)).teams.find(t=>t.legacy);assert.equal(imported.runDir,null);assert.equal(imported.leadId,'old-1');
  await assert.rejects(api.patch(imported.id,{paused:true}),code(403)); await assert.rejects(api.observe(imported.id,[]),code(403));await assert.rejects(api.addSeat(atlas,imported.id,{}),code(403));await assert.rejects(api.answer(atlas,imported.id,'D01',{}),code(403));
  assert.deepEqual(await snapshot(fx.root),snap);
});
