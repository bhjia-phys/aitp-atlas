/**
 * Reviewing what a discussion changed: Atlas keeps copies of the notes in a
 * discussion's scope (the topic note, its parent and branches), lists each
 * edit with its section, puts earlier text back on Revert only where the note
 * still shows the edit, and moves its copy forward on Keep. The copies live in
 * Atlas's state folder, outside the research.
 */
import assert from 'node:assert/strict';
import { promises as fsp } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable, Writable } from 'node:stream';
import test from 'node:test';
import { apply } from '../index.js';
import { createReview, diffLines, editsOf, placeOf } from '../lib/review.js';
import { makeFixture, snapshot } from './fixture.mjs';

test('review: line edits, and where each sits', () => {
  assert.deepEqual(diffLines(['a', 'b', 'c'], ['a', 'B', 'c']), [{ aStart: 1, aEnd: 2, bStart: 1, bEnd: 2 }]);
  assert.deepEqual(diffLines(['a', 'c'], ['a', 'b', 'c']), [{ aStart: 1, aEnd: 1, bStart: 1, bEnd: 2 }]);
  assert.deepEqual(diffLines(['a', 'x', 'b', 'y', 'c'], ['a', 'b', 'c']), [{ aStart: 1, aEnd: 2, bStart: 1, bEnd: 1 }, { aStart: 3, aEnd: 4, bStart: 2, bEnd: 2 }]);
  assert.deepEqual(diffLines(['same'], ['same']), []);
  const note = ['# Title', '', '**The answer so far.** Chaotic.', '', '## Current work', '', '- **Sweep** — active · 2026-11-02. Text.', '  more'];
  assert.equal(placeOf(note, 2), 'Opening · The answer so far');
  assert.equal(placeOf(note, 7), 'Current work · Sweep');
  assert.equal(placeOf(['\\section{Model}', 'On a ring'], 1), 'Model');
  const edits = editsOf('x\ny\nx\n', 'x\nY\nx\n');
  assert.equal(edits.length, 1);
  assert.deepEqual([edits[0].removed, edits[0].added, edits[0].line], [['y'], ['Y'], 2]);
  assert.match(edits[0].id, /^[0-9a-f]{12}-1$/);
});

test('review: two sessions and a human edit are a shared observation, never a per-discussion rollback', async t => {
  const fx = await makeFixture(); t.after(() => fx.cleanup());
  const stateDir = fx.file('review-state');
  const a = createReview({ stateDir, workspace: fx.root });
  const b = createReview({ stateDir, workspace: fx.root });
  const file = fx.file('topics/mc/worm/research.md');
  await Promise.all([a.baseline('first', [file]), b.baseline('second', [file])]);
  const human = (await fsp.readFile(file, 'utf8')) + '\nHuman correction after both comparisons began.\n';
  await fsp.writeFile(file, human);
  for (const id of ['first', 'second']) {
    const [{ edits, shared }] = (await a.changes(id)).files;
    assert.equal(shared, true); await assert.rejects(a.revert(id, file, edits[0].id), e => e.statusCode === 409);
  }
  assert.deepEqual(await b.rollup(['first','second','first'], () => true), [{session:'first',edits:1,shared:true},{session:'second',edits:1,shared:true}]);
  assert.deepEqual(await a.rollup(['first'], () => false), []);
  await a.keep('first', file, 'all'); await a.forget('first');
  const reloaded = createReview({ stateDir, workspace: fx.root });
  const remaining = (await reloaded.changes('second')).files[0];
  assert.ok(remaining.shared); await assert.rejects(reloaded.revert('second', file, remaining.edits[0].id), /will not revert/);
  assert.equal(await fsp.readFile(file, 'utf8'), human);
});

const COOKIE = 'dsh-browser=signed';

function host(config) {
  const routes = new Map();
  const web = { effect: (fn) => fn(), webServer: { register: (route) => routes.set(route.path, route) }, get: (name) => (name === 'connection' ? { requestRejection: (req) => (String(req.headers.cookie || '').includes(COOKIE) ? undefined : 401) } : undefined) };
  apply({ effect: (fn) => fn(), get: () => undefined, inject: (_names, fn) => fn(web) }, config);
  return routes;
}

