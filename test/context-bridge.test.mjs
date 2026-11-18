// Exercise the transitional M1 discussion surfaces without creating real sessions or touching notes.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const body = ['00-runtime', '60-threads', '62-models', '65-activity'].map((f) => readFileSync(new URL(`../client/${f}.js`, import.meta.url), 'utf8')).join('\n');
const stubViews = `const Icon = 'icon', Button = 'button', IconButton = 'icon-button', TextButton = 'text-button', Empty = 'empty', ReviewPanel = 'review-panel', TYPE_LABEL = {};
  const registryRows = [], useRegistryRecords = () => registryRows, registryCreate = async row => { registryRows.push(row); return row; };
  const entryBody = (thread) => thread.markdown || '';
  const readingStore = externalStore({});
  function readingOf(reading, file) { return reading[file]; }
  function relPath(base, file) { return file; }
  `;
function harness(services = {}, extra = {}, fetch = () => { throw new Error('Unexpected network access'); }) {
  const react = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity) }),
    createContext: (value) => ({ value }), useContext: (c) => c.value,
    useImperativeHandle: (ref, create) => { if (ref) ref.current = create(); },
    useSyncExternalStore: (_subscribe, snapshot) => snapshot(), useEffect() {}, useLayoutEffect() {}, useMemo: (f) => f(), useCallback: (f) => f,
    useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}], useRef: (current) => ({ current }), ...extra,
  };
  return new Function('require', 'window', 'services', 'fetch', `${body}\n${stubViews}\npluginCtx = { get: k => services[k] }; return { contextBlock, chipsOf, focusContext, startThread, paneFocus, legacyTeamGroups, LegacyTeamsPlace, DecideButtons, AtlasActions, PaneContext, Companion, focusStore, threadStore, readingStore, SelectionTools };`)(
    () => react, { localStorage: { getItem: () => null, setItem() {} }, getSelection: () => null }, services, fetch);
}
function nodes(tree) {
  return !tree || typeof tree !== 'object' ? [] : [tree, ...tree.children.flatMap(nodes)];
}

test('Desk sends file paths and paper links to the created session and renders the same pointers in marginalia', async () => {
  let sent, recorded, released = 0;
  const a = harness({ sessions: { create: async () => 's-one', retain: () => ({ ready: Promise.resolve({ session: { prompt: async (message) => { sent = message[0].text; return { ok: true }; } } }), release() { released++; } }) } });
  const path = 'C:\\Work\\Topics\\edge note.md', url = 'https://arxiv.org/abs/2401.01234v5';
  const context = a.focusContext({}, { attachments: [{ label: 'Edge note', path, text: 'PRIVATE contents' }, { label: 'Paper', path: url }, { path }, { label: 'Missing' }] });
  await a.startThread({ root: '/fixture', context, intent: 'ask', question: 'Compare.', onCreated: (r) => { recorded = r; } });
  assert.equal(sent, `Atlas context (what I am looking at):\n- Attached: Edge note — ${path}\n- Attached: Paper — ${url}\n\nCompare.`);
  assert.deepEqual(a.chipsOf(recorded.context), [{ label: 'Attached', text: 'Edge note', title: path }, { label: 'Attached', text: 'Paper', title: url }]);
  assert.deepEqual(recorded.context.attachments, [{ label: 'Edge note', path }, { label: 'Paper', path: url }]);
  assert.equal(released, 1);
  assert.equal(a.contextBlock(a.focusContext({})), 'Atlas context (what I am looking at):\n- The research programme as a whole.');
});

