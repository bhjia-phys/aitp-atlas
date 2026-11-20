/**
 * The host half against a fake DSH context: DSH's authentication guards every
 * route, documents stream with byte ranges, folders list, contents are sorted
 * by kind, and the editor saves only what has not changed on disk meanwhile.
 * Nothing else in the research tree changes.
 */
import assert from 'node:assert/strict';
import { texHead } from '../lib/write.js';
import { promises as fsp } from 'node:fs';
import path from 'node:path';
import { Readable, Writable } from 'node:stream';
import test from 'node:test';
import { apply, normalizeConfig } from '../index.js';
import { makeFixture, snapshot } from './fixture.mjs';

const COOKIE = 'dsh-browser=signed';

function fakeContext({ withConnection = true } = {}) {
  const routes = new Map();
  const touched = [], registrations = [];
  const record = (name) => new Proxy({}, { get: (_t, key) => (...args) => touched.push(`${name}.${String(key)}`) });
  // DSH's connection service: a signed cookie admits, anything else is 401.
  const connection = { requestRejection: (req) => (String((req.headers || {}).cookie || '').includes(COOKIE) ? undefined : 401) };
  const web = {
    effect: (fn) => fn(),
    webServer: { register: (route) => {
      registrations.push(`${route.kind}:${route.path}`);
      if (routes.has(route.path)) throw new Error('Duplicate route owner');
      routes.set(route.path, route);
    } },
    get: (name) => (name === 'connection' && withConnection ? connection : undefined),
  };
  const ctx = {
    effect: (fn) => fn(),
    tools: record('tools'),
    systemPrompt: record('systemPrompt'),
    get: () => undefined,
    inject: (names, fn) => {
      assert.deepEqual(names, ['webServer']);
      fn(web);
    },
  };
  return { ctx, routes, touched, registrations };
}

async function call(routes, method, name, { query = '', body, headers, cookie = true, raw = false } = {}) {
  const pathname = `/aitp-atlas/api/${name}`;
  const route = routes.get(pathname) || [...routes.values()].filter((r) => r.kind === 'prefix' && pathname.startsWith(`${r.path}/`)).sort((a,b) => b.path.length - a.path.length)[0];
  assert.ok(route, `route ${name}`);
  const req = Readable.from(body === undefined ? [] : [Buffer.from(typeof body === 'string' ? body : JSON.stringify(body))]);
  req.method = method;
  req.url = `/aitp-atlas/api/${name}${query ? '?' + query : ''}`;
  req.headers = { host: '127.0.0.1:3000', ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...(cookie ? { cookie: COOKIE } : {}), ...(headers || {}) };
  const chunks = [];
  const out = {};
  const res = new Writable({
    write(chunk, _encoding, done) {
      chunks.push(Buffer.from(chunk));
      done();
    },
  });
  res.statusCode = 200;
  res.headersSent = false;
  res.setHeader = (k, v) => {
    out[k.toLowerCase()] = v;
  };
  const finished = new Promise((resolve) => res.on('finish', resolve));
  await route.handler(req, res);
  await finished;
  const buffer = Buffer.concat(chunks);
  const json = !raw && out['content-type'] && out['content-type'].includes('json') ? JSON.parse(buffer.toString('utf8')) : null;
  return { status: res.statusCode, headers: out, json, buffer };
}

const q = (path) => 'path=' + encodeURIComponent(path);

