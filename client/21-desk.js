// Topic choice is tri-state: null = Auto (default), '' = explicitly unfiled,
// otherwise the topic's ID. Never persist a guess as if the researcher pinned it.
function deskDraft(root) {
  const saved = storageGet('prefs.v1', {})?.deskDraft;
  return saved && saved.root === root ? { question: typeof saved.question === 'string' ? saved.question : '', topicId: saved.topicId || (saved.mode === 'none' ? '' : null), attachments: Array.isArray(saved.attachments) ? saved.attachments.filter((a) => typeof a?.path === 'string' && typeof a?.label === 'string') : [] } : { question: '', topicId: null, attachments: [] };
}

function deskRouteKey(question, choice) {
  const q = String(question || '').trim();
  return choice === null && [...q].length >= 12 ? q : '';
}

// The visible question and selected mode own each request. Aborting saves work;
// the identity check is what guarantees that a late result cannot re-file a draft.
function createDeskRouting(load, publish, delay = 250) {
  let current = null;
  const clear = () => {
    const old = current; current = null;
    if (old) { clearTimeout(old.timer); old.controller?.abort(); }
  };
  const run = (item) => {
    clearTimeout(item.timer);
    if (!item.promise) {
      item.controller = new AbortController();
      const timeout = setTimeout(() => item.controller.abort(), 4000);
      item.promise = Promise.resolve().then(() => load(item.key, item.controller.signal)).then((data) => ({ key: item.key, candidates: data.candidates.slice(0, 5), confident: data.confident === true }),
        () => ({ key: item.key, candidates: [], confident: false, unavailable: true })).finally(() => clearTimeout(timeout)).then((result) => {
        if (item !== current) return null;
        publish(result); return result;
      });
    }
    return item.promise;
  };
  const select = (key) => {
    if (current?.key === key) return current;
    clear();
    if (!key) return null;
    const next = { key }; current = next; next.timer = setTimeout(() => run(next), delay); return next;
  };
  return { select, clear, flush(key) { const item = select(key); return item ? run(item) : Promise.resolve(null); } };
}

async function lookupDeskRoute(q, signal) {
  const response = await fetch(`${API}/route?${new URLSearchParams({ q })}`, { credentials: 'same-origin', signal });
  if (!response.ok) throw new Error('Topic suggestions are unavailable.');
  const result = await response.json();
  if (!Array.isArray(result?.candidates)) throw new Error('Topic suggestions are unavailable.');
  return result;
}

function deskFiling(ov, choice, result) {
  const candidates = choice === null ? (result?.candidates || []).filter((c) => c?.topic?.id && ov?.topics?.[c.topic.id]) : [];
  const selected = choice || (choice === null && result?.confident && result.candidates?.[0]?.topic?.id === candidates[0]?.topic?.id ? candidates[0]?.topic.id : null);
  const topicId = selected && ov?.topics?.[selected] ? selected : null;
  return { topicId, filing: topicId ? (choice === null ? 'auto' : 'user') : 'none', candidates };
}

function deskAlmanacData(ov, index, rows, needs = null, teams = []) {
  const items = [];
  for (const t of index) {
    const row = rowOf(rows, t.id);
    if (t.status === 'resolved' || row?.archived || !knownThread(rows, t)) continue;
    items.push({ id: t.id, title: t.kind === 'team' ? threadLabel(t) : (t.title || t.question || t.label || 'Discussion'), at: t.updated || t.created || 0, running: !!row?.running, team: t.kind === 'team' || t.origin === 'team' });
  }
  items.sort((a, b) => b.at - a.at || a.id.localeCompare(b.id));
  const waiting = (needs?.waiting || waitingItems(ov)).map((w) => ({ ...w, kind: 'waiting', title: w.thread.name }));
  for (const r of needs?.reviews || []) {
    const rec = index.find((t) => t.id === r.session);
    if (rec && knownThread(rows, rec)) waiting.push({ kind: 'review', id: rec.id, title: `${plural(r.edits, 'edit')} · ${rec.title}` });
  }
  const running = items.filter((t) => t.running);
  const seen = new Set(running.map((t) => t.id));
  for (const team of items.filter((t) => t.team)) {
    const tasks = teamOf(rowOf(rows, team.id))?.tasks;
    if (tasks?.length) team.progress = `${tasks.filter((t) => t.status === 'completed').length} of ${tasks.length}`;
    for (const m of membersOf(rows, team.id)) if (m.row?.running && !seen.has(m.id)) {
      running.push({ id: m.id, title: `${team.title} · ${m.role || m.name || m.row.displayTitle || m.row.title || 'Member'}`, running: true, progress: 'working' }); seen.add(m.id);
    }
  }
  for (const team of teams) {
    const v=teamIndexSummary(team,rows,needs);
    if (v.isDone) continue;
    const item={id:team.id,title:team.name,at:v.at,running:v.working,team:true,openTeam:true,progress:v.total===null?'working':`${v.done} of ${v.total}`};
    items.push(item);
    if (v.working) running.push(item);
    for (const m of v.members) if (m.row?.running && !seen.has(m.id)) {
      running.push({id:m.id,teamId:team.id,legacy:!!team.legacy,title:`${m.name || m.row.displayTitle || 'Member'} · ${team.name}`,running:true,progress:'working'}); seen.add(m.id);
    }
  }
  for (const d of needs?.decisions || []) if (d.teamId && d.id) waiting.push({kind:'decision',teamId:d.teamId,id:d.id,title:d.question || d.id,teamName:d.teamName});
  items.sort((a,b)=>b.at-a.at || a.id.localeCompare(b.id));
  return { items, waiting, running };
}

