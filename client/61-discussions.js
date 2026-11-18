// Server-owned discussion metadata. The 0.x browser index remains untouched for rollback and M3.
const registryEmptyNeeds = { waiting: [], reviews: [], decisions: [] };
const registryInitial = { root: '', records: [], needs: registryEmptyNeeds, loading: true, error: '', needsError: '', migrationError: '' };
const registryState = externalStore(registryInitial);
const registryRetry = externalStore(0);
let registryQueue = Promise.resolve(), registryEpoch = 0;

// Keep POSIX case significant; never infer workspace membership from a common path prefix.
function registryPath(path) {
  const s = String(path || '').replace(/\\/g, '/').replace(/\/+$/, '');
  return /^(?:[A-Za-z]:|\/\/)/.test(s) ? s.toLowerCase() : s;
}
function registryInRoot(root, file) {
  const r = registryPath(root), f = registryPath(file);
  if (!r || !f || f.split('/').some(x => x === '..' || x === '.')) return false;
  return f === r || f.startsWith(r + '/');
}
function registryLegacyCandidates(legacy, root, rows) {
  if (!Array.isArray(legacy)) return [];
  const seen = new Set();
  return legacy.filter(t => {
    if (!t || typeof t.id !== 'string' || !t.id || t.kind === 'team' || seen.has(t.id)) return false;
    const row = rowOf(rows, t.id), topic = t.context?.topic?.path;
    if (row?.cwd && !registryInRoot(root, row.cwd)) return false;
    if (topic && !registryInRoot(root, topic)) return false;
    // Topic-bound 0.x records have a local witness even when their DSH row is
    // unavailable. Without one, wait for a ready DSH row with a matching cwd.
    if (!topic && !(rows?.phase === 'ready' && registryInRoot(root, row?.cwd))) return false;
    seen.add(t.id); return true;
  });
}
async function registryImportLegacy(records, ack, importBatch, saveAck) {
  const done = new Set(ack), problems = [];
  // The host also deduplicates by id. A crash before saving the ack only causes a harmless replay.
  // One record per call: 0.x selections can be long; never exceed the limit by batching 400 rows.
  for (const record of records) {
    if (done.has(record.id)) continue;
    const result = await importBatch({ records: [record] });
    if (result.rejected?.length) { problems.push(...result.rejected.map(r => r.reason)); continue; }
    if ((result.imported || 0) + (result.existing || 0) !== 1) { problems.push('The server did not acknowledge ' + record.id); continue; }
    done.add(record.id); saveAck([...done]);
  }
  return problems;
}
function registryPublish(patch) { registryState.set({ ...registryState.get(), ...patch }); }
function registrySerial(fn) {
  const epoch = registryEpoch;
  const result = registryQueue.then(() => {
    if (epoch !== registryEpoch) throw new Error('The research workspace changed.');
    return fn(() => epoch === registryEpoch);
  });
  registryQueue = result.catch(() => {});
  return result;
}
function registryRemember(row) {
  if (!row?.id) throw new Error('The discussions service did not return a record.');
  registryPublish({ records: [row, ...registryState.get().records.filter(r => r.id !== row.id)] });
}
function registryGet(id) { return registryState.get().records.find(r => r.id === id); }
function registryCommand(name, method, body) {
  return registrySerial(async current => {
    const result = await api(name, { method, body });
    if (current()) registryRemember(result.discussion);
    return result;
  });
}
async function registryCreate(record) { return (await registryCommand('discussions', 'POST', record)).discussion; }
function registryPatchRaw(id, patch) { return registryCommand('discussions/' + encodeURIComponent(id), 'PATCH', patch); }
async function registryPatch(id, patch) { return (await registryPatchRaw(id, patch)).discussion; }
function registryRefresh() {
  if (!registryState.get().root) return Promise.resolve();
  const epoch = registryEpoch;
  const list = registrySerial(async current => {
    try {
      const data = await api('discussions', { query: { status: 'all' } });
      if (current()) registryPublish({ records: data.discussions, error: '', loading: false });
    } catch (e) { if (current()) registryPublish({ error: e.message, loading: false }); }
  });
  const needs = api('needs').then(data => {
    if (epoch === registryEpoch) registryPublish({ needs: data, needsError: '' });
  }, e => { if (epoch === registryEpoch) registryPublish({ needsError: e.message }); });
  return Promise.all([list, needs]);
}
function useRegistrySnapshot() {
  const snap = React.useSyncExternalStore(registryState.subscribe, registryState.get);
  return { ...snap, refresh: () => { registryRetry.set(registryRetry.get()+1); return registryRefresh(); } };
}
function useRegistryRecords() { return React.useSyncExternalStore(registryState.subscribe, registryState.get).records; }
/** Mount once in the shell; child views only subscribe. No old key is deleted or overwritten. */
function useDiscussionRegistry(root) {
  const rows = useSessionRows();
  const state = useRegistrySnapshot();
  const legacy = React.useSyncExternalStore(threadStore.subscribe, threadStore.get);
  const candidates = registryLegacyCandidates(legacy, root, rows);
  const idsKey = JSON.stringify(candidates.map(t => t.id));
  const retry = React.useSyncExternalStore(registryRetry.subscribe,registryRetry.get);
  useEffect(() => {
    ++registryEpoch;
    registryState.set({ ...registryInitial, root: root || '' });
    if (!root) return;
    let live = true;
    const refresh = () => { if (live && document.visibilityState !== 'hidden') registryRefresh(); };
    registryRefresh();
    const timer = setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    return () => { live = false; ++registryEpoch; clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [root]);
  useEffect(() => {
    if (!root || !candidates.length) return;
    const key = 'threads-imported:discussions:' + encodeURIComponent(registryPath(root));
    const saved = storageGet(key, []), ack = Array.isArray(saved) ? saved : [];
    if (candidates.every(t => ack.includes(t.id))) return;
    const epoch = registryEpoch;
    let live = true;
    registrySerial(async current => {
      if (!live) return;
      try {
        const problems = await registryImportLegacy(candidates, ack, body => {
          if (!current()) throw new Error('The research workspace changed.');
          return api('discussions/import', { method: 'POST', body });
        }, value => storageSet(key, value));
        if (current()) registryPublish({ migrationError: problems.join('; ') });
      } catch (e) { if (current()) registryPublish({ migrationError: e.message }); }
    }).finally(() => { if (live && epoch === registryEpoch) registryRefresh(); }).catch(() => {});
    return () => { live = false; };
  }, [root, idsKey, retry]);
  return state;
}

// One six-second grace period per action, including a bulk move. Delivery is at-most-once:
// claim durably before queueing; never replay an uncertain send after a disconnect or a reload.
const registryUndoMs = 6000;
function registryMoveController({ patch, send, timer = setTimeout, cancel = clearTimeout, token = () => crypto.randomUUID() }) {
  return async function move(ids, to, tell, flash) {
    const successful = [], errors = [];
    for (const id of new Set(ids)) {
      const key = token();
      try { await patch(id, { topic: { to, told: false, token: key } }); successful.push({ id, key }); }
      catch (e) { errors.push(e.message); }
    }
    if (!successful.length) throw new Error(errors.join('; ') || 'Select at least one discussion.');
    let active = true;
    const apply = async undo => {
      if (!active) return;
      active = false;
      const failed = [];
      for (const { id, key } of successful) {
        try {
          if (undo) { await patch(id, { undoMove: key }); continue; }
          if (!tell || !(await patch(id, { claimMove: key })).claimed) continue;
          await send(id, to ? `Atlas: this discussion is now filed under “${to.title}” (${to.path}). Read that note before you continue; earlier turns may have assumed another topic.` : 'Atlas: this discussion is now unfiled. Earlier turns may have assumed a topic.');
          await patch(id, { toldMove: key });
        } catch (e) { failed.push(e.message); }
      }
      if (failed.length) flash((undo ? 'Could not undo every move: ' : 'Move notification not confirmed: ') + failed.join('; '));
      else if (undo) flash('Move undone. No note was sent.');
    };
    const timeout = timer(() => apply(false), registryUndoMs);
    flash(`Moved to ${to?.title || 'Unfiled'}.${errors.length ? ` ${errors.length} not moved.` : ''}`, { duration: registryUndoMs, action: { label: 'Undo', onClick: () => { cancel(timeout); return apply(true); } } });
  };
}
function registryMove(ids, to, tell, flash) {
  const epoch = registryEpoch;
  const patch = (id, value) => {
    if (epoch !== registryEpoch) throw new Error('Workspace closed; no notification sent.');
    return registryPatchRaw(id, value);
  };
  return registryMoveController({ patch, send: (id,text) => atlasSendToSession(id,text) })(ids, to, tell, flash);
}

/** Ordered tree of real filing choices (the programme note is a distinct topic, not Unfiled). */
function registryTopicTree(ov) {
  const topics = Object.values(ov?.topics || {}), children = new Map();
  for (const topic of topics) {
    const p = topic.id === '' ? null : topic.parent ?? '';
    if (!children.has(p)) children.set(p, []);
    children.get(p).push(topic);
  }
  const visited = new Set(), out = [];
  function visit(t, depth) {
    if (!t || visited.has(t.id)) return;
    visited.add(t.id); out.push({ topic: { id: t.id, path: t.file, title: t.title, direction: t.direction || '' }, depth });
    for (const child of children.get(t.id) || []) visit(child, depth + 1);
  }
  for (const t of children.get(null) || []) visit(t, 0);
  for (const t of topics) visit(t, 0);
  return out;
}
function MoveDiscussion({ ids, overview, anchor, onClose, flash }) {
  const records = useRegistryRecords();
  const original = records.find(t => t.id === ids[0]);
  const [value, setValue] = useState(original?.topic?.id ?? null), [search, setSearch] = useState(''), [tell, setTell] = useState(true);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const lock = useRef(false), input = useRef(null);
  const tree = useMemo(() => registryTopicTree(overview), [overview]);
  const option = (topic, depth) => h('label', { key: topic ? `t:${topic.id}` : 'unfiled', className: 'atlas-disc-topic-option', style: { paddingInlineStart: `calc(var(--s-8) + ${depth}em)` } },
    h('input', { type: 'radio', checked: value === (topic?.id ?? null), onChange: () => setValue(topic?.id ?? null) }), topic ? h('span', { className: 'atlas-dot', style: { background: directionColor(overview, topic.direction) } }) : null, topic?.title || 'Unfiled');
  const move = async () => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const to = tree.find(x => x.topic.id === value)?.topic || null;
      if (value !== null && !to) throw new Error('Choose a topic that is still in the research.');
      await registryMove(ids, to, tell, flash); onClose();
    } catch (e) { setError(e.message); } finally { lock.current = false; setBusy(false); }
  };
  const contents = h('div', { className: 'atlas-disc-move' }, h(Input, { label: 'Find a topic', placeholder: 'Find a topic…', value: search, inputRef: input, onChange: e => setSearch(e.target.value) }),
    h('div', { role: 'radiogroup', 'aria-label': 'File under' }, option(null, 0), tree.filter(x => x.topic.title.toLowerCase().includes(search.toLowerCase())).map(x => option(x.topic,x.depth))),
    h(Checkbox, { checked: tell, onChange: e => setTell(e.target.checked), label: 'Tell the AI' }), error && h(Banner, { tone: 'error' }, error), h(Button, { primary: true, disabled: busy, onClick: move }, busy ? 'Moving…' : 'Move'));
  return anchor ? h(Popover, { anchor, label: 'Move discussion', initialFocusRef: input, onClose }, contents) : h(Dialog, { title: 'Move discussion', initialFocusRef: input, onClose }, contents);
}