async function call(routes, method, name, { query = '', body } = {}) {
  const route = routes.get(`/aitp-atlas/api/${name}`);
  assert.ok(route, name);
  const req = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))]);
  req.method = method;
  req.url = `/aitp-atlas/api/${name}${query ? '?' + query : ''}`;
  req.headers = { host: '127.0.0.1:3000', cookie: COOKIE, ...(body === undefined ? {} : { 'content-type': 'application/json' }) };
  const chunks = [];
  const res = new Writable({ write(chunk, _e, done) { chunks.push(Buffer.from(chunk)); done(); } });
  res.statusCode = 200;
  res.headersSent = false;
  res.setHeader = () => {};
  const finished = new Promise((resolve) => res.on('finish', resolve));
  await route.handler(req, res);
  await finished;
  return { status: res.statusCode, json: JSON.parse(Buffer.concat(chunks).toString('utf8') || 'null') };
}

test('review: a discussion\'s edits are listed by section, reverted where they still stand, kept on request', async () => {
  const fx = await makeFixture();
  const stateDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'atlas-state-'));
  try {
    const routes = host({ root: fx.root, stateDir });
    const note = fx.file('topics/mc/worm/research.md');
    const session = 'session-test-1';
    const before = await snapshot(fx.base);

    const base = await call(routes, 'POST', 'review/baseline', { body: { session, files: [note, fx.file('knowledge/library/arxiv/1510.07698v2/paper.pdf'), path.dirname(fx.base) + '/x.md'] } });
    assert.deepEqual(base.json.watching.map((f) => path.relative(fx.root, f).split(path.sep).join('/')).sort(), ['mc/worm/research.md', 'mc/worm/stability/research.md', 'research.md'], 'the note, its branch and its parent; nothing outside');
    assert.deepEqual(await snapshot(fx.base), before, 'a baseline writes nothing in the research');
    assert.deepEqual((await call(routes, 'GET', 'review/changes', { query: `session=${session}` })).json.files, []);

    // The discussion edits the note: one sentence of the opening and one Current work entry.
    const text = await fsp.readFile(note, 'utf8');
    const edited = text
      .replace('The question is whether the worm sampler produces reproducible estimates with controlled error.', 'The question is whether the worm sampler produces reproducible estimates; the error is not yet controlled.')
      .replace('- **Mixing test** — paused · 2026-11-02. Waiting for the cluster; see [the plan](plans/mixing.md).', '- **Mixing test** — active · 2026-11-16. The cluster run finished; see [the plan](plans/mixing.md).');
    assert.notEqual(edited, text);
    await fsp.writeFile(note, edited);

    const changes = (await call(routes, 'GET', 'review/changes', { query: `session=${session}` })).json;
    assert.equal(changes.files.length, 1);
    const [opening, entry] = changes.files[0].edits;
    assert.equal(opening.where, 'Opening');
    assert.equal(entry.where, 'Current work · Mixing test');
    assert.deepEqual((await call(routes, 'GET', 'review/pending', { query: `path=${encodeURIComponent(note)}` })).json.sessions, [{ session, edits: 2 }]);

    // Revert the opening: its sentence comes back, the entry edit stays.
    const reverted = await call(routes, 'POST', 'review/revert', { body: { session, path: note, id: opening.id } });
    assert.equal(reverted.status, 200);
    const now = await fsp.readFile(note, 'utf8');
    assert.ok(now.includes('produces reproducible estimates with controlled error.'));
    assert.ok(now.includes('The cluster run finished'));
    assert.deepEqual(reverted.json.files[0].edits.map((e) => e.where), ['Current work · Mixing test']);

    // A stale edit is refused: the note changed since the list was shown.
    await fsp.writeFile(note, now.replace('The cluster run finished', 'The cluster run finished twice'));
    assert.equal((await call(routes, 'POST', 'review/revert', { body: { session, path: note, id: entry.id } })).status, 409);

    // Keep: the copy moves forward and the list empties; the note is untouched.
    const fresh = (await call(routes, 'GET', 'review/changes', { query: `session=${session}` })).json.files[0].edits[0];
    const kept = await call(routes, 'POST', 'review/keep', { body: { session, path: note, id: fresh.id } });
    assert.deepEqual(kept.json.files, []);
    assert.ok((await fsp.readFile(note, 'utf8')).includes('finished twice'));

    assert.equal((await call(routes, 'POST', 'review/revert', { body: { session, path: fx.file('knowledge/library/arxiv/1510.07698v2/paper.pdf'), id: 'x' } })).status, 403);
    await call(routes, 'POST', 'review/forget', { body: { session } });
    assert.deepEqual((await call(routes, 'GET', 'review/changes', { query: `session=${session}` })).json.watching, []);
  } finally {
    await fx.cleanup();
    await fsp.rm(stateDir, { recursive: true, force: true });
  }
});

