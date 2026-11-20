// A lead supplies a pointer, never samples. The manifest describes ONE comparison
// table: column zero is the common x grid, all other columns use the SAME declared
// y unit, normalization and controls. Atlas plots the rows unchanged (no fitting,
// resampling, normalization or inference from prose). A report is not verification.
import path from 'node:path';
import { promises as fs, constants } from 'node:fs';
import { fileKey } from './fsutil.js';

const MAX_ROWS = 2000;
const LIMIT = { manifest: 16 * 1024, data: 256 * 1024, report: 512 * 1024 };
const suffix = { manifest: /[^/]+\.atlas-figure\.json$/i, data: /\.(csv|json)$/i, report: /\.(md|txt)$/i };
const fields = new Set(['kind','data','xLabel','xUnit','yLabel','yUnit','commonParameters','normalization','report']);
const fail = message => { throw Object.assign(new Error(message), { figureIssue: true }); };
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function relativeFile(input, kind) {
  if (typeof input !== 'string' || input.length > 640 || !suffix[kind].test(input) ||
      /[\\:%?*|#<>"\x00-\x1f\x7f]/.test(input) || input.split('/').some(s => !s || s !== s.trim() || /^[.]/.test(s) || /[.]$/.test(s) || /^(?:con|prn|aux|nul|conin\$|conout\$|(?:com|lpt)[1-9¹²³])(?:\.|$)/i.test(s))) {
    fail(`The ${kind} must be a safe workspace-relative ${kind === 'manifest' ? '*.atlas-figure.json' : kind === 'data' ? 'CSV or JSON' : 'Markdown or text'} file.`);
  }
  return input;
}

// Check the physical path and opened inode; never follow a junction, a symlink
// or a shared hard link. Bound the read itself, not just the initial size check.
async function readLocal(root, name, kind) {
  const abs = path.join(root, relativeFile(name, kind));
  let fh;
  try {
    const st = await fs.lstat(abs, { bigint: true });
    if (!st.isFile() || st.nlink !== 1n || fileKey(await fs.realpath(abs)) !== fileKey(abs)) fail(`The ${kind} is not a regular, unlinked workspace file.`);
    if (st.size > LIMIT[kind]) fail(`The ${kind} exceeds the ${LIMIT[kind] / 1024} KiB figure limit.`);
    fh = await fs.open(abs, constants.O_RDONLY | (constants.O_NOFOLLOW || 0) | (constants.O_NONBLOCK || 0));
    const same = s => s.dev === st.dev && s.ino === st.ino && s.nlink === 1n && s.size === st.size && s.mtimeNs === st.mtimeNs && s.ctimeNs === st.ctimeNs && s.isFile();
    if (!same(await fh.stat({bigint:true}))) fail(`The ${kind} changed while being opened. Try again.`);
    const size = Number(st.size), buffer = Buffer.alloc(size + 1);
    let used = 0;
    while (used < buffer.length) {
      const { bytesRead } = await fh.read(buffer, used, buffer.length - used, used);
      if (!bytesRead) break;
      used += bytesRead;
    }
    if (used !== size || !same(await fh.stat({bigint:true}))) fail(`The ${kind} changed while being read. Try again.`);
    let text;
    try { text = new TextDecoder('utf-8', {fatal:true}).decode(buffer.subarray(0,size)); } catch { fail(`The ${kind} is not UTF-8 text.`); }
    if (!text.trim() || text.includes('\0')) fail(`The ${kind} is empty or not text.`);
    return text;
  } catch (e) {
    if (e.figureIssue) throw e;
    fail(`The ${kind} is missing or unreadable in this workspace.`);
  } finally { await fh?.close(); }
}

// Reject obvious scaffolding, not grade scientific prose or bless its contents.
const placeholder = /^(?:unknown|tbd|todo|pending|placeholder|unspecified|n\/a|not (?:available|specified|yet recorded)|to (?:come|be determined)|[?….-]+)[.!]?$/i;
function label(value, field, max = 96) {
  if (typeof value !== 'string' || value.length > max || /[\x00-\x1f\x7f]/.test(value) || !value.trim() || placeholder.test(value.trim())) fail(`Declare ${field} before comparing curves.`);
  return value.trim();
}

function json(text, kind) {
  try { return JSON.parse(text); } catch { fail(`The ${kind} is not valid JSON.`); }
}

function csvTable(text) {
  // Deliberately small CSV dialect: quoted, single-line labels are supported;
  // data rows are decimal numeric fields, one row per shared sample. No formulas.
  const lines = text.trimEnd().split(/\r?\n/);
  if (lines.length > MAX_ROWS + 1) fail(`The dataset exceeds ${MAX_ROWS} rows.`);
  const split = s => {
    const fields = [], re = /(?:"((?:[^"]|"")*)"|([^",]*))(,|$)/gy;
    while (true) {
      const m = re.exec(s);
      if (!m || fields.length === 7) fail('Each CSV record needs one shared x and two to six curve columns.');
      fields.push(m[1] === undefined ? m[2].trim() : m[1].replaceAll('""','"'));
      if (!m[3]) return fields;
    }
  };
  const columns = split(lines[0]);
  const decimal = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;
  const rows = lines.slice(1).map(line => split(line).map(s => decimal.test(s) ? Number(s) : NaN));
  return { columns, rows };
}