function DeskAlmanac({ ov, go, onOpenThread, registry }) {
  const rows = useSessionRows(), teams=useTeamIndexSnapshot(ov.root), actions = React.useContext(AtlasActions);
  const { items, waiting, running } = useMemo(() => {
    const sameRoot = registry.root === ov.root, records = sameRoot ? registry.records || [] : [];
    const leadIds=new Set(teams.records.map(t=>t.leadId));
    return deskAlmanacData(ov, records.filter(r=>!leadIds.has(r.id)), rows, sameRoot && !registry.needsError && !registry.loading ? registry.needs : null,teams.records);
  }, [ov, teams.records, registry.root, registry.records, registry.needs, registry.needsError, registry.loading, rows]);
  const row = (t, active) => h('button', { type: 'button', className: 'atlas-almanac-row', key: t.id, title: `${t.running ? 'Working' : 'Open'} · ${t.title}${t.at ? ` · Last active ${dateOf(t.at)}` : ''}`, onClick: () => t.openTeam ? actions.openTeam(t.id) : t.teamId ? (t.legacy ? actions.openTeam(t.teamId) : actions.openThread(t.id,{kind:'member',teamId:t.teamId})) : onOpenThread(t.id) },
    h('span', { className: cx('atlas-almanac-mark', t.running && 'is-working'), 'aria-label': t.running ? 'Working' : 'Open' }), h('span', { className: 'atlas-almanac-title' }, t.team ? 'Team · ' : '', t.title), h('i', { className: 'atlas-almanac-leader', 'aria-hidden': true }), h('em', null, active ? (t.progress || (t.team ? 'working' : 'replying')) : ago(t.at)));
  const decide = ({ topic, thread }) => actions.ask(focusContext({ topic: { id: topic.id, title: topic.title, path: topic.path || topic.file } }, { section: 'Current work › ' + thread.name }), 'ask', `Help me decide “${thread.name}”: lay out the options my note records, what each would settle, and what you recommend.`, `Decide ${thread.name}`);
  const group = (name, n, link, filter, children, empty) => h('section', { className: 'atlas-almanac-group', 'aria-label': name },
    h('header', null, h('h2', null, name), n ? h('em', null, n) : null, h(TextButton, { onClick: () => go({ view: 'discussions', filter }), title: filter ? `All · ${name}` : 'All discussions' }, link)),
    children.length ? children : h('p', { className: 'atlas-almanac-empty' }, empty));
  return h(React.Fragment, null, !!registry.needs?.teamErrors?.length && h('p',{className:'atlas-desk-message',role:'status'},'Some team decisions could not be read. Showing verified requests only. ',h(TextButton,{onClick:registry.refresh},'Retry')), registry.error || registry.needsError ? h('p', { className: 'atlas-desk-message', role: 'status' }, registry.error ? 'Discussion records are unavailable. ' : '', registry.needsError ? 'Review requests could not be read. ' : '', h(TextButton, { onClick: registry.refresh }, 'Retry')) : null, h('div', { className: 'atlas-desk-almanac' },
    group('Continue', 0, 'All discussions', '', items.slice(0, 5).map((t) => row(t, false)), registry.loading ? 'Reading discussions…' : registry.error ? 'Discussion records could not be read.' : 'Your open discussions will appear here.'),
    group('Needs you', registry.needsError || registry.needs?.teamErrors?.length ? 0 : waiting.length, 'All', 'needs', waiting.slice(0, 5).map((w, i) => w.kind === 'decision' ? h('div',{className:'atlas-almanac-row',key:'decision:'+w.teamId+':'+w.id},h('span',{className:'atlas-almanac-mark is-waiting','aria-label':'Team decision'}),h('span',{className:'atlas-almanac-title',title:w.teamName},w.title),h('i',{className:'atlas-almanac-leader','aria-hidden':true}),h(Button,{small:true,onClick:()=>actions.openTeam(w.teamId,{decisionId:w.id})},'Answer')) : w.kind === 'review' ? h('div', { className: 'atlas-almanac-row', key: 'review:' + w.id }, h('span', { className: 'atlas-almanac-mark is-waiting', 'aria-label': 'Unreviewed edits' }), h('span', { className: 'atlas-almanac-title', title: w.title }, w.title), h('i', { className: 'atlas-almanac-leader', 'aria-hidden': true }), h(Button, { small: true, onClick: () => onOpenThread(w.id) }, 'Review')) : h('div', { className: 'atlas-almanac-row', key: w.topic.id + ':' + i },
      h('span', { className: 'atlas-almanac-mark is-waiting', 'aria-label': 'Waiting' }), h('button', { type: 'button', 'data-atlas-open': true, className: 'atlas-almanac-title', title: `${w.topic.title} · ${w.thread.name}`, onClick: (e) => go({ view: 'doc', path: w.topic.path || w.topic.file, anchor: 'current-work' }, e) }, w.thread.name),
      h('i', { className: 'atlas-almanac-leader', 'aria-hidden': true }), h(Button, { small: true, onClick: () => decide(w), title: 'Discuss this decision' }, 'Decide'))), 'Nothing in your notes waits on a decision.'),
    group('Running', running.length, 'All', 'running', running.slice(0, 5).map((t) => row(t, true)), rows?.phase === 'ready' ? 'Nothing is in motion.' : 'Live session state is unavailable.')));
}

