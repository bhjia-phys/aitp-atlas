/**
 * LaTeX for the researcher's manuscripts, with the TeX installations this
 * computer has: TeX Live on Windows, and TeX Live inside WSL for files that
 * live there. A build runs the engine (and BibTeX when the document has a
 * bibliography) as often as LaTeX needs, leaves its products beside the source
 * as LaTeX always does, and reports the log's problems by file and line.
 * SyncTeX links a source line and a place in the PDF through the `synctex`
 * program of the same installation. Nothing runs with shell escape.
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import { promises as fsp } from 'node:fs';
import { listDir, readText, statSafe } from './fsutil.js';

export const ENGINE_LABEL = { pdflatex: 'pdfLaTeX', xelatex: 'XeLaTeX', lualatex: 'LuaLaTeX' };
const TOOLS = ['pdflatex', 'xelatex', 'lualatex', 'bibtex', 'biber', 'synctex'];
const RUN_TIMEOUT = 180000;
const OUTPUT_CAP = 1024 * 1024;

export function latexError(status, message) {
  return Object.assign(new Error(message), { statusCode: status });
}

// ------------------------------------------------------------------ paths ---

/** A Windows path into a WSL distribution, as that distribution sees it; null for other paths. */
export function wslPath(file) {
  const m = /^[\\/]{2}(?:wsl\.localhost|wsl\$)[\\/]([^\\/]+)((?:[\\/][^\\/]*)*)$/i.exec(String(file || ''));
  if (!m) return null;
  return { distro: m[1], linux: (m[2] || '/').replace(/\\/g, '/') || '/' };
}

/** A Linux path of a WSL distribution as Windows reaches it. */
export function fromWsl(distro, linux) {
  return `\\\\wsl.localhost\\${distro}${String(linux).replace(/\//g, '\\')}`;
}

/** A Windows drive path as WSL mounts it (C:\x → /mnt/c/x). */
export function mntPath(file) {
  const m = /^([a-zA-Z]):[\\/](.*)$/.exec(String(file || ''));
  return m ? `/mnt/${m[1].toLowerCase()}/${m[2].replace(/\\/g, '/')}` : null;
}

function fromMnt(linux) {
  const m = /^\/mnt\/([a-z])\/(.*)$/.exec(String(linux));
  return m ? `${m[1].toUpperCase()}:\\${m[2].replace(/\//g, '\\')}` : null;
}

// ---------------------------------------------------------------- running ---

