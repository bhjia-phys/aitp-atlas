// Shell navigation (SH-2/3/7–10). Place ids, accessible names and shortcuts share this order.
const ATLAS_RAIL_PLACES = [
  ['desk', 'Desk', 'desk'], ['discussions', 'Discussions', 'chat'], ['teams', 'Teams', 'team'],
  ['map', 'Map', 'universe'], ['library', 'Library', 'library'], ['learn', 'Learn', 'learn'], ['write', 'Write', 'writing'],
];

function atlasRailPreference(prefs) {
  return { hidden: prefs?.railHidden === true, visible: prefs?.railMode === 'labels' ? 'labels' : 'icons' };
}

function atlasRailNext(pref, action) {
  return action === 'labels' ? { hidden: false, visible: pref.visible === 'labels' ? 'icons' : 'labels' }
    : { ...pref, hidden: !pref.hidden };
}

function atlasRailCount(count) {
  return Number.isSafeInteger(count) && count > 0 ? (count > 99 ? '99+' : String(count)) : '';
}

// Shared by the two hot edges. Hover is delayed; keyboard activation is immediate.
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

function AtlasRail({ pref, onMode, mode, themeModes, activePlace, shortcut, onPalette, openPlace, onQuick,
  onTheme, onRefresh, onShortcuts, onAbout, counts }) {
  const edge = useAtlasHotEdge(150, 300);
  const [more, setMore] = useState(false);
  const anchor = useRef(null);
  const labels = pref.visible === 'labels';
  const shown = !pref.hidden || edge.shown || more;
  const change = (action) => { setMore(false); edge.hide(); onMode(action); };
  const item = (id, label, icon, action, key, extras = {}) => {
    const keys = key && shortcut(key);
    const hint = [label, keys].filter(Boolean).join(' · ');
    const active = id === activePlace;
    const count = atlasRailCount(counts[id]);
    const open = (e) => action(e);
    const button = h('button', { type: 'button', key: id, className: cx('atlas-rail-item', id === 'palette' && 'atlas-rail-mark'),
      'aria-current': active ? 'page' : undefined, 'aria-label': count ? `${label}, ${counts[id]} ${id === 'teams' ? 'items needing you' : 'unread replies'}` : label,
      onClick: open, ...extras }, h(Icon, { name: icon, size: id === 'palette' ? 22 : 20 }), labels && h('span', { className: 'atlas-rail-label' }, label),
      count && h('span', { className: cx('atlas-rail-badge', id === 'teams' && 'atlas-rail-badge-gold'), 'aria-hidden': true }, count));
    return labels ? button : h(Tooltip, { key: id, label: hint, side: 'right', delay: 400 }, button);
  };
  const places = ATLAS_RAIL_PLACES.map(([id, label, icon]) => {
    const open = (e) => openPlace(id, { focusComposer: id === 'desk', otherPane: e.shiftKey, permanent: e.ctrlKey || e.metaKey || e.button === 1 });
    return item(id, label, icon, open, id, { onAuxClick: (e) => { if (e.button === 1) { e.preventDefault(); open(e); } } });
  });
  const group = (name, children) => h('div', { className: 'atlas-rail-group', role: 'group', 'aria-label': name }, children);
  return h(React.Fragment, null,
    pref.hidden && !shown && h('button', { className: 'atlas-rail-edge', type: 'button', 'aria-label': 'Reveal Atlas rail',
      onPointerEnter: edge.enter, onPointerLeave: edge.leave, onClick: edge.show, onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); edge.show(); } } }),
    shown && h('nav', { className: cx('atlas-rail', labels && 'atlas-rail-labels', pref.hidden && 'atlas-rail-overlay'), 'aria-label': 'Atlas',
      onPointerEnter: edge.show, onPointerLeave: edge.leave, onFocus: edge.show,
      onBlur: (e) => { if (!e.currentTarget.contains(e.relatedTarget)) edge.leave(); } },
      item('palette', 'Commands', 'mark', onPalette, 'palette'), group('Work', places.slice(0, 3)),
      h('span', { className: 'atlas-rail-sep', 'aria-hidden': true }), group('Knowledge', places.slice(3)),
      h('span', { className: 'atlas-rail-space' }), group('Actions', [
        item('search', 'Search', 'search', (e) => openPlace('search', { otherPane: e.shiftKey }), 'search'),
        item('new', 'Add or write', 'plus', () => onQuick('paper'), 'quick'),
        item('theme', `Theme: ${THEME_LABEL[mode] || mode}`, THEME_ICON[mode] || 'contrast', () => onTheme(themeModes[(themeModes.indexOf(mode) + 1) % themeModes.length])),
        item('more', 'More', 'more', () => setMore(!more), null, { ref: anchor, 'aria-haspopup': 'menu', 'aria-expanded': more }),
      ])),
    more && h(Menu, { anchor, label: 'More Atlas actions', side: 'right', align: 'end', onClose: () => setMore(false), items: [
      { id: 'refresh', label: 'Read the files again', icon: 'refresh', onSelect: onRefresh },
      { id: 'keys', label: 'Keyboard shortcuts', icon: 'keyboard', onSelect: onShortcuts },
      { id: 'labels', label: labels ? 'Hide labels' : 'Show labels', onSelect: () => change('labels') },
      { id: 'hide', label: pref.hidden ? 'Keep the rail visible' : 'Hide the rail', shortcut: shortcut('rail'), onSelect: () => change('hidden') },
      { id: 'about', label: 'About Atlas', onSelect: onAbout },
    ] }));
}

