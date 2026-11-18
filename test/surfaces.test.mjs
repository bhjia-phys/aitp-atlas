import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const src = (name) => readFileSync(new URL(`../client/${name}.js`, import.meta.url), 'utf8');
const h = (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity).filter((c) => c != null) });
const nodes = (el) => (el && typeof el === 'object' ? [el, ...el.children.flatMap(nodes)] : []);
const named = (name, type) => nodes(name).filter((n) => n.type === type);
const textOf = (el) => (typeof el === 'object' ? el.children.map(textOf).join(' ') : String(el));
function component(file, name, deps) {
  return new Function(...Object.keys(deps), `${src(file)}\nreturn ${name};`)(...Object.values(deps));
}
function state() {
  const slots = [];
  let i = 0;
  return { reset() { i = 0; }, slots,
    useState(v) { const n = i++; if (!(n in slots)) slots[n] = typeof v === 'function' ? v() : v; return [slots[n], (x) => { slots[n] = typeof x === 'function' ? x(slots[n]) : x; }]; } };
}

test('a topic shelf caps the actual rows, keeps the full count, and reversibly reveals the rest', () => {
  const hooks = state();
  const shelf = component('30-topic', 'TopicShelf', { h, Fold: 'Fold', React: { Fragment: 'group' }, useState: hooks.useState });
  const items = Array.from({ length: 8 }, (_, i) => ({ id: `item-${i}` }));
  const draw = (rows = items) => { hooks.reset(); return shelf({ id: 'topic#notes', title: 'Notes', items: rows, renderItem: (x) => x.id }); };
  const head = draw(); assert.equal(head.props.count, 8); assert.equal(head.props.id, 'topic#notes');
  const first = head.children[0](); assert.deepEqual(named(first, 'li').map(textOf), items.slice(0, 5).map((x) => x.id));
  const more = named(first, 'button')[0]; assert.equal(textOf(more), 'Show all (8)'); more.props.onClick();
  const all = draw().children[0](); assert.equal(named(all, 'li').length, 8); named(all, 'button')[0].props.onClick();
  assert.equal(named(draw().children[0](), 'li').length, 5);
  assert.equal(named(draw(items.slice(0, 5)).children[0](), 'button').length, 0);
});

test('topic discussions use current registry filing, not the original context, and retain resolved entries', () => {
  const calls = []; const records = [ ['a', 'open', '/t', 2], ['b', 'resolved', '/t', 4], ['c', 'open', '/t', 3], ['gone', 'open', '/t', 1], ['other', 'open', '/r', 1], ['unfiled', 'open', null, 1] ]
    .map(([id, status, path, created]) => ({ id, status, created, topic: path ? { path } : null, context: { topic: { path: id === 'c' ? '/previous' : '/t' } } }));
  const view = component('30-topic', 'TopicDiscussionShelf', { h, ThreadRow: 'ThreadRow', React: { useContext: () => ({ openThread: (id) => calls.push(id), startAsk: () => calls.push('ask') }), Fragment: 'group' }, AtlasActions: {},
    useThreadIndex: () => records, useSessionRows: () => ({}), pathKey: (s) => s, knownThread: (_, t) => t.id !== 'gone', rowOf: () => ({}), Empty: 'Empty', Button: 'Button' });
  const shelf = view({ file: '/t' }); assert.deepEqual(shelf.props.items.map((t) => t.id), ['c', 'a', 'b']);
  assert.match(shelf.props.hint, /workspace discussion registry/); const row = shelf.props.renderItem(shelf.props.items[2]);
  assert.match(textOf(row), /Resolved/); named(row, 'ThreadRow')[0].props.onOpen(); shelf.props.footer.props.onClick(); assert.deepEqual(calls, ['b', 'ask']);
});

