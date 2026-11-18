/**
 * End-to-end test inside a real DeepSeek Harness host, in a throwaway DSH home
 * (DSH_HOME in a temporary folder, so the researcher's ~/.dsh is never touched).
 *
 *   1. headless: Atlas installs and activates, and the model sees nothing from it:
 *      no tools, no system section, no injected memory (checked on the requests a
 *      mock Messages server receives).
 *   2. web: the Atlas API answers from the fixture research tree.
 *   3. the research tree is byte-for-byte unchanged.
 *
 * Needs an installed DSH desktop (set DSH_EXE and DSH_CLI otherwise); without
 * one it reports SKIP. Run: `node test/dsh-e2e.mjs [path-to-package.tgz]`.
 */
import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { existsSync, promises as fsp } from 'node:fs';
import { once } from 'node:events';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeFixture, snapshot } from './fixture.mjs';

const here = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const installTarget = process.argv[2] ? path.resolve(process.argv[2]) : here;
const appDir = path.join(process.env.LOCALAPPDATA || '', 'Programs', 'DeepSeek Harness');
const dshExe = process.env.DSH_EXE || path.join(appDir, 'DeepSeek Harness.exe');
const dshCli = process.env.DSH_CLI || path.join(appDir, 'resources', 'app.asar', 'dsh', 'node_modules', '@deepseek-ai', 'dsh-desktop-host', 'lib', 'cli.js');
if (!existsSync(dshExe)) {
  console.log(`SKIP: no DeepSeek Harness executable at ${dshExe} (set DSH_EXE and DSH_CLI)`);
  process.exit(0);
}

const fx = await makeFixture();
const home = path.join(fx.base, 'dsh-home');
let checks = 0;
const ok = (label) => {
  checks += 1;
  console.log(`ok ${label}`);
};

// A Messages-compatible mock that answers every turn with one line of text.
const requests = [];
const model = http.createServer((req, res) => {
  const chunks = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', () => {
    let body = {};
    try {
      body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
    } catch {
      body = {};
    }
    requests.push(body);
    if (req.method !== 'POST' || !/\/messages$/.test(req.url.split('?')[0])) {
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ type: 'error', error: { type: 'not_found_error', message: 'mock' } }));
      return;
    }
    const events = [
      ['message_start', { type: 'message_start', message: { id: `msg_${Date.now()}`, type: 'message', role: 'assistant', model: body.model || 'mock', content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 1 } } }],
      ['content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }],
      ['content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Atlas E2E done.' } }],
      ['content_block_stop', { type: 'content_block_stop', index: 0 }],
      ['message_delta', { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 5 } }],
      ['message_stop', { type: 'message_stop' }],
    ];
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
    for (const [event, data] of events) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    res.end();
  });
});
await new Promise((resolve) => model.listen(0, '127.0.0.1', resolve));

const env = {
  ...process.env,
  ELECTRON_RUN_AS_NODE: '1',
  DSH_HOME: home,
  DEEPSEEK_BASE_URL: `http://127.0.0.1:${model.address().port}`,
  DEEPSEEK_API_KEY: 'sk-atlas-e2e-placeholder',
  NO_PROXY: '127.0.0.1,localhost',
  no_proxy: '127.0.0.1,localhost',
};
const dsh = (args, cwd) => new Promise((resolve) => {
  execFile(dshExe, ['--expose-internals', dshCli, ...args], { cwd, env, timeout: 300_000, maxBuffer: 64 * 1024 * 1024, windowsHide: true }, (error, stdout, stderr) => {
    resolve({ code: error ? (typeof error.code === 'number' ? error.code : 1) : 0, stdout: String(stdout), stderr: String(stderr) });
  });
});
const request = (port, name, { query = '', cookie, method = 'GET', body, headers = {} } = {}) => new Promise((resolve, reject) => {
  const req = http.request({ host: '127.0.0.1', port, method, path: `/aitp-atlas/api/${name}${query ? '?' + query : ''}`, headers: { ...(cookie ? { cookie } : {}), ...(body ? { 'content-type': 'application/json' } : {}), ...headers } }, (res) => {
    const chunks = [];
    res.on('data', (c) => chunks.push(c));
    res.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8');
      let json = null;
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }
      resolve({ status: res.statusCode, headers: res.headers, json, text });
    });
  });
  req.on('error', reject);
  if (body) req.write(Buffer.isBuffer(body) ? body : JSON.stringify(body));
  req.end();
});
/** Open DSH's launch link the way a browser does, keeping the signed cookie it sets. */
const signIn = (url) => new Promise((resolve, reject) => {
  http.get(url, (res) => {
    res.resume();
    const cookies = [].concat(res.headers['set-cookie'] || []).map((c) => c.split(';')[0]);
    resolve(cookies.join('; '));
  }).on('error', reject);
});

