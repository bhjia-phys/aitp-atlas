// One root-owned team registry. Old browser records are only migration input;
// neither the Discussions ack nor a host-wide list of sessions proves ownership.
const teamIndexInitial={root:'',records:[],projections:[],loading:true,error:'',migrationError:''};
const teamIndexStore=externalStore(teamIndexInitial), teamIndexRetry=externalStore(0);
let teamIndexEpoch=0,teamIndexRead=0;

function teamRootWitness(root,t,rows,workspaces) {
  if (!root || !t?.id) return false;
  const row=rowOf(rows,t.id), file=t.context?.topic?.path;
  if (file && !tabInside(root,file) || row?.cwd && !tabInside(root,row.cwd)) return false;
  const list=workspaces?.items;
  if (workspaces && !Array.isArray(workspaces) && (workspaces.phase!=='ready' || workspaces.state==='error' || !Array.isArray(list))) return false;
  const owners=list?.filter(w=>w.sessionIds?.includes(t.id));
  if (owners?.length) return owners.length===1 && tabRootKey(owners[0].path)===tabRootKey(root);
  const path=file || (rows?.phase==='ready' && row?.cwd);
  if (!path || !tabInside(root,path)) return false;
  const nearest=list?.filter(w=>tabInside(w.path,path)).sort((a,b)=>tabRootKey(b.path).length-tabRootKey(a.path).length)[0];
  return !nearest || tabRootKey(nearest.path)===tabRootKey(root);
}
function teamLegacyCandidates(legacy,root,rows,workspaces) {
  const seen=new Set();
  return (Array.isArray(legacy)?legacy:[]).filter(t=>t?.kind==='team' && !seen.has(t.id) && teamRootWitness(root,t,rows,workspaces) && seen.add(t.id));
}
function teamProjectionRecords(root,rows,workspaces) {
  if (rows?.phase!=='ready') return [];
  return Object.entries(rows.byId || {}).filter(([id,row])=>!parentOf(row) && !row.blank && !row.archived && teamOf(row) && teamRootWitness(root,{id},rows,workspaces)).map(([id,row])=>({id,leadId:id,name:row.displayTitle || row.title || 'Unnamed team',seats:[],legacy:true,projectionOnly:true,runDir:null}));
}
function teamIndexCombined(s) {
  const known=new Set(s.records.flatMap(t=>[t.id,t.leadId]));
  return [...s.records,...s.projections.filter(t=>!known.has(t.id))];
}
function lookupTeam(id,root) {
  const s=teamIndexStore.get();
  return (!root || s.root===root) && s.root ? teamIndexCombined(s).find(t=>t.id===id) || null : null;
}
function recordTeamInIndex(root,team) {
  const s=teamIndexStore.get();
  if (!root || s.root!==root || !team?.id) return;
  ++teamIndexRead; // A list already in flight mustn't undo this accepted edit.
  const old=s.records.find(t=>t.id===team.id);
  teamIndexStore.set({...s,records:[{...old,...team},...s.records.filter(t=>t.id!==team.id)]});
}
async function teamIndexRefresh(root=teamIndexStore.get().root) {
  if (!root || teamIndexStore.get().root!==root) return;
  const epoch=teamIndexEpoch,read=++teamIndexRead;
  try {
    const data=await api('teams',{query:{expectedRoot:root}});
    if (!data?.root || tabRootKey(data.root)!==tabRootKey(root)) {
      if(epoch===teamIndexEpoch && read===teamIndexRead) teamIndexStore.set({...teamIndexStore.get(),records:[],projections:[],loading:false,error:'The team index belongs to another workspace. Refresh the research desk.'});
      return;
    }
    if (!Array.isArray(data.teams)) throw new Error('The team index returned no list.');
    if (epoch===teamIndexEpoch && read===teamIndexRead) teamIndexStore.set({...teamIndexStore.get(),records:data.teams,loading:false,error:''});
  } catch(e) { if (epoch===teamIndexEpoch && read===teamIndexRead) teamIndexStore.set({...teamIndexStore.get(),...(e.status===409 ? {records:[],projections:[],error:'The research workspace changed. Refresh the research desk.'}:{error:e.message}),loading:false}); }
}
function useTeamIndexSnapshot(root) {
  const current=React.useSyncExternalStore(teamIndexStore.subscribe,teamIndexStore.get);
  const s=(root===undefined || current.root===root) ? current : teamIndexInitial;
  return useMemo(()=>({...s,records:teamIndexCombined(s),refresh:()=>{teamIndexRetry.set(teamIndexRetry.get()+1);return teamIndexRefresh(s.root);}}),[s]);
}
function useTeamIndex(root) {
  const rows=useSessionRows(), workspaces=useAtlasCatalog(svc('workspaces')?.list);
  const legacy=React.useSyncExternalStore(threadStore.subscribe,threadStore.get);
  const retry=React.useSyncExternalStore(teamIndexRetry.subscribe,teamIndexRetry.get);
  const candidates=teamLegacyCandidates(legacy,root,rows,workspaces), ids=JSON.stringify(candidates.map(t=>t.id));
  useEffect(()=>{
    ++teamIndexEpoch;teamIndexStore.set({...teamIndexInitial,root:root || ''});
    if (!root) return;
    teamIndexRefresh(root);
    const refresh=()=>{if(document.visibilityState!=='hidden')teamIndexRefresh(root);};
    const timer=setInterval(refresh,30000);window.addEventListener('focus',refresh);
    return ()=>{++teamIndexEpoch;clearInterval(timer);window.removeEventListener('focus',refresh);};
  },[root]);
  useEffect(()=>{
    if (root && root===teamIndexStore.get().root) teamIndexStore.set({...teamIndexStore.get(),projections:teamProjectionRecords(root,rows,workspaces)});
  },[root,rows,workspaces]);
  useEffect(()=>{
    if(!root || !candidates.length) return;
    const epoch=teamIndexEpoch,key='threads-imported:teams:'+encodeURIComponent(tabRootKey(root));
    const saved=storageGet(key,[]),ack=Array.isArray(saved)?saved:[];
    if(candidates.every(t=>ack.includes(t.id))) return;
    let live=true;const current=()=>live && epoch===teamIndexEpoch && teamIndexStore.get().root===root;
    registryImportLegacy(candidates,ack,body=>{
      if(!current()) throw new Error('The research workspace changed.');
      return api('teams/import',{method:'POST',query:{expectedRoot:root},body:{...body,expectedRoot:root}});
    },v=>{if(current())storageSet(key,v);}).then(errors=>{
      if(current())teamIndexStore.set({...teamIndexStore.get(),migrationError:errors.join('; ')});
    },e=>{if(current())teamIndexStore.set({...teamIndexStore.get(),migrationError:e.message});}).finally(()=>{if(current())teamIndexRefresh(root);});
    return ()=>{live=false;};
  },[root,ids,retry]);
  return useTeamIndexSnapshot(root || '');
}