const ATLAS_RAIL_CSS = `
.atlas-rail{box-sizing:border-box;width:var(--s-56);height:100%;min-height:0;flex:none;display:flex;flex-direction:column;align-items:center;gap:var(--s-4);padding:10px 0;overflow-y:auto;scrollbar-width:none;background:var(--bg);border-right:1px solid var(--border)}
.atlas-rail-group{display:flex;flex:none;align-items:center;flex-direction:column;gap:var(--s-4)}
.atlas-rail-item{box-sizing:border-box;display:flex;flex:none;align-items:center;justify-content:center;position:relative;width:var(--s-40);height:var(--s-40);padding:0;border:none;border-radius:var(--r-md);background:transparent;color:var(--text-3);font:var(--t-ui);cursor:pointer}
.atlas-rail-item:hover{background:var(--hover);color:var(--text-1)}.atlas-rail-item:active{background:var(--pressed)}
.atlas-rail-item:focus-visible,.atlas-rail-edge:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}
.atlas-rail-item[aria-current=page]{background:var(--selected);color:var(--accent)}
.atlas-rail-item[aria-current=page]::before{content:'';position:absolute;left:-7px;top:50%;width:7px;height:7px;transform:translateY(-50%);background:var(--accent);clip-path:polygon(50% 0,62% 38%,100% 50%,62% 62%,50% 100%,38% 62%,0 50%,38% 38%)}
.atlas-rail-mark{margin-bottom:10px;color:var(--gold)}.atlas-rail-sep{flex:none;width:var(--s-4);height:var(--s-4);border-radius:var(--r-full);background:var(--border-strong);margin:10px 0}.atlas-rail-space{flex:1}
.atlas-rail-badge{position:absolute;right:0;top:0;min-width:var(--s-16);height:var(--s-16);padding:0 var(--s-4);box-sizing:border-box;border-radius:var(--r-full);background:var(--accent);color:var(--text-on-accent);font:700 10px/16px var(--font-ui)}.atlas-rail-badge-gold{background:var(--gold);color:var(--gold-on)}
.atlas-rail-labels{width:208px;padding-inline:var(--s-8)}.atlas-rail-labels .atlas-rail-group,.atlas-rail-labels .atlas-rail-item{width:100%}.atlas-rail-labels .atlas-rail-item{justify-content:flex-start;gap:var(--s-12);padding-inline:10px}.atlas-rail-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.atlas-rail-edge,.atlas-rail-overlay{position:absolute;z-index:var(--z-rail);inset:0 auto 0 0}.atlas-rail-edge{width:6px;border:0;padding:0;background:transparent}.atlas-rail-overlay{background:var(--raised);box-shadow:var(--shadow-2)}
`;
