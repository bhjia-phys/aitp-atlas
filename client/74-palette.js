// Commands, keyboard resolution and the shell's chrome adapter (SH-17–21).
const ATLAS_CHROME_EMPTY = [];
const atlasChromeServices = externalStore({});
function atlasBindChromeService(name, service) {
  atlasChromeServices.set({ ...atlasChromeServices.get(), [name]: service });
  return () => {
    if (atlasChromeServices.get()[name] !== service) return;
    const next = { ...atlasChromeServices.get() }; delete next[name]; atlasChromeServices.set(next);
  };
}
function useAtlasCatalog(store) {
  const subscribe = useCallback((cb) => store?.subscribe(cb) || (() => {}), [store]);
  const get = useCallback(() => store?.getSnapshot() || ATLAS_CHROME_EMPTY, [store]);
  return React.useSyncExternalStore(subscribe, get);
}

const ATLAS_CHROME_KEYS = [
  ['palette', 'Command palette', 'Ctrl+Shift+P', 'Ctrl+.'], ['search', 'Search', '/'], ['quick', 'Add or write', 'N'],
  ['newDiscussion', 'New discussion', 'Ctrl+Shift+J'], ['ask', 'Ask about this', 'Ctrl+J'],
  ['destinations', 'Open Atlas destinations', 'Ctrl+\\', 'Ctrl+Shift+\\'], ['focus', 'Focus pane', 'Ctrl+Shift+F', 'Ctrl+Alt+F'],
  ['full', 'Full screen (in Focus)', 'Shift+F11'], ['next', 'Next tab', 'Ctrl+Tab', 'Ctrl+PageDown'],
  ['previous', 'Previous tab', 'Ctrl+Shift+Tab', 'Ctrl+PageUp'], ['close', 'Close tab', 'Ctrl+W', 'Ctrl+Alt+W'],
  ['reopen', 'Reopen closed tab', 'Ctrl+Shift+T'], ['moveLeft', 'Move tab to other pane', 'Ctrl+Alt+←'], ['moveRight', 'Move tab to other pane', 'Ctrl+Alt+→'],
  ...ATLAS_DESTINATIONS.map(([id, label], i) => [id, label, `Alt+${i + 1}`]),
];
function atlasPhysicalKey(combo) {
  const parts = combo.split('+');
  const key = parts.pop();
  const code = { '/': 'Slash', '.': 'Period', '\\': 'Backslash', '←': 'ArrowLeft', '→': 'ArrowRight' }[key] ||
    (/^[A-Z]$/.test(key) ? 'Key' + key : /^\d$/.test(key) ? 'Digit' + key : key);
  return { code, modifiers: parts.map((s) => s === 'Ctrl' ? 'control' : s.toLowerCase()).sort() };
}
function atlasKeyOverlap(a, b) {
  return b && (a.code === b.code || a.code === b.secondCode) && a.modifiers.join() === [...b.modifiers].sort().join();
}
// DSH's two observable catalogs contain actual customized bindings, not just defaults.
// A two-key chord also claims its first physical key (either order).
function atlasEffectiveKeys(catalog, fixed, runtime) {
  const taken = [...catalog.map((r) => r.binding), ...fixed.flatMap((r) => r.bindings || [])].filter(Boolean);
  return ATLAS_CHROME_KEYS.map(([id, label, ...options]) => {
    // These browser tab actions are commonly consumed before the page sees them.
    if (runtime === 'web') {
      const webKeys = { next: 'Ctrl+Alt+Shift+→', previous: 'Ctrl+Alt+Shift+←', reopen: 'Ctrl+Alt+Shift+T' };
      if (id === 'close') options.reverse();
      if (webKeys[id]) options.unshift(webKeys[id]);
    }
    const combo = options.find((s) => !taken.some((b) => atlasKeyOverlap(atlasPhysicalKey(s), b))) || '';
    return { id, label, combo, binding: combo ? atlasPhysicalKey(combo) : null };
  });
}