test('search: every word must appear; notes, knowledge and papers are counted apart', async () => {
  const fx = await makeFixture();
  try {
    const routes = host({ root: fx.root });
    const r = (await call(routes, 'GET', 'search', { query: 'q=' + encodeURIComponent('worm equilibration estimates') })).json;
    assert.ok(r.results.length > 0);
    assert.equal(r.results[0].file, fx.file('topics/mc/worm/research.md'), 'the topic note whose title matches comes first');
    assert.ok(r.results[0].snippet.some((s) => s.hit && /estimates/i.test(s.text)));
    assert.ok(r.counts.note >= 1);
    const papers = (await call(routes, 'GET', 'search', { query: 'q=' + encodeURIComponent('topological lectures') + '&kind=paper' })).json;
    assert.deepEqual(papers.results.map((x) => x.paper && x.paper.key), ['1510.07698']);
    assert.equal((await call(routes, 'GET', 'search', { query: 'q=' + encodeURIComponent('nonexistentword worm') })).json.results.length, 0);
    assert.equal((await call(routes, 'GET', 'search', { query: 'q=x' })).json.results.length, 0, 'one-letter words are ignored');
  } finally {
    await fx.cleanup();
  }
});

test('learn: a topic\'s question, its reading route and the knowledge it uses', async () => {
  const fx = await makeFixture();
  try {
    const note = fx.file('topics/topology/research.md');
    await fsp.writeFile(note, (await fsp.readFile(note, 'utf8')) + '\n**The question.** How does band topology become quantized response? It continues.\n\n## Reading route\n\n1. [Thouless](readings/thouless.pdf), the original argument.\n2. [Berry](../../knowledge/atoms/berry.md) for the connection.\n3. [Fradkin](https://example.org/fradkin) online.\n');
    const routes = host({ root: fx.root });
    const r = (await call(routes, 'GET', 'learn', { query: 'path=' + encodeURIComponent(note) })).json;
    assert.equal(r.question, 'How does band topology become quantized response?');
    assert.equal(r.route.heading, 'Reading route');
    assert.deepEqual(r.route.items.map((i) => [i.text.split(',')[0], i.file ? path.relative(fx.base, i.file).split(path.sep).join('/') : i.url]), [['Thouless', 'topics/topology/readings/thouless.pdf'], ['Berry for the connection.', 'knowledge/atoms/berry.md'], ['Fradkin online.', 'https://example.org/fradkin']]);
    assert.ok(Array.isArray(r.concepts.nodes));
    assert.equal((await call(routes, 'GET', 'learn', { query: 'path=' + encodeURIComponent(fx.file('topics/topology/readings/thouless.pdf')) })).status, 404);

    // A route kept in its own note, linked as the source route: each ## section is a stage.
    const worm = fx.file('topics/mc/worm/research.md');
    await fsp.mkdir(fx.file('topics/mc/worm/notes'), { recursive: true });
    await fsp.writeFile(fx.file('topics/mc/worm/notes/reading-route.md'), '# Sources\n\n## Start with the fixed point\n\nEdward Witten, **Three Lectures**, [arXiv:1510.07698v2](https://arxiv.org/abs/1510.07698v2), first.\n\n## Then the mixing\n\nRead [the plan](../plans/mixing.md).\n\n## How to study the synthesis\n\nSlowly.\n');
    await fsp.writeFile(worm, (await fsp.readFile(worm, 'utf8')) + '\nThe [source route](notes/reading-route.md) records the passages read.\n');
    const routed = (await call(routes, 'GET', 'learn', { query: 'path=' + encodeURIComponent(worm) })).json;
    assert.equal(routed.route.from, fx.file('topics/mc/worm/notes/reading-route.md'));
    assert.deepEqual(routed.route.items.map((i) => [i.text, i.url || path.relative(fx.base, i.file).split(path.sep).join('/')]), [['Start with the fixed point — Three Lectures', 'https://arxiv.org/abs/1510.07698v2'], ['Then the mixing', 'topics/mc/worm/plans/mixing.md']]);
    assert.equal(routed.route.items[0].file, fx.file('knowledge/library/arxiv/1510.07698v2/paper.pdf'), 'a stage whose paper is in the library opens its PDF');
  } finally {
    await fx.cleanup();
  }
});
