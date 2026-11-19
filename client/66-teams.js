// Native team assembly. A charter requests seats; only the root DSH session can
// call subagent and own their board. No launch path here starts a child directly.
const atlasCrewTemplates = [
  ['derive-check','Derive and check','theorist','referee'], ['theory-numerics','Theory and numerics','theorist','numerics','referee'],
  ['literature-survey','Literature survey','literature','literature','referee'], ['write-up','Write-up','writer','referee'], ['custom','Custom']
];
const atlasCrewRoles = ['theorist','numerics','literature','referee','writer','custom'];
const atlasInheritedRoute = 'Same as the lead (no override)';
function atlasCrewSeat(role,seats) {
  let name=role, suffix=1; while (seats.some(s=>s.name===name)) name=role+'-'+ ++suffix;
  return {name,role,mode:'core',model:null};
}
function atlasCrewFromTemplate(id) {
  const roles=(atlasCrewTemplates.find(t=>t[0]===id) || []).slice(2);
  return roles.reduce((seats,role)=>[...seats,atlasCrewSeat(role,seats)],[]);
}
function atlasCrewTemplateNote(draft) {
  const template=atlasCrewTemplates.find(t=>t[0]===draft.template);
  if (!template) return '';
  const base=atlasCrewFromTemplate(draft.template), seats=draft.seats;
  const exact=base.length===seats.length && base.every((b,i)=>{
    const s=seats[i];return s.name===b.name && s.role===b.role && s.mode===b.mode && !s.model && !s.task && !s.roleCard && !s.inputs?.length;
  });
  return exact ? '' : `${template[1]} · Modified`;
}
function atlasCrewErrors(draft) {
  const errors={};
  if (!draft.goal?.trim()) errors.goal='Write the question this team should answer.';
  if (!draft.doneWhen?.trim()) errors.doneWhen='State the evidence or result that would finish the work.';
  if (!draft.topic?.path) errors.topic='Choose the topic that will own the run folder.';
  const seats=draft.seats || [];
  seats.forEach((s,i)=>{
    if (!/^[a-z][a-z0-9-]{0,31}$/.test(s.name) || /^(lead|readme|con|prn|aux|nul|com[1-9]|lpt[1-9])$/.test(s.name)) errors['seat'+i]='Use a non-reserved name: 1–32 lowercase letters, digits or hyphens; start with a letter.';
    else if (seats.some((other,j)=>i!==j && other.name===s.name)) errors['seat'+i]='Seat names must be unique.';
    else if (!atlasCrewRoles.includes(s.role) || !['core','one-shot'].includes(s.mode)) errors['seat'+i]='Choose a valid role and duration.';
    else if (s.role==='custom' && !s.roleCard?.trim()) errors['seat'+i]='Give this custom role a responsibility and write scope.';
    else if (s.model) errors['seat'+i]='DSH has not authorized an explicit model for this seat. Use no override.';
  });
  return errors;
}
function atlasCrewCapabilities(services,catalog,choice) {
  if (typeof services.teams?.setEnabled!=='function') return 'Agent Teams is not available on this DSH.';
  if (typeof services.sessions?.create!=='function' || typeof services.sessions?.retain!=='function' || typeof services.workspaces?.create!=='function') return 'DSH cannot create and bind a lead in this research workspace.';
  if (choice && typeof services.select!=='function') return 'DSH model switching is unavailable. Use the verified default lead model.';
  const route=choice || atlasModelValue(catalog?.default), entry=atlasCatalogEntry(catalog,route);
  if (!entry || (catalog.routableProviders && !catalog.routableProviders.includes(route.provider))) return choice ? 'The selected lead model is not available. Choose an available route.' : 'DSH has no available default lead model. Choose an available route.';
  if (route.effort && !entry.reasoning?.efforts?.some(e=>e.id===route.effort)) return 'The selected lead reasoning effort is unavailable.';
  return '';
}
function atlasCrewServices(root) {
  return {teams:teamScope?.remote?.agentTeams,sessions:svc('sessions'),workspaces:svc('workspaces'),catalog:atlasFetchModelCatalog,select:typeof atlasModelAccess.get()?.selectModel==='function' ? atlasSelectSessionModel : null,
    // Mutations here must surface an ambiguous result, not replay it in the transport.
    request:(path,body,method='POST')=>api(path,{method,body,query:{expectedRoot:root}},20)};
}
async function atlasStartNativeTeam({root,draft,requestId},deps=atlasCrewServices(root)) {
  if (!root || !requestId) throw new Error('Workspace or launch identity is missing.');
  const invalid=Object.values(atlasCrewErrors(draft))[0]; if (invalid) throw new Error(invalid);
  const catalog=await deps.catalog();
  const missing=atlasCrewCapabilities(deps,catalog,draft.leadModel); if (missing) throw new Error('This DSH cannot run teams: '+missing);
  let team=null, leadId='',stage='create run', attempted=false, accepted=false;
  try {
    const result=await deps.request('teams',{...draft,requestId}); team=result?.team;
    if (!team?.id || !result.brief?.trim()) throw new Error('Atlas did not return the team and its lead brief.');
    if (result.replayed || team.leadId) throw new Error('This launch was already recorded. Inspect its team before taking further action.');
    stage='bind workspace';const workspace=await deps.workspaces.create({path:root}), workspaceId=workspace?.workspaceId || workspace?.id;
    if (!workspaceId) throw new Error('DSH did not resolve the research workspace.');
    stage='create lead';leadId=await deps.sessions.create({workspaceId});
    if (typeof leadId!=='string' || !leadId) throw new Error('DSH did not confirm a new lead session.');
    // Bind before configuring or prompting: a partial lead remains discoverable
    // even when enable/rename/select/prompt fails or the page is closed.
    stage='register lead';const saved=await deps.request('teams/'+encodeURIComponent(team.id),{leadId},'PATCH');
    if (saved?.team?.leadId!==leadId) throw new Error('The registry did not bind this lead id.'); team=saved.team;
    stage='open lead';const ref=deps.sessions.retain(leadId,{source:'atlas'});
    try {
      const session=(await ref.ready)?.session;
      if (!session?.rename || !session?.prompt) throw new Error('The lead cannot be named or prompted.');
      if (draft.leadModel) { stage='select lead model'; await deps.select(leadId,draft.leadModel); }
      stage='enable Agent Teams';atlasRequireResult(await deps.teams.setEnabled(leadId,true),'DSH declined Agent Teams.');
      stage='name lead';atlasRequireResult(await session.rename(`Atlas team · ${draft.topic.title} · ${shortTitle(draft.goal,70)}`),'DSH could not name the lead.');
      stage='confirm topic review baseline';
      const file=team.topic?.path;
      if (!file || team.topic.id!==draft.topic.id) throw new Error('The registry did not return the charter’s canonical topic.');
      const baseline=await deps.request('review/baseline',{session:leadId,files:[file]});
      if (!Array.isArray(baseline?.watching) || !baseline.watching.includes(file)) throw new Error('Atlas could not confirm review coverage for the topic note.');
      stage='send brief';attempted=true;atlasRequireResult(await session.prompt([{type:'text',text:result.brief}],'queue'),'DSH did not confirm the brief.');
      accepted=true;stage='record brief receipt';const startedAt=Date.now();
      const receipt=await deps.request('teams/'+encodeURIComponent(team.id),{startedAt},'PATCH');
      if (receipt?.team?.leadId!==leadId || receipt.team.startedAt!==startedAt) throw new Error('Atlas did not confirm the receipt timestamp.');
      return receipt.team;
    } finally {ref.release();}
  } catch (error) {
    throw Object.assign(new Error(`${error.message} Stage: ${stage}.${team ? ' Team: '+team.id+'.' : ''}${leadId ? ' Lead: '+leadId+'.' : ''} ${accepted ? 'DSH accepted the brief; do not resend it.' : attempted ? 'Delivery was not confirmed. Inspect the lead before sending anything again.' : 'No brief was sent by this attempt. Inspect existing teams before starting another launch.'}`),{team,leadId,stage,attempted,accepted,startedRequest:true});
  }
}
function atlasTeamSeatStatus(team,seat,leadRow,now=Date.now(),rows) {
  const unknown={state:'unknown',id:null,error:''};
  if (!team?.leadId || leadRow?.id!==team.leadId || !seat?.name) return unknown;
  const catalog=leadRow.projectionValues?.subagentCatalog;if (!Array.isArray(catalog)) return unknown;
  const found=catalog.filter(c=>c.name===seat.name);
  if (found.length>1) return {...unknown,error:'The catalog contains more than one match.'};
  if (!found.length) return !team.startedAt ? unknown : {...unknown,state:now-team.startedAt>=180000?'not-started':'starting'};
  const child=found[0];if (!child.id || child.id===team.leadId) return unknown;
  const row=rows?.byId?.[child.id];if (row && row.parentId && row.parentId!==team.leadId) return unknown;
  if (child.phase==='failed') return {state:'failed',id:child.id,error:typeof child.error==='string'?child.error:child.error?.message || 'DSH reported a failed seat.'};
  return {state:row?.running===true ? 'running' : row?.running===false ? 'idle' : 'unknown',id:child.id,error:''};
}
async function atlasTeamRetrySeat(team,seat) {
  const rows=svc('sessions')?.list?.getSnapshot?.(), lead=rows?.byId?.[team?.leadId];
  if (rows?.phase!=='ready' || !team.seats.some(s=>s.name===seat.name) || atlasTeamSeatStatus(team,seat,lead,Date.now(),rows).state!=='not-started') throw new Error('The missing seat is not confirmed by the current lead catalog.');
  const call=team.seatCalls?.find(c=>c.name===seat.name);
  await atlasSendToSession(team.leadId,`Check your current subagent catalog. Only if “${seat.name}” is still absent, start that seat using ${call ? 'subagent '+JSON.stringify(call) : 'its exact call in your original brief'}; do not duplicate a member.`);
}

