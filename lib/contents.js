/**
 * What a note links to, sorted the way a researcher looks for it: branches and
 * related topics, notes, papers and sources, manuscripts, reports and runs, code,
 * data and figures, the knowledge collection, folders and the web. Only the link
 * targets and their place are used; nothing is renamed or moved.
 */

import path from 'node:path';
import { fileKey, isWithin, mapLimit, relPosix, statSafe } from './fsutil.js';

export const GROUPS = [
  ['branches', 'Branches'],
  ['notes', 'Notes'],
  ['papers', 'Papers & sources'],
  ['writing', 'Manuscripts & talks'],
  ['reports', 'Reports & runs'],
  ['code', 'Code'],
  ['data', 'Data & figures'],
  ['knowledge', 'Knowledge'],
  ['topics', 'Related topics'],
  ['folders', 'Folders'],
  ['web', 'Web'],
];

const EXT = {
  markdown: ['.md', '.markdown'],
  pdf: ['.pdf'],
  tex: ['.tex', '.sty', '.cls'],
  bib: ['.bib'],
  notebook: ['.ipynb'],
  code: ['.py', '.jl', '.sh', '.bash', '.c', '.cc', '.cpp', '.cxx', '.h', '.hpp', '.f', '.f90', '.f95', '.m', '.r', '.rs', '.go', '.js', '.mjs', '.ts', '.lua', '.pl', '.wl', '.nb'],
  image: ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp'],
  video: ['.mp4', '.webm', '.mov', '.m4v'],
  audio: ['.mp3', '.wav', '.ogg', '.m4a'],
  table: ['.csv', '.tsv'],
  text: ['.txt', '.log', '.out', '.in', '.dat', '.json', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.srt', '.patch', '.diff', '.xml'],
  binary: ['.h5', '.hdf5', '.npz', '.npy', '.pkl', '.mat', '.zip', '.tar', '.gz', '.tgz', '.bz2', '.xz', '.7z', '.exe', '.bin', '.so', '.dll', '.o'],
};
const BY_EXT = new Map(Object.entries(EXT).flatMap(([type, list]) => list.map((ext) => [ext, type])));
const PAPER_HOSTS = /arxiv\.org|doi\.org|journals\.aps\.org|link\.aps\.org|nature\.com|science\.org|springer|wiley|iopscience|sciencedirect|tandfonline|ams\.org|projecteuclid|inspirehep|semanticscholar|openreview/i;
const WRITING = /[\\/](manuscripts?|drafts?|papers?-drafts?|talks?|slides|lectures?|writing|article|submission)[\\/]/i;
const REPORTS = /^(reports?|runs?|calculations?|analysis|results)\//i;

/** The kind of file a path names, from its extension; '' extension reads as a folder. */
export function fileType(file) {
  const ext = path.extname(String(file)).toLowerCase();
  if (!ext) return 'folder';
  return BY_EXT.get(ext) || 'other';
}

/** Types the reader shows inside Atlas, and those that can be edited there. */
export const READABLE = new Set(['markdown', 'pdf', 'tex', 'bib', 'code', 'notebook', 'image', 'video', 'audio', 'table', 'text', 'folder']);
export const EDITABLE_EXT = new Set(['.md', '.markdown', '.tex', '.bib', '.txt']);

/**
 * Sort one reference into its group. `scope` names the topic's folder, the knowledge
 * collection and library, and the topic's own branch notes.
 */
export function groupOf(ref, scope) {
  if (ref.url) {
    if (!/^https?:/i.test(ref.url)) return null;
    return PAPER_HOSTS.test(ref.url) ? { group: 'papers', type: /arxiv\.org/i.test(ref.url) ? 'arxiv' : 'doi' } : { group: 'web', type: 'url' };
  }
  const abs = ref.abs;
  const type = fileType(abs);
  const base = path.basename(abs).toLowerCase();
  if (base === 'research.md') return { group: scope.branches.has(fileKey(abs)) ? 'branches' : 'topics', type: 'topic' };
  if (scope.library && isWithin(scope.library, abs)) return { group: 'papers', type };
  if (scope.knowledge && isWithin(scope.knowledge, abs)) {
    return { group: /[\\/](papers|sources|library)[\\/]/i.test(abs) ? 'papers' : 'knowledge', type };
  }
  if (type === 'tex' || type === 'bib' || (type === 'pdf' && WRITING.test(abs))) return { group: 'writing', type };
  if (type === 'pdf') return { group: 'papers', type };
  if (type === 'markdown') {
    if (base === 'readme.md') return { group: fileKey(path.dirname(abs)) === fileKey(scope.topicDir) ? 'notes' : 'reports', type };
    const rel = relPosix(scope.topicDir, abs);
    if (REPORTS.test(rel)) return { group: 'reports', type };
    return { group: 'notes', type };
  }
  if (type === 'code' || type === 'notebook') return { group: 'code', type };
  if (type === 'folder') return { group: 'folders', type };
  return { group: 'data', type };
}

/** One entry per target (the first mention keeps its text and section), with how often it is cited. */
export function dedupe(refs) {
  const seen = new Map();
  for (const ref of refs) {
    const key = ref.url ? ref.url : fileKey(ref.abs);
    const hit = seen.get(key);
    if (hit) hit.count += 1;
    else seen.set(key, { ...ref, count: 1 });
  }
  return [...seen.values()];
}

/** How many distinct targets of each group a note cites (no file access). */
export function countGroups(refs, scope) {
  const counts = {};
  for (const ref of dedupe(refs)) {
    const kind = groupOf(ref, scope);
    if (kind) counts[kind.group] = (counts[kind.group] || 0) + 1;
  }
  return counts;
}

/** The grouped contents of one note, each file checked for existence. */
export async function contentsOf(refs, scope) {
  const items = [];
  for (const ref of dedupe(refs)) {
    const kind = groupOf(ref, scope);
    if (!kind) continue;
    items.push({
      group: kind.group,
      type: kind.type,
      label: labelOf(ref),
      path: ref.abs || '',
      url: ref.url || '',
      anchor: ref.anchor || '',
      shown: ref.abs ? relPosix(scope.topicDir, ref.abs) || shortPath(ref.abs) : hostOf(ref.url),
      section: ref.section || '',
      count: ref.count,
      exists: null,
    });
  }
  await mapLimit(items.filter((item) => item.path), 8, async (item) => {
    const stat = await statSafe(item.path);
    item.exists = Boolean(stat);
    if (stat && stat.isDirectory()) item.type = 'folder';
    else if (stat && item.type === 'folder') item.type = 'text';
    if (item.type === 'folder' && item.group !== 'folders' && item.group !== 'branches' && item.group !== 'topics' && item.group !== 'knowledge' && item.group !== 'papers') item.group = 'folders';
  });
  const groups = [];
  for (const [key, title] of GROUPS) {
    const list = items.filter((item) => item.group === key);
    if (list.length > 0) groups.push({ key, title, items: list });
  }
  return groups;
}

function labelOf(ref) {
  const text = String(ref.text || '').replace(/\s+/g, ' ').trim();
  if (text && !/^(here|this|link|see|pdf|\.\/?|[\d.]+)$/i.test(text)) return text.length > 160 ? text.slice(0, 157) + '…' : text;
  if (ref.url) return ref.url.replace(/^https?:\/\//, '');
  return path.basename(ref.abs) || ref.abs;
}

function hostOf(url) {
  try {
    const parsed = new URL(url);
    return parsed.host + (parsed.pathname.length > 1 ? parsed.pathname : '');
  } catch {
    return url;
  }
}

function shortPath(abs) {
  const parts = String(abs).replace(/\\/g, '/').split('/');
  return parts.slice(-3).join('/');
}
