/**
 * The atlas: what AITP's own files say, arranged for reading.
 *
 *   root note   research.md at the research root: the directions, and beside them
 *               connections, seeds, standing agreements and Current work
 *   topics      every research.md that links reach from the root, plus those a
 *               shallow folder scan finds that no link reaches
 *   knowledge   the shared collection's index.md, area by area
 *   papers      library/arxiv/<version>/ joined with papers/<id>.md and its section notes
 *
 * Only AITP's conventions are read: a note's title, opening and Current work,
 * the root's sections, links and the index tables. Nothing is written, and
 * nothing is kept beyond a parse cache.
 */

import path from 'node:path';
import { promises as fsp } from 'node:fs';
import { arxivMentions, blocks, clip, compareText, currentWork, firstParagraph, firstSentence, links, noteTitle, opening, plain, sections, stripFrontmatter, tables, withoutTables } from './markdown.js';
import { fileKey, isWithin, listDir, mapLimit, readText, relPosix, statSafe } from './fsutil.js';
import { countGroups, fileType } from './contents.js';

export const NOTE = 'research.md';
export const DEFAULT_EXCLUDES = [
  '.git', 'node_modules', '__pycache__', 'workspace', 'calculations', 'runs', 'data', 'build',
  'archive', 'archives', 'provenance', 'snapshots', 'retired', 'reports', 'backup', 'backups',
];
const SCAN_DEPTH = 4;
/** Root sections that the backbone keeps beside the directions, not groups of topics. */
const BESIDE_DIRECTIONS = /connection|seed|current work|standing agreement|agreed|agreement/i;

