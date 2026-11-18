import assert from 'node:assert/strict';
import { readFileSync, promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createDiscussions } from '../lib/discussions.js';

const tabs = readFileSync(new URL('../client/72-tabs.js', import.meta.url), 'utf8');
const observe = new Function('rowOf', tabs + '\nreturn discussionObservations;')((rows,id) => rows?.byId?.[id]);
function observer() {
  let previous = new Map();
  return (record,running,visible=false,number) => {
    const row = { running, ...(number && {projectionValues:{turnBoundary:{lastTurn:number,openTurnStartSeq:running ? number*3 : null}}}) };
    const {snapshots,patches} = observe(previous,[record],{byId:{s:row},phase:'ready'},visible?['s']:[]);
    previous = snapshots; return patches[0]?.patch;
  };
}
async function fixture(t) {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(),'atlas-unread-race-'));
  t.after(() => fs.rm(tmp,{recursive:true,force:true}));
  const root=path.join(tmp,'fictional-root'),stateDir=path.join(tmp,'state');
  const atlas = {root,topics:new Map()};
  // Different mounted owners of the same registry; a ticking fake host clock
  // ensures duplicate writes cannot appear idempotent merely by chance.
  let clock=199;
  const store=()=>createDiscussions({root,stateDir},{now:()=>++clock});
  const [a,b]=[store(),store()];
  const {discussion:record}=await a.create(atlas,{id:'s',title:'Fixture'});
  return {record,sendA:async p=>(await a.patch(atlas,'s',p)).discussion,sendB:async p=>(await b.patch(atlas,'s',p)).discussion};
}
for (const firstSeen of [true,false]) test(`two windows, ${firstSeen?'visible':'hidden'} first: a refresh while running cannot turn one completion into two`,async t=>{
  const {record:r,sendA,sendB}=await fixture(t), A=observer(),B=observer();
  A(r,true,firstSeen); B(r,true,!firstSeen);
  const first=await sendA(A(r,false,firstSeen));
  assert.equal(first.lastTurnAt > first.seenAt,!firstSeen);
  B(first,true,!firstSeen); // faster window's completed version arrives mid-turn
  const duplicate=B(first,false,!firstSeen);
  assert.equal(duplicate.observeTurn.after,r.lastTurnAt);
  const second=await sendB(duplicate); assert.equal(second.lastTurnAt,first.lastTurnAt);
  assert.equal(second.seenAt,first.lastTurnAt); assert.equal(second.updated,first.updated);
  const replay=await sendB(duplicate); assert.deepEqual(replay,second);
});
test('late completed/visibility observations and cold visit receipts cannot mark the next hidden turn as seen',async t=>{
  const {record:r,sendA,sendB}=await fixture(t),A=observer(),B=observer(),visit=observer();
  A(r,true); B(r,true,true);
  const one=await sendA(A(r,false));
  const late=B(r,false,true); const read=visit(one,false,true);
  assert.deepEqual(read,{readTurn:one.lastTurnAt});
  A(one,true);const two=await sendA(A(one,false));
  assert.ok(two.lastTurnAt>one.lastTurnAt); assert.ok(two.lastTurnAt>two.seenAt);
  for(const patch of [late,read,late])assert.deepEqual(await sendB(patch),two);
  // A registry refresh in a still-visible but lagging window is NOT a view event.
  assert.equal(B(two,false,true),undefined); assert.equal(visit(two,false,true),undefined);
  const seen=await sendA(A(two,false,true)); assert.equal(seen.seenAt,two.lastTurnAt);
});
test('stable DSH turn ordinal deduplicates even when windows sampled different predecessors and the first ordinal arrived late',async t=>{
  const {record:r,sendA,sendB}=await fixture(t),A=observer(),B=observer();
  A(r,true,false,7);const one=await sendA(A(r,false,false,7));
  // This window's DSH catalog is behind the registry, but it identifies turn 7.
  B(one,true,true,7);const dup=B(one,false,true,7);
  assert.equal(dup.observeTurn.number,7);let seen=await sendB(dup);assert.equal(seen.seenAt,one.lastTurnAt);assert.equal(seen.lastTurnAt,one.lastTurnAt);
  // The next known ordinal can prove a newer completion even with a stale base.
  A(r,true,false,8);const two=await sendA(A(r,false,false,8));assert.ok(two.lastTurnAt>seen.seenAt);
  assert.deepEqual(await sendB(dup),two);assert.deepEqual(await sendA({readTurn:one.lastTurnAt}),two);
  await assert.rejects(sendB({lastTurnAt:999,seenAt:999}),e=>e.code==='UNBOUND_OBSERVATION');
});
test('a mixed-capability peer can attach a real ordinal without manufacturing another completion',async t=>{
  const {record:r,sendA,sendB}=await fixture(t),A=observer(),B=observer();
  A(r,true); B(r,true,true,4);
  const unknown=await sendA(A(r,false));const identified=await sendB(B(r,false,true,4));
  assert.equal(identified.lastTurnAt,unknown.lastTurnAt);assert.equal(identified.seenAt,unknown.lastTurnAt);assert.equal(identified.turnObservation.number,4);
  assert.deepEqual(await sendB({observeTurn:{after:0,number:3,seen:true}}),identified);
});
