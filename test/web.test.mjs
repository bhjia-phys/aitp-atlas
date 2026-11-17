/**
 * Papers and lectures from the web, against a stand-in network: a lookup reads
 * metadata only; Add downloads the PDF and the TeX source into the library the
 * way the collection keeps them, with provenance; a paper map starts from the
 * collection's template; nothing existing is overwritten; `web: false` stops
 * every outside request.
 */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { promises as fsp, readFileSync } from 'node:fs';
import path from 'node:path';
import { Readable, Writable } from 'node:stream';
import test from 'node:test';
import zlib from 'node:zlib';
import { apply } from '../index.js';
import { appendUnderHeading, arxivEntries, arxivQuery, cleanDiscover, fillPaperTemplate, momentUrl, parseIdentifier, safeJoin, unpackSource, untar } from '../lib/sources.js';
import { createWeb, proxyFor } from '../lib/web.js';
import http from 'node:http';
import { makeFixture, snapshot } from './fixture.mjs';

const ATOM = readFileSync(new URL('./samples/arxiv-2207.07701.xml', import.meta.url), 'utf8');
const INSPIRE = readFileSync(new URL('./samples/inspire-2207.07701.json', import.meta.url), 'utf8');
const TEMPLATE = `---
title: <paper title>
authors: []
year: <year>
arxiv: <id>v<n>
kind: paper
area: <area in index.md>
reading_depth: <located | AI-read | researcher-read>
close_reading: <none | partial | complete>
---

# <Title> (<id>v<n>)

**What it establishes.** <at its true strength>

## Section notes

## Your reading
`;

// ------------------------------------------------------------------ a tar ---

function tarEntry(name, data, flag = '0') {
  const header = Buffer.alloc(512, 0);
  header.write(name.slice(0, 100), 0, 'utf8');
  header.write('0000644\0', 100, 'latin1');
  header.write('0000000\0', 108, 'latin1');
  header.write('0000000\0', 116, 'latin1');
  header.write(data.length.toString(8).padStart(11, '0') + '\0', 124, 'latin1');
  header.write('00000000000\0', 136, 'latin1');
  header.write('        ', 148, 'latin1');
  header.write(flag, 156, 'latin1');
  header.write('ustar\0', 257, 'latin1');
  header.write('00', 263, 'latin1');
  let sum = 0;
  for (const b of header) sum += b;
  header.write(sum.toString(8).padStart(6, '0') + '\0 ', 148, 'latin1');
  const pad = Buffer.alloc((512 - (data.length % 512)) % 512, 0);
  return Buffer.concat([header, data, pad]);
}

function tarOf(entries) {
  return Buffer.concat([...entries.map(([name, text, flag]) => tarEntry(name, Buffer.from(text), flag)), Buffer.alloc(1024, 0)]);
}

const SOURCE = zlib.gzipSync(tarOf([
  ['main.tex', '\\documentclass{article}\\begin{document}K-complexity\\end{document}'],
  ['figs/plateau.txt', 'figure data'],
  ['../escape.tex', 'outside'],
  ['link.tex', '', '2'],
  ['././@LongLink', 'sections/a-very-long-section-name.tex', 'L'],
  ['ignored-short-name', '\\section{Long}'],
]));

// --------------------------------------------------------- pure functions ---

test('web: identifiers from IDs, links, DOIs and INSPIRE records', () => {
  assert.deepEqual(parseIdentifier('2207.07701'), { kind: 'arxiv', id: '2207.07701', version: '' });
  assert.deepEqual(parseIdentifier('arXiv:2207.07701v2'), { kind: 'arxiv', id: '2207.07701', version: 'v2' });
  assert.deepEqual(parseIdentifier('https://arxiv.org/abs/2207.07701v1'), { kind: 'arxiv', id: '2207.07701', version: 'v1' });
  assert.deepEqual(parseIdentifier('https://arxiv.org/pdf/2207.07701v2.pdf'), { kind: 'arxiv', id: '2207.07701', version: 'v2' });
  assert.deepEqual(parseIdentifier('https://arxiv.org/abs/hep-th/9601029v2'), { kind: 'arxiv', id: 'hep-th/9601029', version: 'v2' });
  assert.deepEqual(parseIdentifier('https://doi.org/10.48550/arXiv.2207.07701'), { kind: 'arxiv', id: '2207.07701', version: '' });
  assert.deepEqual(parseIdentifier('10.1007/JHEP07(2022)151'), { kind: 'doi', doi: '10.1007/JHEP07(2022)151' });
  assert.deepEqual(parseIdentifier('https://inspirehep.net/literature/2116074'), { kind: 'inspire', recid: '2116074' });
  assert.equal(parseIdentifier('Krylov complexity'), null);
  assert.equal(parseIdentifier(''), null);
});

