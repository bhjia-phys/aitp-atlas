// Interface state, never research material. One registry per configured research root.
import path from 'node:path';
import os from 'node:os';
import { createHash, randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { fileKey, isWithin } from './fsutil.js';

const origins = ['desk', 'ask', 'selection', 'topic', 'decide', 'team', 'import'];
const queues = new Map(); // One writer per file across requests and mounted owners in this Host.
const bad = (message, statusCode = 400, code = 'INVALID_DISCUSSION') => Object.assign(new Error(message), { statusCode, code });
function object(value) { if (!value || typeof value !== 'object' || Array.isArray(value)) throw bad('Expected an object.'); return value; }
function text(v, max = 300, fallback = '') {
  if (v == null) return fallback;
  if (typeof v !== 'string' || v.length > max || v.includes('\0')) throw bad('Invalid or oversized text field.');
  return v;
}
function stamp(v, fallback = 0) {
  if (v == null) return fallback;
  if (!Number.isSafeInteger(v) || v < 0 || v >= 8640000000000000) throw bad('Expected a valid millisecond timestamp.');
  return v;
}
function choice(v, choices, fallback) { if (v == null) return fallback; if (!choices.includes(v)) throw bad('Invalid choice.'); return v; }
function flag(v, fallback = false) { if (v == null) return fallback; if (typeof v !== 'boolean') throw bad('Expected true or false.'); return v; }
function idOf(id) { if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,120}$/.test(id) || id === 'import') throw bad('Invalid session id.'); return id; }
function ref(atlas, v) {
  if (v == null) return null;
  const id = typeof v === 'string' ? v : object(v).id;
  const topic = atlas.topics.get(id);
  if (!topic || (v?.path && fileKey(v.path) !== fileKey(topic.file))) throw bad('This topic is not in the configured workspace.', 403, 'OUTSIDE_WORKSPACE');
  return { id: topic.id, path: topic.file, title: topic.title };
}
function pointer(atlas, raw, kind) {
  if (raw == null) return null;
  object(raw);
  const p = text(raw.path, 8192);
  // External papers remain web references only. No registry field selects a file to open on the host.
  if (!/^https?:\/\//i.test(p) && (!path.isAbsolute(p) || ![atlas.root, atlas.knowledge, atlas.library].some((root) => root && isWithin(root,p)))) throw bad('A context pointer is outside the configured workspace.', 403, 'OUTSIDE_WORKSPACE');
  return { path: p, ...(kind !== 'attachment' ? { title: text(raw.title, 2048) } : {}), ...(kind === 'doc' ? { type: text(raw.type, 64) } : { label: text(raw.label, 2048) }) };
}
// A Desk seed is researcher input, never a stored copy of lead output. Keep the
// validation limits in sync with normalizeInquirySeed in the client (tested).
function inquirySeed(raw) {
  object(raw);
  const seed = {};
  for (const [field, limit] of Object.entries({longQuestion:4000, currentQuestion:4000, sourceUrl:2048, sourceExcerpt:6000})) {
    const value = text(raw[field],limit);
    if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) throw bad('Invalid inquiry text.');
    seed[field] = value.trim();
  }
  if (seed.sourceUrl) {
    let url;
    try { url = new URL(seed.sourceUrl); } catch {}
    if (!/^https?:\/\/[^/]/i.test(seed.sourceUrl) || /[\\\s]/u.test(seed.sourceUrl) || !url?.hostname || url.username || url.password) throw bad('Invalid inquiry source URL.');
  }
  if (raw.readPublicSource != null && typeof raw.readPublicSource !== 'boolean') throw bad('Invalid shared chat read choice.');
  if (raw.readPublicSource) {
    if (raw.sourceUrl !== seed.sourceUrl || !/^https:\/\/chatgpt\.com\/share\/[\da-fA-F]{8}-(?:[\da-fA-F]{4}-){3}[\da-fA-F]{12}$/u.test(seed.sourceUrl)) throw bad('Reading requires an exact public ChatGPT share link.');
    seed.readPublicSource = true;
  }
  return seed;
}
function context(atlas, raw = {}, allowInquiry = false) {
  object(raw);
  if (raw.attachments != null && (!Array.isArray(raw.attachments) || raw.attachments.length > 128)) throw bad('Invalid attachments.');
  return { topic: ref(atlas, raw.topic), doc: pointer(atlas, raw.doc, 'doc'), page: text(raw.page, 100), section: text(raw.section, 2048), lines: text(raw.lines, 256), selection: text(raw.selection, 64000),
    ...(allowInquiry && raw.inquiry != null ? { inquiry:inquirySeed(raw.inquiry) } : {}),
    ...(raw.beside ? { beside: pointer(atlas, raw.beside, 'beside') } : {}), ...(raw.attachments?.length ? { attachments: raw.attachments.map((a) => pointer(atlas, object(a), 'attachment')) } : {}) };
}
function model(v) { return v == null ? null : { provider: text(object(v).provider, 200), model: text(v.model, 300), effort: text(v.effort, 100) }; }
function newRecord(atlas, raw, now, legacy) {
  object(raw);
  if (raw.kind === 'team') throw bad('Legacy teams stay in the team migration.');
  const id = idOf(raw.id), c = context(atlas, raw.context || {}, !legacy && raw.origin === 'desk'), t = ref(atlas, Object.hasOwn(raw,'topic') ? raw.topic : c.topic);
  const created = stamp(raw.created, now), updated = Math.max(created, stamp(raw.updated, created));
  return { id, title: text(raw.title, 2048).trim() || text(raw.label, 2048).trim() || 'Untitled discussion', created, updated, lastTurnAt: stamp(raw.lastTurnAt),
    status: choice(raw.status, ['open','resolved'], 'open'), pinned: flag(raw.pinned), topic: t, filing: t ? choice(raw.filing, ['user','auto'], 'user') : 'none', moves: [],
    origin: legacy ? 'import' : choice(raw.origin, origins, 'ask'), intent: text(raw.intent, 100, 'ask'), question: text(raw.question, 64000), context: c, model: model(raw.model), teamId: null, seenAt: stamp(raw.seenAt, created),
    ...(legacy && raw.label ? { label: text(raw.label, 2048) } : {}) };
}