function validateTable(input, xLabel) {
  if (!plain(input) || Object.keys(input).some(k => k !== 'columns' && k !== 'rows') || !Array.isArray(input.columns) || input.columns.length < 3 || input.columns.length > 7) fail('The dataset needs one shared x and two to six named curve columns.');
  const columns = input.columns.map(c => label(c, 'a short column name'));
  if (new Set(columns).size !== columns.length || columns[0] !== xLabel) fail('Column names must be distinct and the first must match the shared x label.');
  const { rows } = input;
  if (!Array.isArray(rows) || rows.length < 2 || rows.length > MAX_ROWS) fail(`Supply 2–${MAX_ROWS} complete sample rows.`);
  let ymin = Infinity, ymax = -Infinity;
  for (const [i,row] of rows.entries()) {
    if (!Array.isArray(row) || row.length !== columns.length || !row.every(Number.isFinite)) fail('Every curve needs a finite number at each shared x. No samples were filled in.');
    if (i && row[0] <= rows[i-1][0]) fail('Shared x samples must increase strictly; rows were not sorted or merged.');
    for (const y of row.slice(1)) { ymin = Math.min(ymin,y); ymax = Math.max(ymax,y); }
  }
  if (!Number.isFinite(ymax-ymin) || !Number.isFinite(rows.at(-1)[0]-rows[0][0])) fail('The numeric range is too large to display on a shared linear axis.');
  return { columns, rows, domain:{ x:[rows[0][0],rows.at(-1)[0]], y:[ymin,ymax] } };
}

/** Authenticated, on-demand GET only. Never return file bodies or partial series. */
export async function readInquiryFigure(root, source) {
  try {
    if (typeof root !== 'string' || !path.isAbsolute(root)) fail('A configured research workspace is required.');
    const manifest = json(await readLocal(root, source, 'manifest'), 'figure manifest');
    if (!plain(manifest) || Object.keys(manifest).some(k => !fields.has(k))) fail('The figure manifest has unrecognized fields or layout.');
    const { kind } = manifest;
    if (!['schematic','computed'].includes(kind)) fail('Label the figure as schematic or computed.');
    const metadata = {};
    for (const [k, name] of [['xLabel','the shared x label'],['yLabel','the shared y label'],['xUnit','the shared x unit'],['yUnit','the shared y unit'],['normalization','the common normalization'],['commonParameters','the common parameters']]) {
      const needed = kind === 'computed' || k.endsWith('Label');
      if (needed || manifest[k] != null) metadata[k] = label(manifest[k],name,k === 'commonParameters' || k === 'normalization' ? 480 : 96);
    }
    let report;
    if (kind === 'computed' && !manifest.report) fail('Computed curves require a replay or evidence report.');
    if (manifest.report != null) {
      report = relativeFile(manifest.report,'report');
      const text = await readLocal(root,report,'report');
      const body = text.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/,'');
      let comment = false;
      const substantive = body.split(/\r?\n/).some(line => {
        const s = line.trim();
        if (comment || s.startsWith('<!--')) { comment = !s.includes('-->'); return false; }
        return s && !/^#{1,6}(?:\s|$)/.test(s) && !placeholder.test(s) && !/^none[.]?$/i.test(s);
      });
      if (!substantive) fail('The cited report contains no replay or evidence text beyond headings or placeholders.');
    }
    const data = relativeFile(manifest.data,'data');
    if (/\.atlas-figure\.json$/i.test(data)) fail('The dataset must be separate from any figure manifest.');
    const text = await readLocal(root,data,'data');
    const table = validateTable(/\.csv$/i.test(data) ? csvTable(text) : json(text,'dataset'), metadata.xLabel);
    return { available:true, source, kind, ...metadata, data, ...(report ? {report} : {}), ...table };
  } catch (error) {
    return { available:false, limitation:error.figureIssue ? error.message : 'The comparison could not be read.' };
  }
}
