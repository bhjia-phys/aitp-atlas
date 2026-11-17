/**
 * LaTeX: where a document's main file is, what its log says (by file and line),
 * how SyncTeX answers are read, how BibTeX is read and written, and, where TeX
 * Live is installed in WSL, a real build of a small document with SyncTeX both
 * ways.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { promises as fsp } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { arxivBibtex, bibFilesOf, build, enginesFor, fromWsl, mainFileOf, makeKey, mntPath, needsRerun, parseBib, parseLog, parseSynctex, syncEdit, syncView, wslPath } from '../lib/latex.js';

test('latex: WSL and Windows paths', () => {
  assert.deepEqual(wslPath('\\\\wsl.localhost\\Ubuntu2204\\home\\me\\paper\\main.tex'), { distro: 'Ubuntu2204', linux: '/home/me/paper/main.tex' });
  assert.deepEqual(wslPath('//wsl$/Debian/tmp'), { distro: 'Debian', linux: '/tmp' });
  assert.equal(wslPath('C:\\papers\\main.tex'), null);
  assert.equal(fromWsl('Ubuntu2204', '/home/me/main.tex'), '\\\\wsl.localhost\\Ubuntu2204\\home\\me\\main.tex');
  assert.equal(mntPath('D:\\work\\paper\\main.tex'), '/mnt/d/work/paper/main.tex');
});

const LOG = `This is pdfTeX, Version 3.141592653-2.6-1.40.22 (TeX Live 2022/dev/Debian) (preloaded format=pdflatex)
entering extended mode
(./main.tex
LaTeX2e <2021-11-15> patch level 1
(/usr/share/texlive/texmf-dist/tex/latex/base/article.cls
Document Class: article 2021/10/04 v1.4n Standard LaTeX document class
(/usr/share/texlive/texmf-dist/tex/latex/base/size10.clo))
(./sections/dynamics.tex
LaTeX Warning: Citation \`hal' on page 1 undefined on input line 4.

./sections/dynamics.tex:7: Undefined control sequence.
l.7 \\foo

)
Overfull \\hbox (12.3pt too wide) in paragraph at lines 10--12
[]\\OT1/cmr/m/n/10.95 text with a stray ) and ( paren

[1{/var/lib/texmf/fonts/map/pdftex/updmap/pdftex.map}] (./main.aux)

LaTeX Warning: There were undefined references.

 )
Output written on main.pdf (1 page, 23456 bytes).
SyncTeX written on main.synctex.gz.
`;

test('latex: problems by file and line, pages, and when to run again', () => {
  const dir = path.resolve('/doc');
  const { problems, pages } = parseLog(LOG, { dir });
  assert.equal(pages, 1);
  assert.deepEqual(problems.map((p) => [p.severity, p.file && path.relative(dir, p.file), p.line, p.message]), [
    ['warning', path.join('sections', 'dynamics.tex'), 4, "Citation `hal' on page 1 undefined"],
    ['error', path.join('sections', 'dynamics.tex'), 7, 'Undefined control sequence.'],
    ['info', 'main.tex', 10, 'Overfull box (12.3pt too wide)'],
    ['warning', '', 0, 'There were undefined references.'],
  ]);
  const wsl = parseLog('/home/me/paper/main.tex:3: Missing $ inserted.\nl.3 x^2\n', { dir: '\\\\wsl.localhost\\U\\home\\me\\paper', toWindows: (p) => fromWsl('U', p) });
  assert.equal(wsl.problems[0].file, '\\\\wsl.localhost\\U\\home\\me\\paper\\main.tex');
  // A Windows TeX log: "(pdftex.def)" opens and closes nothing that matters.
  const winLog = String.raw`(C:\papers\main.tex
(pdftex.def) note
(C:\papers\sec.tex
LaTeX Warning: Reference ` + "`x'" + String.raw` on page 1 undefined on input line 9.
)
)
`;
  const win = parseLog(winLog, { dir: String.raw`C:\papers` });
  assert.deepEqual(win.problems.map((p) => [p.file, p.line]), [[path.normalize(String.raw`C:\papers\sec.tex`), 9]]);
  assert.ok(needsRerun('LaTeX Warning: Label(s) may have changed. Rerun to get cross-references right.'));
  assert.ok(!needsRerun(LOG.replace('There were undefined references.', '')));
});

test('latex: SyncTeX answers', () => {
  const view = parseSynctex('This is SyncTeX command line utility, version 1.5\nSyncTeX result begin\nOutput:/d/main.pdf\nPage:5\nx:133.45\ny:240.12\nh:72.00\nv:240.12\nW:470.00\nH:9.96\nbefore:\noffset:0\nmiddle:\nafter:\nSyncTeX result end\n');
  assert.deepEqual([view[0].Page, view[0].h, view[0].v, view[0].W, view[0].H], ['5', '72.00', '240.12', '470.00', '9.96']);
  const edit = parseSynctex('SyncTeX result begin\nOutput:main.pdf\nInput:/home/me/paper/./sections/dynamics.tex\nLine:104\nColumn:-1\nOffset:0\nContext:\nSyncTeX result end\n');
  assert.equal(edit.find((r) => r.Input).Line, '104');
});

test('latex: bibliographies are read and keys made the INSPIRE way', () => {
  const bib = `@Article{haldane1988exact,
  author  = {Haldane, F. D. M.},
  title   = {Exact {Jastrow-Gutzwiller} resonating-valence-bond ground state},
  journal = "Phys. Rev. Lett.",
  year    = 1988,
}
@comment{ignored}
@article{Rabinovici:2022beu,
    author = "Rabinovici, E. and S\\'anchez-Garrido, A.",
    title = "{Krylov complexity from integrability to chaos}",
    eprint = "2207.07701",
    year = "2022"
}`;
  assert.deepEqual(parseBib(bib).map((e) => [e.key, e.title, e.year, e.journal, e.eprint]), [
    ['haldane1988exact', 'Exact Jastrow-Gutzwiller resonating-valence-bond ground state', '1988', 'Phys. Rev. Lett.', ''],
    ['Rabinovici:2022beu', 'Krylov complexity from integrability to chaos', '2022', '', '2207.07701'],
  ]);
  const dir = path.resolve('/doc');
  assert.deepEqual(bibFilesOf('\\bibliography{refs,extra}\n% \\bibliography{old}\n\\addbibresource{lib/more.bib}', dir), [path.join(dir, 'refs.bib'), path.join(dir, 'extra.bib'), path.join(dir, 'lib', 'more.bib')]);
  assert.equal(makeKey(['E. Rabinovici'], 2022, 'Krylov complexity from integrability to chaos'), 'Rabinovici:2022krylov');
  assert.equal(makeKey(['Rabinovici, E.'], 2022, 'Krylov complexity', new Set(['Rabinovici:2022krylov'])), 'Rabinovici:2022krylova');
  const entry = arxivBibtex({ id: '2207.07701', title: 'Krylov {complexity}', authors: ['E. Rabinovici', 'J. Sonner'], year: 2022, primary: 'hep-th' }, 'Rabinovici:2022krylov');
  assert.deepEqual(parseBib(entry).map((e) => [e.key, e.author, e.eprint, e.year]), [['Rabinovici:2022krylov', 'E. Rabinovici and J. Sonner', '2207.07701', '2022']]);
});

test('latex: a section file finds its document', async () => {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'atlas-tex-'));
  try {
    await fsp.mkdir(path.join(dir, 'sections'));
    await fsp.writeFile(path.join(dir, 'main.tex'), '\\documentclass{article}\n\\begin{document}\n\\input{sections/dynamics}\n\\end{document}\n');
    await fsp.writeFile(path.join(dir, 'sections', 'dynamics.tex'), '\\section{Dynamics}\n');
    await fsp.writeFile(path.join(dir, 'sections', 'appendix.tex'), '% !TEX root = ../main.tex\n\\section{Appendix}\n');
    await fsp.writeFile(path.join(dir, 'sections', 'loose.tex'), '\\section{Loose}\n');
    assert.equal(await mainFileOf(path.join(dir, 'main.tex')), path.join(dir, 'main.tex'));
    assert.equal(await mainFileOf(path.join(dir, 'sections', 'dynamics.tex')), path.join(dir, 'main.tex'));
    assert.equal(await mainFileOf(path.join(dir, 'sections', 'appendix.tex')), path.join(dir, 'main.tex'));
    assert.equal(await mainFileOf(path.join(dir, 'sections', 'loose.tex')), null);
  } finally {
    await fsp.rm(dir, { recursive: true, force: true });
  }
});

/** A WSL temporary folder as Windows reaches it, when WSL has TeX Live; otherwise null. */
function wslScratch() {
  if (process.platform !== 'win32') return null;
  try {
    const distro = execFileSync('wsl.exe', ['--exec', 'sh', '-c', 'command -v pdflatex >/dev/null && command -v synctex >/dev/null && echo "$WSL_DISTRO_NAME"'], { encoding: 'utf8', windowsHide: true, timeout: 30000 }).trim();
    if (!distro) return null;
    const linux = execFileSync('wsl.exe', ['-d', distro, '--exec', 'mktemp', '-d'], { encoding: 'utf8', windowsHide: true, timeout: 30000 }).trim();
    return { distro, linux, win: fromWsl(distro, linux) };
  } catch {
    return null;
  }
}

