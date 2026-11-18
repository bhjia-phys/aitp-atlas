import test from 'node:test';
import assert from 'node:assert/strict';
import { appendFile } from 'node:fs/promises';
import { loadAtlas } from '../lib/atlas.js';
import { routeTopics } from '../lib/route.js';
import { makeFixture } from './fixture.mjs';

const NOW = Date.UTC(2026, 10, 18);
test('local topic routing: six retrieval questions on an actual fixture snapshot, contributions and uncertainty', async () => {
  const fx = await makeFixture();
  try {
    const atlas = await loadAtlas({ root: fx.root });
    const questions = [
      ['Is the worm sampler equilibrating reproducibly?', 'mc/worm', 'sampler'],
      ['How does the Pade ensemble choose the real frequency continuation window?', 'mc/continuation', 'pade'],
      ['How are topological insulators related to quantized response?', 'topology', 'insulators'],
      ['Will sampling stability survive a longer run of the estimator?', 'mc/worm/stability', 'longer'],
      ['Who owns the orphan decision nobody links?', 'orphan', 'decision'],
      ['What is the worm upstream packaging release owner?', 'mc/worm', 'upstream'],
    ];
    for (const [q, id, term] of questions) {
      const r = routeTopics(atlas, q, '', NOW);
      assert.equal(r.candidates[0].topic.id, id, q);
      assert.ok(r.confident, q);
      assert.ok(r.candidates[0].reasons.includes(term), q);
      assert.equal(r.candidates[0].topic.path, atlas.topics.get(id).file);
      assert.ok(r.candidates.length <= 5 && !r.candidates.some((c) => !c.topic.id));
    }
    assert.equal(routeTopics(atlas, 'the estimator', '', NOW).confident, false, 'shared words must not auto-file');
    assert.deepEqual(routeTopics(atlas, 'knitting embroidery', '', NOW), { candidates: [], confident: false });
    assert.deepEqual(routeTopics(atlas, 'how do we', '', NOW), { candidates: [], confident: false });
    assert.equal(routeTopics(atlas, 'the Berry phase').candidates[0].topic.id, 'mc/worm', 'linked knowledge entry titles are indexed');
    assert.deepEqual(routeTopics(atlas, '\\textbf{Padé} ensemble', '', NOW), routeTopics(atlas, 'Pade ensemble', '', NOW));
    await appendFile(fx.file('topics/topology/research.md'), '\n## Agreed choices\n\nUse the non-Abelian holonomy.\n\n**Keywords:** fibration\n');
    const newer = await loadAtlas({ root: fx.root });
    assert.equal(routeTopics(newer, 'holonomy fibration').candidates[0].topic.id, 'topology');
    assert.equal(routeTopics(atlas, 'holonomy fibration').candidates.length, 0, 'corpora cache follows the store snapshot');
  } finally { await fx.cleanup(); }
});

test('300-topic corpus: cold indexing + warm ranking within interactive budget', (t) => {
  const topics = new Map();
  for (let i = 0; i < 300; i++) {
    const id = `study/${i}`;
    topics.set(id, { id, title: `The spectral analysis of system ${i}`, file: `/${id}/research.md`, routeOpening: 'We compare the equilibration time of the stochastic fit to the resolvent and track its variance across volumes.', threads: [{ name: `Gap sweep in system ${i}`, date: '2026-11-15' }], routeKeywords: i === 232 ? 'Berezinskii helicity vortex' : 'finite volume scaling' });
  }
  const atlas = { topics };
  const start = performance.now();
  assert.equal(routeTopics(atlas, 'Berezinskii helicity vortex', '', NOW).candidates[0].topic.id, 'study/232');
  const cold = performance.now() - start;
  const queries = ['variance across volumes', 'spectral gap', 'Berezinskii helicity vortex', 'finite volume scaling'];
  const worst = Math.max(...queries.map((q) => { const begin = performance.now(); routeTopics(atlas, q, '', NOW); return performance.now() - begin; }));
  t.diagnostic(`300 topics: cold ${cold.toFixed(1)} ms; slowest warm rank ${worst.toFixed(1)} ms`);
  assert.ok(cold < 150 && worst < 150);
});
