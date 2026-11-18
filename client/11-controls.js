// Atlas-owned controls. Form inputs forward native props and events; the single-choice
// Segmented reports its value. Overlays stay in Atlas's DOM (even in fullscreen).
function IconButton({ label, icon, children, small, buttonRef, className, tooltip = label, side, ...props }) {
  if (typeof label !== 'string' || !label.trim()) throw new TypeError('IconButton requires a label');
  return h(Tooltip, { label: tooltip, side }, h('button', { type: 'button', ...props, ref: buttonRef,
    className: cx('atlas-icon-button', small && 'is-small', className), 'aria-label': label },
    icon ? h(Icon, { name: icon }) : children));
}

function Input({ label, inputRef, className, ...props }) {
  return h('input', { 'aria-label': label, ...props, ref: inputRef, className: cx('atlas-control-input', className) });
}

function Select({ label, inputRef, options, children, className, ...props }) {
  return h('select', { 'aria-label': label, ...props, ref: inputRef, className: cx('atlas-control-select', className) },
    children ?? options?.map(o => h('option', { key: o.value, value: o.value, disabled: o.disabled }, o.label)));
}

function Checkbox({ label, children, inputRef, className, ...props }) {
  return h('label', { className: cx('atlas-control-check', className) },
    h('input', { ...props, type: 'checkbox', ref: inputRef }), children ?? label);
}

function Toggle(props) {
  return h(Checkbox, { ...props, role: 'switch', className: cx('atlas-control-toggle', props.className) });
}

function Segmented({ label, value, options, onChange, className }) {
  const group = useRef(null);
  const enabled = options.filter(o => !o.disabled);
  const active = enabled.find(o => o.value === value) || enabled[0];
  const onKeyDown = event => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const buttons = [...group.current.querySelectorAll('button:enabled')];
    const i = buttons.indexOf(event.target);
    const next = atlasArrowIndex(event.key, i, buttons.length, true);
    if (next === null) return;
    event.preventDefault(); event.stopPropagation();
    buttons[next].focus();
    if (enabled[next].value !== value) onChange(enabled[next].value);
  };
  return h('div', { ref: group, className: cx('atlas-control-segmented', className), role: 'radiogroup', 'aria-label': label, onKeyDown },
    options.map(o => h('button', { key: o.value, type: 'button', disabled: o.disabled, role: 'radio', 'aria-checked': value === o.value,
      tabIndex: o === active ? 0 : -1, onClick: () => { if (value !== o.value) onChange(o.value); } }, o.label)));
}

function Kbd({ children }) { return h('kbd', { className: 'atlas-control-kbd' }, children); }
function Banner({ tone = 'info', children, className, ...props }) {
  return h('div', { role: tone === 'error' ? 'alert' : 'status', ...props, className: cx('atlas-control-banner', 'atlas-banner-' + tone, className) }, children);
}
function EmptyState({ children, className }) { return h('p', { className: cx('atlas-empty', className) }, children); }
function Skeleton({ rows = 3, label = 'Loading…' }) {
  return h('div', { className: 'atlas-control-skeleton', role: 'status' }, h('span', null, label),
    Array.from({ length: rows }, (_, i) => h('div', { key: i, 'aria-hidden': true })));
}
function StatusDot({ status, label = status }) {
  if (!label) return null;
  const key = String(status).toLowerCase();
  const color = ({ running: 'var(--accent)', working: 'var(--accent)', waiting: 'var(--gold)', idle: 'var(--text-3)', done: 'var(--success-text)' })[key] || STATUS_DOT[key] || 'var(--status-other)';
  return h('span', { className: 'atlas-status-dot' }, h('span', { className: 'atlas-dot', 'aria-hidden': true, style: { background: color } }), label);
}
function SeatGlyph({ name, slot = 0 }) {
  if (!name) return null;
  const color = Number.isInteger(slot) && slot >= 1 && slot <= 8 ? `var(--n${slot})` : 'var(--dx)';
  return h('span', { className: 'atlas-seat-glyph', role: 'img', 'aria-label': name, title: name, style: { borderColor: color } }, name.slice(0, 1).toUpperCase());
}
function Toast({ message }) {
  const text = typeof message === 'string' ? message : message?.text;
  const action = message?.action;
  // Keep the live region mounted, but don't announce the action a second time with the text.
  return h('div', { className: cx('atlas-control-toast', text && 'has-message') },
    h('span', { role: 'status', 'aria-live': 'polite', 'aria-atomic': true }, text || ''),
    text && action ? h(Button, { quiet: true, small: true, onClick: action.onClick }, action.label) : null);
}