/** Read the research tree. `cache` (a Map) keeps parsed files between loads. */
export async function loadAtlas(options, cache = new Map()) {
  if (!options.root) throw Object.assign(new Error('Set root in the aitp-atlas profile configuration.'), { statusCode: 400, setup: 'unconfigured' });
  const root = path.resolve(options.root);
  const excludes = new Set((options.exclude || DEFAULT_EXCLUDES).map((name) => String(name).toLowerCase()));
  const excludePaths = (options.excludePaths || []).map((p) => String(p).replace(/\\/g, '/').replace(/^\/+|\/+$/g, ''));
  const seen = new Set();
  // A file read by two parsers (a paper map is also a note) keeps one cached reading per parser kind.
  const parse = async (file, parser, kind = '') => {
    const stat = await statSafe(file);
    if (!stat || !stat.isFile()) return undefined;
    const key = kind ? `${kind}:${file}` : file;
    seen.add(key);
    const hit = cache.get(key);
    if (hit && hit.mtimeMs === stat.mtimeMs && hit.size === stat.size) return hit.value;
    const value = parser(await readText(file), stat, file);
    cache.set(key, { mtimeMs: stat.mtimeMs, size: stat.size, value });
    return value;
  };
  const readNote = (file) => parse(file, parseNote);
  const rootFile = path.join(root, NOTE);
  const rootNote = await readNote(rootFile);
  if (!rootNote) {
    const error = new Error(`There is no ${NOTE} at the research root ${root}.`);
    error.statusCode = 404;
    const directory = await statSafe(root);
    const entry = directory && directory.isDirectory() ? await fsp.lstat(rootFile).catch((cause) => {
      if (cause.code !== 'ENOENT') throw cause;
      return null;
    }) : null;
    error.setup = !directory || !directory.isDirectory() ? 'missing-folder' : entry ? 'invalid-note' : 'missing-note';
    throw error;
  }

  const linkedKnowledge = options.knowledge || knowledgeFromLinks(rootNote, root);
  const knowledge = linkedKnowledge
    ? await existingDir(linkedKnowledge)
    : (await existingDir(path.resolve(root, '..', 'knowledge'))) || path.join(root, 'knowledge');
  const localKnowledge = knowledge && isWithin(root, knowledge) && fileKey(root) !== fileKey(knowledge) ? knowledge : '';
  const excluded = (abs) => {
    const rel = relPosix(root, abs);
    if (!rel) return false;
    if (localKnowledge && isWithin(localKnowledge, abs)) return true;
    const parts = rel.split('/');
    if (parts.slice(0, -1).some((part) => part.startsWith('.') || excludes.has(part.toLowerCase()))) return true;
    return excludePaths.some((p) => rel === p || rel.startsWith(p + '/'));
  };

  // ---------------------------------------------------------------- topics ---
  const notes = new Map([[fileKey(rootFile), rootNote]]);
  const reached = new Set([fileKey(rootFile)]);
  const queue = [rootFile];
  while (queue.length > 0 && notes.size < (options.maxTopics || 2000)) {
    const batch = queue.splice(0, 16);
    const parsed = await mapLimit(batch, 8, readNote);
    batch.forEach((file, index) => {
      const note = parsed[index];
      if (!note) return;
      notes.set(fileKey(file), note);
      for (const link of note.links) {
        if (path.basename(link.abs).toLowerCase() !== NOTE) continue;
        const key = fileKey(link.abs);
        if (reached.has(key) || !isWithin(root, link.abs) || excluded(link.abs)) continue;
        reached.add(key);
        queue.push(link.abs);
      }
    });
  }
  const scanned = (await scanForNotes(root, excludes, excluded)).filter((file) => !notes.has(fileKey(file)));
  const scannedNotes = await mapLimit(scanned, 8, readNote);
  scanned.forEach((file, index) => {
    if (scannedNotes[index]) notes.set(fileKey(file), scannedNotes[index]);
  });

  const topics = new Map();
  for (const note of notes.values()) {
    const id = relPosix(root, path.dirname(note.file));
    topics.set(id, {
      id,
      file: note.file,
      title: note.title,
      lead: note.lead,
      threads: note.threads,
      reached: reached.has(fileKey(note.file)),
      parent: null,
      children: [],
      direction: '',
      context: '',
      place: id === '' ? 'root' : '',
      mtimeMs: note.mtimeMs,
      refs: note.refs,
      arxiv: note.arxiv,
    });
  }
  for (const topic of topics.values()) {
    if (topic.id === '') continue;
    const parts = topic.id.split('/');
    topic.parent = '';
    for (let n = parts.length - 1; n > 0; n -= 1) {
      const candidate = parts.slice(0, n).join('/');
      if (topics.has(candidate)) {
        topic.parent = candidate;
        break;
      }
    }
  }

  // ------------------------------------------------------------ directions ---
  const directions = [];
  const beside = [];
  for (const section of rootNote.sections) {
    if (BESIDE_DIRECTIONS.test(section.heading)) {
      beside.push({ heading: section.heading, slug: section.slug, markdown: section.text, isCurrentWork: /^current work/i.test(section.heading) });
      continue;
    }
    const ids = [];
    for (const block of blocks(section.text)) {
      // The block's first note link is its subject; later ones (", with its branch") only place a topic.
      let first = true;
      for (const link of links(block.markdown)) {
        if (link.external || !link.target) continue;
        const abs = path.resolve(root, link.target);
        if (path.basename(abs).toLowerCase() !== NOTE) continue;
        const subject = first;
        first = false;
        const topic = topics.get(relPosix(root, path.dirname(abs)));
        if (!topic || topic.id === '' || topic.direction) continue;
        topic.direction = section.slug;
        if (subject) topic.context = contextOf(block);
        ids.push(topic.id);
      }
    }
    // A direction no topic serves yet keeps its place, with its text.
    directions.push({ heading: section.heading, slug: section.slug, lead: firstParagraph(section.text, 360), topics: ids, markdown: ids.length > 0 ? '' : section.text });
  }

  // Each topic is shown once: in its direction, or under its parent, or in a closing group.
  for (const topic of topics.values()) {
    if (topic.id === '') continue;
    const parent = topic.parent ? topics.get(topic.parent) : null;
    if (topic.direction && !(parent && parent.direction === topic.direction)) topic.place = 'direction';
    else if (parent) topic.place = 'child';
    else topic.place = topic.reached ? 'other' : 'unreached';
  }
  for (const topic of topics.values()) {
    if (topic.place === 'child') topics.get(topic.parent).children.push(topic.id);
  }
  for (const topic of topics.values()) topic.children.sort((a, b) => compareText(topics.get(a).title, topics.get(b).title));
  for (const direction of directions) direction.topics = direction.topics.filter((id) => topics.get(id).place === 'direction');
  const byTitle = (a, b) => compareText(topics.get(a).title, topics.get(b).title);
  const other = [...topics.values()].filter((t) => t.place === 'other').map((t) => t.id).sort(byTitle);
  const unreached = [...topics.values()].filter((t) => t.place === 'unreached').map((t) => t.id).sort(byTitle);

  // ------------------------------------------------------- links between notes ---
  const linkedFrom = new Map();
  for (const topic of topics.values()) {
    const note = notes.get(fileKey(topic.file));
    for (const link of note.links) {
      const key = fileKey(link.abs);
      const list = linkedFrom.get(key) || [];
      if (!list.includes(topic.id) && fileKey(topic.file) !== key) list.push(topic.id);
      linkedFrom.set(key, list);
    }
  }

  // ------------------------------------------------------------- knowledge ---
  const indexFile = knowledge ? path.join(knowledge, 'index.md') : '';
  const index = indexFile ? await parse(indexFile, parseIndex) : undefined;

  const library = await existingDir(options.library || (knowledge ? path.join(knowledge, 'library') : ''));
  const papers = knowledge || library ? await loadPapers(knowledge, library, parse) : [];
  const topicByFile = new Map([...topics.values()].map((t) => [fileKey(t.file), t]));
  const mentions = new Map();
  for (const topic of topics.values()) {
    for (const id of notes.get(fileKey(topic.file)).arxiv) mentions.set(id, [...(mentions.get(id) || []), topic.id]);
  }
  for (const paper of papers) {
    const users = new Set(mentions.get(paper.key) || []);
    for (const file of [paper.map, paper.pdf].filter(Boolean)) for (const id of linkedFrom.get(fileKey(file)) || []) users.add(id);
    // A paper map started "For" a topic files the paper under it, cited there or not yet.
    for (const file of paper.forFiles || []) {
      const topic = topicByFile.get(fileKey(file));
      if (!topic) continue;
      users.add(topic.id);
      topic.readingFor = [...new Set([...(topic.readingFor || []), paper.key])];
    }
    delete paper.forFiles;
    paper.usedBy = [...users];
  }
  if (index) {
    const pdfs = new Map(papers.filter((p) => p.pdf).map((p) => [p.key, p.pdf]));
    for (const area of index.areas) {
      for (const entry of area.entries) {
        entry.usedBy = entry.note ? linkedFrom.get(fileKey(entry.note)) || [] : [];
        entry.pdfs = entry.arxiv.filter((id) => pdfs.has(id)).map((id) => ({ id, pdf: pdfs.get(id) }));
      }
    }
  }

  // -------------------------------------------- what each topic cites, and the flow ---
  const folderChildren = new Map();
  for (const topic of topics.values()) {
    if (topic.parent === null || topic.parent === undefined) continue;
    const list = folderChildren.get(topic.parent) || [];
    list.push(topic.id);
    folderChildren.set(topic.parent, list);
  }
  const scopeOf = (topic) => ({
    topicDir: path.dirname(topic.file),
    knowledge,
    library,
    branches: new Set((folderChildren.get(topic.id) || []).map((id) => fileKey(topics.get(id).file))),
  });
  for (const topic of topics.values()) {
    topic.counts = countGroups(topic.refs, scopeOf(topic));
    topic.counts.branches = (folderChildren.get(topic.id) || []).length;
    topic.pdfs = topic.refs.filter((ref) => ref.abs && fileType(ref.abs) === 'pdf' && !(library && isWithin(library, ref.abs))).map((ref) => ({ label: ref.text || path.basename(ref.abs), path: ref.abs }));
    topic.arxivLinks = [...new Set([...topic.arxiv, ...topic.refs.filter((ref) => ref.url && /arxiv\.org/i.test(ref.url)).map((ref) => (/(\d{4}\.\d{4,5})/.exec(ref.url) || [])[1]).filter(Boolean)])];
  }

  // The newest dated Current work entries across the whole research.
  const timeline = [];
  for (const topic of topics.values()) {
    for (const thread of topic.threads) if (thread.date) timeline.push({ id: topic.id, name: thread.name, status: thread.status, date: thread.date });
  }
  timeline.sort((a, b) => compareText(b.date, a.date) || compareText(a.name, b.name));

  // Links between topics that the tree does not already draw: the research's cross-connections.
  const web = new Map();
  for (const topic of topics.values()) {
    if (topic.id === '') continue;
    for (const ref of topic.refs) {
      if (!ref.abs || path.basename(ref.abs).toLowerCase() !== NOTE) continue;
      const other = topics.get(relPosix(root, path.dirname(ref.abs)));
      if (!other || other.id === '' || other.id === topic.id || other.parent === topic.id || topic.parent === other.id) continue;
      const pair = [topic.id, other.id].sort(compareText);
      web.set(pair.join('\u0000'), pair);
    }
  }

  for (const key of [...cache.keys()]) if (!seen.has(key)) cache.delete(key);

  return {
    root,
    rootFile,
    knowledge,
    library,
    title: rootNote.title,
    lead: rootNote.lead,
    rootThreads: rootNote.threads,
    directions,
    beside,
    topics,
    other,
    unreached,
    linkedFrom,
    timeline,
    web: [...web.values()],
    scopeOf,
    index: index ? { ...index, file: indexFile } : null,
    papers,
    scannedAt: Date.now(),
  };
}