function atlasFrameAcceptsKey(root, target, layout) {
  if (!root || !root.isConnected || !root.getClientRects().length || root.closest('[inert],[hidden],[aria-hidden="true"]')) return false;
  const doc = root.ownerDocument;
  const panel = layout?.panelInfo?.getSnapshot?.();
  if (panel && panel.activePanelId !== PANEL_KEY) return false;
  return target === doc.body || target === doc.documentElement || root.contains(target);
}
function atlasChromeInputOwner(target) {
  return !!(target?.isContentEditable || target?.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"],.atlas-embedded'));
}
function atlasHasOpenOverlay(root) {
  const q = '[role="dialog"],[role="menu"],[data-atlas-overlay],dialog[open]';
  // Portalled DSH/Atlas menus outside the Atlas root also own the keyboard.
  return [...root.ownerDocument.querySelectorAll(q)].some((node) => !node.closest('[inert],[hidden],[aria-hidden="true"]') && node.getClientRects().length);
}
function atlasChromeKey(event, bindings, { canHandle, overlay, editor, focused, browserOwnsEsc }) {
  if (!canHandle || overlay || event.defaultPrevented || event.isComposing || event.keyCode === 229 || event.key === 'Dead' || event.getModifierState?.('AltGraph')) return '';
  const modifiers = ['control', 'alt', 'shift', 'meta'].filter((s) => event[s === 'control' ? 'ctrlKey' : s + 'Key']).sort();
  if (event.key === 'Escape' && !modifiers.length) return focused && !editor && !browserOwnsEsc ? 'focus' : '';
  if (!modifiers.length && editor) return '';
  const binding = bindings.find((b) => b.binding && atlasKeyOverlap({ modifiers, code: event.code }, b.binding));
  if (!binding || (binding.id === 'full' && !focused)) return '';
  return binding.id;
}

const ATLAS_RESULT_GROUPS = ['Commands', 'Places', 'Topics', 'Discussions', 'Teams', 'Recent files'];
// Match a case-folded subsequence. Adjacent letters and word starts matter more
// than small differences in recency. The empty query retains curated command order.
function atlasSubsequence(query, text) {
  if (!query) return 0;
  const s = String(text).toLocaleLowerCase(), q = query.toLocaleLowerCase();
  let prev = -1, score = 0;
  for (const c of q) {
    const i = s.indexOf(c, prev + 1);
    if (i < 0) return -Infinity;
    score += 1 + (i === 0 || /[\s/\\_·—-]/u.test(s[i - 1]) ? 9 : 0) + (prev >= 0 && i === prev + 1 ? 4 : 0) - Math.min(2, (i - prev - 1) / 8);
    prev = i;
  }
  return score + (s === q ? 24 : s.startsWith(q) ? 9 : 0);
}
function atlasPaletteResults(items, input, recent = [], now = Date.now()) {
  const raw = input.trim(), scope = { '>': ['Commands'], '#': ['Topics'], '@': ['Discussions', 'Teams'] }[raw[0]];
  const query = (scope ? raw.slice(1) : raw).trim();
  const groups = new Map(ATLAS_RESULT_GROUPS.map((g) => [g, []]));
  items.forEach((item, index) => {
    if (!groups.has(item.group) || (scope && !scope.includes(item.group))) return;
    const score = Math.max(atlasSubsequence(query, item.label), item.detail && query ? atlasSubsequence(query, item.detail) - 12 : -Infinity);
    if (!Number.isFinite(score)) return;
    const last = recent.indexOf(item.id);
    const freshness = item.updated > 0 ? Math.exp(-Math.max(0, now - item.updated) / (864e5 * 30)) : 0;
    groups.get(item.group).push({ item, index, score: score + (last < 0 ? 0 : 3 / (1 + last)) + freshness });
  });
  return [...groups.values()].flatMap((rows) => rows.sort((a, b) => b.score - a.score || a.index - b.index).slice(0, 6).map((r) => r.item)).slice(0, 30);
}

function atlasPaletteItems(p, threads, rows, bindings, focus, onDestinations, onShortcuts) {
  const shortcuts = new Map(bindings.map((b) => [b.id, b.combo]));
  const commands = [];
  function cmd(id, label, icon, run, detail = '', disabled = false) {
    commands.push({ id: 'cmd:' + id, group: 'Commands', label, icon, detail, disabled, run, shortcut: shortcuts.get(id) });
  }
  cmd('newDiscussion', 'New discussion', 'chat', () => p.onNewDiscussion());
  if (typeof p.onMoveDiscussion === 'function') cmd('moveDiscussion', 'Move discussion to a topic…', 'topics', () => p.onMoveDiscussion());
  cmd('team', 'Assemble a team…', 'team', p.onAssemble, p.onAssemble ? '' : 'Choose a research workspace first', !p.onAssemble);
  cmd('search', 'Search', 'search', (opts) => p.openPlace('search', opts));
  cmd('paper', 'Add a paper', 'paper', () => p.onQuick('paper'));
  cmd('note', 'New note', 'note', () => p.onQuick('note'));
  cmd('tex', 'New LaTeX document', 'writing', () => p.onQuick('tex'));
  cmd('focus', focus.focused ? 'Exit focus' : 'Focus pane', 'expand', focus.toggleFocus);
  cmd('full', 'Full screen', 'expand', focus.fullscreen, focus.focused ? '' : 'Enter Focus first', !focus.focused);
  cmd('destinations', 'Open Atlas destinations', 'mark', onDestinations);
  cmd('split', 'Split', 'split', () => p.onSplit()); cmd('moveLeft', 'Move tab to the other pane', 'move', () => p.onMove());
  cmd('reopen', 'Reopen closed tab', 'back', () => p.onReopen());
  for (const mode of p.themeModes) cmd('theme:' + mode, 'Theme: ' + (mode === 'auto' ? 'Auto' : THEME_LABEL[mode] || mode), THEME_ICON[mode] || 'contrast', () => p.onTheme(mode));
  cmd('refresh', 'Read the files again', 'refresh', () => p.onRefresh()); cmd('keys', 'Keyboard shortcuts', 'keyboard', onShortcuts);
  const places = ATLAS_DESTINATIONS.map(([id, label, icon]) => ({ group: 'Places', id: 'place:' + id, label, icon,
    shortcut: shortcuts.get(id), run: (opts) => p.openPlace(id, { ...opts, focusComposer: id === 'desk' }) }));
  const topics = Object.values(p.overview?.topics || {}).filter((t) => t && t.file && t.id !== '').map((t) => ({ group: 'Topics',
    id: 'topic:' + t.file, label: t.title, icon: 'topics', detail: t.id, run: (opts) => p.openTopic(t.file, opts) }));
  const registry = Array.isArray(p.discussionRecords) ? p.discussionRecords : null;
  const records = new Map();
  // M2's registry is authoritative for discussions (even when empty). Legacy
  // teams keep their existing entry until M3; a registry title wins on overlap.
  const verifiedTeams=Array.isArray(p.teamRecords) ? p.teamRecords : null;
  for (const t of threads) if (t?.id && (!registry || t.kind === 'team') && !(verifiedTeams && t.kind==='team')) records.set(t.id, t);
  for (const t of registry || []) if (t?.id) records.set(t.id, t);
  const index = [...records.values()].filter(t => knownThread(rows, t)).map((t) => {
    const row = rowOf(rows, t.id), team = t.kind === 'team' || !!teamOf(row);
    return { group: team ? 'Teams' : 'Discussions', id: 'session:' + t.id, label: registry && t.title ? t.title : threadLabel(t),
      detail: ('topic' in t ? t.topic?.title : t.context?.topic?.title) || (team ? 'Team discussion' : 'Discussion'),
      updated: t.updated || t.created, icon: team ? 'team' : 'chat', run: (opts) => p.openThread(t.id, opts) };
  });
  const files = (p.recentFiles || []).filter((f) => f.path).map((f) => ({ group: 'Recent files', id: 'file:' + f.path, label: f.title || baseName(f.path),
    icon: 'note', detail: f.path, run: (opts) => p.openFile(f.path, opts) }));
  const teamItems=(verifiedTeams || []).map(t=>({group:'Teams',id:'team:'+t.id,label:t.name,detail:t.topic?.title || (t.legacy?'Legacy team':'Team room'),updated:t.updated || t.created,icon:'team',run:opts=>p.openTeam(t.id,opts)}));
  return [...commands, ...places, ...topics, ...index, ...teamItems, ...files];
}

function AtlasCommandPalette({ items, recent, onClose, onRun }) {
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const box = useRef(null), input = useRef(null), selected = useRef(null);
  const prefix = React.useId();
  useAtlasDialogFocus(box, onClose, { initialFocusRef: input });
  const found = useMemo(() => atlasPaletteResults(items, query, recent), [items, query, recent]);
  const at = Math.max(0, Math.min(cursor, found.length - 1));
  useEffect(() => { selected.current?.scrollIntoView({ block: 'nearest' }); }, [at, query]);
  const key = (e) => {
    if (e.isComposing || e.nativeEvent?.isComposing || e.keyCode === 229) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault(); e.stopPropagation();
      if (found.length) setCursor((at + found.length + (e.key === 'ArrowDown' ? 1 : -1)) % found.length);
    } else if (e.key === 'Enter') {
      e.preventDefault(); e.stopPropagation();
      if (found[at] && !found[at].disabled) onRun(found[at], e.shiftKey);
    }
  };
  return h('div', { className: 'atlas-palette-scrim', onMouseDown: (e) => { if (e.target === e.currentTarget) onClose(); } },
    h('section', { ref: box, tabIndex: -1, role: 'dialog', 'aria-label': 'Command palette', 'aria-modal': true, 'data-atlas-overlay': true, className: 'atlas-palette' },
      h('div', { className: 'atlas-palette-query' }, h(Icon, { name: 'search', size: 20 }), h('input', {
        ref: input, role: 'combobox', 'aria-label': 'Find a command, place, topic or discussion', 'aria-controls': prefix + '-list', 'aria-expanded': true,
        'aria-autocomplete': 'list', 'aria-describedby': prefix + '-scope-hint', 'aria-activedescendant': found.length ? prefix + '-' + at : undefined,
        autoComplete: 'off', value: query, placeholder: 'Type a command, a place, a topic or a discussion…',
        onChange: (e) => { setQuery(e.target.value); setCursor(0); }, onKeyDown: key })),
      h('div', { className: 'atlas-palette-list', role: 'listbox', id: prefix + '-list', 'aria-label': 'Results' },
        !found.length && h('p', { className: 'atlas-palette-empty' }, 'No matches.'),
        ATLAS_RESULT_GROUPS.map((group) => {
          const rows = found.filter((r) => r.group === group);
          return rows.length ? h('div', { key: group, role: 'group', 'aria-label': group },
            h('div', { className: 'atlas-palette-group', 'aria-hidden': true }, group), rows.map((r) => {
              const i = found.indexOf(r);
              return h('div', { key: r.id, role: 'option', id: prefix + '-' + i, className: 'atlas-palette-row', 'aria-disabled': r.disabled || undefined,
                'aria-selected': i === at, ref: i === at ? selected : undefined, onMouseDown: (e) => e.preventDefault(), onPointerMove: () => setCursor(i),
                onClick: (e) => { if (!r.disabled) onRun(r, e.shiftKey); } },
                h(Icon, { name: r.icon }), h('span', { className: 'atlas-palette-label' }, r.label),
                r.detail && h('span', { className: 'atlas-palette-detail' }, r.detail), r.shortcut && h(Kbd, null, r.shortcut));
            })) : null;
        })),
      h('footer', { className: 'atlas-palette-foot' },
        h('div', { className: 'atlas-palette-hints', id: prefix + '-scope-hint' }, h('span', null, '# topics'), h('span', null, '@ discussions & teams'), h('span', null, '> commands')),
        h('div', { className: 'atlas-palette-hints' }, h('span', null, '↑ ↓  Move'), h('span', null, 'Enter  Run'), h('span', null, 'Shift+Enter  Open beside'), h('span', null, 'Esc  Close')))));
}