function moveMatch(last, key) { return !!last && (typeof key === 'number' ? last.at === key : !!last.token && last.token === key); }
// Executed inside the per-registry writer queue after reloading disk. A
// lastTurnAt is a host-issued version, not the wall clock of a tab. Retain one
// predecessor (and the latest known DSH ordinal) rather than a turn history.
function observeDiscussionTurn(r, p, now) {
  const current = r.lastTurnAt || 0, previous = r.turnObservation;
  const noop = () => ({ discussion: r, unchanged: true });
  const readCurrent = () => {
    if ((r.seenAt || 0) >= current) return noop();
    r.seenAt = current; return { discussion: r };
  };
  if ('readTurn' in p) {
    if (p.readTurn == null) throw bad('Missing observed read version.');
    return stamp(p.readTurn) === current ? readCurrent() : noop();
  }
  const obs = object(p.observeTurn);
  if (obs.after == null || typeof obs.seen !== 'boolean') throw bad('Expected an observed predecessor and visibility.');
  const after = stamp(obs.after), n = obs.number, floor = previous?.numberFloor || 0;
  if (n !== undefined && (!Number.isSafeInteger(n) || n < 1)) throw bad('Invalid DSH turn number.');
  if (after > current) return noop();
  if (n !== undefined && n <= floor) return n === previous?.number && obs.seen ? readCurrent() : noop();
  if (after !== current && !(n && previous?.number)) {
    // A fallback observation can only identify the immediate successor of
    // its captured version. Never let a late report acknowledge a later turn.
    if (after !== previous?.after) return noop();
    if (n && !previous.number) {
      // A second window supplied the DSH identity for our anonymous version.
      previous.number = previous.numberFloor = n;
      if (obs.seen) r.seenAt = Math.max(r.seenAt || 0, current);
      return { discussion: r };
    }
    return obs.seen ? readCurrent() : noop();
  }
  const version = Math.max(now, current + 1, (r.seenAt || 0) + 1);
  r.turnObservation = { after: current, number: n || null, numberFloor: n || floor };
  r.lastTurnAt = version; r.updated = Math.max(version, r.updated);
  if (obs.seen) r.seenAt = version;
  return { discussion: r };
}
function patchRecord(atlas, r, p, now) {
  object(p);
  if ('inquiryFocus' in p) {
    if (Object.keys(p).length !== 1) throw bad('A focus correction must be a separate transaction.');
    if (r.origin !== 'desk' || !r.context?.inquiry || r.status !== 'open') throw bad('This open Desk inquiry is no longer available.',409,'INQUIRY_UNAVAILABLE');
    const edit = object(p.inquiryFocus), {afterSeq} = edit;
    if (Object.keys(edit).some(k => !['longQuestion','currentQuestion','afterSeq'].includes(k)) || !Number.isSafeInteger(afterSeq) || afterSeq < -1) throw bad('Invalid inquiry focus correction.');
    const {longQuestion,currentQuestion} = inquirySeed(edit);
    if (!currentQuestion) throw bad('State the current question.');
    if (afterSeq < (r.inquiryFocus?.afterSeq ?? -1)) throw bad('A newer focus correction is already recorded.',409,'STALE_INQUIRY_FOCUS');
    r.inquiryFocus = {longQuestion,currentQuestion,afterSeq};
    r.updated = Math.max(r.updated,now);
    return {discussion:r};
  }
  if ('observeTurn' in p || 'readTurn' in p) {
    if (Object.keys(p).length !== 1) throw bad('An observation must be a separate transaction.');
    return observeDiscussionTurn(r, p, now);
  }
  // Do not let a lagging pre-CAS window overwrite a versioned read receipt.
  if (r.turnObservation && ('seenAt' in p || 'lastTurnAt' in p)) throw bad('Use a turn-bound observation.', 409, 'UNBOUND_OBSERVATION');
  const permitted = ['pinned','title','status','model','movedTo','updated','seenAt','lastTurnAt','topic','undoMove','claimMove','toldMove'];
  const keys = Object.keys(p);
  if (!keys.length || keys.some((k) => !permitted.includes(k))) throw bad('Unknown or empty discussion patch.');
  const exclusive = ['topic','undoMove','claimMove','toldMove'].filter((k) => k in p);
  if (exclusive.length && keys.length !== 1) throw bad('A move must be a separate transaction.');
  const last = r.moves.at(-1);
  if ('claimMove' in p) {
    if (!moveMatch(last,p.claimMove) || last.claimed || last.told) return { discussion: r, claimed: false, unchanged: true };
    last.claimed = true; return { discussion: r, claimed: true };
  }
  if ('undoMove' in p || 'toldMove' in p) {
    if (!moveMatch(last, p.undoMove ?? p.toldMove)) throw bad('This is no longer the latest move.', 409, 'STALE_MOVE');
    if ('toldMove' in p) { if (!last.claimed) throw bad('Move delivery not claimed.', 409, 'UNCLAIMED_MOVE'); last.told = true; }
    else { if (last.claimed || last.told) throw bad('Move delivery was already claimed.', 409, 'MOVE_CLAIMED'); r.topic = last.previousTopic; r.filing = last.previousFiling; r.moves.pop(); }
  }
  if ('topic' in p) {
    const move = object(p.topic);
    if (!Object.hasOwn(move,'to') || flag(move.told)) throw bad('Move must include a destination and cannot claim delivery.');
    const token = text(move.token, 120);
    if (token && r.moves.some((m) => m.token === token)) return { discussion: r, unchanged: true };
    const to = ref(atlas, move.to);
    const at = Math.max(now, (last?.at ?? 0) + 1, r.updated + 1);
    r.moves.push({ at, from: r.topic?.id ?? null, to: to?.id ?? null, told: false, previousTopic: r.topic, previousFiling: r.filing, ...(token ? {token} : {}) });
    r.topic = to; r.filing = 'user'; r.updated = at; // choosing Unfiled is also an explicit user decision
  }
  if ('title' in p) { const title = text(p.title,2048).trim(); if (!title) throw bad('A discussion title cannot be empty.'); r.title = title; }
  if ('pinned' in p) r.pinned = flag(p.pinned);
  if ('status' in p) r.status = choice(p.status,['open','resolved'],'open');
  if ('model' in p) r.model = model(p.model);
  if ('movedTo' in p) {
    const target = idOf(p.movedTo);
    if (target === r.id) throw bad('Cannot hand a discussion off to itself.');
    if (r.movedTo && r.movedTo !== target) throw bad('This discussion already has a handoff target.',409,'HANDOFF_EXISTS');
    r.movedTo = target;
  }
  if ('seenAt' in p) r.seenAt = Math.max(r.seenAt, stamp(p.seenAt));
  if ('lastTurnAt' in p) r.lastTurnAt = Math.max(r.lastTurnAt || 0, stamp(p.lastTurnAt));
  const metadataEdit = keys.some((k) => !['seenAt','updated','lastTurnAt'].includes(k));
  r.updated = Math.max(r.updated, stamp(p.updated), r.lastTurnAt || 0, metadataEdit ? now : 0);
  return { discussion: r };
}