/** The topic a note file belongs to, if it is a research.md the atlas knows. */
export function topicOfFile(atlas, file) {
  if (path.basename(file).toLowerCase() !== NOTE) return null;
  const id = relPosix(atlas.root, path.dirname(file));
  const topic = atlas.topics.get(id);
  return topic && fileKey(topic.file) === fileKey(file) ? topic : null;
}

// ---------------------------------------------------------------- parsers ---

function parseNote(text, stat, file) {
  const body = stripFrontmatter(text);
  const dir = path.dirname(file);
  const refs = noteRefs(body, dir);
  return {
    file,
    title: clip(noteTitle(body) || path.basename(dir) || 'Research', 200),
    lead: firstSentence(body, 320),
    threads: currentWork(body),
    sections: sections(body),
    links: refs.filter((ref) => ref.abs).map((ref) => ({ abs: ref.abs, anchor: ref.anchor })),
    refs,
    arxiv: arxivMentions(body),
    mtimeMs: stat.mtimeMs,
  };
}

/** Every link of a note with its text and the `##` section it sits in; web links keep their URL. */
export function noteRefs(body, dir) {
  const out = [];
  let section = '';
  let fence = false;
  for (const line of String(body).split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) {
      fence = !fence;
      continue;
    }
    if (fence) continue;
    const heading = /^##\s+(.+?)\s*#*\s*$/.exec(line);
    if (heading) {
      section = plain(heading[1]);
      continue;
    }
    for (const link of links(line)) {
      if (link.external) {
        if (/^https?:/i.test(link.target)) out.push({ url: link.target, text: link.text, section });
        continue;
      }
      if (!link.target) continue;
      out.push({ abs: path.resolve(dir, link.target), anchor: link.anchor, text: link.text, section });
    }
  }
  return out;
}

