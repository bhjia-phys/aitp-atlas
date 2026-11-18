import assert from 'node:assert/strict';
import test from 'node:test';
import { execFile } from 'node:child_process';
import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { promisify } from 'node:util';
import { promises as fs } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { findRuntime, withPreview } from '../scripts/preview.mjs';
import { startModel } from '../scripts/preview-model.mjs';

const exec = promisify(execFile);
const script = fileURLToPath(new URL('../scripts/preview.mjs', import.meta.url));
const request = (url, options = {}) => fetch(url, { signal: AbortSignal.timeout(10000), redirect: 'manual', ...options });

test('preview refuses root overrides and extra CLI arguments before touching them', async () => {
  for (const [args, env, expected] of [
    [[], { ATLAS_PREVIEW_ROOT: 'never-open-this-folder' }, /Unset ATLAS_PREVIEW_ROOT/],
    [['--root', 'never-open-this-folder'], {}, /Usage:/],
    [['--host', '0.0.0.0'], {}, /Usage:/],
  ]) {
    await assert.rejects(exec(process.execPath, [script, ...args], { env: { ...process.env, ...env }, timeout: 5000 }),
      (error) => error.code === 1 && expected.test(error.stderr));
  }
});

test('loopback mock emits multiple Messages deltas, a fixture file and one paper link, never tools', async () => {
  const model = await startModel();
  try {
    assert.equal(new URL(model.url).hostname, '127.0.0.1');
    const endpoint = `${model.url}/v1/messages`;
    assert.equal((await request(endpoint, { method: 'POST' })).status, 401);
    const res = await request(endpoint, { method: 'POST', headers: { 'x-api-key': model.key }, body: 'ignored' });
    assert.match(res.headers.get('content-type'), /text\/event-stream/);
    const events = (await res.text()).split('\n').filter((line) => line.startsWith('data: ')).map((line) => JSON.parse(line.slice(6)));
    const deltas = events.filter((event) => event.type === 'content_block_delta');
    assert.ok(deltas.length > 1);
    assert.equal(events[0].type, 'message_start');
    assert.equal(events.at(-1).type, 'message_stop');
    assert.ok(deltas.every((event) => event.delta.type === 'text_delta'));
    assert.match(deltas.map((event) => event.delta.text).join(''), /\]\(mc\/worm\/research\.md\).*\]\(https:\/\/arxiv.org\/abs\/1510.07698\)/);
  } finally { await model.close(); }
  await assert.rejects(request(model.url));
});

test('private fixture can hold two independent replies and finish them out of order', { timeout: 8000 }, async () => {
  const model = await startModel();
  const ask = async () => (await request(model.url + '/v1/messages', { method: 'POST', headers: { 'x-api-key': model.key } })).text();
  const a = model.holdNext('A'), b = model.holdNext('B');
  try {
    let firstDone = false;
    const first = ask().then(text => { firstDone = true; return text; }); await a.started;
    const second = ask(); await b.started;
    b.release(); const textB = await second;
    assert.match(textB, /Fixture stream B begins\./); assert.match(textB, /Stream B complete\./); assert.doesNotMatch(textB, /Stream A complete/);
    assert.equal(firstDone, false, 'A must still be held after B ends');
    a.release(); const textA = await first;
    assert.match(textA, /Fixture stream A begins\./); assert.match(textA, /Stream A complete\./); assert.doesNotMatch(textA, /Stream B complete/);
  } finally { a.release(); b.release(); await model.close(); }
});

