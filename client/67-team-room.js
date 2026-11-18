// Team operations use exact DSH identities. A seat's name is not an address:
// require the declared seat and exactly one matching entry in THIS lead's live
// subagent catalog. Never send an unrouteable member message to the lead.
function teamRoomTarget(team, rows, seat = 'lead') {
  if (!team || team.legacy) throw new Error('Legacy teams are read-only.');
  const lead = rows?.byId?.[team.leadId];
  if (rows?.phase !== 'ready' || !lead || (lead.id && lead.id !== team.leadId) || lead.parentId || lead.archived || !lead.projectionValues?.agentTeam?.enabled || !team.leadId) throw new Error('The native team lead is not verified in DSH.');
  if (seat === 'lead') return team.leadId;
  if (!team.seats?.some(s => s.name === seat)) throw new Error('Unknown team member: @' + seat);
  const catalog = lead.projectionValues.subagentCatalog;
  const matches = Array.isArray(catalog) ? catalog.filter(c => c.name === seat) : [];
  const member = matches.length === 1 ? matches[0] : null;
  const child = member && rows.byId[member.id];
  if (!member?.id || member.id === team.leadId || member.phase === 'failed' || child?.archived || (child?.id && child.id !== member.id) || (child?.parentId && child.parentId !== team.leadId)) throw new Error('@' + seat + ' has no verified, available session in this team.');
  return member.id;
}
// Shared with AddTeamSeatSheet. Both snapshots are live at each check, not
// the scope that was captured when the user first opened the team's tab.
function teamRoomScopeGuard(team,root,getScope) {
  return (id,name,rows)=>{
    const scope=getScope?.(), teams=teamIndexStore.get(), workspaces=svc('workspaces')?.list?.getSnapshot?.();
    const current=teams?.records?.find(r=>r.id===team.id);
    if(!root || !scope || scope.root!==root || teams.root!==root || current?.legacy || current?.leadId!==team.leadId || workspaces?.phase!=='ready' || workspaces.state==='error' || !Array.isArray(workspaces.items)) throw new Error('The team or research workspace changed. Nothing was sent.');
    const owners=workspaces.items.filter(w=>w.sessionIds?.includes(team.leadId));
    const childOwners=id===team.leadId?[]:workspaces.items.filter(w=>w.sessionIds?.includes(id));
    if(owners.length!==1 || tabRootKey(owners[0].path)!==tabRootKey(root) || childOwners.length>1 || childOwners.some(w=>tabRootKey(w.path)!==tabRootKey(root)) || !tabTeamMember({teamId:team.id,seatName:name,sessionId:id},{...scope,rows,teams,workspaces})) throw new Error('Cannot verify this team in the current research workspace. Nothing was sent.');
  };
}
function teamRoomAddress(value) {
  const text = String(value || '').trim();
  if (!text) throw new Error('Write a message first.');
  if (!text.startsWith('@')) return { name: 'lead', text };
  const m = /^@([a-z][a-z0-9-]*)\s+([\s\S]+)$/u.exec(text);
  if (!m || m[2].startsWith('@')) throw new Error('Start with one @seat followed by your message.');
  return { name:m[1], text:m[2].trim() };
}
async function teamRoomSend(team, name, text, sessions, verify) {
  if (typeof sessions?.retain !== 'function' || !sessions.list?.getSnapshot) throw new Error('DSH session messaging is unavailable.');
  if (typeof verify !== 'function') throw new Error('Cannot verify the research workspace.');
  const resolve = () => {const rows=sessions.list.getSnapshot(), id=teamRoomTarget(team, rows, name);verify(id,name,rows);return id;};
  const id = resolve();
  const ref = sessions.retain(id, {source:'atlas'});
  try {
    const binding = await ref.ready;
    if (id !== resolve() || (ref.sessionId && ref.sessionId !== id) || typeof binding?.session?.prompt !== 'function') throw new Error('This team session changed; nothing was sent.');
    const result = await binding.session.prompt([{type:'text',text}], 'queue');
    if (result?.ok === false) throw new Error(result.error?.message || 'DSH did not accept the message.');
    return id;
  } finally { ref.release(); }
}
async function teamRoomAnswer(team, decision, choice, note, request, send) {
  if (!team || team.legacy || !decision?.formatted || decision.answerable === false || decision.status !== 'open' || !decision.revision || !Object.hasOwn(decision.options || {},choice)) throw new Error('Choose one of the options for this open decision.');
  const r = await request(`teams/${encodeURIComponent(team.id)}/decisions/${encodeURIComponent(decision.id)}/answer`, {method:'POST',body:{choice,note,revision:decision.revision}});
  if (r?.replayed === true) return 'This answer was already saved. No second message was sent.';
  if (r?.replayed !== false || !r.message) throw new Error('Answer response was incomplete. Check the decision file; no message was sent.');
  try { await send(r.message); } catch (e) { throw new Error(`Answer saved to ${decision.id}; delivery to the lead was not confirmed. ${e.message}`); }
  return `Answer saved to ${decision.id} and sent to the lead.`;
}
function teamRoomDiff(previous, next) {
  if (!previous || !next) return [];
  const out=[];
  for (const [key,value] of Object.entries(next)) {
    if (previous[key] === value) continue;
    const split=key.indexOf(':'), type=key.slice(0,split), id=key.slice(split+1);
    if (type === 'seat' && (!previous[key] || previous[key] === 'unknown' || value === 'unknown')) continue;
    out.push({ type, text:`${id}: ${value}`, ...(type==='seat'?{seat:id}:{taskId:id}), observed:true });
  }
  return out;
}
function teamRoomSnapshot(tasks, people) {
  return Object.fromEntries([...tasks.map(t=>['task:'+t.id,`${t.status}${t.owner ? ' · '+t.owner : ''}${t.blockedBy?.length?' · blocked by '+t.blockedBy.join(', '):''}`]),
    ...people.map(s=>['seat:'+s.name,s.state])]);
}
function teamRoomData(team, rows, artifacts, now) {
  const leadRow=rows?.byId?.[team.leadId], board=leadRow?.projectionValues?.agentTeam;
  const tasks=Array.isArray(board?.tasks) ? board.tasks : [];
  const reports=artifacts?.reports || [], reviews=artifacts?.reviews || [];
  const records = team.legacy ? membersOf(rows,team.leadId).map(m=>({name:m.name||m.role||m.id,role:m.role,legacyMember:m})) : (team.seats || []).filter(s=>s.name!=='lead');
  const make = (s, i) => {
    const taskList=tasks.filter(t=>t.owner===s.name), status = s.name==='lead' ? {state:!leadRow||typeof leadRow.running!=='boolean'?'unknown':leadRow.running?'running':'idle',id:team.leadId} : s.legacyMember ? {state:!s.legacyMember.row?'unknown':s.legacyMember.row.running?'running':'idle',id:s.legacyMember.id} : atlasTeamSeatStatus(team,s,leadRow,now,rows);
    let sessionId=null; try {sessionId=teamRoomTarget(team,rows,s.name);} catch { /* not addressable */ }
    return {...s,slot:i,state:status.state==='running'?'working':status.state, sessionId, error:status.error,
      task:taskList.find(t=>t.status==='in_progress')?.subject || '',total:taskList.length,done:taskList.filter(t=>t.status==='completed').length,
      reports:reports.filter(r=>r.formatted && r.seat===s.name).map(r=>r.id),reviews:reviews.filter(r=>r.formatted && r.seat===s.name).map(r=>r.id)};
  };
  const lead=make({name:'lead',role:'Lead',model:team.leadModel || null},0), seats=records.map((s,i)=>make(s,i+1));
  const flow=teamFlowRows(tasks,artifacts || {reports:[],reviews:[]});
  const paths=[];
  for (const line of flow) {
    const r=line.report;
    if (!r?.formatted || !r.seat || r.status!=='submitted') continue;
    const reviewing=(line.reviewTasks || []).filter(t=>t.status==='in_progress' && t.owner && t.owner!==r.seat);
    if (reviewing.length) for (const t of reviewing) paths.push({id:r.id,from:r.seat,to:t.owner,kind:'review'});
    else if (line.leadRouting) paths.push({id:r.id,from:r.seat,to:'lead',kind:'submitted'});
  }
  return {tasks,boardKnown:Array.isArray(board?.tasks),lead,seats,flow,paths};
}
function teamRoomState(team, people, decisions, editCount, closing) {
  if (team.legacy) return 'Legacy · read-only';
  if (closing && people[0]?.state === 'idle') return 'Done';
  if (team.ending) return 'Ending';
  if (decisions.length || editCount) return 'Waiting on you';
  if (team.paused) return 'Paused';
  if (people.some(s=>s.state==='working')) return 'Working';
  if (!team.leadId || people.some(s=>s.state==='starting' || s.state==='not-started')) return 'Starting';
  if (people.some(s=>s.state==='unknown')) return 'Status unavailable';
  return 'Idle';
}

