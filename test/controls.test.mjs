// Unit tests for the shared client module. Exercise its actual event handlers and
// effect cleanup with injected focus targets and a clock (no renderer/profile/network).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = ['00-runtime.js', '10-ui.js', '11-controls.js'].map(f => readFileSync(new URL('../client/' + f, import.meta.url), 'utf8')).join('\n');
const load = new Function('require', 'document', 'setTimeout', 'clearTimeout', `${source}\nreturn { Button, IconButton, Chip, StatusDot, SeatGlyph, Input, Select, Checkbox, Toggle, Segmented, Empty, EmptyState, Loading, Skeleton, Flash, Toast, useFlash, Menu, Popover, useAtlasDialogFocus, atlasFloatPlacement };`);
function harness() {
  let id = 0, states = [], effects = [], timers = new Map();
  const listeners = new Map();
  const doc = {
    activeElement: null, defaultView: { getComputedStyle: () => ({ visibility: 'visible' }) },
    addEventListener: (key, fn) => listeners.set(key, [...listeners.get(key) || [], fn]),
    removeEventListener: (key, fn) => listeners.set(key, listeners.get(key).filter(cb => cb !== fn)),
  };
  const react = {
    createElement(type, props, ...kids) { return { type, props: { ...props, children: kids.length === 1 ? kids[0] : kids } }; },
    Component: class {}, useRef: current => ({ current }), useCallback: fn => fn, useId: () => ':test' + ++id,
    useEffect: fn => effects.push(fn), useLayoutEffect: fn => effects.push(fn),
    useState: a => { const n = states.push(a) - 1; return [a, next => { states[n] = next; }]; },
  };
  const controls = load(name => name === 'react' ? react : {}, doc, (callback, ms) => { const key = ++id; timers.set(key, { callback, ms }); return key; }, key => timers.delete(key));
  const flush = () => { const cleanups = effects.splice(0).map(run => run()); return () => cleanups.reverse().forEach(cleanup => cleanup?.()); };
  const key = (code, target = doc.activeElement, extra = {}) => ({ key: code, target, ...extra, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, stopPropagation() { this.stopped = true; } });
  const emit = (type, event) => { for (const fn of [...listeners.get(type) || []]) fn(event); return event; };
  const element = (stops = [], props = {}) => {
    const n = { isConnected: true, ownerDocument: doc, tabIndex: 0, getClientRects: () => [{}], matches: () => false, closest: () => null,
      querySelector: () => null, querySelectorAll: () => stops, contains: child => child === n || stops.some(s => s.contains(child)),
      focus: () => { doc.activeElement = n; }, ...props }; return n;
  };
  return { ...controls, states, timers, doc, key, emit, element, flush, listeners };
}

test('buttons, selectable chips, forms and feedback keep native names and callbacks', () => {
  const c = harness(); const native = () => {}, ref = {};
  const btn = c.Button({ onClick: native, 'data-atlas-open': true, disabled: true, primary: true, children: 0 });
  assert.equal(btn.props.onClick, native); assert.equal(btn.props.disabled, true); assert.equal(btn.props['data-atlas-open'], true); assert.equal(btn.props.children[1].props.children, 0);
  assert.throws(() => c.IconButton({ icon: 'close', label: ' ' }), /requires a label/);
  const icon = c.IconButton({ icon: 'close', label: 'Close tab', buttonRef: ref, onClick: native });
  assert.equal(icon.props.label, 'Close tab'); assert.equal(icon.props.children.props['aria-label'], 'Close tab'); assert.equal(icon.props.children.props.ref, ref);
  const chip = c.Chip({ variant: 'suggestion', children: 'Topic', auto: true, dot: 'var(--n1)', onClick: native, selected: false });
  assert.equal(chip.type, 'button'); assert.equal(chip.props['aria-pressed'], false); assert.equal(chip.props.children.at(-1).props.children, 'auto');
  assert.equal(c.Chip({ children: 'Read' }).type, 'span'); assert.equal(c.StatusDot({ status: 'blocked' }).props.children[1], 'blocked');
  assert.equal(c.SeatGlyph({ name: 'referee', slot: 9 }).props.style.borderColor, 'var(--dx)');
  assert.equal(c.Input({ onChange: native, label: 'Name' }).props.onChange, native);
  assert.equal(c.Select({ options: [{ value: 'r', label: 'Recent' }] }).props.children[0].props.value, 'r');
  const toggle = c.Toggle({ label: 'Tell the AI', checked: true, onChange: native });
  const input = c.Checkbox(toggle.props).props.children[0]; assert.equal(input.props.type, 'checkbox'); assert.equal(input.props.role, 'switch'); assert.equal(input.props.onChange, native);
  assert.equal(c.Empty({ children: 'No items.' }).type, c.EmptyState);
  assert.equal(c.Loading({ label: 'Opening…' }).props.children.type, c.Skeleton);
  assert.equal(c.Flash({ message: 'Copied' }).type, c.Toast);
});