function registryUnread(record) { return (record.lastTurnAt || 0) > (record.seenAt || 0); }
function registryVisibleList(records, rows, needs, filter = '', search = '', sort = 'activity') {
  const review = new Set((needs?.reviews || []).map(r => r.session));
  const q = String(search).trim().toLowerCase();
  const found = records.filter(r => {
    if (!knownThread(rows, r) || r.kind === 'team') return false;
    if (filter === 'resolved') { if (r.status !== 'resolved') return false; }
    else if (r.status === 'resolved') return false;
    if (filter === 'running' && !rowOf(rows,r.id)?.running) return false;
    if (filter === 'needs' && !review.has(r.id)) return false;
    if (filter === 'unread' && !registryUnread(r)) return false;
    if (filter === 'pinned' && !r.pinned) return false;
    if (filter === 'unfiled' && r.topic) return false;
    if (filter.startsWith('topic:') && (!r.topic || r.topic.id !== filter.slice(6))) return false;
    return !q || [r.title,r.question,r.topic?.title].some(v => String(v || '').toLowerCase().includes(q));
  });
  return found.sort((a,b) => sort === 'title' ? a.title.localeCompare(b.title) : sort === 'created' ? b.created-a.created : (b.updated || b.created)-(a.updated || a.created));
}
function registryOtherRows(root, rows, records, legacy, query) {
  if (rows?.phase !== 'ready') return [];
  const known = new Set([...records,...legacy].map(t => t.id));
  return (rows.ids || Object.keys(rows.byId)).map(id => ({ id, row:rowOf(rows,id) })).filter(({ id, row }) =>
    row && !known.has(id) && !parentOf(row) && row.origin !== 'subagent' && !teamOf(row) && !row.archived && !row.blank && registryInRoot(root,row.cwd) &&
    (!query || (row.displayTitle || row.title || id).toLowerCase().includes(query.toLowerCase()))).sort((a,b)=>(b.row.updatedAt||0)-(a.row.updatedAt||0));
}
function registryAdoption(id, row, now = Date.now()) {
  return { id, title: row.title || row.displayTitle || 'Untitled discussion', created: now, updated: now, seenAt: now, origin: 'import', intent:'ask', question:'', topic:null, filing:'none', status:'open', context:{topic:null, doc:null, page:'', section:'', lines:'', selection:''} };
}