function TeamRoomDecision({ decision:d, team, send, reload, flash, initiallyOpen, request }) {
  const [open,setOpen]=useState(!!initiallyOpen),[choice,pick]=useState(''),[note,setNote]=useState(''),[busy,setBusy]=useState(false),[error,fail]=useState('');
  const lock=useRef(false), trigger=useRef(null), first=useRef(null), group=React.useId();
  useEffect(()=>{if(open)first.current?.focus();},[open]);
  const close=()=>{setOpen(false);trigger.current?.focus();};
  const answer=async e=>{
    e.preventDefault(); if(lock.current || !choice) return; lock.current=true;setBusy(true); fail('');
    try { const message=await teamRoomAnswer(team,d,choice,note,request,send); flash(message);close(); }
    catch(e){fail(e.message);flash(e.message);} finally {lock.current=false;setBusy(false);reload();}
  };
  return h('div',{className:'atlas-room-need'},h('div',{className:'atlas-room-line'},h('span',null,d.question||d.title),h('button',{type:'button',ref:trigger,className:'atlas-button is-small',disabled:d.answerable===false,title:d.answerIssue||undefined,'aria-label':`Answer ${d.id}`,'aria-expanded':open,onClick:()=>setOpen(!open)},'Answer')),
    open && h('form',{onSubmit:answer},h('fieldset',{disabled:busy},h('legend',null,`${d.id} · Choose an option`),Object.entries(d.options||{}).map(([key,v],i)=>{
      const cmd=typeof v==='string' && /\b(?:sbatch|srun|qsub|bsub)\b[^\n]*/i.exec(v);
      return h('label',{key,className:'atlas-room-option'},h('input',{type:'radio',name:group,value:key,checked:choice===key,onChange:()=>pick(key),ref:i===0?first:undefined}),
        key+' · '+(cmd?v.slice(0,cmd.index).replace(/[\s—:-]+$/,''):v),key===d.recommendation && h(Chip,null,'Recommended'),cmd && h(React.Fragment,null,h(Chip,null,'Runs on the cluster'),h('code',null,cmd[0])));
    })),h('label',null,'Note (optional)',h('textarea',{value:note,disabled:busy,onChange:e=>setNote(e.target.value),rows:2})),
    error && h(Banner,{tone:'error'},error),h('div',{className:'atlas-room-line'},h(Button,{type:'submit',small:true,primary:true,disabled:busy||!choice},busy?'Saving…':'Save answer'),h(Button,{small:true,disabled:busy,onClick:close},'Cancel'))));
}

