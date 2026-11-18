// Exercise the shipped layout functions, including the exact overview payload returned
// for the fixture. No filesystem research outside the temporary fixture, browser,
// CSS snapshots, random clock or model required for these tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadAtlas } from '../lib/atlas.js';
import { routeTable } from '../lib/routes.js';
import { makeFixture } from './fixture.mjs';

const modules = ['00-runtime', '10-ui', '20-universe', '21-desk', '22-sky', '30-topic', '47-paper', '60-threads', '65-activity'];
const body = modules.map((name) => readFileSync(new URL(`../client/${name}.js`, import.meta.url), 'utf8')).join('\n');
const data = new Map();
const c = new Function('require', 'window', `${body}\nreturn {layoutDeskSky, layoutUniverse, deskAlmanacData, deskDraft, deskAttachment, storageSet};`)(
  (name) => name === 'react' ? { createContext: () => ({}), Component: class {} } : {},
  { localStorage: { getItem: (k) => data.get(k), setItem: (k, v) => data.set(k, v) } },
);
const close = (a, b) => Math.abs(a - b) < 1e-9;
const overlap = (a, b) => a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top;

async function readFixtureOverview() {
  const fx = await makeFixture();
  try {
    const table = routeTable({ settings: { root: fx.root, stateDir: fx.file('atlas-state') }, get: () => loadAtlas({ root: fx.root }) });
    let response;
    await table.find((r) => r.path.endsWith('/overview')).handler({}, { setHeader() {}, end(text) { response = JSON.parse(text); } }, new URL('http://fixture/overview'));
    return { ...response, scannedAt: Date.UTC(2026, 10, 8) };
  } finally { await fx.cleanup(); }
}

function verifyLayout(g, ov) {
  const ids = Object.keys(ov.topics).filter(Boolean);
  assert.deepEqual(g.stars.map((s) => s.id).sort(), ids.sort(), 'one real mark per non-root topic');
  let previous = g.start;
  const points = new Set();
  for (const sector of g.sectors) {
    assert.ok(close(sector.a0, previous), 'contiguous in root order');
    assert.ok(close(sector.a1 - sector.a0, g.span * sector.members.length / (ids.length || 1)), 'wedge span proportional to actual total, descendants included');
    previous = sector.a1;
    for (const s of g.stars.filter((star) => star.sector === sector.key)) {
      assert.ok(s.angle > sector.a0 && s.angle < sector.a1);
      // Check the actual final x/y, not just the pre-collision angle metadata.
      const x = (s.x - g.cx) / g.rx, y = (s.y - g.cy) / g.ry, radius = Math.hypot(x, y);
      assert.ok(radius < 1 && radius > 0);
      assert.ok(close(Math.cos(s.angle), x / radius) && close(Math.sin(s.angle), y / radius));
      const footprint = { left: s.x - s.size, right: s.x + s.size, top: s.y - s.size, bottom: s.y + s.size };
      if (g.keepOut) assert.ok(!overlap(footprint, g.keepOut), `${s.id} in greeting at ${s.x}, ${s.y}`);
      const key = `${s.x},${s.y}`;
      assert.ok(!points.has(key), `coincident mark ${s.id}`); points.add(key);
    }
  }
  if (ids.length) assert.ok(close(previous, g.start + g.span));
  for (let i = 0; i < g.labels.length; ++i) {
    const l = g.labels[i].bounds;
    assert.ok([l.left, l.top, g.width - l.right, g.height - l.bottom].every((n) => n >= 0));
    if (g.keepOut) assert.ok(!overlap(l, g.keepOut));
    for (const other of g.labels.slice(0, i)) assert.ok(!overlap(other.bounds, l));
    for (const s of g.stars) assert.ok(!overlap({ left: s.x - s.size, right: s.x + s.size, top: s.y - s.size, bottom: s.y + s.size }, l));
  }
}

test('sky and map: real fixture directions, inherited branches, empty direction, orphan, activity and links', async () => {
  const ov = await readFixtureOverview();
  const original = JSON.stringify(ov), sky = c.layoutDeskSky(ov), map = c.layoutUniverse(ov);
  for (const g of [map, sky]) {
    verifyLayout(g, ov);
    assert.deepEqual(g.sectors.map((s) => s.members.length), [3, 1, 0, 1]);
    assert.equal(g.sectors[2].a0, g.sectors[2].a1);
    assert.deepEqual(g.edges.map((e) => [e.from.id, e.to.id]), [['mc/worm', 'mc/worm/stability']]);
    assert.equal(g.stars.find((s) => s.id === 'mc/worm').size, 2.6);
    assert.equal(g.stars.find((s) => s.id === 'orphan').size, 1.7);
    assert.equal(g.stars.find((s) => s.id === 'topology').size, 1.7, 'no Current work: file mtime does not make it active');
    assert.ok(g.labels.length > 0);
  }
  assert.deepEqual(c.layoutDeskSky(JSON.parse(original)), sky);
  assert.deepEqual(c.layoutUniverse(JSON.parse(original)), map);
  assert.equal(original, JSON.stringify(ov));
  assert.equal(sky.dust.length, 12);
  const almanac = c.deskAlmanacData(ov, [], null);
  assert.deepEqual(almanac.waiting.map((w) => w.topic.id), ['mc/continuation'], 'reuse owner pointer and reachability rules');
});