function DiscussionsPlace({ overview, go, flash, filter = '' }) {
  const snap = useRegistrySnapshot(), rows = useSessionRows();
  const legacy = React.useSyncExternalStore(threadStore.subscribe, threadStore.get);
  const actions = React.useContext(AtlasActions);
  const [search,setSearch] = useState(''), [sort,setSort] = useState('activity'), [select,setSelect] = useState(false), [selected,setSelected] = useState([]);
  const [move,setMove] = useState(null), [menu,setMenu] = useState(null), [busy,setBusy] = useState(false), lock = useRef(false);
  const tree = useMemo(() => registryTopicTree(overview),[overview]);
  const list = registryVisibleList(snap.records,rows,snap.needs,filter,search,sort);
  const others = registryOtherRows(overview.root,rows,snap.records,legacy,search);
  const chosen = list.filter(r => selected.includes(r.id));
  const guarded = async fn => {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    try { await fn(); } catch (e) { flash(e.message); } finally { lock.current = false; setBusy(false); }
  };
  const runMany = (records,fn) => guarded(async () => {
    const failures = [];
    for (const r of records) { try { await fn(r); } catch (e) { failures.push(`${r.title}: ${e.message}`); } }
    setSelected([]); if (failures.length) flash(failures.join('; '));
  });
  const nav = (value,label,count,depth=0) => h('button', { key:value, type:'button', className:cx('atlas-disc-filter',filter===value && 'is-current'), 'aria-current':filter===value?'page':undefined,
    style:depth ? { paddingInlineStart:`calc(var(--s-8) + ${depth}em)` }:undefined, onClick:()=>{setSelected([]);go({view:'discussions',filter:value});} }, label, typeof count==='number' && h('span',{className:'atlas-count'},count));
  const countFor = value => registryVisibleList(snap.records,rows,snap.needs,value).length;
  const visibleTopics = snap.records.reduce((m,r)=>{ if (r.topic && r.status!=='resolved' && knownThread(rows,r)) m.set(r.topic.id,(m.get(r.topic.id)||0)+1); return m; },new Map());
  const titleOf = r => r.title || 'Untitled discussion';
  const btn = (label,text,fn) => h('button',{type:'button',className:'atlas-icon-button',title:label,'aria-label':label,disabled:busy,onClick:fn},text);
  const pin = r => guarded(()=>registryPatch(r.id,{pinned:!r.pinned}));
  const resolve = r => guarded(()=>atlasResolveDiscussion(r,r.status==='resolved'?'open':'resolved'));
  const reviewById = new Map((snap.needs.reviews||[]).map(r=>[r.session,r]));
  const searchBox = h(Input,{label:'Search discussions',placeholder:'Search discussions…',type:'search',value:search,onChange:e=>setSearch(e.target.value)});
  const filters = [['','All'],['running','Running'],['needs','Needs you'],['unread','Unread'],['pinned','Pinned'],['unfiled','Unfiled']];
  const waiting = (snap.needs.waiting || []).filter(w => !search || `${w.thread.name} ${w.topic.title}`.toLowerCase().includes(search.toLowerCase()));
  return h('div',{className:'atlas-discussions-place'},
    h('nav',{'aria-label':'Discussion filters',className:'atlas-disc-filters'},h('h2',null,'Discussions'),filters.map(([key,label])=>nav(key,label,countFor(key)+(key==='needs'?(snap.needs.waiting?.length||0):0))),
      h('details',null,h('summary',null,'By topic'),tree.map(x=>nav('topic:'+x.topic.id,x.topic.title,visibleTopics.get(x.topic.id)||0,x.depth))),
      nav('resolved','Resolved',countFor('resolved')),nav('other','Other DSH sessions',others.length)),
    h('section',{className:'atlas-disc-results'},h('h1',null,filter==='other'?'Other DSH sessions':'Discussions'),
      h('div',{className:'atlas-disc-tools'},searchBox,filter!=='other' && h(Select,{label:'Sort discussions',value:sort,onChange:e=>setSort(e.target.value),options:[{value:'activity',label:'Recent activity'},{value:'created',label:'Created'},{value:'title',label:'Title'}]}),
        filter!=='other' && h('button',{type:'button',className:'atlas-button is-small','aria-pressed':select,onClick:()=>{setSelect(!select);setSelected([]);}},select?'Done':'Select')),
      (snap.error||snap.migrationError||snap.needsError) && h(Banner,{tone:'error'},snap.error||snap.migrationError||snap.needsError,' ',h(TextButton,{onClick:snap.refresh},'Retry')),
      (!rows || rows.phase==='error') && h(Banner,null,'DSH session state is unavailable. Running state and other sessions cannot be verified.'),
      select && chosen.length>0 && filter!=='other' && h('div',{className:'atlas-disc-tools'},h('span',null,`${chosen.length} selected`),
        h(Button,{small:true,disabled:busy,onClick:e=>setMove({ids:chosen.map(r=>r.id),anchor:e.currentTarget})},'Move'),
        h(Button,{small:true,disabled:busy,onClick:()=>runMany(chosen,r=>registryPatch(r.id,{pinned:!chosen.every(t=>t.pinned)}))},chosen.every(t=>t.pinned)?'Unpin':'Pin'),
        h(Button,{small:true,disabled:busy,onClick:()=>runMany(chosen,r=>atlasResolveDiscussion(r,filter==='resolved'?'open':'resolved'))},filter==='resolved'?'Reopen':'Resolve')),
      filter==='needs' && waiting.map(w=>h('article',{key:w.topic.path+':'+w.thread.name,className:'atlas-disc-wait'},h('strong',null,w.thread.name),h('p',null,w.topic.title),
        h(Button,{small:true,onClick:()=>go({view:'doc',path:w.topic.path,anchor:'current-work'})},'Open note'), ' ',
        h(Button,{small:true,onClick:()=>actions.ask(focusContext({topic:w.topic},{section:'Current work › '+w.thread.name}),'ask',`Help me decide “${w.thread.name}” based on the options in my note.`,'Decide '+w.thread.name)},'Discuss'),
        h(DecideButtons,{topic:{...w.topic,file:w.topic.path},thread:w.thread}))),
      filter==='other' ? (others.length ? h('ul',{className:'atlas-disc-list'},others.map(({id,row}) => h('li',{key:id,className:'atlas-disc-row'},h('span',null,row.displayTitle||row.title||id),h(Button,{small:true,disabled:busy,onClick:()=>guarded(async()=>{await registryCreate(registryAdoption(id,row));flash('Discussion adopted.');})},'Adopt')))) : h(EmptyState,null,'No other root sessions in this workspace.')) :
      h('ul',{className:'atlas-disc-list'},list.map(r=>{
        const title=titleOf(r), running=Boolean(rowOf(rows,r.id)?.running), unread=registryUnread(r), review=reviewById.get(r.id);
        return h('li',{key:r.id,className:'atlas-disc-row'},select && h(Checkbox,{label:'', 'aria-label':'Select '+title,checked:selected.includes(r.id),onChange:e=>setSelected(ids=>e.target.checked?[...new Set([...ids,r.id])]:ids.filter(id=>id!==r.id))}),
          h('button',{type:'button',className:'atlas-disc-open',onClick:()=>actions.openThread(r.id)},h('span',{className:'atlas-disc-top'},
            h('span',{className:cx('atlas-light',running && 'is-running'),title:running?'Working':'Idle','aria-label':running?'Working':'Idle'}),h('span',{className:unread?'atlas-disc-unread':undefined},title),unread && h('small',null,'Unread'),h('time',null,ago(r.updated || r.created))),
            h('span',{className:'atlas-disc-sub'},[r.topic?.title||'Unfiled',r.model?.model,r.question?.slice(0,90),review?`${review.edits} changes to review`:null].filter(Boolean).join(' · '))),
          h('div',{className:'atlas-disc-row-actions'},btn((r.pinned?'Unpin ':'Pin ')+title,r.pinned?'★':'☆',()=>pin(r)),btn('Move '+title,'↔',e=>setMove({ids:[r.id],anchor:e.currentTarget})),btn((r.status==='resolved'?'Reopen ':'Resolve ')+title,r.status==='resolved'?'↺':'✓',()=>resolve(r)),btn('More actions for '+title,'⋯',e=>setMenu({record:r,anchor:e.currentTarget}))));
      })),
      !snap.loading && !snap.error && filter!=='other' && !list.length && !(filter==='needs' && waiting.length) && h(EmptyState,null,filter||search?'Nothing here.':'No discussions yet. Ask from the Desk, or select a passage and press Ctrl+J.'),
      snap.loading && h(Skeleton,{label:'Loading discussions…'})),
    move && h(MoveDiscussion,{...move,overview,onClose:()=>setMove(null),flash}),
    menu && h(Menu,{label:'Discussion actions',anchor:menu.anchor,onClose:()=>setMenu(null),items:[
      {id:'open',label:'Open discussion',onSelect:()=>actions.openThread(menu.record.id)},
      {id:'move',label:'Move to a topic…',onSelect:()=>setMove({ids:[menu.record.id],anchor:menu.anchor})},
      {id:'pin',label:menu.record.pinned?'Unpin':'Pin',onSelect:()=>pin(menu.record)},
      {id:'resolve',label:menu.record.status==='resolved'?'Reopen':'Resolve',onSelect:()=>resolve(menu.record)},
      {id:'copy',label:'Copy session id',onSelect:()=>guarded(async()=>{await navigator.clipboard.writeText(menu.record.id);flash('Session id copied.');})},
    ]}));
}

