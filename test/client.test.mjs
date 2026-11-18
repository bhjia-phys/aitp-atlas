// The client's pure helpers for discussions: what a discussion is told, and how it is named.
// The client modules share one scope (see build-client.mjs); this evaluates them the same way,
// minus the registration, with a minimal React stand-in.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';

const dir = new URL('../client/', import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith('.js') && f !== '90-register.js').sort();
const body = files.map((f) => readFileSync(new URL(f, dir), 'utf8')).join('\n');
const react = {
  createElement: () => null,
  createContext: (value) => ({ Provider: null, value }),
  Component: class {},
};
const storage = new Map();
const window = { localStorage: { getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, String(v)) } };
const client = new Function('require', 'window', `${body}\nreturn { contextBlock, chipsOf, headingBefore, threadTitle, promptOf, cleanSelection, focusContext, headingSlug, anchorTarget, splitNote, markdownPieces, encodeFragments, isWaiting, entrySummary, waitingItems, activityGroups, membersOf, teamBrief, slugOf, threadLabel, teamOf, boardSummary, modelOf, texText, citeContext, insertCite, texOutline, lineOfOffset, offsetOfLine, wordDiff, optionsOf, learningTopics, routeFor, layoutAdd, layoutMove, layoutRemove, otherPane, paneOfTab, restoreTabs, saveTabs, tabLabel, placeKeys, paneFocus, besideOf, chatLocation, conversationLink, resolveTheme, cleanThemes, themeCycle, themeStyle, themeCss, THEME_TOKENS, DIRECTION_SLOTS, STYLES, pathKey, sideLabel, MARKDOWN_LABELS, paperLink, topicChoices, sideTitle, noteSlug, writeTarget };`)(
  (name) => (name === 'react' ? react : {}),
  window,
);

const topic = { id: 'mc/worm', title: 'Worm algorithm: equilibration and reproducibility', path: '/r/topics/mc/worm/research.md' };

test('client: the context block points at the topic, the place and the passage, never the whole file', () => {
  const block = client.contextBlock(client.focusContext({ topic }, { section: 'Current work › Mixing test', selection: 'Waiting for the cluster;\nsee the plan.' }));
  assert.equal(block, [
    'Atlas context (what I am looking at):',
    '- Topic: Worm algorithm: equilibration and reproducibility — /r/topics/mc/worm/research.md',
    '- Section: Current work › Mixing test',
    '- Selected passage:',
    '  > Waiting for the cluster;',
    '  > see the plan.',
  ].join('\n'));
  const pdf = client.contextBlock({ topic, doc: { type: 'pdf', title: 'thouless.pdf', path: '/r/topics/mc/worm/readings/thouless.pdf' }, page: '2' });
  assert.match(pdf, /- PDF: thouless\.pdf — \/r\/topics\/mc\/worm\/readings\/thouless\.pdf\n- Page: 2$/);
  const same = client.contextBlock({ topic, doc: { type: 'markdown', title: topic.title, path: topic.path } });
  assert.equal(same.split('\n').length, 2, 'a topic note open as a document is named once');
  assert.match(client.contextBlock(client.focusContext({})), /The research programme as a whole/);
});

test('client: labels, titles and the first message say exactly what the discussion was given', () => {
  const context = client.focusContext({ topic }, { section: 'Opening', selection: 'The question is whether the worm sampler produces reproducible estimates.' });
  assert.deepEqual(client.chipsOf(context).map((c) => c.label), ['Topic', '§', 'Passage']);
  assert.equal(client.threadTitle(context, 'explain', ''), 'Atlas · Worm algorithm · Explain “The question is whether the…”');
  assert.equal(client.threadTitle(context, 'ask', 'Why these defaults?'), 'Atlas · Worm algorithm · Why these defaults?');
  assert.equal(client.threadTitle(context, 'ask', 'Continue the research on this topic.', 'Continue the research'), 'Atlas · Worm algorithm · Continue the research');
  const first = client.promptOf(context, 'check', 'Mind the sign convention.');
  assert.ok(first.startsWith('Atlas context (what I am looking at):\n'));
  assert.match(first, /\n\nCheck this: is it correct as stated\?.*\n\nMind the sign convention\.$/s);
});

test('client: the section above a selection, in LaTeX or Markdown source, and clean selections', () => {
  assert.equal(client.headingBefore('\\section{Edge}\ntext\n\\subsection*{Gauge choice}\nmore'), 'Gauge choice');
  assert.equal(client.headingBefore('# Title\n\\section{Bulk}\n## Edge modes\nbody'), 'Edge modes');
  assert.equal(client.headingBefore('no headings here'), '');
  assert.equal(client.cleanSelection('\\end{document}\n\u200b'), '\\end{document}');
});