export function createDiscussions({ root, stateDir }, { beforeRename, now = Date.now } = {}) {
  const base = path.resolve(stateDir || path.join(os.homedir(), '.aitp-atlas'));
  const workspace = createHash('sha256').update(fileKey(root)).digest('hex');
  const dir = path.join(base,'workspaces',workspace), file = path.join(dir,'discussions.json');
  const load = async () => {
    let data; try { data = JSON.parse(await fs.readFile(file, 'utf8')); } catch (e) { if (e.code === 'ENOENT') return []; throw bad('Cannot read discussion registry; original left untouched.',500,'REGISTRY_UNREADABLE'); }
    if (data?.version !== 1 || !Array.isArray(data.discussions) || data.workspace !== workspace) throw bad('Unknown or misfiled registry; original left untouched.',500,'REGISTRY_UNREADABLE');
    return data.discussions;
  };
  const save = async (rows) => {
    if (isWithin(root,dir)) throw bad('Configure stateDir outside the research workspace.',409,'STATE_IN_RESEARCH');
    await fs.mkdir(dir, {recursive:true});
    const tmp = path.join(dir, `.discussions-${randomUUID()}.tmp`);
    const handle = await fs.open(tmp,'wx',0o600);
    try {
      try { await handle.writeFile(JSON.stringify({version:1, workspace, discussions:rows}), 'utf8'); await handle.sync(); } finally { await handle.close(); }
      if (beforeRename) await beforeRename();
      await fs.rename(tmp, file);
    } finally { await fs.rm(tmp, { force:true }); }
  };
  // Windows can reject rename over a file still open for reading. The list
  // endpoint (including /needs) shares this queue across mounted instances;
  // no read handle outlives its slot, and a queued GET sees the preceding write.
  const serial = (fn) => {
    const run = (queues.get(file) || Promise.resolve()).then(fn);
    const tail = run.catch(() => {}); queues.set(file,tail); tail.then(() => { if (queues.get(file) === tail) queues.delete(file); });
    return run;
  };
  const change = (fn) => serial(async () => {
    const rows=await load(), result=fn(rows);
    if (!result.unchanged) await save(rows);
    const {unchanged, ...reply}=result;return reply;
  });
  return {
    async list({ status='all', topic, q='' } = {}) {
      choice(status,['all','open','resolved'],'all'); const term = q.toLocaleLowerCase();
      return (await serial(load)).filter((r) => (status === 'all' || r.status === status) && (topic == null || (topic === 'unfiled' ? r.topic == null : r.topic?.id === topic)) && (!term || [r.title,r.question,r.topic?.title].some((s) => s?.toLocaleLowerCase().includes(term)))).sort((a,b) => b.updated-a.updated || b.created-a.created || a.id.localeCompare(b.id));
    },
    create(atlas, raw) {
      return change((rows) => {
        const id = idOf(object(raw).id);
        const existing = rows.find((r) => r.id === id);
        if (existing) return { discussion: existing, unchanged: true };
        const discussion = newRecord(atlas, raw, now(), false);
        rows.push(discussion);
        return { discussion };
      });
    },
    patch(atlas, id, patch) {
      return change((rows) => {
        idOf(id);
        const r = rows.find((x) => x.id === id);
        if (!r) throw bad('No discussion with this id.', 404, 'NOT_FOUND');
        return patchRecord(atlas, r, patch, now());
      });
    },
    import(atlas, records) {
      if (!Array.isArray(records) || records.length > 1000) throw bad('Expected up to 1000 records.');
      return change((rows) => {
        const ids = new Set(rows.map((r) => r.id));
        const rejected = [], legacyTeamIds = [];
        let imported = 0, existing = 0;
        for (const raw of records) {
          try {
            const id = idOf(object(raw).id);
            if (raw.kind === 'team') { legacyTeamIds.push(id); continue; }
            if (ids.has(id)) { existing++; continue; }
            rows.push(newRecord(atlas, raw, now(), true));
            ids.add(id); imported++;
          } catch (e) {
            rejected.push({ id: typeof raw?.id === 'string' ? raw.id.slice(0, 120) : null, reason: e.message });
          }
        }
        return { imported, existing, rejected, legacyTeamIds, unchanged: !imported };
      });
    },
  };
}
