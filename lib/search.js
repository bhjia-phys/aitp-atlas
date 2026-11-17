/**
 * Search and Learn over what the research and the knowledge collection hold.
 *
 * Search reads the topic notes and the notes they link, the knowledge index
 * and its entry notes, the paper maps, and the abstract of each library
 * paper's TeX source. Every word must appear; a result carries a snippet with
 * the words marked. Files are kept in memory while unchanged.
 *
 * Learn reads a topic's own words: the question its opening states, the
 * reading route its note lists, and a concept map drawn from the links between
 * the knowledge entries the topic uses. Nothing tracks progress.
 */

import path from 'node:path';
import { fileKey, listDir, mapLimit, readText, statSafe } from './fsutil.js';
import { links, noteTitle, plain, sections, stripFrontmatter } from './markdown.js';

const TEXT_LIMIT = 768 * 1024;
const RECHECK_MS = 60 * 1000;
const cache = new Map();

async function textOf(file) {
  const key = fileKey(file);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.checkedAt < RECHECK_MS) return hit.text;
  const stat = await statSafe(file);
  if (!stat || !stat.isFile()) {
    cache.delete(key);
    return '';
  }
  if (hit && hit.mtimeMs === stat.mtimeMs) {
    hit.checkedAt = Date.now();
    return hit.text;
  }
  const text = await readText(file, TEXT_LIMIT);
  cache.set(key, { text, mtimeMs: stat.mtimeMs, checkedAt: Date.now() });
  if (cache.size > 4000) cache.delete(cache.keys().next().value);
  return text;
}

