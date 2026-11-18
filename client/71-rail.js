// The DSH sidebar is the only sidebar. Atlas navigation lives in the left pane
// strip, outside the tablist. Old railMode / railHidden prefs are ignored, not
// deleted: switching versions must not alter unrelated preferences.
const ATLAS_DESTINATIONS = [
  ['desk', 'Desk', 'desk'], ['discussions', 'Discussions', 'chat'], ['teams', 'Teams', 'team'],
  ['map', 'Map', 'universe'], ['library', 'Library', 'library'], ['learn', 'Learn', 'learn'], ['write', 'Write', 'writing'],
];

function atlasMenuCount(count) {
  return Number.isSafeInteger(count) && count > 0 ? (count > 99 ? '99+' : String(count)) : '';
}

// FC-3's top hot edge, independent of workspace navigation.
function useAtlasHotEdge(enterDelay, leaveDelay) {
  const [shown, setShown] = useState(false);
  const timer = useRef(null);
  const clear = () => clearTimeout(timer.current);
  useEffect(() => clear, []);
  const schedule = (next) => {
    clear();
    timer.current = setTimeout(() => setShown(next), next ? enterDelay : leaveDelay);
  };
  return { shown, enter: () => schedule(true), leave: () => schedule(false),
    show: () => { clear(); setShown(true); }, hide: () => { clear(); setShown(false); } };
}

function AtlasWorkspaceMenu({ open, onOpen, onClose, activePlace, openPlace, mode, themeModes, unreadCount, teamNeedsCount,
  shortcut, onPalette, onQuick, onTheme, onRefresh, onShortcuts, onAbout }) {
  const anchor = useRef(null), initial = useRef(null), menu = useRef(null);
  const label = 'Atlas destinations';
  const menuId = React.useId();
  const triggerKeys = shortcut('destinations');
  const places = ATLAS_DESTINATIONS.map(([id, name, icon]) => ({ id, name, icon, shortcut: shortcut(id),
    count: id === 'discussions' ? unreadCount : id === 'teams' ? teamNeedsCount : 0,
    countLabel: id === 'discussions' ? 'unread replies' : 'items needing you', current: activePlace === id,
    run: (e) => openPlace(id, { focusComposer: id === 'desk', otherPane: !!e.shiftKey, permanent: !!(e.ctrlKey || e.metaKey || e.button === 1) }) }));
  const actions = [
    { id: 'palette', name: 'Commands', icon: 'mark', shortcut: shortcut('palette'), run: onPalette },
    { id: 'search', name: 'Search', icon: 'search', shortcut: shortcut('search'), current: activePlace === 'search', run: (e) => openPlace('search', { otherPane: !!e.shiftKey }) },
    { id: 'add', name: 'Add or write', icon: 'plus', shortcut: shortcut('quick'), run: () => onQuick('paper') },
    { id: 'theme', name: 'Theme: ' + (THEME_LABEL[mode] || mode), icon: THEME_ICON[mode] || 'contrast', run: () => onTheme(themeModes[(themeModes.indexOf(mode) + 1) % themeModes.length]) },
    { id: 'refresh', name: 'Read the files again', icon: 'refresh', run: onRefresh },
    { id: 'keys', name: 'Keyboard shortcuts', icon: 'keyboard', run: onShortcuts },
    { id: 'about', name: 'About Atlas', icon: 'note', run: onAbout },
  ];
  const first = open === 'last' ? actions.at(-1).id : places[0].id;
  const activate = (item, event) => {
    atlasFocusNode(anchor.current); onClose(); item.run(event);
  };
  const group = (name, items) => h('div', { role: 'group', 'aria-label': name },
    h('div', { className: 'atlas-destinations-group', 'aria-hidden': true }, name),
    items.map(item => {
      const badge = atlasMenuCount(item.count);
      return h('button', { type: 'button', key: item.id, tabIndex: -1, role: 'menuitem', ref: item.id === first ? initial : undefined,
        'aria-current': item.current ? 'page' : undefined, 'aria-label': item.name, 'aria-description': badge ? `${item.count} ${item.countLabel}` : undefined,
        className: 'atlas-destinations-item', onClick: e => activate(item, e), onAuxClick: e => { if (item.count !== undefined && e.button === 1) { e.preventDefault(); activate(item, e); } } },
      h(Icon, { name: item.icon }), h('span', { className: 'atlas-destinations-name' }, item.name),
      badge && h('span', { className: cx('atlas-destinations-count', item.id === 'teams' && 'is-gold'), 'aria-hidden': true }, badge),
      item.shortcut ? h('span', { 'aria-hidden': true }, h(Kbd, null, item.shortcut)) : null);
    }));
  const keydown = e => {
    if (e.isComposing || e.defaultPrevented) return;
    if (e.key === 'Tab') { atlasFocusNode(anchor.current); onClose(); return; }
    const buttons = [...menu.current.querySelectorAll('button[role="menuitem"]')], i = buttons.indexOf(e.target);
    let next = atlasArrowIndex(e.key, i, buttons.length);
    if (next === null && !e.altKey && !e.metaKey && !e.ctrlKey && /^[\p{L}\d]$/u.test(e.key)) {
      const match = [...buttons.slice(i + 1), ...buttons.slice(0, i + 1)].find(b => b.getAttribute('aria-label').toLowerCase().startsWith(e.key.toLowerCase()));
      if (match) next = buttons.indexOf(match);
    }
    if (next !== null) { e.preventDefault(); e.stopPropagation(); atlasFocusNode(buttons[next]); }
  };
  return h(React.Fragment, null,
    h('button', { ref: anchor, type: 'button', className: 'atlas-workspace-trigger', 'aria-label': label, 'aria-haspopup': 'menu',
      'aria-expanded': !!open, 'aria-controls': open ? menuId : undefined, title: [label, triggerKeys].filter(Boolean).join(' · '),
      onClick: () => open ? onClose() : onOpen('first'), onKeyDown: e => { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); onOpen(e.key === 'ArrowUp' ? 'last' : 'first'); } } },
    h(Icon, { name: 'mark' }), h('span', null, 'Atlas'), h(Icon, { name: 'chevron', size: 12 })),
    open && h(Popover, { anchor, id: menuId, role: 'menu', label, nodeRef: menu, initialFocusRef: initial, onClose,
      className: 'atlas-destinations-menu', side: 'bottom', align: 'start', onKeyDown: keydown }, group('Places', places), group('Workspace actions', actions)));
}

