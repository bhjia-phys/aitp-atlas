// Derived views only; neither a filename, an owner role nor a changed note proves authorship.
function teamReviewTaskTarget(task) {
  const explicit=task?.reviewOf;
  if(typeof explicit==='string' && /^R\d{2,8}$/.test(explicit))return explicit;
  // DSH tasks have ordinary subjects, not a review type. Accept a leading routing label
  // ("Review R03: Ward signs"), never an incidental mention somewhere in task prose.
  return /^review\s+(R\d{2,8})(?=$|[\s:—–-])/i.exec(task?.subject || '')?.[1].toUpperCase() || null;
}
function teamBoardGroups(tasks) {
  const out={ready:[],blocked:[],inProgress:[],done:[]};
  const byId=new Map((tasks||[]).map(t=>[t.id,t]));
  for(const t of tasks||[]){
    if(t.status==='completed')out.done.push(t);
    else if(t.status==='in_progress')out.inProgress.push(t);
    else if(t.status==='pending'){
      const blocked=(t.blockedBy||[]).some(id=>byId.get(id)?.status!=='completed');
      out[blocked?'blocked':'ready'].push(t);
    }
  }
  return out;
}
function teamFlowTime(v){if(typeof v==='number')return Number.isFinite(v)?v:0;return typeof v==='string'?(Date.parse(v)||0):0;}
function teamFlowRows(tasks,artifacts,noteRefs=[]) {
  const reports=artifacts?.reports||[], reviews=artifacts?.reviews||[], byTask=new Map(), checks=new Map(), reviewTasks=new Map(), counts=new Map();
  const add=(map,key,val)=>{if(!map.has(key))map.set(key,[]);map.get(key).push(val);};
  for(const r of reports){if(!r.formatted)continue;counts.set(r.id,(counts.get(r.id)||0)+1);if(r.task)add(byTask,r.task,r);}
  for(const r of reviews)if(r.formatted)add(checks,r.on,r);
  for(const t of tasks||[]){const target=teamReviewTaskTarget(t);if(target)add(reviewTasks,target,t);}
  const out=[], seenReports=new Set();
  const push=(task,report)=>{
    if(report)seenReports.add(report);
    const id=report?.formatted?report.id:null, ambiguous=!!id && counts.get(id)!==1;
    const matched=id&&!ambiguous?checks.get(id)||[]:[], rt=id&&!ambiguous?reviewTasks.get(id)||[]:[];
    const integrated=!!id && !ambiguous && report.status==='accepted'; // A recorded lead decision, not evidence of a note edit.
    // Only an explicit edit-id ↔ report-id association from the review owner is linkable.
    // In particular `{session, edits}` from GET needs supplies no such provenance.
    const notes=integrated?noteRefs.filter(n=>n?.reportId===id && typeof n.editId==='string' && n.editId.length && typeof n.path==='string' && n.path.length):[];
    const leadRouting=!!id&&!ambiguous&&report.status==='submitted'&&!matched.length&&!rt.length;
    const pendingReview=report?.status==='submitted' && (leadRouting||matched.length||rt.length);
    const stage=task?.status==='in_progress'?0:pendingReview?1:(integrated||task?.status==='completed')?3:2;
    const time=Math.max(teamFlowTime(task?.updatedAt),teamFlowTime(task?.createdAt),teamFlowTime(report?.mtimeMs),...matched.map(r=>teamFlowTime(r.mtimeMs)));
    const label=task?.subject || (report?.task?`Unknown task: ${report.task}`:'(no task)');
    out.push({key:JSON.stringify([task?.id||null,report?.path||id]),task,report,reviews:matched,reviewTasks:rt,leadRouting,integrated,noteRefs:notes,ambiguous,label,stage,time});
  };
  for(const t of tasks||[]){
    const target=teamReviewTaskTarget(t);
    // A dangling review task still belongs on the Board. Keep it visible in Flow as unmatched too.
    if(target && counts.get(target)===1)continue;
    const rs=byTask.get(t.id)||[];if(rs.length)rs.forEach(r=>push(t,r));else push(t,null);
  }
  for(const r of reports)if(!seenReports.has(r))push(null,r);
  return out.sort((a,b)=>a.stage-b.stage || b.time-a.time || a.key.localeCompare(b.key));
}