function atlasArrowIndex(key, index, count, horizontal = false) {
  if (!count) return null;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  if (key === 'ArrowDown' || (horizontal && key === 'ArrowRight')) return (index + 1) % count;
  if (key === 'ArrowUp' || (horizontal && key === 'ArrowLeft')) return index < 1 ? count - 1 : index - 1;
  return null;
}

function atlasAnchorNode(anchor) { return anchor && 'current' in anchor ? anchor.current : anchor; }
function atlasFocusNode(node) { if (node?.isConnected && !node.disabled) node.focus({ preventScroll: true }); }
function atlasTabStops(root) {
  return [...root.querySelectorAll('button, input, select, textarea, a[href], [tabindex], [contenteditable="true"], summary, iframe')]
    .filter(n => n.tabIndex >= 0 && !n.matches(':disabled') && !n.closest('[inert], [hidden], [aria-hidden="true"]') && n.getClientRects().length && n.ownerDocument.defaultView.getComputedStyle(n).visibility !== 'hidden');
}

// Each listener checks the same stack. Escape dismisses just the top layer, even
// when a menu lives in a dialog. No listeners or stack entries outlive a mount.
const ATLAS_OPEN_LAYERS = [];
function atlasRegisterLayer(node) {
  const child = ATLAS_OPEN_LAYERS.findIndex(other => node.contains(other));
  ATLAS_OPEN_LAYERS.splice(child < 0 ? ATLAS_OPEN_LAYERS.length : child, 0, node);
  return () => { const i = ATLAS_OPEN_LAYERS.indexOf(node); if (i >= 0) ATLAS_OPEN_LAYERS.splice(i, 1); };
}
function atlasOwnsLayer(node) { return ATLAS_OPEN_LAYERS.at(-1) === node; }

function useAtlasDialogFocus(ref, onClose, { initialFocusRef, returnFocusRef } = {}) {
  const opener = useRef(typeof document !== 'undefined' ? document.activeElement : null);
  const latest = useRef(onClose); latest.current = onClose;
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const doc = node.ownerDocument;
    const release = atlasRegisterLayer(node);
    // A palette command can replace one dialog with another in one commit. The
    // previous dialog's focused field is now detached; its cleanup just restored
    // the real opener, so prefer that over a stale render-time reference.
    const restore = [atlasAnchorNode(returnFocusRef), opener.current, doc.activeElement].find(target => target?.isConnected && !node.contains(target));
    const initial = () => atlasFocusNode(atlasAnchorNode(initialFocusRef) || atlasTabStops(node.querySelector('.atlas-control-dialog-body') || node)[0] || atlasTabStops(node)[0] || node);
    if (atlasOwnsLayer(node)) initial();
    const keyboard = event => {
      if (!atlasOwnsLayer(node) || event.defaultPrevented || event.isComposing) return;
      if (event.key === 'Escape') {
        event.preventDefault(); event.stopPropagation(); latest.current?.(event); return;
      }
      if (event.key !== 'Tab') return;
      const stops = atlasTabStops(node);
      const i = stops.indexOf(doc.activeElement);
      if (i < 0 || (event.shiftKey ? i === 0 : i === stops.length - 1)) {
        event.preventDefault(); atlasFocusNode((event.shiftKey ? stops.at(-1) : stops[0]) || node);
      }
    };
    const focus = event => { if (atlasOwnsLayer(node) && !node.contains(event.target)) initial(); };
    doc.addEventListener('keydown', keyboard);
    doc.addEventListener('focusin', focus);
    return () => {
      const wasTop = atlasOwnsLayer(node);
      release(); doc.removeEventListener('keydown', keyboard); doc.removeEventListener('focusin', focus);
      if (wasTop || node.contains(doc.activeElement)) atlasFocusNode(restore);
    };
  }, [ref]);
}

