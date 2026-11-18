const PANES = ['left', 'right'];
const TAB_DRAG = 'application/x-atlas-tab';

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

// Tabs v2. The body order is deliberately independent of strip order: React must
// see the same keyed siblings when an editor or retained DSH session changes pane.
const TAB_PLACES = { desk: ['Desk', 'desk'], discussions: ['Discussions', 'chat'], teams: ['Teams', 'team'], map: ['Map', 'universe'], library: ['Library', 'library'], learn: ['Learn', 'learn'], write: ['Write', 'writing'], search: ['Search', 'search'] };
const tabPreviewable = (kind) => ['file', 'paper', 'topic'].includes(kind);

function tabSpec(route, places) {
  if (!route) return null;
  const view = route.view === 'home' ? (route.anchor ? 'map' : 'desk') : route.view === 'activity' ? 'discussions' : route.view;
  if (view === 'desk') return { kind: 'desk', id: 'desk', key: 'desk' };
  if (Object.hasOwn(TAB_PLACES, view)) return { ...route, view, kind: 'place', key: 'place:' + view };
  if (view === 'doc' && route.path) return { ...route, kind: places?.has(pathKey(route.path)) ? 'topic' : 'file', key: 'file:' + pathKey(route.path) };
  if (view === 'paper' && route.url && /^https?:\/\//i.test(route.url)) return { ...route, kind: 'paper', key: 'url:' + route.url };
  if (view === 'preview' && route.main) return { ...route, kind: 'preview', key: 'preview:' + pathKey(route.main) };
  if (['discussion', 'member', 'team'].includes(view) && route.sessionId) return { ...route, kind: view, key: view + ':' + route.sessionId };
  if (view === 'team') return { ...route, view: 'teams', kind: 'place', key: 'place:teams' };
  return null;
}

function emptyTabState() {
  return { tabs: { desk: tabSpec({ view: 'desk' }) }, order: ['desk'], layout: { left: ['desk'], right: [], active: { left: 'desk', right: null }, split: 50 }, lastPane: 'left', closed: [], lastDiscussion: null };
}

/** RT-1…8. Existing tabs win even over modifiers. Narrow mode is a projection,
 * not a saved move: a previously split workspace comes back at full width. */
function tabDestination(state, from, spec, opts = {}) {
  const existing = Object.values(state.tabs).find(t => t.key === spec.key);
  if (existing) return paneOfTab(state.layout, existing.id);
  if (opts.narrow || spec.kind === 'desk') return 'left';
  const source = paneOfTab(state.layout, from) || state.lastPane;
  if (opts.otherPane || opts.shiftKey) return otherPane(source);
  if (opts.ctrlKey || opts.metaKey || opts.samePane) return source;
  if (spec.kind === 'place' || spec.kind === 'team') return 'left';
  if (spec.kind === 'member') return 'right';
  if (spec.kind === 'discussion' && state.tabs[from]?.kind === 'desk') return source;
  if (spec.kind === 'preview' || spec.kind === 'discussion') return otherPane(source);
  if (['desk', 'place'].includes(state.tabs[from]?.kind)) return 'right';
  return otherPane(source);
}

function tabActivate(s, id) {
  const p = paneOfTab(s.layout, id);
  if (!p || (s.lastPane === p && s.layout.active[p] === id)) return s;
  return { ...s, lastPane: p, layout: { ...s.layout, active: { ...s.layout.active, [p]: id } } };
}

function tabPromote(s, id) {
  const t = s.tabs[id];
  return t?.temporary ? { ...s, tabs: { ...s.tabs, [id]: { ...t, temporary: false } } } : s;
}

function tabCloseState(s, id, remember = true) {
  if (!s.tabs[id] || id === 'desk') return s;
  const pane = paneOfTab(s.layout, id);
  const tabs = { ...s.tabs };
  const { edit, created, ...tab } = tabs[id];
  delete tabs[id];
  const layout = layoutRemove(s.layout, id);
  const closed = remember ? [...s.closed.filter(entry => entry.tab.key !== tab.key), { tab: { ...tab, temporary: false }, pane, index: s.layout[pane].indexOf(id) }].slice(-20) : s.closed;
  return { ...s, tabs, order: s.order.filter(i => i !== id), layout, lastPane: layout[s.lastPane].length ? s.lastPane : 'left', closed };
}

function tabFoldPreviews(s) {
  // Both strips now read as one. Keep its last-used replacement slot and pin the
  // other one, rather than discarding a body or silently keeping two slots.
  const primary=s.layout[s.lastPane].find(id=>s.tabs[id].temporary);
  const other=s.layout[otherPane(s.lastPane)].find(id=>s.tabs[id].temporary);
  return primary && other ? tabPromote(s,other) : s;
}

function tabOpenState(s, from, spec, opts = {}, dirty = {}) {
  if (!spec) return s;
  const pane = tabDestination(s, from, spec, opts);
  const existing = Object.values(s.tabs).find(t => t.key === spec.key);
  const permanent = !tabPreviewable(spec.kind) || opts.permanent || opts.ctrlKey || opts.metaKey || opts.button === 1 || spec.edit || spec.created;
  if (existing) {
    const tab = { ...existing, ...spec, ...(existing.path && ['file','topic'].includes(spec.kind) ? {path: existing.path} : {}), id: existing.id, edit: Boolean(existing.edit || spec.edit), temporary: Boolean(existing.temporary && !permanent) };
    return tabActivate({ ...s, tabs: { ...s.tabs, [tab.id]: tab } }, tab.id);
  }
  let next = opts.narrow ? tabFoldPreviews(s) : s;
  // M1: one actual DSH conversation at a time, but the v2 identity and
  // reopen entry are always for a specific (never an anonymous) session.
  if (spec.kind === 'discussion' || spec.kind === 'member') {
    const old = Object.values(next.tabs).find(t => t.kind === 'discussion' || t.kind === 'member');
    if (old) next = tabCloseState(next, old.id);
  }
  if (!permanent) {
    const candidates = opts.narrow ? next.order : next.layout[pane];
    const old = candidates.find(id => next.tabs[id].temporary);
    if (old) next = dirty[old] || next.tabs[old].edit ? tabPromote(next, old) : tabCloseState(next, old, false);
  }
  // Old random IDs are valid on restore. New IDs are stable and namespaced.
  let id = spec.id || spec.key;
  while (Object.hasOwn(next.tabs, id)) id += ':';
  const tab = { ...spec, id, temporary: !permanent };
  return { ...next, lastPane: pane, tabs: { ...next.tabs, [id]: tab }, order: [...next.order, id], layout: layoutAdd(next.layout, id, pane, next.layout.active[pane]), ...(tab.kind === 'discussion' ? { lastDiscussion: tab.sessionId } : {}) };
}

/** A jump inside an editor can change the file it edits (`stay`), or leave
 * editing. Only those two transitions can discard a buffer. A link from a
 * different tab always preserves the existing editor, even if its path uses
 * different casing. The caller supplies the discard prompt. */
function tabFollowState(s, from, spec, opts, dirty, discard) {
  const own=s.tabs[from];
  if (!own || !spec) return s;
  if (['file','topic'].includes(own.kind) && ['file','topic'].includes(spec.kind) && (own.key===spec.key || spec.stay)) {
    const twin=Object.values(s.tabs).find(t=>t.id!==from && t.key===spec.key);
    if (!twin) {
      const edit=Boolean(spec.edit || (own.edit && spec.anchor && spec.edit !== false));
      const leaving=own.key!==spec.key || (own.edit && !edit);
      if (leaving && dirty[from] && !discard(from)) return s;
      const temporary=Boolean(own.temporary && !edit && !opts.permanent && !opts.ctrlKey && !opts.metaKey && opts.button!==1);
      const tab={...own,...spec,id:from,path:own.key===spec.key ? own.path : spec.path, temporary,edit};
      return tabActivate({...s,tabs:{...s.tabs,[from]:tab}},from);
    }
  }
  return tabOpenState(s,from,spec,opts,dirty);
}

function tabMoveState(s, id, pane, index) {
  if (!s.tabs[id] || id === 'desk' || !PANES.includes(pane)) return s;
  const oldIndex = s.layout[pane].indexOf(id);
  let at = index == null ? undefined : index - (oldIndex >= 0 && oldIndex < index ? 1 : 0);
  if (at != null && pane === 'left') at = Math.max(1, at);
  return { ...tabPromote(s, id), lastPane: pane, layout: layoutMove(s.layout, id, pane, at) };
}

function tabReopen(s, narrow = false) {
  const entry = s.closed.at(-1);
  if (!entry) return s;
  const cleared = { ...s, closed: s.closed.slice(0, -1) };
  const existing = Object.values(s.tabs).find(t => t.key === entry.tab.key);
  if (existing) return tabActivate(cleared, existing.id);
  const opened = tabOpenState(cleared, 'desk', entry.tab, { permanent: true, narrow });
  const id = opened.layout.active[opened.lastPane];
  const pane = narrow ? 'left' : entry.pane;
  return { ...opened, lastPane: pane, layout: layoutMove(opened.layout, id, pane, Math.max(pane === 'left' ? 1 : 0, entry.index)) };
}

function tabScreenLayout(s, narrow) {
  if (!narrow || !s.layout.right.length) return s.layout;
  return { ...s.layout, left: [...s.layout.left, ...s.layout.right], right: [], active: { left: s.layout.active[s.lastPane], right: null } };
}

function tabV2Label(t, ov) {
  if (t.kind === 'desk' || t.kind === 'place') return TAB_PLACES[t.view || 'desk']?.[0] || 'Desk';
  if (t.kind === 'discussion' || t.kind === 'team' || t.kind === 'member') return t.title || (t.kind === 'discussion' ? 'Discussion' : t.kind === 'member' ? 'Member' : 'Team');
  if (t.kind === 'preview') return 'Preview · ' + baseName(String(t.pdf || t.main || '').replace(/\.tex$/i, '.pdf'));
  return sideTitle(ov, t);
}

function tabV2Icon(t) {
  if (t.kind === 'desk' || t.kind === 'place') return TAB_PLACES[t.view || 'desk']?.[1] || 'desk';
  if (t.kind === 'discussion' || t.kind === 'member') return 'chat';
  if (t.kind === 'team') return 'team';
  if (t.kind === 'topic') return 'topics';
  return t.kind === 'paper' || t.kind === 'preview' ? 'paper' : TYPE_ICON[typeOf(t.path)] || 'note';
}

// Save only navigation data. In particular no dirty draft, capture, or live
// session object belongs in this key. Storage helpers handle denied access.
function persistedTab(t) {
  const safe = {};
  for (const k of ['id', 'kind', 'key', 'view', 'path', 'url', 'topic', 'anchor', 'main', 'pdf', 'tab', 'filter', 'thread', 'sessionId', 'title', 'q', 'temporary']) if (typeof t[k] === 'string' || typeof t[k] === 'boolean') safe[k] = t[k];
  return safe;
}
function saveTabState(s) {
  storageSet('tabs.v2', { tabs: s.order.map(id => persistedTab(s.tabs[id])), layout: s.layout, lastPane: s.lastPane, lastDiscussion: s.lastDiscussion, closed: s.closed.map(e => ({ ...e, tab: persistedTab(e.tab) })) });
}

function readSavedTab(raw) {
  if (!raw || typeof raw.id !== 'string' || !raw.id || Object.hasOwn(Object.prototype, raw.id)) return null;
  const t = persistedTab(raw);
  const view = t.kind === 'topic' || t.kind === 'file' ? 'doc' : t.kind === 'place' ? t.view : t.kind;
  const spec = tabSpec({ ...t, view });
  if (!spec || (spec.kind !== t.kind && !(spec.kind === 'file' && t.kind === 'topic'))) return null;
  return { ...spec, kind: t.kind, temporary: Boolean(t.temporary && tabPreviewable(t.kind)) };
}

/** Normalize malformed/partial storage: one identity, one pane, Desk first,
 * no orphaned bodies, at most one replaceable preview per physical pane. */
function restoreTabSnapshot(saved) {
  const s = emptyTabState();
  if (!saved?.layout) return s;
  const ids = new Set(['desk']), keys = new Set(['desk']);
  let conversation = false;
  for (const raw of Array.isArray(saved.tabs) ? saved.tabs : []) {
    const t = readSavedTab(raw);
    if (!t || ids.has(t.id) || keys.has(t.key)) continue;
    if (t.kind === 'discussion' || t.kind === 'member') { if (conversation) continue; conversation = true; }
    s.order.push(t.id); s.tabs[t.id] = t; ids.add(t.id); keys.add(t.key);
  }
  const assigned = new Set(['desk']);
  for (const p of PANES) {
    for (const id of Array.isArray(saved.layout[p]) ? saved.layout[p] : []) {
      if (!ids.has(id) || assigned.has(id)) continue;
      s.layout[p].push(id); assigned.add(id);
    }
  }
  for (const id of ids) if (!assigned.has(id)) s.layout.left.push(id);
  for (const p of PANES) {
    let temporary = false;
    for (const id of s.layout[p]) if (s.tabs[id].temporary) { s.tabs[id].temporary = !temporary; temporary = true; }
    const shown = saved.layout.active?.[p];
    s.layout.active[p] = s.layout[p].includes(shown) ? shown : s.layout[p].at(-1) || null;
  }
  s.layout.split = Math.max(20, Math.min(80, Number(saved.layout.split) || 50));
  s.lastPane = saved.lastPane === 'right' && s.layout.right.length ? 'right' : 'left';
  s.lastDiscussion = typeof saved.lastDiscussion === 'string' ? saved.lastDiscussion : null;
  for (const entry of Array.isArray(saved.closed) ? saved.closed.slice(-20) : []) {
    const t = readSavedTab(entry?.tab);
    if (t && t.kind !== 'desk') s.closed.push({ tab: t, pane: entry.pane === 'right' ? 'right' : 'left', index: Math.max(0, Number(entry.index) || 0) });
  }
  return s;
}

function migrateTabState(saved, route, companion, last, side, places) {
  const oldLayout = saved?.layout || {};
  const layout = { left: [], right: [], active: {}, split: oldLayout.split };
  const tabs = (Array.isArray(saved?.tabs) ? saved.tabs : []).map(readSavedTab).filter(Boolean);
  if (!saved?.layout && side && (side.path || side.url)) {
    const t = tabSpec({ ...side, view: side.url ? 'paper' : 'doc' }, places);
    if (t) { t.id = t.key; tabs.push(t); layout.right.push(t.id); }
  }
  const dest = tabSpec(route || { view: 'desk' }, places) || tabSpec({ view: 'desk' });
  let page = tabs.find(t => t.key === dest.key);
  if (!page) { page = { ...dest, id: dest.id || dest.key }; tabs.push(page); }
  else if (route?.anchor) page.anchor = route.anchor;
  let discussion = null;
  if (typeof companion?.id === 'string' && companion.id) {
    discussion = tabSpec({ view: 'discussion', sessionId: companion.id });
    discussion.id = discussion.key; tabs.push(discussion);
  }
  const idOf = id => id === 'page' ? page.id : id === 'discussion' ? discussion?.id : id;
  for (const p of PANES) {
    if (Array.isArray(oldLayout[p])) layout[p].push(...oldLayout[p].map(idOf).filter(Boolean));
    layout.active[p] = idOf(oldLayout.active?.[p]);
  }
  if (!paneOfTab(layout, page.id)) layout.left.push(page.id);
  if (discussion && !paneOfTab(layout, discussion.id)) layout.right.push(discussion.id);
  return restoreTabSnapshot({ tabs, layout, lastDiscussion: companion?.id || last });
}

function AtlasTabStrip({ pane, ids, active, last, tabs, ov, width, running, drag, drop, menuItems, onShow, onClose, onFocus, onPromote, onDrag, onDropAt, domId }) {
  const list = useRef(null);
  const [overflow, setOverflow] = useState(false);
  const [menu, setMenu] = useState(null);
  useLayoutEffect(() => {
    const el = list.current;
    const measure = () => {
      const on = el.querySelector('[aria-selected="true"]');
      if (on) {
        const x = on.offsetLeft;
        if (x < el.scrollLeft) el.scrollLeft = x;
        else if (x + on.offsetWidth > el.scrollLeft + el.clientWidth) el.scrollLeft = x + on.offsetWidth - el.clientWidth;
      }
      setOverflow(el.scrollWidth > el.clientWidth + 1);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const obs = new ResizeObserver(measure); obs.observe(el); for (const child of el.children) obs.observe(child);
    return () => obs.disconnect();
  }, [ids, active, ov]);
  const indexAt = x => {
    const children = Array.from(list.current.querySelectorAll('[role="tab"]'));
    const i = children.findIndex(el => { const r = el.getBoundingClientRect(); return x < r.left + r.width / 2; });
    return i < 0 ? ids.length : i;
  };
  const handleKey = (event, id) => {
    if (event.target !== event.currentTarget) return;
    const i = ids.indexOf(id);
    const next = { ArrowRight: ids[(i+1)%ids.length], ArrowLeft: ids[(i-1+ids.length)%ids.length], Home: ids[0], End: ids.at(-1), Enter: id, ' ': id }[event.key];
    if (!next) return;
    event.preventDefault(); onShow(next); document.getElementById(domId('tab', next))?.focus();
  };
  const tool = (kind, label, icon, items) => {
    const open = (e, initial) => { const anchor=e.currentTarget; setMenu(m => m?.kind === kind ? null : {kind, anchor, initial}); };
    return h(IconButton, {label, icon, className:'atlas-strip-tool', 'aria-haspopup':'menu','aria-expanded':menu?.kind===kind, onClick:e=>open(e,'first'), onKeyDown:e=>{if (e.key==='ArrowDown' || e.key==='ArrowUp') { e.preventDefault();open(e,e.key==='ArrowUp'?'last':'first'); }} });
  };
  return h('div', { className:cx('atlas-strip', last && 'is-last', drop?.pane === pane && drop.where === 'strip' && 'is-drop'), style:{width}, ...onDropAt(pane,'strip',indexAt) },
    h('div', {className:'atlas-strip-tabs', role:'tablist', 'aria-label': `${pane === 'left' ? 'Left' : 'Right'} pane`, ref:list,
      onWheel:e=>{if (Math.abs(e.deltaY)>Math.abs(e.deltaX)) e.currentTarget.scrollLeft += e.deltaY;}},
    ids.map((id,i)=>{
      const t=tabs[id],label=tabV2Label(t,ov),on=id===active;
      return h('div',{key:id,role:'tab', id:domId('tab',id), 'aria-controls':domId('panel',id), 'aria-selected':on, tabIndex:on?0:-1, draggable:id!=='desk',
        title:t.path || t.url || label, className:cx('atlas-ptab',on&&'is-on',t.temporary&&'is-temporary',drag===id&&'is-dragging',drag!==id&&drop?.pane===pane&&drop.where==='strip'&&drop.index===i&&'is-insert'),
        onClick:()=>onShow(id), onDoubleClick:()=>onPromote(id), onKeyDown:e=>handleKey(e,id), onMouseDown:e=>{if(e.button===1)e.preventDefault();},onAuxClick:e=>{if(e.button===1){e.preventDefault();onClose(id);}},
        onDragStart:e=>{ e.dataTransfer.setData(TAB_DRAG,id); e.dataTransfer.effectAllowed='move';onPromote(id);onDrag(id); },onDragEnd:()=>onDrag(null)},
        h(Icon,{name:tabV2Icon(t),size:16}),h('span',{className:'atlas-ptab-label'},label),
        h('span',{className:'atlas-tab-slot'},
          running(t) ? h('span',{className:'atlas-tab-status atlas-tab-working',role:'img','aria-label':'Working'}) : editorDirty[id] ? h('span',{className:'atlas-tab-status atlas-tab-dirty',role:'img','aria-label':'Unsaved changes'}) : null,
          id !== 'desk' ? h('button',{type:'button',className:'atlas-ptab-close',tabIndex:on?0:-1,'aria-label':'Close '+label,title:'Close '+label,onClick:e=>{e.stopPropagation();onClose(id);}},h(Icon,{name:'close',size:12})) : null));
    }),drop?.pane===pane&&drop.where==='strip'&&drop.index===ids.length ? h('span',{className:'atlas-ptab-end'}) : null),
    overflow && tool('list','List tabs','chevron'),
    h(IconButton,{label:'Focus pane',icon:'expand',className:'atlas-strip-tool',onClick:()=>onFocus(active)}),
    tool('menu','Pane menu','more'),
    menu ? h(Menu,{anchor:menu.anchor,align:'end',side:'bottom',initial:menu.initial,label:menu.kind==='list'?'Tabs':'Pane options',onClose:()=>setMenu(null),items:menu.kind==='list'?ids.map(id=>({id,label:tabV2Label(tabs[id],ov),icon:tabV2Icon(tabs[id]),onSelect:()=>onShow(id)})):menuItems}) : null);
}

const ATLAS_TAB_CSS = `
.atlas-root.atlas-shell-v2 {position:relative;isolation:isolate;flex-direction:row;}
.atlas-library-local-filter {display:block;padding:var(--s-12) var(--s-24) 0;}
.atlas-library-local-filter > input {width:min(100%,36ch);}
.atlas-shell-v2 .atlas-body {min-width:0;}
.atlas-shell-v2 .atlas-strips {height:var(--s-40);z-index:var(--z-strip);background:var(--bg);border-bottom:1px solid var(--border);}
.atlas-shell-v2 .atlas-strip {align-items:center;padding:0 var(--s-8) 0 6px;gap:var(--s-4);}
.atlas-shell-v2 .atlas-strip-tabs {align-items:center;padding:0;}
.atlas-shell-v2 .atlas-ptab {height:30px;max-width:220px;padding:0 var(--s-4) 0 10px;gap:7px;border:0;border-radius:8px;color:var(--text-2);font:var(--t-ui);}
.atlas-shell-v2 .atlas-ptab > .atlas-icon {color:var(--text-3);}
.atlas-shell-v2 .atlas-ptab:hover {color:var(--text-1);background:var(--hover);}
.atlas-shell-v2 .atlas-ptab.is-on {background:var(--raised);color:var(--text-1);font-weight:500;box-shadow:inset 0 0 0 1px var(--border);}
.atlas-shell-v2 .atlas-strip.is-last .atlas-ptab.is-on {background:var(--accent-soft);box-shadow:inset 0 0 0 1px var(--border-strong);}
.atlas-shell-v2 .atlas-strip.is-last .atlas-ptab.is-on > .atlas-icon {color:var(--accent);}
.atlas-shell-v2 .atlas-ptab.is-temporary .atlas-ptab-label {font-style:italic;}
.atlas-tab-slot {width:var(--s-20);height:var(--s-20);flex:none;display:grid;place-items:center;}
.atlas-tab-slot > * {grid-area:1/1;}
.atlas-tab-dirty {width:var(--s-8);height:var(--s-8);border-radius:var(--r-full);background:var(--text-2);}
.atlas-tab-working {width:var(--s-12);height:var(--s-12);background:var(--accent);clip-path:var(--star-shape);animation:atlas-twinkle var(--motion-twinkle) var(--ease) infinite alternate;}
.atlas-ptab:hover .atlas-tab-status,.atlas-ptab.is-on .atlas-tab-status {visibility:hidden;}
.atlas-shell-v2 .atlas-strip-tool {margin:0;flex:none;width:28px;height:28px;}
.atlas-shell-v2 .atlas-tab-body {background:var(--surface);}
@media (prefers-reduced-motion:reduce){.atlas-tab-working {animation:none;}}
`;

function loadTabState() {
  const saved = storageGet('tabs.v2', null);
  if (saved?.layout) return restoreTabSnapshot(saved);
  return migrateTabState(storageGet('tabs', null), storageGet('route', null), storageGet('companion', null), storageGet('companion-last', null), storageGet('side', null));
}
