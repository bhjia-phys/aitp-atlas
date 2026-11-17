// ------------------------------------------------------------------- shell ---
// Four places (the Universe, Activity, the Library, Learn) and the topics fill the page; a file
// opens beside it in the side panel, so the page stays where it was. A discussion with the AI
// opens in the companion pane. With a file and a discussion both open they stand side by side,
// or, when the window cannot fit three columns, share the side as two tabs.

const NAV = [['home', 'Universe', 'universe'], ['activity', 'Activity', 'activity'], ['library', 'Library', 'library'], ['learn', 'Learn', 'learn']];
const SIDE_MIN = 360;
const MAIN_MIN = 420;

/**
 * Which pane a navigation belongs in, opened from pane `from` ('main' or 'side') whose current
 * entry is `here`. Places (another view, a topic, the root note, a page made full) fill the page;
 * a section of the document already open stays where it is, as does a jump inside a LaTeX
 * workspace (`stay`); links inside documents and every other file open beside the page.
 */
function paneFor(next, from, here, isPlace) {
  if (next && next.view === 'paper') return next.full ? 'main' : 'side';
  if (!next || next.back || next.view !== 'doc' || !next.path || next.full) return 'main';
  if (here && here.view === 'doc' && here.path && pathKey(here.path) === pathKey(next.path)) return from;
  if (next.stay) return from;
  if (!next.link && isPlace(next.path)) return 'main';
  return 'side';
}

/** Columns when the page keeps at least MAIN_MIN beside the file and the discussion; tabs otherwise. */
function sideLayout({ width, side, discussion, sideWidth, companionWidth }) {
  if (!side || !discussion) return 'columns';
  return width - sideWidth - companionWidth >= MAIN_MIN ? 'columns' : 'tabs';
}

/** The files that are places in Atlas: the root note and every topic's note. */
function placeKeys(ov) {
  const keys = new Set();
  if (!ov) return keys;
  if (ov.rootFile) keys.add(pathKey(ov.rootFile));
  for (const t of Object.values(ov.topics || {})) if (t && t.file) keys.add(pathKey(t.file));
  return keys;
}

/** One entry of the side panel as a key: a paper by its address, a file by its path. */
function sideKey(entry) {
  return entry.url ? 'url:' + entry.url : pathKey(entry.path);
}

/** The side panel's name for an entry: a paper by its identifier, a file as `sideLabel` says. */
function sideTitle(ov, entry) {
  return entry.url ? (paperLink(entry.url) || { label: entry.url }).label : sideLabel(ov, entry.path);
}

/** What the side panel calls a file: a topic's note by its topic (every one is research.md), anything else by its name. */
function sideLabel(ov, path) {
  const key = pathKey(path);
  if (ov && ov.rootFile && pathKey(ov.rootFile) === key) return shortTitle(ov.title || 'Root note', 40);
  for (const t of Object.values((ov && ov.topics) || {})) if (t && t.file && pathKey(t.file) === key) return shortTitle(t.title, 40);
  return baseName(path) || path;
}

