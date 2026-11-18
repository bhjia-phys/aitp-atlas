/**
 * npm run preview [-- --debug]
 * Open the printed private DSH sign-in URL, then choose Atlas in the sidebar.
 * Send any prompt for a deterministic streamed reply with a note and paper link.
 * Stop with q + Enter or Ctrl+C. The profile, notes, state and sessions are discarded.
 * A fresh launch stages the current built client.js; this command never runs a build.
 */
import { spawn } from 'node:child_process';
import { randomInt } from 'node:crypto';
import { existsSync, promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { createInterface } from 'node:readline';
import { makeFixture } from '../test/fixture.mjs';
import { startModel } from './preview-model.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..');
const usage = `Usage: npm run preview [-- [--team] [--debug]]
  npm run preview                 Ordinary fixture replies (no tool calls)
  npm run preview -- --team       Enable the two-seat Worm team demo in the temporary fixture
  npm run preview -- --team --debug
Open the printed private local URL and select Atlas. Stop with q + Enter or Ctrl+C.`;

// Only the manual CLI opts in here; never arm a model in the shared preview lifecycle.
export function previewCliOptions(args) {
  if (args.some(a => a !== '--team' && a !== '--debug') || new Set(args).size !== args.length) throw new Error(usage);
  return {
    debug: args.includes('--debug'),
    prepare({ fx, model }) {
      if (!args.includes('--team')) return '';
      model.enableFixtureTeam(fx.root, 'numerics');
      return `Two-seat fixture demo (one team per launch; nothing starts until you submit):
  1. Atlas → Teams → New team.
  2. What should the team find out?  Check the fixture limiting coefficient and convention.
     Done when:  Both named fixture seats have read their independent role cards.
  3. Topic: Worm algorithm: equilibration and reproducibility (mc/worm).
  4. Choose “Theory and numerics”; remove “theorist”. Keep exactly numerics and referee, with their original names, roles, and core mode.
     Lead model: DSH default. Both seat models: Same as the lead. Do not override model or effort.
  5. Click “Start the team”. Open the numerics and referee stars in the room to verify their role-card receipts.`;
    },
  };
}

export function findRuntime() {
  // Resolve the installation BEFORE isolating the child environment. Never consult a profile.
  const desktop = process.platform === 'win32' && process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Programs', 'DeepSeek Harness');
  const exe = process.env.DSH_EXE || (desktop && path.join(desktop, 'DeepSeek Harness.exe'));
  if (!exe || !path.isAbsolute(exe) || !existsSync(exe)) return null;
  const cli = process.env.DSH_CLI || (desktop && exe === path.join(desktop, 'DeepSeek Harness.exe')
    ? path.join(desktop, 'resources', 'app.asar', 'dsh', 'node_modules', '@deepseek-ai', 'dsh-desktop-host', 'lib', 'cli.js') : '');
  return { exe, args: cli ? ['--expose-internals', cli] : [] };
}

function privateEnv(fx, model) {
  // An allowlist, not {...process.env}: no DSH_PROFILE_DIR, model credentials, NODE_OPTIONS,
  // inherited proxy, home patch, real skill roots, application data or workspace settings.
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => /^(path|systemroot|windir|comspec|pathext|systemdrive|lang|lc_all|tz)$/i.test(k)));
  return { ...env, DSH_HOME: fx.file('dsh-home'), HOME: fx.file('user'), USERPROFILE: fx.file('user'),
    APPDATA: fx.file('user/roaming'), LOCALAPPDATA: fx.file('user/local'),
    TMP: fx.file('tmp'), TEMP: fx.file('tmp'), TMPDIR: fx.file('tmp'),
    ELECTRON_RUN_AS_NODE: '1', DEEPSEEK_BASE_URL: model.url, DEEPSEEK_API_KEY: model.key,
    NO_PROXY: 'localhost,127.0.0.1', no_proxy: 'localhost,127.0.0.1' };
}