function TeamRoomLog({team, artifacts, decisions, send, reload, flash, openFile, onReview, edits, decisionId, missing=[], retry, request}) {
  const sections=artifacts?.state?.sections || {}, all=[...(artifacts?.reports||[]),...(artifacts?.reviews||[]),...(artifacts?.decisions||[])];
  const stateEntry=(entry,i)=>h('li',{key:i},entry.text,(entry.refs||[]).map(ref=>{const r=all.find(a=>a.formatted&&a.kind===ref.kind&&a.id===ref.id);return r?h(TextButton,{key:ref.id,onClick:()=>openFile(r.path)},ref.id):null;}));
  const fold=(title,entries,render,expanded=false)=>h('details',{key:title,open:expanded || undefined,className:'atlas-room-fold'},h('summary',null,title, h('i',null,String(entries.length))), entries.length?h('ul',null,entries.map(render)):h('p',null,'No entries.'));
  return h('div',{className:'atlas-room-log-content'},h('section',null,h('h3',null,'Needs you'),decisions.map(d=>h(TeamRoomDecision,{key:d.id,decision:d,team,send,request,reload,flash,initiallyOpen:decisionId===d.id})),
    edits>0 && h(Button,{small:true,onClick:onReview},`Review edits · ${edits}`),missing.map(s=>h(Button,{key:s.name,small:true,disabled:!retry,onClick:()=>retry(s)},`Ask the lead to start ${s.name}`)), !decisions.length&&!edits&&!missing.length && h('p',null,artifacts?'No open requests.':'Run artifacts unavailable.')),
    h('section',null,h('h3',null,'State of the question'),...['Established','Open','Conflicts','Next'].map(name=>fold(name,sections[name]||[],stateEntry,name==='Established'))),
    h('section',null,h('h3',null,'Artifacts'),...['reports','reviews','decisions'].map(key=>fold(key[0].toUpperCase()+key.slice(1),[...(artifacts?.[key]||[])].sort((a,b)=>b.mtimeMs-a.mtimeMs),(r,i)=>h('li',{key:r.path||i},h(TextButton,{onClick:()=>openFile(r.path)},`${r.id||'File'} · ${r.title}`),' ',r.verdict||r.status||(r.formatted?'':'Unformatted'))))),
    artifacts?.state?.path && h(TextButton,{onClick:()=>openFile(artifacts.state.path)},'Open state.md'),
    h('section',null,h('h3',null,'Charter'),h('p',null,'Done when: '+(artifacts?.charter?.doneWhen || team.doneWhen || 'Not recorded.')),artifacts?.charter?.path && h(TextButton,{onClick:()=>openFile(artifacts.charter.path)},'Open charter.md')));
}