test('client: a link to a section finds its heading, an explicit anchor, or nothing', () => {
  const note = [
    '# The kicked top',
    '',
    '<a id="old-title"></a>',
    '',
    'Opening text with a [link](#model-and-conventions).',
    '',
    '## Current work',
    '',
    '- **Thread** — active · 2026-11-13',
    '',
    '## Model and `conventions`',
    '',
    '```',
    '## not a heading',
    '```',
    '',
    '### Signs and clocks',
    '',
    '## Symmetry, level statistics near Berry–Tabor',
    '',
    '<a id="an-older-name"></a>',
    '<a id="kept-anchor"></a>',
    '',
    'Background text.',
    '',
    '<a id="before-next"></a>',
    '',
    '## What remains',
  ].join('\n');
  assert.equal(client.headingSlug('Model and `conventions`'), 'model-and-conventions');
  assert.equal(client.headingSlug('Symmetry, level statistics near Berry–Tabor'), 'symmetry-level-statistics-near-berrytabor');
  assert.equal(client.headingSlug('Read the [spectral account](spectra/research.md) **first**'), 'read-the-spectral-account-first');
  const at = (anchor) => client.anchorTarget(note, anchor);
  assert.deepEqual(at('old-title'), { section: -1, heading: 0, sub: 0 }, 'an anchor in the opening points at the opening');
  assert.deepEqual(at('current-work'), { section: 0, heading: 1, sub: 0 });
  assert.deepEqual(at('#Model-and-Conventions'), { section: 1, heading: 2, sub: 0 }, 'a leading # and capitals are ignored');
  assert.deepEqual(at('signs-and-clocks'), { section: 1, heading: 3, sub: 1 }, 'a ### heading is found inside its ## section');
  assert.deepEqual(at('symmetry-level-statistics-near-berrytabor'), { section: 2, heading: 4, sub: 0 });
  assert.deepEqual(at('kept-anchor'), { section: 2, heading: 4, sub: 0 }, 'anchors after a heading belong to that section');
  assert.deepEqual(at('before-next'), { section: 3, heading: 5, sub: 0 }, 'an anchor before a heading points at that heading');
  assert.deepEqual(at('what%2Dremains'), { section: 3, heading: 5, sub: 0 }, 'an encoded fragment is decoded');
  assert.equal(at('not-a-heading'), null, 'headings inside code blocks do not count');
  assert.equal(at('nowhere'), null);
  assert.equal(at(''), null);
  const parts = client.splitNote(note);
  assert.deepEqual(parts.sections.map((s) => s.heading), ['Current work', 'Model and conventions', 'Symmetry, level statistics near Berry–Tabor', 'What remains']);
  assert.equal(parts.sections[at('signs-and-clocks').section].index, 1, 'section numbers match the topic view folds');
});

test('client: a line that is only an image becomes a figure; anchors and code stay out of it', () => {
  const base = '//wsl.localhost/Ubuntu/r/topics/qc/research.md';
  const pieces = client.markdownPieces([
    '<a id="old-title"></a>',
    '',
    '![Mean gap ratio](figures/ratio%20plot.png)',
    '',
    '*Caption with a [link](spectra/research.md).*',
    '',
    '```',
    '![not a figure](figures/in-code.png)',
    '```',
    'Text with an inline ![icon](figures/icon.svg) and a [PDF figure](figures/plot.pdf).',
    '![A PDF](figures/plot.pdf)',
  ].join('\n'), base);
  assert.equal(pieces.length, 2, 'the figure, then the rest as one Markdown piece');
  assert.equal(pieces[0].figure, true);
  assert.equal(pieces[0].file, '//wsl.localhost/Ubuntu/r/topics/qc/figures/ratio plot.png', 'the path is decoded and joined to the note folder');
  assert.equal(pieces[0].alt, 'Mean gap ratio');
  assert.doesNotMatch(pieces[1].text, /<a id=/, 'anchor-only lines are dropped');
  assert.match(pieces[1].text, /!\[not a figure\]\(figures\/in-code\.png\)/, 'code blocks are left alone');
  assert.match(pieces[1].text, /\[▣ A PDF\]\(figures\/plot\.pdf\)/, 'a non-image stays a link');
  assert.equal(client.markdownPieces('![x](figures/a.png)', '').length, 1, 'without a base file nothing is resolved');
  assert.equal(client.markdownPieces('![x](figures/a.png)', '')[0].figure, undefined);
});

test('client: section links keep their fragment through DSH; line references and URLs stay as written', () => {
  const md = [
    'See [the bound](#an-exact-connection) and [the growth owner](operator-growth/research.md#current-work).',
    'Also [a spaced note](<reports/Geometric routes.md#limits>), [old source](body.tex#L849-L859),',
    '[the web](https://arxiv.org/abs/2207.07701#S3) and [a plain note](notes/a.md).',
    '```',
    '[in code](x.md#y)',
    '```',
  ].join('\n');
  const out = client.encodeFragments(md).split('\n');
  assert.equal(out[0], 'See [the bound](%23an-exact-connection) and [the growth owner](operator-growth/research.md%23current-work).');
  assert.equal(out[1], 'Also [a spaced note](<reports/Geometric routes.md%23limits>), [old source](body.tex#L849-L859),');
  assert.equal(out[2], '[the web](https://arxiv.org/abs/2207.07701#S3) and [a plain note](notes/a.md).');
  assert.equal(out[4], '[in code](x.md#y)', 'code blocks are left alone');
});

const waitingEntry = {
  name: 'Kicking sweep',
  status: 'waiting on the researcher',
  date: '2026-11-15',
  markdown: '**Kicking sweep** — waiting on the researcher · 2026-11-15. The [r statistic](calculations/r.md#table) is **GOE-like** only at strong kicking.\n- Decide whether to extend the sweep to `k = 8`.',
};