function useAtlasChrome(p) {
  const services = React.useSyncExternalStore(atlasChromeServices.subscribe, atlasChromeServices.get);
  const layout = services.layout, shortcuts = services.shortcuts;
  const catalog = useAtlasCatalog(shortcuts?.catalog), fixed = useAtlasCatalog(shortcuts?.fixedCatalog);
  const bindings = useMemo(() => atlasEffectiveKeys(catalog, fixed, shortcuts?.runtime), [catalog, fixed, shortcuts]);
  const shortcut = (id) => bindings.find((k) => k.id === id)?.combo || '';
  const focus = useAtlasFocusMode(p.rootRef, layout, p.flash);
  const threads = useThreadIndex(), rows = useSessionRows();
  const [overlay, setOverlay] = useState(null), [menuStart, setMenuStart] = useState('first');
  const [recent, setRecent] = useState(() => { const ids = storageGet('prefs.v1', {})?.recentCommands; return Array.isArray(ids) ? ids.slice(0, 32) : []; });
  const destinations = (start = 'first') => {
    if (focus.focused) focus.toggleFocus(); // The anchor lives in the strip outside Focus.
    setMenuStart(start === 'last' ? 'last' : 'first'); setOverlay('destinations');
  };
  const keys = () => setOverlay('shortcuts');
  const palette = () => setOverlay('palette');
  const close = () => setOverlay(null);
  const run = (item, otherPane) => {
    close(); const history = [item.id, ...recent.filter((id) => id !== item.id)].slice(0, 32); setRecent(history);
    storageSet('prefs.v1', { ...storageGet('prefs.v1', {}), recentCommands: history });
    item.run({ otherPane: !!otherPane });
  };
  const actions = { palette, search: () => p.openPlace('search', {}), quick: () => p.onQuick('paper'), newDiscussion: p.onNewDiscussion,
    ask: p.onAsk, destinations, focus: focus.toggleFocus, full: focus.fullscreen, next: () => p.onCycle(1), previous: () => p.onCycle(-1),
    close: p.onClose, reopen: p.onReopen, moveLeft: p.onMove, moveRight: p.onMove };
  for (const [id] of ATLAS_DESTINATIONS) actions[id] = () => p.openPlace(id, { focusComposer: id === 'desk' });
  const handler = useRef(null);
  handler.current = (e) => {
    const root = p.rootRef.current, target = e.composedPath?.()[0] || e.target;
    if (!atlasFrameAcceptsKey(root, target, layout)) return;
    const command = atlasChromeKey(e, bindings, { canHandle: true, overlay: overlay || atlasHasOpenOverlay(root),
      editor: atlasChromeInputOwner(target), focused: focus.focused, browserOwnsEsc: focus.browserOwnsEsc() });
    if (command && actions[command]) { e.preventDefault(); e.stopPropagation(); if (!e.repeat) actions[command](); }
  };
  useEffect(() => {
    const doc = p.rootRef.current?.ownerDocument;
    if (!doc) return;
    const onKey = (e) => handler.current(e);
    doc.addEventListener('keydown', onKey); return () => doc.removeEventListener('keydown', onKey);
  }, [p.rootRef]);
  return { focused: focus.focused, toggleFocus: focus.toggleFocus,
    workspaceMenu: focus.focused ? null : h(AtlasWorkspaceMenu, { ...p, open: overlay === 'destinations' && menuStart, onOpen: destinations,
      onClose: close, shortcut, onPalette: palette, onAbout: () => setOverlay('about'), onShortcuts: keys }),
    overlays: h(React.Fragment, null,
      focus.focused && h(AtlasFocusHeader, { ...focus, activeTab: p.activeTab, rootRef: p.rootRef }),
      overlay === 'palette' && h(AtlasCommandPalette, { items: atlasPaletteItems(p, threads, rows, bindings, focus, destinations, keys), recent, onClose: close, onRun: run }),
      overlay === 'shortcuts' && h(Dialog, { title: 'Keyboard shortcuts', onClose: close },
        h('p', null, shortcuts ? 'These bindings apply inside Atlas. DSH keeps its own shortcuts.' : 'The DSH shortcut catalog is unavailable. These are the local Atlas bindings.'),
        shortcuts?.runtime === 'web' && h('p', null, 'Web uses the bindings below for tab navigation and reopening, leaving the browser’s own tab shortcuts alone.'),
        h('dl', { className: 'atlas-shortcut-list' }, [...bindings, { id: 'escape', label: 'Exit focus outside an editor or conversation', combo: 'Esc' }].map((b) => h('div', { key: b.id },
          h('dt', null, b.label), h('dd', null, b.combo ? h(Kbd, null, b.combo) : 'Reserved by DSH'))))),
      overlay === 'about' && h(Dialog, { title: 'About Atlas', onClose: close }, h('p', null, typeof ATLAS_VERSION === 'string' ? 'AITP Atlas · ' + ATLAS_VERSION : 'AITP Atlas'), h('p', null, 'A celestial atlas of your research programme.')),
    ) };
}

