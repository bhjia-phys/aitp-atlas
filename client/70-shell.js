// ------------------------------------------------------------------- shell ---
// Every view is a tab: the page (the Universe, Activity, the Library, Learn, Write, a topic), each
// file opened from it, papers, the discussion with the AI, and a LaTeX document's compiled PDF
// (Preview). Two panes hold the tabs side by side: drag a tab to reorder it, onto the other pane to
// move it there, or to the edge to split; drag the divider to resize. Tab contents stay mounted where
// they are and a move only changes their place, so a discussion, a PDF or an unsaved edit survives it.

const NAV = [['home', 'Universe', 'universe'], ['activity', 'Activity', 'activity'], ['library', 'Library', 'library'], ['learn', 'Learn', 'learn'], ['write', 'Write', 'writing']];
const PANES = ['left', 'right'];
const TAB_DRAG = 'application/x-atlas-tab';
const PAGE_ICON = { home: 'universe', activity: 'activity', library: 'library', learn: 'learn', write: 'writing', search: 'search', team: 'team', paper: 'paper' };

/**
 * Where a navigation from a tab lands: the page (places, other views, Open as the page), the same tab
 * (a section of the document it shows, or a jump inside a LaTeX workspace), a file tab, or a paper tab.
 */
function routeFor(next, herePath, isPlace) {
  if (!next) return 'none';
  if (next.view === 'paper') return next.full ? 'page' : 'paper';
  if (next.back || next.view !== 'doc' || !next.path || next.full) return 'page';
  if (herePath && pathKey(herePath) === pathKey(next.path)) return 'same';
  if (next.stay) return 'same';
  if (!next.link && isPlace(next.path)) return 'page';
  return 'file';
}

function otherPane(pane) {
  return pane === 'left' ? 'right' : 'left';
}

function paneOfTab(layout, id) {
  return layout.left.includes(id) ? 'left' : layout.right.includes(id) ? 'right' : null;
}

/** Each pane shows a tab it holds. */
function fixActive(layout) {
  const active = { ...layout.active };
  for (const p of PANES) if (!layout[p].includes(active[p])) active[p] = layout[p][layout[p].length - 1] || null;
  return { ...layout, active };
}

/** Add a tab to a pane, after `after` (or at the end), and show it. */
function layoutAdd(layout, id, pane, after) {
  const list = layout[pane].filter((x) => x !== id);
  const at = after && list.includes(after) ? list.indexOf(after) + 1 : list.length;
  list.splice(at, 0, id);
  const other = layout[otherPane(pane)].filter((x) => x !== id);
  return fixActive({ ...layout, [pane]: list, [otherPane(pane)]: other, active: { ...layout.active, [pane]: id } });
}

/** Move a tab to a pane at `index` (the end when absent), and show it there. */
function layoutMove(layout, id, pane, index) {
  const left = layout.left.filter((x) => x !== id);
  const right = layout.right.filter((x) => x !== id);
  const target = pane === 'left' ? left : right;
  const at = index === undefined || index === null ? target.length : Math.max(0, Math.min(index, target.length));
  target.splice(at, 0, id);
  return fixActive({ ...layout, left, right, active: { ...layout.active, [pane]: id } });
}

/** Remove a tab; its pane shows the neighbor it had. */
function layoutRemove(layout, id) {
  const pane = paneOfTab(layout, id);
  if (!pane) return layout;
  const at = layout[pane].indexOf(id);
  const rest = layout[pane].filter((x) => x !== id);
  const active = { ...layout.active };
  if (active[pane] === id) active[pane] = rest[Math.min(at, rest.length - 1)] || null;
  return fixActive({ ...layout, [pane]: rest, active });
}

/** The files that are places in Atlas: the root note and every topic's note. */
function placeKeys(ov) {
  const keys = new Set();
  if (!ov) return keys;
  if (ov.rootFile) keys.add(pathKey(ov.rootFile));
  for (const t of Object.values(ov.topics || {})) if (t && t.file) keys.add(pathKey(t.file));
  return keys;
}

/** What Atlas calls a file: a topic's note by its topic (every one is research.md), anything else by its name. */
function sideLabel(ov, path) {
  const key = pathKey(path);
  if (ov && ov.rootFile && pathKey(ov.rootFile) === key) return shortTitle(ov.title || 'Root note', 40);
  for (const t of Object.values((ov && ov.topics) || {})) if (t && t.file && pathKey(t.file) === key) return shortTitle(t.title, 40);
  return baseName(path) || path;
}

/** A tab's name for a file or a paper. */
function sideTitle(ov, entry) {
  return entry.url ? (paperLink(entry.url) || { label: entry.url }).label : sideLabel(ov, entry.path);
}

/** The page tab's name: the place it shows. */
function pageLabel(route, ov) {
  if (route.view === 'doc' && route.path) return sideLabel(ov, route.path);
  if (route.view === 'paper' && route.url) return (paperLink(route.url) || { label: 'Paper' }).label;
  const nav = NAV.find(([key]) => key === route.view);
  if (nav) return nav[1];
  return route.view === 'search' ? 'Search' : route.view === 'team' ? 'Team' : 'Universe';
}