function Dialog({ title, onClose, initialFocusRef, returnFocusRef, wide, className, children, footer }) {
  const ref = useRef(null);
  const titleId = React.useId();
  useAtlasDialogFocus(ref, onClose, { initialFocusRef, returnFocusRef });
  return h('div', { className: 'atlas-control-scrim', onMouseDown: event => { if (event.target === event.currentTarget && atlasOwnsLayer(ref.current)) onClose(event); } },
    h('section', { ref, className: cx('atlas-control-dialog', wide && 'is-wide', className), tabIndex: -1, role: 'dialog', 'aria-modal': true, 'aria-labelledby': titleId, 'data-atlas-overlay': 'dialog' },
      h('header', { className: 'atlas-control-dialog-header' }, h('h2', { id: titleId }, title), h(IconButton, { label: 'Close dialog', icon: 'close', onClick: onClose })),
      h('div', { className: 'atlas-control-dialog-body' }, children),
      footer != null ? h('footer', { className: 'atlas-control-dialog-footer' }, footer) : null));
}

/** Pick the side with room, clamp to Atlas's visible rectangle, keep long content scrollable. */
function atlasFloatPlacement(anchor, size, bounds, side = 'bottom', align = 'start', gap = 4) {
  const room = { top: anchor.top - bounds.top - gap, bottom: bounds.bottom - anchor.bottom - gap,
    left: anchor.left - bounds.left - gap, right: bounds.right - anchor.right - gap };
  const opposite = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' }[side];
  const vertical = side === 'top' || side === 'bottom';
  if (room[side] < (vertical ? size.height : size.width) && room[opposite] > room[side]) side = opposite;
  const maxWidth = Math.max(1, vertical ? bounds.right - bounds.left : room[side]);
  const maxHeight = Math.max(1, vertical ? room[side] : bounds.bottom - bounds.top);
  const w = Math.min(size.width, maxWidth), ht = Math.min(size.height, maxHeight);
  const cross = (start, end, extent) => align === 'end' ? end - extent : align === 'center' ? (start + end - extent) / 2 : start;
  const left = vertical ? cross(anchor.left, anchor.right, w) : side === 'left' ? anchor.left - gap - w : anchor.right + gap;
  const top = !vertical ? cross(anchor.top, anchor.bottom, ht) : side === 'top' ? anchor.top - gap - ht : anchor.bottom + gap;
  return { left: Math.max(bounds.left, Math.min(left, bounds.right - w)), top: Math.max(bounds.top, Math.min(top, bounds.bottom - ht)), maxHeight, maxWidth, side };
}

function useAtlasFloat(ref, anchor, side, align) {
  useLayoutEffect(() => {
    const node = ref.current, trigger = atlasAnchorNode(anchor);
    if (!node || !trigger) return;
    const view = node.ownerDocument.defaultView;
    const root = trigger.closest('.atlas-root');
    // Native manual popover enters the top layer without portaling to the host's body.
    // This avoids clipping AND fixed-position containing blocks in scrolled tab panels.
    node.showPopover?.();
    const place = () => {
      const r = root?.getBoundingClientRect();
      const bounds = { left: Math.max(0, r?.left ?? 0) + 4, top: Math.max(0, r?.top ?? 0) + 4,
        right: Math.min(view.innerWidth, r?.right ?? Infinity) - 4, bottom: Math.min(view.innerHeight, r?.bottom ?? Infinity) - 4 };
      const box = node.getBoundingClientRect();
      const size = { width: Math.max(box.width, node.scrollWidth + node.offsetWidth - node.clientWidth), height: Math.max(box.height, node.scrollHeight + node.offsetHeight - node.clientHeight) };
      const pos = atlasFloatPlacement(trigger.getBoundingClientRect(), size, bounds, side, align);
      Object.assign(node.style, { left: pos.left + 'px', top: pos.top + 'px', maxWidth: pos.maxWidth + 'px', maxHeight: pos.maxHeight + 'px' });
    };
    place();
    const observer = view.ResizeObserver && new view.ResizeObserver(place);
    observer?.observe(node); observer?.observe(trigger); if (root) observer?.observe(root);
    view.addEventListener('scroll', place, true); view.addEventListener('resize', place);
    return () => { observer?.disconnect(); view.removeEventListener('scroll', place, true); view.removeEventListener('resize', place); if (node.matches(':popover-open')) node.hidePopover(); };
  }, [anchor, ref, side, align]);
}