test('v2 conversation context names its visible opposite, never an unrelated hidden file or another session', () => {
  const a = harness(), disc = 'discussion:A', peer = 'member:B';
  const own = { kind: 'doc', doc: { path: '/visible.md', title: 'Visible', type: 'markdown' } };
  const s = { active: 'hidden', byTab: { desk: { kind: 'desk' }, hidden: { kind: 'doc', doc: { path: '/hidden.md' } }, visible: own }, paneOf: { [disc]: 'right', [peer]: 'left', hidden: 'left', visible: 'left' }, visible: { left: 'visible', right: disc } };
  assert.deepEqual(a.paneFocus(s, disc), own);
  assert.equal(a.paneFocus({ ...s, visible: { left: peer, right: disc } }, disc).doc, undefined);
  assert.equal(a.paneFocus({ ...s, visible: { left: null, right: disc } }, disc).doc, undefined);
  // The same tab after a move follows its opposite by layout, not by fixed side.
  assert.deepEqual(a.paneFocus({ ...s, paneOf: { [disc]: 'left', visible: 'right' }, visible: { left: disc, right: 'visible' } }, disc), own);
  const focused = [];
  a.PaneContext.value = disc;
  a.AtlasActions.value = { focusPane: (id) => focused.push(id) };
  const button = nodes(a.Companion({ threadId: 'A', root: '/r', onClose() {} })).find((n) => n.props.label === 'Focus discussion pane');
  button.props.onClick();
  assert.deepEqual(focused, [disc]);
});

test('Keep in note promotes the selected PDF tab, not whichever tab was used last', async () => {
  const source = 'file:paper', other = 'file:hidden';
  const actions = [];
  const a = harness({}, { useState: (initial) => [initial === null ? { page: '3', selection: 'Selected words' } : initial, () => {}] }, async (url, request) => {
    actions.push([url, JSON.parse(request.body)]);
    return { ok: true, json: async () => ({}) };
  });
  a.PaneContext.value = source;
  a.AtlasActions.value = { keepTab: (id) => actions.push(['promote', id]) };
  a.focusStore.set({ active: other, visible: { left: source, right: null }, paneOf: { [source]: 'left' }, byTab: { [source]: { doc: { path: '/paper.pdf', type: 'pdf' } } } });
  a.readingStore.set({ '/paper.pdf': { map: '/map.md', pdf: '/paper.pdf' } });
  const button = nodes(a.SelectionTools({ container: {}, host: {} })).find((n) => n.children.includes('Keep in note'));
  button.props.onClick();
  assert.deepEqual(actions, [['promote', source], ['/aitp-atlas/api/append', { path: '/map.md', heading: 'Your reading', line: '- [p. 3](/paper.pdf#page=3): “Selected words”' }]]);
});

test('Discussions and Teams partition legacy and native rows; running includes a working child of an idle team', () => {
  const a = harness();
  const index = [{ id: 'disc', question: 'Question', created: 1 }, { id: 'legacy', kind: 'team', created: 2 }, { id: 'promoted', created: 3 }, { id: 'gone' }];
  const team = { projectionValues: { agentTeam: { enabled: true, tasks: [] } } };
  const rows = { phase: 'ready', byId: { disc: { running: true }, legacy: {}, promoted: team, native: team, child: { parentId: 'legacy', running: true }, external: { running: true }, closed: { archived: true } } };
  const ids = filter => { const list = a.legacyTeamGroups(index, rows, filter); return [list.groups.flatMap((g) => g.items.map((t) => t.id)), list.others.map((x) => x.id)]; };
  assert.deepEqual(ids(''), [['promoted', 'legacy'], ['native']]);
  assert.deepEqual(ids('running'), [['legacy'], []]);
});

test('Needs you shows real Current work choices; the new places never expose the old team launcher', () => {
  const a = harness();
  const thread = { name: 'Choose', status: 'waiting on you', markdown: 'A: keep the sample; B: extend it' };
  const topic = { id: 'qc', reached: true, file: '/qc/research.md', title: 'QC', waiting: [thread] };
  const ov = { title: 'Root', rootFile: '/research.md', topics: { qc: topic } };
  let sent, route;
  a.AtlasActions.value = { ask: (...args) => { sent = args; }, openThread() {} };
  nodes(a.DecideButtons({topic,thread})).find((n) => n.props.title?.startsWith('Decide B:')).props.onClick();
  assert.equal(sent[0].topic.path, topic.file);
  assert.match(sent[2], /My decision on "Choose": B: extend it/);
  assert.deepEqual(sent[4], {origin:'decide',targetId:'new'});
  const page = nodes(a.LegacyTeamsPlace({overview:ov, go:next=>{route=next;}}));
  assert.ok(!page.some(n => n.children.includes('Start a team') || n.type==='form'));
  page.find(n => n.props['aria-pressed'] === false && n.children.includes('Running')).props.onClick();
  assert.deepEqual(route,{view:'teams',filter:'running'});
});
