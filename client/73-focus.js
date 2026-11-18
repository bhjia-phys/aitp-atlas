// Focus never moves the tab's DOM and never writes a preference (FC-1–6).
// DSH's AppFrame publishes the sidebar width as the first grid track, and
// data-shell-bottom as a direct child. Don't match arbitrary sidebars by class.
function atlasSidebarExpanded(root) {
  for (let frame = root?.parentElement; frame; frame = frame.parentElement) {
    const first = /^(\d+(?:\.\d+)?)px\s/.exec(frame.style?.gridTemplateColumns || '');
    if (!first || !frame.querySelector(':scope > [data-shell-bottom]')) continue;
    if (frame.hasAttribute('data-sidebar-collapsed')) return false;
    if (frame.hasAttribute('data-sidebar-drawer')) {
      const column = frame.querySelector(':scope > [data-sidebar-mask]')?.nextElementSibling;
      return column ? column.getBoundingClientRect().width > 120 : null;
    }
    return Number(first[1]) > 120;
  }
  return null;
}

// The ownership token belongs to the specific service that folded the sidebar.
// Restore only on a positive read of 'collapsed', not on a missing frame/API.
function atlasEnterFocus(layout, expanded) {
  if (expanded === true && typeof layout?.toggleSidebar === 'function') {
    try { layout.toggleSidebar(); return layout; } catch { /* optional service */ }
  }
  return null;
}
function atlasLeaveFocus(owner, current, expanded) {
  if (owner && owner === current && expanded === false) {
    try { owner.toggleSidebar(); } catch { /* layout may already be disposing */ }
  }
}

async function atlasToggleFullscreen(root, flash) {
  try {
    if (!root) throw new Error();
    if (root.ownerDocument.fullscreenElement === root) await root.ownerDocument.exitFullscreen();
    else await root.requestFullscreen();
  } catch { flash('Full screen is not available here'); }
}

function useAtlasFocusMode(rootRef, layout, flash) {
  const [focused, setFocused] = useState(false);
  const session = useRef(null);
  const service = useRef(layout);
  service.current = layout;
  const lastFullscreenExit = useRef(-Infinity);
  const leave = useCallback(() => {
    const held = session.current;
    if (!held) return;
    session.current = null;
    atlasLeaveFocus(held.owner, service.current, atlasSidebarExpanded(held.root));
    if (held.root.ownerDocument.fullscreenElement === held.root) {
      held.root.ownerDocument.exitFullscreen().catch(() => {});
    }
  }, []);
  // Layout cleanup still sees the attached frame when a panel unmounts.
  useLayoutEffect(() => leave, [leave]);
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let ours = root.ownerDocument.fullscreenElement === root;
    const changed = () => {
      const next = root.ownerDocument.fullscreenElement === root;
      if (ours && !next) lastFullscreenExit.current = performance.now();
      ours = next;
    };
    root.ownerDocument.addEventListener('fullscreenchange', changed);
    return () => root.ownerDocument.removeEventListener('fullscreenchange', changed);
  }, [rootRef]);
  const toggleFocus = () => {
    if (session.current) { leave(); setFocused(false); }
    else if (rootRef.current) {
      const root = rootRef.current;
      session.current = { root, owner: atlasEnterFocus(layout, atlasSidebarExpanded(root)) };
      setFocused(true);
    }
  };
  return { focused, toggleFocus,
    fullscreen: () => { if (session.current) return atlasToggleFullscreen(session.current.root, flash); },
    // Some UAs report fullscreenchange before dispatching the key that exited it.
    browserOwnsEsc: () => rootRef.current?.ownerDocument.fullscreenElement === rootRef.current || performance.now() - lastFullscreenExit.current < 150 };
}

function AtlasFocusHeader({ activeTab, toggleFocus, fullscreen, rootRef }) {
  const edge = useAtlasHotEdge(120, 600);
  const first = useRef(null);
  const keyboard = useRef(false);
  const [full, setFull] = useState(() => rootRef.current?.ownerDocument.fullscreenElement === rootRef.current);
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const change = () => setFull(root.ownerDocument.fullscreenElement === root);
    root.ownerDocument.addEventListener('fullscreenchange', change);
    return () => root.ownerDocument.removeEventListener('fullscreenchange', change);
  }, [rootRef]);
  useLayoutEffect(() => { if (edge.shown && keyboard.current) { keyboard.current = false; first.current?.focus(); } }, [edge.shown]);
  return h('div', { className: cx('atlas-focus-edge', edge.shown && 'atlas-focus-revealed'),
    onPointerEnter: edge.enter, onPointerLeave: (e) => { if (!e.currentTarget.querySelector(':focus-visible')) edge.leave(); },
    onFocus: edge.show, onBlur: (e) => { if (!e.currentTarget.contains(e.relatedTarget)) edge.leave(); } },
    h('button', { type: 'button', className: 'atlas-focus-reveal', 'aria-label': 'Show focus controls', tabIndex: edge.shown ? -1 : 0,
      onFocus: () => { keyboard.current = true; edge.show(); }, onClick: edge.show }),
    edge.shown && h('div', { className: 'atlas-focus-header', role: 'group', 'aria-label': 'Focus controls' },
      h(Icon, { name: activeTab?.icon || 'desk' }), h('span', { className: 'atlas-focus-title' }, activeTab?.title || 'Atlas'),
      h('button', { ref: first, className: 'atlas-button is-small', type: 'button', onClick: fullscreen }, h(Icon, { name: 'expand' }), full ? 'Leave full screen' : 'Full screen'),
      h(Button, { small: true, onClick: toggleFocus, icon: 'collapse' }, 'Exit focus · Esc')));
}
const ATLAS_FOCUS_CSS = `
.atlas-focus-edge{position:absolute;inset:0 0 auto 0;height:6px;z-index:var(--z-focus)}
.atlas-focus-reveal{position:absolute;inset:0;width:100%;border:0;padding:0;background:transparent;color:var(--accent)}
.atlas-focus-revealed{height:var(--s-56);pointer-events:none}.atlas-focus-revealed .atlas-focus-reveal{height:6px;pointer-events:auto}
.atlas-focus-header{pointer-events:auto;position:absolute;top:var(--s-12);left:50%;transform:translateX(-50%);width:560px;max-width:calc(100% - var(--s-32));height:38px;box-sizing:border-box;display:flex;align-items:center;gap:var(--s-8);padding:0 6px 0 14px;color:var(--text-2);background:var(--raised);border:1px solid var(--border);border-radius:var(--r-full);box-shadow:var(--shadow-2)}
.atlas-focus-title{flex:1;min-width:0;font:var(--t-ui);font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.atlas-focus-header .atlas-button{border-radius:var(--r-full)}
`;