test('activity: a Current work entry waits on the researcher only when its disposition says so', () => {
  for (const status of ['waiting on the researcher', 'Waiting on you: pick a route', 'waiting on researcher']) assert.ok(client.isWaiting(status), status);
  for (const status of ['waiting on the cluster', 'active', '', undefined, 'not waiting on the researcher']) assert.ok(!client.isWaiting(status), String(status));
  assert.equal(client.entrySummary(waitingEntry), 'The r statistic is GOE-like only at strong kicking. Decide whether to extend the sweep to k = 8.');
  assert.ok(client.entrySummary({ markdown: 'word '.repeat(80) }, 40).endsWith('…'));
  assert.equal(client.entrySummary({ status: 'waiting on the researcher', markdown: '**A → [owner](b/research.md)** — waiting on the researcher · 2026-11-02: the saddle check reproduces $C_f=1$.' }), 'the saddle check reproduces C_f=1.');
});

test('activity: what waits on you comes from every topic and the root note, newest first', () => {
  const ov = {
    title: 'Research', rootFile: '/r/research.md',
    topics: {
      '': { id: '', title: 'Research', file: '/r/research.md', reached: true, waiting: [
        { ...waitingEntry, name: 'Root choice', date: '2026-11-10', owner: '' },
        { ...waitingEntry, name: 'Kicking sweep', owner: '\\r\\topics\\QC\\research.md' },
      ] },
      'topics/qc': { id: 'topics/qc', title: 'Kicked top: spectral statistics', file: '/r/topics/qc/research.md', reached: true, waiting: [waitingEntry] },
      'topics/kr': { id: 'topics/kr', title: 'Operator growth', file: '/r/topics/kr/research.md', reached: true, waiting: [{ ...waitingEntry, name: 'Pointer to a quiet owner', owner: '/r/topics/kr/branch/research.md' }] },
      'staged/copy': { id: 'staged/copy', title: 'A staged copy', file: '/r/staged/copy/research.md', reached: false, waiting: [{ ...waitingEntry, name: 'Stale copy' }] },
    },
  };
  const items = client.waitingItems(ov);
  assert.deepEqual(items.map((i) => [i.topic.id, i.thread.name]), [['topics/qc', 'Kicking sweep'], ['topics/kr', 'Pointer to a quiet owner'], ['', 'Root choice']]);
});

test('activity: sessions group by topic, team members nest under their lead, deleted ones drop out', () => {
  const qc = { id: 'topics/qc', title: 'Kicked top', path: '/r/topics/qc/research.md' };
  const index = [
    { id: 'a', kind: 'team', title: 'Atlas team · Kicked top · Settle the sweep', question: 'Settle the sweep', created: 3, context: { topic: qc } },
    { id: 'b', title: 'Atlas · Kicked top · Why GOE?', question: 'Why GOE?', created: 1, context: { topic: qc } },
    { id: 'c', title: 'Atlas · Research · Next?', created: 2, context: { topic: null } },
    { id: 'gone', title: 'Atlas · Kicked top · old', created: 4, context: { topic: qc } },
  ];
  const rows = { phase: 'ready', byId: {
    a: { title: 'Atlas team · Kicked top · Settle the sweep', running: true },
    b: { title: 'Why GOE?' }, c: { title: 'Next?' },
    m1: { title: 'Librarian', parentSessionId: 'a', running: true },
    m2: { title: 'Oracle', parentSessionId: 'a' },
    x: { title: 'Something else' },
    y: { title: 'Archived', archived: true },
  } };
  const { groups, others } = client.activityGroups(index, rows);
  assert.deepEqual(groups.map((g) => g.key), ['/r/topics/qc/research.md', '']);
  assert.deepEqual(groups[0].items.map((t) => t.id), ['a', 'b']);
  assert.deepEqual(others.map((o) => o.id), ['x']);
  assert.deepEqual(client.membersOf(rows, 'a').map((m) => m.id), ['m1', 'm2']);
  const lead = { title: 'Lead', projectionValues: { agentTeam: { enabled: true, tasks: [{ status: 'completed' }, { status: 'in_progress' }, { status: 'pending' }] }, subagentCatalog: [
    { id: 'k1', name: 'derivation-checker', label: '[fixer] Runs the derivation checks.' },
    { id: 'k2', name: 'agent-1', label: '[librarian] Find the sources' },
  ] } };
  const withCatalog = { phase: 'ready', byId: { L: lead, k1: { parentId: 'L', running: true, projectionValues: { modelSelection: { lastUsed: { model: 'deepseek-pro' } } } } } };
  assert.deepEqual(client.membersOf(withCatalog, 'L').map((m) => [m.id, m.name, m.role, m.task, Boolean(m.row)]), [['k1', 'derivation-checker', 'fixer', 'Runs the derivation checks.', true], ['k2', 'agent-1', 'librarian', 'Find the sources', false]]);
  assert.equal(client.boardSummary(client.teamOf(lead)), '3 tasks on the board: 1 done, 1 in progress');
  assert.equal(client.teamOf({ projectionValues: { agentTeam: { enabled: false } } }), null);
  assert.equal(client.modelOf(withCatalog.byId.k1), 'deepseek-pro');
  assert.equal(client.threadLabel(index[0]), 'Settle the sweep');
  assert.equal(client.threadLabel({ title: 'Atlas team · Kicked top · Settle it' }), 'Settle it');
});