function DeskTopics({ ov, anchor, selected, onChoose, onClose }) {
  const [find, setFind] = useState('');
  const groups = useMemo(() => atlasStarCatalogue(ov), [ov]);
  const term = find.trim().toLowerCase();
  const choice = (id, text, color, depth) => h('button', { type: 'button', key: 'choice:' + id, className: 'atlas-desk-choice', style: { paddingInlineStart: `calc(var(--s-8) + ${Math.min(depth, 5)} * var(--s-16))` }, 'aria-pressed': selected === id, onClick: () => onChoose(id) },
    color ? h('span', { className: 'atlas-dot', style: { background: color } }) : null, text, selected === id ? ' ✓' : '');
  return h(Popover, { anchor, label: 'Choose discussion topic', onClose, className: 'atlas-desk-picker' },
    h(Input, { label: 'Find a topic', type: 'search', value: find, onChange: (e) => setFind(e.target.value), placeholder: 'Find a topic…' }),
    choice(null, 'Auto', null, 0), choice('', 'No topic', null, 0), groups.map((s) => {
      const hits = s.members.filter(({ t }) => `${s.title} ${t.title} ${t.id}`.toLowerCase().includes(term));
      return hits.length ? h('section', { key: String(s.key) }, h('h3', null, s.title), hits.map(({ id, t, depth }) => choice(id, t.title, s.color, depth))) : null;
    }));
}