const registryViewStyles = `
.atlas-discussions-place {display:grid;grid-template-columns:minmax(140px,220px) minmax(0,1fr);min-height:100%;color:var(--text-1)}
.atlas-disc-filters {background:var(--surface);border-inline-end:1px solid var(--border);padding:var(--s-16) var(--s-8)}
.atlas-disc-filters h2,.atlas-disc-results h1 {margin:0 0 var(--s-16)} .atlas-disc-filters summary {padding:var(--s-8);cursor:pointer}
.atlas-disc-filter,.atlas-disc-open {border:0;background:none;text-align:start;color:inherit;cursor:pointer;font:inherit}
.atlas-disc-filter {display:flex;width:100%;align-items:center;justify-content:space-between;padding:var(--s-8);border-radius:var(--r-sm)}
.atlas-disc-filter:hover,.atlas-disc-filter:focus-visible,.atlas-disc-row:hover {background:var(--hover)} .atlas-disc-filter.is-current {background:var(--selected);color:var(--accent)}
.atlas-disc-results {min-width:0;padding:var(--s-24)} .atlas-disc-tools,.atlas-disc-row-actions,.atlas-disc-topic-option {display:flex;align-items:center;gap:var(--s-8)}
.atlas-disc-tools {flex-wrap:wrap;margin-bottom:var(--s-12)} .atlas-disc-tools input {flex:1 1 12em}
.atlas-disc-list {padding:0;margin:0;list-style:none} .atlas-disc-row {display:flex;min-height:var(--row-58);align-items:center;gap:var(--s-8);border-bottom:1px solid var(--border)}
.atlas-disc-open {flex:1;min-width:0;padding:var(--s-4) var(--s-8)} .atlas-disc-top {display:flex;align-items:center;gap:var(--s-8)}
.atlas-disc-open .atlas-disc-top>span:nth-child(2),.atlas-disc-sub {overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.atlas-disc-top time {margin-inline-start:auto;font-style:italic;white-space:nowrap;color:var(--text-3)} .atlas-disc-unread {font-weight:600} .atlas-disc-top small {color:var(--accent)}
.atlas-disc-sub {display:block;color:var(--text-3);font-size:var(--fs-meta)} .atlas-disc-row{position:relative}.atlas-disc-row-actions {position:absolute;inset-inline-end:0;gap:0;opacity:0;pointer-events:none;background:var(--surface)}.atlas-disc-row:hover .atlas-disc-row-actions,.atlas-disc-row:focus-within .atlas-disc-row-actions {opacity:1;pointer-events:auto}
.atlas-disc-wait {margin-block:var(--s-12);border-inline-start:2px solid var(--gold);padding:var(--s-8)} .atlas-disc-move {width:min(360px,100%);display:grid;gap:var(--s-8)} .atlas-disc-move [role=radiogroup] {max-height:36vh;overflow:auto}.atlas-disc-topic-option {padding-block:var(--s-4);cursor:pointer}
@media(hover:none){.atlas-disc-row-actions{position:static;opacity:1;pointer-events:auto}}
@container (max-width:640px){.atlas-discussions-place{display:block}.atlas-disc-filters{border:0;display:flex;align-items:center;gap:var(--s-4);overflow:auto}.atlas-disc-filters h2{display:none}.atlas-disc-filter{width:auto;white-space:nowrap}.atlas-disc-results{padding:var(--s-12)}.atlas-disc-row-actions button:not(:last-child){display:none}}
`;