test('activity: a team brief points at the topic, states the goal, limits and seats, and keeps the rules', () => {
  const context = client.focusContext({ topic: { id: 'topics/qc', title: 'Kicked top', path: '/r/topics/qc/research.md' } }, { section: 'Current work › Kicking sweep' });
  const brief = client.teamBrief({
    context,
    goal: 'Settle the kicking sweep.',
    limits: 'No cluster submission\n- Two days',
    members: [{ role: 'librarian', mode: 'member', purpose: 'Find the sources', model: '' }, { role: 'fixer', mode: 'member', purpose: 'Check the derivation', model: 'strong' }, { role: 'writer', mode: 'oneshot', purpose: 'Draft the summary' }, { role: 'oracle', purpose: 'Review', model: '' }, { role: '', purpose: 'ignored' }],
    reportDir: '/r/topics/qc/calculations/team-settle-the-kicking-sweep-20261116',
  });
  assert.ok(brief.startsWith('Atlas context (what I am looking at):\n- Topic: Kicked top — /r/topics/qc/research.md\n- Section: Current work › Kicking sweep\n'));
  assert.match(brief, /\nGoal: Settle the kicking sweep\.\n/);
  assert.match(brief, /\nLimits:\n- No cluster submission\n- Two days\n/);
  assert.match(brief, /\nCore members to hire \(bbff_team_hire\):\n- fixer — Check the derivation \(model tier: strong\)\nOne-shot jobs to dispatch when their turn comes \(bbff_team_dispatch\):\n- librarian — Find the sources\n- writer — Draft the summary\n- oracle — Review\n/);
  assert.ok(!brief.includes('ignored'));
  assert.match(brief, /bbff-team-leading/);
  assert.match(brief, /under \/r\/topics\/qc\/calculations\/team-settle-the-kicking-sweep-20261116\//);
  assert.match(brief, /researcher's yes/);
  assert.equal(client.slugOf('Settle "the" kicking sweep: p = 3!'), 'settle-the-kicking-sweep-p-3');
  assert.equal(client.slugOf('???'), 'team');
});

test('discover: paper titles read as text', () => {
  assert.equal(client.texText('Anomaly Inflow and the $\\eta$-Invariant'), 'Anomaly Inflow and the η-Invariant');
  assert.equal(client.texText('Fractional Chern Insulator in Twisted Bilayer $\\mathrm{MoTe}_2$'), 'Fractional Chern Insulator in Twisted Bilayer MoTe2');
  assert.equal(client.texText('Plain title'), 'Plain title');
  assert.equal(client.texText('Exact Jastrow--Gutzwiller state~of matter'), 'Exact Jastrow–Gutzwiller state of matter');
});

test('write: citing completes the key being typed, or inserts a citation', () => {
  const text = 'at the point~\\cite{hal';
  assert.deepEqual(client.citeContext(text, text.length), { partial: 'hal', start: text.length - 3 });
  assert.deepEqual(client.insertCite(text, text.length, 'haldane1988exact'), { text: 'at the point~\\cite{haldane1988exact', caret: text.length - 3 + 16 });
  const two = 'see \\citep[Sec.~2]{a, sh';
  assert.equal(client.insertCite(two, two.length, 'shastry1988').text, 'see \\citep[Sec.~2]{a, shastry1988');
  assert.equal(client.citeContext('plain text', 10), null);
  assert.deepEqual(client.insertCite('As shown ', 9, 'k'), { text: 'As shown \\cite{k}', caret: 17 });
  const src = '\\section{Model}\n% \\section{Old}\ntext\n\\subsection*{Gauge choice}\n';
  assert.deepEqual(client.texOutline(src).map((o) => [o.level, o.title, o.line]), [['section', 'Model', 1], ['subsection', 'Gauge choice', 4]]);
  assert.equal(client.lineOfOffset('a\nb\nc', 4), 3);
  assert.equal(client.offsetOfLine('a\nbb\nc', 3), 5);
});

test('review: changed words are marked, unchanged ones not', () => {
  const d = client.wordDiff('At strong kicking the spectrum looks chaotic.', 'At strong kicking the spectrum is GOE-like for k ≥ 6.');
  assert.deepEqual(d.before.filter((p) => p.changed).map((p) => p.text.trim()), ['looks chaotic.']);
  assert.deepEqual(d.after.filter((p) => p.changed).map((p) => p.text.trim()), ['is GOE-like for k ≥ 6.']);
  assert.equal(d.before.map((p) => p.text).join(''), 'At strong kicking the spectrum looks chaotic.');
});

test('decide: the options an entry lays out', () => {
  const entry = 'Choose the route · A: diagnose the L8 shared-core precision issue first (recommended) · B: assess the existing form · C: integrate into the article first.';
  assert.deepEqual(client.optionsOf(entry).map((o) => [o.letter, o.text]), [['A', 'diagnose the L8 shared-core precision issue first (recommended)'], ['B', 'assess the existing form'], ['C', 'integrate into the article first']]);
  assert.deepEqual(client.optionsOf('(a) keep the window; (b) widen it.').map((o) => o.letter), ['A', 'B']);
  assert.deepEqual(client.optionsOf('Plan B: wait for the cluster.'), [], 'a lone B is not a choice');
  assert.deepEqual(client.optionsOf('Nothing to choose here.'), []);
});

test('learn: learning topics come first, then the rest by recency', () => {
  const ov = { directions: [{ heading: '4. Learning and teaching', topics: ['topology'] }], topics: {
    '': { id: '', title: 'Root', file: '/r/research.md' },
    topology: { id: 'topology', title: 'Topology', file: '/r/topology/research.md', date: '2026-10-01' },
    gw: { id: 'gw', title: 'GW', file: '/r/gw/research.md', date: '2026-11-10' },
    qc: { id: 'qc', title: 'Chaos', file: '/r/qc/research.md', date: '2026-11-13' },
  } };
  const { own, rest } = client.learningTopics(ov);
  assert.deepEqual(own.map((t) => t.id), ['topology']);
  assert.deepEqual(rest.map((t) => t.id), ['qc', 'gw']);
});

test('tabs: files and papers open in a tab of their own, places in the page, a section stays where it is', () => {
  const places = new Set(['/r/research.md', '/r/topics/t/research.md', '/r/topics/u/research.md']);
  const isPlace = (p) => places.has(client.pathKey(p));
  const route = (next, here = '/r/topics/t/research.md') => client.routeFor(next, here, isPlace);
  assert.equal(route({ view: 'doc', path: '/r/topics/t/notes/a.md', link: true }), 'file', 'a note linked from the page');
  assert.equal(route({ view: 'doc', path: '/r/library/arxiv/1/paper.pdf' }), 'file', 'a paper from a list');
  assert.equal(route({ view: 'doc', path: '/r/topics/t/research.md', anchor: 'current-work' }), 'same', 'a section of the note open');
  assert.equal(route({ view: 'doc', path: '/r/topics/u/research.md' }, ''), 'page', 'a topic is a place');
  assert.equal(route({ view: 'doc', path: '/R/Topics/U/Research.md' }, '/x/y.pdf'), 'page', 'paths compare case-folded');
  assert.equal(route({ view: 'doc', path: '/r/topics/u/research.md', link: true }, '/x/y.md'), 'file', 'a topic linked inside a document opens in a tab');
  assert.equal(route({ view: 'doc', path: '/x/y.md', anchor: 'h' }, '/x/y.md'), 'same', 'a section of the file in a tab stays in it');
  assert.equal(route({ view: 'doc', path: '/r/a/sec.tex', edit: true, anchor: 'L4', stay: true }, '/r/a/main.tex'), 'same', 'a LaTeX jump stays in its workspace');
  assert.equal(route({ view: 'doc', path: '/r/topics/t/notes/new.md', edit: true, created: true }), 'file', 'a new note is written in a tab beside its topic');
  assert.equal(route({ view: 'doc', path: '/x/y.pdf', full: true }, '/x/y.pdf'), 'page', 'open as the page');
  assert.equal(route({ view: 'library' }, '/x/y.md'), 'page');
  assert.equal(route({ back: true }, '/x/y.md'), 'page');
  assert.deepEqual([...client.placeKeys({ rootFile: 'C:\\R\\research.md', topics: { a: { file: 'C:/R/a/research.md' } } })], ['c:/r/research.md', 'c:/r/a/research.md']);
  const ov = { rootFile: '/r/research.md', title: 'Research programme', topics: { a: { file: '/r/a/research.md', title: 'Kicked top: spectral statistics' } } };
  assert.deepEqual(['/r/a/research.md', '/R/research.md', '/r/a/notes/x.md'].map((p) => client.tabLabel({ kind: 'file', path: p }, { view: 'home' }, ov)), ['Kicked top', 'Research programme', 'x.md'], 'a topic note is named by its topic');
  assert.equal(client.tabLabel({ kind: 'page' }, { view: 'doc', path: '/r/a/research.md' }, ov), 'Kicked top', 'the page tab names the place it shows');
  assert.equal(client.tabLabel({ kind: 'page' }, { view: 'write' }, ov), 'Write');
  assert.equal(client.tabLabel({ kind: 'discussion' }, { view: 'home' }, ov), 'Discussion');
  assert.equal(client.tabLabel({ kind: 'preview', main: '/r/a/paper/main.tex' }, { view: 'home' }, ov), 'Preview · main.pdf');
});

test('tabs: two panes hold them; a tab reorders, moves across and closes, and each pane shows one it holds', () => {
  let l = { left: ['page'], right: [], active: { left: 'page', right: null }, split: 52 };
  l = client.layoutAdd(l, 'f1', 'right');
  assert.deepEqual([l.left, l.right, l.active], [['page'], ['f1'], { left: 'page', right: 'f1' }], 'the first file opens the right pane');
  l = client.layoutAdd(l, 'f2', 'right', 'f1');
  l = client.layoutAdd(l, 'f3', 'right', 'f1');
  assert.deepEqual([l.right, l.active.right], [['f1', 'f3', 'f2'], 'f3'], 'a new tab goes next to the one shown');
  l = client.layoutMove(l, 'f2', 'left', 0);
  assert.deepEqual([l.left, l.right, l.active], [['f2', 'page'], ['f1', 'f3'], { left: 'f2', right: 'f3' }], 'dragged across: shown where it lands; the pane it left keeps what it showed');
  l = client.layoutMove(l, 'f3', 'right', 0);
  assert.deepEqual(l.right, ['f3', 'f1'], 'reordered within its pane');
  l = client.layoutRemove(l, 'f3');
  assert.deepEqual([l.right, l.active.right], [['f1'], 'f1'], 'closing the shown tab shows its neighbour');
  l = client.layoutRemove(l, 'f1');
  assert.deepEqual([l.right, l.active.right], [[], null], 'an empty pane folds away');
  l = client.layoutMove(l, 'page', 'right');
  assert.deepEqual([l.left, l.right, l.active], [['f2'], ['page'], { left: 'f2', right: 'page' }], 'any tab can go to either side');
  assert.deepEqual([client.otherPane('left'), client.otherPane('right'), client.paneOfTab(l, 'page'), client.paneOfTab(l, 'nope')], ['right', 'left', 'right', null]);
});

test('tabs: they come back as they were left, and the 0.7 side panel becomes a tab on the right', () => {
  storage.clear();
  window.localStorage.setItem('aitp-atlas:side', JSON.stringify({ path: '/r/a/notes/x.md', anchor: 'h' }));
  const old = client.restoreTabs(false);
  assert.deepEqual(old.layout.left, ['page']);
  assert.equal(old.layout.right.length, 1);
  assert.deepEqual([old.tabs[old.layout.right[0]].path, old.tabs[old.layout.right[0]].anchor], ['/r/a/notes/x.md', 'h']);
  const talking = client.restoreTabs(true);
  assert.deepEqual(talking.layout.right.slice(-1), ['discussion'], 'an open discussion has its tab');
  client.saveTabs({ ...talking, layout: client.layoutMove(talking.layout, 'discussion', 'left') });
  const back = client.restoreTabs(true);
  assert.deepEqual(back.layout.left, ['page', 'discussion'], 'where you put it');
  assert.equal(back.tabs[back.layout.right[0]].path, '/r/a/notes/x.md');
  assert.ok(!client.restoreTabs(false).layout.left.includes('discussion'), 'no discussion, no tab');
  storage.clear();
});

test('tabs: a discussion is told what is open beside what it is about', () => {
  const all = {
    byTab: {
      page: { kind: 'topic', topic: { id: 'qc', title: 'Kicked top', path: '/r/qc/research.md' } },
      'file:1': { kind: 'doc', topic: null, doc: { type: 'pdf', title: 'Lectures', path: '/lib/1/paper.pdf' }, page: '3' },
    },
    active: 'file:1',
    visible: { left: 'page', right: 'file:1' },
    paneOf: { page: 'left', 'file:1': 'right', discussion: 'right' },
  };
  const focus = client.paneFocus(all, 'global');
  assert.equal(focus.doc.path, '/lib/1/paper.pdf', 'the tab used last');
  const block = client.contextBlock(client.focusContext(focus, { selection: 'A passage' }));
  assert.match(block, /- PDF: Lectures — \/lib\/1\/paper\.pdf\n- Page: 3\n- Open beside it: Topic: Kicked top — \/r\/qc\/research\.md\n- Selected passage:/);
  assert.deepEqual(client.chipsOf(client.focusContext(focus)).map((c) => c.label), ['PDF', 'Page', 'Beside']);
  assert.equal(client.paneFocus(all, 'page').beside.path, '/lib/1/paper.pdf');
  const talking = { ...all, visible: { left: 'page', right: 'discussion' } };
  assert.equal(client.paneFocus(talking, 'discussion').topic.path, '/r/qc/research.md', 'the discussion is about what the other pane shows');
  assert.equal(client.paneFocus(talking, 'discussion').beside, undefined, 'and the discussion itself is not beside it');
  const same = { ...all, byTab: { ...all.byTab, 'file:1': { kind: 'doc', topic: null, doc: { type: 'markdown', title: 'Kicked top', path: '/R/QC/research.md' } } } };
  assert.equal(client.paneFocus(same, 'page').beside, undefined, 'nothing beside when both name the same note');
  assert.equal(client.paneFocus({ byTab: { page: { kind: 'universe' } }, active: 'page', visible: { left: 'page', right: null }, paneOf: { page: 'left' } }, 'global').beside, undefined);
  assert.equal(client.paneFocus({ byTab: {}, active: 'closed', visible: {}, paneOf: {} }, 'global').kind, 'universe', 'a closed tab falls back to the page');
  assert.deepEqual(client.focusContext({ topic: null }), { topic: null, doc: null, page: '', section: '', lines: '', selection: '' }, 'no beside key when nothing is beside');
});

test('discussion: what the AI links opens in Atlas: lines, paths in the research, WSL paths', () => {
  const win = 'F:\\R';
  assert.deepEqual(client.chatLocation('F:\\R\\qc\\research.md:42', win), { path: 'F:\\R\\qc\\research.md', anchor: 'L42' });
  assert.deepEqual(client.chatLocation('qc/notes/a.md#current-work', win), { path: 'F:\\R\\qc\\notes\\a.md', anchor: 'current-work' });
  assert.deepEqual(client.chatLocation('./qc/main.tex:7:3', win), { path: 'F:\\R\\qc\\main.tex', anchor: 'L7' });
  assert.deepEqual(client.chatLocation('/mnt/f/R/x.md', win), { path: 'F:\\R\\x.md', anchor: '' }, 'a Windows drive seen from WSL');
  const wsl = '\\\\wsl.localhost\\Ubuntu-22.04\\home\\me\\research';
  assert.deepEqual(client.chatLocation('/home/me/research/qc/research.md', wsl), { path: '\\\\wsl.localhost\\Ubuntu-22.04\\home\\me\\research\\qc\\research.md', anchor: '' }, 'a Linux path inside the WSL the research lives in');
  assert.deepEqual(client.chatLocation('/home/me/research/qc/research.md:3', '/home/me/research'), { path: '/home/me/research/qc/research.md', anchor: 'L3' }, 'on Linux a Linux path is itself');
  assert.deepEqual(client.chatLocation('file:///C:/R/a.md', win), { path: 'C:/R/a.md', anchor: '' });
  assert.equal(client.chatLocation('  ', win), null);
  const el = (tag, attrs = {}, cls = '') => ({
    getAttribute: (k) => (k in attrs ? attrs[k] : null),
    textContent: attrs.text || '',
    closest(sel) {
      if (sel.includes('fileLink') && ((tag === 'button' && /fileLink|fileMention/.test(cls)) || 'data-file-path' in attrs)) return this;
      if (sel === 'a[href]' && tag === 'a' && 'href' in attrs) return this;
      return null;
    },
  });
  assert.deepEqual(client.conversationLink(el('button', { title: 'F:\\R\\qc\\a.md:5' }, '_fileLink_x1 a'), win), { path: 'F:\\R\\qc\\a.md', anchor: 'L5' }, "DSH's file button");
  assert.deepEqual(client.conversationLink(el('button', { text: 'qc/b.md' }, '_fileMention_y'), win), { path: 'F:\\R\\qc\\b.md', anchor: '' }, 'no title: its text');
  assert.deepEqual(client.conversationLink(el('a', { href: 'https://arxiv.org/abs/2401.01234' }), win), { url: 'https://arxiv.org/abs/2401.01234' });
  assert.deepEqual(client.conversationLink(el('a', { href: 'qc/c.md#L9' }), win), { path: 'F:\\R\\qc\\c.md', anchor: 'L9' });
  for (const href of ['#top', 'mailto:a@b.c', '/aitp-atlas/api/raw?path=x']) assert.equal(client.conversationLink(el('a', { href }), win), null, href);
  assert.equal(client.conversationLink(el('span'), win), null);
  assert.equal(client.conversationLink(null, win), null);
});

test('themes: auto follows DSH, day and night are fixed, the config adds safe themes', () => {
  assert.equal(client.resolveTheme('auto', true).base, 'night');
  assert.equal(client.resolveTheme('auto', false).base, 'day');
  assert.equal(client.resolveTheme('day', true).base, 'day');
  assert.equal(client.resolveTheme('night', false).name, 'night');
  assert.equal(client.resolveTheme('nonsense', false).name, 'auto');
  const themes = client.cleanThemes({
    sepia: { base: 'day', label: 'Sepia', tokens: { 'sky-0': '#f4ecd8', 'ink-1': 'rgb(59, 47, 47)', 'accent-rgb': '120, 80, 40', 'shadow-k': '.2', bad: '#000', link: 'red; background: url(x)' } },
    night: { base: 'day', tokens: {} },
    'x y': { base: 'day' },
  });
  assert.deepEqual(Object.keys(themes), ['sepia'], 'shipped names and odd names are refused');
  assert.deepEqual(themes.sepia, { base: 'day', label: 'Sepia', tokens: { 'sky-0': '#f4ecd8', 'ink-1': 'rgb(59, 47, 47)', 'accent-rgb': '120, 80, 40', 'shadow-k': '.2' } });
  const sepia = client.resolveTheme('sepia', true, themes);
  assert.deepEqual([sepia.name, sepia.base], ['sepia', 'day']);
  assert.deepEqual(client.themeStyle(sepia), { '--sky-0': '#f4ecd8', '--ink-1': 'rgb(59, 47, 47)', '--accent-rgb': '120, 80, 40', '--shadow-k': '.2' });
  assert.deepEqual(client.themeCycle(themes), ['auto', 'day', 'night', 'sepia']);
  assert.deepEqual(client.cleanThemes(['x']), {});
});

test('themes: every token the styles use is defined by both themes, and night keeps the observatory', () => {
  const used = new Set([...client.STYLES.matchAll(/var\(--([a-z0-9-]+)/g)].map((m) => m[1]));
  // Set by PDF.js on its text layer, or by Atlas inline: not theme tokens.
  const own = new Set(['dir', 'serif', 'sans', 'mono', 'write-split', 'total-scale-factor', 'min-font-size', 'min-font-size-inv', 'text-scale-factor', 'font-height', 'rotate', 'scale-x']);
  const missing = (base) => [...used].filter((t) => !own.has(t) && !t.startsWith('dsw-') && !(t in client.THEME_TOKENS[base]));
  assert.deepEqual(missing('night'), []);
  assert.deepEqual(missing('day'), []);
  assert.deepEqual(Object.keys(client.THEME_TOKENS.day).sort(), Object.keys(client.THEME_TOKENS.night).sort(), 'both themes define the same tokens');
  assert.equal(client.THEME_TOKENS.night['sky-0'], '#070b16');
  assert.equal(client.THEME_TOKENS.night['accent-rgb'], '157, 184, 255');
  assert.match(client.themeCss(), /\.atlas-root\[data-theme-base="day"\] \{ color-scheme: light;/);
  assert.equal(client.DIRECTION_SLOTS.day.length, client.DIRECTION_SLOTS.night.length);
  assert.deepEqual([...client.STYLES.matchAll(/#[0-9a-f]{3,8}\b/gi)].map((m) => m[0].toLowerCase()).filter((x) => x !== '#fff' && x !== '#000'), [], 'no literal colors but paper white and video black');
});

test("markdown: DSH's renderer gets the labels its code blocks and footnotes read", () => {
  // DSH reads labels.code.{copyLabel,copiedLabel,toolbarLabels.{codeLabel,wrapLabel,unwrapLabel}} and labels.footnotes;
  // without them a note with a fenced code block failed to draw.
  const l = client.MARKDOWN_LABELS;
  assert.deepEqual(Object.keys(l.code).sort(), ['copiedLabel', 'copyLabel', 'toolbarLabels']);
  assert.deepEqual(Object.keys(l.code.toolbarLabels).sort(), ['codeLabel', 'unwrapLabel', 'wrapLabel']);
  assert.ok(Object.values(l.code.toolbarLabels).every((v) => typeof v === 'string' && v));
  assert.equal(typeof l.footnotes, 'string');
});

test('papers: a paper link opens beside the page, read in Atlas; other sites stay in the browser', () => {
  assert.deepEqual(client.paperLink('https://arxiv.org/abs/2401.01234v5'), { kind: 'arxiv', id: '2401.01234', version: 'v5', q: '2401.01234v5', label: 'arXiv 2401.01234v5' });
  assert.equal(client.paperLink('https://arxiv.org/pdf/2401.01234.pdf').q, '2401.01234');
  assert.equal(client.paperLink('http://www.arxiv.org/abs/cond-mat/0410123v2').label, 'arXiv cond-mat/0410123v2');
  assert.equal(client.paperLink('https://doi.org/10.1103/PhysRevB.99.012345').doi, '10.1103/PhysRevB.99.012345');
  assert.equal(client.paperLink('https://inspirehep.net/literature/1234567').recid, '1234567');
  for (const other of ['https://github.com/x/y', 'https://arxiv.org/list/hep-th/new', 'mailto:a@b.c', 'not a url', 'https://doi.org/nope']) assert.equal(client.paperLink(other), null, other);
  const none = () => false;
  assert.equal(client.routeFor({ view: 'paper', url: 'https://arxiv.org/abs/1' }, '', none), 'paper', 'in a tab of its own');
  assert.equal(client.routeFor({ view: 'paper', url: 'https://arxiv.org/abs/1', full: true }, '', none), 'page', 'open as the page');
  assert.equal(client.sideTitle({}, { url: 'https://arxiv.org/abs/2401.01234v5' }), 'arXiv 2401.01234v5');
  assert.equal(client.tabLabel({ kind: 'paper', url: 'https://arxiv.org/abs/2401.01234v5' }, { view: 'home' }, {}), 'arXiv 2401.01234v5');
  const ov = { topics: { '': { id: '', title: 'Root', file: '/r/research.md' }, qc: { id: 'qc', title: 'Kicked top: spectral statistics', file: '/r/qc/research.md', parent: '' }, b: { id: 'qc/b', title: 'Level spacing', file: '/r/qc/b/research.md', parent: 'qc' } } };
  assert.deepEqual(client.topicChoices(ov).map((c) => c.label), ['Kicked top', 'Kicked top › Level spacing'], 'branches under their topic, the root left out');
});

test('client: no two modules declare the same top-level name (they share one scope, the last silently wins)', () => {
  const names = new Map();
  for (const f of files) {
    for (const m of readFileSync(new URL(f, dir), 'utf8').matchAll(/^(?:async\s+)?(?:function\*?|const|let|class)\s+([A-Za-z_$][\w$]*)/gm)) names.set(m[1], [...(names.get(m[1]) || []), f]);
  }
  assert.deepEqual([...names].filter(([, where]) => where.length > 1), []);
});

test('write: a new note or LaTeX document goes in its topic folder, named from its title', () => {
  assert.equal(client.noteSlug('Spectral flow: the edge anomaly (draft)'), 'spectral-flow-the-edge-anomaly-draft');
  assert.equal(client.writeTarget('/r/qc/research.md', 'notes', 'Spectral flow', 'md'), '/r/qc/notes/spectral-flow.md');
  assert.equal(client.writeTarget('/r/qc/research.md', '/manuscript/', 'Level statistics', 'tex'), '/r/qc/manuscript/level-statistics.tex');
  assert.equal(client.writeTarget('/r/qc/research.md', '', 'Here', 'md'), '/r/qc/here.md', 'no folder: beside the topic note');
  assert.equal(client.writeTarget('', 'notes', 'No topic', 'md'), '', 'a topic is needed');
  assert.equal(client.writeTarget('/r/qc/research.md', 'notes', '  ', 'md'), '', 'a title is needed');
});

test('write: the source fills its pane, a helper panel sits beside it until the pane is phone-narrow, the PDF is its own tab', () => {
  const block = (width) => {
    const start = client.STYLES.indexOf(`@container (max-width: ${width}px) {`);
    assert.ok(start >= 0, `a ${width}px block`);
    let depth = 0;
    for (let i = client.STYLES.indexOf('{', start); i < client.STYLES.length; i++) {
      if (client.STYLES[i] === '{') depth++;
      else if (client.STYLES[i] === '}' && --depth === 0) return client.STYLES.slice(start, i);
    }
    return '';
  };
  assert.ok(!block(1000).includes('.atlas-write-split'), 'not stacked at 1000px');
  assert.ok(block(640).includes('.atlas-write-split { grid-template-columns: minmax(0, 1fr)'), 'stacked only below 640px');
  assert.match(client.STYLES, /\.atlas-write-split \{ display: grid; grid-template-columns: minmax\(240px, var\(--write-split, 64%\)\) 10px minmax\(220px, 1fr\)/);
  assert.match(client.STYLES, /\.atlas-write-split\.is-solo \{ grid-template-columns: minmax\(0, 1fr\); \}/, 'no panel open: the source alone');
  assert.ok(!/\.atlas-write-pane \.atlas-pdf/.test(client.STYLES), 'no PDF inside the workspace');
  assert.match(client.STYLES, /\.atlas-tab-body\.is-hidden \{ content-visibility: hidden;/, 'a hidden tab keeps its place and scroll');
});
