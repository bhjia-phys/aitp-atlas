import assert from 'node:assert/strict';
import { readFileSync, promises as fs } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { loadAtlas } from '../lib/atlas.js';
import { lookup } from '../lib/sources.js';
import { makeFixture, snapshot } from './fixture.mjs';

// Neither metadata lookup, citation counts nor fetching a remote PDF is allowed.
const offline = { enabled: false };
const viewCode = readFileSync(new URL('../client/47-paper.js', import.meta.url), 'utf8');
function render(data, go) {
  const h = (component, props, ...children) => ({ component, props, children });
  return new Function('h', 'useApi', 'Button', 'DocView', `${viewCode}\nreturn PaperRefView;`)(h, () => ({ data }), 'button', 'DocView')({ url: `https://arxiv.org/abs/${data.id}${data.version}`, overview: {}, go });
}

test('offline: a fixture arXiv link opens the local reader and does not modify the collection', async (t) => {
  const fx = await makeFixture(); t.after(() => fx.cleanup());
  const atlas = await loadAtlas({ root: fx.root });
  const before = await snapshot(fx.base);
  for (const q of ['https://arxiv.org/abs/1510.07698', '1510.07698v2']) {
    const found = await lookup(offline, atlas, q);
    const pdf = fx.file('knowledge/library/arxiv/1510.07698v2/paper.pdf');
    assert.equal(found.version, 'v2'); assert.equal(found.inLibrary.pdf, pdf);
    assert.equal(found.inLibrary.map, fx.file('knowledge/papers/1510.07698.md'));
    assert.equal(found.title, 'Three lectures on topological phases of matter');
    assert.equal((await fs.readFile(pdf, 'utf8')).slice(0, 5), '%PDF-');
    const view = render(found); assert.equal(view.component, 'DocView'); assert.equal(view.props.path, pdf);
  }
  assert.deepEqual(await snapshot(fx.base), before);
});

test('offline: select the highest locally readable edition numerically, never a different edition for a pinned link', async (t) => {
  const fx = await makeFixture(); t.after(() => fx.cleanup());
  const arxiv = fx.file('knowledge/library/arxiv');
  await fs.mkdir(path.join(arxiv, '1510.07698v10'));
  const pdf = path.join(arxiv, '1510.07698v10', 'lectures.pdf');
  await fs.writeFile(pdf, '%PDF-1.4 test v10\n');
  await fs.mkdir(path.join(arxiv, '1510.07698v11')); // Indexed folder, not a readable PDF edition.
  // Old-style IDs encode their slash in one library directory component.
  const old = path.join(arxiv, 'cond-mat_0410123v2');
  await fs.mkdir(old); await fs.writeFile(path.join(old, 'paper.pdf'), '%PDF-1.4 old ID\n');
  const atlas = await loadAtlas({ root: fx.root });
  assert.equal((await lookup(offline, atlas, '1510.07698')).inLibrary.pdf, pdf);
  assert.equal((await lookup(offline, atlas, '1510.07698v2')).inLibrary.pdf, path.join(arxiv, '1510.07698v2', 'paper.pdf'));
  assert.equal((await lookup(offline, atlas, 'cond-mat/0410123v2')).inLibrary.pdf, path.join(old, 'paper.pdf'));
  let target;
  const pinned = await lookup(offline, atlas, '1510.07698v1');
  assert.equal(pinned.version, 'v1'); assert.equal(pinned.inLibrary.pdf, '');
  const view = render(pinned, (next) => { target = next; });
  assert.match(view.children.find((c) => c.component === 'p' && /No local PDF/.test(c.children[0])).children[0], /1510\.07698v1/);
  const button = view.children.find((c) => c.component === 'button');
  assert.deepEqual(button.children, ['Open paper map']); button.props.onClick();
  assert.deepEqual(target, { view: 'doc', path: fx.file('knowledge/papers/1510.07698.md') });
  await assert.rejects(lookup(offline, atlas, '2101.12345v2'), (e) => e.statusCode === 403 && /No local PDF or paper map.*2101\.12345v2.*web: false/.test(e.message));
});

test('offline: stale index paths cannot substitute an outside PDF or an outside map', async (t) => {
  const fx = await makeFixture(); t.after(() => fx.cleanup());
  const atlas = await loadAtlas({ root: fx.root });
  const [paper] = atlas.papers;
  paper.versions = ['../../../../topics']; paper.pdf = fx.file('topics/topology/readings/thouless.pdf'); paper.map = fx.file('topics/research.md');
  await assert.rejects(lookup(offline, atlas, '1510.07698'), /No local PDF or paper map/);
});
