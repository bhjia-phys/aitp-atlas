// Compose the two strips and one stable plane of tab bodies. The durable v2
// model never contains DOM, editor buffers, session bindings or transient Focus.
function AtlasApp() {
  const [version, setVersion] = useState(0);
  const overview = useApi('overview', version ? { fresh: 1 } : null, 'overview', version);
  const root=overview.data?.root;
  const registry=useDiscussionRegistry(root), rows=useSessionRows(), legacy=useThreadIndex();
  const workspaces=useAtlasCatalog(svc('workspaces')?.list), teams=useTeamIndex(root);
  // Key the entire body plane (including its focus, action callbacks and LRU).
  // No render under B may inherit a single retained SessionProvider from A.
  return h(AtlasRootShell,{key:tabStorageKey(root) || 'setup',overview,version,setVersion,registry,rows,legacy,workspaces,teams});
}

function AtlasRootShell({overview,version,setVersion,registry,rows,legacy,workspaces,teams}) {
  const ov = overview.data, root=ov?.root;
  const places = useMemo(() => placeKeys(ov), [ov]);
  const scope=useMemo(()=>({root,registry,rows,legacy,workspaces,places,teams}),[root,registry.root,registry.records,registry.loading,registry.error,rows,legacy,workspaces,places,teams]);
  const [source,setSource]=useState(()=>readTabSource(root));
  // Keep unverified legacy storage OUT of React's rendered plane and closed
  // stack, even while a catalog lags the overview. Re-project on new evidence.
  const state=useMemo(()=>scopedTabState(source,scope),[source,scope]);
  const stateRef=useRef(state), scopeRef=useRef(scope);
  stateRef.current=state;scopeRef.current=scope;
  const update=useCallback(fn=>{
    const prior=stateRef.current,next=fn(prior);
    if (next===prior) return;
    const scoped={state:next,legacy:false};
    const now={...scopeRef.current,registry:registryState.get()};
    const safe=scopedTabState(scoped,now);
    stateRef.current=safe;setSource({state:safe,legacy:false,changed:true});
  },[]);
  const canMigrate=tabScopeReady(scope) && (!rows || rows.phase==='ready') && (Array.isArray(workspaces) || workspaces?.phase==='ready');
  const savedNavigation=useRef(null);
  useEffect(()=>{
    if (!canMigrate || (!source.legacy && !source.changed)) return;
    // A place can be opened before the catalogs finish. Persist it when scope
    // becomes provable, not only on the next click. Ignore unrelated row ticks.
    const signature=JSON.stringify(state);
    if (savedNavigation.current!==signature) { saveTabState(state,root); savedNavigation.current=signature; }
  },[source,canMigrate,state,root]);

  const [message, flash] = useFlash();
  const [quick, setQuick] = useState(null);
  const [ask, setAsk] = useState(null), [assembly,setAssembly]=useState(null), [seatTeam,setSeatTeam]=useState(null);
  const [deskRequest, setDeskRequest] = useState(0);
  const moveTopicRef = useRef(null); // The active discussion's own filing popover, not a second dialog.
  const [libFilter, setLibFilter] = useState('');
  const [drag, setDrag] = useState(null);
  const [drop, setDrop] = useState(null);
  const [liveSplit, setLiveSplit] = useState(null);
  const [narrow, setNarrow] = useState(false);
  const [starting, setStarting] = useState(false);
  const rootRef = useRef(null), panesRef = useRef(null), bodies = useRef(new Map());
  const dividerDrag = useRef(null), gesture = useRef(null), live = useRef(true);
  const nav = useRef(null), goers = useRef(new Map());
  const domPrefix = React.useId();
  const domId = (part,id) => `${domPrefix}-${part}-${id}`;
  const bodyRef = id => {
    if (!bodies.current.has(id)) bodies.current.set(id, { current:null });
    return bodies.current.get(id);
  };
  useLayoutEffect(() => {
    const root = rootRef.current;
    const measure = () => { const w = root.getBoundingClientRect().width; if (w > 0) setNarrow(w < 720); };
    measure();
    if (typeof ResizeObserver !== 'undefined') {const observer = new ResizeObserver(measure); observer.observe(root);return () => observer.disconnect();}
    window.addEventListener('resize',measure); return () => window.removeEventListener('resize',measure);
  }, []);
  useEffect(() => { if (narrow) update(tabFoldPreviews); }, [narrow,update]);
  useEffect(() => { live.current=true;return () => {live.current=false;}; }, []);
  useEffect(() => {
    for (const id of bodies.current.keys()) if (!state.tabs[id]) {bodies.current.delete(id);goers.current.delete(id);delete editorDirty[id];}
  }, [state.tabs]);
  const appearance = ov && ov.appearance;
  const themes = useMemo(() => cleanThemes(appearance && appearance.themes), [appearance]);
  const [storedMode, setStoredMode] = useState(() => storageGet('prefs.v1', {})?.themeMode ?? storageGet('theme-mode', null));
  const chooseMode = m => {
    setStoredMode(m); storageSet('prefs.v1', { ...storageGet('prefs.v1', {}), themeMode: m });
  };
  const dshDark = React.useSyncExternalStore(dshThemeStore.subscribe, dshThemeStore.get);
  useEffect(() => watchDshTheme(), []);
  const modes = themeCycle(themes);
  const mode = modes.includes(storedMode) ? storedMode : modes.includes(appearance?.theme) ? appearance.theme : 'auto';
  const theme = resolveTheme(mode, dshDark, themes);
  activeBase = theme.base;

  const priorRetained = useRef([]), observations=useRef({root:null,values:new Map()});
  const [foreground, setForeground] = useState(() => document.visibilityState !== 'hidden');
  useEffect(()=>{
    const change=()=>setForeground(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange',change);return ()=>document.removeEventListener('visibilitychange',change);
  },[]);
  const records = useMemo(()=>tabScopeReady(scope) ? registry.records.filter(r=>tabSessionInScope(r.id,scope)) : [],[scope]);
  const activeId = s => s.layout.active[s.lastPane] || 'desk';
  const active = activeId(state);
  const displayTabs = useMemo(() => {
    const result={...state.tabs}, bySession=new Map(records.map(r=>[r.id,r]));
    for (const t of Object.values(state.tabs)) if (tabConversation(t)) {
      const record=bySession.get(t.sessionId), row=rowOf(rows,t.sessionId);
      result[t.id]={...t, title:record?.title || row?.displayTitle || row?.title || t.title,
        unread:Boolean(record && record.lastTurnAt > (record.seenAt || 0))};
    }
    return result;
  }, [state.tabs, rows, records]);
  const tab=displayTabs[active];
  const show = id => {update(s => tabActivate(s,id));setActivePane(id);};
  const promote = id => update(s => tabPromote(s,id));
  const close = id => {
    if (id === 'desk' || !stateRef.current.tabs[id]) return false;
    if (editorDirty[id] && !window.confirm('Close it without saving your changes?')) return false;
    delete editorDirty[id];update(s => tabCloseState(s,id));return true;
  };
  const move = (id,pane,index) => {if (!narrow || pane === 'left') update(s => tabMoveState(s,id,pane,index));};
  const splitPane = (id = activeId(stateRef.current)) => {
    if (narrow) {flash('Two panes need at least 720 px.');return;}
    if (id !== 'desk') {move(id,otherPane(paneOfTab(stateRef.current.layout,id)));return;}
    const map = stateRef.current.tabs['place:map'];
    if (map) move(map.id,'right'); else nav.current('desk',{view:'map'},{otherPane:true});
  };
  const reopen = () => update(s => tabReopen(s,narrow));
  const layout = useMemo(() => tabScreenLayout(state,narrow), [state,narrow]);
  const cycle = delta => {
    const s = stateRef.current, screen = tabScreenLayout(s,narrow), id = activeId(s), ids = screen[paneOfTab(screen,id)];
    show(ids[(ids.indexOf(id)+ids.length+delta)%ids.length]);
  };
  const goOf = id => {
    if (!goers.current.has(id)) goers.current.set(id, (next,opts) => nav.current(id,next,opts));
    return goers.current.get(id);
  };
  // Legacy views call go(route) without passing a browser event. Capture only
  // for this synchronous gesture; async completions must not inherit modifiers.
  const rememberGesture = (event, from, extra) => {
    const value = {from,ctrlKey:event.ctrlKey,metaKey:event.metaKey,shiftKey:event.shiftKey,button:event.button,...extra};
    gesture.current=value; queueMicrotask(() => {if(gesture.current===value)gesture.current=null;});
  };
  nav.current = (from, next, event) => {
    if (!next) return;
    const s=stateRef.current, own=s.tabs[from];
    if (!own) return;
    if (next.back) { close(from);return; }
    const captured = gesture.current?.from === from ? gesture.current : {};
    const opts = event || captured;
    // Copy explicitly: properties of a DOM or React event need not be enumerable.
    const routing = { narrow,ctrlKey:opts.ctrlKey, metaKey:opts.metaKey,shiftKey:opts.shiftKey, button:opts.button,permanent:opts.permanent, otherPane:opts.otherPane, samePane:opts.samePane };
    const spec = tabSpec(next,places);
    if (!spec) return;
    const currentScope={...scopeRef.current,registry:registryState.get()};
    if ((spec.kind==='team' && spec.teamId && !tabTeamRecord(spec.teamId,currentScope)) || (spec.sessionId && !(spec.kind==='member' && spec.teamId ? tabTeamMember(spec,currentScope) : tabSessionInScope(spec.sessionId,currentScope)))) {
      flash('This session is not verified for the current research workspace.'); return;
    }
    if (spec.kind==='desk' && opts.focusComposer) setDeskRequest(n=>n+1);
    if (spec.kind==='place' && ['discussions','teams'].includes(spec.view) && !spec.filter) spec.filter='';
    spec.at = Date.now();
    if (captured.button===1) routing.button=1;
    update(cur=>tabFollowState(cur,from,spec,routing,editorDirty,id=>{
      if (!window.confirm('Leave without saving your changes?')) return false;
      delete editorDirty[id];return true;
    }));
  };
  const openThread = (id,from = activeId(stateRef.current),opts={}) => {
    if (!id) return;
    if (opts.teamId) {
      const team=tabTeamRecord(opts.teamId,scopeRef.current);
      const name=id===team?.leadId?'lead':rowOf(rows,team?.leadId)?.projectionValues?.subagentCatalog?.find(c=>c.id===id)?.name;
      if (name) openSeat(opts.teamId,id,name,from); else flash('This seat has not been verified by DSH.');
      return;
    }
    const record=registryGet(id),row=rowOf(rows,id);
    const isMember=!record && Boolean(row?.parentId || row?.parentSessionId);
    nav.current(from,{view:isMember?'member':'discussion',sessionId:id,title:record?.title || row?.displayTitle || row?.title || 'Discussion'},opts);
  };
  const openTeam=(id,from=activeId(stateRef.current),opts={})=>{
    const team=tabTeamRecord(id,scopeRef.current);
    if (!team) {flash('This team is not available in this workspace.');return;}
    nav.current(from,{view:'team',teamId:id,title:team.name,section:opts.section,decisionId:opts.decisionId},opts);
  };
  const openSeat=(teamId,id,name,from)=>nav.current(from,{view:'member',teamId,sessionId:id,seatName:name,title:name});
  const assemble=(from,preset={})=>{if(root)setAssembly({from,preset});};
  // Desk submission activates the real session only after DSH accepts its first
  // message; failure is returned to the Desk so the researcher can retry.
  const submitDesk = async ({question,topicId,attachments=[],model=null,filing='none',candidates=[]}) => {
    const t = topicId == null ? null : ov?.topics?.[topicId];
    const context=focusContext({topic:t ? {id:t.id,title:t.title,path:t.file} : null});
    if (attachments.length) context.attachments=attachments;
    context.routing={filing,candidates};
    const record = await startThread({root:ov.root,context,intent:'ask',question,origin:'desk',filing,candidates,model});
    if (live.current) openThread(record.id,'desk');
    return record;
  };
  const openAsk = () => {
    for (const id of visibleIds) {
      if (!id || tabConversation(state.tabs[id]) || !bodyRef(id).current) continue;
      const got=captureSelection(bodyRef(id).current);
      if (got.selection) {show(id);setAsk({from:id,preset:got});return;}
    }
    const across=layout.active[otherPane(paneOfTab(layout,active))];
    const from=tabConversation(tab) && visibleIds.includes(across) && !tabConversation(state.tabs[across]) ? across : active;
    setAsk({from,preset:{}});
  };
  const askFrom = async (from,context,intent,question,label,{targetId='new',origin='ask'}={}) => {
    if (!ov) return;
    promote(from); setStarting(true);
    try {
      // Capture the chosen session before any await. Never replace a stale or
      // closed target with whichever discussion happens to be active now.
      if (targetId!=='new') {
        const target=registryGet(targetId);
        if (!target || target.status==='resolved' || !knownThread(rows,target) || !tabSessionInScope(targetId,{...scopeRef.current,registry:registryState.get()})) throw new Error('The chosen discussion is no longer available.');
        await keepBaseline(targetId,context);
        await atlasSendToSession(targetId,promptOf(context,intent,question));
        if (live.current && stateRef.current.tabs[from]) openThread(targetId,from);
      } else {
        const record=await startThread({root:ov.root,context,intent,question,label,origin,filing:context.topic?'user':'none'});
        if (live.current && stateRef.current.tabs[from]) openThread(record.id,from);
      }
    } catch (e) {
      if (live.current) flash('The question could not be sent: '+e.message);
    } finally { if (live.current) setStarting(false); }
  };
  const onQuick = (kind,from=activeId(stateRef.current)) => setQuick({tab:kind || 'paper',from,at:Date.now()});
  const onRefresh = () => {
    if (Object.keys(stateRef.current.tabs).some(id=>editorDirty[id])) { flash('Save or discard your edits before reading the files again.'); return; }
    setVersion(Date.now()); registry.refresh();teams.refresh();
  };
  const chrome = useAtlasChrome({rootRef, overview:ov, mode, teamRecords:teams.records, onAssemble:root?()=>assemble(activeId(stateRef.current)):null,openTeam:(id,opts)=>openTeam(id,activeId(stateRef.current),opts),discussionRecords:records.filter(r=>knownThread(rows,r)), unreadCount:records.filter(r=>knownThread(rows,r) && r.lastTurnAt > (r.seenAt || 0)).length,teamNeedsCount:registry.root===root && !registry.loading && !registry.needsError && !registry.needs?.teamErrors?.length ? (registry.needs?.decisions?.length || 0) : 0,themeModes:modes, onTheme:chooseMode,activePlace:tab.kind==='desk'?'desk':tab.kind==='place'?tab.view:null,
    onMoveDiscussion:tab.kind === 'discussion' && registryGet(tab.sessionId) && !rowOf(rows,tab.sessionId)?.parentId ? () => moveTopicRef.current?.() : null,
    activeTab:{id:active,title:tabV2Label(tab,ov),icon:tabV2Icon(tab)},recentFiles:[...state.order].reverse().map(id=>state.tabs[id]).filter(t=>t.kind==='file').map(t=>({path:t.path,title:sideLabel(ov,t.path)})),
    openPlace:(view,opts)=>nav.current(activeId(stateRef.current),{view},opts), openTopic:(path,opts)=>nav.current(activeId(stateRef.current),{view:'doc',path},opts),
    openFile:(path,opts)=>nav.current(activeId(stateRef.current),{view:'doc',path},opts),openThread:(id,opts)=>openThread(id,activeId(stateRef.current),opts),
    onNewDiscussion:()=>nav.current(activeId(stateRef.current),{view:'desk'},{focusComposer:true}),onQuick:onQuick,onAsk:openAsk,onRefresh,onSplit:()=>splitPane(),
    onMove:()=>{if(narrow || active==='desk') {flash(narrow?'Two panes need at least 720 px.':'Desk stays pinned on the left.');return;} move(active,otherPane(state.lastPane));},onReopen:reopen,onCycle:cycle,onClose:()=>close(active),flash });
  const focus = (id=active) => {if (stateRef.current.tabs[id]) show(id);chrome.toggleFocus();};
  const focused=chrome.focused;
  const shown=focused ? [paneOfTab(layout,active)] : PANES.filter(p=>layout[p].length);
  const visibleIds=focused ? [active] : Object.values(layout.active).filter(Boolean);
  const visibleLeft=visibleIds.includes(layout.active.left)?layout.active.left:null;
  const visibleRight=visibleIds.includes(layout.active.right)?layout.active.right:null;
  const retained=retainedTabIds(state.tabs,state.order,[active,...visibleIds],priorRetained.current);
  useLayoutEffect(()=>{ priorRetained.current=retained; });
  useEffect(()=>{
    if (!ov?.root || registry.root!==ov.root) return;
    const prev=observations.current.root===ov.root ? observations.current.values : new Map();
    const shownSessions=foreground ? [visibleLeft,visibleRight].map(id=>state.tabs[id]?.sessionId).filter(Boolean) : [];
    const {snapshots,patches}=discussionObservations(prev,records,rows,shownSessions,Date.now());
    observations.current={root:ov.root,values:snapshots};
    for (const {id,patch} of patches) registryPatch(id,patch).catch(()=>{if (live.current) flash('Could not update the read status of a discussion.');});
  },[ov?.root,registry.root,records,rows,visibleLeft,visibleRight,foreground]);
  const targets=useMemo(()=>discussionTargetRows(state.tabs,state.order,records,rows),[state.tabs,state.order,records,rows]);
  useLayoutEffect(() => {
    const all=focusStore.get(), byTab={};
    for (const [id,data] of Object.entries(all.byTab)) if (state.tabs[id]) byTab[id]=data;
    const paneOf=Object.fromEntries([...layout.left.map(id=>[id,'left']),...layout.right.map(id=>[id,'right'])]);
    focusStore.set({byTab,paneOf,active,visible:{left:visibleLeft,right:visibleRight}});
  }, [state.layout, active, narrow, visibleLeft, visibleRight]);
  const actionsFor = from => ({
    assembleTeam:preset=>assemble(from,preset),openTeam:(id,opts)=>openTeam(id,from,opts),
    current:besideDiscussion(state.tabs,layout,visibleIds,from), targets, openDiscussionIds:state.order.map(id=>state.tabs[id]).filter(t=>t.kind==='discussion').map(t=>t.sessionId), keepTab:(id=from)=>promote(id),focusPane:(id=from)=>focus(id),
    ask:(...args)=>askFrom(from,...args),openThread:(id,opts)=>openThread(id,from,opts),startAsk:preset=>setAsk({from,preset:preset||{}}),
    addToThread(context) {
      const sessionId = besideDiscussion(state.tabs,layout,visibleIds,from);
      const cur=stateRef.current, screen=tabScreenLayout(cur,narrow), currentVisible=focused?[activeId(cur)]:Object.values(screen.active).filter(Boolean);
      if (!sessionId || besideDiscussion(cur.tabs,screen,currentVisible,from)!==sessionId) {flash('There is no discussion open beside this tab.');return;}
      promote(from); const text=contextBlock(context);
      if (draftIntoThread(sessionId,text+'\n\n')) flash('The passage is in the discussion’s input box: add your question and send it.');
      else if (navigator.clipboard) navigator.clipboard.writeText(text).then(()=>flash('Copied the passage; paste it into the discussion.'),()=>flash('Atlas could not add it here.'));
    },
    openPreview({main,pdf,from:source=from,activate}) {
      if (!main || !stateRef.current.tabs[source]) return;
      const spec=tabSpec({view:'preview',main,pdf:pdf||''});
      update(s=>{
        const existing=Object.values(s.tabs).find(t=>t.key===spec.key);
        if (existing && !activate) return {...s,tabs:{...s.tabs,[existing.id]:{...existing,pdf:pdf||existing.pdf}}};
        return tabOpenState(s,source,spec,{narrow},editorDirty);
      });
    },
  });
  const contentOf = t => {
    const go=goOf(t.id),props={overview:ov,go,flash,version};
    const setup=overview.error?.body?.error;
    if (t.kind==='desk' && (ov || setup?.code)) return h(DeskView,{...props,setup,onRetry:onRefresh,focusRequest:deskRequest,onStartDiscussion:submitDesk,onOpenThread:id=>openThread(id,t.id)});
    if (overview.error) return h(ErrorNote,{error:overview.error,onRetry:onRefresh});
    if (!ov) return h(Loading);
    if (t.kind==='place') {
      if (t.view==='library') return h(React.Fragment,null,h('label',{className:'atlas-library-local-filter'},h('input',{className:'atlas-input',type:'search',value:libFilter,placeholder:'Filter papers and entries','aria-label':'Filter papers and entries',onChange:e=>setLibFilter(e.target.value)})),h(LibraryView,{...props,filter:libFilter,tab:t.tab,focusAdd:t.add}));
      if (t.view==='discussions') return h(DiscussionsPlace,{...props,filter:t.filter||''});
      if (t.view==='teams') return h(TeamsPlace,{...props,filter:t.filter||'active',onAssemble:p=>assemble(t.id,p),onTeam:(id,opts)=>openTeam(id,t.id,opts)});
      if (t.view==='map') return h(UniverseView,{...props,filter:'',anchor:t.anchor});
      if (t.view==='learn') return h(LearnView,{...props,path:t.path});
      if (t.view==='search') return h(SearchView,{...props,q:t.q,at:t.at});
      if (t.view==='write') return h(WriteView,{...props,onQuick:kind=>onQuick(kind,t.id)});
    }
    if (t.kind==='file' || t.kind==='topic') return h(DocView,{...props,key:t.path+(t.edit?':edit':''),path:t.path,edit:t.edit,created:t.created,anchor:t.anchor,anchorAt:t.at});
    if (t.kind==='paper') return h(PaperRefView,{...props,url:t.url,topic:t.topic,anchor:t.anchor,anchorAt:t.at});
    if (t.kind==='preview') return h(TexPreview,{tab:t,flash,go});
    if (t.kind==='team') {
      const team=tabTeamRecord(t.teamId,scope) || (t.sessionId && teams.records.find(r=>r.leadId===t.sessionId));
      if (!team) return h(Empty,null,'This team is no longer available here.');
      return h(TeamRoom,{...props,scope,teamId:team.id,team,visible:visibleIds.includes(t.id),section:t.section,decisionId:t.decisionId,onMember:(id,name)=>openSeat(team.id,id,name,t.id),onAddSeat:()=>setSeatTeam(team.id)});
    }
    if (t.kind==='member' && t.teamId) return h(TeamMemberTab,{...props,scope,team:tabTeamRecord(t.teamId,scope),seatName:t.seatName,sessionId:t.sessionId,visible:visibleIds.includes(t.id),retained:retained.includes(t.id),onTeam:()=>openTeam(t.teamId,t.id),onOpenLink:ref=>go(ref.url?{view:'paper',url:ref.url}:{view:'doc',path:ref.path,anchor:ref.anchor,link:true})});
    if (tabConversation(t)) return h(DiscussionTab,{key:t.sessionId,sessionId:t.sessionId,record:registryGet(t.sessionId),moveTopicRef:t.id===active ? moveTopicRef : null,visible:visibleIds.includes(t.id),retained:retained.includes(t.id),onClose:()=>close(t.id),go,flash,overview:ov,onOpen:id=>openThread(id,t.id),onOpenLink:ref=>go(ref.url?{view:'paper',url:ref.url}:{view:'doc',path:ref.path,anchor:ref.anchor,link:true})});
    return h(Empty,null,'This team room is not available in this version.');
  };
  const split=liveSplit ?? layout.split;
  const geometry = p => shown.length===1 ? {left:'0%',width:'100%'} : p==='left' ? {left:'0%',width:split+'%'} : {left:split+'%',width:100-split+'%'};
  const startDrag = id => {setDrag(id);if (!id) setDrop(null);};
  const dropHandlers = (pane,where,indexAt) => ({onDragOver:e=>{
    if (!drag) return;e.preventDefault(); e.dataTransfer.dropEffect='move';const index=indexAt?.(e.clientX);
    if (!drop || drop.pane!==pane || drop.where!==where || drop.index!==index) setDrop({pane,where,index});
  },onDrop:e=>{if(!drag)return;e.preventDefault();move(drag,pane,indexAt?.(e.clientX));startDrag(null);}});
  const dividerValue = (e) => Math.max(20,Math.min(80,Math.round(100*(e.clientX-dividerDrag.current.left)/dividerDrag.current.width)));
  const menuItems = (pane,id) => {
    const t=state.tabs[id],ids=layout[pane];
    const many = list=>{for (const i of list) if (i!=='desk' && !close(i)) break;};
    return [
      {id:'move',label:'Move tab to the other pane',disabled:narrow || id==='desk',onSelect:()=>move(id,otherPane(pane))},
      ...(!layout.right.length?[{id:'split',label:'Split',disabled:narrow,onSelect:()=>splitPane(id)}]:[]),
      {id:'others',label:'Close other tabs',disabled:!ids.some(i=>i!==id && i!=='desk'),onSelect:()=>many(ids.filter(i=>i!==id))},
      {id:'right',label:'Close tabs to the right',disabled:ids.at(-1)===id,onSelect:()=>many(ids.slice(ids.indexOf(id)+1))},
      {id:'reopen',label:'Reopen closed tab',disabled:!state.closed.length,onSelect:reopen},
      ...(t.kind==='file'||t.kind==='topic'?[{id:'path',label:'Copy path',onSelect:async()=>{try{await navigator.clipboard.writeText(t.path);flash('Path copied.');}catch{flash('Clipboard is not available here.');}}}]:[]),
      ...(t.kind==='paper'?[{id:'open-web',label:'Open in the browser',onSelect:()=>window.open(t.url,'_blank','noopener,noreferrer')}]:[]),
    ];
  };
  const middle = (e,id) => {
    if (e.button!==1) return;
    // Replay only an identified navigation control. Never middle-activate an
    // arbitrary button (in particular a Send, Save, Build or destructive action).
    const target=e.target.closest?.('[data-atlas-open="true"], .atlas-markdown a[href], .atlas-companion-body a[href]');
    if (!target) return;
    e.preventDefault();e.stopPropagation();
    const click=new MouseEvent('click',{bubbles:true,cancelable:true,button:0,ctrlKey:e.ctrlKey,metaKey:e.metaKey,shiftKey:e.shiftKey});
    Object.defineProperty(click,'atlasMiddle',{value:true});target.dispatchEvent(click);
  };
  const wrap = (id,node) => h(PaneContext.Provider,{value:id},h(AtlasActions.Provider,{value:actionsFor(id)},node));
  const running=t=>Boolean(t.sessionId && rowOf(rows,t.sessionId)?.running);
  return h('div',{ref:rootRef,className:cx('atlas-root atlas-shell-v2',drag&&'is-dragging-tab',focused&&'is-focused'),'data-theme-base':theme.base,'data-theme':theme.name,style:themeStyle(theme)},
    h('div',{className:'atlas-body'},
      !focused && h('div',{className:'atlas-strips'},shown.map(p=>h(AtlasTabStrip,{key:p,workspaceMenu:p===shown[0]?chrome.workspaceMenu:null,pane:p,ids:layout[p],active:layout.active[p],last:paneOfTab(layout,active)===p,tabs:displayTabs,ov,width:geometry(p).width,running,drag,drop,
        menuItems:menuItems(p,layout.active[p]),onShow:show,onClose:close,onFocus:focus,onPromote:promote,onDrag:startDrag,onDropAt:dropHandlers,domId}))),
      h('div',{className:'atlas-panes',ref:panesRef},
        state.order.map(id=>{
          const t=state.tabs[id],visible=visibleIds.includes(id);
          return h('div',{key:id,id:domId('panel',id),role:'tabpanel','data-session-id':tabConversation(t)?t.sessionId:undefined,'data-conversation-retained':tabConversation(t)?String(retained.includes(id)):undefined,'aria-label':tabV2Label(displayTabs[id],ov),'aria-labelledby':focused?undefined:domId('tab',id),'aria-hidden':visible?undefined:true,
            ref:bodyRef(id),className:cx('atlas-tab-body','is-'+t.kind,!visible&&'is-hidden'),style:geometry(paneOfTab(layout,id)),
            onFocusCapture:()=>show(id),onPointerDownCapture:()=>show(id),onClickCapture:e=>rememberGesture(e,id,e.nativeEvent?.atlasMiddle?{button:1}:{}),onAuxClickCapture:e=>middle(e,id)},
            wrap(id,h(Boundary,null,contentOf(t))));
        }),
        shown.length===2 && h('div',{className:'atlas-pane-divider',style:{left:split+'%'},role:'separator','aria-orientation':'vertical','aria-label':'Resize the panes','aria-valuemin':20,'aria-valuemax':80,'aria-valuenow':split,tabIndex:0,
          onPointerDown:e=>{e.preventDefault();dividerDrag.current=panesRef.current.getBoundingClientRect();e.currentTarget.setPointerCapture(e.pointerId);},onPointerMove:e=>{if(dividerDrag.current)setLiveSplit(dividerValue(e));},
          onPointerUp:e=>{if(!dividerDrag.current)return;const value=dividerValue(e);dividerDrag.current=null;setLiveSplit(null);update(s=>({...s,layout:{...s.layout,split:value}}));},onLostPointerCapture:()=>{dividerDrag.current=null;setLiveSplit(null);},
          onDoubleClick:()=>update(s=>({...s,layout:{...s.layout,split:50}})),onKeyDown:e=>{const d=e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:0;if(d){e.preventDefault();update(s=>({...s,layout:{...s.layout,split:Math.max(20,Math.min(80,s.layout.split+d))}}));}}}),
        drag && !focused && shown.map(p=>h('div',{key:'drop-'+p,className:cx('atlas-drop-pane',drop?.pane===p && drop.where==='pane'&&'is-over'),style:geometry(p),...dropHandlers(p,'pane')})),
        drag && !focused && !narrow && shown.length===1 && h('div',{className:cx('atlas-drop-split is-right',drop?.where==='split'&&'is-over'),...dropHandlers('right','split')},h(Icon,{name:'panel'}),'Drop here to split'),
        visibleIds.filter(id=>!tabConversation(state.tabs[id])).map(id=>h(React.Fragment,{key:'select-'+id},wrap(id,h(SelectionTools,{container:bodyRef(id),host:panesRef})))),
        ask && state.tabs[ask.from] && wrap(ask.from,h(AskBar,{preset:ask.preset,onClose:()=>setAsk(null)})),
        assembly && ov && h(AssembleTeamSheet,{overview:ov,preset:assembly.preset,flash,onClose:()=>setAssembly(null),onStarted:team=>{
          if (!live.current || !team?.id) return;
          const from=assembly.from;recordTeamInIndex(root,team);
          const latest=lookupTeam(team.id,root);setAssembly(null);
          if (!latest) {flash('Team no longer available in this workspace.');return;}
          scopeRef.current={...scopeRef.current,teams:{...teams,records:[latest,...teams.records.filter(r=>r.id!==latest.id)]}};
          openTeam(latest.id,stateRef.current.tabs[from]?from:'desk');
        }}),
        seatTeam && tabTeamRecord(seatTeam,scope) && h(AddTeamSeatSheet,{team:tabTeamRecord(seatTeam,scope),overview:ov,scope,flash,onClose:()=>setSeatTeam(null)}),
        quick && ov && wrap(quick.from,h(QuickAdd,{key:quick.at,tab:quick.tab,overview:ov,go:goOf(quick.from),flash,onClose:()=>setQuick(null)})),
        h(Toast,{message:message || (starting?'Starting the discussion…':null)}))),
    chrome.overlays);
}