function AtlasFloat({ anchor, side = 'bottom', align = 'start', children, nodeRef, ...props }) {
  useAtlasFloat(nodeRef, anchor, side, align);
  return h('div', { popover: 'manual', ...props, ref: nodeRef }, children);
}

function Tooltip({ label, children, side = 'top', delay = 400 }) {
  const anchor = useRef(null), tip = useRef(null), timer = useRef(null);
  const [open, setOpen] = useState(false);
  const id = React.useId();
  const show = () => { clearTimeout(timer.current); timer.current = setTimeout(() => setOpen(true), delay); };
  const hide = () => { clearTimeout(timer.current); setOpen(false); };
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (!open) return;
    const doc = anchor.current.ownerDocument;
    const escape = e => { if (e.key === 'Escape') hide(); };
    doc.addEventListener('keydown', escape); return () => doc.removeEventListener('keydown', escape);
  }, [open]);
  if (!label) return children;
  const visible = open && !children.props['aria-expanded'];
  return h('span', { className: 'atlas-tooltip-anchor', ref: anchor, onPointerEnter: show, onPointerLeave: hide, onFocus: show, onBlur: hide, onPointerDown: hide },
    visible ? React.cloneElement(children, { 'aria-describedby': cx(children.props['aria-describedby'], id) }) : children,
    visible ? h(AtlasFloat, { anchor, nodeRef: tip, side, align: 'center', id, role: 'tooltip', className: 'atlas-control-tip' }, label) : null);
}

function Popover({ anchor, label, children, onClose, initialFocusRef, autoFocus = true, nodeRef, side, align, role = 'dialog', className, ...props }) {
  const localRef = useRef(null), ref = nodeRef || localRef;
  const latest = useRef(onClose); latest.current = onClose;
  useLayoutEffect(() => {
    const node = ref.current, trigger = atlasAnchorNode(anchor);
    if (!node || !trigger) return;
    const doc = node.ownerDocument, release = atlasRegisterLayer(node);
    if (autoFocus) atlasFocusNode(atlasAnchorNode(initialFocusRef) || atlasTabStops(node)[0] || node);
    const keydown = event => {
      if (event.defaultPrevented || event.isComposing || event.key !== 'Escape' || !atlasOwnsLayer(node)) return;
      event.stopPropagation(); event.preventDefault();
      if (autoFocus || node.contains(doc.activeElement)) atlasFocusNode(trigger);
      latest.current?.(event);
    };
    const outside = event => {
      if (atlasOwnsLayer(node) && !node.contains(event.target) && !trigger.contains(event.target)) latest.current?.(event);
    };
    doc.addEventListener('keydown', keydown);
    doc.addEventListener('pointerdown', outside, true);
    doc.addEventListener('focusin', outside);
    return () => {
      release(); doc.removeEventListener('keydown', keydown); doc.removeEventListener('pointerdown', outside, true); doc.removeEventListener('focusin', outside);
      if (node.contains(doc.activeElement)) atlasFocusNode(trigger);
    };
  }, [anchor, ref, autoFocus]);
  return h(AtlasFloat, { ...props, anchor, side, align, nodeRef: ref, role, tabIndex: -1, 'aria-label': label, 'data-atlas-overlay': role,
    className: cx('atlas-control-popover', className) }, children);
}

