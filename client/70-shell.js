// ------------------------------------------------------------------- shell ---
// Three places, the Universe, Activity and the Library; every document opens
// inside them, and a discussion with the AI opens in the companion pane beside them.

const NAV = [['home', 'Universe', 'universe'], ['activity', 'Activity', 'activity'], ['library', 'Library', 'library'], ['learn', 'Learn', 'learn']];

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
  const routeRef = useRef(route);
  const historyRef = useRef([]);
  const scroller = useRef(null);
  const bodyRef = useRef(null);
  const rootRef = useRef(null);
  const ovRef = useRef(null);
  const threadRef = useRef(thread);
  ovRef.current = overview.data;

  const go = useCallback((next) => {
    if (editorDirty.current && !window.confirm('Leave without saving your changes?')) return;
    editorDirty.current = false;
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
    if (scroller.current && !(samePage && next.anchor)) scroller.current.scrollTop = 0;
  }, []);

  /** The companion shows one discussion, a discussion being started, or nothing. */
  const showThread = useCallback((next) => {
    threadRef.current = next;
    setThread(next);
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
  const openAsk = useCallback(() => setAskBar(captureSelection(scroller.current)), []);

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
    if (route.view !== 'home' || !route.anchor) return;
    const timer = setTimeout(() => {
      const el = document.getElementById('atlas-dir-' + route.anchor);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
    return () => clearTimeout(timer);
  }, [route, overview.data]);

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
    else if (route.view === 'team') body = h(TeamView, { ...props, key: (route.path || '') + ':' + (route.thread || ''), path: route.path, thread: route.thread });
    else body = h(UniverseView, props);
  }
  const area = route.view === 'library' ? 'library' : route.view === 'home' ? 'home' : route.view === 'activity' || route.view === 'team' ? 'activity' : route.view === 'learn' ? 'learn' : '';
  const waiting = overview.data ? waitingItems(overview.data).length : 0;
  const filtering = route.view === 'home' || route.view === 'library';
  const open = Boolean(thread && (thread.id || thread.pending));
  return h(AtlasActions.Provider, { value: actionValue },
    h('div', { className: cx('atlas-root', open && 'has-companion'), ref: rootRef },
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
          h('button', { type: 'button', className: cx('atlas-icon-button', overview.loading && 'is-busy'), title: 'Read the files again', 'aria-label': 'Read the files again', onClick: () => setVersion(Date.now()) }, h(Icon, { name: 'refresh' })))),
      h(Flash, { message }),
      h('div', { className: cx('atlas-body', open && 'has-companion'), ref: bodyRef, style: open ? { '--companion-w': paneWidth + 'px' } : undefined },
        h('main', { className: 'atlas-main', ref: scroller }, h(Boundary, null, body)),
        open ? h(Boundary, null, h(Companion, {
          threadId: thread.id,
          pending: Boolean(thread.pending),
          onClose: () => showThread(null),
          flash,
          width: paneWidth,
          onWidth: (w, save) => {
            setPaneWidth(w);
            if (save) storageSet('companion-width', w);
          },
        })) : null,
        h(SelectionTools, { container: scroller, host: bodyRef }),
        askBar ? h(AskBar, { preset: askBar, onClose: closeAsk }) : null)));
}