function TeamRoomWork({view, data, artifacts, events, openFile}) {
  const artifact=(r)=>r && h('button',{type:'button',key:r.path,className:'atlas-room-cell',onClick:()=>openFile(r.path),title:r.title},h('code',null,r.id || 'File'),h('span',null,r.title),h('small',null,r.formatted ? r.verdict || r.status || 'No verdict' : 'Unformatted'));
  const table = (label,heads,rows) => h('table',{className:'atlas-room-table','aria-label':label},h('thead',null,h('tr',null,heads.map(k=>h('th',{key:k,scope:'col'},k)))),h('tbody',null,rows));
  if(view==='timeline') {
    const fileEvents=[...(artifacts?.reports||[]),...(artifacts?.reviews||[]),...(artifacts?.decisions||[])].filter(r=>r.mtimeMs).map(r=>({key:r.path,at:r.mtimeMs,seat:r.seat||r.from,text:`${r.id||r.title} · file updated`,path:r.path}));
    const timeline=[...events,...fileEvents].sort((a,b)=>b.at-a.at);
    return timeline.length?h('ol',{className:'atlas-room-events'},timeline.map((e,i)=>h('li',{key:e.key||e.id||i},h('time',{dateTime:new Date(e.at).toISOString()},new Date(e.at).toLocaleString()),e.seat && h(SeatGlyph,{name:e.seat}),e.path?h(TextButton,{onClick:()=>openFile(e.path)},e.text):e.text,e.observed && h('small',null,'observed')))):h(EmptyState,null,'No events observed yet.');
  }
  if(view==='board') {
    if(!data.boardKnown)return h(EmptyState,null,'The DSH board is unavailable.');
    if(!data.tasks.length)return h(EmptyState,null,'The lead has not added board tasks yet.');
    const groups=teamBoardGroups(data.tasks);
    return table('Team board',['Status','Task','Owner','Blocked by','Write scopes'],Object.entries({Ready:groups.ready,Blocked:groups.blocked,'In progress':groups.inProgress,Done:groups.done}).flatMap(([label,list])=>!list?.length?[]:[h('tr',{key:label},h('th',{colSpan:5,scope:'rowgroup'},label)),...list.map(t=>h('tr',{key:t.id},h('td',null,t.status),h('td',null,h('code',null,t.id),' ',t.subject),h('td',null,t.owner||'Unassigned'),h('td',null,t.blockedBy?.join(', ')||'—'),h('td',null,t.writeScopes?.join(', ')||'—',!!t.writeScopeWarnings?.length && h('small',null,' · Scope overlap'))))]));
  }
  if(!data.flow.length)return h(EmptyState,null,'No work lines yet. Flow links board tasks to reports by their recorded IDs.');
  const counts=[data.flow.filter(r=>r.task).length,data.flow.filter(r=>r.report).length,data.flow.filter(r=>r.reviews?.length||r.reviewTasks?.length).length,data.flow.filter(r=>r.integrated).length];
  const empty=s=>h('span',{className:'atlas-room-empty-cell'},s);
  return table('Work pipeline',['Work','Report','Review','Integrated'].map((s,i)=>`${s} · ${counts[i]}`),data.flow.map(line=>h('tr',{key:line.key},
    h('td',null,line.task?h('div',{className:'atlas-room-task'},h(SeatGlyph,{name:line.task.owner}),h('span',null,line.task.subject,h('small',null,line.task.id+' · '+line.task.status))):empty('(no task)')),
    h('td',null,artifact(line.report)||empty('Not yet')),h('td',null,line.reviews?.length?line.reviews.map(artifact):line.reviewTasks?.length?line.reviewTasks.map(t=>h('span',{key:t.id},t.id+' · '+t.status)):empty(line.leadRouting?'Lead routing':'—')),
    h('td',null,line.integrated?h('span',{className:'atlas-room-cell'},'Accepted',!!line.noteRefs?.length && h('small',null,line.noteRefs.length+' linked edits')):empty('—')))));
}