function Menu({ anchor, items, onClose, label, initial = 'first', side, align, className, ...props }) {
  const ref = useRef(null), first = useRef(null);
  const enabled = items.filter(item => !item.disabled);
  const start = initial === 'last' ? enabled.at(-1) : enabled[0];
  const keydown = event => {
    const buttons = [...ref.current.querySelectorAll('button:enabled')];
    const next = atlasArrowIndex(event.key, buttons.indexOf(event.target), buttons.length);
    if (next !== null) { event.preventDefault(); event.stopPropagation(); buttons[next].focus(); }
    // Continue ordinary Tab traversal from the opener (including Shift+Tab).
    if (event.key === 'Tab') { atlasFocusNode(atlasAnchorNode(anchor)); onClose(event); }
  };
  return h(Popover, { ...props, anchor, role: 'menu', label, onClose, side, align, nodeRef: ref, initialFocusRef: first, className: cx('atlas-control-menu', className), onKeyDown: keydown },
    items.map(item => h('button', { type: 'button', role: 'menuitem', key: item.id ?? item.label, ref: item === start ? first : undefined,
      disabled: item.disabled, tabIndex: -1, title: item.title, className: 'atlas-control-menu-item', onClick: event => {
        atlasFocusNode(atlasAnchorNode(anchor)); onClose(event); item.onSelect?.(event);
      } }, item.icon ? h(Icon, { name: item.icon }) : null,
      h('span', { className: 'atlas-control-menu-text' }, h('span', null, item.label), item.hint ? h('small', null, item.hint) : null),
      item.shortcut ? h(Kbd, null, item.shortcut) : null)));
}

