/**
 * Small readers for the Markdown that AITP notes use: the title, the opening,
 * `##` sections, Current work entries, links, list items and tables. They read
 * structure; they never rewrite prose.
 */

/** The text without a leading YAML frontmatter block. */
export function stripFrontmatter(text) {
  const value = String(text ?? '');
  const match = /^---\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/.exec(value);
  return match ? value.slice(match[0].length) : value;
}

/** The first level-one heading, as plain text. */
export function noteTitle(body) {
  for (const line of lines(body)) {
    const match = /^#\s+(.+?)\s*#*\s*$/.exec(line);
    if (match) return plain(match[1]);
  }
  return '';
}

/** The opening: everything between the title and the first `##` heading. */
export function opening(body) {
  const out = [];
  let started = false;
  let fence = false;
  for (const line of lines(body)) {
    if (/^\s*(```|~~~)/.test(line)) fence = !fence;
    if (!fence && /^##\s/.test(line)) break;
    if (!started) {
      if (/^#\s/.test(line)) {
        started = true;
        continue;
      }
      if (line.trim() === '' || /^\s*<a\s+id=/.test(line)) continue;
      started = true;
    }
    out.push(line);
  }
  return out.join('\n').trim();
}

/** The first prose paragraph of some Markdown, as plain text: quotes, tables, lists and headings are skipped. */
export function firstParagraph(text, limit = 320) {
  const paragraph = String(text ?? '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .find((p) => p && !/^(#|\||>|[-*]\s|\d+\.\s|<a\s|```|~~~)/.test(p));
  return clip(plain(paragraph || '').replace(/\s+/g, ' '), limit);
}

/** The first sentence of a note's opening, as plain text. */
export function firstSentence(body, limit = 240) {
  const first = firstParagraph(opening(body), 4000);
  if (!first) return '';
  const match = /^(.+?[.!?])(\s|$)/.exec(first);
  return clip(match ? match[1] : first, limit);
}

/** `##` sections with their heading, slug and text. */
export function sections(body) {
  const result = [];
  let current = null;
  let fence = false;
  for (const line of lines(body)) {
    if (/^\s*(```|~~~)/.test(line)) fence = !fence;
    const match = !fence && /^##\s+(.+?)\s*#*\s*$/.exec(line);
    if (match) {
      current = { heading: plain(match[1]), slug: slugify(plain(match[1])), text: [] };
      result.push(current);
      continue;
    }
    if (current) current.text.push(line);
  }
  return result.map((section) => ({ ...section, text: section.text.join('\n').trim() }));
}

/** One section's text by heading (case-insensitive prefix). */
export function sectionText(body, heading) {
  const wanted = heading.toLowerCase();
  const found = sections(body).find((s) => s.heading.toLowerCase().startsWith(wanted));
  return found ? found.text : '';
}

const STATUS_WORD = /^(active|proposed|paused|blocked|waiting(?: on [a-z' ]+)?|open|done|concluded|running|pending|dormant|agreed|set aside|superseded)$/i;

/**
 * Current work entries: the top-level items of `## Current work`. Each has its
 * thread name (the bold lead without a trailing owner link), the owner link, a
 * status word when one leads the entry ("— active · 2026-11-07"), the latest
 * date it mentions and its Markdown.
 */
export function currentWork(body) {
  return blocks(sectionText(body, 'current work'))
    .filter((block) => block.kind === 'item')
    .map((block) => entryOf(block.markdown));
}

function entryOf(markdown) {
  const raw = markdown.trim();
  const bold = /^\*\*(.+?)\*\*\s*([\s\S]*)$/.exec(raw);
  const lead = bold ? bold[1] : '';
  const ownerLink = /\s*→\s*\[[^\]]*\]\(([^)\s]+)[^)]*\)\s*$/.exec(lead);
  const name = bold ? plain(ownerLink ? lead.slice(0, ownerLink.index) : lead) : plain(raw).split(/\s[—–]\s|:\s/)[0];
  const rest = (bold ? bold[2] : raw).replace(/^[—–:-]+\s*/, '');
  const dated = /^([^·\n]{1,40}?)\s*·\s*(20\d\d-\d\d-\d\d)/.exec(rest);
  const dates = [...raw.matchAll(/\b(20\d\d-\d\d-\d\d)\b/g)].map((m) => m[1]).sort();
  return {
    name: clip(name.trim(), 140),
    status: dated && STATUS_WORD.test(dated[1].trim()) ? dated[1].trim().toLowerCase() : '',
    date: dates.length ? dates[dates.length - 1] : '',
    owner: ownerLink ? ownerLink[1] : '',
    markdown: raw,
  };
}

/**
 * Blocks of a Markdown passage: table rows (with their cells), top-level list
 * items (with continuation lines) and paragraphs.
 */
export function blocks(text) {
  const out = [];
  let paragraph = [];
  let item = null;
  let fence = false;
  const flush = () => {
    if (item) out.push(item);
    item = null;
    if (paragraph.length) out.push({ kind: 'paragraph', markdown: paragraph.join(' ') });
    paragraph = [];
  };
  for (const line of lines(text)) {
    if (/^\s*(```|~~~)/.test(line)) {
      flush();
      fence = !fence;
      continue;
    }
    if (fence) continue;
    if (/^\s*\|/.test(line)) {
      flush();
      if (!isSeparator(line)) out.push({ kind: 'row', markdown: line.trim(), cells: splitRow(line) });
      continue;
    }
    const bullet = /^(?:[-*+]|\d+[.)])\s+(.*)$/.exec(line);
    if (bullet) {
      flush();
      item = { kind: 'item', markdown: bullet[1] };
      continue;
    }
    if (item && /^\s+\S/.test(line)) {
      item.markdown += '\n' + line.trim();
      continue;
    }
    if (line.trim() === '') {
      flush();
      continue;
    }
    if (item) flush();
    paragraph.push(line.trim());
  }
  flush();
  return out;
}

/** Pipe tables: their lower-cased plain header and their rows of Markdown cells. */
export function tables(text) {
  const all = lines(text);
  const out = [];
  for (let i = 0; i + 1 < all.length; i += 1) {
    if (!/^\s*\|/.test(all[i]) || !isSeparator(all[i + 1])) continue;
    const header = splitRow(all[i]).map((cell) => plain(cell).toLowerCase());
    const rows = [];
    let j = i + 2;
    for (; j < all.length && /^\s*\|/.test(all[j]); j += 1) rows.push(splitRow(all[j]));
    out.push({ header, rows });
    i = j - 1;
  }
  return out;
}

/** The text with its pipe tables removed. */
export function withoutTables(text) {
  return lines(text).filter((line) => !/^\s*\|/.test(line)).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** A table row's cells; pipes inside code, inline math or after a backslash do not split. */
export function splitRow(line) {
  let s = String(line).trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
  const cells = [];
  let cell = '';
  let code = false;
  let math = false;
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];
    if (ch === '\\' && s[i + 1] === '|') {
      cell += '|';
      i += 1;
      continue;
    }
    if (ch === '`') code = !code;
    else if (ch === '$' && !code) math = !math;
    if (ch === '|' && !code && !math) {
      cells.push(cell.trim());
      cell = '';
      continue;
    }
    cell += ch;
  }
  cells.push(cell.trim());
  return cells;
}

function isSeparator(line) {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(line);
}

/** Markdown links and images: `[text](target "title")`. */
export function links(body) {
  const out = [];
  const pattern = /!?\[((?:[^\[\]]|\[[^\]]*\])*)\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g;
  for (const match of String(body ?? '').matchAll(pattern)) {
    const raw = match[2];
    if (/^(https?:|mailto:|data:|#)/i.test(raw)) {
      out.push({ text: plain(match[1]), target: raw.startsWith('#') ? '' : raw, anchor: raw.startsWith('#') ? raw.slice(1) : '', external: !raw.startsWith('#') });
      continue;
    }
    const hash = raw.indexOf('#');
    out.push({ text: plain(match[1]), target: safeDecode(hash >= 0 ? raw.slice(0, hash) : raw), anchor: hash >= 0 ? raw.slice(hash + 1) : '', external: false });
  }
  return out;
}

/** arXiv identifiers mentioned in text, without version suffixes. */
export function arxivMentions(text) {
  const ids = new Set();
  for (const match of String(text ?? '').matchAll(/\b(\d{4}\.\d{4,5})(?:v\d+)?\b/g)) ids.add(match[1]);
  for (const match of String(text ?? '').matchAll(/\b((?:hep-th|hep-ph|hep-lat|gr-qc|cond-mat|quant-ph|math-ph|math\.[A-Z]{2}|nucl-th|astro-ph)\/\d{7})(?:v\d+)?\b/g)) ids.add(match[1]);
  return [...ids];
}

/** GitHub-style heading slug. */
export function slugify(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .trim()
    .replace(/\s/g, '-');
}

/** Inline Markdown removed: links keep their text, code keeps its content. */
export function plain(text) {
  return String(text ?? '')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[((?:[^\[\]]|\[[^\]]*\])*)\]\([^)]*\)/g, '$1')
    .replace(/<a\s+id="[^"]*"\s*><\/a>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/(^|[^*\w])\*(?!\s)([^*\n]+?)\*(?!\w)/g, '$1$2')
    .replace(/`([^`]+)`/g, '$1')
    .trim();
}

/** At most `limit` characters (code points), cut at a word boundary. */
export function clip(text, limit) {
  const value = String(text ?? '').trim();
  const chars = Array.from(value);
  if (chars.length <= limit) return value;
  const cut = chars.slice(0, limit - 1);
  const space = cut.lastIndexOf(' ');
  return (space > limit * 0.6 ? cut.slice(0, space) : cut).join('').replace(/[\s,;:.—–-]+$/, '') + '…';
}

/** Locale-independent order: case-insensitive first, then exact. */
export function compareText(a, b) {
  const x = String(a ?? '').toLowerCase();
  const y = String(b ?? '').toLowerCase();
  if (x !== y) return x < y ? -1 : 1;
  const p = String(a ?? '');
  const q = String(b ?? '');
  return p < q ? -1 : p > q ? 1 : 0;
}

function lines(body) {
  return String(body ?? '').split('\n').map((line) => (line.endsWith('\r') ? line.slice(0, -1) : line));
}

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