/** Run a program; resolve with its exit code and (capped) output, never throwing for a non-zero exit. */
export function runProgram(command, args, { cwd, timeoutMs = RUN_TIMEOUT } = {}) {
  return new Promise((resolve) => {
    let out = '';
    let done = false;
    let child;
    const finish = (value) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve({ ...value, output: out });
    };
    try {
      child = spawn(command, args, { cwd, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (error) {
      resolve({ code: -1, error: error.message, output: '' });
      return;
    }
    const take = (chunk) => {
      if (out.length < OUTPUT_CAP) out += chunk.toString('utf8');
    };
    child.stdout.on('data', take);
    child.stderr.on('data', take);
    child.on('error', (error) => finish({ code: -1, error: error.message }));
    child.on('close', (code) => finish({ code }));
    const timer = setTimeout(() => {
      try {
        child.kill();
      } catch {
        // already gone
      }
      finish({ code: -1, error: `timed out after ${Math.round(timeoutMs / 1000)} s` });
    }, timeoutMs);
  });
}

function runIn(engine, tool, args, dir, timeoutMs) {
  if (engine.kind === 'wsl') {
    const where = engine.toLinux(dir);
    return runProgram('wsl.exe', ['-d', engine.distro, '--cd', where, '--exec', tool, ...args], { timeoutMs });
  }
  return runProgram(tool, args, { cwd: dir, timeoutMs });
}

// ---------------------------------------------------------------- engines ---

let windowsCache = null;
const wslCache = new Map();
const CACHE_MS = 10 * 60 * 1000;

async function windowsTex() {
  if (process.platform !== 'win32') return null;
  if (windowsCache && Date.now() - windowsCache.at < CACHE_MS) return windowsCache.value;
  const dirs = [];
  for (const drive of 'CDEFGHIJ') {
    for (const year of (await listDir(`${drive}:\\texlive`)).filter((e) => e.isDirectory() && /^\d{4}$/.test(e.name)).map((e) => e.name).sort().reverse()) {
      for (const sub of ['windows', 'win64', 'win32']) dirs.push(`${drive}:\\texlive\\${year}\\bin\\${sub}`);
    }
  }
  for (const entry of String(process.env.PATH || '').split(';').filter(Boolean)) dirs.push(entry);
  let value = null;
  for (const dir of dirs) {
    if (!(await statSafe(path.join(dir, 'pdflatex.exe')))) continue;
    const tools = {};
    for (const tool of TOOLS) if (await statSafe(path.join(dir, `${tool}.exe`))) tools[tool] = path.join(dir, `${tool}.exe`);
    const year = (/texlive[\\/](\d{4})/i.exec(dir) || [])[1];
    value = { kind: 'win', dir, tools, version: year ? `TeX Live ${year}` : /miktex/i.test(dir) ? 'MiKTeX' : 'TeX' };
    break;
  }
  windowsCache = { at: Date.now(), value };
  return value;
}

async function wslTex(distro) {
  const hit = wslCache.get(distro);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  const script = `for t in ${TOOLS.join(' ')}; do printf '%s=%s\\n' "$t" "$(command -v $t)"; done; pdflatex --version 2>/dev/null | head -n 1`;
  const r = await runProgram('wsl.exe', ['-d', distro, '--exec', 'sh', '-lc', script], { timeoutMs: 30000 });
  let value = null;
  if (r.code === 0) {
    const tools = {};
    for (const m of r.output.matchAll(/^(\w+)=(\/\S+)$/gm)) tools[m[1]] = m[2];
    const year = (/TeX Live (\d{4})/.exec(r.output) || [])[1];
    if (tools.pdflatex || tools.xelatex || tools.lualatex) value = { kind: 'wsl', distro, tools, version: year ? `TeX Live ${year}` : 'TeX' };
  }
  wslCache.set(distro, { at: Date.now(), value });
  return value;
}

/**
 * The engines that can build `file`: for a file inside WSL, that distribution's
 * TeX first; for a Windows file, Windows TeX first. Each says whether SyncTeX
 * (the `synctex` program) is there.
 */
export async function enginesFor(file, { fallbackDistro = '' } = {}) {
  const inWsl = wslPath(file);
  const distro = inWsl ? inWsl.distro : fallbackDistro;
  const [win, lin] = await Promise.all([windowsTex(), distro ? wslTex(distro) : Promise.resolve(null)]);
  const list = [];
  const add = (inst, where) => {
    if (!inst) return;
    for (const engine of ['pdflatex', 'xelatex', 'lualatex']) {
      if (!inst.tools[engine]) continue;
      list.push({
        id: `${inst.kind}:${engine}`,
        kind: inst.kind,
        engine,
        distro: inst.distro || '',
        label: `${ENGINE_LABEL[engine]} · ${inst.version} (${where})`,
        bin: inst.tools[engine],
        tools: { bibtex: inst.tools.bibtex || '', biber: inst.tools.biber || '', synctex: inst.tools.synctex || '' },
        sync: Boolean(inst.tools.synctex),
      });
    }
  };
  if (inWsl) {
    add(lin, 'WSL');
    add(win, 'Windows');
  } else {
    add(win, 'Windows');
    if (mntPath(file)) add(lin, 'WSL');
  }
  return list;
}

function withPaths(engine) {
  const toLinux = (dir) => {
    const w = wslPath(dir);
    return w ? w.linux : mntPath(dir) || dir;
  };
  const toWindows = (linux) => (engine.kind === 'wsl' ? (String(linux).startsWith('/mnt/') ? fromMnt(linux) : fromWsl(engine.distro, linux)) : linux);
  return { ...engine, toLinux, toWindows };
}

// -------------------------------------------------------------- main file ---

/**
 * The document a .tex file belongs to: itself when it has \documentclass, the
 * file a `% !TEX root = …` line names, or a file beside or above it that
 * \input / \include / \subfile's it.
 */
export async function mainFileOf(file) {
  const text = await readText(file, 512 * 1024);
  const magic = /^\s*%\s*!TEX\s+root\s*=\s*(.+?)\s*$/im.exec(text);
  if (magic) return path.resolve(path.dirname(file), magic[1]);
  if (/\\documentclass/.test(text)) return file;
  const stem = path.basename(file).replace(/\.tex$/i, '');
  for (const dir of [path.dirname(file), path.dirname(path.dirname(file))]) {
    for (const entry of (await listDir(dir)).filter((e) => e.isFile() && /\.tex$/i.test(e.name))) {
      const candidate = path.join(dir, entry.name);
      if (candidate === file) continue;
      const body = await readText(candidate, 512 * 1024);
      if (!/\\documentclass/.test(body)) continue;
      const pattern = new RegExp(`\\\\(?:input|include|subfile)\\s*\\{[^}]*${stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\.tex)?\\s*\\}`);
      if (pattern.test(body)) return candidate;
    }
  }
  return null;
}

// ------------------------------------------------------------------ builds ---

const building = new Map();

/** Build the document `file` belongs to with the chosen engine (or the first that fits). */
export async function build(file, engineId, options = {}) {
  const main = await mainFileOf(file);
  if (!main) throw latexError(422, 'This file is part of another document, and Atlas could not find which: open the main file, or add a line “% !TEX root = main.tex” at its top.');
  const engines = await enginesFor(main, options);
  const chosen = engines.find((e) => e.id === engineId) || engines[0];
  if (!chosen) throw latexError(503, 'No TeX installation was found on this computer or in WSL.');
  const key = path.resolve(main).toLowerCase();
  if (building.has(key)) return building.get(key);
  const job = runBuild(main, withPaths(chosen)).finally(() => building.delete(key));
  building.set(key, job);
  return job;
}

async function runBuild(main, engine) {
  const started = Date.now();
  const dir = path.dirname(main);
  const name = path.basename(main).replace(/\.tex$/i, '');
  const args = ['-interaction=nonstopmode', '-file-line-error', '-synctex=1', `${name}.tex`];
  const steps = [];
  const pass = async () => {
    const r = await runIn(engine, engine.bin, args, dir, RUN_TIMEOUT);
    steps.push({ tool: engine.engine, code: r.code, error: r.error || '' });
    return r;
  };
  const extra = [];
  const first = await pass();
  if (first.code === -1 && first.error && !(await statSafe(path.join(dir, `${name}.log`)))) {
    throw latexError(500, `${ENGINE_LABEL[engine.engine]} did not run: ${first.error}`);
  }
  const aux = await readText(path.join(dir, `${name}.aux`), 2 * 1024 * 1024);
  const wantsBiber = /\\abx@aux@/.test(aux) || Boolean(await statSafe(path.join(dir, `${name}.bcf`)));
  let reran = false;
  if (wantsBiber) {
    if (engine.tools.biber) {
      const b = await runIn(engine, engine.tools.biber, [name], dir, RUN_TIMEOUT);
      steps.push({ tool: 'biber', code: b.code, error: b.error || '' });
      await pass();
      reran = true;
    } else {
      extra.push({ severity: 'error', file: main, line: 0, message: `This document uses biblatex with biber, which is not installed in ${engine.kind === 'wsl' ? 'WSL' : 'Windows'} TeX; citations stay unresolved.` });
    }
  } else if (/\\bibdata\{/.test(aux)) {
    if (engine.tools.bibtex) {
      const b = await runIn(engine, engine.tools.bibtex, [name], dir, RUN_TIMEOUT);
      steps.push({ tool: 'bibtex', code: b.code, error: b.error || '' });
      const blg = await readText(path.join(dir, `${name}.blg`), 512 * 1024);
      for (const m of blg.matchAll(/^Warning--(.+)$/gm)) extra.push({ severity: 'warning', file: '', line: 0, message: `BibTeX: ${m[1].trim()}` });
      for (const m of blg.matchAll(/^(I couldn't open [^\n]+|I found no [^\n]+|Repeated entry[^\n]*)/gm)) extra.push({ severity: 'error', file: '', line: 0, message: `BibTeX: ${m[1].trim()}` });
      await pass();
      reran = true;
    }
  }
  let log = await readText(path.join(dir, `${name}.log`), 4 * 1024 * 1024);
  for (let i = 0; i < 2 && (reran || needsRerun(log)); i += 1) {
    reran = false;
    if (!needsRerun(log) && i > 0) break;
    await pass();
    log = await readText(path.join(dir, `${name}.log`), 4 * 1024 * 1024);
  }
  const parsed = parseLog(log, { dir, toWindows: engine.kind === 'wsl' ? engine.toWindows : null });
  const pdf = path.join(dir, `${name}.pdf`);
  const pdfStat = await statSafe(pdf);
  const problems = [...extra, ...parsed.problems];
  return {
    ok: Boolean(pdfStat) && !problems.some((p) => p.severity === 'error'),
    main,
    pdf: pdfStat ? pdf : '',
    pdfMtimeMs: pdfStat ? pdfStat.mtimeMs : 0,
    pages: parsed.pages,
    problems,
    engine: engine.id,
    label: engine.label,
    sync: engine.sync,
    steps,
    durationMs: Date.now() - started,
    at: Date.now(),
  };
}

export function needsRerun(log) {
  return /Rerun to get (cross-references|citations|outlines)|Label\(s\) may have changed|Please rerun LaTeX|There were undefined references\.[\s\S]{0,40}Rerun|\(rerunfilecheck\)\s+Rerun/i.test(String(log));
}

/**
 * Problems in a LaTeX log, with the file each sits in: `-file-line-error`
 * errors carry it; warnings take the file TeX was reading, followed from the
 * log's parentheses.
 */
export function parseLog(log, { dir = '', toWindows = null } = {}) {
  const text = String(log || '');
  const abs = (file) => {
    if (!file) return '';
    const clean = file.replace(/^"|"$/g, '');
    if (/^\//.test(clean) && toWindows) return toWindows(clean);
    if (/^[a-zA-Z]:[\\/]|^[\\/]{2}/.test(clean)) return path.normalize(clean);
    return dir ? path.join(dir, clean) : clean;
  };
  const problems = [];
  const seen = new Set();
  const push = (p) => {
    const key = `${p.severity}|${p.file}|${p.line}|${p.message}`;
    if (seen.has(key) || problems.length >= 200) return;
    seen.add(key);
    problems.push(p);
  };
  const stack = [];
  const lines = text.split(/\r?\n/);
  // After a box warning TeX prints the offending material, parentheses and all, up to a blank line:
  // those lines are skipped so that they do not upset which file is being read.
  let skipping = false;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (skipping) {
      if (!line.trim()) skipping = false;
      continue;
    }
    const fle = /^(.+?\.(?:tex|sty|cls|bib|bbl|ltx|def|cfg|clo)):(\d+): (.+)$/.exec(line);
    if (fle) {
      let message = fle[3].trim();
      const next = lines[i + 1] || '';
      if (/^l\.\d+/.test(next) || message.endsWith('.')) {
        // the message is complete
      } else if (next && !/^\s*$/.test(next) && !/^l\.\d+/.test(next)) {
        message += ' ' + next.trim();
      }
      push({ severity: 'error', file: abs(fle[1]), line: Number(fle[2]), message });
      continue;
    }
    const bang = /^! (.+)$/.exec(line);
    if (bang) {
      let lineNo = 0;
      for (let j = i + 1; j < Math.min(lines.length, i + 12); j += 1) {
        const l = /^l\.(\d+)/.exec(lines[j]);
        if (l) {
          lineNo = Number(l[1]);
          break;
        }
      }
      push({ severity: 'error', file: abs(stack[stack.length - 1] || ''), line: lineNo, message: bang[1].trim() });
      continue;
    }
    const warn = /^(?:LaTeX|Package (\S+)|Class (\S+)) Warning: (.*)$/.exec(line);
    if (warn) {
      let message = warn[3];
      for (let j = i + 1; j < Math.min(lines.length, i + 6) && lines[j] && /^\(\S+\)\s|^ /.test(lines[j]); j += 1) message += ' ' + lines[j].replace(/^\(\S+\)\s*/, '').trim();
      const at = /on input line (\d+)\.?/.exec(message);
      const who = warn[1] || warn[2];
      if (/^(Label\(s\) may have changed|There were undefined references|There were multiply-defined labels)/.test(message) && !at) {
        if (/undefined references/.test(message)) push({ severity: 'warning', file: '', line: 0, message: message.trim() });
        continue;
      }
      push({ severity: 'warning', file: abs(stack[stack.length - 1] || ''), line: at ? Number(at[1]) : 0, message: `${who ? who + ': ' : ''}${message.replace(/\s*on input line \d+\.?/, '').trim()}` });
      continue;
    }
    const box = /^(Overfull|Underfull) \\[hv]box \(([^)]*)\) (?:in paragraph|in alignment|detected|has occurred)(?: at lines? (\d+))?/.exec(line);
    if (box) {
      if (box[1] === 'Overfull') push({ severity: 'info', file: abs(stack[stack.length - 1] || ''), line: Number(box[3]) || 0, message: `Overfull box (${box[2]})` });
      skipping = true;
      continue;
    }
    // Follow which file TeX is reading: "(./sections/a.tex" opens one, a lone ")" closes it.
    for (const m of line.matchAll(/\(([^\s()]*)|\)/g)) {
      if (m[0] === ')') stack.pop();
      // Every "(" counts, so that a ")" closes what it opened; only a path is a file.
      else stack.push(/^(\.{0,2}\/|[a-zA-Z]:[\\/]|\/)\S*\.\w+$/.test(m[1]) || /\.tex$/i.test(m[1]) ? m[1] : '');
    }
  }
  const out = /Output written on .*?\((\d+) pages?/.exec(text);
  return { problems, pages: out ? Number(out[1]) : 0, rerun: needsRerun(text) };
}

// ----------------------------------------------------------------- SyncTeX ---

export function parseSynctex(output) {
  const records = [];
  let current = null;
  for (const line of String(output).split(/\r?\n/)) {
    const m = /^(\w+):(.*)$/.exec(line.trim());
    if (!m) continue;
    const [, key, value] = m;
    if (key === 'Output' || (key === 'Page' && current && current.Page !== undefined) || (key === 'Input' && current && current.Input !== undefined)) {
      current = {};
      records.push(current);
    }
    if (!current) {
      current = {};
      records.push(current);
    }
    current[key] = value;
  }
  return records;
}

/** Where a source line is in the PDF: page and box, in PDF points from the top left. */
export async function syncView(file, line, engineId, options = {}) {
  const main = (await mainFileOf(file)) || file;
  const engine = withPaths((await enginesFor(main, options)).find((e) => e.id === engineId && e.sync) || (await enginesFor(main, options)).find((e) => e.sync) || {});
  if (!engine.tools || !engine.tools.synctex) throw latexError(501, 'SyncTeX needs the synctex program, which this TeX installation lacks; build with TeX Live in WSL to use it.');
  const pdf = main.replace(/\.tex$/i, '.pdf');
  if (!(await statSafe(pdf))) throw latexError(404, 'Build the document first.');
  const dir = path.dirname(main);
  const input = engine.kind === 'wsl' ? engine.toLinux(file) : file;
  const output = engine.kind === 'wsl' ? engine.toLinux(pdf) : pdf;
  const r = await runIn(engine, engine.tools.synctex, ['view', '-i', `${Number(line) || 1}:0:${input}`, '-o', output], dir, 20000);
  const hit = parseSynctex(r.output).find((rec) => rec.Page);
  if (!hit) throw latexError(404, 'SyncTeX does not place that line in the PDF (it may produce no output, or the PDF is older than the source).');
  // x, y: the point SyncTeX gives for the line; box: the enclosing box (h, v at its baseline), for a highlight.
  return { pdf, page: Number(hit.Page), x: Number(hit.x), y: Number(hit.y), box: { x: Number(hit.h), y: Number(hit.v) - Number(hit.H), w: Number(hit.W), h: Number(hit.H) + Math.max(0, Number(hit.D) || 0) } };
}

/** Which source line produced a place in the PDF (PDF points from the top left). */
export async function syncEdit(pdf, page, x, y, engineId, options = {}) {
  const main = pdf.replace(/\.pdf$/i, '.tex');
  const engines = await enginesFor(main, options);
  const engine = withPaths(engines.find((e) => e.id === engineId && e.sync) || engines.find((e) => e.sync) || {});
  if (!engine.tools || !engine.tools.synctex) throw latexError(501, 'SyncTeX needs the synctex program, which this TeX installation lacks; build with TeX Live in WSL to use it.');
  const output = engine.kind === 'wsl' ? engine.toLinux(pdf) : pdf;
  const r = await runIn(engine, engine.tools.synctex, ['edit', '-o', `${Number(page)}:${Number(x).toFixed(2)}:${Number(y).toFixed(2)}:${output}`], path.dirname(pdf), 20000);
  const hit = parseSynctex(r.output).find((rec) => rec.Input && rec.Line);
  if (!hit) throw latexError(404, 'SyncTeX has no source for that place.');
  const input = hit.Input.replace(/\/\.\//g, '/');
  const file = engine.kind === 'wsl' ? engine.toWindows(path.posix.normalize(input)) : path.normalize(input);
  return { file, line: Math.max(1, Number(hit.Line) || 1) };
}

// ----------------------------------------------------------- bibliography ---

/** BibTeX entries: type, key and the fields a cite picker shows. */
export function parseBib(text) {
  const entries = [];
  const src = String(text || '');
  const re = /@(\w+)\s*\{\s*([^,\s]+)\s*,/g;
  let m;
  while ((m = re.exec(src))) {
    const type = m[1].toLowerCase();
    if (['comment', 'string', 'preamble'].includes(type)) continue;
    let depth = 1;
    let i = re.lastIndex;
    for (; i < src.length && depth > 0; i += 1) {
      if (src[i] === '{') depth += 1;
      else if (src[i] === '}') depth -= 1;
    }
    const body = src.slice(re.lastIndex, i - 1);
    re.lastIndex = i;
    const fields = {};
    const fieldRe = /(\w+)\s*=\s*/g;
    let f;
    while ((f = fieldRe.exec(body))) {
      let j = fieldRe.lastIndex;
      let value = '';
      if (body[j] === '{') {
        let d = 0;
        const start = j;
        for (; j < body.length; j += 1) {
          if (body[j] === '{') d += 1;
          else if (body[j] === '}') {
            d -= 1;
            if (d === 0) break;
          }
        }
        value = body.slice(start + 1, j);
        j += 1;
      } else if (body[j] === '"') {
        const end = body.indexOf('"', j + 1);
        value = body.slice(j + 1, end < 0 ? body.length : end);
        j = end < 0 ? body.length : end + 1;
      } else {
        const end = body.slice(j).search(/[,\n]/);
        value = body.slice(j, end < 0 ? body.length : j + end).trim();
        j = end < 0 ? body.length : j + end;
      }
      fields[f[1].toLowerCase()] = value.replace(/[{}]/g, '').replace(/\s+/g, ' ').trim();
      fieldRe.lastIndex = j;
    }
    entries.push({ type, key: m[2], title: fields.title || '', author: fields.author || '', year: fields.year || '', journal: fields.journal || fields.booktitle || '', eprint: fields.eprint || '', doi: fields.doi || '' });
  }
  return entries;
}

/** The .bib files a document names: \bibliography{a,b} or \addbibresource{refs.bib}. */
export function bibFilesOf(mainText, dir) {
  const files = [];
  for (const m of String(mainText).matchAll(/^[^%\n]*\\bibliography\s*\{([^}]+)\}/gm)) {
    for (const name of m[1].split(',').map((s) => s.trim()).filter(Boolean)) files.push(path.resolve(dir, /\.bib$/i.test(name) ? name : `${name}.bib`));
  }
  for (const m of String(mainText).matchAll(/^[^%\n]*\\addbibresource(?:\[[^\]]*\])?\s*\{([^}]+)\}/gm)) files.push(path.resolve(dir, m[1].trim()));
  return [...new Set(files)];
}

/** A BibTeX key in the INSPIRE style when INSPIRE has none: Surname:2022word. */
export function makeKey(authors, year, title, taken = new Set()) {
  const first = String((authors || [])[0] || 'anon');
  const surname = (first.includes(',') ? first.split(',')[0] : first.split(/\s+/).pop()).normalize('NFKD').replace(/[^A-Za-z-]/g, '') || 'Anon';
  const word = (String(title || '').toLowerCase().normalize('NFKD').replace(/[^a-z\s]/g, ' ').split(/\s+/).find((w) => w.length > 3 && !['from', 'with', 'into', 'over', 'the', 'and', 'for', 'theory'].includes(w)) || 'paper').slice(0, 8);
  let key = `${surname}:${year || ''}${word}`;
  for (let n = 0; taken.has(key); n += 1) key = `${surname}:${year || ''}${word}${String.fromCharCode(97 + n)}`;
  return key;
}

/** A BibTeX entry for an arXiv paper from its metadata, for when INSPIRE cannot supply one. */
export function arxivBibtex(meta, key) {
  const esc = (s) => String(s || '').replace(/[{}]/g, '');
  const lines = [
    `@article{${key},`,
    `    author = "${(meta.authors || []).map(esc).join(' and ')}",`,
    `    title = "{${esc(meta.title)}}",`,
    meta.journal ? `    journal = "${esc(meta.journal)}",` : '',
    meta.doi ? `    doi = "${esc(meta.doi)}",` : '',
    `    eprint = "${meta.id}",`,
    '    archivePrefix = "arXiv",',
    meta.primary ? `    primaryClass = "${meta.primary}",` : '',
    `    year = "${meta.year || ''}"`,
    '}',
  ];
  return lines.filter(Boolean).join('\n');
}