// Keep this style export stable for consumers of the concatenated theme.
const ATLAS_RAIL_CSS = `
.atlas-workspace-trigger{height:var(--control-28);display:inline-flex;align-items:center;gap:var(--s-4);margin-right:var(--s-4);padding:0 var(--s-8);flex:none;border:1px solid var(--border-strong);border-radius:var(--r-sm);background:transparent;color:var(--text-1);font:var(--t-ui);font-weight:500;white-space:nowrap;cursor:pointer}
.atlas-workspace-trigger>.atlas-icon:first-child{color:var(--gold)}.atlas-workspace-trigger>.atlas-icon:last-child{color:var(--text-3)}.atlas-workspace-trigger:hover{background:var(--hover)}.atlas-workspace-trigger[aria-expanded=true]{background:var(--selected);border-color:var(--border-control)}.atlas-workspace-trigger:focus-visible{outline:2px solid var(--accent);outline-offset:1px}
.atlas-root .atlas-destinations-menu{width:15rem;overflow-y:auto;padding:var(--s-4);color:var(--text-1)}.atlas-destinations-group{font:var(--t-cap);font-variant-caps:all-small-caps;letter-spacing:.09em;color:var(--text-3);padding:var(--s-4) var(--s-8)}.atlas-destinations-menu>[role=group]+[role=group]{border-top:1px solid var(--border);padding-top:var(--s-4);margin-top:var(--s-4)}
.atlas-destinations-item{width:100%;height:var(--control-32);display:flex;gap:var(--s-8);align-items:center;text-align:start;border:0;border-radius:var(--r-sm);padding:0 var(--s-8);background:transparent;color:var(--text-2);font:var(--t-ui);cursor:pointer}.atlas-destinations-item[aria-current=page]{background:var(--selected);color:var(--accent);font-weight:600}.atlas-destinations-item:hover{background:var(--hover);color:var(--text-1)}.atlas-destinations-item:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}.atlas-destinations-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.atlas-destinations-count{min-width:var(--s-16);padding:0 var(--s-4);border-radius:var(--r-full);text-align:center;font:700 10px/16px var(--font-ui);background:var(--accent);color:var(--text-on-accent)}.atlas-destinations-count.is-gold{background:var(--gold);color:var(--gold-on)}
`;
