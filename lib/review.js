/**
 * Review of what an AI discussion changed in the notes.
 *
 * When Atlas starts a discussion or a team, it keeps a copy (a baseline) of the
 * notes in its scope: the topic note, its parent and branches, and the note or
 * LaTeX file in focus. The changes are the differences from that copy, edit by
 * edit, each named by the section and paragraph it sits in. Keep moves the
 * baseline forward; Revert puts the earlier text back, and only where the note
 * still shows the edit. Baselines live in Atlas's own state folder, never in
 * the research tree, and are dropped when the discussion is resolved.
 */

import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { promises as fsp } from 'node:fs';
import { fileKey, statSafe } from './fsutil.js';

const MAX_FILE = 4 * 1024 * 1024;
const MAX_FILES = 16;

export function reviewError(status, message) {
  return Object.assign(new Error(message), { statusCode: status });
}

/**
 * Line edits turning `a` into `b`: [{aStart, aEnd, bStart, bEnd}], lines
 * a[aStart..aEnd) replaced by b[bStart..bEnd). Common ends are trimmed; the
 * middle is aligned by longest common subsequence.
 */
export function diffLines(a, b) {
  let s = 0;
  while (s < a.length && s < b.length && a[s] === b[s]) s += 1;
  let ea = a.length;
  let eb = b.length;
  while (ea > s && eb > s && a[ea - 1] === b[eb - 1]) {
    ea -= 1;
    eb -= 1;
  }
  const n = ea - s;
  const m = eb - s;
  if (n === 0 && m === 0) return [];
  if (n === 0 || m === 0 || n * m > 4000000) return [{ aStart: s, aEnd: ea, bStart: s, bEnd: eb }];
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) dp[i][j] = a[s + i] === b[s + j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  }
  const hunks = [];
  let cur = null;
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && a[s + i] === b[s + j]) {
      if (cur) hunks.push(cur);
      cur = null;
      i += 1;
      j += 1;
    } else if (j < m && (i === n || dp[i][j + 1] >= dp[i + 1][j])) {
      if (!cur) cur = { aStart: s + i, aEnd: s + i, bStart: s + j, bEnd: s + j };
      j += 1;
      cur.bEnd = s + j;
    } else {
      if (!cur) cur = { aStart: s + i, aEnd: s + i, bStart: s + j, bEnd: s + j };
      i += 1;
      cur.aEnd = s + i;
    }
  }
  if (cur) hunks.push(cur);
  return hunks;
}

/** Where line `index` sits: its section ("Opening" before the first ## heading) and its paragraph's bold lead. */
export function placeOf(lines, index) {
  const at = Math.max(0, Math.min(index, lines.length - 1));
  // The paragraph's first line: a list item starts its own, even without a blank line before it.
  let start = at;
  while (start > 0 && lines[start - 1].trim() && !/^#{1,6}\s/.test(lines[start]) && !/^\s*(?:[-*]|\d+\.)\s/.test(lines[start])) start -= 1;
  const leadMatch = /^\s*(?:[-*]\s+|\d+\.\s+)?\*\*(.{2,90}?)\*\*/.exec(lines[start] || '');
  const lead = leadMatch ? leadMatch[1].replace(/\s*→.*$/, '').replace(/[.:]\s*$/, '').trim() : '';
  let section = '';
  for (let i = at; i >= 0; i -= 1) {
    const h = /^(#{1,6})\s+(.+?)\s*#*$/.exec(lines[i]);
    if (h) {
      section = h[1].length === 1 ? 'Opening' : h[2].replace(/^\[[^\]]*\]\s*/, '');
      break;
    }
    const tex = /^\s*\\(?:sub)*section\*?\{([^}]*)\}/.exec(lines[i]);
    if (tex) {
      section = tex[1];
      break;
    }
  }
  return [section, lead].filter(Boolean).join(' · ');
}

/** The edits from `before` to `after`, each with an id stable while the texts are. */
export function editsOf(before, after) {
  const a = String(before).split('\n');
  const b = String(after).split('\n');
  const seen = new Map();
  return diffLines(a, b).map((h) => {
    const removed = a.slice(h.aStart, h.aEnd);
    const added = b.slice(h.bStart, h.bEnd);
    const hash = crypto.createHash('sha1').update(`${removed.join('\n')}\u0000${added.join('\n')}`).digest('hex').slice(0, 12);
    const n = (seen.get(hash) || 0) + 1;
    seen.set(hash, n);
    return { id: `${hash}-${n}`, ...h, removed, added, where: placeOf(b, h.bStart) || placeOf(a, h.aStart), line: h.bStart + 1 };
  });
}