test('latex: a real build in WSL, with BibTeX, problems and SyncTeX both ways', { timeout: 240000 }, async (t) => {
  const scratch = wslScratch();
  if (!scratch) return t.skip('no TeX Live with synctex in WSL');
  try {
    const main = path.join(scratch.win, 'main.tex');
    await fsp.mkdir(path.join(scratch.win, 'sections'), { recursive: true });
    await fsp.writeFile(main, '\\documentclass{article}\n\\begin{document}\n\\section{Model}\\label{sec:model}\nThe chain~\\cite{haldane1988exact} and~\\cite{missing}.\n\\input{sections/dynamics}\n\\bibliographystyle{plain}\n\\bibliography{refs}\n\\end{document}\n');
    await fsp.writeFile(path.join(scratch.win, 'sections', 'dynamics.tex'), '\\section{Dynamics}\nSee Section~\\ref{sec:model}.\n\n\\foo\n');
    await fsp.writeFile(path.join(scratch.win, 'refs.bib'), '@article{haldane1988exact, author={Haldane, F. D. M.}, title={Exact ground state}, journal={Phys. Rev. Lett.}, year={1988}}\n');
    const engines = await enginesFor(main);
    assert.equal(engines[0].kind, 'wsl');
    assert.ok(engines[0].sync);
    const result = await build(path.join(scratch.win, 'sections', 'dynamics.tex'), engines[0].id);
    assert.equal(result.main, main, 'a section builds its document');
    assert.ok(result.pdf.endsWith('main.pdf'));
    assert.equal(result.pages, 1);
    assert.ok(result.steps.some((s) => s.tool === 'bibtex'), 'BibTeX ran');
    const undefinedControl = result.problems.find((p) => p.severity === 'error' && /Undefined control sequence/.test(p.message));
    assert.ok(undefinedControl, JSON.stringify(result.problems));
    assert.equal(undefinedControl.file, path.join(scratch.win, 'sections', 'dynamics.tex'));
    assert.equal(undefinedControl.line, 4);
    assert.ok(result.problems.some((p) => /missing/.test(p.message)), 'the missing citation is reported');
    assert.ok(!result.problems.some((p) => /haldane1988exact/.test(p.message)), 'the cited entry resolved');
    const place = await syncView(main, 4, engines[0].id);
    assert.equal(place.page, 1);
    assert.ok(place.y > 0 && place.y < 800);
    assert.ok(place.box.w > 0 && place.box.h > 0);
    const back = await syncEdit(result.pdf, place.page, place.x, place.y, engines[0].id);
    assert.equal(back.file, main);
    assert.equal(back.line, 4);
  } finally {
    execFileSync('wsl.exe', ['-d', scratch.distro, '--exec', 'rm', '-rf', scratch.linux], { windowsHide: true });
  }
});