test('real DSH serves only the staged Atlas fixture and consumes the streamed mock reply', {
  skip: findRuntime() ? false : 'Installed DSH required; set DSH_EXE and, for Electron, DSH_CLI.', timeout: 180000,
}, async () => {
  let fixture, address, modelAddress;
  await withPreview(async ({ url, fx, runtime, env, model }) => {
    fixture = fx.base;
    modelAddress = model.url;
    address = new URL(url).origin;
    assert.match(new URL(address).hostname, /^127\.77\.\d+\.\d+$/);
    assert.equal(env.DSH_HOME, fx.file('dsh-home'));
    assert.equal(env.USERPROFILE, fx.file('user'));
    assert.ok(!env.DSH_PROFILE_DIR && !env.DSH_SESSION_ID && !env.NODE_OPTIONS);
    const login = await request(url);
    assert.ok([302, 303].includes(login.status));
    const cookie = login.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
    assert.ok(cookie);
    // The browser's live conversation transport must also accept this loopback alias.
    await new Promise((resolve, reject) => {
      const req = http.get(`${address}/api/remote.mux`, { headers: { cookie, origin: address,
        Connection: 'Upgrade', Upgrade: 'websocket', 'Sec-WebSocket-Version': '13', 'Sec-WebSocket-Key': randomBytes(16).toString('base64') } });
      req.setTimeout(5000, () => req.destroy(new Error('WebSocket upgrade timed out')));
      req.on('upgrade', (_res, socket) => { socket.destroy(); resolve(); });
      req.on('response', (res) => { res.resume(); reject(new Error(`DSH WebSocket returned HTTP ${res.statusCode}`)); });
      req.on('error', reject);
    });
    const get = (route) => request(new URL(route, url), { headers: { cookie } });
    assert.equal((await request(`${address}/aitp-atlas/api/overview`)).status, 401);
    const index = await (await get('/')).text();
    assert.match(index, /aitp-atlas/); // Real DSH shipped this client in the browser roster.
    const overview = await (await get('/aitp-atlas/api/overview')).json();
    assert.equal(overview.root, fx.root);
    assert.equal(overview.knowledge, fx.knowledge);
    assert.equal(overview.library, path.join(fx.knowledge, 'library'));
    assert.equal(overview.online, false);
    assert.match(overview.topics['mc/worm'].title, /Worm algorithm/);
    // Exercise the real DSH exact/prefix registration, not just fakeContext's route map.
    const registryApi = `${address}/aitp-atlas/api/discussions`;
    const writeRecord = (method, suffix, body, auth = true) => request(registryApi + suffix, { method,
      headers: { ...(auth ? {cookie} : {}), origin: address, 'content-type':'application/json' }, body:JSON.stringify(body) });
    assert.equal((await request(registryApi)).status, 401);
    assert.equal((await writeRecord('PATCH','/fixture-route',{pinned:true},false)).status, 401);
    const created = await writeRecord('POST','',{id:'fixture-route',title:'Fixture session',topic:'mc/worm',origin:'desk'});
    assert.equal(created.status,200);assert.equal((await created.json()).discussion.topic.id,'mc/worm');
    const patched = await writeRecord('PATCH','/fixture-route',{pinned:true});
    assert.equal(patched.status,200);assert.equal((await patched.json()).discussion.pinned,true);
    const imported = await writeRecord('POST','/import',{records:[{id:'fixture-import',title:'Legacy fixture record'}]});
    assert.equal(imported.status,200);assert.equal((await imported.json()).imported,1);
    const rows = (await (await get('/aitp-atlas/api/discussions')).json()).discussions;
    assert.equal(rows.find(r=>r.id==='fixture-import').origin,'import');
    assert.equal(rows.find(r=>r.id==='fixture-route').pinned,true);
    const note = overview.topics['mc/worm'].file;
    const apiNote = '/aitp-atlas/api/note?path=';
    assert.equal((await get(apiNote + encodeURIComponent(note))).status, 200);
    assert.equal((await get(apiNote + encodeURIComponent(fx.file('atlas-state/outside.md')))).status, 403);
    // A real Atlas mutation goes to the private stateDir, not ~/.aitp-atlas.
    const baseline = await request(`${address}/aitp-atlas/api/review/baseline`, { method: 'POST',
      headers: { cookie, origin: address, 'content-type': 'application/json' }, body: JSON.stringify({ session: 'preview-turn', files: [note] }) });
    assert.equal(baseline.status, 200);
    assert.ok((await fs.readdir(fx.file('atlas-state'))).length > 0);
    // A real model turn through the installed Messages transport, not a canned browser view.
    // Headless uses the same isolated home, environment and fixture cwd as the Web host.
    const { stdout } = await exec(runtime.exe, [...runtime.args, '--profile', 'headless', 'Show fixture links'],
      { cwd: fx.root, env, windowsHide: true, timeout: 45000, maxBuffer: 1024 * 1024 });
    assert.match(stdout, /\[worm note\]\(mc\/worm\/research\.md\)/);
    assert.match(stdout, /\[arXiv:1510\.07698\]\(https:\/\/arxiv\.org\/abs\/1510\.07698\)/);
  });
  await assert.rejects(fs.stat(fixture), { code: 'ENOENT' });
  for (const endpoint of [address, modelAddress]) await assert.rejects(request(endpoint));
});