function deskAttachment(raw, mode) {
  const value = String(raw || '').trim();
  if (!value || /[\r\n\u0000]/.test(value)) return null;
  if (mode === 'file') return /^(?:[a-z]:[\\/]|\/|\\\\)/i.test(value) ? { label: baseName(value) || value, path: value } : null;
  let url = value;
  if (!/^https?:\/\//i.test(value)) {
    const id = value.replace(/^arxiv\s*:\s*/i, '');
    if (/^10\.\d{4,9}\/\S+$/i.test(id)) url = 'https://doi.org/' + id;
    else url = 'https://arxiv.org/abs/' + id;
  }
  const paper = paperLink(url);
  if (paper) return { label: paper.label, path: url };
  // Other publishers' canonical URLs are pointers too; no lookup or download.
  if (/^https?:\/\//i.test(value)) { try { const u = new URL(value); if (!u.username && !u.password) return { label: u.hostname + u.pathname, path: u.href }; } catch {} }
  return null;
}

function DeskAttach({ anchor, ov, beside, onAttach, onClose }) {
  const [mode, setMode] = useState('file'), [raw, setRaw] = useState(''), [error, setError] = useState('');
  const list = React.useId();
  const add = () => {
    const pick = deskAttachment(raw, mode);
    if (!pick) { setError(mode === 'file' ? 'Choose a note or enter an absolute file path on the DSH machine.' : 'Enter a paper URL, DOI or arXiv ID.'); return; }
    onAttach(pick);
  };
  return h(Popover, { anchor, label: 'Attach a reference', onClose, className: 'atlas-desk-attach' },
    h(Segmented, { label: 'Reference type', options: [{ value: 'file', label: 'File' }, { value: 'paper', label: 'Paper' }], value: mode, onChange: (v) => { setMode(v); setRaw(''); setError(''); } }),
    h('p', null, mode === 'file' ? 'Choose a topic note or enter a file path on the DSH machine. Only the path is shared.' : 'Share the paper link, DOI or arXiv ID without copying the paper.'),
    h(Input, { label: mode === 'file' ? 'Absolute file path' : 'Paper URL, DOI or arXiv ID', value: raw, list: mode === 'file' ? list : undefined, onChange: (e) => { setRaw(e.target.value); setError(''); }, onKeyDown: (e) => { if (e.key === 'Enter' && !e.nativeEvent?.isComposing) { e.preventDefault(); add(); } } }),
    h('datalist', { id: list }, Object.values(ov.topics).map((t) => h('option', { key: t.id, value: t.file, label: t.title }))),
    error ? h('p', { role: 'alert' }, error) : null,
    h('div', { className: 'atlas-cart-actions' }, h(Button, { small: true, disabled: !raw.trim(), onClick: add }, 'Attach'), beside ? h(Button, { quiet: true, small: true, onClick: () => onAttach({ label: beside.title, path: beside.path }) }, 'Include open beside') : null));
}

function DeskView(props) {
  // Switching roots must not send the last root's draft or attachments.
  return h(DeskWorkspace, { key: props.overview?.root || 'setup', ...props });
}

function DeskWorkspace({ overview: ov, go, focusRequest, setup, onRetry, onStartDiscussion, onOpenThread }) {
  const [draft, setDraft] = useState(() => deskDraft(ov?.root));
  const actions=React.useContext(AtlasActions), [mode,setMode]=useState('discuss');
  const teamMode=mode==='team';
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [popup, setPopup] = useState(null);
  const input = useRef(null), topicButton = useRef(null), attachButton = useRef(null), latch = useRef(false);
  const otherPane = useFocus().beside, registry = useRegistrySnapshot();
  const [model, setModel] = useState(() => storageGet('prefs.v1', {})?.model || null);
  const [route, setRoute] = useState(null);
  const router = useMemo(() => createDeskRouting(lookupDeskRoute, setRoute), []);
  const key = ov ? deskRouteKey(draft.question, draft.topicId) : '';
  useEffect(() => { router.select(key); return () => router.clear(); }, [router, key]);
  const result = key && route?.key === key ? route : null;
  const selection = deskFiling(ov, draft.topicId, result);
  const topic = selection.topicId ? ov?.topics[selection.topicId] : null;
  const topicLabel = draft.topicId === null ? 'Auto' : topic?.title || 'No topic';
  const sessions = svc('sessions');
  const disabledReason = setup || !ov ? 'Set up a research workspace before starting work.' : teamMode ? (!actions.assembleTeam?'Team setup is unavailable.':'') : !onStartDiscussion || typeof sessions?.create !== 'function' || typeof sessions?.retain !== 'function' ? 'This DSH cannot start discussions inside Atlas.' : '';
  const disabled = !!disabledReason || busy;
  const waiting = useMemo(() => registry.root === ov?.root && !registry.loading && !registry.needsError && !registry.needs?.teamErrors?.length ? ((registry.needs?.waiting?.length || 0) + (registry.needs?.reviews?.length || 0) + (registry.needs?.decisions?.length || 0)) : (ov ? waitingItems(ov).length : 0), [ov, registry.root, registry.loading, registry.needsError, registry.needs]);
  const patch = (change) => { setDraft((prev) => ({ ...prev, ...change })); setError(''); };
  usePublishFocus({ kind: 'universe', topic: ov ? { id: '', title: ov.title, path: ov.rootFile } : null }, [ov?.rootFile, ov?.title]);
  useEffect(() => { if (focusRequest && !disabledReason) input.current?.focus(); }, [focusRequest, disabledReason]);
  useEffect(() => {
    if (ov?.root) storageSet('prefs.v1', { ...storageGet('prefs.v1', {}), deskDraft: { root: ov.root, ...draft, mode: draft.topicId === '' ? 'none' : undefined } });
  }, [draft, ov?.root]);
  useLayoutEffect(() => {
    const el = input.current; if (!el) return;
    const fit = () => { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; };
    fit();
    const parent = el.parentElement;
    let width = parent.clientWidth;
    const ro = typeof ResizeObserver !== 'undefined' && new ResizeObserver(() => { if (parent.clientWidth !== width) { width = parent.clientWidth; fit(); } });
    if (ro) ro.observe(parent); return () => { if (ro) ro.disconnect(); };
  }, [draft.question]);
  const send = async () => {
    if (latch.current || disabled || !draft.question.trim()) return;
    latch.current = true; setPopup(null); setBusy(true); setError('');
    try {
      const latest = key ? await router.flush(key) : null;
      if (key && !latest) return; // This draft/root was replaced before lookup finished.
      const filing=deskFiling(ov,draft.topicId,latest);
      if(teamMode){ actions.assembleTeam({goal:draft.question.trim(),topicId:filing.topicId,leadModel:model,attachments:draft.attachments}); return; }
      await onStartDiscussion({ question: draft.question.trim(), ...filing, model, attachments: draft.attachments });
      setDraft({ topicId: null, question: '', attachments: [] });
    } catch (cause) { setError(cause?.message || 'The discussion could not start.'); }
    finally { latch.current = false; setBusy(false); }
  };
  const choose = (id) => { if (latch.current) return; router.clear(); setRoute(null); patch({ topicId: id }); setPopup(null); requestAnimationFrame(() => input.current?.focus()); };
  const attach = (a) => { patch({ attachments: [...draft.attachments.filter((x) => x.path !== a.path), a] }); setPopup(null); requestAnimationFrame(() => input.current?.focus()); };
  const starter = (s) => { patch({ question: s }); input.current?.focus(); };
  return h('div', { className: 'atlas-desk' },
    ov ? h(DeskSky, { ov, go, hasDraft: !!draft.question.trim(), routedId: topic?.id, candidates: selection.candidates.slice(0, 3), onDiscuss: (s) => choose(s.id) }) : h('header', { className: 'atlas-desk-welcome' }, h('h1', null, 'Your research desk')),
    h('section', { className: 'atlas-desk-composer', 'aria-label': 'Start a discussion', 'aria-busy': busy },
      h('textarea', { rows: 3, 'aria-label': 'Discussion question', placeholder: 'Ask, think out loud, or start a line of work…', ref: input, disabled, value: draft.question, onChange: (e) => patch({ question: e.target.value }), onKeyDown: (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent?.isComposing && e.keyCode !== 229) { e.preventDefault(); send(); } } }),
      draft.attachments.length ? h('ul', { className: 'atlas-desk-attachments', 'aria-label': 'Attached references' }, draft.attachments.map((a) => h('li', { key: a.path }, h('span', { title: a.path }, a.label), h(IconButton, { small: true, label: 'Remove ' + a.label, icon: 'close', disabled, onClick: () => patch({ attachments: draft.attachments.filter((x) => x.path !== a.path) }) })))) : null,
      h('div', { className: 'atlas-desk-controls' }, h(IconButton, { label: 'Attach a reference', icon: 'plus', buttonRef: attachButton, disabled, 'aria-expanded': popup === 'attach', onClick: () => setPopup(popup === 'attach' ? null : 'attach') }),
        h('button', { type: 'button', className: 'atlas-desk-topic', ref: topicButton, disabled, 'aria-label': `Choose topic: ${topicLabel}`, 'aria-expanded': popup === 'topic', onClick: () => setPopup(popup === 'topic' ? null : 'topic') }, topic ? h('i', { className: 'atlas-dot', style: { background: directionColor(ov, topicDirection(ov, topic.id)) } }) : null, h('span', null, topicLabel), h('span', { 'aria-hidden': true }, '⌄')),
        h(AtlasModelPicker, { value: model, disabled, onChange: (next) => { setModel(next); storageSet('prefs.v1', { ...storageGet('prefs.v1', {}), model: next }); } }),
        h(Segmented,{label:'Composer mode',value:mode,options:[{value:'discuss',label:'Discuss',disabled:busy},{value:'team',label:'Team',disabled:busy}],onChange:setMode}),
        h('span', { className: 'atlas-desk-hint' }, 'Shift+Enter for a new line'),
        teamMode ? h(Button,{small:true,primary:true,disabled:disabled || !draft.question.trim(),onClick:send},'Set up team…') : h(IconButton, { className: 'atlas-desk-send', label: busy ? 'Starting discussion…' : 'Send discussion', disabled: disabled || !draft.question.trim(), onClick: send }, busy ? '…' : '↑')),
      popup === 'topic' && ov ? h(DeskTopics, { anchor: topicButton, ov, selected: draft.topicId, onChoose: choose, onClose: () => setPopup(null) }) : null,
      popup === 'attach' && ov ? h(DeskAttach, { anchor: attachButton, ov, beside: otherPane, onAttach: attach, onClose: () => setPopup(null) }) : null),
    disabledReason ? h('p', { className: 'atlas-desk-message', role: 'status' }, disabledReason) : null,
    error ? h('div', { className: 'atlas-desk-message', role: 'alert' }, error, ' ', h(Button, { small: true, onClick: send, disabled }, 'Retry')) : null,
    result ? h('div', { className: 'atlas-desk-routing', role: 'group', 'aria-label': 'Likely topic', 'aria-live': 'polite' }, selection.candidates.length ? h(React.Fragment, null, h('span', { className: 'atlas-desk-route-label' }, 'Likely topic'), selection.candidates.slice(0, 3).map(({ topic: pick, reasons }) => h(Chip, { key: pick.id, variant: 'suggestion', dot: directionColor(ov, pick.direction), auto: selection.topicId === pick.id, selected: selection.topicId === pick.id, disabled, title: `${pick.title} · Matched: ${reasons.join(', ')}`, onClick: () => choose(pick.id) }, shortTitle(pick.title, 38)))) : h('span', null, result.unavailable ? 'Topic suggestions unavailable · will start unfiled.' : 'No matching topic · will start unfiled.')) : null,
    !disabled && !draft.question.trim() ? h('div', { className: 'atlas-desk-starters', 'aria-label': 'Discussion starters' }, ['What should I work on next?', 'Continue the research', 'Develop a new idea', ...(waiting ? [`Review what is waiting (${waiting})`] : [])].map((s) => h(Chip, { key: s, variant: 'suggestion', onClick: () => starter(s) }, s))) : null,
    setup ? h(WorkspaceSetup, { setup, onRetry }) : ov ? h(DeskAlmanac, { ov, go, onOpenThread, registry }) : null);
}

