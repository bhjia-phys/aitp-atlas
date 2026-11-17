// ---------------------------------------------------------------- runtime ---
// React, DSH primitives, the API client, colors, PDF.js and the AI hand-offs.

const React = require('react');
const h = React.createElement;
const { useState, useEffect, useMemo, useRef, useCallback, useLayoutEffect } = React;

let primitives = {};
try {
  primitives = require('@deepseek-ai/dsh-client-ui-primitives') || {};
} catch {
  primitives = {};
}

const API = '/aitp-atlas/api';
const PANEL_KEY = 'aitp-atlas';
let pluginCtx = null;

async function api(name, { method = 'GET', body, query } = {}, attempt = 0) {
  const qs = query ? '?' + new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== '' && v !== null)).toString() : '';
  const res = await fetch(`${API}/${name}${qs}`, {
    method,
    credentials: 'same-origin',
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  // While DSH mounts its sign-in service Atlas answers 503 before doing anything: wait and ask again.
  if (res.status === 503 && attempt < 20) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return api(name, { method, body, query }, attempt + 1);
  }
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  if (!res.ok) {
    const error = new Error((json && json.error && json.error.message) || `${res.status} ${res.statusText}`);
    error.status = res.status;
    error.body = json;
    throw error;
  }
  return json;
}

/** The URL that streams a file inside Atlas (images, PDFs, video). */
function rawUrl(file) {
  return `${API}/raw?path=${encodeURIComponent(file)}`;
}

/** Fetch `name` when `identity` changes (showing a loading state) or `version` changes (keeping data on screen). */
function useApi(name, query, identity, version) {
  const [state, setState] = useState({ data: null, error: null, loading: true, identity: null });
  const serial = JSON.stringify([name, query, identity, version]);
  const id = JSON.stringify([name, identity]);
  useEffect(() => {
    let live = true;
    setState((s) => ({ data: s.identity === id ? s.data : null, error: null, loading: true, identity: id }));
    api(name, { query })
      .then((data) => live && setState({ data, error: null, loading: false, identity: id }))
      .catch((error) => live && setState({ data: null, error, loading: false, identity: id }));
    return () => {
      live = false;
    };
  }, [serial]);
  return state;
}