const ATLAS_PALETTE_CSS = `
.atlas-palette-scrim{position:absolute;inset:0;z-index:var(--z-palette);display:flex;align-items:flex-start;justify-content:center;background:var(--overlay)}
.atlas-palette{box-sizing:border-box;margin-top:12vh;width:640px;max-width:calc(100% - var(--s-32));max-height:calc(100% - 12vh - var(--s-16));display:flex;flex-direction:column;overflow:hidden;color:var(--text-1);background:var(--raised);border:1px solid var(--border);border-radius:var(--r-lg);box-shadow:var(--shadow-3)}
.atlas-palette-query{height:52px;flex:none;display:flex;align-items:center;gap:10px;padding:0 18px;border-bottom:1px solid var(--border);color:var(--text-3)}
.atlas-palette-query input{box-sizing:border-box;min-width:0;flex:1;border:0;background:transparent;color:var(--text-1);font:17px/22px var(--font-ui);outline:none}.atlas-palette-query input::placeholder{color:var(--text-3)}.atlas-palette-query:focus-within{box-shadow:inset 0 -2px var(--accent)}
.atlas-palette-list{padding:6px;overflow:auto}.atlas-palette-group{padding:10px var(--s-12) var(--s-4);font:var(--t-cap);font-size:11px;font-variant-caps:all-small-caps;letter-spacing:.09em;color:var(--text-3)}
.atlas-palette-row{height:36px;display:flex;align-items:center;gap:10px;padding:0 var(--s-12);border-radius:var(--r-sm);font:var(--t-ui);cursor:pointer}.atlas-palette-row .atlas-icon{flex:none;color:var(--text-3)}.atlas-palette-row[aria-selected=true]{background:var(--selected)}.atlas-palette-row[aria-disabled=true]{cursor:default;color:var(--text-3)}
.atlas-palette-label,.atlas-palette-detail{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.atlas-palette-detail{min-width:0;color:var(--text-3);font:var(--t-meta)}.atlas-palette-row kbd{margin-left:auto;flex:none}
.atlas-palette-foot{min-height:36px;flex:none;display:flex;align-items:center;flex-wrap:wrap;justify-content:space-between;gap:var(--s-4) var(--s-16);padding:var(--s-4) 18px;border-top:1px solid var(--border);font:var(--t-meta);color:var(--text-3)}.atlas-palette-hints{display:flex;flex-wrap:wrap;gap:var(--s-4) var(--s-12);min-width:0}.atlas-palette-hints span{white-space:nowrap}.atlas-palette-empty{padding:var(--s-12);font:var(--t-count);color:var(--text-3)}
.atlas-shortcut-list{margin:0}.atlas-shortcut-list>div{display:flex;align-items:center;justify-content:space-between;gap:var(--s-16);min-height:var(--s-32);border-top:1px solid var(--border);font:var(--t-ui)}.atlas-shortcut-list dd{margin:0;color:var(--text-2)}
`;