const ATLAS_DESK_CSS = `
.atlas-teams-heading { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:var(--s-16); margin-bottom:var(--s-24); }
.atlas-team-index { list-style:none; padding:0; margin:var(--s-24) 0; }
.atlas-team-index-row { width:100%; display:flex; flex-wrap:wrap; align-items:center; gap:var(--s-12); text-align:left; color:var(--text-2); font:var(--t-meta); padding:var(--s-12) var(--s-8); border:0; border-top:1px solid var(--border); background:none; cursor:pointer; }
.atlas-team-index-row:hover { background:var(--hover); }
.atlas-team-index-name { flex:1 1 11ch; color:var(--text-1); font:var(--t-body); overflow-wrap:anywhere; }
.atlas-team-index-topic,.atlas-team-index-chip { font:var(--t-meta); padding:var(--s-4) var(--s-8); border:1px solid var(--border); border-radius:var(--r-full); }
.atlas-team-index-chip.is-waiting { color:var(--gold); } .atlas-team-index-chip.is-working { color:var(--accent); }
.atlas-team-index-row em { color:var(--text-3); }
@container (max-width:820px) { .atlas-desk-controls {flex-wrap:wrap;} .atlas-desk-hint {display:none;} }

.atlas-desk { box-sizing:border-box; max-width:1120px; margin:0 auto; padding:0 var(--s-32) var(--s-56); background:var(--surface); }
.atlas-desk-sky { position:relative; margin:0 calc(-1 * var(--s-32)); }
.atlas-desk-sky > svg { position:absolute; bottom:0; width:100%; }
.atlas-desk-sky.is-stacked > svg { bottom:34px; }
.atlas-desk-sky.is-narrow .atlas-cart-label:not(.is-revealed) { visibility:hidden; }
.atlas-desk-greeting { position:absolute; width:min(320px,100%); left:50%; transform:translate(-50%,-50%); text-align:center; pointer-events:none; }
.atlas-desk-greeting p { font:var(--t-cap); font-variant-caps:all-small-caps; letter-spacing:.09em; color:var(--text-3); margin:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.atlas-desk-greeting h1,.atlas-desk-welcome h1 { font:var(--t-display); letter-spacing:-.01em; color:var(--text-1); margin:var(--s-4) 0 0; }
.atlas-desk-sky.is-stacked .atlas-desk-greeting { top:var(--s-8); transform:translateX(-50%); }
.atlas-desk-welcome { text-align:center; padding:var(--s-48) 0 var(--s-72); }
.atlas-desk-composer { position:relative; max-width:720px; margin:-34px auto 0; padding:14px var(--s-16) 10px; border:1px solid var(--border-strong); border-radius:var(--r-lg); background:var(--raised); box-shadow:var(--shadow-2); box-sizing:border-box; }
.atlas-desk-composer:focus-within { border-color:var(--accent); box-shadow:0 0 0 var(--s-4) var(--accent-soft),var(--shadow-2); }
.atlas-desk-composer textarea { display:block; width:100%; min-height:69px; max-height:276px; margin:0; padding:0; border:none; background:none; resize:none; color:var(--text-1); font:15px/23px var(--font-ui); }
.atlas-desk-composer textarea:focus { outline:none; } .atlas-desk-composer textarea::placeholder { color:var(--text-3); }
.atlas-desk-controls { display:flex; align-items:center; min-height:var(--control-32); gap:6px; margin-top:10px; }
.atlas-desk-topic { display:flex; align-items:center; gap:6px; min-width:0; max-width:50%; height:var(--control-28); padding:0 var(--s-8); border:0; border-radius:var(--r-full); background:none; color:var(--text-2); font:var(--t-ui); cursor:pointer; }
.atlas-desk-topic > span:first-of-type { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.atlas-desk-topic:hover,.atlas-desk-choice:hover { background:var(--hover); }
.atlas-desk-hint { margin-left:auto; font:var(--t-meta); color:var(--text-3); }
.atlas-desk-controls .atlas-desk-send { width:var(--control-32); height:var(--control-32); flex:none; border-radius:var(--r-full); color:var(--text-on-accent); background:var(--accent); box-shadow:0 0 0 var(--s-4) var(--accent-soft); }
.atlas-desk-controls .atlas-desk-send:not(:disabled):hover { background:var(--accent-hover); }
.atlas-desk-controls .atlas-desk-send:disabled { opacity:.4; }
.atlas-desk-routing { display:flex; flex-wrap:wrap; align-items:center; justify-content:center; gap:var(--s-8); font:var(--t-meta); color:var(--text-3); } .atlas-desk-route-label { font:var(--t-cap); font-variant-caps:all-small-caps; letter-spacing:var(--cap-tracking); }
.atlas-desk-message,.atlas-desk-starters,.atlas-desk-routing { max-width:720px; margin:14px auto 0; }
.atlas-desk-message { color:var(--text-2); font:var(--t-meta); } .atlas-desk-message[role=alert] { color:var(--danger-text); }
.atlas-desk-starters,.atlas-desk-attachments { display:flex; align-items:center; flex-wrap:wrap; gap:var(--s-8); }
.atlas-desk-starters { justify-content:center; } .atlas-desk-attachments { padding:0; margin:var(--s-8) 0; list-style:none; }
.atlas-desk-attachments li { display:flex; gap:var(--s-4); align-items:center; padding-left:var(--s-8); max-width:100%; border:1px solid var(--border); border-radius:var(--r-full); font:var(--t-meta); }
.atlas-desk-attachments li > span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.atlas-desk-picker,.atlas-desk-attach { width:320px; padding:var(--s-12); overflow:auto; }
.atlas-desk-picker input,.atlas-desk-attach input { width:100%; }
.atlas-desk-picker section h3 { margin:var(--s-8) 0 var(--s-4); font:var(--t-cap); font-variant-caps:all-small-caps; color:var(--text-3); }
.atlas-desk-choice { width:100%; display:flex; gap:var(--s-8); align-items:center; text-align:start; min-height:var(--control-32); border:0; background:transparent; color:var(--text-2); font:var(--t-ui); cursor:pointer; }
.atlas-desk-choice[aria-pressed=true] { color:var(--accent); background:var(--selected); }
.atlas-desk-attach p { font:var(--t-meta); color:var(--text-2); } .atlas-desk-attach .atlas-cart-actions { margin-top:var(--s-8); }
.atlas-desk-almanac { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); margin-top:var(--s-48); border-top:1px solid var(--border); }
.atlas-almanac-group { padding:18px var(--s-24) 0; min-width:0; }
.atlas-almanac-group + .atlas-almanac-group { border-left:1px solid var(--border); }
.atlas-almanac-group header { display:flex; gap:var(--s-8); align-items:baseline; margin-bottom:var(--s-8); }
.atlas-almanac-group h2 { margin:0; font:600 15px/20px var(--font-serif); font-variant-caps:all-small-caps; letter-spacing:.1em; color:var(--text-1); }
.atlas-almanac-group:nth-child(2) h2 { color:var(--gold); }
.atlas-almanac-group em,.atlas-almanac-empty { font:var(--t-count); color:var(--text-3); white-space:nowrap; }
.atlas-almanac-empty { white-space:normal; margin:10px 0; }
.atlas-almanac-group header .atlas-link { margin-left:auto; font:var(--t-meta); }
.atlas-almanac-row { width:100%; display:flex; align-items:center; gap:10px; height:var(--row-40); padding:0; text-align:left; color:var(--text-1); background:none; border:none; }
button.atlas-almanac-row { cursor:pointer; } button.atlas-almanac-row:hover { background:var(--hover); }
.atlas-almanac-title { font:var(--t-body); color:var(--text-1); min-width:0; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
button.atlas-almanac-title { text-align:start; border:0; background:none; padding:0; cursor:pointer; }
.atlas-almanac-row > .atlas-button { flex:none; }
.atlas-almanac-leader { flex:1; min-width:var(--s-16); height:2px; margin-top:var(--s-4); background:radial-gradient(circle,var(--border-strong) 1px,transparent 1.2px) 0 50% / 6px 2px repeat-x; }
.atlas-almanac-mark { width:7px; height:7px; flex:none; border-radius:50%; background:var(--idle); }
.atlas-almanac-mark.is-waiting { background:var(--gold); box-shadow:0 0 0 var(--s-4) var(--gold-soft); }
.atlas-almanac-mark.is-working { border-radius:0; background:var(--accent); clip-path:polygon(50% 0,60% 38%,100% 50%,60% 62%,50% 100%,40% 62%,0 50%,40% 38%); animation:atlas-desk-twinkle var(--motion-twinkle) ease-in-out infinite alternate; }
@keyframes atlas-desk-twinkle { from { transform:scale(.75); opacity:.65; } to { transform:scale(1.1) rotate(45deg); opacity:1; } }
.atlas-desk-route-name { font:italic 12.5px var(--font-serif); fill:var(--text-1); }
.atlas-desk-route-path { fill:none; stroke:var(--accent); stroke-width:1.5; stroke-dasharray:1 6; animation:atlas-desk-flow var(--motion-flow) linear infinite; }
@keyframes atlas-desk-flow { to { stroke-dashoffset:-14; } }
@media (prefers-reduced-motion:reduce) { .atlas-almanac-mark.is-working,.atlas-desk-route-path { animation:none; } }
@container (max-width:959px) { .atlas-desk-almanac { grid-template-columns:repeat(2,minmax(0,1fr)); } .atlas-almanac-group:nth-child(3) { border-left:0; } }
@container (max-width:639px) { .atlas-desk { padding-inline:var(--s-16); } .atlas-desk-sky { margin-inline:calc(-1 * var(--s-16)); } .atlas-desk-almanac { grid-template-columns:1fr; } .atlas-almanac-group { padding:var(--s-16) 0; } .atlas-almanac-group + .atlas-almanac-group { border-left:0; border-top:1px solid var(--border); } }
@container (max-width:599px) { .atlas-desk-hint { display:none; } .atlas-desk-controls > :last-child { margin-left:auto; } }
`;