function tabLabel(tab, route, ov) {
  if (tab.kind === 'page') return pageLabel(route, ov);
  if (tab.kind === 'discussion') return 'Discussion';
  if (tab.kind === 'preview') return 'Preview · ' + baseName(String(tab.pdf || tab.main || '').replace(/\.tex$/i, '.pdf'));
  return sideTitle(ov, tab) + (tab.edit ? ' ✎' : '');
}

function tabIcon(tab, route) {
  if (tab.kind === 'page') return route.view === 'doc' && route.path ? TYPE_ICON[typeOf(route.path)] || 'note' : PAGE_ICON[route.view] || 'universe';
  if (tab.kind === 'discussion') return 'spark';
  if (tab.kind === 'preview' || tab.kind === 'paper') return 'paper';
  return TYPE_ICON[typeOf(tab.path)] || 'note';
}

/** The tabs as they were left (files, papers, previews; the discussion when one is open). */
function restoreTabs(open) {
  const saved = storageGet('tabs', null);
  const tabs = { page: { id: 'page', kind: 'page' } };
  const order = ['page'];
  let layout = { left: ['page'], right: [], active: { left: 'page', right: null }, split: 52 };
  if (saved && saved.layout) {
    for (const t of saved.tabs || []) {
      if (!t || !t.id || !['file', 'paper', 'preview'].includes(t.kind) || tabs[t.id]) continue;
      tabs[t.id] = { ...t, at: Date.now(), edit: false, created: false };
      order.push(t.id);
    }
    const keep = (ids) => (Array.isArray(ids) ? ids : []).filter((id, i, all) => (tabs[id] || id === 'discussion') && all.indexOf(id) === i);
    layout = { left: keep(saved.layout.left), right: keep(saved.layout.right), active: saved.layout.active || {}, split: Number(saved.layout.split) || 52 };
    if (!paneOfTab(layout, 'page')) layout.left.unshift('page');
  } else {
    // The single side panel of 0.6 and 0.7: its file becomes a tab on the right.
    const side = storageGet('side', null);
    if (side && (side.path || side.url)) {
      const id = side.url ? 'paper:restored' : 'file:restored';
      tabs[id] = side.url ? { id, kind: 'paper', key: 'url:' + side.url, url: side.url, topic: side.topic || '', at: Date.now() } : { id, kind: 'file', key: 'file:' + pathKey(side.path), path: side.path, anchor: side.anchor || '', at: Date.now() };
      order.push(id);
      layout.right.push(id);
    }
  }
  if (open) {
    tabs.discussion = { id: 'discussion', kind: 'discussion' };
    order.push('discussion');
    if (!paneOfTab(layout, 'discussion')) layout.right.push('discussion');
  } else {
    layout.left = layout.left.filter((x) => x !== 'discussion');
    layout.right = layout.right.filter((x) => x !== 'discussion');
  }
  return { tabs, order, layout: fixActive(layout) };
}

function saveTabs(state) {
  const tabs = state.order.map((id) => state.tabs[id]).filter((t) => t && ['file', 'paper', 'preview'].includes(t.kind))
    .map(({ id, kind, key, path, url, topic, anchor, main, pdf }) => ({ id, kind, key, path, url, topic, anchor, main, pdf }));
  storageSet('tabs', { tabs, layout: state.layout });
}