// Team identity is the registry id, not the DSH lead id. Only registered seats
// and the lead's actual DSH projections contribute live status and task counts.
function teamIndexSummary(team,rows,needs) {
  const row=rowOf(rows,team.leadId), projection=projectionOf(row), catalog=projection.subagentCatalog;
  const members=(Array.isArray(catalog) && catalog.length ? catalog : Object.entries(rows?.byId || {}).filter(([,r])=>parentOf(r)===team.leadId && team.leadId).map(([id,r])=>({id,...projectionOf(r).subagent}))).map(m=>({...m,row:rowOf(rows,m.id)}));
  const tasks=teamOf(row)?.tasks, total=Array.isArray(tasks)?tasks.length:null, done=total===null?null:tasks.filter(t=>t.status==='completed').length;
  const working=!!row?.running || members.some(m=>m.row?.running);
  const decisions=Number.isInteger(team.counts?.openDecisions) ? team.counts.openDecisions : (needs?.decisions || []).filter(d=>d.teamId===team.id).length;
  const waiting=decisions>0 || (needs?.reviews || []).some(r=>r.session===team.leadId && r.edits>0);
  const isDone=Boolean(team.closing && rows?.phase==='ready' && row && !working || team.legacy && row?.archived);
  const present=new Set(members.map(m=>m.name).filter(Boolean));
  const starting=!team.legacy && (!team.leadId || (row && (team.seats || []).some(s=>!present.has(s.name))));
  const status=isDone ? 'Done' : waiting ? 'Waiting on you' : team.ending ? 'Ending' : team.paused ? 'Paused' : working ? 'Working' : starting ? 'Starting' : row ? 'Idle' : 'Live state unavailable';
  return {team,row,members,working,waiting,isDone,status,total,done,at:team.updated || team.created || 0};
}
function teamPlaceItems(records,rows,needs,filter='active') {
  const rank=v=>v.waiting?0:v.working?1:2;
  return records.map(t=>teamIndexSummary(t,rows,needs)).filter(v=>filter==='done'?v.isDone:!v.isDone && (!['waiting','needs'].includes(filter) || v.waiting) && (filter!=='running' || v.working)).sort((a,b)=>rank(a)-rank(b) || b.at-a.at || a.team.name.localeCompare(b.team.name));
}
function TeamsPlace({overview:ov,go,onAssemble,onTeam,filter='active'}) {
  const actions=React.useContext(AtlasActions), index=useTeamIndexSnapshot(ov.root), registry=useRegistrySnapshot(), rows=useSessionRows();
  const needs=registry.root===ov.root && !registry.needsError ? registry.needs:null;
  const selection=filter==='needs'?'waiting':filter || 'active', items=teamPlaceItems(index.records,rows,needs,selection);
  usePublishFocus({kind:'universe',topic:{id:'',title:ov.title || 'Root note',path:ov.rootFile}},[ov.rootFile,ov.title]);
  const assemble=onAssemble || actions.assembleTeam, open=onTeam || actions.openTeam;
  return h('div',{className:'atlas-page is-wide atlas-teams-place'},h('header',{className:'atlas-teams-heading'},h('div',null,h('p',{className:'atlas-kicker'},'Research desk'),h('h1',null,'Teams')),h(Button,{primary:true,icon:'plus',disabled:!assemble,onClick:()=>assemble({})},'New team')),
    h(Segmented,{label:'Filter teams',value:selection,options:[{value:'active',label:'Active'},{value:'waiting',label:'Waiting on you'},{value:'done',label:'Done'}],onChange:value=>go({view:'teams',filter:value})}),
    index.error || index.migrationError ? h(Banner,null,index.error || index.migrationError,' ',h(TextButton,{onClick:index.refresh},'Retry')):null,
    (index.records.some(t=>t.artifactError) || needs?.teamErrors?.length>0) ? h(Banner,null,'Some team artifacts could not be read. Waiting status may be incomplete. ',h(TextButton,{onClick:index.refresh},'Retry')):null,
    items.length ? h('ul',{className:'atlas-team-index'},items.map(({team,row,status,done,total,at,waiting,working,members})=>h('li',{key:team.id},h('button',{type:'button',className:'atlas-team-index-row','data-atlas-open':true,onClick:()=>open(team.id)},
      h(TeamConstellation,{mode:'thumbnail',lead:{name:'lead',running:!!row?.running},seats:team.legacy?members:team.seats || []}),h('span',{className:'atlas-team-index-name'},team.name),h('span',{className:'atlas-team-index-topic'},team.topic?.title || 'Unfiled'),team.legacy?h('span',{className:'atlas-team-index-chip'},'Legacy'):null,h('span',{className:cx('atlas-team-index-chip',waiting && 'is-waiting',working && 'is-working')},status),h('span',null,total===null?'Board unavailable':`${done} of ${total} tasks`), at?h('em',null,ago(at)):null)))):
      h(Empty,null,index.loading?'Reading teams…':index.error?'The team index could not be read.':selection==='waiting'?'No teams are waiting on you.':selection==='done'?'No finished teams.':'No active teams.'));
}