/** What a root block says about the topic it links: a table row's last cell, else the whole block. */
function contextOf(block) {
  const text = block.kind === 'row' && block.cells.length > 1 ? block.cells[block.cells.length - 1] : block.markdown;
  return clip(plain(text).replace(/\s+/g, ' '), 300);
}

function parseIndex(text, stat, file) {
  const body = stripFrontmatter(text);
  const dir = path.dirname(file);
  const local = (markdown) => {
    const link = links(markdown).find((l) => !l.external && l.target);
    return link ? path.resolve(dir, link.target) : '';
  };
  const areas = [];
  for (const section of sections(body)) {
    const entries = [];
    for (const table of tables(section.text)) {
      const column = (...names) => table.header.findIndex((h) => names.some((n) => h === n || h.startsWith(n)));
      const kind = column('kind');
      const scope = column('what it answers', 'scope', 'what');
      const note = column('note');
      const where = column('where to read', 'source', 'read');
      const support = column('support', 'state', 'review', 'status');
      const area = column('area');
      for (const cells of table.rows) {
        const cell = (i) => (i >= 0 && i < cells.length ? cells[i] : '');
        entries.push({
          title: clip(plain(cell(0)), 240),
          kind: clip(plain(cell(kind)), 80),
          scope: clip(plain(cell(scope) || cell(area)), 360),
          support: clip(plain(cell(support)), 160),
          note: local(cell(note)) || local(cell(0)),
          read: cell(where),
          arxiv: arxivMentions(cells.join(' ')),
        });
      }
    }
    const prose = withoutTables(section.text);
    areas.push({ heading: section.heading, slug: section.slug, entries, prose: prose.length > 0 ? prose : '' });
  }
  return { title: noteTitle(body) || 'Knowledge', lead: firstParagraph(opening(body), 400), areas, mtimeMs: stat.mtimeMs };
}