test('host: first use initializes the configured folder without overwriting a root note', async () => {
  const fx = await makeFixture();
  try {
    const unconfigured = fakeContext();
    apply(unconfigured.ctx, {});
    assert.equal((await call(unconfigured.routes, 'GET', 'overview')).json.error.code, 'unconfigured');
    assert.deepEqual([...unconfigured.routes.keys()], ['/aitp-atlas/api/overview', ...['Roman', 'Italic'].map((s) => `/aitp-atlas/api/fonts/SourceSerif4Variable-${s}.woff2`)]);
    for (const style of ['Italic', 'Roman']) {
      const asset = `fonts/SourceSerif4Variable-${style}.woff2`;
      assert.equal((await call(unconfigured.routes, 'GET', asset, { cookie: false })).status, 401);
      const response = await call(unconfigured.routes, 'GET', asset);
      assert.equal(response.status, 200);
      assert.equal(response.headers['content-type'], 'font/woff2');
      assert.equal(response.buffer.toString('ascii', 0, 4), 'wOF2');
      assert.equal(response.buffer.readUInt32BE(8), response.buffer.length);
    }

    const root = fx.file('new workspace');
    const file = path.join(root, 'research.md');
    const { ctx, routes } = fakeContext();
    apply(ctx, { root });
    assert.equal((await call(routes, 'GET', 'overview')).json.error.code, 'missing-folder');
    assert.equal((await call(routes, 'POST', 'workspace/init', { body: {} })).status, 404);
    await fsp.mkdir(root);
    assert.equal((await call(routes, 'GET', 'overview')).json.error.code, 'missing-note');
    assert.equal((await call(routes, 'POST', 'workspace/init', { body: {}, cookie: false })).status, 401);
    assert.equal((await call(routes, 'POST', 'workspace/init', { body: { path: fx.root } })).status, 400);
    assert.deepEqual(await fsp.readdir(root), []);

    const initialize = () => call(routes, 'POST', 'workspace/init', { body: {} });
    const responses = await Promise.all([initialize(), initialize()]);
    assert.deepEqual(responses.map(({ status }) => status).sort(), [201, 409]);
    assert.equal(responses.find(({ status }) => status === 201).json.path, file);
    const saved = await fsp.readFile(file, 'utf8');
    assert.match(saved, /^# Research programme\n/);
    const opened = await call(routes, 'GET', 'overview', { query: 'fresh=1' });
    assert.equal(opened.status, 200);
    assert.equal(opened.json.rootFile, file);
    assert.equal(await fsp.readFile(file, 'utf8'), saved);

    const existing = fakeContext();
    apply(existing.ctx, { root: fx.root });
    const before = await fsp.readFile(fx.file('topics/research.md'), 'utf8');
    assert.equal((await call(existing.routes, 'POST', 'workspace/init', { body: {} })).status, 409);
    assert.equal(await fsp.readFile(fx.file('topics/research.md'), 'utf8'), before);
  } finally {
    await fx.cleanup();
  }
});

test('host: authenticated routes, sorted contents, in-app documents and folders', async () => {
  const fx = await makeFixture();
  try {
    const before = await snapshot(fx.base);
    const h = fakeContext();
    apply(h.ctx, { root: fx.root });
    assert.deepEqual(h.touched, [], 'Atlas gives the agent nothing: no tools, no prompt, no context, no guard');
    assert.deepEqual([...h.routes.keys()].map((p) => p.replace('/aitp-atlas/api/', '')).sort(), ['append', 'dir', 'discover', 'discover/save', 'discussions', 'discussions/import', 'fonts/SourceSerif4Variable-Italic.woff2', 'fonts/SourceSerif4Variable-Roman.woff2', 'inquiry-evidence', 'inquiry-figure', 'knowledge', 'latex/build', 'latex/cite', 'latex/cite-index', 'latex/engines', 'latex/sync/edit', 'latex/sync/view', 'learn', 'lecture', 'needs', 'note', 'open', 'overview', 'paper-map', 'raw', 'review/baseline', 'review/changes', 'review/forget', 'review/keep', 'review/pending', 'review/revert', 'route', 'save', 'search', 'teams', 'upload', 'vendor/pdf.min.mjs', 'vendor/pdf.worker.min.mjs', 'web/add', 'web/citations', 'web/citing', 'web/lookup', 'web/pdf', 'web/search', 'workspace/init', 'write']);

    // Without DSH's signed browser cookie, every route answers 401.
    for (const name of ['overview', 'note', 'raw', 'dir', 'inquiry-evidence', 'inquiry-figure', 'knowledge', 'vendor/pdf.min.mjs']) {
      assert.equal((await call(h.routes, 'GET', name, { query: q(fx.file('topics/research.md')), cookie: false })).status, 401, name);
    }
    assert.equal((await call(h.routes, 'POST', 'save', { body: { path: fx.file('topics/x.md'), text: 'x', create: true }, cookie: false })).status, 401);

    const cite = (pointer,root=fx.root) => call(h.routes,'GET','inquiry-evidence',{query:new URLSearchParams({expectedRoot:root,pointer}).toString()});
    assert.deepEqual((await cite('mc/worm/research.md#L4')).json,{path:fx.file('topics/mc/worm/research.md'),anchor:'L4'});
    for (const pointer of ['../knowledge/index.md','.hidden/config','C:/outside','a%2Fb','NUL.md','x#bogus']) assert.equal((await cite(pointer)).status,400,pointer);
    assert.equal((await cite('missing.md')).status,404);
    assert.equal((await cite('research.md',fx.base)).status,409);
    const ov = (await call(h.routes, 'GET', 'overview', { query: 'fresh=1' })).json;
    assert.deepEqual(ov.directions.map((d) => d.topics), [['mc/worm', 'mc/continuation'], ['topology'], []]);
    assert.deepEqual(ov.topics['mc/worm'].latest, { name: 'Mixing test', status: 'paused', date: '2026-11-02' });
    assert.equal(ov.topics['mc/worm'].counts.notes, 1);
    assert.deepEqual(ov.timeline.slice(0, 2).map((e) => e.name), ['Critical exponents', 'Parallel tempering → independent topic']);
    // What waits on the researcher travels with each topic; a pointer names its owner's file.
    assert.deepEqual(ov.topics['mc/continuation'].waiting.map((t) => [t.name, t.status, t.date, t.owner]), [['Window choice', 'waiting on the researcher', '2026-10-20', '']]);
    assert.deepEqual(ov.topics[''].waiting.map((t) => [t.name, t.owner]), [['Window choice', fx.file('topics/mc/continuation/research.md')]]);
    assert.deepEqual(ov.topics.orphan.waiting.map((t) => t.name), ['Orphan decision']);
    assert.deepEqual(ov.topics['mc/worm'].waiting, []);
    assert.deepEqual(ov.web, [['mc/continuation', 'topology']]);
    assert.deepEqual(ov.counts, { topics: 5, directions: 3, unreached: 1, entries: 3, papers: 1 });

    // A topic: its contents sorted by kind, with missing files marked.
    const note = (await call(h.routes, 'GET', 'note', { query: q(fx.file('topics/mc/worm/research.md')) })).json;
    assert.equal(note.shown, 'topics/mc/worm/research.md');
    assert.equal(note.editable, true);
    const groups = Object.fromEntries(note.topic.contents.map((g) => [g.key, g.items]));
    assert.deepEqual(Object.keys(groups), ['branches', 'notes', 'reports', 'code', 'data', 'knowledge', 'topics']);
    assert.deepEqual(groups.notes.map((i) => [i.label, i.exists]), [['the plan', false]]);
    assert.deepEqual(groups.data.map((i) => [i.type, i.exists, i.section]), [['image', true, 'The equilibrium distribution'], ['table', true, 'The equilibrium distribution']]);
    assert.equal(groups.knowledge[0].exists, true);
    const topo = (await call(h.routes, 'GET', 'note', { query: q(fx.file('topics/topology/research.md')) })).json;
    assert.deepEqual(topo.topic.contents.map((g) => [g.key, g.items.map((i) => i.type)]), [['papers', ['pdf', 'arxiv']], ['writing', ['tex']]]);

    // Documents: a supporting file knows its topic; LaTeX is text; a PDF streams, with byte ranges.
    const tex = (await call(h.routes, 'GET', 'note', { query: q(fx.file('topics/topology/manuscript/draft.tex')) })).json;
    assert.deepEqual([tex.type, tex.editable, tex.owner.id], ['tex', true, 'topology']);
    const pdf = await call(h.routes, 'GET', 'raw', { query: q(fx.file('topics/topology/readings/thouless.pdf')), raw: true });
    assert.equal(pdf.status, 200);
    assert.equal(pdf.headers['content-type'], 'application/pdf');
    assert.match(pdf.headers['content-security-policy'], /sandbox/);
    const fixturePdf = await fsp.readFile(fx.file('topics/topology/readings/thouless.pdf'));
    assert.deepEqual(pdf.buffer, fixturePdf);
    assert.match(pdf.buffer.toString('ascii'), /\(Atlas reading fixture\) Tj/);
    const part = await call(h.routes, 'GET', 'raw', { query: q(fx.file('topics/topology/readings/thouless.pdf')), headers: { range: 'bytes=0-3' }, raw: true });
    assert.equal(part.status, 206);
    assert.equal(part.headers['content-range'], `bytes 0-3/${fixturePdf.length}`);
    assert.equal(part.buffer.toString('utf8'), '%PDF');
    assert.equal((await call(h.routes, 'GET', 'raw', { query: q(fx.file('topics/mc/worm/research.md')) })).status, 415);
    const dir = (await call(h.routes, 'GET', 'dir', { query: q(fx.file('topics/mc/worm')) })).json;
    assert.deepEqual(dir.entries.map((e) => e.name), ['code', 'data', 'figures', 'stability', 'research.md']);
    assert.equal(dir.topic.id, 'mc/worm');
    const vendor = await call(h.routes, 'GET', 'vendor/pdf.min.mjs', { raw: true });
    assert.equal(vendor.status, 200);
    assert.match(vendor.headers['content-type'], /javascript/);

    // Refusals.
    assert.equal((await call(h.routes, 'GET', 'note', { query: q(fx.file('../outside.md')) })).status, 403);
    assert.equal((await call(h.routes, 'GET', 'note', { query: q(fx.file('knowledge/library/arxiv/1510.07698v2/paper.pdf')) })).status, 415);
    assert.equal((await call(h.routes, 'POST', 'overview')).status, 405);
    assert.equal((await call(h.routes, 'POST', 'open', { body: 'path=x', headers: { 'content-type': 'text/plain' } })).status, 403);
    assert.deepEqual(await snapshot(fx.base), before, 'reading changes nothing');
  } finally {
    await fx.cleanup();
  }
});

test('host: the editor creates and saves notes, and never overwrites a changed file', async () => {
  const fx = await makeFixture();
  try {
    const h = fakeContext();
    apply(h.ctx, { root: fx.root });
    const fresh = fx.file('topics/mc/worm/notes/spectral-flow.md');
    const created = await call(h.routes, 'POST', 'save', { body: { path: fresh, text: '# Spectral flow\n\n', create: true } });
    assert.equal(created.status, 200);
    assert.equal(await fsp.readFile(fresh, 'utf8'), '# Spectral flow\n\n');
    assert.equal((await call(h.routes, 'POST', 'save', { body: { path: fresh, text: 'again', create: true } })).status, 409, 'create never replaces a file');

    const opened = (await call(h.routes, 'GET', 'note', { query: q(fresh) })).json;
    const saved = await call(h.routes, 'POST', 'save', { body: { path: fresh, text: '# Spectral flow\n\nThe index counts crossings.\n', mtimeMs: opened.mtimeMs } });
    assert.equal(saved.status, 200);
    // Another writer (an AI session) changes the file; a save based on the old reading is refused.
    await new Promise((resolve) => setTimeout(resolve, 20));
    await fsp.writeFile(fresh, '# Spectral flow\n\nEdited by a session.\n', 'utf8');
    const stale = await call(h.routes, 'POST', 'save', { body: { path: fresh, text: 'mine', mtimeMs: saved.json.mtimeMs } });
    assert.equal(stale.status, 409);
    assert.equal(stale.json.conflict, true);
    assert.equal(await fsp.readFile(fresh, 'utf8'), '# Spectral flow\n\nEdited by a session.\n');
    assert.equal((await call(h.routes, 'POST', 'save', { body: { path: fresh, text: 'mine', overwrite: true } })).status, 200, 'overwrite is an explicit choice');

    // Only notes, LaTeX, BibTeX and text; only inside the research and the knowledge collection; never the library.
    assert.equal((await call(h.routes, 'POST', 'save', { body: { path: fx.file('topics/mc/worm/code/new.py'), text: 'x', create: true } })).status, 415);
    assert.equal((await call(h.routes, 'POST', 'save', { body: { path: fx.file('outside/new.md'), text: 'x', create: true } })).status, 403);
    assert.equal((await call(h.routes, 'POST', 'save', { body: { path: fx.file('knowledge/library/notes.md'), text: 'x', create: true } })).status, 403);
    assert.equal((await call(h.routes, 'POST', 'save', { body: { path: fx.file('topics/mc/worm/research.md'), text: 'x', create: true } })).status, 409);
    const tex = fx.file('topics/topology/manuscript/section.tex');
    assert.equal((await call(h.routes, 'POST', 'save', { body: { path: tex, text: '\\section{Edge}\n', create: true } })).status, 200);
    assert.equal((await call(h.routes, 'POST', 'save', { body: { path: fresh, text: 'x' }, headers: { origin: 'https://elsewhere.example' } })).status, 403);
  } finally {
    await fx.cleanup();
  }
});

test('host: without DSH authentication only this computer is answered', async () => {
  const fx = await makeFixture();
  try {
    // While DSH may still be mounting its sign-in service, nothing is answered.
    const early = fakeContext({ withConnection: false });
    apply(early.ctx, { root: fx.root });
    assert.equal((await call(early.routes, 'GET', 'overview', { cookie: false })).status, 503);
    // A profile that has no sign-in service at all is answered on this computer only.
    const h = fakeContext({ withConnection: false });
    apply(h.ctx, { root: fx.root, authGraceMs: 0 });
    assert.equal((await call(h.routes, 'GET', 'overview', { cookie: false })).status, 200);
    assert.equal((await call(h.routes, 'GET', 'overview', { cookie: false, headers: { host: 'atlas.attacker.example:3000' } })).status, 403);
    const settings = normalizeConfig({ root: '/r', writeIndex: true, guard: true, maxAgeSeconds: 2 });
    assert.deepEqual(Object.keys(settings).sort(), ['authGraceMs', 'exclude', 'excludePaths', 'knowledge', 'library', 'maxAgeSeconds', 'proxy', 'request', 'root', 'stateDir', 'theme', 'themes', 'web']);
    assert.deepEqual([settings.theme, settings.themes], ['auto', {}], 'auto follows DSH unless the config names a theme');
    assert.equal(normalizeConfig({ root: '/r', theme: 'Day; x' }).theme, 'auto', 'an odd theme name falls back to auto');
    assert.equal(settings.authGraceMs, 30000);
    assert.equal(settings.web, true);
    assert.equal(settings.request, undefined, 'a YAML config cannot supply a request function');
    assert.equal(normalizeConfig({ root: '/r', web: false }).web, false);
  } finally {
    await fx.cleanup();
  }
});

test('discussions: exact/prefix dispatch, authenticated same-origin mutations, workspace isolation and needs', async (t) => {
  const fx = await makeFixture(), other = await makeFixture(); t.after(fx.cleanup); t.after(other.cleanup);
  const stateDir = fx.file('interface-state');
  const h = fakeContext(); apply(h.ctx, {root:fx.root,stateDir});
  assert.equal(new Set(h.registrations).size, h.registrations.length);
  assert.equal(h.routes.get('/aitp-atlas/api/discussions').kind,'prefix');
  assert.equal(h.routes.get('/aitp-atlas/api/discussions/import').kind,'exact');
  const payload = {id:'test-1',title:'Question',topic:'mc/worm',filing:'auto',origin:'desk'};
  const request = (method, name, opts) => call(h.routes,method,name,opts);
  assert.equal((await request('POST','discussions',{body:payload,cookie:false})).status,401);
  const made = await request('POST','discussions',{body:payload,headers:{origin:'http://127.0.0.1:3000'}}); assert.equal(made.status,200); assert.equal(made.json.discussion.topic.path,fx.file('topics/mc/worm/research.md'));
  for (const headers of [{origin:'https://wrong.test'},{origin:'https://127.0.0.1:3000'},{origin:'null'},{'content-type':'application/json-evil'}]) {
    assert.equal((await request('PATCH','discussions/test-1',{body:{pinned:true},headers})).status,403);
  }
  assert.equal((await request('PATCH','discussions/test-1',{body:{pinned:true},cookie:false})).status,401);
  assert.equal((await request('PATCH','discussions/test-1',{body:{pinned:true}})).json.discussion.pinned,true);
  assert.equal((await request('GET','discussions/import')).status,405);
  assert.equal((await request('POST','discussions/import',{body:{records:[{id:'s2'},{id:'legacy',kind:'team'}]}})).json.imported,1);
  assert.equal((await request('GET','discussions',{query:'topic=mc%2Fworm'})).json.discussions.length,1);
  assert.equal((await request('PATCH','discussions/unknown',{body:{pinned:true}})).json.error.code,'NOT_FOUND');
  assert.equal((await request('PATCH','discussions/nested/file',{body:{pinned:true}})).status,404);
  const second = fakeContext(); apply(second.ctx,{root:other.root,stateDir});
  assert.deepEqual((await call(second.routes,'GET','discussions')).json.discussions,[]);
  const route=await request('GET','route',{query:'q=worm'}); assert.equal(route.status,200); assert.ok(Array.isArray(route.json.candidates));
  const needs=await request('GET','needs'); assert.equal(needs.status,200,JSON.stringify(needs.json)); assert.ok(needs.json.waiting.length); assert.deepEqual(needs.json.decisions,[]); assert.deepEqual(needs.json.reviews,[]);
  // Both sessions watch one file; a direct human edit counts as an observation, not an author claim.
  const note=made.json.discussion.topic.path;
  for (const session of ['test-1','s2']) await request('POST','review/baseline',{body:{session,files:[note]}});
  await fsp.appendFile(note,'\nIndependent edit observed by both discussions.\n');
  const observed=(await request('GET','needs')).json.reviews;
  assert.deepEqual(observed.map(r=>[r.session,r.edits,r.shared]).sort(),[['s2',1,true],['test-1',1,true]]);
  assert.deepEqual((await call(second.routes,'GET','needs')).json.reviews,[]);
});

test('teams routes use one authenticated owner, including nested decision and legacy writes',async t=>{
  const fx=await makeFixture(); t.after(fx.cleanup); const {ctx,routes,registrations}=fakeContext(); apply(ctx,{root:fx.root,stateDir:fx.file('ui-state')});
  const endpoint='/aitp-atlas/api/teams';assert.equal(registrations.filter(r=>r===`prefix:${endpoint}`).length,1);
  const request=(method,name,opts)=>call(routes,method,name,opts);
  for(const [method,resource] of [['GET','teams'],['PATCH','teams/test'],['POST','teams'],['POST','teams/preview'],['POST','teams/import'],['POST','teams/test/events'],['POST','teams/test/seats'],['POST','teams/test/decisions/D01/answer']]){
    assert.equal((await request(method,resource,{cookie:false,body:method==='GET'?undefined:{}})).status,401);
    if(method!=='GET')assert.equal((await request(method,resource,{headers:{origin:'https://different.test'},body:{}})).status,403);
  }
  const topic={id:'mc/worm',path:fx.file('topics/mc/worm/research.md')}, draft={requestId:'form-1',topic,goal:'Compare spectra',doneWhen:'Check the limit',seats:[]};
  const kit=await request('POST','teams/preview',{body:draft});assert.equal(kit.status,200,JSON.stringify(kit.json));
  const {team,brief}= (await request('POST','teams',{body:draft})).json;assert.equal(brief,kit.json.brief);
  assert.equal((await request('PATCH',`teams/${team.id}`,{body:{leadId:'lead-id'}})).json.team.leadId,'lead-id');
  assert.ok((await request('GET',`teams/${team.id}/artifacts`)).json.charter);
  assert.equal((await request('POST','teams/import',{body:{expectedRoot:fx.knowledge,records:[{id:'wrong',kind:'team'}]}})).status,409);
  assert.equal((await request('GET','teams')).json.teams.length,1);
  const other=await makeFixture();t.after(other.cleanup);
  const query=`expectedRoot=${encodeURIComponent(other.root)}`, before=await snapshot(fx.base);
  for(const [method,resource,body] of [['GET','teams'],['GET','needs'],['GET',`teams/${team.id}/artifacts`],['POST','review/baseline',{session:'old-lead',files:[topic.path]}],['PATCH',`teams/${team.id}`,{paused:true}],['POST','teams/import',{records:[{kind:'team',id:'foreign'}]}]]){
    const reply=await request(method,resource,{query,body});assert.equal(reply.status,409);assert.equal(reply.json.error.code,'WORKSPACE_CHANGED');assert.equal('teams' in reply.json,false);
  }
  assert.deepEqual(await snapshot(fx.base),before,'stale UI requests must not touch research or interface state');
  const good=`expectedRoot=${encodeURIComponent(fx.root)}`;
  for(const resource of ['teams','needs'])assert.equal((await request('GET',resource,{query:good})).json.root,fx.root);
});

test('write: the LaTeX documents the notes link, a section standing for its document, figures left out', async () => {
  assert.deepEqual(texHead('% \\documentclass{article}\n\\documentclass[11pt]{revtex4-2}\n\\title{Level statistics of the \\emph{kicked} top}\n'), { document: true, docClass: 'revtex4-2', title: 'Level statistics of the kicked top' });
  assert.equal(texHead('\\documentclass[tikz]{standalone}\n').document, false, 'a standalone figure is not a document');
  assert.equal(texHead('\\documentclass{article}\n\\title{Worm and Swendsen--Wang updates for the $\\mathcal{O}(2)\\ XY$ model --- notes}\n').title, 'Worm and Swendsen–Wang updates for the O(2) XY model — notes', 'LaTeX spacing, dashes and math wrappers read as text');
  assert.equal(texHead('\\section{Model}\n').document, false);
  assert.equal(texHead('%\\documentclass{article}\n').document, false, 'a commented-out class does not count');
  const fx = await makeFixture();
  try {
    const dir = fx.file('topics/topology/manuscript');
    await fsp.writeFile(path.join(dir, 'edge.tex'), '% !TEX root = draft.tex\n\\section{Edge}\n');
    await fsp.writeFile(path.join(dir, 'figure.tex'), '\\documentclass{standalone}\n\\begin{document}x\\end{document}\n');
    const note = fx.file('topics/topology/research.md');
    await fsp.appendFile(note, '\nThe [edge section](manuscript/edge.tex) and [a figure](manuscript/figure.tex).\n');
    const h = fakeContext();
    apply(h.ctx, { root: fx.root });
    const r = await call(h.routes, 'GET', 'write');
    assert.equal(r.status, 200);
    assert.deepEqual(r.json.documents.map((d) => [path.relative(fx.root, d.file).split(path.sep).join('/'), d.title, d.topic && d.topic.id, d.pdf]), [['topology/manuscript/draft.tex', 'draft', 'topology', null]], 'the section stands for draft.tex; the figure is not listed');
  } finally {
    await fx.cleanup();
  }
});