function atlasCrewLaunchId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  // getRandomValues also works in LAN HTTP pages where randomUUID may not.
  if (!globalThis.crypto?.getRandomValues) return '';
  return 'launch-'+Array.from(globalThis.crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join('');
}
function atlasCrewDraft(overview,preset={}) {
  const topicId=preset.topicId ?? preset.topic?.id ?? (typeof preset.topic==='string' ? preset.topic : null);
  const topic=topicId==null ? null : overview?.topics?.[topicId];
  return {template:'derive-check',goal:preset.goal || '',doneWhen:'',topic:topic ? {id:topic.id,path:topic.file,title:topic.title} : null,
    conventions:'',extraAllowed:[],extraAsk:[],inputs:(preset.attachments || []).map(a=>a.path).filter(Boolean),leadModel:preset.leadModel || null,seats:atlasCrewFromTemplate('derive-check')};
}
function AssembleTeamSheet({overview,preset,onClose,onStarted,flash}) {
  const [draft,setDraft]=useState(()=>atlasCrewDraft(overview,preset || {}));
  const [catalog,setCatalog]=useState(null),[catalogError,setCatalogError]=useState(''),[check,setCheck]=useState(0);
  const [preview,setPreview]=useState(null),[opened,setOpened]=useState(false),[editFiles,setEditFiles]=useState(false),[attach,setAttach]=useState(false);
  const [busy,setBusy]=useState(false),[problem,setProblem]=useState(null),[touched,setTouched]=useState({});
  const latch=useRef(false),goalRef=useRef(null),attachRef=useRef(null),seatRefs=useRef([]),live=useRef(false);
  const [requestId]=useState(atlasCrewLaunchId);
  const service=React.useSyncExternalStore(atlasModelAccess.subscribe,atlasModelAccess.get);
  useEffect(()=>{live.current=true;return ()=>{live.current=false;};},[]);
  useEffect(()=>{let current=true;setCatalog(null);setCatalogError('');atlasFetchModelCatalog(service).then(c=>{if(current)setCatalog(c);},e=>{if(current)setCatalogError(e.message);});return ()=>{current=false;};},[service,check]);
  const errors=atlasCrewErrors(draft), first=Object.keys(errors)[0];
  const capability=(!requestId && 'A secure launch identity is unavailable in this browser.') || catalogError || (!overview?.root ? 'No research workspace was selected.' : catalog ? atlasCrewCapabilities(atlasCrewServices(),catalog,draft.leadModel) : '');
  const locked=busy || !!problem?.startedRequest;
  const update=patch=>{if (locked) return;setDraft(d=>({...d,...patch}));setProblem(null);};
  const payload={...draft,extraAllowed:draft.extraAllowed.map(s=>s.trim()).filter(Boolean)};
  const saved=JSON.stringify(payload);
  useEffect(()=>{
    let current=true;setPreview(null);
    if (!opened || first || locked) return;
    const timer=setTimeout(()=>api('teams/preview',{method:'POST',body:{...payload,requestId},query:{expectedRoot:overview.root}},20).then(data=>{
      if(current)setPreview({key:saved,...data});
    },error=>{if(current)setPreview({key:saved,error:error.message});}),250);
    return ()=>{current=false;clearTimeout(timer);};
  },[saved,opened,first,locked,requestId]);
  const launch=async()=>{
    if (latch.current || locked || first || capability || !catalog) return;
    latch.current=true;setBusy(true);setProblem(null);
    try {const team=await atlasStartNativeTeam({root:overview.root,draft:payload,requestId}); if(live.current){flash?.('Brief delivered to the lead.');onStarted(team);}}
    catch(e){if(live.current)setProblem(e);} finally {if(live.current)setBusy(false);latch.current=false;}
  };
  const close=()=>{if(!latch.current)onClose();};
  const input=(name,label,extra={})=>h('label',{className:'atlas-crew-field'},h('span',null,label),h('textarea',{'aria-label':label,ref:name==='goal'?goalRef:undefined,rows:name==='goal'?3:2,maxLength:4000,value:draft[name],disabled:locked,onChange:e=>update({[name]:e.target.value}),onBlur:()=>setTouched(v=>({...v,[name]:true})),...extra}),touched[name]&&errors[name]&&h('small',{className:'atlas-crew-error'},errors[name]));
  const modifySeat=(i,patch)=>update({seats:draft.seats.map((s,j)=>i===j?{...s,...patch}:s)});
  const seatCard=(s,i)=>h('article',{key:i,className:'atlas-crew-card','aria-label':'Member '+(i+1)},
    h('div',{className:'atlas-crew-card-top'},h(Icon,{name:'team',size:16}),h('input',{ref:e=>{seatRefs.current[i]=e;},'aria-label':`Seat ${i+1} name`,value:s.name,disabled:locked,maxLength:32,onChange:e=>modifySeat(i,{name:e.target.value})}),h(IconButton,{label:`Remove ${s.name || 'member'}`,icon:'close',small:true,disabled:locked,onClick:()=>update({seats:draft.seats.filter((_,j)=>i!==j)})})),
    h('div',{className:'atlas-crew-pair'},h('select',{'aria-label':`Role for ${s.name}`,value:s.role,disabled:locked,onChange:e=>modifySeat(i,{role:e.target.value})},atlasCrewRoles.map(r=>h('option',{key:r,value:r},r))),
      h('select',{'aria-label':`Duration for ${s.name}`,value:s.mode,disabled:locked,onChange:e=>modifySeat(i,{mode:e.target.value})},h('option',{value:'core'},'Core'),h('option',{value:'one-shot'},'One-shot'))),
    s.role==='custom' && h('textarea',{'aria-label':`Role card for ${s.name}`,placeholder:'Responsibilities and write scope',value:s.roleCard || '',disabled:locked,onChange:e=>modifySeat(i,{roleCard:e.target.value})}),
    h('select',{'aria-label':`Model for ${s.name}`,disabled:true,title:'DSH verifies explicit child routes inside the lead session, not in the global model catalog.'},h('option',null,atlasInheritedRoute)),
    errors['seat'+i] && h('small',{className:'atlas-crew-error',role:'alert'},errors['seat'+i]));
  const count=draft.seats.length, templateNote=atlasCrewTemplateNote(draft), currentPreview=preview?.key===saved ? preview : null;
  const labelTopic=draft.topic?.title || 'Choose a topic';
  return h(Dialog,{title:'Assemble a team',wide:true,initialFocusRef:goalRef,className:'atlas-crew-sheet',onClose:close,footer:h(React.Fragment,null,
    h('span',{className:'atlas-crew-summary'},`The lead starts ${count} ${count===1?'member':'members'} and puts the work on the task board.`),h(Button,{quiet:true,disabled:busy,onClick:close},locked&&!busy?'Close':'Cancel'),
    problem?.team ? h(Button,{primary:true,onClick:()=>onStarted(problem.team)},'Open partial team') : h(Button,{primary:true,disabled:locked || !!first || !!capability || !catalog,onClick:launch},busy?'Starting…':'Start the team'))},
    h('div',{className:'atlas-crew-columns'},h('div',{className:'atlas-crew-form'},
      h('h3',null,'The question'),input('goal','What should the team find out?'),input('doneWhen','Done when'),
      h('label',{className:'atlas-crew-field'},'Topic',h('select',{'aria-label':'Topic',value:draft.topic?.id ?? '__choose__',disabled:locked,onChange:e=>{const t=overview.topics[e.target.value];update({topic:t ? {id:t.id,title:t.title,path:t.file}:null});},onBlur:()=>setTouched(x=>({...x,topic:true}))},
        h('option',{value:'__choose__'},'Choose a topic'),Object.values(overview?.topics || {}).filter(t=>t?.file).map(t=>h('option',{key:t.id,value:t.id},t.title || 'Research root'))),touched.topic && errors.topic&&h('small',{className:'atlas-crew-error'},errors.topic)),
      h('div',{className:'atlas-crew-field'},h('span',null,'Lead model'),h(AtlasModelPicker,{value:draft.leadModel,disabled:locked,onChange:choice=>update({leadModel:choice})})),
      !catalog && !catalogError && h('p',{role:'status'},'Checking DSH model routes…'),capability && h(Banner,{tone:'error'},'This DSH cannot run teams: '+capability,' ',h(Button,{small:true,quiet:true,onClick:()=>setCheck(v=>v+1)},'Check again')),
      h('h3',null,'Rules'),input('conventions','Conventions and assumptions'),
      h('fieldset',null,h('legend',null,'Ask me before'),['Any edit to a note','Any cluster job','Starting a new seat','Web downloads'].map((v,i)=>h('label',{key:v,className:'atlas-crew-check'},h('input',{type:'checkbox',checked:i<2 || draft.extraAsk.includes(v),disabled:locked || i<2,onChange:e=>update({extraAsk:e.target.checked?[...draft.extraAsk,v]:draft.extraAsk.filter(x=>x!==v)})}),v))),
      h('div',{className:'atlas-crew-field'},h('span',null,'Allowed files'),h('span',null,'Run folder only by default. Each substantive file has one writer. ',h(Button,{quiet:true,small:true,disabled:locked,onClick:()=>setEditFiles(!editFiles)},editFiles?'Done':'Edit')),
        editFiles && h('textarea',{'aria-label':'Additional allowed files',placeholder:'Additional allowed files, one per line',rows:2,value:draft.extraAllowed.join('\n'),onChange:e=>update({extraAllowed:e.target.value.split('\n')})})),
      h('div',{className:'atlas-crew-field'},h('span',null,'Inputs'),draft.inputs.map(p=>h('div',{key:p,className:'atlas-crew-input'},h('code',null,p),h(IconButton,{small:true,icon:'close',label:'Remove input '+p,disabled:locked,onClick:()=>update({inputs:draft.inputs.filter(x=>x!==p)})}))),
        h('button',{type:'button',ref:attachRef,className:'atlas-button is-small',disabled:locked,onClick:()=>setAttach(!attach)},'Attach files or papers'),attach && h(DeskAttach,{ov:overview,anchor:attachRef,onClose:()=>setAttach(false),onAttach:a=>{update({inputs:[...new Set([...draft.inputs,a.path])]});setAttach(false);}})),
      h('p',{className:'atlas-crew-path'},'Run folder: ',draft.topic ? dirOf(draft.topic.path)+'/runs/team-…' : labelTopic),
      problem && h(Banner,{tone:'error'},problem.message)),
    h('div',{className:'atlas-crew-side'},h('h3',null,'The crew'),h(TeamConstellation,{mode:'assembly',lead:{name:'lead',role:'Lead',model:draft.leadModel},seats:draft.seats,onSelect:seat=>seatRefs.current[draft.seats.findIndex(s=>s.name===seat.name)]?.focus()}),
      h('div',{className:'atlas-crew-presets',role:'group','aria-label':'Team template'},atlasCrewTemplates.map(([id,label])=>h('button',{key:id,type:'button','aria-pressed':draft.template===id && !templateNote,disabled:locked,onClick:()=>update({template:id,seats:atlasCrewFromTemplate(id)})},label))),
      templateNote && h('span',{className:'atlas-crew-hint',role:'status'},templateNote),
      draft.seats.map(seatCard),h(Button,{small:true,icon:'plus',disabled:locked || count>=16,onClick:()=>update({seats:[...draft.seats,atlasCrewSeat('theorist',draft.seats)]})},'Add a member'),
      h('p',{className:'atlas-crew-hint'},'Explicit seat models need authorization from this lead’s delegation policy. The DSH catalog only verifies lead routes; seats request no override.'),
      draft.seats.some(s=>s.role==='referee') && catalog?.groups?.length>1 && h('p',{className:'atlas-crew-hint'},'A referee on another provider can reduce shared blind spots, if the lead can verify permission.'),
      h('details',{onToggle:e=>setOpened(e.currentTarget.open)},h('summary',null,'Brief the lead will receive'),opened && (currentPreview?.brief ? h('pre',null,currentPreview.brief) : h('p',{role:'status'},first ? 'Complete the required fields to preview the exact brief.' : currentPreview?.error || 'Preparing the brief…'))))));
}

