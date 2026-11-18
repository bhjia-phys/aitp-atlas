/**
 * The Write page: the LaTeX documents the research's notes link, newest first, each with its topic
 * and whether its PDF is built. A linked section file stands for the document it belongs to; a
 * standalone figure is not a document. Atlas reads what the notes link, never the whole tree (a
 * research tree also holds unpacked arXiv sources, figure files and old versions).
 */

import path from 'node:path';
import { topicOfFile } from './atlas.js';
import { fileKey, mapLimit, readText, statSafe } from './fsutil.js';
import { mainFileOf } from './latex.js';

const HEAD = 16 * 1024;
const heads = new Map();

/** The start of a LaTeX file, read once per change: whether it is a document, its class and title. */
async function headOf(file, stat) {
  const hit = heads.get(file);
  if (hit && hit.mtimeMs === stat.mtimeMs && hit.size === stat.size) return hit.value;
  const text = (await readText(file, HEAD).catch(() => '')) || '';
  const value = texHead(text);
  heads.set(file, { mtimeMs: stat.mtimeMs, size: stat.size, value });
  return value;
}

/** What the head of a LaTeX file says: `\documentclass` (and which), and `\title{...}` as plain text. */
export function texHead(text) {
  const body = String(text || '').replace(/(^|[^\\])%.*$/gm, '$1');
  const cls = /\\documentclass\s*(?:\[[^\]]*\])?\s*\{([^}]*)\}/.exec(body);
  const title = /\\title\s*(?:\[[^\]]*\])?\s*\{((?:[^{}]|\{[^{}]*\})*)\}/.exec(body);
  return {
    document: Boolean(cls) && !/^\s*standalone\s*$/.test(cls[1]),
    docClass: cls ? cls[1].trim() : '',
    title: title ? plainTitle(title[1]) : '',
  };
}

function plainTitle(tex) {
  return tex
    .replace(/\\\\/g, ' ')
    .replace(/\\[ ,;:!]/g, ' ')
    .replace(/---/g, '—')
    .replace(/--/g, '–')
    .replace(/\$([^$]*)\$/g, '$1')
    .replace(/\\(?:textbf|textit|textsc|emph|mathrm|mathbf|mathcal|mathbb|mathsf|mathit|text)\s*\{([^{}]*)\}/g, '$1')
    .replace(/\\[a-zA-Z@]+\*?/g, '')
    .replace(/[{}~]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The LaTeX documents the topics' notes link: `{ documents: [...] }`, newest first. */
export async function listWriting(atlas) {
  const linked = new Map();
  for (const topic of atlas.topics.values()) {
    for (const ref of topic.refs || []) {
      if (!ref.abs || path.extname(ref.abs).toLowerCase() !== '.tex') continue;
      const key = fileKey(ref.abs);
      if (!linked.has(key)) linked.set(key, { file: ref.abs, topics: [] });
      if (!linked.get(key).topics.includes(topic.id)) linked.get(key).topics.push(topic.id);
    }
  }
  const documents = new Map();
  await mapLimit([...linked.values()], 8, async ({ file, topics }) => {
    let stat = await statSafe(file);
    if (!stat || !stat.isFile()) return;
    let main = file;
    let head = await headOf(file, stat);
    if (!head.document) {
      // A section stands for its document; a figure or a fragment that belongs to none is left out.
      const found = await mainFileOf(file).catch(() => null);
      if (!found || fileKey(found) === fileKey(file)) return;
      stat = await statSafe(found);
      if (!stat || !stat.isFile()) return;
      head = await headOf(found, stat);
      if (!head.document) return;
      main = found;
    }
    const key = fileKey(main);
    if (documents.has(key)) {
      for (const id of topics) if (!documents.get(key).linkedBy.includes(id)) documents.get(key).linkedBy.push(id);
      return;
    }
    const pdfFile = main.replace(/\.tex$/i, '.pdf');
    const pdfStat = await statSafe(pdfFile);
    const owner = topicOfFile(atlas, main) || atlas.topics.get(topics[0]) || null;
    documents.set(key, {
      file: main,
      title: head.title || path.basename(main, path.extname(main)),
      docClass: head.docClass,
      mtimeMs: stat.mtimeMs,
      pdf: pdfStat && pdfStat.isFile() ? { path: pdfFile, mtimeMs: pdfStat.mtimeMs } : null,
      topic: owner ? { id: owner.id, title: owner.title, file: owner.file } : null,
      linkedBy: [...topics],
    });
  });
  return { documents: [...documents.values()].sort((a, b) => b.mtimeMs - a.mtimeMs) };
}