test('PDF control group reflects the current page, scales, fits, and focuses the correct pane', () => {
  const hooks = state(), calls = [], effects = [];
  const visible = [{ dataset: { page: '5' } }, { dataset: { page: '7' } }]; let observe;
  const view = component('40-reader', 'PdfView', { h, useRef: (current) => ({ current }), useState: hooks.useState, useEffect: (f) => effects.push(f), useLayoutEffect() {}, Loading: 'Loading', Button: 'Button', usePaneName: () => 'pdf-tab',
    React: { useContext: () => ({ focusPane: (pane) => calls.push(pane) }) }, AtlasActions: {}, cx: (...xs) => xs.filter(Boolean).join(' '), externalStore: () => ({}),
    focusStore: { get: () => ({ byTab: {} }) }, IntersectionObserver: class { constructor(cb) { observe = cb; } observe() {} disconnect() {} } });
  const draw = () => { effects.length = 0; hooks.reset(); return view({ path: '/fixture/a.pdf' }); };
  const control = (el, label) => named(el, 'Button').find((n) => textOf(n) === label);
  assert.match(textOf(draw()), /Opening/);
  hooks.slots[0] = { numPages: 12 };
  const loaded = draw(); loaded.props.ref.current = { querySelectorAll: () => visible };
  effects[1](); observe(visible.map((target, i) => ({ target, intersectionRatio: i ? 0.8 : 0.2 })));
  const el = draw(); assert.match(textOf(el), /Page 7 \/ 12/);
  control(el, '+').props.onClick(); assert.match(textOf(draw()), /115%/);
  control(draw(), 'Fit').props.onClick(); assert.match(textOf(draw()), /100%/);
  control(draw(), 'Focus').props.onClick(); assert.deepEqual(calls, ['pdf-tab']);
});

test('add-or-write keeps the chosen topic, dismisses the dialog, and forwards the completed document route', () => {
  const hooks = state(); const previousFocus = {}; const events = [];
  const show = component('48-quick', 'QuickAdd', { h, useState: hooks.useState, useRef: (current) => ({ current }), useMemo: (f) => f(), document: { activeElement: previousFocus },
    Dialog: 'Dialog', Segmented: 'Segmented', TextButton: 'TextButton', focusStore: { get: () => ({}) }, paneFocus: () => ({ topic: { path: '/fixture/topic' } }), topicChoices: () => [{ file: '/fixture/topic' }], pathKey: (s) => s });
  const draw = () => { hooks.reset(); return show({ tab: 'note', overview: {}, go: (r) => events.push(r), onClose: () => events.push('closed') }); };
  const note = draw(); assert.equal(note.type, 'Dialog'); assert.equal(note.props.returnFocusRef.current, previousFocus);
  const choose = named(note, 'Segmented')[0]; assert.deepEqual(choose.props.options.map((o) => o.value), ['paper','note','tex']);
  choose.props.onChange('tex'); const tex = nodes(draw()).find((n) => n.type?.name === 'QuickNote'); assert.equal(tex.props.kind, 'tex'); assert.equal(tex.props.topic, '/fixture/topic');
  const route = { view: 'doc', path: '/fixture/topic/draft.tex', edit: true }; tex.props.done(route); assert.deepEqual(events, ['closed', route]);
});

test('the review explains an observed on-disk change and ties Keep/Revert to the right baseline', async () => {
  const hooks = state(); const calls = []; const record = { files: [{ path: '/fixture/n.md', edits: [{ id: 'e1' }] }] };
  hooks.slots[0] = record;
  hooks.slots[1] = true; // user expanded the compact review banner
  const view = component('68-review', 'ReviewPanel', { h, useState: hooks.useState, useCallback: (f) => f, useEffect() {}, baseName: (s) => s.split('/').pop(), plural: (n, v) => `${n} ${v}`, Button: 'Button',
    api: async (op, req) => { calls.push([op, req.body]); return record; } });
  const el = view({ sessionId: 's', flash() {} });
  assert.match(textOf(el), /already in the notes/); assert.match(textOf(el), /does not identify who made them/);
  const card = nodes(el).find((n) => n.type?.name === 'EditCard'); await card.props.onKeep(); await card.props.onRevert();
  assert.deepEqual(calls, ['keep','revert'].map((action) => [`review/${action}`, { session: 's', path: '/fixture/n.md', id: 'e1' }]));
});