function TeamRoom({teamId, team:provided, scope, overview, visible=true, section, decisionId, go, flash, onMember, onAddSeat}) {
  const index=useTeamIndexSnapshot(overview?.root), rows=useSessionRows();
  const team=index.records?.find(r=>r.id===teamId) || provided;
  if(!team || team.id!==teamId)return h(EmptyState,null,index.loading?'Loading team…':index.error||'Team unavailable in this workspace.');
  return h(TeamRoomSurface,{key:team.id,team,scope,rows,root:overview?.root,visible,section,decisionId,go,flash,onMember,onAddSeat});
}
function TeamRoomSurface({team,scope,rows,root,visible,section,decisionId,go,flash,onMember,onAddSeat}) {
  const scopeRef=useRef(scope);scopeRef.current=scope;
  const verify=teamRoomScopeGuard(team,root,()=>scopeRef.current);
  const request=(endpoint,opts={})=>api(endpoint,{...opts,query:{...opts.query,expectedRoot:root}},opts.method && opts.method!=='GET'?20:0);
  const [artifacts,setArtifacts]=useState(null),[events,setEvents]=useState([]),[error,fail]=useState('');
  const [version,bump]=useState(0),[now,tick]=useState(Date.now),[view,setView]=useState(team.legacy?'board':team.view||'flow');
  const [overlay,show]=useState(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const [logRequested,setLog]=useState(false),[narrow,setNarrow]=useState(false);
  const ref=useRef(null), text=useRef(null), menuButton=useRef(null), lock=useRef(false), prev=useRef(null), lastRunning=useRef(null);
  const needs=useRegistrySnapshot().needs, path=`teams/${encodeURIComponent(team.id)}`;
  const edits=(needs?.reviews || []).find(r=>r.session===team.leadId)?.edits || 0;
  const data=teamRoomData(team,rows,artifacts,now), people=[data.lead,...data.seats], decisions=(artifacts?.decisions||[]).filter(d=>d.formatted&&d.status==='open');
  const state=teamRoomState(team,people,decisions,edits,team.closing), writable=!team.legacy && state!=='Done';
  const refresh=()=>bump(v=>v+1);
  useEffect(()=>{const el=ref.current; if(!el)return; const size=()=>setNarrow(el.clientWidth<1040);size();const ro=typeof ResizeObserver==='function'&&new ResizeObserver(size);if(ro)ro.observe(el);return()=>ro&&ro.disconnect();},[]);
  useEffect(()=>{if(section==='logbook'||decisionId)setLog(true);},[section,decisionId]);
  useEffect(()=>{if(!visible||team.legacy) return;const timer=setInterval(()=>{if(document.visibilityState!=='hidden'){tick(Date.now());refresh();}},20000);return()=>clearInterval(timer);},[visible,team.legacy]);
  useEffect(()=>{
    if(!visible||team.legacy)return; let live=true;
    Promise.all([request(path+'/artifacts'),request(path+'/events')]).then(([a,e])=>{if(live){setArtifacts(a);setEvents(e.events||[]);fail('');tick(Date.now());}},e=>live&&fail(e.message));
    return()=>{live=false;};
  },[path,version,visible,team.legacy]);
  const runningKey=JSON.stringify(people.filter(s=>s.state==='working').map(s=>s.name).sort());
  useEffect(()=>{const next=JSON.parse(runningKey), before=lastRunning.current;lastRunning.current=visible?next:null;
    if(!team.legacy&&visible&&before?.some(s=>!next.includes(s)))refresh();},[runningKey,visible,team.legacy]);
  const observation=JSON.stringify(teamRoomSnapshot(data.tasks,people));
  useEffect(()=>{
    if(team.legacy||!visible||!data.boardKnown){prev.current=null;return;}
    const next=JSON.parse(observation), changes=teamRoomDiff(prev.current,next);prev.current=next;
    if(changes.length)request(path+'/events',{method:'POST',body:{events:changes}}).then(refresh,e=>fail('Could not save observed events: '+e.message));
  },[observation,visible,team.legacy,data.boardKnown,path]);
  const sessions=svc('sessions'),send=(name,value)=>teamRoomSend(team,name,value,sessions,verify);
  const patch=async fields=>{const r=await request(path,{method:'PATCH',body:fields}); recordTeamInIndex(root,r.team);};
  const work=async f=>{if(lock.current)return;lock.current=true;setBusy(true);try{await f();}catch(e){fail(e.message);flash(e.message);}finally{lock.current=false;setBusy(false);}};
  const chooseView=v=>{setView(v);if(!team.legacy)patch({view:v}).catch(e=>flash('Could not save view: '+e.message));};
  const openFile=p=>{if(p)go({view:'doc',path:p,link:true},{otherPane:true});};
  const openSeat=s=>{try{const live=sessions?.list?.getSnapshot(),id=teamRoomTarget(team,live,s.name);verify(id,s.name,live);onMember?.(id,s.name);}catch(e){flash(e.message);}};
  const leadRequest=(prompt,fields,receipt)=>work(async()=>{await send('lead',prompt);try{await patch(fields);}catch(e){throw new Error(`Request sent, but Atlas could not save its status: ${e.message}`);}flash(receipt);});
  const compose=(name)=>{setMessage(name==='lead'?'':`@${name} `);text.current?.focus();};
  const post=()=>work(async()=>{const dest=teamRoomAddress(message);await send(dest.name,dest.text);setMessage('');flash(`Sent to ${dest.name}.`);
    try{await request(path+'/events',{method:'POST',body:{events:[{type:'message',seat:dest.name,text:`You → ${dest.name}`}]}});refresh();}catch(e){throw new Error('Message sent. Could not record the Timeline event: '+e.message);}});
  const retry=seat=>work(async()=>{
    const call=team.seatCalls?.find(c=>c.name===seat.name);
    if(!call)throw new Error('The exact seat start call is unavailable. Open the charter instead.');
    await teamRoomSend(team,'lead',`Check your subagent catalog. Only if ${seat.name} is still absent, start it using this exact subagent call: ${JSON.stringify(call)}. Do not duplicate a seat.`,sessions,(id,name,fresh)=>{verify(id,name,fresh);if(atlasTeamSeatStatus(team,seat,fresh.byId[team.leadId],Date.now(),fresh).state!=='not-started')throw new Error('The seat is no longer verified as missing. Nothing was sent.');});
    flash(`Asked the lead to start ${seat.name}.`);
  });
  const canLead=!!data.lead.sessionId && writable;
  const answerRequest=(endpoint,opts)=>{const live=sessions?.list?.getSnapshot?.();const id=teamRoomTarget(team,live,'lead');verify(id,'lead',live);return request(endpoint,opts);};
  const log=h(TeamRoomLog,{request:answerRequest,team,artifacts,decisions,edits,send:s=>send('lead',s),reload:()=>{refresh();teamIndexRefresh(root);registryRefresh();},flash,openFile,onReview:()=>show('review'),decisionId,missing:data.seats.filter(s=>s.state==='not-started'),retry:canLead?retry:null});
  const files=[artifacts?.charter,artifacts?.state,...(artifacts?.reports||[]),...(artifacts?.reviews||[]),...(artifacts?.decisions||[])].filter(r=>r?.path);
  const menu=[{id:'charter',label:'Open charter',disabled:!artifacts?.charter?.path,onSelect:()=>openFile(artifacts.charter.path)},
    {id:'state',label:'Open state.md',disabled:!artifacts?.state?.path,onSelect:()=>openFile(artifacts.state.path)},
    {id:'run',label:'Run files…',disabled:!team.runDir,onSelect:()=>show('files')},
    {id:'lead',label:'Open lead conversation',disabled:!data.lead.sessionId||team.legacy,onSelect:()=>openSeat(data.lead)},
    {id:'topic',label:'Open topic',disabled:!team.topic?.path,onSelect:()=>openFile(team.topic.path)},
    {id:'review',label:'Review edits',disabled:!team.leadId||team.legacy,onSelect:()=>show('review')},
    {id:'refresh',label:'Read run artifacts again',disabled:team.legacy,onSelect:refresh},
    {id:'add',label:'Add a seat',disabled:!canLead || !onAddSeat,onSelect:()=>onAddSeat(team)},
    {id:'end',label:'End the team',disabled:!canLead || team.ending,onSelect:()=>show('end')}];
  const mention=/^@([a-z0-9-]*)$/i.exec(message), mentions=mention?[data.lead,...data.seats].filter(s=>s.name.startsWith(mention[1])):[];
  let destination='lead';try{destination=teamRoomAddress(message).name;}catch{if(message.startsWith('@'))destination='choose a seat';}
  const needsCount=decisions.length+edits+data.seats.filter(s=>s.state==='not-started').length;
  const completed=data.tasks.filter(t=>t.status==='completed').length;
  return h('div',{ref,className:'atlas-team-room','aria-label':'Team room'},h('div',{className:'atlas-room-main'},
    h('div',{className:'atlas-room-band'},h(TeamConstellation,{lead:data.lead,seats:data.seats,paths:data.paths,onOpen:team.legacy?undefined:openSeat,onMessage:writable?s=>compose(s.name):undefined,onAskStart:canLead?retry:undefined}),
      h('section',{className:'atlas-room-mission'},h('span',{className:'atlas-room-cap'},(team.topic?.title||'Workspace')+' · Team'),h('h2',null,team.name),h('p',null,team.goal||artifacts?.charter?.goal),
        h('div',{className:'atlas-room-line'},h(Chip,null,state),team.created && h('time',{dateTime:new Date(team.created).toISOString()},'Started '+ago(team.created))),
        h('div',{className:'atlas-room-line'},data.boardKnown && data.tasks.length>0 && h('progress',{max:data.tasks.length,value:completed,'aria-label':'Board task completion'}),h('small',null,data.boardKnown?`${completed} of ${data.tasks.length} tasks done`:'Board unavailable')),
        h('div',{className:'atlas-room-line'},!team.legacy && h(Button,{small:true,primary:true,disabled:!canLead,onClick:()=>compose('lead')},'Message team'),
          !team.legacy && h(Button,{small:true,disabled:busy||!canLead||team.ending,onClick:()=>team.paused?leadRequest('Resume work from state.md Next.',{paused:false},'Asked the team to resume.'):leadRequest('Please finish current steps, start nothing new, and report the state in state.md.',{paused:true},'Asked the team to pause.')},team.paused?'Resume':'Ask to pause'),
          narrow&&!team.legacy&&h(Button,{small:true,onClick:()=>setLog(true)},`Logbook${needsCount?' · '+needsCount:''}`),
          h(IconButton,{small:true,label:'Team options',icon:'more',buttonRef:menuButton,'aria-haspopup':'menu',onClick:()=>show('menu')})))),
    (artifacts?.errors||[]).map((issue,i)=>h(Banner,{key:i,tone:'error'},`${issue.area}${issue.file?' / '+issue.file:''}: ${issue.message}`)),error && h(Banner,{tone:'error'},error),team.legacy && h(Banner,null,'Legacy team · Board and roster are read-only; no run directory is available.'),
    h('div',{className:'atlas-room-views'},h(Segmented,{label:'Team view',value:view,onChange:chooseView,options:(team.legacy?['board']:['flow','board','timeline']).map(v=>({value:v,label:v[0].toUpperCase()+v.slice(1)}))})),
    h('div',{className:'atlas-room-center'},h(TeamRoomWork,{view,data,artifacts,events,openFile})),
    !team.legacy && h('form',{className:'atlas-room-composer',onSubmit:e=>{e.preventDefault();post();}},h('textarea',{ref:text,value:message,onChange:e=>setMessage(e.target.value),rows:1,'aria-label':'Message the team',placeholder:'Message the team, or @a seat…',disabled:busy||!writable,onKeyDown:e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent?.isComposing){e.preventDefault();if(message.trim())post();}}}),
      mentions.length>0 && h('div',{className:'atlas-room-line','aria-label':'Team members'},mentions.map(s=>h(Button,{key:s.name,small:true,onClick:()=>compose(s.name)},'@'+s.name))),
      h('div',{className:'atlas-room-line'},h('small',null,'Goes to '+destination),h(Button,{primary:true,type:'submit',disabled:busy||!writable||!message.trim()},'Send')))),
    !narrow&&!team.legacy && h('aside',{className:'atlas-room-log','aria-label':'Logbook'},log),
    narrow&&logRequested&&!team.legacy && h(Dialog,{title:'Logbook',className:'atlas-room-log-dialog',onClose:()=>setLog(false)},log),
    overlay==='menu'&&h(Menu,{anchor:menuButton,label:'Team options',onClose:()=>show(null),items:menu}),
    overlay==='files'&&h(Dialog,{title:'Run files',onClose:()=>show(null)},h('p',null,'Files indexed for this run:'),files.map(r=>h('p',{key:r.path},h(TextButton,{onClick:()=>{show(null);openFile(r.path);}},r.title||baseName(r.path)))),h('code',null,team.runDir),h(Button,{small:true,onClick:()=>work(async()=>{await navigator.clipboard.writeText(team.runDir);flash('Run folder path copied.');})},'Copy folder path')),
    overlay==='review'&&!team.legacy&&h(Dialog,{title:'Lead note edits',onClose:()=>show(null)},h('p',null,'Compare with the lead’s saved baseline. Changes are not automatically attributed to the team.'),h(ReviewPanel,{sessionId:team.leadId,running:data.lead.state==='working',flash,expectedRoot:root,verifyOwner:()=>verify(team.leadId,'lead',sessions.list.getSnapshot())})),
    overlay==='end'&&h(Dialog,{title:'Ask the team to end?',onClose:()=>show(null),footer:h(Button,{primary:true,onClick:()=>{show(null);leadRequest('Write the closing report and ask all members to finish; update state.md with remaining questions.',{ending:true},'Asked the lead for a closing report.');}},'Ask the lead to end')},h('p',null,'The lead will be asked to wrap up. Atlas does not force-stop agents.')));
}