function storageGet(key, fallback) {
  try {
    const raw = window.localStorage.getItem('aitp-atlas:' + key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function storageSet(key, value) {
  try {
    window.localStorage.setItem('aitp-atlas:' + key, JSON.stringify(value));
  } catch {
    // Storage may be unavailable; the view still works.
  }
}

function cx(...names) {
  return names.filter(Boolean).join(' ');
}

function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many || one + 's'}`;
}

function dateOf(ms) {
  if (!ms) return '';
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function daysSince(iso) {
  if (!iso) return Infinity;
  const t = Date.parse(String(iso).slice(0, 10) + 'T12:00:00');
  return Number.isFinite(t) ? Math.max(0, (Date.now() - t) / 86400000) : Infinity;
}

function ago(ms) {
  if (!ms) return '';
  const minutes = Math.max(0, Math.round((Date.now() - ms) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours} h ago` : dateOf(ms);
}

function sizeOf(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function joinPath(dir, rel) {
  const sep = dir.includes('\\') && !dir.includes('/') ? '\\' : '/';
  const parts = (dir.replace(/[\\/]+$/, '') + sep + rel.replace(/^\.\//, '')).split(/[\\/]/);
  const out = [];
  for (const part of parts) {
    if (part === '..') out.pop();
    else if (part !== '.') out.push(part);
  }
  const lead = dir.startsWith('\\\\') ? '\\\\' : dir.startsWith('//') ? '//' : '';
  return lead + out.filter((p, i) => p !== '' || i === 0).join(sep).replace(/^[\\/]+/, '');
}

/** A path as Atlas compares paths: forward slashes, no trailing slash, case folded (Windows and WSL shares). */
function pathKey(file) {
  return String(file || '').replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
}

function dirOf(file) {
  return String(file || '').replace(/[\\/][^\\/]*$/, '');
}

function baseName(file) {
  return String(file || '').split(/[\\/]/).pop();
}

function extOf(file) {
  const m = /\.([a-z0-9]+)$/i.exec(baseName(file));
  return m ? m[1].toLowerCase() : '';
}

/** What Atlas does with a file: read it here (and how), or hand it to the system. */
const TYPE_OF_EXT = {
  md: 'markdown', markdown: 'markdown', pdf: 'pdf', tex: 'tex', sty: 'tex', cls: 'tex', bib: 'bib', ipynb: 'notebook',
  png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', svg: 'image', webp: 'image', bmp: 'image',
  mp4: 'video', webm: 'video', mov: 'video', m4v: 'video', mp3: 'audio', wav: 'audio', ogg: 'audio', m4a: 'audio',
  csv: 'table', tsv: 'table',
  txt: 'text', log: 'text', out: 'text', in: 'text', dat: 'text', json: 'text', yaml: 'text', yml: 'text', toml: 'text', ini: 'text', cfg: 'text', srt: 'text', patch: 'text', diff: 'text', xml: 'text',
  py: 'code', jl: 'code', sh: 'code', bash: 'code', c: 'code', cc: 'code', cpp: 'code', cxx: 'code', h: 'code', hpp: 'code', f: 'code', f90: 'code', f95: 'code', m: 'code', r: 'code', rs: 'code', go: 'code', js: 'code', mjs: 'code', ts: 'code', lua: 'code', pl: 'code', wl: 'code',
};
function typeOf(file) {
  const ext = extOf(file);
  if (!ext) return 'folder';
  return TYPE_OF_EXT[ext] || 'other';
}
const READ_HERE = new Set(['markdown', 'pdf', 'tex', 'bib', 'notebook', 'image', 'video', 'audio', 'table', 'text', 'code', 'folder']);
const EDIT_HERE = new Set(['md', 'markdown', 'tex', 'bib', 'txt']);

function directionColor(ov, slug) {
  const index = ov && ov.directions ? ov.directions.findIndex((d) => d.slug === slug) : -1;
  const slots = DIRECTION_SLOTS[activeBase] || DIRECTION_SLOTS.night;
  return index >= 0 && index < slots.length ? slots[index] : otherColor();
}
/** The color of what lies beyond the directions, in the theme being drawn. */
function otherColor() {
  return OTHER_SLOT[activeBase] || OTHER_SLOT.night;
}

/** A topic's direction: its own, or the nearest ancestor's. */
function topicDirection(ov, id) {
  for (let t = ov.topics[id]; t; t = t.parent !== null && t.parent !== undefined ? ov.topics[t.parent] : null) {
    if (t.direction) return t.direction;
    if (t.parent === '' || t.parent === null) break;
  }
  return '';
}

/** Words of a filter, lower-cased; a row matches when its text contains all of them. */
function useWords(filter) {
  return useMemo(() => String(filter || '').toLowerCase().split(/\s+/).filter(Boolean), [filter]);
}

function matches(words, ...texts) {
  if (words.length === 0) return true;
  const hay = texts.filter(Boolean).join(' ').toLowerCase();
  return words.every((w) => hay.includes(w));
}

/** A short name for tight places: the part before a colon, or the first words. */
function shortTitle(title, limit = 26) {
  let s = String(title || '').split(/:\s|\s[—–]\s/)[0];
  if (s.length > limit) s = s.slice(0, limit - 1).replace(/\s+\S*$/, '') + '…';
  return s;
}

// --------------------------------------------------------------- PDF.js ---

let pdfjsPromise = null;
function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import(`${API}/vendor/pdf.min.mjs`).then((lib) => {
      lib.GlobalWorkerOptions.workerSrc = `${API}/vendor/pdf.worker.min.mjs`;
      return lib;
    });
    pdfjsPromise.catch(() => {
      pdfjsPromise = null;
    });
  }
  return pdfjsPromise;
}

// ------------------------------------------------------- AI hand-offs ---

/** Open a new DSH session in `folder` with an editable draft prompt. Never sends it. */
async function draftSession(folder, prompt) {
  const ctx = pluginCtx;
  const workspaces = ctx && ctx.get && ctx.get('workspaces');
  const uiWorkspace = ctx && ctx.get && ctx.get('uiWorkspace');
  if (!workspaces || !uiWorkspace || typeof uiWorkspace.startSession !== 'function') {
    throw new Error('This DSH version cannot prepare a session draft.');
  }
  const workspace = await workspaces.create({ path: folder });
  const id = workspace && (workspace.id || workspace.workspaceId);
  if (!id) throw new Error('DSH did not return a workspace for ' + folder);
  uiWorkspace.startSession(id, { prompt, whenDraftExists: 'append' });
}

/** The research moves on a topic. A discussion's context block names the note, so AITP's Skills take over. */
function topicAsks() {
  return [
    { key: 'continue', label: 'Continue the research', hint: 'Resume where Current work stands', prompt: 'Continue the research on this topic.' },
    { key: 'explain', label: 'Explain it to me', hint: 'Learning: the question, answer and decisive step', prompt: 'Explain this topic to me from its main note: the question, the current answer at its true strength and the decisive step, at my level, with a figure where it helps.' },
    { key: 'brainstorm', label: 'Brainstorm the next step', hint: 'Choices that would change the answer', prompt: "Let's brainstorm the next step for this topic: what would most change the answer, which routes are open, and what you recommend." },
    { key: 'derive', label: 'Work through a derivation', hint: 'Step by step, with checks', prompt: "Let's work through this topic's central derivation step by step; state each assumption where it is used and check limiting cases." },
    { key: 'implement', label: 'Implement and compute', hint: 'Delegate code or a calculation', prompt: 'Implement and run the next calculation this topic’s Current work describes; tell me what to inspect, and record the result in the note.' },
    { key: 'verify', label: 'Verify the latest result', hint: 'An independent check before relying on it', prompt: 'Check the newest result recorded in this topic before we rely on it: rederive or recompute the decisive step and report what holds.' },
    { key: 'write', label: 'Write it up', hint: 'A manuscript section in LaTeX', prompt: 'Draft the manuscript section this topic supports, in LaTeX, keeping every claim at the strength its evidence gives.' },
  ];
}

/** Open a file with the system's viewer for its type. */
function openFile(file) {
  return api('open', { method: 'POST', body: { path: file } });
}
