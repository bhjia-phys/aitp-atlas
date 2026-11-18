import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { createDiscussions } from '../lib/discussions.js';

async function fixture(t) {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'atlas-registry-'));
  t.after(() => fs.rm(tmp, { recursive:true, force:true }));
  const root = path.join(tmp, 'research'); const stateDir = path.join(tmp,'interface');
  const topics = new Map(['', 'worm', 'edge'].map((id) => [id,{ id, file:path.join(root,id,'research.md'), title:id || 'Programme' }]));
  const atlas = {root,topics}; const store = createDiscussions({root,stateDir},{now:()=>300});
  return {tmp, store, atlas, stateDir, root};
}

test('scoped atomic create/patch/import, partial migrations from multiple windows, restart', async (t) => {
  const {store,atlas,root,stateDir,tmp} = await fixture(t);
  const rec = {id:'s1',title:'An edge',created:100,seenAt:150,origin:'desk',topic:'edge',filing:'auto'};
  const {discussion:d} = await store.create(atlas,rec);
  assert.equal(d.topic.path,atlas.topics.get('edge').file); assert.equal(d.filing,'auto');
  assert.deepEqual((await store.create(atlas,{...rec,title:'duplicate'})).discussion,d);
  const other = createDiscussions({root,stateDir});
  await Promise.all([store.patch(atlas,'s1',{pinned:true}), other.patch(atlas,'s1',{lastTurnAt:650,seenAt:550})]);
  await store.patch(atlas,'s1',{seenAt:125,lastTurnAt:120}); await store.patch(atlas,'s1',{title:'An edge result'});
  const [saved] = await other.list({topic:'edge',q:'result'}); assert.equal(saved.lastTurnAt,650); assert.equal(saved.seenAt,550); assert.equal(saved.pinned,true);
  const batch = [{id:'s1'}, {id:'new',context:{topic:{id:'worm',path:atlas.topics.get('worm').file}}}, {id:'retry',topic:{id:'edge',path:path.join(tmp,'unrelated')}}, {id:'legacy',kind:'team'}];
  const ack = await store.import(atlas,batch); assert.deepEqual([ack.imported,ack.existing,ack.rejected.map(x=>x.id),ack.legacyTeamIds], [1,1,['retry'],['legacy']]);
  const retry = await store.import(atlas,[{id:'new'},{id:'retry',topic:'edge'},{id:'browser-two'}]); assert.deepEqual([retry.imported,retry.existing], [2,1]);
  assert.deepEqual((await other.list({topic:'unfiled'})).map(x=>x.id), ['browser-two']);
  assert.deepEqual(await createDiscussions({stateDir,root:path.join(tmp,'unrelated')}).list(), []);
  assert.equal((await store.list()).length,4);
  await assert.rejects(store.create(atlas,{id:'s3',context:{doc:{path:path.join(tmp,'outside.md')}}}), /outside/);
  await assert.rejects(store.create(atlas,{id:'../also-outside'}), /session id/);
  await assert.rejects(store.patch(atlas,'missing',{pinned:true}), e=>e.statusCode === 404);
});

test('move, undo and delayed delivery use latest-move compare-and-set, not a browser-local timer lock', async (t) => {
  const {store,atlas} = await fixture(t);
  await store.create(atlas,{id:'a',filing:'auto',topic:'worm'});
  const move = (to, token) => store.patch(atlas,'a',{topic:{to,token,told:false}}).then(x=>x.discussion.moves.at(-1));
  const first = await move('edge','m1'); assert.equal(first.from,'worm'); assert.equal(first.to,'edge'); assert.equal(first.told,false);
  const un = await store.patch(atlas,'a',{undoMove:first.at}); assert.equal(un.discussion.topic.id,'worm'); assert.equal(un.discussion.filing,'auto');
  const second = await move(null,'m2'); const third = await move('edge','m3'); assert.notEqual(third.at,second.at);
  assert.equal((await store.patch(atlas,'a',{claimMove:second.at})).claimed,false);
  const replies = await Promise.all([store.patch(atlas,'a',{claimMove:third.at}),store.patch(atlas,'a',{claimMove:'m3'})]); assert.deepEqual(replies.map(x=>x.claimed), [true,false]);
  await assert.rejects(store.patch(atlas,'a',{undoMove:third.at}), e=>e.statusCode===409);
  const sent = await store.patch(atlas,'a',{toldMove:third.at}); assert.equal(sent.discussion.moves.at(-1).told,true);
  const duplicate = await move('edge','m3'); assert.equal(duplicate.at, third.at); assert.equal(sent.discussion.moves.length,2);
  await assert.rejects(store.patch(atlas,'a',{movedTo:'a'}), e=>e.statusCode===400);
  const handoffs = await Promise.allSettled(['dst-a','dst-b'].map(movedTo=>store.patch(atlas,'a',{movedTo})));
  assert.deepEqual(handoffs.map(x=>x.status),['fulfilled','rejected']); assert.equal(handoffs[1].reason.statusCode,409);
  assert.equal((await store.patch(atlas,'a',{movedTo:'dst-a'})).discussion.movedTo,'dst-a');
});

test('failure between temporary write and rename leaves last published state readable and write queue usable', async (t) => {
  const {store,atlas,stateDir,root} = await fixture(t);
  await store.create(atlas,{id:'survives',title:'original'});
  const fail = createDiscussions({stateDir,root}, {beforeRename:()=>{ throw new Error('simulated power loss before publication'); }});
  await assert.rejects(fail.patch(atlas,'survives',{title:'unfinished'}), /power loss/);
  assert.equal((await store.list())[0].title,'original');
  assert.equal((await store.patch(atlas,'survives',{title:'recovered'})).discussion.title,'recovered');
  // An abruptly terminated host cannot execute finally/unlink. The unpublished temp must not be loaded on restart.
  const child = `import {createDiscussions} from ${JSON.stringify(new URL('../lib/discussions.js',import.meta.url).href)}; const settings=JSON.parse(process.argv[1]); await createDiscussions(settings,{beforeRename(){process.exit(71)}}).patch({},'survives',{title:'never published'});`;
  const crash = spawnSync(process.execPath, ['--input-type=module','-e',child,JSON.stringify({stateDir,root})], {stdio:'inherit'});
  assert.equal(crash.status,71); assert.equal((await createDiscussions({stateDir,root}).list())[0].title,'recovered');
  const [sub] = await fs.readdir(path.join(stateDir,'workspaces'));
  const file = path.join(stateDir,'workspaces',sub,'discussions.json');
  await fs.writeFile(file,'{');
  await assert.rejects(store.create(atlas,{id:'b'}), /untouched/); assert.equal(await fs.readFile(file,'utf8'),'{');
});