/** The words of a query: lower-cased, two letters or more, at most eight. */
export function queryWords(query) {
  return [...new Set(String(query || '').toLowerCase().split(/[\s,;]+/).map((w) => w.replace(/^["'(]+|["').:]+$/g, '')).filter((w) => w.length >= 2))].slice(0, 8);
}

/** A passage around the first match, as segments with the matched words flagged. */
export function snippetOf(text, words, radius = 120) {
  const flat = String(text).replace(/\s+/g, ' ');
  const lower = flat.toLowerCase();
  let at = -1;
  for (const w of words) {
    const i = lower.indexOf(w);
    if (i >= 0 && (at < 0 || i < at)) at = i;
  }
  if (at < 0) return [{ text: flat.slice(0, radius * 2), hit: false }];
  const start = Math.max(0, flat.lastIndexOf(' ', Math.max(0, at - radius)) + 1);
  const end = Math.min(flat.length, flat.indexOf(' ', Math.min(flat.length, at + radius)) < 0 ? flat.length : flat.indexOf(' ', Math.min(flat.length, at + radius)));
  const part = flat.slice(start, end);
  const pattern = new RegExp(`(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  const out = [];
  if (start > 0) out.push({ text: '… ', hit: false });
  let last = 0;
  for (const m of part.matchAll(pattern)) {
    if (m.index > last) out.push({ text: part.slice(last, m.index), hit: false });
    out.push({ text: m[0], hit: true });
    last = m.index + m[0].length;
  }
  if (last < part.length) out.push({ text: part.slice(last), hit: false });
  if (end < flat.length) out.push({ text: ' …', hit: false });
  return out;
}

/** Readable text of Markdown or LaTeX for matching: links keep their words, markup goes. */
function readable(text) {
  return String(text)
    .replace(/^---\n[\s\S]*?\n---\n/, '')
    .replace(/<a id="[^"]*"><\/a>/g, '')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`#>|$]/g, ' ')
    .replace(/\\(?:emph|textit|textbf|cite[pt]?|ref|eqref|label)\{([^}]*)\}/g, '$1');
}

async function corpus(atlas) {
  const docs = [];
  const seen = new Set();
  const add = (doc) => {
    // A note linked from several topics is one result, under the topic it belongs to (added first).
    const key = doc.kind === 'knowledge' ? `${doc.kind}|${fileKey(doc.file)}|${doc.title || ''}` : `${doc.kind}|${fileKey(doc.file)}`;
    if (!doc.file || seen.has(key)) return;
    seen.add(key);
    docs.push(doc);
  };
  const topicRef = (t) => (t ? { id: t.id, title: t.title, file: t.file } : null);
  for (const t of atlas.topics.values()) add({ kind: 'note', file: t.file, title: t.title, topic: topicRef(t) });
  for (const t of atlas.topics.values()) {
    for (const ref of t.refs || []) {
      if (ref.abs && /\.md$/i.test(ref.abs) && !(atlas.library && path.resolve(ref.abs).startsWith(path.resolve(atlas.library)))) add({ kind: 'note', file: ref.abs, title: '', topic: topicRef(t) });
    }
  }
  if (atlas.index) {
    for (const area of atlas.index.areas) {
      for (const e of area.entries) add({ kind: 'knowledge', file: e.note || atlas.index.file, title: e.title, area: area.heading, row: [e.title, e.kind, e.scope, e.support].join(' · '), usedBy: e.usedBy || [] });
    }
  }
  for (const p of atlas.papers || []) {
    add({ kind: 'paper', file: p.map || p.pdf, title: p.title || p.key, paper: { key: p.key, pdf: p.pdf, map: p.map }, versions: p.versions || [] });
  }
  return docs;
}

/** The abstract of a library paper, from its TeX source when the source is there. */
async function abstractOf(atlas, paper) {
  if (!paper.pdf) return '';
  const source = path.join(path.dirname(paper.pdf), 'source');
  const files = (await listDir(source)).filter((e) => e.isFile() && /\.tex$/i.test(e.name)).slice(0, 6);
  for (const f of files) {
    const text = await textOf(path.join(source, f.name));
    const m = /\\begin\{abstract\}([\s\S]*?)\\end\{abstract\}/.exec(text) || /\\abstract\{([\s\S]*?)\}\s*\n/.exec(text);
    if (m) return m[1].replace(/%.*$/gm, '').replace(/\s+/g, ' ').trim().slice(0, 4000);
  }
  return '';
}

/**
 * Results for `query`: [{kind, file, title, topic, snippet, score}], with the
 * count of each kind. `kind` narrows to notes, knowledge or papers.
 */
export async function search(atlas, query, { kind = 'all', limit = 60 } = {}) {
  const words = queryWords(query);
  if (words.length === 0) return { query, words, results: [], counts: { note: 0, knowledge: 0, paper: 0 } };
  const docs = await corpus(atlas);
  const found = await mapLimit(docs, 8, async (doc) => {
    let body = '';
    if (doc.kind === 'knowledge') body = `${doc.row} ${readable(await textOf(doc.file)).slice(0, 200000)}`;
    else if (doc.kind === 'paper') body = `${doc.title} ${doc.paper.map ? readable(await textOf(doc.paper.map)) : ''} ${await abstractOf(atlas, doc.paper)}`;
    else body = readable(await textOf(doc.file));
    const title = doc.title || noteTitle(stripFrontmatter(await textOf(doc.file))) || path.basename(doc.file);
    const hay = `${title} ${body}`.toLowerCase();
    if (!words.every((w) => hay.includes(w))) return null;
    const titleLower = title.toLowerCase();
    let score = 0;
    for (const w of words) {
      if (titleLower.includes(w)) score += 8;
      let n = 0;
      for (let i = hay.indexOf(w); i >= 0 && n < 12; i = hay.indexOf(w, i + w.length)) n += 1;
      score += n;
    }
    if (doc.kind === 'note' && doc.topic && fileKey(doc.topic.file) === fileKey(doc.file)) score += 3;
    return { kind: doc.kind, file: doc.file, title: plain(title).replace(/^\[[^\]]*\]\s*/, ''), topic: doc.topic || null, area: doc.area || '', paper: doc.paper || null, snippet: snippetOf(body, words), score };
  });
  const hits = found.filter(Boolean).sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
  const counts = { note: 0, knowledge: 0, paper: 0 };
  for (const r of hits) counts[r.kind] += 1;
  const wanted = kind === 'all' ? hits : hits.filter((r) => r.kind === kind);
  return { query, words, results: wanted.slice(0, limit), counts };
}

// ------------------------------------------------------------------ learn ---

/** The topic's question: the "**The question.**" paragraph of its opening, else its first sentence. */
export function questionOf(body, lead = '') {
  const m = /\*\*The question\.\*\*\s*([^\n]+)/.exec(String(body));
  if (m) return plain(m[1]).split(/(?<=[.?!])\s+(?=[A-Z])/)[0].trim();
  return lead;
}

/** The reading route a note lists: the items of a section named for reading, with their links. */
export function readingRoute(body, dir) {
  const section = sections(String(body)).find((s) => /reading (route|order|list|path)|study (route|plan|order)|^route\b|learning route/i.test(s.heading));
  if (!section) return null;
  const items = [];
  for (const line of section.text.split('\n')) {
    const m = /^\s*(?:[-*]|\d+\.)\s+(.*)$/.exec(line);
    if (!m) continue;
    const link = links(m[1]).find((l) => l.target);
    items.push({
      text: plain(m[1]).replace(/\s+/g, ' ').trim().slice(0, 240),
      file: link && !link.external ? path.resolve(dir, link.target) : '',
      url: link && link.external ? link.target : '',
    });
    if (items.length >= 24) break;
  }
  return { heading: section.heading, items };
}

/** A route kept in a note of its own: each ## section a stage, with the source it names in bold and its first link. */
export function routeFromNote(body, dir) {
  const items = [];
  for (const section of sections(String(body))) {
    if (/^how to|^what (this|the) (note|guide)|^about/i.test(section.heading)) continue;
    const bold = /\*\*([^*]{3,160})\*\*/.exec(section.text);
    const link = links(section.text).find((l) => l.target);
    items.push({
      text: `${section.heading}${bold ? ` — ${plain(bold[1])}` : ''}`.slice(0, 260),
      file: link && !link.external ? path.resolve(dir, link.target) : '',
      url: link && link.external ? link.target : '',
    });
    if (items.length >= 16) break;
  }
  return items;
}

/** Knowledge entries the topic uses, and the links between their notes. */
export async function conceptMap(atlas, topic) {
  if (!atlas.index) return { nodes: [], edges: [] };
  const entries = atlas.index.areas.flatMap((a) => a.entries).filter((e) => e.note);
  const byNote = new Map(entries.map((e) => [fileKey(e.note), e]));
  const used = entries.filter((e) => (e.usedBy || []).includes(topic.id));
  const linkedFromTopic = (topic.refs || []).map((r) => r.abs && byNote.get(fileKey(r.abs))).filter(Boolean);
  const start = [...new Map([...used, ...linkedFromTopic].map((e) => [fileKey(e.note), e])).values()].slice(0, 16);
  const nodes = new Map(start.map((e) => [fileKey(e.note), e]));
  const edges = [];
  for (const e of start) {
    const text = await textOf(e.note);
    for (const l of links(stripFrontmatter(text))) {
      if (l.external || !l.target) continue;
      const target = byNote.get(fileKey(path.resolve(path.dirname(e.note), l.target)));
      if (!target || fileKey(target.note) === fileKey(e.note)) continue;
      if (!nodes.has(fileKey(target.note)) && nodes.size < 24) nodes.set(fileKey(target.note), target);
      if (nodes.has(fileKey(target.note))) edges.push([e.note, target.note]);
    }
  }
  const unique = [...new Map(edges.map(([a, b]) => [`${fileKey(a)}>${fileKey(b)}`, [a, b]])).values()].slice(0, 40);
  return { nodes: [...nodes.values()].map((e) => ({ file: e.note, title: e.title, kind: e.kind, support: e.support })), edges: unique };
}

/** The route the topic's note lists, or the one in the note it links as its reading or source route. */
async function routeOf(body, dir) {
  const own = readingRoute(body, dir);
  if (own) return own;
  const link = links(body).find((l) => !l.external && l.target && /\.md$/i.test(l.target) && (/(reading|source|study)[-_ ]?(route|order|guide)|syllabus/i.test(l.target) || /(reading|source|study) (route|order|guide)/i.test(l.text)));
  if (!link) return null;
  const file = path.resolve(dir, link.target);
  const text = stripFrontmatter(await textOf(file));
  if (!text) return null;
  const items = routeFromNote(text, path.dirname(file));
  return items.length ? { heading: 'Reading route', from: file, items } : null;
}

/** Route stages that cite an arXiv paper the library holds open its PDF here; the link stays beside it. */
function withLibrary(atlas, route) {
  if (!route) return route;
  const pdfs = new Map((atlas.papers || []).filter((p) => p.pdf).map((p) => [p.key, p.pdf]));
  return {
    ...route,
    items: route.items.map((item) => {
      const id = (/arxiv\.org\/(?:abs|pdf)\/([^?#\s]+?)(?:v\d+)?(?:\.pdf)?$/i.exec(item.url || '') || [])[1];
      return id && pdfs.has(id) && !item.file ? { ...item, file: pdfs.get(id) } : item;
    }),
  };
}

export async function learnTopic(atlas, topic) {
  const body = stripFrontmatter(await textOf(topic.file));
  const current = (topic.threads || []).find((t) => /^active|^waiting on (the )?(researcher|learner|you)/i.test(t.status || '')) || (topic.threads || [])[0] || null;
  return {
    topic: { id: topic.id, title: topic.title, file: topic.file },
    question: questionOf(body, topic.lead),
    current: current ? { name: current.name, status: current.status, date: current.date } : null,
    route: withLibrary(atlas, await routeOf(body, path.dirname(topic.file))),
    concepts: await conceptMap(atlas, topic),
  };
}