const ATLAS_TEAM_ASSEMBLY_CSS = `
.atlas-crew-sheet.atlas-control-dialog { width:min(900px,calc(100% - var(--s-32))); max-height:88%; }
.atlas-crew-sheet .atlas-control-dialog-body { padding:0; min-height:0; overflow:auto; }
.atlas-crew-columns { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,340px); }
.atlas-crew-form,.atlas-crew-side,.atlas-crew-field,.atlas-crew-card { display:flex; flex-direction:column; min-width:0; gap:var(--s-8); }
.atlas-crew-form,.atlas-crew-side { padding:var(--s-20) var(--s-24); gap:var(--s-12); }
.atlas-crew-side { background:var(--surface); border-left:1px solid var(--border); }
.atlas-crew-form h3,.atlas-crew-side h3 { margin:0; font:var(--t-body); font-weight:600; }
.atlas-crew-form fieldset { border:0; padding:0; margin:0; }
.atlas-crew-form legend,.atlas-crew-field>span:first-child { font:var(--t-ui); font-weight:500; }
.atlas-crew-check,.atlas-crew-card-top,.atlas-crew-input,.atlas-crew-pair,.atlas-crew-presets { display:flex; align-items:center; gap:var(--s-8); }
.atlas-crew-presets { flex-wrap:wrap; gap:var(--s-4); }
.atlas-crew-presets button { border:1px solid var(--border); border-radius:var(--r-full); padding:var(--s-4) var(--s-8); background:transparent; color:var(--text-2); font:var(--t-meta); cursor:pointer; }
.atlas-crew-presets button[aria-pressed=true] { color:var(--accent); border-color:var(--accent); background:var(--accent-soft); }
.atlas-crew-check { margin:var(--s-4) 0; }
.atlas-crew-card { background:var(--raised); border:1px solid var(--border); border-radius:var(--r-sm); padding:var(--s-8); }
.atlas-crew-card input,.atlas-crew-sheet textarea,.atlas-crew-sheet select { min-width:0; max-width:100%; width:100%; box-sizing:border-box; padding:var(--s-4) var(--s-8); background:var(--sunken); color:var(--text-1); border:1px solid var(--border-control); border-radius:var(--r-sm); font:inherit; }
.atlas-crew-sheet textarea { resize:vertical; }
.atlas-crew-sheet select { height:var(--control-32); }
.atlas-crew-summary { flex:1; text-align:left; font:var(--t-meta); color:var(--text-2); }
.atlas-crew-error { color:var(--danger-text); }
.atlas-crew-hint,.atlas-crew-path { margin:0; color:var(--text-3); font:var(--t-meta); }
.atlas-crew-hint { font-style:italic; } .atlas-crew-path,.atlas-crew-sheet pre { font-family:var(--font-mono); overflow-wrap:anywhere; }
.atlas-crew-sheet pre { white-space:pre-wrap; font:var(--t-meta); font-family:var(--font-mono); }
.atlas-crew-input code { flex:1; overflow-wrap:anywhere; }
@media(max-width:720px) { .atlas-crew-columns { grid-template-columns:minmax(0,1fr); } .atlas-crew-side { border-left:0; border-top:1px solid var(--border); } }
`;
