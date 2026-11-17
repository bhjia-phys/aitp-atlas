/**
 * The JSON API behind Atlas. Every request passes DSH's own browser
 * authentication (the signed cookie and Host/Origin check of the connection
 * service) when DSH provides it. Every path is checked against the research
 * root, the knowledge collection and the library. Files are written only by
 * `save`, which the researcher's own editor calls, with a conflict check.
 */

import path from 'node:path';
import { spawn } from 'node:child_process';
import { createReadStream, promises as fsp } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { topicOfFile } from './atlas.js';
import { contentsOf, EDITABLE_EXT, fileType } from './contents.js';
import { compareText, noteTitle, stripFrontmatter } from './markdown.js';
import { fileKey, isWithin, listDir, readText, relPosix, statSafe } from './fsutil.js';
import { createWeb } from './web.js';
import { createReview } from './review.js';
import { learnTopic, search } from './search.js';
import { arxivBibtex, bibFilesOf, build, enginesFor, mainFileOf, makeKey, parseBib, syncEdit, syncView, wslPath } from './latex.js';
import { addArxiv, addLecture, appendUnderHeading, citationCounts, citingPapers, createPaperMap, libraryState, lookup, parseIdentifier, readArxivPdf, readDiscover, searchArxiv, uploadTarget, writeDiscover } from './sources.js';

/** A Current work disposition that waits on the researcher (or the learner): the AITP Skills write `waiting on the researcher`. */
const WAITING = /^waiting on (the )?(researcher|learner|you)\b/i;

export const API = '/aitp-atlas/api';
const MAX_TEXT = 2 * 1024 * 1024;
const MAX_SAVE = 4 * 1024 * 1024;
const MAX_UPLOAD = 200 * 1024 * 1024;
const TEXT_TYPES = new Set(['markdown', 'tex', 'bib', 'code', 'notebook', 'table', 'text']);
const MIME = {
  '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.bmp': 'image/bmp', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.mov': 'video/quicktime', '.m4v': 'video/mp4', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4',
};
const VENDOR_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'vendor', 'pdfjs');
const VENDOR = { 'pdf.min.mjs': 'text/javascript; charset=utf-8', 'pdf.worker.min.mjs': 'text/javascript; charset=utf-8' };