const ATLAS_TEAM_ROOM_CSS = `
.atlas-team-room{height:100%;min-height:0;position:relative;display:flex;container-type:inline-size;color:var(--text-1);background:var(--surface)}.atlas-room-main{flex:1;min-width:0;min-height:0;display:flex;flex-direction:column}.atlas-room-band{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);align-items:center;gap:var(--s-8);padding:var(--s-4) var(--s-20) 0 var(--s-8);border-bottom:1px solid var(--border)}
.atlas-room-mission{padding:var(--s-8) var(--s-8) var(--s-16) 0;display:flex;flex-direction:column;gap:var(--s-8);min-width:0}.atlas-room-mission h2{margin:0;font:600 26px/32px var(--font-serif)}.atlas-room-mission p{margin:0;font:italic 16px/24px var(--font-serif);color:var(--text-2)}.atlas-room-cap,.atlas-room-log-content h3{font:var(--t-cap);font-variant-caps:all-small-caps;letter-spacing:.1em;color:var(--text-2)}.atlas-room-line{display:flex;align-items:center;flex-wrap:wrap;gap:var(--s-8)}.atlas-team-room progress{height:var(--s-8);accent-color:var(--accent)}
.atlas-room-views{padding:var(--s-8) var(--s-20)}.atlas-room-center{overflow:auto;min-height:0;flex:1;padding:0 var(--s-20) var(--s-8)}.atlas-room-table{width:100%;border-collapse:collapse;font:var(--t-ui)}.atlas-room-table th,.atlas-room-table td{text-align:start;padding:var(--s-8) var(--s-4);border-bottom:1px solid var(--border);vertical-align:middle}.atlas-room-table th{font:var(--t-cap);font-variant-caps:all-small-caps;letter-spacing:.08em}.atlas-room-table td:first-child{min-width:120px}.atlas-room-table thead th{position:sticky;top:0;background:var(--surface);z-index:1}.atlas-room-table small{display:block}.atlas-room-task{display:flex;gap:var(--s-8)}.atlas-room-cell,.atlas-room-empty-cell{min-width:72px;display:flex;flex-direction:column;gap:var(--s-4);padding:var(--s-8);border:1px solid var(--border);border-radius:var(--r-sm);background:var(--raised);color:var(--text-1);font:var(--t-ui);text-align:start}.atlas-room-empty-cell{border-style:dashed;background:transparent;color:var(--text-3);font:var(--t-count)}button.atlas-room-cell{cursor:pointer}.atlas-room-events{list-style:none;padding:0}.atlas-room-events li{display:flex;align-items:baseline;gap:var(--s-8);padding:var(--s-8) 0;border-bottom:1px solid var(--border)}.atlas-room-events time,.atlas-team-room small{font:var(--t-meta);color:var(--text-3)}
.atlas-room-log{width:300px;box-sizing:border-box;flex:none;overflow:auto;padding:var(--s-20);border-left:1px solid var(--border)}.atlas-room-log-content{display:flex;flex-direction:column;gap:var(--s-20)}.atlas-room-log-content h3{font-weight:600;margin:0 0 var(--s-8)}.atlas-room-fold summary{cursor:pointer;padding:var(--s-4) 0;border-bottom:1px solid var(--border);font:var(--t-ui)}.atlas-room-fold summary i{float:right;color:var(--text-3);font:var(--t-count)}.atlas-room-fold ul{list-style:none;padding:0;margin:var(--s-4) 0}.atlas-room-fold li{padding:var(--s-4) 0;font:14px/20px var(--font-serif)}.atlas-room-fold li button{margin-inline-start:var(--s-4)}.atlas-room-need{padding:var(--s-8);margin:var(--s-4) 0;background:var(--gold-soft);border-radius:var(--r-md);font:var(--t-ui)}.atlas-room-need fieldset{border:0;padding:0}.atlas-room-option{display:block;margin:var(--s-8) 0}.atlas-room-option code{display:block;overflow-wrap:anywhere}.atlas-room-need textarea,.atlas-room-composer textarea{width:100%;box-sizing:border-box;background:var(--raised);color:var(--text-1);border:1px solid var(--border-control);font:var(--t-ui);border-radius:var(--r-sm);padding:var(--s-8)}
.atlas-room-composer{margin:var(--s-8) var(--s-20) var(--s-16);padding:var(--s-8) var(--s-12);border:1px solid var(--border-strong);border-radius:var(--r-md);box-shadow:var(--shadow-1);background:var(--raised)}.atlas-room-composer textarea{border:0;resize:vertical;max-height:80px}.atlas-room-composer>.atlas-room-line:last-child{justify-content:space-between}.atlas-room-log-dialog{margin-inline-start:auto}
@container (max-width:759px){.atlas-room-band{grid-template-columns:minmax(0,1fr)}.atlas-room-mission{padding:0 var(--s-8) var(--s-8)}.atlas-room-main{overflow:auto}.atlas-room-center{min-height:180px;flex:auto}.atlas-room-band,.atlas-room-composer{flex:none}}
`;
