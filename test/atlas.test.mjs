/**
 * The reader on a fixture tree: directions from the root's own sections,
 * one place per topic, Current work entries, the knowledge index and papers.
 */
import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { loadAtlas, topicOfFile } from '../lib/atlas.js';
import { blocks, currentWork, firstSentence, splitRow, stripFrontmatter, tables } from '../lib/markdown.js';
import { makeFixture } from './fixture.mjs';

test('markdown: Current work entries, rows with pipes in math and code, frontmatter', () => {
  const entries = currentWork(`# T

## Current work

- **Upstream packaging → [owner](../w/README.md#q)** —
  Pull request #12 approved and merged; review threads resolved · 2026-10-27.
- **Mixing test** — paused · 2026-11-02. Waiting for the cluster.
- A plain entry without a lead · 2026-01-05.

## Next section
`);
  assert.equal(entries.length, 3);
  assert.deepEqual([entries[0].name, entries[0].owner, entries[0].status, entries[0].date], ['Upstream packaging', '../w/README.md#q', '', '2026-10-27']);
  assert.deepEqual([entries[1].name, entries[1].status, entries[1].date], ['Mixing test', 'paused', '2026-11-02']);
  assert.equal(entries[2].date, '2026-01-05');
  assert.deepEqual(splitRow('| a $|x|$ | `b|c` | d \\| e |'), ['a $|x|$', '`b|c`', 'd | e']);
  const [table] = tables('| Entry | Kind |\n|---|---|\n| one | concept |\n| two | theorem |\n');
  assert.deepEqual(table.header, ['entry', 'kind']);
  assert.equal(table.rows.length, 2);
  assert.equal(stripFrontmatter('---\ntitle: X\n---\n# Body\n'), '# Body\n');
  assert.equal(firstSentence('# T\n\n> A quote first.\n\nThe question is whether it works. More.\n'), 'The question is whether it works.');
  assert.deepEqual(blocks('- item one\n  continued\n- item two\n\nA paragraph.').map((b) => b.kind), ['item', 'item', 'paragraph']);
});