test('web: an arXiv answer becomes title, authors, edition and journal', () => {
  const [entry] = arxivEntries(ATOM);
  assert.equal(entry.id, '2207.07701');
  assert.equal(entry.version, 'v2');
  assert.equal(entry.title, 'Krylov complexity from integrability to chaos');
  assert.equal(entry.authors.length, 4);
  assert.equal(entry.year, 2022);
  assert.ok(entry.categories.includes('hep-th'));
  assert.equal(arxivEntries('<feed><entry><id>http://arxiv.org/api/errors#incorrect_id</id><title>Error</title></entry></feed>').length, 0);
  assert.equal(arxivQuery('long-range Heisenberg · level statistics'), '(ti:"long-range Heisenberg" OR abs:"long-range Heisenberg") AND (ti:"level statistics" OR abs:"level statistics")');
  assert.equal(arxivQuery('au:Sonner AND ti:Krylov'), 'au:Sonner AND ti:Krylov');
});

test('web: an e-print unpacks inside its folder only', () => {
  const unpacked = unpackSource(SOURCE, '2207.07701');
  assert.equal(unpacked.kind, 'tar');
  assert.deepEqual(unpacked.files.map((f) => f.name), ['main.tex', 'figs/plateau.txt', '../escape.tex', 'sections/a-very-long-section-name.tex']);
  const base = path.resolve('/lib/arxiv/2207.07701v2/source');
  assert.equal(safeJoin(base, 'figs/plateau.txt'), path.join(base, 'figs', 'plateau.txt'));
  for (const bad of ['../escape.tex', '/etc/passwd', 'C:/x.tex', 'a/../../b', 'con:x', '', '.', 'trailing.']) assert.equal(safeJoin(base, bad), '', bad);
  assert.equal(unpackSource(zlib.gzipSync(Buffer.from('\\documentclass{article}\n\\begin{document}x\\end{document}')), 'hep-th/9601029').files[0].name, 'hep-th_9601029.tex');
  assert.equal(unpackSource(Buffer.from('%PDF-1.4 only')).kind, 'pdf-only');
  assert.equal(untar(tarOf([['a.tex', 'x']])).length, 1);
});