async function loadPapers(knowledge, library, parse) {
  const byKey = new Map();
  const get = (key) => {
    if (!byKey.has(key)) byKey.set(key, { key, title: '', map: '', sections: 0, pdf: '', versions: [] });
    return byKey.get(key);
  };
  if (library) {
    const versions = (await listDir(path.join(library, 'arxiv'))).filter((e) => e.isDirectory());
    const listed = await mapLimit(versions, 8, async (entry) => {
      const dir = path.join(library, 'arxiv', entry.name);
      const files = await listDir(dir);
      const pdf = files.find((f) => f.isFile() && f.name.toLowerCase() === 'paper.pdf') || files.find((f) => f.isFile() && f.name.toLowerCase().endsWith('.pdf'));
      return { version: entry.name, pdf: pdf ? path.join(dir, pdf.name) : '' };
    });
    for (const item of listed.filter(Boolean)) {
      const paper = get(paperKey(item.version));
      paper.versions.push(item.version);
      if (item.pdf) paper.pdf = item.pdf;
    }
  }
  if (knowledge) {
    const dir = path.join(knowledge, 'papers');
    const entries = await listDir(dir);
    await mapLimit(entries.filter((e) => e.isFile() && e.name.endsWith('.md')), 8, async (entry) => {
      const file = path.join(dir, entry.name);
      const read = await parse(file, (text) => ({ title: noteTitle(stripFrontmatter(text)).replace(/^\[[^\]]*\]\s*/, ''), forLinks: readingForLinks(text) }), 'paper-map');
      const paper = get(paperKey(entry.name.replace(/\.md$/, '')));
      paper.map = file;
      paper.title = clip((read && read.title) || '', 220);
      paper.forFiles = ((read && read.forLinks) || []).map((link) => path.resolve(dir, link));
    });
    await mapLimit(entries.filter((e) => e.isDirectory()), 8, async (entry) => {
      const count = (await listDir(path.join(dir, entry.name))).filter((f) => f.isFile() && f.name.endsWith('.md')).length;
      if (count > 0) get(paperKey(entry.name)).sections = count;
    });
  }
  return [...byKey.values()].sort((a, b) => compareText(b.key, a.key));
}

/** The topic notes a paper map says it is read for: the links after "For" in its "Why I'm reading it" line. */
export function readingForLinks(text) {
  const line = /\*\*Why I'm reading it\.\*\*([^\n]*)/.exec(String(text || ''));
  if (!line) return [];
  const out = [];
  for (const m of line[1].matchAll(/\bFor\s+\[[^\]]*\]\(\s*<?([^)\s>]+)>?\s*\)/g)) {
    try {
      out.push(decodeURIComponent(m[1].split('#')[0]));
    } catch {
      out.push(m[1].split('#')[0]);
    }
  }
  return out;
}

/** An arXiv key without its version; old-style ids keep their archive prefix. */
export function paperKey(value) {
  const text = String(value || '').trim();
  const modern = /^(\d{4}\.\d{4,5})(v\d+)?$/.exec(text);
  if (modern) return modern[1];
  const old = /^([a-z-]+(?:\.[A-Z]{2})?)[-_/](\d{7})(v\d+)?$/.exec(text);
  if (old) return `${old[1]}/${old[2]}`;
  return text.replace(/v\d+$/, '');
}

function knowledgeFromLinks(rootNote, root) {
  const link = rootNote.links.find((l) => path.basename(l.abs).toLowerCase() === 'index.md' && !isWithin(root, l.abs));
  return link ? path.dirname(link.abs) : '';
}

async function existingDir(dir) {
  if (!dir) return '';
  const stat = await statSafe(dir);
  return stat && stat.isDirectory() ? path.resolve(dir) : '';
}

async function scanForNotes(root, excludes, excluded) {
  const found = [];
  const walk = async (dir, level) => {
    if (level > SCAN_DEPTH) return;
    const entries = await listDir(dir);
    const subdirs = [];
    for (const entry of entries) {
      if (entry.isFile() && entry.name.toLowerCase() === NOTE && level > 0) found.push(path.join(dir, entry.name));
      if (entry.isDirectory() && !entry.name.startsWith('.') && !excludes.has(entry.name.toLowerCase())) subdirs.push(path.join(dir, entry.name));
    }
    await mapLimit(subdirs, 6, (sub) => (excluded(path.join(sub, NOTE)) ? undefined : walk(sub, level + 1)));
  };
  await walk(root, 0);
  return found;
}
