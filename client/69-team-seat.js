// Native seat conversations share the shell's six-session retention budget. Never
// mount a Chat composer from a stored (possibly stale) name/id pair alone.
function atlasSeatBinding(team,seatName,sessionId,scope) {
  if (!team || team.legacy || team.id!==tabTeamRecord(team.id,scope)?.id || !tabTeamMember({teamId:team.id,seatName,sessionId},scope)) return null;
  const lead=rowOf(scope.rows,team.leadId), row=rowOf(scope.rows,sessionId);
  if (!lead || parentOf(lead) || (seatName!=='lead' && parentOf(row) && parentOf(row)!==team.leadId)) return null;
  const seat=seatName==='lead'?{name:'lead',role:'lead',model:team.leadModel}:team.seats.find(s=>s.name===seatName);
  if (!seat) return null;
  const state=seatName==='lead'?{state:lead.running===true?'running':lead.running===false?'idle':'unknown'}:atlasTeamSeatStatus(team,seat,lead,Date.now(),scope.rows);
  if (seatName!=='lead' && state.id!==sessionId) return null;
  const last=row?.projectionValues?.modelSelection?.lastUsed;
  return { seat,state:state.state,error:state.error || '',model:last?.model || null,requestedModel:seat.model?.model || null };
}
function TeamMemberTab({team,seatName,sessionId,overview,scope,go,flash,visible,retained,onTeam,onOpenLink}) {
  const back=()=>onTeam?onTeam(team.id):go?.({view:'team',teamId:team.id});
  if (!team || team.legacy) return h(Empty,null,'Legacy team members are read-only. Inspect their state in the Team room.');
  const current=overview?.root && tabRootKey(overview.root)===tabRootKey(scope?.root) && atlasSeatBinding(team,seatName,sessionId,scope);
  if (!current) return h(Empty,null,'The current workspace and lead do not confirm this seat. No conversation is attached.');
  const info=current.model || (current.requestedModel?`Requested: ${current.requestedModel}`:'Model not yet reported');
  const openChat=()=>{const ui=svc('uiWorkspace');if(ui?.openSession)ui.openSession(sessionId);else flash?.('DSH chat navigation is unavailable.');};
  const click=e=>{
    if(e.button>0 || e.defaultPrevented) return;
    const link=conversationLink(e.target,overview.root);if(!link)return;
    if(link.url && !paperLink(link.url))return;
    if(!onOpenLink && !go)return;
    e.preventDefault();e.stopPropagation();if(onOpenLink)onOpenLink(link,e);else go(link.url?{view:'paper',url:link.url}:{view:'doc',path:link.path,anchor:link.anchor,link:true},e);
  };
  return h('aside',{className:'atlas-companion atlas-team-member-tab','aria-label':`Seat conversation: ${seatName}`},
    h('header',{className:'atlas-team-member-head'},h(SeatGlyph,{name:seatName,slot:1+Math.max(0,team.seats.findIndex(s=>s.name===seatName))%8}),
      h('div',null,h('h2',null,seatName),h('p',null,current.seat.role,' · ',info)),h('span',{className:'atlas-chip'},current.state),h(TextButton,{onClick:back,title:'Open Team room'},team.name)),
    current.error && h(Banner,{tone:'error'},current.error),retained ? h('div',{className:'atlas-companion-body',onClickCapture:click,'data-session-id':sessionId},h(EmbeddedConversation,{key:sessionId,sessionId,onOpenChat:openChat})) : h('p',{role:'status'},'This hidden conversation was released. Show the tab to reopen it.'));
}
function atlasSeatLeadGuard(team,scope,root,services) {
  if(!root || tabRootKey(root)!==tabRootKey(scope?.root) || !team || team.legacy || !team.leadId) return 'A native team with a lead in this workspace is required.';
  const saved=tabTeamRecord(team.id,scope);
  if(!saved || saved.legacy || saved.leadId!==team.leadId || !tabTeamMember({teamId:team.id,seatName:'lead',sessionId:team.leadId},scope))return 'The workspace no longer confirms this team and lead.';
  if(saved.ending||saved.closing)return 'The team is ending or has a closing report.';
  const lead=rowOf(scope.rows,team.leadId);
  if(scope.rows?.phase!=='ready' || !lead || parentOf(lead) || !teamOf(lead))return 'DSH has not confirmed Agent Teams on this lead.';
  if(!Array.isArray(lead.projectionValues?.subagentCatalog))return 'The live member catalog is unavailable; Atlas cannot check for a duplicate seat.';
  if(!services.sessions?.retain || !services.teams?.setEnabled)return 'Native DSH Agent Teams or session access is unavailable.';
  return '';
}
function atlasSeatNameError(team,scope,draft) {
  const name=String(draft.name || '').trim();
  if(!/^[a-z][a-z0-9-]{0,31}$/.test(name) || /^(?:lead|readme|con|prn|aux|nul|com[1-9]|lpt[1-9])$/.test(name))return 'Use a non-reserved seat name: 1–32 lowercase letters, digits or hyphens.';
  if(!atlasCrewRoles.includes(draft.role) || !['core','one-shot'].includes(draft.mode)) return 'Choose a role and a seat duration.';
  if(!draft.description?.trim() || draft.description.trim().length>1000)return 'Describe the first task in 1–1000 characters.';
  if((team.seats || []).some(s=>s.name===name) || rowOf(scope.rows,team.leadId)?.projectionValues?.subagentCatalog?.some(s=>s.name===name))return 'That name is already in the charter or the live team. Choose a different name.';
  return '';
}
// Two separate durable operations. Once the first response is uncertain or the call
// was submitted, never blindly repeat either. Replayed records are for inspection.
async function atlasAddTeamSeat(team,root,draft,deps) {
  let scope=deps.scope(); const denied=atlasSeatLeadGuard(team,scope,root,deps.services) || atlasSeatNameError(tabTeamRecord(team.id,scope),scope,draft);
  if(denied)throw new Error(denied);
  const seat={name:draft.name.trim(),role:draft.role,description:draft.description.trim(),mode:draft.mode,model:null};
  let result,call,sent=false;
  try {
    result=await deps.post('teams/'+encodeURIComponent(team.id)+'/seats',seat,{expectedRoot:root});
    if(result?.team?.id!==team.id || result.team.leadId!==team.leadId || !result.team.seats?.some(s=>s.name===seat.name))throw new Error('Atlas did not confirm the new seat on this team.');
    call=result.seatCall || result.call;
    if(call?.name!==seat.name || !call?.description?.trim() || !call?.prompt?.trim() || call.provider || call.model || call.reasoning_effort)throw new Error('The returned start call is missing, incomplete or has an unexpected model override.');
    if(result.replayed)return {team:result.team,seat,call,replayed:true,delivered:false};
    scope=deps.scope(); const changed=atlasSeatLeadGuard(team,scope,root,deps.services);
    if(changed)throw new Error(changed);
    if(rowOf(scope.rows,team.leadId).projectionValues.subagentCatalog.some(s=>s.name===seat.name))throw new Error('A member with this name has since appeared. The start call was not sent.');
    sent=true;
    await deps.send(team.leadId,`The researcher added a chartered seat. Check your current catalog first. If it is absent and your subagent tool is available, start it once using this exact call. Otherwise report why you did not start it.\nsubagent ${JSON.stringify(call)}`);
    return {team:result.team,seat,call,replayed:false,delivered:true};
  }catch(e){throw Object.assign(new Error(`${e.message} ${result?.team?.id===team.id ? 'The seat is recorded.' : 'The server outcome is unconfirmed; inspect the team before retrying.'} ${sent?'Delivery to the lead is unconfirmed.':'This attempt did not send the call to the lead.'}`),{attempted:true,team:result?.team?.id===team.id?result.team:null,call});}
}
function AddTeamSeatSheet({team,overview,scope,onClose,flash}) {
  const [draft,setDraft]=useState({name:'',role:'theorist',description:'',mode:'core'}), [busy,setBusy]=useState(false), [result,setResult]=useState(null),[error,setError]=useState(null);
  const lock=useRef(false),alive=useRef(true),latest=useRef(null), first=useRef(null);
  latest.current={team,scope,root:overview?.root};
  useEffect(()=>{alive.current=true;return ()=>{alive.current=false;};},[]);
  const services=atlasCrewServices();
  const gate=atlasSeatLeadGuard(team,scope,overview?.root,services);
  const invalid=gate || atlasSeatNameError(team,scope,draft);
  const update=(key,value)=>{setDraft(d=>({...d,[key]:value}));setError(null);};
  const locked=busy || !!result || !!error?.attempted;
  const submit=async e=>{
    e?.preventDefault();if(lock.current || invalid || locked)return;lock.current=true;setBusy(true);setError(null);
    const root=overview.root;
    try {
      const getScope=()=>alive.current&&latest.current.root===root&&latest.current.team?.id===team.id ? {...latest.current.scope,rows:services.sessions?.list?.getSnapshot?.() || latest.current.scope?.rows} : null;
      const verify=teamRoomScopeGuard(team,root,getScope);
      verify(team.leadId,'lead',services.sessions?.list?.getSnapshot?.());
      const out=await atlasAddTeamSeat(team,root,draft,{services,scope:getScope,
        post:(path,body,query)=>api(path,{method:'POST',body,query},20),send:(_leadId,text)=>teamRoomSend(team,'lead',text,services.sessions,verify)});
      if(!alive.current)return;recordTeamInIndex(root,out.team);setResult(out);
      if(out.delivered){flash?.('Seat recorded; the lead received its start request.');onClose?.(out);}
    }catch(e){if(alive.current){if(e.team)recordTeamInIndex(root,e.team);setError(e);}}
    finally{if(alive.current)setBusy(false);lock.current=false;}
  };
  const stop=()=>{if(!busy)onClose?.();};
  return h(Dialog,{title:'Add a seat',onClose:stop,initialFocusRef:first},h('form',{className:'atlas-team-seat-sheet',onSubmit:submit},
    h('p',null,'Atlas records the role card first. The lead, not Atlas, starts the member using its own available tools.'),
    h('label',null,'Seat name',h(Input,{inputRef:first,label:'Seat name',value:draft.name,disabled:locked,onChange:e=>update('name',e.target.value)})),
    h('label',null,'Role',h(Select,{label:'Seat role',value:draft.role,disabled:locked,options:atlasCrewRoles.map(value=>({value,label:value})),onChange:e=>update('role',e.target.value)})),
    h('label',null,'First task and responsibility',h('textarea',{'aria-label':'First task and responsibility',className:'atlas-control-input',rows:3,maxLength:1000,value:draft.description,disabled:locked,onChange:e=>update('description',e.target.value)})),
    h('label',null,'Duration',h(Select,{label:'Seat duration',value:draft.mode,disabled:locked,options:[{value:'core',label:'Core'},{value:'one-shot',label:'One-shot'}],onChange:e=>update('mode',e.target.value)})),
    h('p',{className:'atlas-muted'},'Model: Same as the lead (no override).'),
    gate && h(Banner,null,gate),!gate && draft.name && invalid && !locked && h('p',null,invalid),error && h(Banner,{tone:'error'},error.message),result?.replayed && h(Banner,null,'This seat was already recorded. No new message was sent. Inspect the lead before taking another action.'),
    (error?.call || result?.replayed) && h('details',null,h('summary',null,'Recorded call'),h('pre',null,'subagent '+JSON.stringify(error?.call || result.call,null,2))),
    h('div',{className:'atlas-actions'},h(Button,{type:'submit',primary:true,disabled:locked || !!invalid},busy?'Adding…':'Add seat'),h(Button,{type:'button',quiet:true,disabled:busy,onClick:stop},locked?'Close':'Cancel'))));
}
const ATLAS_TEAM_SEAT_CSS=`
.atlas-team-member-tab {display:flex;flex-direction:column;min-height:0;height:100%}.atlas-team-member-head {display:flex;gap:var(--s-12);align-items:center;padding:var(--s-8) var(--s-16);background:var(--surface);border-bottom:1px solid var(--border)}
.atlas-team-member-head h2,.atlas-team-member-head p {margin:0}.atlas-team-member-head h2{font:var(--t-h3)}.atlas-team-member-head p {color:var(--text-3);font:var(--t-meta)}.atlas-team-member-tab .atlas-companion-body{flex:1;min-height:0}.atlas-team-seat-sheet {display:grid;gap:var(--s-12)}.atlas-team-seat-sheet label {display:grid;gap:var(--s-4)}.atlas-team-seat-sheet pre {overflow:auto;max-height:25vh;white-space:pre-wrap}
`;