function AtlasApp() {
  const [version, setVersion] = useState(0);
  const overview = useApi('overview', version ? { fresh: 1 } : null, 'overview', version);
  const [route, setRoute] = useState(() => {
    const saved = storageGet('route', { view: 'home' });
    return saved && saved.view ? { ...saved, edit: false, created: false } : { view: 'home' };
  });
  const [filter, setFilter] = useState('');
  const [message, flash] = useFlash();
  const [canBack, setCanBack] = useState(false);
  const [thread, setThread] = useState(() => storageGet('companion', null));
  const [last, setLast] = useState(() => storageGet('companion-last', null));
  const [askBar, setAskBar] = useState(null);
  const [quick, setQuick] = useState(null);
  const [state, setState] = useState(() => restoreTabs(Boolean(storageGet('companion', null))));
  const [dragging, setDragging] = useState(null);
  const [dropAt, setDropAt] = useState(null);
  const [liveSplit, setLiveSplit] = useState(null);
  const routeRef = useRef(route);
  const historyRef = useRef([]);
  const stateRef = useRef(state);
  const bodies = useRef({});
  const bodyCallbacks = useRef({});
  const goers = useRef({});
  const panesRef = useRef(null);
  const rootRef = useRef(null);
  const ovRef = useRef(null);
  const threadRef = useRef(thread);
  const placesRef = useRef(new Set());
  ovRef.current = overview.data;
  placesRef.current = useMemo(() => placeKeys(overview.data), [overview.data]);

  // The theme: this window's choice, else the config's, else auto (DSH's own appearance).
  const appearance = overview.data && overview.data.appearance;
  const themes = useMemo(() => cleanThemes(appearance && appearance.themes), [appearance]);
  const storedMode = React.useSyncExternalStore(themeModeStore.subscribe, themeModeStore.get);
  const dshDark = React.useSyncExternalStore(dshThemeStore.subscribe, dshThemeStore.get);
  useEffect(() => watchDshTheme(), []);
  const cycle = themeCycle(themes);
  const mode = cycle.includes(storedMode) ? storedMode : appearance && cycle.includes(appearance.theme) ? appearance.theme : 'auto';
  const theme = resolveTheme(mode, dshDark, themes);
  activeBase = theme.base;
  const nextMode = cycle[(cycle.indexOf(mode) + 1) % cycle.length];
  const modeLabel = (m) => (themes[m] ? themes[m].label : THEME_LABEL[m]);

  /** Change the tabs and their layout, and remember them. */
  const update = useCallback((fn) => {
    const next = fn(stateRef.current);
    if (!next || next === stateRef.current) return;
    stateRef.current = next;
    setState(next);
    saveTabs(next);
  }, []);

  // Discussions and the ask bar are told what each pane shows.
  useEffect(() => {
    const paneOf = {};
    for (const p of PANES) for (const id of state.layout[p]) paneOf[id] = p;
    const all = focusStore.get();
    const byTab = {};
    for (const [id, focus] of Object.entries(all.byTab || {})) if (paneOf[id]) byTab[id] = focus;
    focusStore.set({ ...all, byTab, active: paneOf[all.active] ? all.active : 'page', visible: { left: state.layout.active.left, right: state.layout.active.right }, paneOf });
  }, [state.layout]);

  const bodyRef = (id) => bodies.current[id] || (bodies.current[id] = { current: null });
  const bodyCallback = (id) => bodyCallbacks.current[id] || (bodyCallbacks.current[id] = (el) => {
    bodyRef(id).current = el;
  });

  const showTab = useCallback((id) => {
    update((s) => {
      const pane = paneOfTab(s.layout, id);
      if (!pane || s.layout.active[pane] === id) return s;
      return { ...s, layout: { ...s.layout, active: { ...s.layout.active, [pane]: id } } };
    });
    setActivePane(id);
  }, [update]);

  // The page: places, with its own history (the top bar's Back).
  const goMain = useCallback((next) => {
    if (editorDirty.page && !window.confirm('Leave without saving your changes?')) return;
    editorDirty.page = false;
    if (next.back) {
      const prev = historyRef.current.pop();
      setCanBack(historyRef.current.length > 0);
      if (!prev) return;
      routeRef.current = prev;
      setRoute(prev);
      storageSet('route', prev);
      showTab('page');
      return;
    }
    historyRef.current = [...historyRef.current.slice(-50), routeRef.current];
    setCanBack(true);
    if (next.view !== routeRef.current.view) setFilter('');
    // A link to a section of the page already open scrolls there instead of starting from the top.
    const samePage = next.view === 'doc' && routeRef.current.view === 'doc' && next.path === routeRef.current.path && !next.edit;
    if (next.anchor) next = { ...next, at: Date.now() };
    routeRef.current = next;
    setRoute(next);
    storageSet('route', { ...next, edit: false, created: false });
    showTab('page');
    const el = bodyRef('page').current;
    if (el && !(samePage && next.anchor)) el.scrollTop = 0;
  }, [showTab]);

  /** The pane files open in: the one showing a file already, else the right. */
  const filesPane = (s) => {
    for (const p of PANES) {
      const t = s.tabs[s.layout.active[p]];
      if (t && (t.kind === 'file' || t.kind === 'paper')) return p;
    }
    return 'right';
  };

  /** Show a file or a paper in its own tab: the tab it already has, or a new one. */
  const openTab = useCallback((spec, pane) => {
    let shown = null;
    update((s) => {
      const existing = Object.values(s.tabs).find((t) => t.key && t.key === spec.key);
      if (existing) {
        shown = existing.id;
        const p = paneOfTab(s.layout, existing.id);
        // A file being edited stays in its editor (a link to it only shows the tab).
        const kept = { ...existing, ...spec, id: existing.id, edit: Boolean(spec.edit || existing.edit), created: Boolean(spec.created || existing.created), at: Date.now() };
        return { ...s, tabs: { ...s.tabs, [existing.id]: kept }, layout: { ...s.layout, active: { ...s.layout.active, [p]: existing.id } } };
      }
      const id = `${spec.kind}:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      const target = pane || filesPane(s);
      shown = id;
      return { tabs: { ...s.tabs, [id]: { ...spec, id, at: Date.now() } }, order: [...s.order, id], layout: layoutAdd(s.layout, id, target, s.layout.active[target]) };
    });
    if (shown) setActivePane(shown);
  }, [update]);

  /** A tab showing a file goes to another place in it (a section, the editor, a LaTeX jump). */
  const updateTab = useCallback((id, next) => {
    const tab = stateRef.current.tabs[id];
    if (!tab) return;
    // Another file, or the reader instead of the editor: unsaved edits are asked about first.
    const leaving = tab.path && (pathKey(tab.path) !== pathKey(next.path) || (tab.edit && !next.edit));
    if (leaving && editorDirty[id] && !window.confirm('Leave without saving your changes?')) return;
    if (leaving) editorDirty[id] = false;
    update((s) => ({ ...s, tabs: { ...s.tabs, [id]: { ...s.tabs[id], kind: 'file', key: 'file:' + pathKey(next.path), path: next.path, url: undefined, anchor: next.anchor || '', at: Date.now(), edit: Boolean(next.edit), created: Boolean(next.created) } } }));
  }, [update]);

  const closeTab = useCallback((id) => {
    const tab = stateRef.current.tabs[id];
    if (!tab || tab.kind === 'page') return false;
    if (editorDirty[id] && !window.confirm('Close it without saving your changes?')) return false;
    editorDirty[id] = false;
    if (tab.kind === 'discussion') {
      showThreadRef.current(null);
      return true;
    }
    update((s) => {
      const tabs = { ...s.tabs };
      delete tabs[id];
      return { tabs, order: s.order.filter((x) => x !== id), layout: layoutRemove(s.layout, id) };
    });
    forgetTab(id);
    return true;
  }, [update]);

  const moveTab = useCallback((id, pane, index) => {
    update((s) => {
      const from = paneOfTab(s.layout, id);
      let at = index;
      if (from === pane && at !== undefined && at !== null && s.layout[pane].indexOf(id) < at) at -= 1;
      return { ...s, layout: layoutMove(s.layout, id, pane, at) };
    });
    setActivePane(id);
  }, [update]);

  /** Each tab's `go`: a request from a tab lands in the page, in that tab, or in a file or paper tab. */
  const goFrom = useCallback((from) => (next) => {
    if (!next) return;
    const s = stateRef.current;
    const tab = s.tabs[from];
    const herePath = from === 'page' ? (routeRef.current.view === 'doc' ? routeRef.current.path : '') : tab && tab.kind === 'file' ? tab.path : '';
    const where = routeFor(next, herePath, (p) => placesRef.current.has(pathKey(p)));
    // Links from the discussion open beside it; from a file, in that file's pane.
    const pane = from === 'discussion' ? otherPane(paneOfTab(s.layout, 'discussion') || 'right')
      : tab && (tab.kind === 'file' || tab.kind === 'paper') ? paneOfTab(s.layout, from) : undefined;
    if (where === 'paper') return openTab({ kind: 'paper', key: 'url:' + next.url, url: next.url, topic: next.topic || '', anchor: next.anchor || '' }, pane);
    if (where === 'file') return openTab({ kind: 'file', key: 'file:' + pathKey(next.path), path: next.path, anchor: next.anchor || '', edit: Boolean(next.edit), created: Boolean(next.created) }, pane);
    if (where === 'same' && tab && (tab.kind === 'file' || tab.kind === 'paper')) return updateTab(from, next);
    const here = routeRef.current;
    if (next.full && next.path && here.view === 'doc' && pathKey(here.path || '') === pathKey(next.path) && Boolean(here.edit) === Boolean(next.edit)) {
      // Already the page: show it.
      showTab('page');
      return;
    }
    if (next.full && next.path) {
      // Made the page: a tab showing the same file closes (unless it has unsaved edits).
      const twin = Object.values(s.tabs).find((t) => t.kind === 'file' && pathKey(t.path) === pathKey(next.path));
      if (twin && !closeTab(twin.id)) return;
    }
    goMain(next.full ? { ...next, full: undefined } : next);
  }, [goMain, openTab, updateTab, closeTab, showTab]);
  if (goers.current.from !== goFrom) goers.current = { from: goFrom };
  const goOf = (id) => goers.current['tab:' + id] || (goers.current['tab:' + id] = goFrom(id));
  const go = goOf('page');

  const openAsPage = useCallback((id) => {
    const tab = stateRef.current.tabs[id];
    if (!tab || !closeTab(id)) return;
    goMain(tab.url ? { view: 'paper', url: tab.url, topic: tab.topic } : { view: 'doc', path: tab.path, anchor: tab.anchor });
  }, [closeTab, goMain]);

  /** The companion shows one discussion, a discussion being started, or nothing; its tab follows it. */
  const showThread = useCallback((next) => {
    threadRef.current = next;
    setThread(next);
    if (!next || next.id) storageSet('companion', next || null);
    if (next && next.id) {
      setLast(next.id);
      storageSet('companion-last', next.id);
    }
    update((s) => {
      if (next) {
        if (s.tabs.discussion) {
          const p = paneOfTab(s.layout, 'discussion');
          return { ...s, layout: { ...s.layout, active: { ...s.layout.active, [p]: 'discussion' } } };
        }
        return { tabs: { ...s.tabs, discussion: { id: 'discussion', kind: 'discussion' } }, order: s.order.includes('discussion') ? s.order : [...s.order, 'discussion'], layout: layoutAdd(s.layout, 'discussion', 'right', s.layout.active.right) };
      }
      if (!s.tabs.discussion) return s;
      const tabs = { ...s.tabs };
      delete tabs.discussion;
      return { tabs, order: s.order.filter((x) => x !== 'discussion'), layout: layoutRemove(s.layout, 'discussion') };
    });
  }, [update]);
  const showThreadRef = useRef(showThread);
  showThreadRef.current = showThread;

  /** A LaTeX document's compiled PDF, in a Preview tab in the pane beside its source. */
  const openPreview = useCallback(({ main, pdf, from, activate }) => {
    if (!main) return;
    const id = 'preview:' + pathKey(main);
    update((s) => {
      if (s.tabs[id]) {
        const tabs = { ...s.tabs, [id]: { ...s.tabs[id], pdf: pdf || s.tabs[id].pdf } };
        const p = paneOfTab(s.layout, id);
        return { ...s, tabs, layout: activate && p ? { ...s.layout, active: { ...s.layout.active, [p]: id } } : s.layout };
      }
      const pane = otherPane(paneOfTab(s.layout, from) || 'left');
      return { tabs: { ...s.tabs, [id]: { id, kind: 'preview', key: id, main, pdf: pdf || '' } }, order: [...s.order, id], layout: layoutAdd(s.layout, id, pane, s.layout.active[pane]) };
    });
  }, [update]);

  const actions = useMemo(() => ({
    ask(context, intent, question, label) {
      const ov = ovRef.current;
      if (!ov) return;
      showThread({ pending: true });
      startThread({ root: ov.root, context, intent, question, label, onCreated: (record) => showThread({ id: record.id }) })
        .catch((error) => {
          if (threadRef.current && threadRef.current.pending) showThread(null);
          if (error.fallback) handOff(ov.root, promptOf(context, intent, question), flash);
          else flash('The discussion could not start: ' + (error.message || String(error)));
        });
    },
    openThread: (id) => showThread({ id }),
    startAsk: (preset) => setAskBar({ ...(preset || {}) }),
    addToThread(context) {
      const current = threadRef.current && threadRef.current.id;
      if (!current) return;
      const text = contextBlock(context);
      if (draftIntoThread(current, text + '\n\n')) flash('The passage is in the discussion’s input box: add your question and send it.');
      else if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => flash('Copied the passage; paste it into the discussion.'), () => flash('Atlas could not add it here.'));
    },
    openPreview,
  }), [flash, showThread, openPreview]);
  const current = thread && thread.id ? thread.id : null;
  const actionValue = useMemo(() => ({ ...actions, current }), [actions, current]);
  const closeAsk = useCallback(() => setAskBar(null), []);
  const closeQuick = useCallback(() => setQuick(null), []);
  // The ask bar takes the selection from whichever pane holds it (and that tab's focus).
  const openAsk = useCallback(() => {
    const s = stateRef.current;
    for (const p of PANES) {
      const id = s.layout.active[p];
      const el = id && id !== 'discussion' ? bodyRef(id).current : null;
      if (!el) continue;
      const got = captureSelection(el);
      if (got.selection) {
        setActivePane(id);
        setAskBar(got);
        return;
      }
    }
    setAskBar({});
  }, []);

  // Ctrl+J asks about what is on screen (and what is selected); DSH keeps Ctrl+K for its session search.
  useEffect(() => {
    const onKey = (event) => {
      if (!(event.ctrlKey || event.metaKey) || event.shiftKey || event.altKey || String(event.key).toLowerCase() !== 'j') return;
      const root = rootRef.current;
      if (!root || !root.isConnected || root.getClientRects().length === 0) return;
      if (event.target && event.target.closest && event.target.closest('.atlas-companion')) return;
      event.preventDefault();
      event.stopPropagation();
      openAsk();
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [openAsk]);

  // "/" searches and "N" adds or writes something, unless a field or the discussion has the keyboard.
  useEffect(() => {
    const onKey = (event) => {
      const key = String(event.key).toLowerCase();
      if ((key !== '/' && key !== 'n') || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) return;
      if (target && target.closest && target.closest('.atlas-companion')) return;
      const root = rootRef.current;
      if (!root || !root.isConnected || root.getClientRects().length === 0) return;
      event.preventDefault();
      if (key === '/') go({ view: 'search', at: Date.now() });
      else setQuick({ tab: 'paper', at: Date.now() });
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [go]);

  // A direction anchor on the Universe scrolls to its section once drawn.
  useEffect(() => {
    if (route.view !== 'home' || !route.anchor) return undefined;
    const timer = setTimeout(() => {
      const el = document.getElementById('atlas-dir-' + route.anchor);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
    return () => clearTimeout(timer);
  }, [route, overview.data]);

  // ---- the strips: tabs keep their size and scroll; the shown tab stays in view ----
  const strips = useRef({});
  const stripRefs = useRef({});
  const stripRef = (p) => stripRefs.current[p] || (stripRefs.current[p] = (el) => {
    strips.current[p] = el;
  });
  const scrollStrip = (event) => {
    const el = event.currentTarget;
    if (el.scrollWidth > el.clientWidth && Math.abs(event.deltaY) > Math.abs(event.deltaX)) el.scrollLeft += event.deltaY;
  };
  useLayoutEffect(() => {
    for (const p of PANES) {
      const el = strips.current[p];
      const on = el && el.querySelector('.atlas-ptab.is-on');
      if (!on) continue;
      const left = on.offsetLeft;
      const right = left + on.offsetWidth;
      if (left < el.scrollLeft) el.scrollLeft = Math.max(0, left - 12);
      else if (right > el.scrollLeft + el.clientWidth) el.scrollLeft = right - el.clientWidth + 12;
    }
  }, [state.layout]);

  // ---- dragging tabs ----
  const endDrag = () => {
    setDragging(null);
    setDropAt(null);
  };
  const indexAt = (strip, x) => {
    const tabs = [...strip.querySelectorAll('.atlas-ptab')];
    const i = tabs.findIndex((el) => {
      const r = el.getBoundingClientRect();
      return x < r.left + r.width / 2;
    });
    return i < 0 ? tabs.length : i;
  };
  const dropHandlers = (pane, where) => ({
    onDragOver: (event) => {
      if (!dragging) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      const index = where === 'strip' ? indexAt(event.currentTarget, event.clientX) : null;
      if (!dropAt || dropAt.pane !== pane || dropAt.index !== index || dropAt.where !== where) setDropAt({ pane, index, where });
    },
    onDrop: (event) => {
      if (!dragging) return;
      event.preventDefault();
      moveTab(dragging, pane, where === 'strip' ? indexAt(event.currentTarget, event.clientX) : undefined);
      endDrag();
    },
  });
  const startDivider = (event) => {
    event.preventDefault();
    const box = panesRef.current;
    if (!box) return;
    const rect = box.getBoundingClientRect();
    const at = (x) => Math.round(Math.min(80, Math.max(20, ((x - rect.left) / rect.width) * 100)));
    const move = (e) => setLiveSplit(at(e.clientX));
    const up = (e) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      const value = at(e.clientX);
      setLiveSplit(null);
      update((s) => ({ ...s, layout: { ...s.layout, split: value } }));
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  // ---- what each tab shows ----
  let body;
  if (overview.loading && !overview.data) body = h(Loading);
  else if (overview.error) body = h(ErrorNote, { error: overview.error, onRetry: () => setVersion(Date.now()) });
  else {
    const props = { overview: overview.data, go, flash, filter, version };
    if (route.view === 'doc' && route.path) body = h(DocView, { ...props, key: route.path + (route.edit ? ':edit' : ''), path: route.path, edit: route.edit, created: route.created, anchor: route.anchor, anchorAt: route.at });
    else if (route.view === 'library') body = h(LibraryView, { ...props, tab: route.tab, focusAdd: route.add });
    else if (route.view === 'activity') body = h(ActivityView, props);
    else if (route.view === 'search') body = h(SearchView, { ...props, q: route.q, at: route.at });
    else if (route.view === 'learn') body = h(LearnView, { ...props, path: route.path });
    else if (route.view === 'write') body = h(WriteView, { ...props, onQuick: (tab) => setQuick({ tab, at: Date.now() }) });
    else if (route.view === 'paper' && route.url) body = h(PaperRefView, { ...props, key: route.url, url: route.url, topic: route.topic });
    else if (route.view === 'team') body = h(TeamView, { ...props, key: (route.path || '') + ':' + (route.thread || ''), path: route.path, thread: route.thread });
    else body = h(UniverseView, props);
  }
  const open = Boolean(thread && (thread.id || thread.pending));
  const contentOf = (tab) => {
    if (tab.kind === 'page') return body;
    if (!overview.data) return h(Loading);
    if (tab.kind === 'file') return h(DocView, { key: tab.path + (tab.edit ? ':edit' : ''), overview: overview.data, go: goOf(tab.id), flash, version, path: tab.path, edit: tab.edit, created: tab.created, anchor: tab.anchor, anchorAt: tab.at });
    if (tab.kind === 'paper') return h(PaperRefView, { key: tab.url, url: tab.url, topic: tab.topic, overview: overview.data, go: goOf(tab.id), flash, anchor: tab.anchor, anchorAt: tab.at });
    if (tab.kind === 'preview') return h(TexPreview, { tab, flash, go: goOf(tab.id) });
    if (tab.kind === 'discussion' && open) {
      return h(Companion, {
        threadId: thread.id,
        pending: Boolean(thread.pending),
        onClose: () => showThread(null),
        flash,
        root: overview.data.root,
        onOpenLink: (ref) => goOf('discussion')(ref.url ? { view: 'paper', url: ref.url } : { view: 'doc', path: ref.path, anchor: ref.anchor, link: true }),
      });
    }
    return null;
  };

  const area = route.view === 'library' ? 'library' : route.view === 'home' ? 'home' : route.view === 'activity' || route.view === 'team' ? 'activity' : route.view === 'learn' ? 'learn' : route.view === 'write' ? 'write' : '';
  const waiting = overview.data ? waitingItems(overview.data).length : 0;
  const filtering = route.view === 'home' || route.view === 'library';
  const { layout } = state;
  const shown = PANES.filter((p) => layout[p].length);
  const split = shown.length === 2 ? (liveSplit === null ? layout.split : liveSplit) : 100;
  const geom = shown.length === 2
    ? { left: { left: '0%', width: split + '%' }, right: { left: split + '%', width: 100 - split + '%' } }
    : { [shown[0] || 'left']: { left: '0%', width: '100%' } };
  const strip = (p) => h('div', { key: p, className: cx('atlas-strip', dropAt && dropAt.pane === p && dropAt.where === 'strip' && 'is-drop'), style: { width: geom[p].width }, ...dropHandlers(p, 'strip') },
    h('div', { className: 'atlas-strip-tabs', role: 'tablist', 'aria-label': p === 'left' ? 'Left pane' : 'Right pane', ref: stripRef(p), onWheel: scrollStrip }, layout[p].map((id, i) => {
      const tab = state.tabs[id];
      if (!tab) return null;
      const on = layout.active[p] === id;
      const label = tabLabel(tab, route, overview.data);
      const insert = dropAt && dropAt.pane === p && dropAt.where === 'strip' && dropAt.index === i && dragging !== id;
      return h('div', {
        key: id,
        className: cx('atlas-ptab', on && 'is-on', dragging === id && 'is-dragging', insert && 'is-insert'),
        role: 'tab',
        tabIndex: 0,
        'aria-selected': on,
        title: tab.kind === 'file' ? tab.path : tab.kind === 'paper' ? tab.url : label,
        draggable: true,
        onDragStart: (event) => {
          event.dataTransfer.setData(TAB_DRAG, id);
          event.dataTransfer.effectAllowed = 'move';
          setDragging(id);
        },
        onDragEnd: endDrag,
        onClick: () => showTab(id),
        onKeyDown: (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            showTab(id);
          }
        },
        onAuxClick: (event) => {
          if (event.button === 1) closeTab(id);
        },
      },
      h(Icon, { name: tabIcon(tab, route), size: 14 }),
      h('span', { className: 'atlas-ptab-label' }, label),
      tab.kind === 'discussion' && thread && thread.pending ? h('span', { className: 'atlas-light is-running', 'aria-hidden': true }) : null,
      tab.kind !== 'page' ? h('button', { type: 'button', className: 'atlas-ptab-close', title: 'Close (middle-click also closes)', 'aria-label': 'Close ' + label, onClick: (event) => { event.stopPropagation(); closeTab(id); } }, h(Icon, { name: 'close', size: 12 })) : null);
    }),
    dropAt && dropAt.pane === p && dropAt.where === 'strip' && dropAt.index === layout[p].length ? h('span', { className: 'atlas-ptab-end', 'aria-hidden': true }) : null),
    (() => {
      const tab = state.tabs[layout.active[p]];
      return tab && (tab.kind === 'file' || tab.kind === 'paper')
        ? h('button', { type: 'button', className: 'atlas-icon-button atlas-strip-tool', title: 'Open it as the page', 'aria-label': 'Open as the page', onClick: () => openAsPage(tab.id) }, h(Icon, { name: 'expand', size: 14 }))
        : null;
    })());

  return h(AtlasActions.Provider, { value: actionValue },
    h('div', { className: cx('atlas-root', open && 'has-companion', dragging && 'is-dragging-tab'), 'data-theme-base': theme.base, 'data-theme': theme.name, style: themeStyle(theme), ref: rootRef },
      h('header', { className: 'atlas-top' },
        h('button', { type: 'button', className: 'atlas-brand', onClick: () => go({ view: 'home' }), title: 'The research universe' }, h(AtlasIcon), h('span', null, 'Atlas')),
        h('nav', { className: 'atlas-nav', 'aria-label': 'Atlas' },
          NAV.map(([key, label, icon]) => h('button', { key, type: 'button', className: cx('atlas-nav-item', area === key && 'is-on'), 'aria-current': area === key ? 'page' : undefined, onClick: () => go({ view: key }) }, h(Icon, { name: icon, size: 15 }), label,
            key === 'activity' && waiting ? h('span', { className: 'atlas-nav-badge', title: `${waiting} waiting on you` }, waiting) : null))),
        canBack ? h('button', { type: 'button', className: 'atlas-nav-item', onClick: () => go({ back: true }), title: 'Back' }, h(Icon, { name: 'back', size: 15 }), 'Back') : null,
        h('div', { className: 'atlas-tools' },
          filtering ? h('input', { type: 'search', className: 'atlas-input', value: filter, onChange: (e) => setFilter(e.target.value), placeholder: route.view === 'library' ? 'Filter papers and entries' : 'Filter topics', 'aria-label': 'Filter' }) : null,
          h('button', { type: 'button', className: 'atlas-ask-top', onMouseDown: (e) => e.preventDefault(), onClick: openAsk, title: 'Ask about what you are viewing, or the passage you selected (Ctrl+J)' },
            h(Icon, { name: 'spark', size: 15 }), h('span', null, 'Ask'), h('kbd', null, 'Ctrl J')),
          h('button', { type: 'button', className: 'atlas-icon-button', title: 'Search your notes, knowledge and papers (/)', 'aria-label': 'Search', onClick: () => go({ view: 'search', at: Date.now() }) }, h(Icon, { name: 'search' })),
          h('button', { type: 'button', className: 'atlas-icon-button', title: 'Add a paper, or write a note or a LaTeX document (N)', 'aria-label': 'Add or write', onClick: () => setQuick({ tab: 'paper', at: Date.now() }) }, h(Icon, { name: 'plus' })),
          !open && last ? h('button', { type: 'button', className: 'atlas-icon-button', title: 'Show the last discussion', 'aria-label': 'Show the last discussion', onClick: () => showThread({ id: last }) }, h(Icon, { name: 'panel' })) : null,
          h('button', { type: 'button', className: 'atlas-icon-button', title: `Theme: ${modeLabel(mode)}. Click for ${modeLabel(nextMode)}.`, 'aria-label': `Theme: ${modeLabel(mode)}`, onClick: () => themeModeStore.set(nextMode) }, h(Icon, { name: THEME_ICON[mode] || (theme.base === 'day' ? 'sun' : 'moon') })),
          h('button', { type: 'button', className: cx('atlas-icon-button', overview.loading && 'is-busy'), title: 'Read the files again', 'aria-label': 'Read the files again', onClick: () => setVersion(Date.now()) }, h(Icon, { name: 'refresh' })))),
      h(Flash, { message }),
      h('div', { className: 'atlas-body' },
        h('div', { className: 'atlas-strips' }, shown.map(strip)),
        h('div', { className: 'atlas-panes', ref: panesRef },
          state.order.map((id) => {
            const tab = state.tabs[id];
            const pane = tab ? paneOfTab(layout, id) : null;
            if (!pane) return null;
            const visible = layout.active[pane] === id;
            return h('div', {
              key: id,
              ref: bodyCallback(id),
              className: cx('atlas-tab-body', 'is-' + tab.kind, !visible && 'is-hidden'),
              style: { left: geom[pane].left, width: geom[pane].width },
              'aria-hidden': visible ? undefined : true,
              onPointerDownCapture: () => setActivePane(id),
            }, h(PaneContext.Provider, { value: id }, h(Boundary, null, contentOf(tab))));
          }),
          shown.length === 2 ? h('div', { className: 'atlas-pane-divider', style: { left: split + '%' }, role: 'separator', 'aria-orientation': 'vertical', 'aria-label': 'Resize the panes', title: 'Drag to resize; double-click for half and half', onPointerDown: startDivider, onDoubleClick: () => update((s) => ({ ...s, layout: { ...s.layout, split: 50 } })) }) : null,
          dragging ? shown.map((p) => h('div', { key: 'drop-' + p, className: cx('atlas-drop-pane', dropAt && dropAt.pane === p && dropAt.where === 'pane' && 'is-over'), style: geom[p], ...dropHandlers(p, 'pane') })) : null,
          dragging && shown.length === 1 ? h('div', { className: cx('atlas-drop-split', 'is-' + otherPane(shown[0]), dropAt && dropAt.where === 'split' && 'is-over'), ...dropHandlers(otherPane(shown[0]), 'split') }, h(Icon, { name: 'panel', size: 18 }), h('span', null, 'Drop here to split')) : null,
          shown.map((p) => {
            const id = layout.active[p];
            const tab = id && state.tabs[id];
            if (!tab || tab.kind === 'discussion') return null;
            return h(PaneContext.Provider, { key: 'sel-' + p, value: id }, h(SelectionTools, { container: bodyRef(id), host: panesRef }));
          }),
          askBar ? h(AskBar, { preset: askBar, onClose: closeAsk }) : null,
          quick && overview.data ? h(QuickAdd, { key: `${quick.tab}:${quick.at || ''}`, tab: quick.tab, overview: overview.data, go, flash, onClose: closeQuick }) : null))));
}