test('atlas: directions, places, entries, knowledge and papers', async () => {
  const fx = await makeFixture();
  try {
    const atlas = await loadAtlas({ root: fx.root });
    assert.equal(atlas.title, 'Research programme');
    assert.equal(atlas.lead, 'This root note is the top of the research backbone.');

    // Directions are the root's sections that link topics; the backbone's other sections sit beside them.
    assert.deepEqual(atlas.directions.map((d) => d.heading), ['1. Reliable Monte Carlo methods', '2. Topology and anomalies', '3. Study directions in the shared collection']);
    assert.deepEqual(atlas.directions[0].topics, ['mc/worm', 'mc/continuation']);
    assert.deepEqual(atlas.directions[1].topics, ['topology']);
    assert.deepEqual(atlas.directions[2].topics, []);
    assert.match(atlas.directions[2].markdown, /no topic owns them yet/);
    assert.equal(atlas.directions[0].markdown, '');
    assert.deepEqual(atlas.beside.map((s) => s.heading), ['Connections between topics', 'Seeds', 'Standing agreements', 'Current work']);
    assert.equal(atlas.directions[0].lead, 'The overarching question is whether Monte Carlo estimates can be made reproducible.');

    // What the root says about each topic, and where each topic is shown.
    const worm = atlas.topics.get('mc/worm');
    assert.equal(worm.context, 'Equilibration needs two separate checks; a stable energy alone supplies neither.');
    assert.equal(atlas.topics.get('topology').context, 'Topological phases: a learning synthesis of edge states and quantized response.');
    assert.equal(worm.place, 'direction');
    assert.deepEqual(worm.children, ['mc/worm/stability']);
    const stability = atlas.topics.get('mc/worm/stability');
    assert.deepEqual([stability.place, stability.parent, stability.context], ['child', 'mc/worm', '']);
    assert.deepEqual(atlas.unreached, ['orphan']);
    assert.equal(atlas.topics.get('orphan').reached, false);
    assert.equal(atlas.topics.has('mc/workspace/scratch'), false, 'excluded folders are never read as topics');

    // Leads, entries and the root's own Current work.
    assert.equal(worm.lead, 'The question is whether the worm sampler produces reproducible estimates with controlled error.');
    assert.deepEqual(worm.threads.map((t) => [t.name, t.status, t.date]), [['Upstream packaging', '', '2026-10-27'], ['Mixing test', 'paused', '2026-11-02']]);
    assert.deepEqual(atlas.rootThreads.map((t) => [t.name, t.status, t.owner]), [['Parallel tempering → independent topic', 'active', ''], ['Critical exponents', 'proposed', ''], ['Window choice', 'waiting on the researcher', 'mc/continuation/research.md#current-work']]);

    // Links between notes.
    assert.deepEqual(atlas.linkedFrom.get(fileKeyOf(fx.file('topics/mc/worm/research.md'))).sort(), ['', 'mc/worm/stability']);
    assert.equal(topicOfFile(atlas, fx.file('topics/mc/worm/research.md')).id, 'mc/worm');
    assert.equal(topicOfFile(atlas, fx.file('knowledge/atoms/berry.md')), null);

    // The knowledge collection, found from the root note's link to its index.
    assert.equal(atlas.knowledge, path.resolve(fx.knowledge));
    assert.deepEqual(atlas.index.areas.map((a) => a.heading), ['Stories and reading routes', 'Band topology and response']);
    const [berry, green] = atlas.index.areas[1].entries;
    assert.deepEqual([berry.title, berry.kind, berry.support], ['Berry connection; Berry phase', 'concept', 'source']);
    assert.equal(berry.note, fx.file('knowledge/atoms/berry.md'));
    assert.deepEqual(berry.usedBy, ['mc/worm']);
    assert.deepEqual(berry.pdfs.map((p) => p.id), ['1510.07698']);
    assert.match(berry.scope, /\$\|\\psi\\rangle\$ example$/);
    assert.equal(green.support, 'provisional (research: worm algorithm); awaiting review');
    assert.equal(atlas.index.areas[0].entries[0].support, 'Integrated');
    assert.match(atlas.index.areas[0].prose, /reading routes begin/);

    // Papers: the library joined with maps and section notes; used by the notes that cite them.
    assert.equal(atlas.papers.length, 1);
    const [paper] = atlas.papers;
    assert.deepEqual([paper.key, paper.title, paper.sections, paper.versions], ['1510.07698', 'Three lectures on topological phases of matter', 1, ['1510.07698v2']]);
    assert.equal(paper.pdf, fx.file('knowledge/library/arxiv/1510.07698v2/paper.pdf'));
    assert.deepEqual([...paper.usedBy].sort(), ['mc/worm', 'topology']);

    // What each topic cites, sorted by kind; the flow of dated entries; the cross-connections.
    assert.deepEqual(worm.counts, { topics: 1, reports: 1, notes: 1, branches: 1, knowledge: 1, data: 2, code: 1 });
    const topology = atlas.topics.get('topology');
    assert.deepEqual(topology.counts, { papers: 2, writing: 1, branches: 0 });
    assert.deepEqual(topology.pdfs.map((p) => p.label), ["Thouless's paper"]);
    assert.deepEqual(topology.arxivLinks, ['1510.07698']);
    assert.deepEqual(atlas.timeline.map((e) => [e.id, e.name]), [['', 'Critical exponents'], ['', 'Parallel tempering → independent topic'], ['mc/worm', 'Mixing test'], ['mc/worm', 'Upstream packaging'], ['', 'Window choice'], ['mc/continuation', 'Window choice'], ['mc/continuation', 'Padé ensemble'], ['orphan', 'Orphan decision']]);
    assert.deepEqual(atlas.web, [['mc/continuation', 'topology']]);
  } finally {
    await fx.cleanup();
  }
});

test('atlas: a reread after a change sees it, and a missing root note is a clear error', async () => {
  const fx = await makeFixture();
  try {
    const cache = new Map();
    await loadAtlas({ root: fx.root }, cache);
    const { promises: fsp } = await import('node:fs');
    const note = fx.file('topics/topology/research.md');
    await fsp.writeFile(note, '# Topological phases, revised\n\nThe question is new.\n\n## Current work\n\n- **Edge test** — active · 2026-11-14. Start.\n', 'utf8');
    const later = await loadAtlas({ root: fx.root }, cache);
    assert.equal(later.topics.get('topology').title, 'Topological phases, revised');
    assert.equal(later.topics.get('topology').threads[0].name, 'Edge test');
    await assert.rejects(loadAtlas({ root: fx.file('knowledge') }), /no research\.md at the research root/i);
  } finally {
    await fx.cleanup();
  }
});

function fileKeyOf(file) {
  const resolved = path.resolve(file);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}
