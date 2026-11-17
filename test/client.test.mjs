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
const client = new Function('require', 'window', `${body}\nreturn { contextBlock, chipsOf, headingBefore, threadTitle, promptOf, cleanSelection, focusContext, headingSlug, anchorTarget, splitNote, markdownPieces, encodeFragments, isWaiting, entrySummary, waitingItems, activityGroups, membersOf, teamBrief, slugOf, threadLabel, teamOf, boardSummary, modelOf, texText, citeContext, insertCite, texOutline, lineOfOffset, offsetOfLine, wordDiff, optionsOf, learningTopics };`)(
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