// Radii, sizes and typography are inherited from the theme. Half/quarter steps below
// match the mock's 2px inset, 6px gap, 10px compact and 14px regular button padding.
const ATLAS_CONTROL_CSS = `
.atlas-root :is(.atlas-button,.atlas-icon-button,.atlas-chip,.atlas-control-input,.atlas-control-select,.atlas-control-segmented,.atlas-control-popover,.atlas-control-tip,.atlas-control-dialog,.atlas-control-toast) { box-sizing:border-box; }
.atlas-root .atlas-button { height:var(--control-32); gap:calc(var(--s-12)/2); padding:0 calc(var(--control-28)/2); border:1px solid var(--border-strong); border-radius:var(--r-sm); background:transparent; color:var(--text-1); font:var(--t-ui); font-weight:500; white-space:nowrap; box-shadow:none; transition:background-color var(--motion-hover) var(--ease); }
.atlas-root .atlas-button:hover:not(:disabled) { background:var(--hover); border-color:var(--border-strong); }
.atlas-root .atlas-button.is-primary { background:var(--accent); color:var(--text-on-accent); border-color:transparent; box-shadow:none; }
.atlas-root .atlas-button.is-primary:hover:not(:disabled) { background:var(--accent-hover); border-color:transparent; }
.atlas-root .atlas-button.is-quiet { border-color:transparent; color:var(--text-2); background:transparent; }
.atlas-root .atlas-button.is-quiet:hover:not(:disabled) { border-color:transparent; color:var(--text-1); background:var(--hover); }
.atlas-root .atlas-button.is-small { height:var(--control-28); padding-inline:calc(var(--s-20)/2); border-radius:var(--r-sm); }
.atlas-root .atlas-button.is-split { border-radius:var(--r-sm) 0 0 var(--r-sm); }
.atlas-root .atlas-button.is-caret { width:var(--control-28); height:var(--control-32); padding:0; border-radius:0 var(--r-sm) var(--r-sm) 0; }
.atlas-root .atlas-icon-button { width:var(--control-28); height:var(--control-28); padding:0; display:inline-grid; place-items:center; border:0; color:var(--text-3); background:transparent; border-radius:var(--r-sm); }
.atlas-root .atlas-icon-button.is-small { width:var(--control-24); height:var(--control-24); }
.atlas-root .atlas-icon-button:hover:not(:disabled) { background:var(--hover); color:var(--text-1); }
.atlas-root .atlas-chip { display:inline-flex; align-items:center; height:var(--control-24); gap:calc(var(--s-12)/2); padding:0 var(--s-8); border:1px solid var(--border); border-radius:var(--r-full); background:transparent; color:var(--text-2); font:var(--t-meta); font-weight:500; white-space:nowrap; }
.atlas-root .atlas-chip-auto { border:1px dashed var(--border-control); }
.atlas-root .atlas-chip-auto-label { color:var(--text-3); font:var(--t-count); }
.atlas-root .atlas-chip-needs,.atlas-root .atlas-chip.is-new { color:var(--gold); background:var(--gold-soft); border-color:transparent; }
.atlas-root .atlas-chip-context { border-radius:var(--r-sm); border-color:transparent; background:var(--sunken); }
.atlas-root .atlas-chip-key { font:var(--t-cap); font-variant-caps:all-small-caps; letter-spacing:.09em; color:var(--text-3); }
.atlas-root .atlas-chip-suggestion { height:var(--control-28); padding:0 var(--s-12); font:var(--t-ui); }
.atlas-root button.atlas-chip:hover:not(:disabled) { background:var(--hover); border-color:var(--border-strong); }
.atlas-root .atlas-chip[aria-pressed=true] { background:var(--accent-soft); border-color:var(--accent); color:var(--text-1); }
.atlas-root :is(.atlas-control-input,.atlas-control-select) { height:var(--control-32); min-width:0; padding:0 calc(var(--s-20)/2); border:1px solid var(--border-control); border-radius:var(--r-sm); background:var(--sunken); color:var(--text-1); font:var(--t-body); }
.atlas-root .atlas-control-input::placeholder { color:var(--text-3); opacity:1; }
.atlas-root :is(.atlas-control-input,.atlas-control-select):focus { border-color:var(--accent); }
.atlas-control-check { display:inline-flex; align-items:center; gap:var(--s-8); color:var(--text-2); font:var(--t-ui); cursor:pointer; }
.atlas-control-check input { appearance:none; box-sizing:border-box; display:grid; place-content:center; flex:none; margin:0; width:var(--s-16); height:var(--s-16); border:1px solid var(--border-control); border-radius:var(--r-xs); background:var(--sunken); color:var(--text-on-accent); }
.atlas-control-check input:checked { background:var(--accent); border-color:var(--accent); }
.atlas-control-check input:checked::after { content:'✓'; font:var(--t-meta); font-weight:bold; }
.atlas-control-toggle input { width:var(--control-28); border-radius:var(--r-full); padding:0 2px; justify-content:start; }
.atlas-control-toggle input::after { content:''; width:var(--s-12); height:var(--s-12); border-radius:50%; background:var(--text-3); }
.atlas-control-toggle input:checked { justify-content:end; }
.atlas-control-toggle input:checked::after { content:''; background:var(--text-on-accent); }
.atlas-control-segmented { display:inline-flex; height:var(--control-28); align-items:stretch; gap:2px; padding:2px; border-radius:var(--r-full); background:var(--sunken); box-shadow:inset 0 0 0 1px var(--border); }
.atlas-control-segmented button { border:0; display:grid; place-content:center; padding:0 var(--s-12); border-radius:var(--r-full); color:var(--text-2); background:transparent; cursor:pointer; font:var(--t-ui); }
.atlas-control-segmented button:hover:not(:disabled) { background:var(--hover); }
.atlas-control-segmented button[aria-checked=true] { background:var(--raised); color:var(--text-1); font-weight:500; box-shadow:0 0 0 1px var(--border-strong); }
.atlas-control-kbd { display:inline-block; font:var(--t-meta); font-family:var(--font-mono); padding:0 var(--s-4); border-radius:var(--r-xs); border:1px solid var(--border-strong); border-bottom-width:2px; background:var(--sunken); color:var(--text-2); }
.atlas-control-banner { display:flex; align-items:center; gap:var(--s-8); padding:var(--s-8) var(--s-12); border-radius:var(--r-md); color:var(--text-1); background:var(--accent-soft); font:var(--t-ui); }
.atlas-banner-needs,.atlas-banner-warning { background:var(--gold-soft); color:var(--gold); }
.atlas-banner-error { background:var(--danger-soft); color:var(--danger-text); }
.atlas-root .atlas-empty { margin:var(--s-8) 0; color:var(--text-3); font:var(--t-count); }
.atlas-control-skeleton { display:grid; gap:var(--s-12); padding:var(--s-16) 0; font:var(--t-meta); color:var(--text-3); }
.atlas-control-skeleton > div { height:var(--s-12); background:var(--pressed); border-radius:var(--r-xs); }
.atlas-control-skeleton > div:last-child { width:66%; }
.atlas-status-dot { display:inline-flex; align-items:center; gap:var(--s-8); font:var(--t-ui); }
.atlas-seat-glyph { display:inline-grid; place-items:center; width:var(--control-28); height:var(--control-28); border:1px solid; border-radius:50%; background:var(--sunken); color:var(--text-1); font:var(--t-cap); }
.atlas-control-toast { position:absolute; left:50%; bottom:var(--s-16); transform:translateX(-50%); z-index:var(--z-toast); max-width:min(480px,calc(100% - var(--s-32))); width:max-content; pointer-events:none; }
.atlas-control-toast.has-message { display:flex; align-items:center; gap:var(--s-12); padding:var(--s-8) var(--s-16); border:1px solid var(--border); border-radius:var(--r-full); color:var(--text-1); background:var(--raised); box-shadow:var(--shadow-2); font:var(--t-ui); pointer-events:auto; overflow-wrap:anywhere; }
.atlas-root .atlas-control-toast .atlas-button { color:var(--accent); border-radius:var(--r-full); }
.atlas-tooltip-anchor { display:inline-flex; flex:none; align-items:center; }
.atlas-control-tip,.atlas-control-popover { position:fixed; inset:auto; margin:0; overflow:auto; border:1px solid var(--border); border-radius:var(--r-md); background:var(--raised); color:var(--text-1); box-shadow:var(--shadow-2); z-index:var(--z-popover); }
.atlas-control-tip { width:max-content; padding:var(--s-4) var(--s-8); border-radius:var(--r-sm); font:var(--t-meta); }
.atlas-control-popover { padding:var(--s-16); font:var(--t-ui); }
.atlas-control-menu { width:max-content; padding:var(--s-4); }
.atlas-control-menu-item { display:flex; align-items:center; gap:var(--s-8); width:100%; min-height:var(--row-36); padding:var(--s-4) var(--s-12); border:0; border-radius:var(--r-sm); background:transparent; color:var(--text-1); font:var(--t-ui); text-align:start; cursor:pointer; }
.atlas-control-menu-item:hover:not(:disabled),.atlas-control-menu-item:focus { background:var(--hover); }
.atlas-control-menu-text { display:flex; flex:1; min-width:0; flex-direction:column; }
.atlas-control-menu-item small { font:var(--t-meta); color:var(--text-3); }
.atlas-control-scrim { position:absolute; inset:0; z-index:var(--z-dialog); display:grid; place-items:center; background:var(--overlay); }
.atlas-control-dialog { display:flex; flex-direction:column; width:min(560px,calc(100% - var(--s-32))); max-height:88%; overflow:hidden; background:var(--raised); color:var(--text-1); border:1px solid var(--border); border-radius:var(--r-lg); box-shadow:var(--shadow-3); }
.atlas-control-dialog.is-wide { width:min(900px,calc(100% - var(--s-32))); }
.atlas-control-dialog-header,.atlas-control-dialog-footer { display:flex; align-items:center; gap:var(--s-8); padding:0 var(--s-24); flex:none; }
.atlas-control-dialog-header { height:calc(var(--s-40) + var(--s-20)); padding-right:var(--s-12); border-bottom:1px solid var(--border); }
.atlas-control-dialog-header h2 { flex:1; margin:0; font:var(--t-h2); }
.atlas-control-dialog-body { min-height:0; overflow:auto; padding:var(--s-20) var(--s-24); }
.atlas-control-dialog-footer { min-height:calc(2 * var(--s-32)); border-top:1px solid var(--border); justify-content:flex-end; }
.atlas-root :is(.atlas-button,.atlas-icon-button,button.atlas-chip,.atlas-control-input,.atlas-control-select,.atlas-control-check input,.atlas-control-segmented button,.atlas-control-menu-item):focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
.atlas-root .atlas-control-menu-item:focus-visible { outline-offset:-2px; }
.atlas-root :is(.atlas-button,.atlas-icon-button,button.atlas-chip,.atlas-control-segmented button,.atlas-control-menu-item):active:not(:disabled) { box-shadow:inset 0 0 0 var(--s-32) var(--pressed); }
.atlas-root :is(.atlas-button,.atlas-icon-button,.atlas-control-input,.atlas-control-select,.atlas-control-segmented button,.atlas-control-menu-item,button.atlas-chip):disabled,.atlas-control-check:has(:disabled) { opacity:.4; cursor:default; }
@media(prefers-reduced-motion:reduce) { .atlas-root .atlas-button { transition:none; } }
@media(forced-colors:active) { .atlas-control-check input { appearance:auto; } .atlas-control-check input::after { display:none; } }
`;