/** Drag the left edge of a right-hand column to resize it (up to `share` of the body). */
function columnResizer(width, onWidth, min, share = 0.7) {
  return (event) => {
    event.preventDefault();
    const startX = event.clientX;
    const host = event.currentTarget.closest('.atlas-body');
    const max = host ? host.clientWidth * share : 900;
    const clamp = (x) => Math.round(Math.min(max, Math.max(min, width + (startX - x))));
    const move = (e) => onWidth(clamp(e.clientX), false);
    const up = (e) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      onWidth(clamp(e.clientX), true);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
}

/** The file beside the page: its own header (back, name or tabs, open as the page, close) and scroller. */
function SidePane({ entry, overview, go, flash, version, width, onWidth, canBack, onBack, onClose, onFull, tabs, hidden, scrollRef }) {
  const type = entry.url ? 'pdf' : typeOf(entry.path);
  return h('aside', { className: cx('atlas-side', hidden && 'is-hidden'), 'aria-label': 'Beside the page', 'aria-hidden': hidden || undefined, style: { '--side-w': width + 'px' }, onPointerDownCapture: () => setActivePane('side') },
    h('div', { className: 'atlas-pane-resize', role: 'separator', 'aria-orientation': 'vertical', 'aria-label': 'Resize the side panel', onPointerDown: columnResizer(width, onWidth, SIDE_MIN) }),
    h('header', { className: 'atlas-side-head' },
      canBack ? h('button', { type: 'button', className: 'atlas-icon-button', title: 'Back to the previous file', 'aria-label': 'Back to the previous file', onClick: onBack }, h(Icon, { name: 'back', size: 15 })) : null,
      tabs || h('span', { className: 'atlas-side-title', title: entry.url || entry.path }, h(Icon, { name: TYPE_ICON[type] || 'note', size: 15 }), h('span', null, sideTitle(overview, entry))),
      h('button', { type: 'button', className: 'atlas-icon-button', title: 'Open it as the page instead', 'aria-label': 'Open as the page', onClick: onFull }, h(Icon, { name: 'expand', size: 15 })),
      h('button', { type: 'button', className: 'atlas-icon-button', title: 'Close the side panel', 'aria-label': 'Close the side panel', onClick: onClose }, h(Icon, { name: 'close', size: 15 }))),
    h('div', { className: 'atlas-side-body', ref: scrollRef },
      h(PaneContext.Provider, { value: 'side' },
        h(Boundary, { key: entry.url || entry.path }, !overview ? h(Loading)
          : entry.url ? h(PaperRefView, { key: entry.url, url: entry.url, topic: entry.topic, overview, go, flash, anchor: entry.anchor, anchorAt: entry.at })
            : h(DocView, { key: entry.path + (entry.edit ? ':edit' : ''), overview, go, flash, version, path: entry.path, edit: entry.edit, created: entry.created, anchor: entry.anchor, anchorAt: entry.at })))));
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
  const [paneWidth, setPaneWidth] = useState(() => storageGet('companion-width', 440));
  const [side, setSide] = useState(() => {
    const saved = storageGet('side', null);
    if (saved && saved.url) return { url: saved.url, topic: saved.topic || '', anchor: '', at: Date.now(), edit: false, created: false };
    return saved && saved.path ? { path: saved.path, anchor: saved.anchor || '', at: Date.now(), edit: false, created: false } : null;
  });
  const [sideBack, setSideBack] = useState(false);
  const [sideWidth, setSideWidth] = useState(() => storageGet('side-width', 560));
  const [sideTab, setSideTab] = useState('file');
  const [bodyWidth, setBodyWidth] = useState(0);
  const routeRef = useRef(route);
  const historyRef = useRef([]);
  const sideRef = useRef(side);
  const sideHistory = useRef([]);
  const scroller = useRef(null);
  const sideScroller = useRef(null);
  const bodyRef = useRef(null);
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

  // The page: places, with its own history (the top bar's Back).
  const goMain = useCallback((next) => {
    if (editorDirty.main && !window.confirm('Leave without saving your changes?')) return;
    editorDirty.main = false;
    if (next.back) {
      const prev = historyRef.current.pop();
      setCanBack(historyRef.current.length > 0);
      if (!prev) return;
      routeRef.current = prev;
      setRoute(prev);
      storageSet('route', prev);
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
    setActivePane('main');
    if (scroller.current && !(samePage && next.anchor)) scroller.current.scrollTop = 0;
  }, []);

  // The file beside the page, with its own history (the panel's Back).
  const showSide = (entry) => {
    sideRef.current = entry;
    setSide(entry);
    storageSet('side', !entry ? null : entry.url ? { url: entry.url, topic: entry.topic } : { path: entry.path, anchor: entry.anchor });
  };
  const openSide = useCallback((next) => {
    const cur = sideRef.current;
    const entry = next.view === 'paper'
      ? { url: next.url, topic: next.topic || '', anchor: next.anchor || '', at: Date.now(), edit: false, created: false }
      : { path: next.path, anchor: next.anchor || '', at: Date.now(), edit: Boolean(next.edit), created: Boolean(next.created) };
    if (!cur || sideKey(cur) !== sideKey(entry)) {
      if (editorDirty.side && !window.confirm('Leave the file beside the page without saving your changes?')) return;
      editorDirty.side = false;
      if (cur) {
        sideHistory.current = [...sideHistory.current.slice(-30), { ...cur, edit: false, created: false }];
        setSideBack(true);
      }
      if (sideScroller.current) sideScroller.current.scrollTop = 0;
    }
    showSide(entry);
    setSideTab('file');
    setActivePane('side');
  }, []);
  const sideGoBack = useCallback(() => {
    if (editorDirty.side && !window.confirm('Leave without saving your changes?')) return;
    editorDirty.side = false;
    const prev = sideHistory.current.pop();
    setSideBack(sideHistory.current.length > 0);
    if (prev) showSide({ ...prev, at: Date.now() });
  }, []);
  const closeSide = useCallback(() => {
    if (editorDirty.side && !window.confirm('Close the file without saving your changes?')) return false;
    editorDirty.side = false;
    sideHistory.current = [];
    setSideBack(false);
    showSide(null);
    clearSidePane();
    return true;
  }, []);

  /** Each pane's `go`: the same request lands in the page or beside it, by `paneFor`. */
  const navigator = useCallback((from) => (next) => {
    const cur = sideRef.current;
    const here = from === 'side' ? (cur ? (cur.url ? { view: 'paper', url: cur.url } : { view: 'doc', path: cur.path }) : null) : routeRef.current;
    if (paneFor(next, from, here, (p) => placesRef.current.has(pathKey(p))) === 'side') openSide(next);
    else goMain(next && next.full ? { ...next, full: undefined } : next);
  }, [goMain, openSide]);
  const go = useMemo(() => navigator('main'), [navigator]);
  const goSide = useMemo(() => navigator('side'), [navigator]);
  const openAsPage = useCallback(() => {
    const cur = sideRef.current;
    if (cur && closeSide()) goMain(cur.url ? { view: 'paper', url: cur.url, topic: cur.topic } : { view: 'doc', path: cur.path, anchor: cur.anchor });
  }, [closeSide, goMain]);

  /** The companion shows one discussion, a discussion being started, or nothing. */
  const showThread = useCallback((next) => {
    threadRef.current = next;
    setThread(next);
    if (next) setSideTab('discussion');
    if (!next || next.id) storageSet('companion', next || null);
    if (next && next.id) {
      setLast(next.id);
      storageSet('companion-last', next.id);
    }
  }, []);

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
  }), [flash, showThread]);
  const current = thread && thread.id ? thread.id : null;
  const actionValue = useMemo(() => ({ ...actions, current }), [actions, current]);
  const closeAsk = useCallback(() => setAskBar(null), []);
  // The ask bar takes the selection from whichever pane holds it (and that pane's focus).
  const openAsk = useCallback(() => {
    const beside = sideScroller.current ? captureSelection(sideScroller.current) : {};
    if (beside.selection) {
      setActivePane('side');
      setAskBar(beside);
      return;
    }
    const here = captureSelection(scroller.current);
    if (here.selection) setActivePane('main');
    setAskBar(here);
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

  // "/" searches, as in many reading tools, unless a field or the discussion has the keyboard.
  useEffect(() => {
    const onKey = (event) => {
      if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) return;
      if (target && target.closest && target.closest('.atlas-companion')) return;
      const root = rootRef.current;
      if (!root || !root.isConnected || root.getClientRects().length === 0) return;
      event.preventDefault();
      go({ view: 'search', at: Date.now() });
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

  // The body's width decides between columns and tabs.
  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => setBodyWidth(el.clientWidth));
    ro.observe(el);
    setBodyWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

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
    else if (route.view === 'paper' && route.url) body = h(PaperRefView, { ...props, key: route.url, url: route.url, topic: route.topic });
    else if (route.view === 'team') body = h(TeamView, { ...props, key: (route.path || '') + ':' + (route.thread || ''), path: route.path, thread: route.thread });
    else body = h(UniverseView, props);
  }
  const area = route.view === 'library' ? 'library' : route.view === 'home' ? 'home' : route.view === 'activity' || route.view === 'team' ? 'activity' : route.view === 'learn' ? 'learn' : '';
  const waiting = overview.data ? waitingItems(overview.data).length : 0;
  const filtering = route.view === 'home' || route.view === 'library';
  const open = Boolean(thread && (thread.id || thread.pending));
  const tabbed = sideLayout({ width: bodyWidth || Infinity, side: Boolean(side), discussion: open, sideWidth, companionWidth: paneWidth }) === 'tabs';
  const rightWidth = tabbed ? sideWidth : (side ? sideWidth : 0) + (open ? paneWidth : 0);
  const setSideWidthSaved = (w, save) => {
    setSideWidth(w);
    if (save) storageSet('side-width', w);
  };
  const tabs = tabbed ? h('div', { className: 'atlas-tabs', role: 'tablist', 'aria-label': 'Beside the page' },
    h('button', { type: 'button', role: 'tab', 'aria-selected': sideTab === 'file', className: cx('atlas-tab', sideTab === 'file' && 'is-on'), title: side.url || side.path, onClick: () => setSideTab('file') },
      h(Icon, { name: TYPE_ICON[side.url ? 'pdf' : typeOf(side.path)] || 'note', size: 14 }), h('span', null, sideTitle(overview.data, side))),
    h('button', { type: 'button', role: 'tab', 'aria-selected': sideTab === 'discussion', className: cx('atlas-tab', sideTab === 'discussion' && 'is-on'), onClick: () => setSideTab('discussion') },
      h(Icon, { name: 'spark', size: 14 }), h('span', null, 'Discussion'))) : null;
  return h(AtlasActions.Provider, { value: actionValue },
    h('div', { className: cx('atlas-root', open && 'has-companion'), 'data-theme-base': theme.base, 'data-theme': theme.name, style: themeStyle(theme), ref: rootRef },
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
          h('button', { type: 'button', className: 'atlas-icon-button', title: 'Add a paper, a lecture or files', 'aria-label': 'Add a paper, a lecture or files', onClick: () => go({ view: 'library', tab: 'discover', add: Date.now() }) }, h(Icon, { name: 'plus' })),
          !open && last ? h('button', { type: 'button', className: 'atlas-icon-button', title: 'Show the last discussion', 'aria-label': 'Show the last discussion', onClick: () => showThread({ id: last }) }, h(Icon, { name: 'panel' })) : null,
          h('button', { type: 'button', className: 'atlas-icon-button', title: `Theme: ${modeLabel(mode)}. Click for ${modeLabel(nextMode)}.`, 'aria-label': `Theme: ${modeLabel(mode)}`, onClick: () => themeModeStore.set(nextMode) }, h(Icon, { name: THEME_ICON[mode] || (theme.base === 'day' ? 'sun' : 'moon') })),
          h('button', { type: 'button', className: cx('atlas-icon-button', overview.loading && 'is-busy'), title: 'Read the files again', 'aria-label': 'Read the files again', onClick: () => setVersion(Date.now()) }, h(Icon, { name: 'refresh' })))),
      h(Flash, { message }),
      h('div', { className: cx('atlas-body', (side || open) && 'has-right', open && 'has-companion', tabbed && 'is-tabbed'), ref: bodyRef, style: { '--right-w': rightWidth + 'px', '--tab-w': sideWidth + 'px' } },
        h('main', { className: 'atlas-main', ref: scroller, onPointerDownCapture: () => setActivePane('main') }, h(PaneContext.Provider, { value: 'main' }, h(Boundary, null, body))),
        side ? h(SidePane, { entry: side, overview: overview.data, go: goSide, flash, version, width: sideWidth, onWidth: setSideWidthSaved, canBack: sideBack, onBack: sideGoBack, onClose: closeSide, onFull: openAsPage, tabs, hidden: tabbed && sideTab !== 'file', scrollRef: sideScroller }) : null,
        open ? h(Boundary, null, h(Companion, {
          threadId: thread.id,
          pending: Boolean(thread.pending),
          onClose: () => showThread(null),
          flash,
          tabs,
          hidden: tabbed && sideTab !== 'discussion',
          width: tabbed ? sideWidth : paneWidth,
          onWidth: tabbed ? setSideWidthSaved : (w, save) => {
            setPaneWidth(w);
            if (save) storageSet('companion-width', w);
          },
        })) : null,
        h(PaneContext.Provider, { value: 'main' }, h(SelectionTools, { container: scroller, host: bodyRef })),
        side ? h(PaneContext.Provider, { value: 'side' }, h(SelectionTools, { container: sideScroller, host: bodyRef })) : null,
        askBar ? h(AskBar, { preset: askBar, onClose: closeAsk }) : null)));
}