let web = null;
let nextPort = 47000 + Math.floor(Math.random() * 900);

async function startWeb(patch) {
  const port = nextPort++;
  web = spawn(dshExe, ['--expose-internals', dshCli, '--profile', 'web', '--patch', patch, '--no-open', '--port', String(port)], { cwd: fx.base, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  web.stdout.on('data', (c) => { log += c; });
  web.stderr.on('data', (c) => { log += c; });
  let anonymous = null;
  for (let i = 0; i < 120 && !anonymous; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    anonymous = await request(port, 'overview').catch(() => null);
    // 404 until Atlas's routes are registered, 503 until DSH's sign-in service is there.
    if (anonymous && (anonymous.status === 404 || anonymous.status === 503)) anonymous = null;
  }
  assert.ok(anonymous, `the web profile did not serve the Atlas API:\n${log.slice(-2000)}`);
  assert.equal(anonymous.status, 401, 'without DSH sign-in the API answers 401');
  const launch = /dsh web: (http:\/\/127\.0\.0\.1:\d+\/\?token=[\w-]+)/.exec(log);
  assert.ok(launch, 'dsh printed its launch link');
  const cookie = await signIn(launch[1]);
  assert.ok(cookie, 'the launch link sets the browser cookie');
  return { port, cookie, call: (name, options) => request(port, name, { cookie, ...options }) };
}

async function stopWeb() {
  const host = web;
  web = null;
  if (!host || host.exitCode !== null || host.signalCode !== null) return;
  const exited = once(host, 'exit');
  host.kill();
  await exited;
}

try {
  const tree = async () => ({ ...(await snapshot(fx.root)), ...(await snapshot(fx.knowledge)) });
  const beforeHeadless = await tree();

  const overlay = path.join(fx.base, 'overlay.yml');
  await fsp.writeFile(overlay, ['- id: aitp-atlas', '  config:', `    root: ${JSON.stringify(fx.root)}`, ''].join('\n'), 'utf8');

  // 1. headless
  const installed = await dsh(['plugin', '--profile', 'headless', 'add', installTarget], fx.base);
  assert.equal(installed.code, 0, `dsh plugin add failed:\n${installed.stderr}\n${installed.stdout}`);
  ok('installs into a throwaway headless profile');
  const run = await dsh(['--profile', 'headless', '--patch', overlay, '--json', 'Where does the worm topic stand?'], fx.root);
  assert.equal(run.code, 0, `headless run failed:\n${run.stderr}`);
  assert.doesNotMatch(run.stderr, /did not activate|aitp-atlas.*(failed|error)/i, run.stderr);
  ok('activates in the headless profile, which has no web server');
  const turns = requests.filter((body) => Array.isArray(body.messages));
  assert.ok(turns.length > 0, 'the mock model was called');
  const text = JSON.stringify(turns);
  assert.ok(turns.every((body) => (body.tools || []).every((tool) => !String(tool.name).startsWith('aitp_'))), 'no Atlas tools are offered');
  assert.doesNotMatch(text, /AITP research memory|# Research memory|aitp_(bearings|recall|card|remember|paper|check|dream)/, 'no Atlas prompt section or injected memory');
  assert.deepEqual(await tree(), beforeHeadless);
  ok('gives the model nothing: no tools, no prompt section, no injected memory');

  // 2. web
  const webInstalled = await dsh(['plugin', '--profile', 'web', 'add', installTarget], fx.base);
  assert.equal(webInstalled.code, 0, `dsh plugin add (web) failed:\n${webInstalled.stderr}`);
  const rootNote = fx.file('topics/research.md');
  const rootNoteContents = await fsp.readFile(rootNote);
  await fsp.unlink(rootNote);
  const { port, cookie } = await startWeb(overlay);
  ok('DSH guards the Atlas API: 401 without sign-in, open after the launch link');
  const setup = await request(port, 'overview', { cookie });
  assert.equal(setup.json?.error?.code, 'missing-note', setup.text);
  const init = await request(port, 'workspace/init', { cookie, method: 'POST', body: {} });
  assert.equal(init.status, 201, init.text);
  assert.match(await fsp.readFile(rootNote, 'utf8'), /^# Research programme\n/);
  ok('the installed web bundle initializes a configured workspace on request');
  await fsp.writeFile(rootNote, rootNoteContents);
  const research = await tree();
  const overview = await request(port, 'overview', { cookie, query: 'fresh=1' });
  assert.equal(overview.status, 200);
  assert.equal(overview.json.title, 'Research programme');
  assert.deepEqual(overview.json.directions.map((d) => d.topics), [['mc/worm', 'mc/continuation'], ['topology'], []]);
  ok('the web profile serves the universe from the research tree');
  const note = await request(port, 'note', { query: 'path=' + encodeURIComponent(fx.file('topics/mc/worm/research.md')), cookie });
  assert.equal(note.status, 200);
  assert.equal(note.json.topic.threads[0].name, 'Mixing test');
  assert.ok(note.json.topic.contents.some((g) => g.key === 'data'), 'the topic sorts what it cites');
  const pdf = await request(port, 'raw', { query: 'path=' + encodeURIComponent(fx.file('topics/topology/readings/thouless.pdf')), cookie, headers: { range: 'bytes=0-3' } });
  assert.equal(pdf.status, 206);
  assert.equal(pdf.text, '%PDF');
  const vendor = await request(port, 'vendor/pdf.min.mjs', { cookie });
  assert.equal(vendor.status, 200);
  const outside = await request(port, 'note', { query: 'path=' + encodeURIComponent(path.join(home, 'settings.json')), cookie });
  assert.equal(outside.status, 403);
  const knowledge = await request(port, 'knowledge', { cookie });
  assert.equal(knowledge.json.papers[0].key, '1510.07698');
  ok('a topic, a PDF byte range, PDF.js and the library load; a path outside the research is refused');
  const unchanged = await tree();
  assert.deepEqual(unchanged, research);
  ok('reading leaves the research tree byte-for-byte unchanged');

  // 3. the editor, through DSH: create, then a save that a newer disk version refuses
  const fresh = fx.file('topics/mc/worm/notes/e2e.md');
  const created = await request(port, 'save', { method: 'POST', cookie, body: { path: fresh, text: '# E2E\n', create: true }, headers: { origin: `http://127.0.0.1:${port}` } });
  assert.equal(created.status, 200, created.text);
  assert.equal(await fsp.readFile(fresh, 'utf8'), '# E2E\n');
  const stale = await request(port, 'save', { method: 'POST', cookie, body: { path: fresh, text: 'old', mtimeMs: 1 }, headers: { origin: `http://127.0.0.1:${port}` } });
  assert.equal(stale.status, 409);
  const foreign = await request(port, 'save', { method: 'POST', cookie, body: { path: fresh, text: 'x', overwrite: true }, headers: { origin: 'http://attacker.example' } });
  assert.equal(foreign.status, 403);
  ok('the editor creates a note, refuses a stale save and a foreign origin');

  // 4. Begin with an empty tree, create the first topic, use its library, and restart DSH.
  await stopWeb();
  const newRoot = fx.file('fresh-workspace/topics');
  await fsp.mkdir(newRoot, { recursive: true });
  const newOverlay = fx.file('fresh-workspace.yml');
  await fsp.writeFile(newOverlay, `- id: aitp-atlas\n  config:\n    root: ${JSON.stringify(newRoot)}\n    web: false\n`);
  const freshHost = await startWeb(newOverlay);
  const post = (name, body, options) => freshHost.call(name, { method: 'POST', body, ...options });
  assert.equal((await post('workspace/init', {})).status, 201);
  const newRootNote = path.join(newRoot, 'research.md');
  assert.deepEqual(await fsp.readdir(newRoot), ['research.md']);
  const firstTopic = path.join(newRoot, 'edge-modes', 'research.md');
  const reading = path.join(newRoot, 'edge-modes', 'notes', 'symmetry.md');
  const readingText = '# Boundary symmetry\n\nThe boundary conditions determine the allowed symmetry.\n';
  assert.equal((await post('save', { path: firstTopic, create: true, text: '# Edge modes\n\n[Programme](../research.md)\n\n[Boundary symmetry](notes/symmetry.md)\n' })).status, 200);
  assert.equal((await post('save', { path: reading, create: true, text: readingText })).status, 200);
  const newRootDoc = await freshHost.call('note', { query: `path=${encodeURIComponent(newRootNote)}` });
  const programme = newRootDoc.json.raw.replace('## Research directions', '## Topological phases\n\n- [Edge modes](edge-modes/research.md)');
  assert.equal((await post('save', { path: newRootNote, text: programme, mtimeMs: newRootDoc.json.mtimeMs })).status, 200);
  const freshOverview = await freshHost.call('overview', { query: 'fresh=1' });
  assert.deepEqual(freshOverview.json.directions[0].topics, ['edge-modes']);
  assert.equal((await freshHost.call('note', { query: `path=${encodeURIComponent(reading)}` })).json.raw, readingText);
  ok('a truly empty workspace can begin and link a topic and save its supporting note');

  const savedSearch = await post('discover/save', { searches: [{ query: 'edge modes' }] });
  assert.equal(savedSearch.status, 200, savedSearch.text);
  const library = path.join(newRoot, 'knowledge', 'library');
  const files = path.join(library, 'files');
  const attachment = await fsp.readFile(fx.file('topics/topology/readings/thouless.pdf'));
  const upload = await post('upload', attachment, { query: new URLSearchParams({ dir: files, name: 'reading.pdf' }).toString(), headers: { 'content-type': 'application/octet-stream' } });
  assert.equal(upload.status, 200, upload.text);
  const attachmentPath = path.join(files, 'reading.pdf');
  assert.deepEqual(await fsp.readFile(attachmentPath), attachment);
  ok('the fresh workspace creates its library on demand and can import a local file');

  await stopWeb();
  const restarted = await startWeb(newOverlay);
  assert.deepEqual((await restarted.call('overview')).json.directions[0].topics, ['edge-modes']);
  assert.equal((await restarted.call('note', { query: `path=${encodeURIComponent(reading)}` })).json.raw, readingText);
  assert.equal((await restarted.call('discover')).json.searches[0].query, 'edge modes');
  assert.equal((await restarted.call('raw', { query: `path=${encodeURIComponent(attachmentPath)}`, headers: { range: 'bytes=0-3' } })).text, '%PDF');
  ok('restarting DSH restores the new topic, note, saved search and PDF');
  console.log(`ATLAS DSH E2E OK (${checks} checks)`);
} finally {
  await stopWeb();
  model.close();
  await new Promise((resolve) => setTimeout(resolve, 500));
  await fx.cleanup().catch(() => {});
}
