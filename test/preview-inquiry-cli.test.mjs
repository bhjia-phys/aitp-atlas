import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { makeFixture, snapshot } from './fixture.mjs';
import { previewCliOptions } from '../scripts/preview.mjs';
import { startModel } from '../scripts/preview-model.mjs';
import { readInquiryFigure } from '../lib/inquiry-figure.js';
import { loadAtlas } from '../lib/atlas.js';

const opts = previewCliOptions(['--inquiry']);
const stepsFromGuide = text => Array.from(text.matchAll(/^  [1-4] \([^)]+\): (.+)$/gm), m=>m[1]);

test('inquiry requires an explicit exclusive switch and accepts no external source or path', () => {
  for (const args of [[],['--debug'],['--team']]) assert.equal(previewCliOptions(args).seedFixture, undefined);
  for (const args of [['--team','--inquiry'],['--inquiry','--debug','--team'],['--inquiry','--inquiry'],['--inquiry','--root','private'],['--inquiry=http://outside.invalid']]) {
    assert.throws(()=>previewCliOptions(args),/Usage:/);
  }
  assert.equal(previewCliOptions(['--debug','--inquiry']).debug,true);
});

test('seeding adds only a discoverable synthetic topic and the exact cited comparison, once', async t => {
  const fx = await makeFixture(); t.after(fx.cleanup);
  await assert.rejects(opts.seedFixture({...fx,root:fx.knowledge}),/fresh Atlas fixture/);
  const before = await snapshot(fx.base); await opts.seedFixture(fx);
  const after = await snapshot(fx.base);
  for (const [file,stat] of Object.entries(before)) assert.equal(after[file],stat,file);
  assert.deepEqual(Object.keys(after).filter(k=>!Object.hasOwn(before,k)).map(k=>k.split(path.sep).join('/')).sort(),
    ['topics/ads/comparison.md','topics/ads/research.md','topics/ads/traces.atlas-figure.json','topics/ads/traces.csv']);
  assert.equal((await loadAtlas({root:fx.root,knowledge:fx.knowledge})).topics.get('ads').title,'Schwarzschild–AdS (schematic fixture)');
  const table = await readInquiryFigure(fx.root,'ads/traces.atlas-figure.json');
  assert.equal(table.kind,'schematic'); assert.deepEqual(table.rows[2],[2,0.45,0.62]);
  await assert.rejects(opts.seedFixture(fx),{code:'EEXIST'}); assert.deepEqual(await snapshot(fx.base),after);
});

test('the printed prompts unlock four text-only native turns in order, without tools or scheduling', {timeout:15000}, async t => {
  const model = await startModel(); t.after(()=>model.close());
  const guide = opts.prepare({model}); const prompts = stepsFromGuide(guide);
  assert.equal(prompts.length,4); assert.match(guide,/edit a first task/); assert.match(guide,/Cancel; do NOT start/);
  const js = await fs.readFile(new URL('../client/23-inquiry-data.js',import.meta.url),'utf8');
  const parse = new Function('text',`${js}\nreturn inquiryReplyCard({seq:17,type:'assistant/message',data:{message:{role:'assistant',source:{kind:'model'},content:[{type:'text',text}]}}});`);
  const turn = async (prompt,tools=[{name:'read'}]) => {
    const resp = await fetch(model.url+'/v1/messages',{method:'POST',headers:{'x-api-key':model.key},signal:AbortSignal.timeout(3000),
      body:JSON.stringify({messages:[{role:'user',content:prompt}],tools})});
    assert.equal(resp.status,200); const events=(await resp.text()).split('\n').filter(s=>s.startsWith('data: ')).map(s=>JSON.parse(s.slice(6)));
    assert.equal(events.find(e=>e.content_block)?.content_block.type,'text');
    assert.equal(events.find(e=>e.delta?.stop_reason)?.delta.stop_reason,'end_turn');
    return events.filter(e=>e.delta?.type==='text_delta').map(e=>e.delta.text).join('');
  };
  for (const [p,tools] of [[prompts[0],[]],[prompts[2],undefined]]) assert.match(await turn(p,tools),/This is the Atlas fixture/);
  const teaching = await turn('Researcher request:\n'+prompts[0]); assert.match(teaching,/A peak on a spatial slice gives no arrival time/); assert.equal(parse(teaching),null);
  assert.match(await turn(prompts[0]),/This is the Atlas fixture/,'consumed marker cannot replay or advance');
  const route = parse(await turn(prompts[1])); assert.equal(route.edges.length,3); assert.equal(route.edges[0].from,route.edges[1].from); assert.equal(route.proposal,undefined);
  const plan = parse(await turn(prompts[2])); assert.deepEqual(plan.proposal.seats.map(s=>s.role),['numerics','referee']); assert.ok(plan.proposal.seats.every(s=>s.task)); assert.equal(plan.result,undefined);
  const result = parse(await turn(prompts[3])); assert.equal(result.figure.source,'ads/traces.atlas-figure.json'); assert.match(result.result.limits,/Invented samples/); assert.equal(result.proposal,undefined);
  assert.match(await turn(prompts[3]),/This is the Atlas fixture/,'script has ended');
});
