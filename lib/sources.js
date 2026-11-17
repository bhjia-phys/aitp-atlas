/**
 * Papers and lectures from the web into the knowledge collection, kept the way
 * the collection already keeps them:
 *
 *   library/arxiv/<id>v<n>/paper.pdf        with paper.pdf.provenance.json
 *   library/arxiv/<id>v<n>/source.tar       the e-print as sent, unpacked into source/
 *   papers/<id>.md                          a paper map from templates/paper.md
 *   sources/<slug>.md                       a lecture or other source note
 *   library/lectures/<slug>/transcript.*    a transcript the researcher supplies
 *   library/discover.json                   saved searches and what was set aside
 *
 * Nothing existing is overwritten, and nothing is fetched until the researcher
 * asks: a lookup reads metadata only; Add downloads.
 */

import crypto from 'node:crypto';
import path from 'node:path';
import zlib from 'node:zlib';
import { promises as fsp } from 'node:fs';
import { isWithin, readText, relPosix, statSafe } from './fsutil.js';
import { webError } from './web.js';

const ARXIV_API = 'https://export.arxiv.org/api/query';
const ARXIV = 'https://arxiv.org';
const INSPIRE = 'https://inspirehep.net/api/literature';
const INSPIRE_FIELDS = 'control_number,citation_count,titles,authors.full_name,publication_info,dois,arxiv_eprints,earliest_date';
const META_CACHE = 10 * 60 * 1000;
const ARXIV_GAP = 3100;
const MB = 1024 * 1024;

const MODERN = /^(\d{4}\.\d{4,5})(v\d+)?$/;
const OLD = /^([a-z-]+(?:\.[A-Z]{2})?)\/(\d{7})(v\d+)?$/;

// --------------------------------------------------------------- identifiers ---

function arxivId(candidate) {
  const text = String(candidate || '').trim().replace(/\.pdf$/i, '');
  const m = MODERN.exec(text) || OLD.exec(text);
  if (!m) return null;
  return MODERN.test(text) ? { id: m[1], version: m[2] || '' } : { id: `${m[1]}/${m[2]}`, version: m[3] || '' };
}