test('segments expose one tab stop; Right/Left/Home/End skip disabled choices and report the new value', () => {
  const c = harness(), values = [];
  const tree = c.Segmented({ label: 'View', value: 'a', options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B', disabled: true }, { value: 'c', label: 'C' }], onChange: value => values.push(value) });
  assert.deepEqual(tree.props.children.map(n => n.props.tabIndex), [0, -1, -1]);
  assert.equal(tree.props.children[0].props['aria-checked'], true);
  const a = c.element(), last = c.element(); tree.props.ref.current = c.element([a, last]);
  for (const key of ['ArrowRight', 'ArrowLeft', 'End']) { const e = c.key(key, a); tree.props.onKeyDown(e); assert.equal(e.defaultPrevented, true); assert.equal(c.doc.activeElement, last); }
  tree.props.onKeyDown(c.key('Home', last)); assert.equal(c.doc.activeElement, a); assert.deepEqual(values, ['c', 'c', 'c']);
});

test('anchored placement flips on either axis, aligns its end and clamps long content within the visible Atlas rectangle', () => {
  const { atlasFloatPlacement: place } = harness();
  const bounds = { left: 80, right: 480, top: 30, bottom: 330 }, size = { width: 120, height: 60 };
  assert.deepEqual(place({ left: 300, right: 340, top: 285, bottom: 315 }, size, bounds, 'bottom', 'end'), { left: 220, top: 221, maxWidth: 400, maxHeight: 251, side: 'top' });
  assert.deepEqual(place({ left: 430, right: 460, top: 35, bottom: 55 }, size, bounds, 'right', 'center'), { left: 306, top: 30, maxWidth: 346, maxHeight: 300, side: 'left' });
  const tall = place({ left: 85, right: 120, top: 80, bottom: 110 }, { width: 600, height: 500 }, bounds, 'bottom');
  assert.equal(tall.left, 80); assert.equal(tall.maxWidth, 400); assert.equal(tall.maxHeight, 216); assert.equal(tall.top, 114);
});

test('dialog focuses the field, wraps Tab both ways, recaptures escaped focus and restores the opener on disposal', () => {
  const c = harness(); let closes = 0;
  const opener = c.element(), first = c.element(), last = c.element(), hidden = c.element([], { getClientRects: () => [] }), node = c.element([first, last, hidden]);
  opener.focus(); c.useAtlasDialogFocus({ current: node }, () => closes++, { initialFocusRef: { current: first } }); const dispose = c.flush();
  assert.equal(c.doc.activeElement, first);
  assert.equal(c.emit('keydown', c.key('Tab', first)).defaultPrevented, false);
  assert.equal(c.emit('keydown', c.key('Tab', first, { shiftKey: true })).defaultPrevented, true); assert.equal(c.doc.activeElement, last);
  assert.equal(c.emit('keydown', c.key('Tab', last)).defaultPrevented, true); assert.equal(c.doc.activeElement, first);
  opener.focus(); c.emit('focusin', { target: opener }); assert.equal(c.doc.activeElement, first);
  assert.equal(c.emit('keydown', c.key('Escape')).stopped, true); assert.equal(closes, 1);
  dispose(); assert.equal(c.doc.activeElement, opener); assert.ok([...c.listeners.values()].every(fns => !fns.length));
});

test('a dialog replacing another returns focus to the connected opener, not the detached previous input', () => {
  const c = harness(), previous = c.element(), button = c.element(), field = c.element(), modal = c.element([field]);
  previous.focus(); c.useAtlasDialogFocus({ current: modal }, () => {}, { returnFocusRef: { current: previous } });
  // Between render and layout effects, the old dialog unmounts and restores its trigger.
  previous.isConnected = false; button.focus();
  const close = c.flush(); assert.equal(c.doc.activeElement, field); close(); assert.equal(c.doc.activeElement, button);
});

test('menu focuses the requested end; arrows wrap, skip disabled, native click focuses opener before executing, Tab exits', () => {
  const c = harness(), log = [], anchor = c.element(), first = c.element(), last = c.element();
  const menu = c.Menu({ label: 'Pane', anchor, initial: 'last', onClose: () => log.push('close'), items: [
    { id: 'one', label: 'First' }, { id: 'dead', label: 'Unavailable', disabled: true }, { id: 'two', label: 'Last', onSelect: e => { assert.equal(c.doc.activeElement, anchor); log.push(e.key); } }] });
  assert.equal(menu.props.role, 'menu'); const rows = menu.props.children; assert.ok(rows.every(row => row.props.role === 'menuitem')); assert.equal(rows[1].props.disabled, true);
  rows.at(-1).props.ref.current = last; menu.props.nodeRef.current = c.element([first, last]);
  c.Popover(menu.props); const dispose = c.flush(); assert.equal(c.doc.activeElement, last);
  for (const [key, expected] of [['ArrowDown', first], ['End', last], ['Home', first], ['ArrowUp', last]]) {
    const e = c.key(key); menu.props.onKeyDown(e); assert.equal(e.defaultPrevented, true); assert.equal(c.doc.activeElement, expected);
  }
  const click = c.key('click'); rows.at(-1).props.onClick(click); assert.deepEqual(log, ['close', 'click']);
  last.focus(); const tab = c.key('Tab'); menu.props.onKeyDown(tab); assert.equal(tab.defaultPrevented, false); assert.deepEqual(log, ['close', 'click', 'close']); assert.equal(c.doc.activeElement, anchor);
  dispose();
});

test('nested popover owns Escape and outside dismissal; cleanup reactivates the parent dialog', () => {
  const c = harness(), log = [], opener = c.element(), trigger = c.element(), item = c.element(), popup = c.element([item]), dialog = c.element([trigger, popup]);
  opener.focus(); c.useAtlasDialogFocus({ current: dialog }, () => log.push('dialog')); const endDialog = c.flush();
  c.Popover({ label: 'Actions', nodeRef: { current: popup }, anchor: trigger, initialFocusRef: { current: item }, onClose: () => log.push('popover') }); const endPopup = c.flush();
  assert.equal(c.doc.activeElement, item);
  c.emit('pointerdown', { target: trigger }); c.emit('pointerdown', { target: item }); assert.deepEqual(log, []);
  c.emit('keydown', c.key('Escape')); assert.deepEqual(log, ['popover']); assert.equal(c.doc.activeElement, trigger);
  c.emit('pointerdown', { target: opener }); assert.deepEqual(log, ['popover', 'popover']);
  endPopup(); c.emit('keydown', c.key('Escape')); assert.equal(log.at(-1), 'dialog'); endDialog(); assert.equal(c.doc.activeElement, opener);
});

test('toast replaces instead of stacking, expires at 4s, cleans up timers and runs only the current action once', () => {
  const c = harness(), calls = [];
  const [, flash] = c.useFlash(); const dispose = c.flush();
  const actions = { duration: 6000, action: { label: 'Undo', onClick: e => calls.push(e) } };
  flash('Moved', actions); const old = c.states[0]; assert.equal([...c.timers.values()][0].ms, 6000);
  flash('Saved'); old.action.onClick('stale'); assert.deepEqual(calls, []); assert.equal(c.timers.size, 1); assert.equal([...c.timers.values()][0].ms, 4000); assert.equal(c.states[0], 'Saved');
  const timer = [...c.timers.values()][0]; c.timers.clear(); timer.callback(); assert.equal(c.states[0], '');
  flash('Moved again', actions); const toast = c.Toast({ message: c.states[0] }); assert.equal(toast.props.children[0].props['aria-live'], 'polite');
  const click = toast.props.children[1].props.onClick; click('first'); click('double'); assert.deepEqual(calls, ['first']); assert.equal(c.states[0], ''); assert.equal(c.timers.size, 0);
  flash('Copied'); dispose(); assert.equal(c.timers.size, 0);
});