test('dense sky: 360 topics, 12 directions, long/wide labels, both sides of every pane breakpoint', () => {
  const topics = {}, directions = [];
  for (let i = 0; i < 12; ++i) {
    const d = { slug: `d${i}`, heading: `${i + 1}. 多体问题 Long multiword direction ${i}`, topics: [] };
    for (let j = 0; j < 30; j++) { const id = `${i}/t${j}`; topics[id] = { id, title: id, parent: '', children: [], file: `/fixture/${id}/research.md` }; d.topics.push(id); }
    directions.push(d);
  }
  const ov = { topics, directions, scannedAt: Date.UTC(2026, 10, 1) };
  for (const paneWidth of [232, 375, 639, 640, 719, 899, 900, 1120]) for (const hasDraft of [true, false]) {
    const opts = { paneWidth, hasDraft }, g = c.layoutDeskSky(ov, opts);
    assert.equal(g.showNames, paneWidth >= 900);
    assert.equal(g.bandHeight, !hasDraft || paneWidth < 900 ? 240 : 330);
    assert.equal(g.stacked, paneWidth < 640);
    assert.ok(2 * g.hitRadius * g.scale >= 24, `Desk hit size at ${paneWidth}px`);
    if (paneWidth >= 900) assert.ok((g.keepOut.right - g.keepOut.left) * g.scale >= g.greetingWidth - 1e-6 && g.greetingWidth >= 400, 'wide full-date kicker protected in rendered pixels');
    verifyLayout(g, ov);
    for (const s of g.stars) assert.ok(g.bandHeight - g.skyBottom - (330 - s.y - s.size) * g.scale <= g.bandHeight - 34, 'the composer cannot cover a star');
    assert.equal(g.sectors[7].color, 'var(--n8)');
    assert.equal(g.sectors[8].color, 'var(--dx)');
    assert.deepEqual(g, c.layoutDeskSky(ov, opts));
    assert.ok(g.labels.length < 12, 'overcrowding drops labels, never stars');
  }
  for (const width of [344, 688, 1120]) {
    const map = c.layoutUniverse(ov, { width, height: 680 });
    assert.equal(map.width, width, 'one viewBox unit per pane pixel at 100% zoom');
    assert.equal(map.height, 680);
    for (const zoom of [0.75, 1, 3]) assert.ok(2 * map.hitRadius * zoom >= 24, `Map hit size, ${width}px at ${zoom}`);
    verifyLayout(map, ov);
  }
});

test('empty directions and root only are not assigned fictional stars or invented sector weights', () => {
  for (const directions of [[], [{ slug: 'empty', heading: 'No topic yet', topics: [] }]]) {
    const ov = { topics: { '': { id: '', title: 'Root' } }, directions, other: [], unreached: [] };
    for (const g of [c.layoutDeskSky(ov), c.layoutUniverse(ov)]) {
      verifyLayout(g, ov); assert.deepEqual(g.labels, []); assert.deepEqual(g.edges, []);
      assert.equal(g.sectors.length, directions.length);
    }
  }
});

test('almanac: only actual open records, no resolved/archived/missing/foreign sessions or imaginary work', () => {
  const records = ['latest', 'older', 'legacy', 'gone', 'archived', 'resolved'].map((id, i) => ({ id, label: id, intent: 'ask', status: id === 'resolved' ? 'resolved' : 'open', created: 20 - i, kind: id === 'legacy' ? 'team' : undefined }));
  const rows = { phase: 'ready', byId: { latest: {}, older: { running: true }, legacy: { running: true }, archived: { archived: true }, resolved: {}, foreign: { running: true } } };
  const a = c.deskAlmanacData({ topics: {} }, records, rows);
  assert.deepEqual(a.items.map((i) => i.id), ['latest', 'older', 'legacy']);
  assert.deepEqual(a.running.map((i) => i.id), ['older', 'legacy']);
  assert.equal(a.running[1].team, true);
  assert.deepEqual(c.deskAlmanacData({ topics: {} }, records, null).running, []);
});

test('draft and attachments: per-root, plain pointers, DOI/arXiv, no upload or local file URL', () => {
  const attachment = c.deskAttachment('C:\\fixture\\mc\\research.md', 'file');
  assert.deepEqual(attachment, { path: 'C:\\fixture\\mc\\research.md', label: 'research.md' });
  assert.deepEqual(c.deskAttachment('arXiv:1510.07698v2', 'paper'), { path: 'https://arxiv.org/abs/1510.07698v2', label: 'arXiv 1510.07698v2' });
  assert.equal(c.deskAttachment('10.1103/PhysRevB.84.064445', 'paper').path, 'https://doi.org/10.1103/PhysRevB.84.064445');
  assert.equal(c.deskAttachment('javascript:alert(1)', 'paper'), null);
  assert.equal(c.deskAttachment('notes/x.md', 'file'), null);
  c.storageSet('prefs.v1', { deskDraft: { root: '/fixture', question: 'What about this?', topicId: 'mc', attachments: [attachment] } });
  assert.deepEqual(c.deskDraft('/fixture'), { question: 'What about this?', topicId: 'mc', attachments: [attachment] });
  assert.deepEqual(c.deskDraft('/different'), { question: '', topicId: '', attachments: [] });
});