/** What the researcher pasted: an arXiv ID or link, a DOI, or an INSPIRE record. */
export function parseIdentifier(input) {
  const text = String(input || '').trim().replace(/^<|>$/g, '');
  if (!text) return null;
  const link = /arxiv\.org\/(?:abs|pdf|e-print|src|html|format)\/([^?#\s]+)/i.exec(text);
  if (link) {
    const found = arxivId(link[1].replace(/\/$/, ''));
    return found ? { kind: 'arxiv', ...found } : null;
  }
  const prefixed = /^arxiv:\s*(\S+)$/i.exec(text);
  if (prefixed) {
    const found = arxivId(prefixed[1]);
    return found ? { kind: 'arxiv', ...found } : null;
  }
  const arxivDoi = /10\.48550\/arxiv\.(\S+)$/i.exec(text);
  if (arxivDoi) {
    const found = arxivId(arxivDoi[1]);
    if (found) return { kind: 'arxiv', ...found };
  }
  const bare = arxivId(text);
  if (bare) return { kind: 'arxiv', ...bare };
  const inspire = /inspirehep\.net\/(?:api\/)?literature\/(\d+)/i.exec(text);
  if (inspire) return { kind: 'inspire', recid: inspire[1] };
  const doi = /^(?:https?:\/\/(?:dx\.)?doi\.org\/|doi:\s*)?(10\.\d{4,9}\/\S+)$/i.exec(text);
  if (doi) return { kind: 'doi', doi: decodeURIComponent(doi[1]) };
  return null;
}

/** The folder name of an edition in library/arxiv: old-style IDs swap the slash. */
export function editionDir(id, version) {
  return `${String(id).replace('/', '_')}${version}`;
}

// --------------------------------------------------------------------- arXiv ---

function decodeXml(text) {
  return String(text)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}

const squash = (text) => decodeXml(text).replace(/\s+/g, ' ').trim();

function tagText(block, name) {
  const m = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`).exec(block);
  return m ? squash(m[1]) : '';
}

/** The entries of an arXiv API (Atom) answer. */
export function arxivEntries(xml) {
  const out = [];
  for (const m of String(xml).matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const block = m[1];
    const absolute = tagText(block, 'id');
    const parsed = arxivId((/arxiv\.org\/abs\/(.+)$/.exec(absolute) || [])[1]);
    const title = tagText(block, 'title');
    if (!parsed || !title || /\/api\/errors/.test(absolute)) continue;
    const published = tagText(block, 'published');
    out.push({
      id: parsed.id,
      version: parsed.version,
      latest: parsed.version,
      title,
      authors: [...block.matchAll(/<author>\s*<name>([\s\S]*?)<\/name>/g)].map((a) => squash(a[1])),
      summary: tagText(block, 'summary'),
      published,
      updated: tagText(block, 'updated'),
      year: published ? Number(published.slice(0, 4)) : 0,
      categories: [...block.matchAll(/<category[^>]*term="([^"]+)"/g)].map((c) => decodeXml(c[1])),
      primary: decodeXml((/<arxiv:primary_category[^>]*term="([^"]+)"/.exec(block) || [])[1] || ''),
      doi: tagText(block, 'arxiv:doi'),
      journal: tagText(block, 'arxiv:journal_ref'),
      comment: tagText(block, 'arxiv:comment'),
    });
  }
  return out;
}

async function arxivEntry(web, id) {
  const xml = await web.text(`${ARXIV_API}?id_list=${encodeURIComponent(id)}`, { cacheMs: META_CACHE, gapMs: ARXIV_GAP });
  return arxivEntries(xml)[0] || null;
}

/** Saved-search words as an arXiv query: "a b · c d" asks for both phrases in a title or abstract. */
export function arxivQuery(text) {
  const raw = String(text || '').trim();
  if (/\b(ti|abs|au|cat|all|co|jr):/i.test(raw) || /\s(AND|OR|ANDNOT)\s/.test(raw)) return raw;
  const phrases = raw.split(/\s*[·,;]\s*/).map((p) => p.replace(/["()]/g, '').trim()).filter(Boolean);
  return phrases.map((p) => (/\s/.test(p) ? `(ti:"${p}" OR abs:"${p}")` : `(ti:${p} OR abs:${p})`)).join(' AND ');
}

export async function searchArxiv(web, text, max = 8) {
  const query = arxivQuery(text);
  if (!query) throw webError(400, 'Say what to search for.');
  const url = `${ARXIV_API}?search_query=${encodeURIComponent(query)}&sortBy=submittedDate&sortOrder=descending&max_results=${Math.min(25, Math.max(1, Number(max) || 8))}`;
  return arxivEntries(await web.text(url, { cacheMs: META_CACHE, gapMs: ARXIV_GAP }));
}

// ------------------------------------------------------------------- INSPIRE ---

function inspireRecord(meta = {}) {
  const pub = (meta.publication_info || []).find((p) => p.journal_title) || null;
  const eprint = (meta.arxiv_eprints || [])[0];
  return {
    recid: String(meta.control_number || ''),
    // INSPIRE titles may carry MathML or HTML: keep their text.
    title: String(((meta.titles || [])[0] || {}).title || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(),
    authors: (meta.authors || []).map((a) => a.full_name).filter(Boolean),
    citations: Number(meta.citation_count) || 0,
    journal: pub ? [pub.journal_title, pub.journal_volume, pub.year ? `(${pub.year})` : '', pub.artid || pub.page_start || ''].filter(Boolean).join(' ') : '',
    doi: ((meta.dois || [])[0] || {}).value || '',
    arxiv: eprint ? eprint.value : '',
    year: pub && pub.year ? Number(pub.year) : Number(String(meta.earliest_date || '').slice(0, 4)) || 0,
    date: meta.earliest_date || '',
  };
}

async function inspireSearch(web, query, { size = 1, sort = '' } = {}) {
  const url = `${INSPIRE}?q=${encodeURIComponent(query)}&size=${size}&fields=${INSPIRE_FIELDS}${sort ? `&sort=${sort}` : ''}`;
  const data = await web.json(url, { cacheMs: META_CACHE, timeoutMs: 15000, maxBytes: 6 * MB });
  const hits = (data && data.hits) || {};
  return { total: Number(hits.total) || 0, records: (hits.hits || []).map((hit) => inspireRecord(hit.metadata)) };
}

/** INSPIRE's citation counts for arXiv papers, in one request. */
export async function citationCounts(web, ids) {
  const list = [...new Set(ids.map(String).filter((id) => arxivId(id)))].slice(0, 25);
  if (list.length === 0) return {};
  const { records } = await inspireSearch(web, list.map((id) => `arxiv:${id}`).join(' or '), { size: list.length });
  const out = {};
  for (const r of records) if (r.arxiv) out[r.arxiv] = { recid: r.recid, citations: r.citations, title: r.title };
  return out;
}

/** The most recent papers that cite an arXiv paper, by INSPIRE. */
export async function citingPapers(web, id, size = 5) {
  const own = await citationCounts(web, [id]);
  const record = own[id];
  if (!record) throw webError(404, `INSPIRE does not list arXiv:${id}.`);
  const { total, records } = await inspireSearch(web, `refersto:recid:${record.recid}`, { size: Math.min(25, size), sort: 'mostrecent' });
  return { id, recid: record.recid, citations: Math.max(total, record.citations), recent: records };
}

// -------------------------------------------------------------------- lookup ---

/** Where a paper already is: its library editions, its paper map, and the topics that cite it. */
export function libraryState(atlas, id) {
  const paper = (atlas.papers || []).find((p) => p.key === id) || null;
  const mentionedBy = [...atlas.topics.values()].filter((t) => (t.arxivLinks || []).includes(id) || (paper && (paper.usedBy || []).includes(t.id))).map((t) => ({ id: t.id, title: t.title, file: t.file }));
  return {
    inLibrary: paper && (paper.pdf || paper.map) ? { versions: paper.versions, pdf: paper.pdf, map: paper.map } : null,
    mentionedBy,
  };
}

/** Metadata for what was pasted; nothing is downloaded. */
export async function lookup(web, atlas, input) {
  let ident = parseIdentifier(input);
  if (!ident) throw webError(400, 'Give an arXiv ID or link, a DOI, or an INSPIRE link.');
  let inspire = null;
  if (ident.kind !== 'arxiv') {
    const query = ident.kind === 'doi' ? `doi:"${ident.doi}"` : `recid:${ident.recid}`;
    inspire = (await inspireSearch(web, query)).records[0] || null;
    if (!inspire) throw webError(404, ident.kind === 'doi' ? 'INSPIRE does not know this DOI.' : 'INSPIRE has no such record.');
    if (!inspire.arxiv) return { kind: 'record', ...inspire, inLibrary: null, mentionedBy: [] };
    ident = { kind: 'arxiv', id: inspire.arxiv, version: '' };
  }
  const entry = await arxivEntry(web, ident.id);
  if (!entry) throw webError(404, `arXiv has no paper ${ident.id}.`);
  if (ident.version && Number(ident.version.slice(1)) > Number(entry.latest.slice(1))) throw webError(404, `arXiv has no version ${ident.version} of ${ident.id}; the latest is ${entry.latest}.`);
  if (!inspire) inspire = (await citationCounts(web, [entry.id]).catch(() => ({})))[entry.id] || null;
  return {
    kind: 'arxiv',
    ...entry,
    version: ident.version || entry.latest,
    inspire: inspire ? { recid: inspire.recid, citations: inspire.citations } : null,
    ...libraryState(atlas, entry.id),
  };
}

// ---------------------------------------------------------------------- add ---

function libraryDir(atlas) {
  const dir = atlas.library || (atlas.knowledge ? path.join(atlas.knowledge, 'library') : '');
  if (!dir) throw webError(409, 'No knowledge collection was found, so there is no library to add to. Set `knowledge` in the Atlas config.');
  return dir;
}

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function writeNew(file, data) {
  await fsp.mkdir(path.dirname(file), { recursive: true });
  await fsp.writeFile(file, data, { flag: 'wx' });
}

function provenance(library, file, url, version, data) {
  return {
    path: relPosix(library, file),
    url,
    accessed: today(),
    version,
    bytes: data.length,
    sha256: crypto.createHash('sha256').update(data).digest('hex'),
  };
}

/**
 * Download an arXiv edition into the library: the PDF, and unless declined the
 * e-print source, each with its provenance record. An edition already there is
 * left as it is.
 */
export async function addArxiv(web, atlas, { id, version = '', source = true }) {
  const parsed = arxivId(`${id}${version}`);
  if (!parsed) throw webError(400, 'That is not an arXiv identifier.');
  let edition = parsed.version;
  if (!edition) edition = ((await arxivEntry(web, parsed.id)) || {}).latest || '';
  if (!edition) throw webError(404, `arXiv has no paper ${parsed.id}.`);
  const library = libraryDir(atlas);
  const dir = path.join(library, 'arxiv', editionDir(parsed.id, edition));
  const pdf = path.join(dir, 'paper.pdf');
  const result = { id: parsed.id, version: edition, dir, pdf, existed: false, source: null };
  if (await statSafe(pdf)) return { ...result, existed: true };
  const pdfUrl = `${ARXIV}/pdf/${parsed.id}${edition}`;
  const response = await web.get(pdfUrl, { timeoutMs: 180000, maxBytes: 120 * MB, accept: 'application/pdf' });
  if (response.status !== 200) throw webError(502, `arXiv answered ${response.status} for the PDF.`);
  if (response.body.subarray(0, 5).toString('latin1') !== '%PDF-') throw webError(502, 'arXiv did not send a PDF (it may still be preparing it); try again in a few minutes.');
  await writeNew(pdf, response.body);
  await writeNew(pdf + '.provenance.json', JSON.stringify(provenance(library, pdf, pdfUrl, edition, response.body), null, 2) + '\n');
  if (source) result.source = await addSource(web, library, dir, parsed.id, edition).catch((error) => ({ error: error.message }));
  return result;
}

/**
 * An arXiv edition's PDF for reading inside Atlas, without adding it to the library: fetched
 * through the configured proxy on the researcher's click, checked to be a PDF, never written.
 */
export async function readArxivPdf(web, input) {
  const parsed = arxivId(String(input || ''));
  if (!parsed) throw webError(400, 'That is not an arXiv identifier.');
  const key = `${parsed.id}${parsed.version || ''}`;
  const response = await web.get(`${ARXIV}/pdf/${key}`, { timeoutMs: 180000, maxBytes: 120 * MB, accept: 'application/pdf' });
  if (response.status !== 200) throw webError(502, `arXiv answered ${response.status} for the PDF.`);
  if (response.body.subarray(0, 5).toString('latin1') !== '%PDF-') throw webError(502, 'arXiv did not send a PDF (it may still be preparing it); try again in a few minutes.');
  return { key, body: response.body };
}

async function addSource(web, library, dir, id, edition) {
  const url = `${ARXIV}/e-print/${id}${edition}`;
  const response = await web.get(url, { timeoutMs: 240000, maxBytes: 200 * MB });
  if (response.status !== 200) return { error: `arXiv answered ${response.status} for the source.` };
  const payload = response.body;
  const tarFile = path.join(dir, 'source.tar');
  if (await statSafe(tarFile)) return { error: 'A source.tar is already there; left as it is.' };
  await writeNew(tarFile, payload);
  await writeNew(tarFile + '.provenance.json', JSON.stringify(provenance(library, tarFile, url, edition, payload), null, 2) + '\n');
  const unpacked = unpackSource(payload, id);
  let files = 0;
  const base = path.join(dir, 'source');
  for (const file of unpacked.files) {
    const target = safeJoin(base, file.name);
    if (!target) continue;
    try {
      await writeNew(target, file.data);
      files += 1;
    } catch {
      // A name this system cannot hold, or a duplicate: the archive keeps it.
    }
  }
  return { kind: unpacked.kind, files };
}

/** The files of an arXiv e-print: a (gzipped) tar, a gzipped single TeX file, or none for a PDF-only paper. */
export function unpackSource(payload, id = 'paper') {
  let data = payload;
  if (data[0] === 0x1f && data[1] === 0x8b) {
    try {
      data = zlib.gunzipSync(data, { maxOutputLength: 400 * MB });
    } catch {
      return { kind: 'unreadable', files: [] };
    }
  }
  if (isTar(data)) return { kind: 'tar', files: untar(data) };
  if (data.subarray(0, 5).toString('latin1') === '%PDF-') return { kind: 'pdf-only', files: [] };
  const head = data.subarray(0, 4096).toString('utf8');
  if (/\\(documentclass|documentstyle|begin\{document\}|input|section)/.test(head)) return { kind: 'single', files: [{ name: `${String(id).replace('/', '_')}.tex`, data }] };
  return { kind: 'unknown', files: [] };
}

function octal(bytes) {
  const text = bytes.toString('latin1').replace(/\0.*$/s, '').trim();
  return text ? parseInt(text, 8) || 0 : 0;
}

function cstr(bytes) {
  const end = bytes.indexOf(0);
  return bytes.subarray(0, end < 0 ? bytes.length : end).toString('utf8');
}

/** A tar header is recognised by its checksum, which also covers pre-POSIX archives. */
function isTar(data) {
  if (data.length < 512) return false;
  const header = data.subarray(0, 512);
  const stored = octal(header.subarray(148, 156));
  let sum = 0;
  for (let i = 0; i < 512; i += 1) sum += i >= 148 && i < 156 ? 32 : header[i];
  return stored > 0 && stored === sum;
}

/** Regular files of a tar archive; links, devices and anything outside the archive are skipped. */
export function untar(data, { maxFiles = 5000, maxBytes = 400 * MB } = {}) {
  const files = [];
  let offset = 0;
  let longName = '';
  let paxPath = '';
  let total = 0;
  while (offset + 512 <= data.length) {
    const header = data.subarray(offset, offset + 512);
    if (header.every((b) => b === 0)) break;
    const size = octal(header.subarray(124, 136));
    const flag = header[156] === 0 ? '0' : String.fromCharCode(header[156]);
    let name = cstr(header.subarray(0, 100));
    if (header.subarray(257, 262).toString('latin1') === 'ustar') {
      const prefix = cstr(header.subarray(345, 500));
      if (prefix) name = `${prefix}/${name}`;
    }
    const body = data.subarray(offset + 512, offset + 512 + size);
    offset += 512 + Math.ceil(size / 512) * 512;
    if (flag === 'L') {
      longName = cstr(body);
      continue;
    }
    if (flag === 'x') {
      const m = /(?:^|\n)\d+ path=([^\n]*)\n/.exec(body.toString('utf8'));
      paxPath = m ? m[1] : '';
      continue;
    }
    if (flag === 'g') continue;
    if (longName) name = longName;
    if (paxPath) name = paxPath;
    longName = '';
    paxPath = '';
    if (flag !== '0' && flag !== '7') continue;
    total += size;
    if (files.length >= maxFiles || total > maxBytes) throw webError(413, 'The source archive is too large to unpack here.');
    files.push({ name, data: Buffer.from(body) });
  }
  return files;
}

/** `name` inside `base`, or '' when it would leave it or cannot be a file name. */
export function safeJoin(base, name) {
  if (/^([a-zA-Z]:)?[\\/]/.test(String(name))) return '';
  const parts = String(name).replace(/\\/g, '/').split('/').filter((p) => p && p !== '.');
  if (parts.length === 0 || parts.some((p) => p === '..' || /^[a-zA-Z]:$/.test(p) || /[<>:"|?*\u0000-\u001f]/.test(p) || /[. ]$/.test(p))) return '';
  const abs = path.join(base, ...parts);
  return isWithin(base, abs) && abs !== path.resolve(base) ? abs : '';
}

// ------------------------------------------------------------ notes and maps ---

const BUILTIN_PAPER = `---
title: <paper title>
authors: []
year: <year>
arxiv: <id>v<n>
kind: paper
area: <area in index.md>
reading_depth: <located | AI-read | researcher-read>
close_reading: <none | partial | complete>
---

# <Title> (<id>v<n>)

**What it establishes.** <at its true strength>

**What it assumes.** <prerequisites, linked to atoms>

## Section notes

## Your reading
`;

/** Insert `line` at the end of the `## heading` section (an "[Imported]"-style label is allowed), or add the section. */
export function appendUnderHeading(text, heading, line) {
  const lines = String(text).replace(/\s+$/, '').split('\n');
  const wanted = heading.trim().toLowerCase();
  const isHeading = (l) => /^##\s/.test(l);
  const name = (l) => l.replace(/^##\s+/, '').replace(/^\[[^\]]*\]\s*/, '').trim().toLowerCase();
  const start = lines.findIndex((l) => isHeading(l) && name(l) === wanted);
  if (start < 0) return `${lines.join('\n')}\n\n## ${heading}\n\n${line}\n`;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (isHeading(lines[i]) || /^#\s/.test(lines[i])) {
      end = i;
      break;
    }
  }
  let last = end;
  while (last > start + 1 && !lines[last - 1].trim()) last -= 1;
  const before = lines.slice(0, last);
  const after = lines.slice(end);
  const lead = last === start + 1 ? [''] : before[before.length - 1].startsWith('- ') && line.startsWith('- ') ? [] : [''];
  return [...before, ...lead, line, ...(after.length ? ['', ...after] : [])].join('\n') + '\n';
}

/** A paper map from the collection's template, with what is known filled in and the rest left to read. */
export function fillPaperTemplate(template, meta, { why = '', topicLink = '', pdfLink = '', sourceLink = '' } = {}) {
  const edition = `${meta.id}${meta.version}`;
  const text = String(template).replace(/\r\n/g, '\n');
  const fm = /^---\n([\s\S]*?)\n---\n?/.exec(text);
  const set = (block, key, value) => (new RegExp(`^${key}:.*$`, 'm').test(block) ? block.replace(new RegExp(`^${key}:.*$`, 'm'), `${key}: ${value}`) : `${block}\n${key}: ${value}`);
  let front = fm ? fm[1] : '';
  front = set(front, 'title', JSON.stringify(meta.title));
  front = set(front, 'authors', JSON.stringify(meta.authors || []));
  front = set(front, 'year', meta.year || '""');
  front = set(front, 'arxiv', edition);
  front = set(front, 'kind', 'paper');
  if (/^area:/m.test(front)) front = set(front, 'area', '""');
  front = set(front, 'reading_depth', 'located');
  front = set(front, 'close_reading', 'none');
  let body = fm ? text.slice(fm[0].length) : text;
  const links = [`[arXiv ${edition}](https://arxiv.org/abs/${edition})`, pdfLink ? `[local PDF](${pdfLink})` : '', sourceLink ? `[TeX source](${sourceLink})` : ''].filter(Boolean).join(' · ');
  const editionLine = `**Edition.** ${links}.${meta.journal ? ` Published as ${meta.journal}.` : ''}`;
  if (/^# .*$/m.test(body)) body = body.replace(/^# .*$/m, `# ${meta.title} (${edition})\n\n${editionLine}`);
  else body = `# ${meta.title} (${edition})\n\n${editionLine}\n\n${body}`;
  let out = `---\n${front.replace(/^\n+/, '')}\n---\n\n${body.replace(/^\n+/, '')}`;
  const reason = String(why || '').trim().replace(/\s+/g, ' ');
  if (reason || topicLink) out = appendUnderHeading(out, 'Your reading', `**Why I'm reading it.** ${[reason && !/[.!?]$/.test(reason) ? `${reason}.` : reason, topicLink ? `For ${topicLink}.` : ''].filter(Boolean).join(' ')}`);
  return out.endsWith('\n') ? out : out + '\n';
}

function relLink(fromFile, toAbs) {
  return path.relative(path.dirname(fromFile), toAbs).split(path.sep).join('/').split('/').map(encodeURIComponent).join('/');
}

/** The paper map papers/<id>.md, created from the template unless it exists. */
export async function createPaperMap(atlas, meta, { why = '', topic = null } = {}) {
  if (!atlas.knowledge) throw webError(409, 'No knowledge collection was found, so there is nowhere for a paper map.');
  const file = path.join(atlas.knowledge, 'papers', `${String(meta.id).replace('/', '_')}.md`);
  if (await statSafe(file)) return { file, existed: true };
  const template = (await readText(path.join(atlas.knowledge, 'templates', 'paper.md'))) || BUILTIN_PAPER;
  const library = atlas.library || path.join(atlas.knowledge, 'library');
  const editionPath = path.join(library, 'arxiv', editionDir(meta.id, meta.version));
  const hasPdf = Boolean(await statSafe(path.join(editionPath, 'paper.pdf')));
  const hasSource = Boolean(await statSafe(path.join(editionPath, 'source')));
  const topicLink = topic && topic.file ? `[${String(topic.title || 'the topic').replace(/[[\]]/g, '')}](${relLink(file, topic.file)})` : '';
  const text = fillPaperTemplate(template, meta, {
    why,
    topicLink,
    pdfLink: hasPdf ? relLink(file, path.join(editionPath, 'paper.pdf')) : '',
    sourceLink: hasSource ? relLink(file, path.join(editionPath, 'source')) + '/' : '',
  });
  await writeNew(file, text);
  return { file, existed: false };
}

export function slugify(text, limit = 60) {
  return String(text || '').toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').slice(0, limit).replace(/-$/, '');
}

/** A link to a moment of a recording: YouTube and Bilibili take ?t=, other players #t=. */
export function momentUrl(url, seconds) {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  try {
    const u = new URL(url);
    if (/(^|\.)youtube\.com$|(^|\.)youtu\.be$|(^|\.)bilibili\.com$/.test(u.hostname)) {
      u.searchParams.set('t', `${s}`);
      return u.toString();
    }
    u.hash = `t=${s}`;
    return u.toString();
  } catch {
    return url;
  }
}

const TRANSCRIPT_EXT = new Set(['.vtt', '.srt', '.txt', '.md']);

/** A lecture recording as a source note, with the transcript the researcher supplied. */
export async function addLecture(atlas, { url, title, speaker = '', venue = '', why = '', topic = null, transcript = null }) {
  if (!atlas.knowledge) throw webError(409, 'No knowledge collection was found, so there is nowhere for a lecture note.');
  let link;
  try {
    link = new URL(String(url || ''));
  } catch {
    throw webError(400, 'Give the link to the recording.');
  }
  if (link.protocol !== 'https:' && link.protocol !== 'http:') throw webError(400, 'Give the web link to the recording.');
  const name = String(title || '').trim();
  if (!name) throw webError(400, 'Give the lecture a title.');
  const slug = slugify([speaker, name].filter(Boolean).join(' ')) || 'lecture';
  const file = path.join(atlas.knowledge, 'sources', `${slug}.md`);
  if (await statSafe(file)) throw webError(409, `A source note sources/${slug}.md already exists.`);
  let transcriptFile = '';
  if (transcript && transcript.text) {
    const ext = path.extname(String(transcript.name || '')).toLowerCase();
    if (!TRANSCRIPT_EXT.has(ext)) throw webError(415, 'A transcript is a .vtt, .srt, .txt or .md file.');
    transcriptFile = path.join(atlas.library || path.join(atlas.knowledge, 'library'), 'lectures', slug, `transcript${ext}`);
    if (await statSafe(transcriptFile)) throw webError(409, 'That lecture already has a transcript.');
  }
  const date = today();
  const host = link.hostname.replace(/^www\./, '');
  const lines = [
    '---',
    `title: ${JSON.stringify(name)}`,
    'kind: "source"',
    speaker ? `speaker: ${JSON.stringify(String(speaker).trim())}` : '',
    venue ? `venue: ${JSON.stringify(String(venue).trim())}` : '',
    `url: ${JSON.stringify(link.toString())}`,
    `added: "${date}"`,
    'reading_depth: "located"',
    '---',
    '',
    `# ${name}`,
    '',
    `**Recording.** [${venue ? String(venue).trim() : host}](${link.toString()})${speaker ? `, ${String(speaker).trim()}` : ''}. Added ${date}; not yet watched.`,
    '',
    transcriptFile ? `**Transcript.** [${path.basename(transcriptFile)}](${relLink(file, transcriptFile)}), as supplied, with its timestamps.` : '',
    `**Linking a moment.** A note points at a time in the recording with a link such as [12:30](${momentUrl(link.toString(), 750)}).`,
    '',
    '## Your reading',
    '',
  ].filter((l, i, all) => !(l === '' && all[i - 1] === ''));
  let text = lines.join('\n');
  const reason = String(why || '').trim().replace(/\s+/g, ' ');
  const topicLink = topic && topic.file ? `[${String(topic.title || 'the topic').replace(/[[\]]/g, '')}](${relLink(file, topic.file)})` : '';
  if (reason || topicLink) text = appendUnderHeading(text, 'Your reading', `**Why I'm watching it.** ${[reason && !/[.!?]$/.test(reason) ? `${reason}.` : reason, topicLink ? `For ${topicLink}.` : ''].filter(Boolean).join(' ')}`);
  await writeNew(file, text.endsWith('\n') ? text : text + '\n');
  if (transcriptFile) {
    const data = Buffer.from(String(transcript.text), 'utf8');
    await writeNew(transcriptFile, data);
    const library = atlas.library || path.join(atlas.knowledge, 'library');
    await writeNew(transcriptFile + '.provenance.json', JSON.stringify({ ...provenance(library, transcriptFile, link.toString(), 'transcript supplied by the researcher', data) }, null, 2) + '\n');
  }
  return { file, transcript: transcriptFile };
}

// -------------------------------------------------------------- saved searches ---

const DISCOVER_FILE = 'discover.json';

export function emptyDiscover() {
  return { version: 1, searches: [], dismissed: {}, seen: {} };
}

/** Saved searches, papers set aside and what was last seen, checked and bounded. */
export function cleanDiscover(value) {
  const out = emptyDiscover();
  const v = value && typeof value === 'object' ? value : {};
  for (const s of Array.isArray(v.searches) ? v.searches.slice(0, 200) : []) {
    const query = String((s && s.query) || '').trim().slice(0, 300);
    if (!query) continue;
    out.searches.push({ id: String(s.id || slugify(query, 40) || crypto.randomUUID()).slice(0, 80), query, topic: String(s.topic || '').slice(0, 1000), created: String(s.created || today()).slice(0, 10) });
  }
  const map = (m, limit) => Object.fromEntries(Object.entries(m && typeof m === 'object' ? m : {}).slice(-limit).map(([k, val]) => [String(k).slice(0, 120), typeof val === 'object' && val ? JSON.parse(JSON.stringify(val).slice(0, 2000)) : String(val).slice(0, 40)]));
  out.dismissed = map(v.dismissed, 5000);
  out.seen = map(v.seen, 2000);
  return out;
}

export async function readDiscover(atlas) {
  const dir = atlas.library || (atlas.knowledge ? path.join(atlas.knowledge, 'library') : '');
  if (!dir) return { ...emptyDiscover(), file: '' };
  const file = path.join(dir, DISCOVER_FILE);
  const text = await readText(file, 4 * MB);
  try {
    return { ...cleanDiscover(text ? JSON.parse(text) : null), file };
  } catch {
    return { ...emptyDiscover(), file, unreadable: true };
  }
}

export async function writeDiscover(atlas, value) {
  const dir = libraryDir(atlas);
  const file = path.join(dir, DISCOVER_FILE);
  const clean = cleanDiscover(value);
  await fsp.mkdir(dir, { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await fsp.writeFile(tmp, JSON.stringify(clean, null, 2) + '\n', 'utf8');
  await fsp.rename(tmp, file);
  return { ...clean, file };
}

export const UPLOAD_EXT = new Set(['.pdf', '.djvu', '.ps', '.ppt', '.pptx', '.key', '.odp', '.tex', '.bib', '.md', '.txt', '.vtt', '.srt', '.png', '.jpg', '.jpeg', '.svg', '.ipynb', '.py', '.nb', '.m', '.zip', '.gz', '.tar', '.epub']);

/** Where an upload may land: inside the research or the knowledge collection, under a usable name, never over a file. */
export async function uploadTarget(atlas, dir, name) {
  const base = path.resolve(String(dir || ''));
  const roots = [atlas.root, atlas.knowledge, atlas.library].filter(Boolean);
  if (!roots.some((r) => isWithin(r, base))) throw webError(403, 'Uploads go inside the research root or the knowledge collection.');
  const clean = String(name || '').replace(/[/\\]/g, '_').trim();
  const target = safeJoin(base, clean);
  if (!target || clean.startsWith('.')) throw webError(400, 'That is not a usable file name.');
  if (!UPLOAD_EXT.has(path.extname(clean).toLowerCase())) throw webError(415, 'Atlas takes papers, slides, notes, transcripts, figures and notebooks here.');
  if (await statSafe(target)) throw Object.assign(webError(409, `${clean} is already there.`), { exists: true });
  return target;
}