export function routeTable(store) {
  const routes = [];
  const add = (method, name, handler, options = {}) => routes.push({ method, path: `${API}/${name}`, handler, ...options });
  const web = createWeb(store.settings || {});
  const review = createReview({ stateDir: (store.settings || {}).stateDir || '' });
  const fresh = (url) => ({ fresh: url.searchParams.has('fresh') });
  const target = (atlas, url) => {
    const abs = path.resolve(url.searchParams.get('path') || '');
    if (!allowed(atlas, abs)) throw httpError(403, 'That file is outside the research, the knowledge collection and the library.');
    return abs;
  };

  add('GET', 'overview', async (req, res, url) => {
    const settings = store.settings || {};
    send(res, 200, { ...overview(await store.get(fresh(url))), online: web.enabled, appearance: { theme: settings.theme || 'auto', themes: settings.themes || {} } });
  });

  add('GET', 'note', async (req, res, url) => {
    const atlas = await store.get(fresh(url));
    const abs = target(atlas, url);
    const stat = await statSafe(abs);
    if (!stat || !stat.isFile()) return send(res, 404, problem('No such file.'));
    const type = fileType(abs);
    if (!TEXT_TYPES.has(type)) return send(res, 415, problem('Not a text file.'));
    const text = await readText(abs, MAX_TEXT);
    const markdown = type === 'markdown';
    const topic = topicOfFile(atlas, abs);
    send(res, 200, {
      path: abs,
      shown: shownPath(atlas, abs),
      type,
      markdown,
      editable: EDITABLE_EXT.has(path.extname(abs).toLowerCase()) && stat.size <= MAX_SAVE && !(atlas.library && isWithin(atlas.library, abs)),
      title: markdown ? noteTitle(stripFrontmatter(text)) : '',
      body: markdown ? stripFrontmatter(text) : text,
      raw: markdown ? text : undefined,
      truncated: stat.size > MAX_TEXT,
      size: stat.size,
      mtimeMs: stat.mtimeMs,
      topic: topic ? await topicDetail(atlas, topic) : null,
      owner: ownerOf(atlas, abs),
      linkedFrom: (atlas.linkedFrom.get(fileKey(abs)) || []).map((id) => ref(atlas, id)),
    });
  });

  add('GET', 'raw', async (req, res, url) => {
    const atlas = await store.get();
    const abs = target(atlas, url);
    const type = MIME[path.extname(abs).toLowerCase()];
    if (!type) return send(res, 415, problem('This file type is not shown here.'));
    const stat = await statSafe(abs);
    if (!stat || !stat.isFile()) return send(res, 404, problem('No such file.'));
    streamFile(req, res, abs, stat.size, type);
  });

  add('GET', 'dir', async (req, res, url) => {
    const atlas = await store.get();
    const abs = target(atlas, url);
    const stat = await statSafe(abs);
    if (!stat || !stat.isDirectory()) return send(res, 404, problem('No such folder.'));
    const entries = [];
    for (const entry of await listDir(abs)) {
      if (entry.name.startsWith('.')) continue;
      const file = path.join(abs, entry.name);
      const info = await statSafe(file);
      entries.push({ name: entry.name, path: file, folder: entry.isDirectory(), type: entry.isDirectory() ? 'folder' : fileType(file), size: info ? info.size : 0, mtimeMs: info ? info.mtimeMs : 0 });
    }
    entries.sort((a, b) => (a.folder === b.folder ? compareText(a.name, b.name) : a.folder ? -1 : 1));
    const topic = topicOfFile(atlas, path.join(abs, 'research.md'));
    send(res, 200, { path: abs, shown: shownPath(atlas, abs), entries, topic: topic ? ref(atlas, topic.id) : null, owner: ownerOf(atlas, path.join(abs, 'x')) });
  });

  add('GET', 'knowledge', async (req, res, url) => {
    const atlas = await store.get(fresh(url));
    const refs = (ids) => ids.map((id) => ref(atlas, id));
    const byTopic = [...atlas.topics.values()]
      .filter((t) => t.id !== '' && (t.pdfs.length > 0 || t.arxivLinks.length > 0 || (t.readingFor || []).length > 0))
      .map((t) => ({ ...ref(atlas, t.id), direction: t.direction, pdfs: t.pdfs.slice(0, 60), arxiv: [...new Set([...t.arxivLinks, ...(t.readingFor || [])])] }))
      .sort((a, b) => compareText(a.title, b.title));
    send(res, 200, {
      knowledge: atlas.knowledge,
      library: atlas.library,
      index: atlas.index
        ? {
          file: atlas.index.file,
          title: atlas.index.title,
          lead: atlas.index.lead,
          areas: atlas.index.areas.map((area) => ({ heading: area.heading, slug: area.slug, prose: area.prose, entries: area.entries.map((entry) => ({ ...entry, usedBy: refs(entry.usedBy) })) })),
        }
        : null,
      papers: atlas.papers.map((paper) => ({ ...paper, usedBy: refs(paper.usedBy) })),
      byTopic,
    });
  });

  add('GET', 'vendor/pdf.min.mjs', (req, res) => serveVendor(res, 'pdf.min.mjs'));
  add('GET', 'vendor/pdf.worker.min.mjs', (req, res) => serveVendor(res, 'pdf.worker.min.mjs'));

  // The researcher's editor: create a note, or save one that has not changed on disk since it was opened.
  add('POST', 'save', async (req, res) => {
    const body = await readJson(req, MAX_SAVE + 64 * 1024);
    const atlas = await store.get();
    const abs = path.resolve(String(body.path || ''));
    const roots = [atlas.root, atlas.knowledge].filter(Boolean);
    if (!roots.some((dir) => isWithin(dir, abs)) || roots.some((dir) => fileKey(dir) === fileKey(abs))) return send(res, 403, problem('Atlas writes only inside the research root and the knowledge collection.'));
    if (atlas.library && isWithin(atlas.library, abs)) return send(res, 403, problem('The papers library is read-only here.'));
    if (!EDITABLE_EXT.has(path.extname(abs).toLowerCase())) return send(res, 415, problem('Only Markdown, LaTeX, BibTeX and plain-text files are edited here.'));
    if (path.basename(abs).startsWith('.') || /[<>:"|?*\u0000-\u001f]/.test(path.basename(abs))) return send(res, 400, problem('That is not a usable file name.'));
    const text = String(body.text ?? '');
    if (Buffer.byteLength(text, 'utf8') > MAX_SAVE) return send(res, 413, problem('The file is too large to save here.'));
    const current = await statSafe(abs);
    if (body.create) {
      if (current) return send(res, 409, { error: { message: 'A file with that name already exists.' }, exists: true });
      await fsp.mkdir(path.dirname(abs), { recursive: true });
      await fsp.writeFile(abs, text, { encoding: 'utf8', flag: 'wx' });
    } else {
      if (!current || !current.isFile()) return send(res, 404, problem('The file no longer exists.'));
      if (!body.overwrite && Math.abs(current.mtimeMs - Number(body.mtimeMs)) > 1) {
        return send(res, 409, { error: { message: 'The file changed on disk since you opened it.' }, conflict: true, mtimeMs: current.mtimeMs });
      }
      await fsp.writeFile(abs, text, 'utf8');
    }
    const saved = await statSafe(abs);
    store.invalidate();
    send(res, 200, { ok: true, path: abs, mtimeMs: saved ? saved.mtimeMs : Date.now(), size: saved ? saved.size : 0 });
  });

  // ------------------------------------------------ the web: arXiv and INSPIRE ---
  // Metadata only, for what the researcher looks up; Add is the one download.
  add('GET', 'web/lookup', async (req, res, url) => {
    send(res, 200, await lookup(web, await store.get(), url.searchParams.get('q') || ''));
  });

  add('GET', 'web/search', async (req, res, url) => {
    send(res, 200, { entries: await searchArxiv(web, url.searchParams.get('q') || '', Number(url.searchParams.get('max')) || 8) });
  });

  add('GET', 'web/citations', async (req, res, url) => {
    const ids = String(url.searchParams.get('arxiv') || '').split(',').map((s) => s.trim()).filter(Boolean);
    send(res, 200, { counts: await citationCounts(web, ids) });
  });

  add('GET', 'web/citing', async (req, res, url) => {
    send(res, 200, await citingPapers(web, String(url.searchParams.get('arxiv') || '').trim(), Number(url.searchParams.get('size')) || 5));
  });

  // Read an arXiv paper beside a note without adding it: its PDF passes through Atlas (and its proxy),
  // kept in memory for the last few papers read, never written to the library.
  const reading = new Map();
  add('GET', 'web/pdf', async (req, res, url) => {
    const wanted = String(url.searchParams.get('id') || '').trim();
    let paper = reading.get(wanted);
    if (!paper) {
      paper = await readArxivPdf(web, wanted);
      reading.set(wanted, paper);
      while (reading.size > 4) reading.delete(reading.keys().next().value);
    }
    res.statusCode = 200;
    res.setHeader('content-type', 'application/pdf');
    res.setHeader('content-length', String(paper.body.length));
    res.setHeader('cache-control', 'private, max-age=600');
    res.end(paper.body);
  });

  // Add an arXiv edition to the library (PDF, and the TeX source unless declined), and if asked start its paper map.
  add('POST', 'web/add', async (req, res) => {
    const body = await readJson(req);
    const atlas = await store.get();
    const added = await addArxiv(web, atlas, { id: String(body.id || ''), version: String(body.version || ''), source: body.source !== false });
    let map = null;
    if (body.note) {
      const meta = metaOf(body.meta, added) || (await lookup(web, atlas, `${added.id}${added.version}`));
      map = await createPaperMap(atlas, { ...meta, id: added.id, version: added.version }, { why: String(body.why || ''), topic: topicRef(atlas, body.topic) });
    }
    store.invalidate();
    send(res, 200, { ...added, map, ...libraryState(await store.get({ fresh: true }), added.id) });
  });

  // A paper map for a paper already in the library: from its arXiv metadata when that can be read.
  add('POST', 'paper-map', async (req, res) => {
    const body = await readJson(req);
    const atlas = await store.get();
    const id = String(body.id || '');
    const version = String(body.version || '');
    let meta = metaOf(body.meta, { id, version });
    if (!meta && web.enabled) meta = await lookup(web, atlas, `${id}${version}`).catch(() => null);
    const map = await createPaperMap(atlas, { title: id, authors: [], year: '', ...(meta || {}), id, version }, { why: String(body.why || ''), topic: topicRef(atlas, body.topic) });
    store.invalidate();
    send(res, 200, map);
  });

  add('GET', 'discover', async (req, res) => {
    send(res, 200, await readDiscover(await store.get()));
  });

  add('POST', 'discover/save', async (req, res) => {
    const body = await readJson(req, 2 * 1024 * 1024);
    send(res, 200, await writeDiscover(await store.get(), body));
  });

  // Add one line under a heading of a note (a passage kept from a PDF, a moment of a lecture).
  add('POST', 'append', async (req, res) => {
    const body = await readJson(req);
    const atlas = await store.get();
    const abs = path.resolve(String(body.path || ''));
    const roots = [atlas.root, atlas.knowledge].filter(Boolean);
    if (!roots.some((dir) => isWithin(dir, abs)) || (atlas.library && isWithin(atlas.library, abs))) return send(res, 403, problem('Atlas adds to notes inside the research root and the knowledge collection only.'));
    if (path.extname(abs).toLowerCase() !== '.md') return send(res, 415, problem('Only Markdown notes take added lines.'));
    const line = String(body.line || '').trim();
    if (!line || line.length > 8000) return send(res, 400, problem('Nothing to add.'));
    const current = await statSafe(abs);
    if (!current || !current.isFile()) return send(res, 404, problem('The note no longer exists.'));
    if (current.size > MAX_SAVE) return send(res, 413, problem('The note is too large to change here.'));
    const text = await fsp.readFile(abs, 'utf8');
    await fsp.writeFile(abs, appendUnderHeading(text, String(body.heading || 'Your reading'), line), 'utf8');
    const saved = await statSafe(abs);
    store.invalidate();
    send(res, 200, { ok: true, path: abs, mtimeMs: saved ? saved.mtimeMs : Date.now() });
  });

  // A file dropped into Atlas: a paper, slides, notes or a transcript, into a folder of the research or the collection.
  add('POST', 'upload', async (req, res, url) => {
    const atlas = await store.get();
    const target = await uploadTarget(atlas, url.searchParams.get('dir'), url.searchParams.get('name'));
    const data = await readBinary(req, MAX_UPLOAD);
    if (data.length === 0) return send(res, 400, problem('The file is empty.'));
    await fsp.mkdir(path.dirname(target), { recursive: true });
    await fsp.writeFile(target, data, { flag: 'wx' });
    store.invalidate();
    send(res, 200, { ok: true, path: target, size: data.length });
  }, { binary: true });

  // A lecture recording as a source note, with the transcript the researcher supplies.
  add('POST', 'lecture', async (req, res) => {
    const body = await readJson(req, 8 * 1024 * 1024);
    const atlas = await store.get();
    const made = await addLecture(atlas, { ...body, topic: topicRef(atlas, body.topic) });
    store.invalidate();
    send(res, 200, made);
  });

  // ------------------------------------------------------- search and learn ---
  add('GET', 'search', async (req, res, url) => {
    const kind = ['note', 'knowledge', 'paper'].includes(url.searchParams.get('kind')) ? url.searchParams.get('kind') : 'all';
    send(res, 200, await search(await store.get(), String(url.searchParams.get('q') || '').slice(0, 200), { kind }));
  });

  add('GET', 'learn', async (req, res, url) => {
    const atlas = await store.get();
    const topic = topicOfFile(atlas, path.resolve(String(url.searchParams.get('path') || '')));
    if (!topic) return send(res, 404, problem('That is not a topic note Atlas knows.'));
    send(res, 200, await learnTopic(atlas, topic));
  });

  // ----------------------------------------------- review of a discussion's edits ---
  const reviewable = (atlas, raw) => {
    const abs = path.resolve(String(raw || ''));
    if (![atlas.root, atlas.knowledge].filter(Boolean).some((dir) => isWithin(dir, abs)) || (atlas.library && isWithin(atlas.library, abs))) throw httpError(403, 'Atlas reviews notes inside the research root and the knowledge collection only.');
    if (!/\.(md|tex|bib)$/i.test(abs)) throw httpError(415, 'Atlas reviews Markdown, LaTeX and BibTeX files.');
    return abs;
  };
  /** What a discussion about these files is likely to edit: each one, and for a topic note its parent and branches. */
  const scopeFiles = (atlas, files) => {
    const out = [];
    for (const raw of files) {
      let abs;
      try {
        abs = reviewable(atlas, raw);
      } catch {
        continue;
      }
      out.push(abs);
      const topic = topicOfFile(atlas, abs);
      if (!topic) continue;
      const parent = topic.parent !== null && topic.parent !== undefined ? atlas.topics.get(topic.parent) : null;
      if (parent) out.push(parent.file);
      for (const id of topic.children || []) if (atlas.topics.get(id)) out.push(atlas.topics.get(id).file);
    }
    return [...new Map(out.map((f) => [fileKey(f), f])).values()];
  };

  add('POST', 'review/baseline', async (req, res) => {
    const body = await readJson(req);
    const atlas = await store.get();
    send(res, 200, { watching: await review.baseline(String(body.session || ''), scopeFiles(atlas, Array.isArray(body.files) ? body.files : [])) });
  });

  add('GET', 'review/changes', async (req, res, url) => {
    send(res, 200, await review.changes(String(url.searchParams.get('session') || '')));
  });

  add('POST', 'review/revert', async (req, res) => {
    const body = await readJson(req);
    const atlas = await store.get();
    const result = await review.revert(String(body.session || ''), reviewable(atlas, body.path), String(body.id || ''));
    store.invalidate();
    send(res, 200, result);
  });

  add('POST', 'review/keep', async (req, res) => {
    const body = await readJson(req);
    const atlas = await store.get();
    send(res, 200, await review.keep(String(body.session || ''), reviewable(atlas, body.path), String(body.id || '')));
  });

  add('POST', 'review/forget', async (req, res) => {
    const body = await readJson(req);
    await review.forget(String(body.session || ''));
    send(res, 200, { ok: true });
  });

  add('GET', 'review/pending', async (req, res, url) => {
    const atlas = await store.get();
    send(res, 200, { sessions: await review.pending(reviewable(atlas, url.searchParams.get('path'))) });
  });

  // ------------------------------------------------------------------ LaTeX ---
  const texFile = (atlas, raw, ext = '.tex') => {
    const abs = path.resolve(String(raw || ''));
    if (![atlas.root, atlas.knowledge].filter(Boolean).some((dir) => isWithin(dir, abs))) throw httpError(403, 'Atlas works on documents inside the research root and the knowledge collection only.');
    if (path.extname(abs).toLowerCase() !== ext) throw httpError(415, `Expected a ${ext} file.`);
    return abs;
  };
  const latexOptions = (atlas) => ({ fallbackDistro: (wslPath(atlas.root) || {}).distro || '' });
  const mapMeta = new Map();

  /** The library's papers as citations: key, title, authors and year, from each paper map's front matter. */
  const libraryCites = async (atlas) => {
    const out = [];
    for (const paper of atlas.papers) {
      let meta = { title: paper.title, authors: [], year: '' };
      if (paper.map) {
        const stat = await statSafe(paper.map);
        const cached = mapMeta.get(paper.map);
        if (cached && stat && cached.mtimeMs === stat.mtimeMs) meta = cached.meta;
        else {
          meta = { ...meta, ...frontMatter(await readText(paper.map, 16 * 1024)) };
          if (stat) mapMeta.set(paper.map, { mtimeMs: stat.mtimeMs, meta });
        }
      }
      out.push({ arxiv: paper.key, title: String(meta.title || paper.title || paper.key).replace(/^\[[^\]]*\]\s*/, ''), authors: Array.isArray(meta.authors) ? meta.authors : [], year: meta.year || '', pdf: paper.pdf, map: paper.map });
    }
    return out;
  };

  add('GET', 'latex/engines', async (req, res, url) => {
    const atlas = await store.get();
    const file = texFile(atlas, url.searchParams.get('path'));
    const main = await mainFileOf(file);
    const engines = await enginesFor(main || file, latexOptions(atlas));
    send(res, 200, { main, engines: engines.map(({ id, label, sync, kind, engine }) => ({ id, label, sync, kind, engine })) });
  });

  add('POST', 'latex/build', async (req, res) => {
    const body = await readJson(req);
    const atlas = await store.get();
    const result = await build(texFile(atlas, body.path), String(body.engine || ''), latexOptions(atlas));
    store.invalidate();
    send(res, 200, result);
  });

  add('GET', 'latex/sync/view', async (req, res, url) => {
    const atlas = await store.get();
    send(res, 200, await syncView(texFile(atlas, url.searchParams.get('path')), Number(url.searchParams.get('line')) || 1, url.searchParams.get('engine') || '', latexOptions(atlas)));
  });

  add('GET', 'latex/sync/edit', async (req, res, url) => {
    const atlas = await store.get();
    const pdf = texFile(atlas, url.searchParams.get('pdf'), '.pdf');
    const found = await syncEdit(pdf, url.searchParams.get('page'), url.searchParams.get('x'), url.searchParams.get('y'), url.searchParams.get('engine') || '', latexOptions(atlas));
    if (!allowed(atlas, found.file)) return send(res, 404, problem('That place comes from a file outside the research (a package or class).'));
    send(res, 200, found);
  });

  add('GET', 'latex/cite-index', async (req, res, url) => {
    const atlas = await store.get();
    const file = texFile(atlas, url.searchParams.get('path'));
    const main = (await mainFileOf(file)) || file;
    const bibs = bibFilesOf(await readText(main, 2 * 1024 * 1024), path.dirname(main));
    const entries = [];
    const files = [];
    for (const bib of bibs) {
      const stat = await statSafe(bib);
      files.push({ file: bib, exists: Boolean(stat) });
      if (stat) for (const entry of parseBib(await readText(bib, 4 * 1024 * 1024))) entries.push({ ...entry, bib });
    }
    send(res, 200, { main, bibs: files, entries, library: await libraryCites(atlas), online: web.enabled });
  });

  // Cite an arXiv paper: its BibTeX goes into the document's .bib unless an entry for it is there already.
  add('POST', 'latex/cite', async (req, res) => {
    const body = await readJson(req);
    const atlas = await store.get();
    const bib = texFile(atlas, body.bib, '.bib');
    if (atlas.library && isWithin(atlas.library, bib)) return send(res, 403, problem('The papers library is read-only here.'));
    const ident = parseIdentifier(String(body.arxiv || ''));
    if (!ident || ident.kind !== 'arxiv') return send(res, 400, problem('Expected an arXiv identifier.'));
    const current = await readText(bib, 4 * 1024 * 1024);
    const entries = parseBib(current);
    const have = entries.find((e) => e.eprint && e.eprint.replace(/v\d+$/, '') === ident.id);
    if (have) return send(res, 200, { key: have.key, added: false });
    const taken = new Set(entries.map((e) => e.key));
    let entry = '';
    let key = '';
    if (web.enabled) {
      try {
        const text = await web.text(`https://inspirehep.net/api/literature?q=${encodeURIComponent(`arxiv:${ident.id}`)}&size=1&format=bibtex`, { timeoutMs: 15000 });
        const m = /@\w+\{([^,\s]+),[\s\S]*?\n\}/.exec(text);
        if (m && !taken.has(m[1])) {
          entry = m[0];
          key = m[1];
        }
      } catch {
        // INSPIRE did not answer: the entry is made from the paper's metadata below.
      }
    }
    if (!entry) {
      const known = body.meta && typeof body.meta === 'object' && body.meta.title ? body.meta : web.enabled ? await lookup(web, atlas, ident.id).catch(() => null) : null;
      const meta = { id: ident.id, title: ident.id, authors: [], year: '', ...(known || {}) };
      key = makeKey(meta.authors, meta.year, meta.title, taken);
      entry = arxivBibtex({ ...meta, id: ident.id }, key);
    }
    await fsp.mkdir(path.dirname(bib), { recursive: true });
    await fsp.writeFile(bib, `${current.replace(/\s+$/, '')}${current.trim() ? '\n\n' : ''}${entry.trim()}\n`, 'utf8');
    store.invalidate();
    send(res, 200, { key, added: true });
  });

  add('POST', 'open', async (req, res) => {
    const body = await readJson(req);
    const atlas = await store.get();
    const abs = path.resolve(String(body.path || ''));
    if (!allowed(atlas, abs) || !(await statSafe(abs))) return send(res, 403, problem('That file is outside the research, the knowledge collection and the library.'));
    openWithSystem(abs);
    send(res, 200, { ok: true });
  });

  return routes;
}

// ---------------------------------------------------------------- payloads ---

function overview(atlas) {
  const topics = {};
  for (const topic of atlas.topics.values()) topics[topic.id] = brief(topic);
  const entries = atlas.index ? atlas.index.areas.reduce((n, area) => n + area.entries.length, 0) : 0;
  return {
    root: atlas.root,
    rootFile: atlas.rootFile,
    knowledge: atlas.knowledge,
    library: atlas.library,
    title: atlas.title,
    lead: atlas.lead,
    rootThreads: newestFirst(atlas.rootThreads).map((thread) => threadOf(atlas.rootFile, thread)),
    directions: atlas.directions,
    beside: atlas.beside,
    topics,
    other: atlas.other,
    unreached: atlas.unreached,
    timeline: atlas.timeline.slice(0, 40),
    web: atlas.web.slice(0, 120),
    counts: { topics: atlas.topics.size - 1, directions: atlas.directions.length, unreached: atlas.unreached.length, entries, papers: atlas.papers.length },
    pdfjs: true,
    scannedAt: atlas.scannedAt,
  };
}

function brief(topic) {
  const latest = newestFirst(topic.threads)[0];
  return {
    id: topic.id,
    file: topic.file,
    title: topic.title,
    lead: topic.lead,
    context: topic.context,
    place: topic.place,
    direction: topic.direction,
    parent: topic.parent,
    children: topic.children,
    reached: topic.reached,
    threads: topic.threads.length,
    waiting: topic.threads.filter((thread) => WAITING.test(thread.status || '')).map((thread) => threadOf(topic.file, thread)),
    counts: topic.counts || {},
    latest: latest ? { name: latest.name, status: latest.status, date: latest.date } : null,
    date: latest && latest.date ? latest.date : isoDate(topic.mtimeMs),
    dated: latest && latest.date ? 'entry' : 'file',
  };
}

async function topicDetail(atlas, topic) {
  const ancestors = [];
  for (let id = topic.parent; id !== null && id !== undefined && atlas.topics.has(id); id = atlas.topics.get(id).parent) {
    ancestors.unshift(ref(atlas, id));
    if (id === '') break;
  }
  const direction = atlas.directions.find((d) => d.slug === topic.direction)
    || (ancestors.length > 1 ? atlas.directions.find((d) => d.slug === (atlas.topics.get(ancestors[1].id) || {}).direction) : null);
  return {
    ...brief(topic),
    isRoot: topic.id === '',
    ancestors,
    directionHeading: direction ? direction.heading : '',
    directionSlug: direction ? direction.slug : '',
    children: topic.children.map((id) => brief(atlas.topics.get(id))),
    threads: newestFirst(topic.threads).map((thread) => threadOf(topic.file, thread)),
    contents: await contentsOf(topic.refs, atlas.scopeOf(topic)),
  };
}

function threadOf(file, thread) {
  const owner = thread.owner && !/^[a-z]+:/i.test(thread.owner) ? path.resolve(path.dirname(file), decodeSafe(thread.owner.split('#')[0])) : '';
  return { name: thread.name, status: thread.status, date: thread.date, markdown: thread.markdown, owner };
}

function ref(atlas, id) {
  const topic = atlas.topics.get(id);
  return topic ? { id, title: topic.title, file: topic.file } : { id, title: id, file: '' };
}

/** The deepest topic whose folder holds `abs`, so a document knows which topic it belongs to. */
function ownerOf(atlas, abs) {
  let best = null;
  for (const topic of atlas.topics.values()) {
    const dir = path.dirname(topic.file);
    if (isWithin(dir, abs) && (!best || dir.length > path.dirname(best.file).length)) best = topic;
  }
  return best ? { ...ref(atlas, best.id), direction: best.direction } : null;
}

function newestFirst(threads) {
  return [...threads].sort((a, b) => compareText(b.date, a.date));
}

/** The simple YAML front matter of a note: strings, numbers and JSON-style lists. */
function frontMatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(String(text || ''));
  const out = {};
  if (!m) return out;
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
    if (!kv) continue;
    const raw = kv[2].trim();
    try {
      out[kv[1]] = /^[\["{]/.test(raw) || /^-?\d+(\.\d+)?$/.test(raw) ? JSON.parse(raw) : raw;
    } catch {
      out[kv[1]] = raw.replace(/^"|"$/g, '');
    }
  }
  return out;
}

/** The topic a request names by its note's path, as a title and file. */
function topicRef(atlas, file) {
  if (!file) return null;
  const topic = topicOfFile(atlas, path.resolve(String(file)));
  return topic ? { title: topic.title, file: topic.file } : null;
}

/** Paper metadata the page already has (from its lookup), kept to what a paper map uses. */
function metaOf(meta, edition) {
  if (!meta || typeof meta !== 'object' || !meta.title) return null;
  return {
    id: edition.id,
    version: edition.version,
    title: String(meta.title).slice(0, 500),
    authors: Array.isArray(meta.authors) ? meta.authors.map(String).slice(0, 200) : [],
    year: Number(meta.year) || '',
    journal: meta.journal ? String(meta.journal).slice(0, 300) : '',
  };
}

function allowed(atlas, abs) {
  return [atlas.root, atlas.knowledge, atlas.library].filter(Boolean).some((dir) => isWithin(dir, abs));
}

function shownPath(atlas, abs) {
  for (const dir of [atlas.root, atlas.knowledge, atlas.library].filter(Boolean)) {
    if (isWithin(dir, abs)) return relPosix(path.dirname(dir), abs) || path.basename(abs);
  }
  return abs;
}

function isoDate(ms) {
  if (!ms) return '';
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function decodeSafe(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

// ------------------------------------------------------------------- HTTP ---

/**
 * Wrap a route handler: DSH's own authentication first, then the method, the
 * cross-site rule for POST, and errors mapped to JSON.
 */
export function handlerFor(route, connectionOf = () => undefined, { startedAt = 0, graceMs = 0 } = {}) {
  return async (req, res) => {
    try {
      const connection = connectionOf();
      if (connection && typeof connection.requestRejection === 'function') {
        const rejection = connection.requestRejection(req);
        if (rejection) return send(res, rejection, problem(rejection === 401 ? 'Open DSH from its own address to use Atlas.' : 'Forbidden.'));
      } else if (Date.now() - startedAt < graceMs) {
        // DSH mounts its sign-in service after the web server: until it is there, answer nothing.
        return send(res, 503, problem('DSH is still starting its sign-in; try again in a moment.'));
      } else if (!loopbackOnly(req)) {
        return send(res, 403, problem('Without DSH authentication Atlas answers only this computer.'));
      }
      if (req.method !== route.method && !(route.method === 'GET' && req.method === 'HEAD')) return send(res, 405, problem(`${route.method} only`));
      if (route.method === 'POST' && !crossSiteSafe(req, route.binary)) return send(res, 403, problem('Accepted only as JSON from the DSH page itself.'));
      await route.handler(req, res, new URL(req.url || '/', 'http://localhost'));
    } catch (error) {
      send(res, error && error.statusCode ? error.statusCode : 500, problem(error && error.message ? error.message : String(error)));
    }
  };
}

/** The fallback fence when DSH provides no authentication: a loopback Host, and a matching Origin when one is sent. */
function loopbackOnly(req) {
  const headers = req.headers || {};
  const host = String(headers.host || '');
  const name = host.replace(/:\d+$/, '').replace(/^\[|\]$/g, '').toLowerCase();
  if (!['127.0.0.1', 'localhost', '::1'].includes(name)) return false;
  if (!headers.origin || headers.origin === 'null') return true;
  try {
    return new URL(headers.origin).host === host;
  } catch {
    return false;
  }
}

/**
 * A cross-site page can post a form without a preflight, so a POST needs JSON
 * (or, for an upload, an octet stream: also never sent cross-site without one)
 * and, if sent, a matching Origin.
 */
function crossSiteSafe(req, binary = false) {
  const headers = req.headers || {};
  const type = String(headers['content-type'] || '').toLowerCase();
  if (!type.startsWith('application/json') && !(binary && type.startsWith('application/octet-stream'))) return false;
  const origin = headers.origin;
  if (!origin || origin === 'null') return true;
  try {
    const url = new URL(origin);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return true;
    return url.host === String(headers.host || '');
  } catch {
    return false;
  }
}

/** Stream a file, honouring a single byte range so PDFs and videos can seek. */
function streamFile(req, res, abs, size, type) {
  const range = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range || ''));
  let start = 0;
  let end = size - 1;
  if (range && (range[1] || range[2])) {
    if (range[1]) {
      start = Number(range[1]);
      end = range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    } else {
      start = Math.max(0, size - Number(range[2]));
    }
    if (start > end || start >= size) {
      res.statusCode = 416;
      res.setHeader('content-range', `bytes */${size}`);
      res.end();
      return;
    }
    res.statusCode = 206;
    res.setHeader('content-range', `bytes ${start}-${end}/${size}`);
  } else {
    res.statusCode = 200;
  }
  res.setHeader('content-type', type);
  res.setHeader('content-length', String(end - start + 1));
  res.setHeader('accept-ranges', 'bytes');
  res.setHeader('cache-control', 'no-store');
  res.setHeader('x-content-type-options', 'nosniff');
  // Shown inside Atlas only: if opened on its own, nothing in the file may run.
  res.setHeader('content-security-policy', "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; media-src 'self'; sandbox");
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  const stream = createReadStream(abs, { start, end });
  stream.on('error', () => res.destroy());
  stream.pipe(res);
}

async function serveVendor(res, name) {
  try {
    const data = await fsp.readFile(path.join(VENDOR_DIR, name));
    res.statusCode = 200;
    res.setHeader('content-type', VENDOR[name]);
    res.setHeader('cache-control', 'public, max-age=604800, immutable');
    res.setHeader('x-content-type-options', 'nosniff');
    res.end(data);
  } catch {
    send(res, 404, problem('PDF.js is not installed with Atlas.'));
  }
}

function httpError(status, message) {
  return Object.assign(new Error(message), { statusCode: status });
}

function problem(message) {
  return { error: { message } };
}

function send(res, status, value) {
  if (res.headersSent) return;
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(value));
}

async function readJson(req, limit = 64 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw httpError(413, 'Request too large.');
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch {
    throw httpError(400, 'Expected a JSON body.');
  }
}

async function readBinary(req, limit) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw httpError(413, `The file is larger than ${Math.round(limit / 1048576)} MB.`);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function openWithSystem(abs) {
  try {
    const child = process.platform === 'win32'
      ? spawn('rundll32.exe', ['url.dll,FileProtocolHandler', abs], { detached: true, stdio: 'ignore', windowsHide: true })
      : spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [abs], { detached: true, stdio: 'ignore' });
    child.on('error', (error) => console.warn('[aitp-atlas] open failed:', error.message));
    child.unref();
  } catch (error) {
    console.warn('[aitp-atlas] open failed:', error.message);
  }
}