test('web: a line goes at the end of its section; a map fills the template and leaves reading to the reader', () => {
  const note = '# Paper\n\n## [Reconstructed] Your reading\n\n- [p. 8](x.pdf#page=8): first\n\n## Later\n\ntext\n';
  assert.equal(appendUnderHeading(note, 'Your reading', '- [p. 13](x.pdf#page=13): second'), '# Paper\n\n## [Reconstructed] Your reading\n\n- [p. 8](x.pdf#page=8): first\n- [p. 13](x.pdf#page=13): second\n\n## Later\n\ntext\n');
  assert.equal(appendUnderHeading('# Paper\n', 'Your reading', 'line'), '# Paper\n\n## Your reading\n\nline\n');
  assert.equal(appendUnderHeading('# P\n\n## Your reading\n', 'Your reading', 'line'), '# P\n\n## Your reading\n\nline\n');
  const map = fillPaperTemplate(TEMPLATE, { id: '2207.07701', version: 'v2', title: 'Krylov complexity from integrability to chaos', authors: ['E. Rabinovici', 'J. Sonner'], year: 2022, journal: 'JHEP 07 (2022) 151' }, { why: 'The seed question.', topicLink: '[Krylov](../../topics/qc/research.md)', pdfLink: '../library/arxiv/2207.07701v2/paper.pdf' });
  assert.match(map, /^---\ntitle: "Krylov complexity from integrability to chaos"\nauthors: \["E\. Rabinovici","J\. Sonner"\]\nyear: 2022\narxiv: 2207\.07701v2\nkind: paper\narea: ""\nreading_depth: located\nclose_reading: none\n---\n/);
  assert.match(map, /\n# Krylov complexity from integrability to chaos \(2207\.07701v2\)\n\n\*\*Edition\.\*\* \[arXiv 2207\.07701v2\]\(https:\/\/arxiv\.org\/abs\/2207\.07701v2\) · \[local PDF\]\(\.\.\/library\/arxiv\/2207\.07701v2\/paper\.pdf\)\. Published as JHEP 07 \(2022\) 151\.\n/);
  assert.match(map, /\*\*What it establishes\.\*\* <at its true strength>/, 'what reading must supply stays for the reader');
  assert.match(map, /## Your reading\n\n\*\*Why I'm reading it\.\*\* The seed question\. For \[Krylov\]\(\.\.\/\.\.\/topics\/qc\/research\.md\)\.\n$/);
});

test('web: proxies from the config or the environment, never for NO_PROXY hosts; moments of recordings', () => {
  const env = { HTTPS_PROXY: 'http://127.0.0.1:7897', NO_PROXY: 'localhost,.internal' };
  assert.equal(proxyFor('https://export.arxiv.org/api/query', '', env), 'http://127.0.0.1:7897');
  assert.equal(proxyFor('https://export.arxiv.org/api/query', 'http://10.0.0.2:3128', env), 'http://10.0.0.2:3128');
  assert.equal(proxyFor('https://wiki.internal/x', '', env), '');
  assert.equal(proxyFor('http://example.org/', '', env), '');
  assert.equal(proxyFor('https://arxiv.org/', '', {}), '');
  assert.equal(momentUrl('https://www.youtube.com/watch?v=abc', 750), 'https://www.youtube.com/watch?v=abc&t=750');
  assert.equal(momentUrl('https://example.org/talk.mp4', 61.4), 'https://example.org/talk.mp4#t=61');
  const clean = cleanDiscover({ searches: [{ query: '  Krylov complexity ', topic: '/t/research.md' }, { query: '' }], dismissed: { '2401.00001': '2026-11-16' }, extra: 1 });
  assert.deepEqual(clean.searches.map((s) => [s.id, s.query, s.topic]), [['krylov-complexity', 'Krylov complexity', '/t/research.md']]);
  assert.deepEqual(Object.keys(clean), ['version', 'searches', 'dismissed', 'seen']);
});

// ------------------------------------------------------- the host, end to end ---

const COOKIE = 'dsh-browser=signed';

function host(config) {
  const routes = new Map();
  const web = { effect: (fn) => fn(), webServer: { register: (route) => routes.set(route.path, route) }, get: (name) => (name === 'connection' ? { requestRejection: (req) => (String(req.headers.cookie || '').includes(COOKIE) ? undefined : 401) } : undefined) };
  apply({ effect: (fn) => fn(), get: () => undefined, inject: (_names, fn) => fn(web) }, config);
  return routes;
}

async function call(routes, method, name, { query = '', body, type = 'application/json' } = {}) {
  const route = routes.get(`/aitp-atlas/api/${name}`);
  assert.ok(route, name);
  const payload = body === undefined ? [] : [Buffer.isBuffer(body) ? body : Buffer.from(JSON.stringify(body))];
  const req = Readable.from(payload);
  req.method = method;
  req.url = `/aitp-atlas/api/${name}${query ? '?' + query : ''}`;
  req.headers = { host: '127.0.0.1:3000', cookie: COOKIE, ...(body === undefined ? {} : { 'content-type': type }) };
  const chunks = [];
  const res = new Writable({ write(chunk, _e, done) { chunks.push(Buffer.from(chunk)); done(); } });
  res.statusCode = 200;
  res.headersSent = false;
  res.setHeader = () => {};
  const finished = new Promise((resolve) => res.on('finish', resolve));
  await route.handler(req, res);
  await finished;
  const raw = Buffer.concat(chunks);
  let json = null;
  try {
    json = JSON.parse(raw.toString('utf8') || 'null');
  } catch {
    json = null;
  }
  return { status: res.statusCode, json, raw };
}

function network() {
  const asked = [];
  const pdf = Buffer.from('%PDF-1.5 Krylov complexity\n');
  const citing = JSON.stringify({ hits: { total: 2, hits: [{ metadata: { control_number: 1, titles: [{ title: 'A citing paper' }], authors: [{ full_name: 'Doe, J.' }], arxiv_eprints: [{ value: '2601.00001' }], citation_count: 3, earliest_date: '2026-01-02' } }] } });
  const request = async (url) => {
    asked.push(url);
    const u = new URL(url);
    const ok = (body, type) => ({ status: 200, headers: { 'content-type': type }, body: Buffer.isBuffer(body) ? body : Buffer.from(body) });
    if (u.host === 'export.arxiv.org') return ok(ATOM, 'application/atom+xml');
    if (u.host === 'inspirehep.net' && u.searchParams.get('format') === 'bibtex') return ok('@article{Rabinovici:2022beu,\n    author = "Rabinovici, E. and Sonner, J.",\n    title = "{Krylov complexity from integrability to chaos}",\n    eprint = "2207.07701",\n    year = "2022"\n}\n', 'text/x-bibtex');
    if (u.host === 'inspirehep.net') return ok(/refersto/.test(u.searchParams.get('q')) ? citing : INSPIRE, 'application/json');
    if (u.host === 'arxiv.org' && u.pathname === '/pdf/2207.07701v2') return ok(pdf, 'application/pdf');
    if (u.host === 'arxiv.org' && u.pathname === '/e-print/2207.07701v2') return ok(SOURCE, 'application/gzip');
    return { status: 404, headers: {}, body: Buffer.from('no') };
  };
  return { asked, request, pdf };
}

test('web: look up, add with the source and a paper map, then keep a passage; nothing is overwritten', async () => {
  const fx = await makeFixture();
  try {
    await fsp.mkdir(path.join(fx.knowledge, 'templates'), { recursive: true });
    await fsp.writeFile(path.join(fx.knowledge, 'templates', 'paper.md'), TEMPLATE);
    const net = network();
    const routes = host({ root: fx.root, request: net.request });

    const found = await call(routes, 'GET', 'web/lookup', { query: 'q=' + encodeURIComponent('https://arxiv.org/abs/2207.07701') });
    assert.equal(found.status, 200);
    assert.equal(found.json.title, 'Krylov complexity from integrability to chaos');
    assert.equal(found.json.version, 'v2');
    assert.equal(found.json.inspire.citations, 193);
    assert.equal(found.json.inLibrary, null);
    assert.ok(net.asked.every((u) => !/arxiv\.org\/(pdf|e-print)\//.test(u)), 'a lookup downloads nothing');
    assert.equal((await call(routes, 'GET', 'web/lookup', { query: 'q=nonsense' })).status, 400);

    const topic = fx.file('topics/topology/research.md');
    const added = await call(routes, 'POST', 'web/add', { body: { id: '2207.07701', version: 'v2', note: true, why: 'The seed question.', topic, meta: found.json } });
    assert.equal(added.status, 200, JSON.stringify(added.json));
    const dir = fx.file('knowledge/library/arxiv/2207.07701v2');
    assert.deepEqual(await fsp.readFile(path.join(dir, 'paper.pdf')), net.pdf);
    const prov = JSON.parse(await fsp.readFile(path.join(dir, 'paper.pdf.provenance.json'), 'utf8'));
    assert.deepEqual([prov.path, prov.url, prov.version, prov.bytes, prov.sha256], ['arxiv/2207.07701v2/paper.pdf', 'https://arxiv.org/pdf/2207.07701v2', 'v2', net.pdf.length, crypto.createHash('sha256').update(net.pdf).digest('hex')]);
    assert.deepEqual(added.json.source, { kind: 'tar', files: 3 });
    assert.equal(await fsp.readFile(path.join(dir, 'source', 'sections', 'a-very-long-section-name.tex'), 'utf8'), '\\section{Long}');
    await assert.rejects(fsp.stat(path.join(dir, 'escape.tex')), 'a ../ entry stays out');
    await assert.rejects(fsp.stat(path.join(dir, 'source', 'link.tex')), 'links are skipped');
    const mapFile = fx.file('knowledge/papers/2207.07701.md');
    assert.equal(added.json.map.file, mapFile);
    const map = await fsp.readFile(mapFile, 'utf8');
    assert.match(map, /\*\*Edition\.\*\* \[arXiv 2207\.07701v2\]\(https:\/\/arxiv\.org\/abs\/2207\.07701v2\) · \[local PDF\]\(\.\.\/library\/arxiv\/2207\.07701v2\/paper\.pdf\) · \[TeX source\]\(\.\.\/library\/arxiv\/2207\.07701v2\/source\/\)\./);
    assert.match(map, /\*\*Why I'm reading it\.\*\* The seed question\. For \[Topological insulators and anomalies\]\(\.\.\/\.\.\/topics\/topology\/research\.md\)\./);
    assert.ok(added.json.inLibrary && added.json.inLibrary.map === mapFile, 'the answer says where the paper now is');

    // Again: the edition and the map are left as they are.
    const before = (await fsp.stat(path.join(dir, 'paper.pdf'))).mtimeMs;
    const again = await call(routes, 'POST', 'web/add', { body: { id: '2207.07701', version: 'v2', note: true, meta: found.json } });
    assert.equal(again.json.existed, true);
    assert.equal(again.json.map.existed, true);
    assert.equal((await fsp.stat(path.join(dir, 'paper.pdf'))).mtimeMs, before);

    // A passage kept from page 13.
    const kept = await call(routes, 'POST', 'append', { body: { path: mapFile, heading: 'Your reading', line: '- [p. 13](../library/arxiv/2207.07701v2/paper.pdf#page=13): “no universal plateau threshold”' } });
    assert.equal(kept.status, 200);
    assert.match(await fsp.readFile(mapFile, 'utf8'), /For \[Topological insulators and anomalies\]\([^)]*\)\.\n\n- \[p\. 13\]\(\.\.\/library\/arxiv\/2207\.07701v2\/paper\.pdf#page=13\): “no universal plateau threshold”\n$/);
    assert.equal((await call(routes, 'POST', 'append', { body: { path: path.join(dir, 'paper.pdf'), line: 'x' } })).status, 403, 'the library takes no lines');

    // Citations and the papers that cite it.
    assert.deepEqual((await call(routes, 'GET', 'web/citations', { query: 'arxiv=2207.07701,1510.07698' })).json.counts['2207.07701'], { recid: '2116074', citations: 193, title: 'Krylov complexity from integrability to chaos' });
    const citing = await call(routes, 'GET', 'web/citing', { query: 'arxiv=2207.07701&size=5' });
    assert.deepEqual(citing.json.recent.map((r) => [r.title, r.arxiv]), [['A citing paper', '2601.00001']]);
    assert.equal((await call(routes, 'GET', 'web/search', { query: 'q=' + encodeURIComponent('Krylov complexity') })).json.entries[0].id, '2207.07701');
  } finally {
    await fx.cleanup();
  }
});

test('web: uploads, lectures and saved searches; with web: false nothing goes out', async () => {
  const fx = await makeFixture();
  try {
    const net = network();
    const routes = host({ root: fx.root, request: net.request });
    const readings = fx.file('topics/topology/readings');
    const slides = Buffer.from('%PDF-1.4 slides');
    const up = await call(routes, 'POST', 'upload', { query: `dir=${encodeURIComponent(readings)}&name=${encodeURIComponent('kitaev slides.pdf')}`, body: slides, type: 'application/octet-stream' });
    assert.equal(up.status, 200, JSON.stringify(up.json));
    assert.deepEqual(await fsp.readFile(path.join(readings, 'kitaev slides.pdf')), slides);
    assert.equal((await call(routes, 'POST', 'upload', { query: `dir=${encodeURIComponent(readings)}&name=${encodeURIComponent('kitaev slides.pdf')}`, body: slides, type: 'application/octet-stream' })).status, 409);
    assert.equal((await call(routes, 'POST', 'upload', { query: `dir=${encodeURIComponent(readings)}&name=run.exe`, body: slides, type: 'application/octet-stream' })).status, 415);
    assert.equal((await call(routes, 'POST', 'upload', { query: `dir=${encodeURIComponent(path.dirname(fx.base))}&name=x.pdf`, body: slides, type: 'application/octet-stream' })).status, 403);
    assert.equal((await call(routes, 'POST', 'upload', { query: `dir=${encodeURIComponent(readings)}&name=y.pdf`, body: slides, type: 'text/plain' })).status, 403, 'a form post cannot upload');

    const lecture = await call(routes, 'POST', 'lecture', { body: { url: 'https://www.youtube.com/watch?v=abc', title: 'A simple model of quantum holography', speaker: 'A. Kitaev', venue: 'KITP', why: 'Origin of the soft mode.', topic: fx.file('topics/topology/research.md'), transcript: { name: 'part1.vtt', text: 'WEBVTT\n\n00:12:30.000 --> 00:12:35.000\nThe soft mode.\n' } } });
    assert.equal(lecture.status, 200, JSON.stringify(lecture.json));
    const note = await fsp.readFile(lecture.json.file, 'utf8');
    assert.equal(path.basename(lecture.json.file), 'a-kitaev-a-simple-model-of-quantum-holography.md');
    assert.match(note, /kind: "source"/);
    assert.match(note, /\*\*Recording\.\*\* \[KITP\]\(https:\/\/www\.youtube\.com\/watch\?v=abc\), A\. Kitaev\. Added \d{4}-\d\d-\d\d; not yet watched\./);
    assert.match(note, /\[12:30\]\(https:\/\/www\.youtube\.com\/watch\?v=abc&t=750\)/);
    assert.match(await fsp.readFile(lecture.json.transcript, 'utf8'), /The soft mode\./);
    assert.equal((await call(routes, 'POST', 'lecture', { body: { url: 'https://www.youtube.com/watch?v=abc', title: 'A simple model of quantum holography', speaker: 'A. Kitaev' } })).status, 409);

    assert.deepEqual((await call(routes, 'GET', 'discover')).json.searches, []);
    const saved = await call(routes, 'POST', 'discover/save', { body: { searches: [{ query: 'Krylov complexity · operator growth', topic: fx.file('topics/topology/research.md') }], dismissed: { '2601.00002': '2026-11-16' } } });
    assert.equal(saved.status, 200);
    const back = (await call(routes, 'GET', 'discover')).json;
    assert.deepEqual([back.searches[0].query, back.dismissed['2601.00002']], ['Krylov complexity · operator growth', '2026-11-16']);
    assert.equal(back.file, fx.file('knowledge/library/discover.json'));

    const quiet = network();
    const off = host({ root: fx.root, web: false, request: quiet.request });
    assert.equal((await call(off, 'GET', 'web/lookup', { query: 'q=2207.07701' })).status, 403);
    assert.equal((await call(off, 'POST', 'web/add', { body: { id: '2207.07701', version: 'v2' } })).status, 403);
    assert.equal(quiet.asked.length, 0);
    assert.equal((await call(off, 'GET', 'overview')).json.online, false);
  } finally {
    await fx.cleanup();
  }
});

test('web: a manuscript cites from its .bib and the library; a new arXiv entry comes from INSPIRE, or from metadata offline', async () => {
  const fx = await makeFixture();
  try {
    const dir = fx.file('topics/topology/manuscript');
    const paper = path.join(dir, 'paper.tex');
    await fsp.writeFile(paper, '\\documentclass{article}\n\\begin{document}\nText.\n\\bibliography{refs}\n\\end{document}\n');
    const bib = path.join(dir, 'refs.bib');
    await fsp.writeFile(bib, '@article{haldane1988exact, title={Exact ground state}, author={Haldane, F. D. M.}, year={1988}}\n');
    const net = network();
    const routes = host({ root: fx.root, request: net.request });
    const index = await call(routes, 'GET', 'latex/cite-index', { query: 'path=' + encodeURIComponent(paper) });
    assert.equal(index.status, 200, JSON.stringify(index.json));
    assert.deepEqual(index.json.entries.map((e) => e.key), ['haldane1988exact']);
    assert.deepEqual(index.json.bibs.map((b) => [path.basename(b.file), b.exists]), [['refs.bib', true]]);
    assert.ok(index.json.library.some((p) => p.arxiv === '1510.07698' && p.title === 'Three lectures on topological phases of matter'));

    const cited = await call(routes, 'POST', 'latex/cite', { body: { bib, arxiv: '2207.07701' } });
    assert.deepEqual(cited.json, { key: 'Rabinovici:2022beu', added: true });
    const again = await call(routes, 'POST', 'latex/cite', { body: { bib, arxiv: 'arXiv:2207.07701v2' } });
    assert.deepEqual(again.json, { key: 'Rabinovici:2022beu', added: false });
    assert.match(await fsp.readFile(bib, 'utf8'), /^@article\{haldane1988exact[\s\S]*\n\n@article\{Rabinovici:2022beu,[\s\S]*\n\}\n$/);

    const off = host({ root: fx.root, web: false, request: net.request });
    const offline = await call(off, 'POST', 'latex/cite', { body: { bib, arxiv: '1510.07698', meta: { title: 'Three lectures on topological phases of matter', authors: ['Christopher Mudry'], year: 2015 } } });
    assert.deepEqual(offline.json, { key: 'Mudry:2015three', added: true });
    assert.match(await fsp.readFile(bib, 'utf8'), /@article\{Mudry:2015three,\n {4}author = "Christopher Mudry",\n {4}title = "\{Three lectures on topological phases of matter\}",\n {4}eprint = "1510\.07698",/);
    assert.equal((await call(routes, 'POST', 'latex/cite', { body: { bib: fx.file('knowledge/library/x.bib'), arxiv: '2207.07701' } })).status, 403, 'the library takes no bibliography');
  } finally {
    await fx.cleanup();
  }
});

test('web: a configured proxy that is not running falls back to the direct route', async () => {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end('direct');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const saved = { NO_PROXY: process.env.NO_PROXY, no_proxy: process.env.no_proxy };
  process.env.NO_PROXY = '';
  process.env.no_proxy = '';
  try {
    const closed = await new Promise((resolve) => {
      const probe = http.createServer();
      probe.listen(0, '127.0.0.1', () => {
        const port = probe.address().port;
        probe.close(() => resolve(port));
      });
    });
    const web = createWeb({ proxy: `http://127.0.0.1:${closed}` });
    assert.equal(await web.text(`http://127.0.0.1:${server.address().port}/x`), 'direct');
  } finally {
    process.env.NO_PROXY = saved.NO_PROXY ?? '';
    process.env.no_proxy = saved.no_proxy ?? '';
    if (saved.NO_PROXY === undefined) delete process.env.NO_PROXY;
    if (saved.no_proxy === undefined) delete process.env.no_proxy;
    server.close();
  }
});

test('web: a paper is read through Atlas without being saved, and a paper map files it under its topic', async () => {
  const fx = await makeFixture();
  try {
    await fsp.mkdir(path.join(fx.knowledge, 'templates'), { recursive: true });
    await fsp.writeFile(path.join(fx.knowledge, 'templates', 'paper.md'), TEMPLATE);
    const net = network();
    const routes = host({ root: fx.root, request: net.request });
    const before = await snapshot(fx.base);
    const read = await call(routes, 'GET', 'web/pdf', { query: 'id=2207.07701v2' });
    assert.equal(read.status, 200);
    assert.deepEqual(read.raw, net.pdf, 'the PDF passes through unchanged');
    const asked = net.asked.length;
    assert.equal((await call(routes, 'GET', 'web/pdf', { query: 'id=2207.07701v2' })).status, 200);
    assert.equal(net.asked.length, asked, 'read again from memory, not fetched again');
    assert.deepEqual(await snapshot(fx.base), before, 'reading writes nothing');
    assert.equal((await call(routes, 'GET', 'web/pdf', { query: 'id=not-an-id' })).status, 400);
    const off = host({ root: fx.root, web: false, request: net.request });
    assert.equal((await call(off, 'GET', 'web/pdf', { query: 'id=2207.07701v2' })).status, 403, 'web: false stops it');
    // Added for the topology topic, whose note does not cite it: By topic files it there.
    const topology = fx.file('topics/topology/research.md');
    const added = await call(routes, 'POST', 'web/add', { body: { id: '2207.07701', version: 'v2', source: false, note: true, why: 'Operator growth', topic: topology } });
    assert.equal(added.status, 200);
    const map = await fsp.readFile(added.json.map.file, 'utf8');
    assert.match(map, /\*\*Why I'm reading it\.\*\* Operator growth\. For \[[^\]]+\]\([^)]*topology\/research\.md\)/);
    const k = (await call(routes, 'GET', 'knowledge', { query: 'fresh=1' })).json;
    const filed = k.byTopic.find((t) => t.id === 'topology');
    assert.ok(filed && filed.arxiv.includes('2207.07701'), JSON.stringify(k.byTopic.map((t) => [t.id, t.arxiv])));
    assert.ok(k.papers.find((p) => p.key === '2207.07701').usedBy.some((u) => u.id === 'topology'));
  } finally {
    await fx.cleanup();
  }
});