export function createReview({ stateDir = '' } = {}) {
  const dir = stateDir || path.join(os.homedir(), '.aitp-atlas', 'review');
  const fileOf = (session) => path.join(dir, `${String(session).replace(/[^\w.-]/g, '_').slice(0, 120)}.json`);
  const load = async (session) => {
    try {
      return JSON.parse(await fsp.readFile(fileOf(session), 'utf8'));
    } catch {
      return { session: String(session), files: {} };
    }
  };
  const save = async (state) => {
    await fsp.mkdir(dir, { recursive: true });
    const target = fileOf(state.session);
    const tmp = `${target}.${process.pid}.tmp`;
    await fsp.writeFile(tmp, JSON.stringify({ ...state, updated: Date.now() }), 'utf8');
    await fsp.rename(tmp, target);
  };
  const read = async (file) => {
    const stat = await statSafe(file);
    if (!stat || !stat.isFile() || stat.size > MAX_FILE) return null;
    return fsp.readFile(file, 'utf8');
  };
  const entryOf = (state, file) => state.files[fileKey(file)] || null;

  async function changes(session) {
    const state = await load(session);
    const files = [];
    for (const entry of Object.values(state.files)) {
      const current = await read(entry.path);
      if (current === null) {
        files.push({ path: entry.path, missing: true, edits: [] });
        continue;
      }
      const edits = editsOf(entry.text, current);
      if (edits.length) files.push({ path: entry.path, edits });
    }
    return { session: state.session, watching: Object.values(state.files).map((e) => e.path), files };
  }

  return {
    dir,
    changes,

    /** Keep copies of `files` for `session`; a file already kept is left as it was first seen. */
    async baseline(session, files) {
      if (!session) throw reviewError(400, 'Which discussion?');
      const state = await load(session);
      for (const file of files) {
        if (Object.keys(state.files).length >= MAX_FILES) break;
        if (entryOf(state, file)) continue;
        const text = await read(file);
        if (text === null) continue;
        state.files[fileKey(file)] = { path: file, text, takenAt: Date.now() };
      }
      await save(state);
      return Object.values(state.files).map((e) => e.path);
    },

    /** Put the earlier text of one edit back into the note. */
    async revert(session, file, id) {
      const state = await load(session);
      const entry = entryOf(state, file);
      if (!entry) throw reviewError(404, 'Atlas kept no earlier copy of this note for this discussion.');
      const current = await read(file);
      if (current === null) throw reviewError(404, 'The note is gone.');
      const edit = editsOf(entry.text, current).find((e) => e.id === id);
      if (!edit) throw reviewError(409, 'The note changed again since this list was shown; look at the edits anew.');
      const lines = current.split('\n');
      await fsp.writeFile(file, [...lines.slice(0, edit.bStart), ...edit.removed, ...lines.slice(edit.bEnd)].join('\n'), 'utf8');
      return changes(session);
    },

    /** Accept one edit (or all of a note's, with id "all"): the copy moves forward. */
    async keep(session, file, id) {
      const state = await load(session);
      const entry = entryOf(state, file);
      if (!entry) throw reviewError(404, 'Atlas kept no earlier copy of this note for this discussion.');
      const current = await read(file);
      if (current === null) throw reviewError(404, 'The note is gone.');
      if (id === 'all') entry.text = current;
      else {
        const edit = editsOf(entry.text, current).find((e) => e.id === id);
        if (!edit) throw reviewError(409, 'The note changed again since this list was shown; look at the edits anew.');
        const lines = entry.text.split('\n');
        entry.text = [...lines.slice(0, edit.aStart), ...edit.added, ...lines.slice(edit.aEnd)].join('\n');
      }
      await save(state);
      return changes(session);
    },

    async forget(session) {
      await fsp.rm(fileOf(session), { force: true });
    },

    /** The discussions with unreviewed edits in `file`, newest first. */
    async pending(file) {
      let names = [];
      try {
        names = (await fsp.readdir(dir)).filter((n) => n.endsWith('.json'));
      } catch {
        return [];
      }
      const stats = await Promise.all(names.map(async (n) => ({ n, stat: await statSafe(path.join(dir, n)) })));
      const recent = stats.filter((x) => x.stat && Date.now() - x.stat.mtimeMs < 45 * 86400000).sort((x, y) => y.stat.mtimeMs - x.stat.mtimeMs).slice(0, 80);
      const out = [];
      const current = await read(file);
      if (current === null) return out;
      for (const { n } of recent) {
        let state;
        try {
          state = JSON.parse(await fsp.readFile(path.join(dir, n), 'utf8'));
        } catch {
          continue;
        }
        const entry = entryOf(state, file);
        if (!entry) continue;
        const count = editsOf(entry.text, current).length;
        if (count) out.push({ session: state.session, edits: count });
      }
      return out;
    },
  };
}