async function stageProfile(fx, env) {
  const profile = path.join(env.DSH_HOME, 'profiles', 'web');
  const bundle = path.join(profile, 'node_modules', 'aitp-atlas');
  for (const dir of [bundle, env.HOME, env.APPDATA, env.LOCALAPPDATA, env.TMP, fx.file('atlas-state')]) await fs.mkdir(dir, { recursive: true });
  // No joint installer, pnpm, network or symlink back to the checkout. Use only the shipped
  // runtime files, including optional vendored assets; do not copy the worktree or its siblings.
  for (const name of ['package.json', 'index.js', 'client.js', 'cordis.patch.yml', 'lib', 'vendor', 'templates/team']) {
    await fs.cp(path.join(repo, name), path.join(bundle, name), { recursive: true });
  }
  await fs.writeFile(path.join(profile, 'package.json'), JSON.stringify({ name: 'atlas-preview-profile', private: true,
    dsh: { profile: { bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app', 'aitp-atlas'] } } }));
  const config = { root: fx.root, knowledge: fx.knowledge, library: path.join(fx.knowledge, 'library'), stateDir: fx.file('atlas-state'), web: false };
  // DSH's first-use browser workspace normally goes in the OS's Documents directory,
  // which on Windows is a Known Folder and need not follow the child USERPROFILE.
  await fs.writeFile(path.join(profile, 'cordis.patch.yml'), JSON.stringify([
    { id: 'workspace-controller', config: { documentsDirectory: fx.file('user/Documents') } },
    { id: 'aitp-atlas', config },
  ]));
}

async function stopHost(host, closed) {
  if (!host.pid || host.exitCode !== null || host.signalCode !== null) return;
  if (process.platform === 'win32') {
    // Windows' ChildProcess.kill() would terminate just the host. Include only its own tree.
    const kill = spawn(path.join(process.env.SystemRoot, 'System32', 'taskkill.exe'), ['/PID', String(host.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
    await new Promise((resolve) => { kill.once('close', resolve); kill.once('error', resolve); });
  } else { host.kill('SIGTERM'); }
  const force = setTimeout(() => host.kill('SIGKILL'), 4000);
  try { await closed; } finally { clearTimeout(force); }
}

// The callback owns neither resource: all exits, including failed startup, dispose them here.
export async function withPreview(use, { signal, debug = false } = {}) {
  if (process.env.ATLAS_PREVIEW_ROOT !== undefined) throw new Error('Unset ATLAS_PREVIEW_ROOT: preview only accepts a freshly generated fixture.');
  const runtime = findRuntime();
  if (!runtime) throw new Error('No installed DSH runtime found. Set DSH_EXE to its absolute executable (and DSH_CLI for a Node/Electron CLI entry point).');
  signal?.throwIfAborted();
  const fx = await makeFixture();
  let model, host, closed, log = '';
  const safeLog = (text) => text.replace(/(token=)[\w-]+/g, '$1[redacted]').replaceAll(model.key, '[redacted]');
  try {
    model = await startModel();
    const env = privateEnv(fx, model);
    await stageProfile(fx, env);
    signal?.throwIfAborted();
    // Cookies are host-scoped, not port-scoped. Stay on loopback but off the user's DSH host.
    const bind = `127.77.${randomInt(1, 255)}.${randomInt(1, 255)}`;
    host = spawn(runtime.exe, [...runtime.args, '--profile', 'web', '--no-open', '--host', bind, '--port', '0'],
      { env, cwd: fx.root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let exited;
    closed = new Promise((resolve) => {
      host.once('error', (error) => { exited = error.message; });
      host.once('close', (code, sig) => { exited ??= `exit ${sig || code}`; resolve(); });
    });
    const capture = (chunk) => { log = (log + chunk).slice(-65536); };
    host.stdout.on('data', capture);
    host.stderr.on('data', capture);
    const deadline = Date.now() + 90000;
    let url;
    do {
      if (exited) throw new Error(`DSH failed to launch (${exited}).\n${safeLog(log).slice(-3000)}`);
      await delay(100, undefined, { signal });
      url = /dsh web: (http:\/\/127\.77\.\d+\.\d+:\d+\/\?token=[\w-]+)/.exec(log)?.[1];
      if (url && new URL(url).hostname !== bind) throw new Error('Unexpected DSH launch authority.');
      if (Date.now() > deadline) throw new Error(`Timed out starting DSH.\n${safeLog(log).slice(-3000)}`);
    } while (!url);
    // DSH announces itself after startup, even if an optional plugin failed. Check Atlas too.
    const probe = await fetch(new URL('/aitp-atlas/api/overview', url), { redirect: 'manual', signal: AbortSignal.timeout(5000) });
    await probe.body?.cancel();
    if (probe.status !== 401) throw new Error(`Expected a protected Atlas route; got HTTP ${probe.status}.`);
    if (debug) console.error(`Fixture: ${fx.base}\nDSH PID: ${host.pid}\n${safeLog(log)}`);
    return await use({ url, fx, model, env, runtime, closed, hostPid: host.pid });
  } finally {
    try { if (host) await stopHost(host, closed); }
    finally { try { if (model) await model.close(); } finally { await fx.cleanup(); } }
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--help') { console.log(usage); return; }
  const options = previewCliOptions(args);
  const control = new AbortController();
  const stop = () => control.abort();
  const input = createInterface({ input: process.stdin, terminal: false });
  input.on('line', (text) => { if (text.trim().toLowerCase() === 'q') stop(); });
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  try {
    await withPreview(async ({ url, closed, fx, model }) => {
      const instructions = options.prepare({ fx, model });
      console.log(`Open this private launch URL, then select Atlas in the DSH sidebar:\n${url}\nFixture only; type q + Enter or Ctrl+C to stop and discard it.`);
      if (instructions) console.log(instructions);
      if (!control.signal.aborted) await Promise.race([closed.then(() => { throw new Error('DSH exited.'); }),
        new Promise((resolve) => control.signal.addEventListener('abort', resolve, { once: true }))]);
    }, { signal: control.signal, debug: options.debug });
  } catch (error) { if (!control.signal.aborted || error.name !== 'AbortError') throw error; }
  finally { input.close(); process.off('SIGINT', stop); process.off('SIGTERM', stop); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
