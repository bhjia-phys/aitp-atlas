// Atlas describes DSH teams; it never starts a session, runs a command or infers authorship here.
import path from 'node:path';
import os from 'node:os';
import { promises as fs, constants } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { fileKey, isWithin } from './fsutil.js';
import { validateTeamDraft, renderTeamKit, TEAM_PRESETS } from './team-templates.js';
import { createDiscussions } from './discussions.js';
import { parseTeamArtifact, parseTeamState, parseTeamCharter } from './team-artifacts.js';

const hash = s => createHash('sha256').update(s).digest('hex');
const err = (statusCode,message) => Object.assign(new Error(message), { statusCode, code:({400:'INVALID_TEAM',403:'TEAM_SCOPE',404:'NOT_FOUND',409:'TEAM_CONFLICT',413:'TEAM_LIMIT'})[statusCode] || 'TEAM_ERROR' });
const validId = (id) => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,120}$/.test(id);
const idOf = id => { if (!validId(id) || ['import','preview','templates'].includes(id)) throw err(400,'Invalid team or session identifier.'); return id; };
const string = (s,max) => { if (typeof s !== 'string' || s.length>max || s.includes('\0')) throw err(400,'Invalid or oversized text field.'); return s.trim(); };
const object = v => { if (!v || typeof v !== 'object' || Array.isArray(v)) throw err(400,'Expected a JSON object.'); return v; };
const dateOf = n => new Date(n).toISOString().slice(0,10);
const absent = e => e.code==='ENOENT';
const serializers = new Map();
async function serial(key,fn) {
  const prev = serializers.get(key) || Promise.resolve(), result = prev.then(fn), tail = result.catch(()=>{});
  serializers.set(key,tail); try {return await result;} finally {if (serializers.get(key)===tail) serializers.delete(key);}
}
// Walk every component: no symlink or junction at any depth, including configured roots.
// Never resolve a relative name from a URL or from agent-authored Markdown.
async function checked(target, kind='dir') {
  const abs = path.resolve(target), start = path.parse(abs).root;
  let current=start, st;
  for (const segment of abs.slice(start.length).split(path.sep).filter(Boolean)) {
    current=path.join(current,segment); st=await fs.lstat(current);
    if (st.isSymbolicLink() || (current!==abs && !st.isDirectory())) throw err(403,'A linked or non-directory path component is not allowed.');
  }
  st ||= await fs.lstat(abs);
  if ((kind==='dir' ? !st.isDirectory() : !st.isFile() || st.nlink!==1) || fileKey(await fs.realpath(abs))!==fileKey(abs)) throw err(403,'Unsafe file type, linked path or shared file.');
  return st;
}
async function ensureDir(dir) {
  try {await checked(dir);return;} catch(e){if(!absent(e))throw e;}
  await ensureDir(path.dirname(dir)); try {await fs.mkdir(dir,{mode:0o700});} catch(e){if(e.code!=='EEXIST')throw e;} await checked(dir);
}
async function readSafe(file,limit) {
  const st=await checked(file,'file'); if(st.size>limit)throw err(413,'File exceeds the team read limit.');
  const fh=await fs.open(file,constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
  try {
    const stat=await fh.stat(); if(stat.dev!==st.dev || stat.ino!==st.ino || !stat.isFile() || stat.nlink!==1 || stat.size>limit) throw err(409,'File changed during read.');
    // Bound allocation even if another process grows the file after stat.
    const buf=Buffer.alloc(stat.size+1); let used=0;
    while(used<buf.length){const {bytesRead}=await fh.read(buf,used,buf.length-used,used); if(!bytesRead)break;used+=bytesRead;}
    if(used!==stat.size || (await fh.stat()).mtimeMs!==stat.mtimeMs)throw err(409,'File changed during read.');
    return {text:buf.toString('utf8',0,used),mtimeMs:stat.mtimeMs,size:used};
  } finally {await fh.close();}
}
async function exclusiveFile(file,text) {
  await checked(path.dirname(file)); const fh=await fs.open(file,'wx',0o600);
  try {await fh.writeFile(text); await fh.sync();} finally {await fh.close();}
}
async function replaceChecked(file,text,guard) {
  const tmp=path.join(path.dirname(file),`.atlas-${randomUUID()}.tmp`);
  await exclusiveFile(tmp,text);
  try {await checked(path.dirname(file)); await guard(); await fs.rename(tmp,file);} finally {await fs.rm(tmp,{force:true});}
}
function topicOf(atlas,v) {
  const t=atlas.topics.get(typeof v==='string'? v : object(v).id);
  if(!t || !isWithin(atlas.root,t.file) || (v?.path && (typeof v.path!=='string' || fileKey(v.path)!==fileKey(t.file)))) throw err(403,'The topic does not belong to this research root.');
  return {id:t.id,path:t.file,title:t.title};
}
function compatibleRun(atlas,t) {
  const topic=topicOf(atlas,t.topic), base=path.join(path.dirname(topic.path),'runs');
  if (typeof t.runDir!=='string' || fileKey(path.dirname(t.runDir))!==fileKey(base) || !/^team-\d{8}-[a-z0-9-]+$/.test(path.basename(t.runDir))) throw err(403,'The team run does not belong to the registered topic.');
  return t.runDir;
}
function publicTeam(t) { const {requestId,fingerprint,draft,...publicFields}=t; return publicFields; }
function find(rows,id) { const t=rows.find(x=>x.id===idOf(id)); if(!t)throw err(404,'No such team in this workspace.'); return t; }
function writable(t){if(t.legacy)throw err(403,'Imported teams are read-only.');}
const blankCounts=()=>({reports:0,reviews:0,decisions:0,openDecisions:0});
const kinds=[['reports','report'],['reviews','review'],['decisions','decision']];
// Each folder gets its own bound: a large report must not consume a decision's budget.
// Never emit an open-able path for an unreadable/unsafe entry. Keep verified siblings visible.
async function scanArtifacts(atlas,t,{decisionsOnly=false}={}) {
  const out={reports:[],reviews:[],decisions:[],state:null,charter:null,errors:[]};
  if(t.legacy)return out;
  const run=compatibleRun(atlas,t); await checked(run);
  const failure=(area,e,file)=>out.errors.push({area,...(file?{file}:{}),message:e.message});
  for (const [folder,kind] of kinds) {
    if(decisionsOnly && folder!=='decisions')continue;
    const dir=path.join(run,folder); let entries;
    try {await checked(dir);entries=(await fs.readdir(dir,{withFileTypes:true})).filter(ent=>/\.md$/i.test(ent.name)).sort((a,b)=>a.name.localeCompare(b.name));}
    catch(e){failure(folder,e);continue;}
    if(entries.length>256)failure(folder,err(413,'Only the first 256 Markdown artifacts could be inspected.'));
    let budget=4*1024*1024;
    for(const ent of entries.slice(0,256)){
      const file=path.join(dir,ent.name);
      try {const {text,mtimeMs,size}=await readSafe(file,Math.min(512*1024,budget));budget-=size;
        const record=parseTeamArtifact(kind,text,{path:file,mtimeMs});out[folder].push({...record,revision:hash(text)});
        if(!record.formatted)failure(folder,err(409,record.issue || 'Unformatted artifact.'),ent.name);
      } catch(e){failure(folder,e,ent.name);}
    }
  }
  if(!decisionsOnly)for(const [name,parser] of [['state',parseTeamState],['charter',parseTeamCharter]]){
    const file=path.join(run,`${name}.md`);try{const {text,mtimeMs}=await readSafe(file,512*1024);out[name]={...parser(text,{path:file,mtimeMs}),revision:hash(text)};}
    catch(e){failure(name,e);}
  }
  const partial=out.errors.some(e=>e.area==='decisions');
  for(const d of out.decisions.filter(d=>d.formatted)){
    const duplicates=out.decisions.filter(s=>s.formatted && s.id===d.id).length>1;
    d.answerable=d.status==='open' && !partial && !duplicates;
    if(duplicates)d.answerIssue='Duplicate decision id. Ask the lead to disambiguate before answering.';
    else if(partial)d.answerIssue='Decision inventory is partial. A unique id cannot be verified; inspect the listed issues before answering.';
  }
  return out;
}
function digestArtifacts(a) {
  return {...(a.errors.length?{errors:a.errors,partial:true,artifactError:a.errors.map(e=>`${e.area}: ${e.message}`).slice(0,3).join('; ')}:{}),counts:{reports:a.reports.length,reviews:a.reviews.length,decisions:a.decisions.length,openDecisions:a.decisions.filter(x=>x.formatted && x.status==='open').length},
    closing:a.reports.some(r=>r.formatted && r.seat==='lead' && path.basename(r.path)==='00-lead-closing.md'),
    activity:Math.max(0,...[...a.reports,...a.reviews,...a.decisions,a.state,a.charter].map(x=>x?.mtimeMs||0))};
}
async function scaffold(kit,t) {
  const root=t.runDir, parent=path.dirname(root); await ensureDir(parent);
  try {await fs.mkdir(root);} catch(e){if(e.code==='EEXIST')throw err(409,'A run already exists at this location. No files were replaced; choose another team name.');throw e;}
  try {
    for (const sub of ['roles','reports','reviews','decisions','work','work/lead',...t.seats.map(s=>`work/${s.name}`)]) await ensureDir(path.join(root,sub));
    const expected=new Set(['charter.md','state.md','roles/README.md','roles/lead.md',...t.seats.map(s=>`roles/${s.name}.md`)]);
    for (const [file,text] of Object.entries(kit.files)){
      if(!expected.delete(file))throw err(500,'Unexpected role template target.'); await exclusiveFile(path.join(root,file),text);
    }
    if(expected.size)throw err(500,'The team kit is incomplete.');
  } catch(e){throw err(409,`Scaffold was interrupted. Existing files were preserved at ${root}. ${e.message}`);}
}

export function createTeams({root,stateDir},{now=Date.now}={}) {
  const base=path.resolve(stateDir || path.join(os.homedir(),'.aitp-atlas')), workspace=hash(fileKey(root));
  const dir=path.join(base,'workspaces',workspace), file=path.join(dir,'teams.json');
  const stateSafe=()=>{if(isWithin(root,dir))throw err(409,'Configure stateDir outside the research root.');};
  async function load(){stateSafe(); let data;try{data=JSON.parse((await readSafe(file,32*1024*1024)).text);}catch(e){if(absent(e))return [];throw e;}
    if(data.version!==1 || data.workspace!==workspace || !Array.isArray(data.teams))throw err(409,'Unrecognized team registry; original left untouched.');return data.teams;}
  async function save(rows){stateSafe();await ensureDir(dir); const data=JSON.stringify({version:1,workspace,teams:rows}); if(Buffer.byteLength(data)>32*1024*1024)throw err(413,'Team registry is full.');
    await replaceChecked(file,data,async()=>{try{await checked(file,'file');}catch(e){if(!absent(e))throw e;}});}
  const discussions=createDiscussions({root,stateDir});
  async function inquiryOrigin(atlas,raw) {
    if (raw === undefined) return null;
    const {discussionId,proposalId}=object(raw);
    if (Object.keys(raw).length!==2 || !validId(discussionId) || typeof proposalId!=='string' || !/^reply-(?:0|[1-9]\d{0,15})$/.test(proposalId) || !Number.isSafeInteger(Number(proposalId.slice(6)))) throw err(400,'Invalid inquiry or proposal identifier.');
    if (fileKey(root)!==fileKey(atlas.root)) throw err(403,'The inquiry belongs to another research workspace.');
    const source=(await discussions.list()).find(r=>r.id===discussionId);
    if (source?.origin!=='desk' || !source.context?.inquiry) throw err(403,'No registered Desk inquiry with this id in this workspace.');
    if (source.status!=='open') throw err(409,'Reopen the original inquiry before starting a team.');
    return {discussionId,proposalId};
  }
  async function plan(atlas,raw){object(raw); const topic=topicOf(atlas,raw.topic); await checked(topic.path,'file');
    const draft=validateTeamDraft({...raw,topic}); const n=now(),date=dateOf(n);
    const slug=draft.name.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,48) || hash(draft.name).slice(0,12);
    const runDir=path.join(path.dirname(topic.path),'runs',`team-${date.replace(/-/g,'')}-${slug}`);
    const kit=renderTeamKit(draft,{runDir,date}); return {draft,kit,topic,runDir,n};}
  // The queue covers simultaneous requests in this Host. An exclusive lock also
  // rejects a second Host using the same settings; an orphan after a hard crash
  // is deliberately NOT stolen based on age (a slow owner may still be live).
  function mutate(fn){return serial(file, async () => {
    stateSafe();await ensureDir(dir);const lock=path.join(dir,'teams.write.lock');
    let handle;try{handle=await fs.open(lock,'wx',0o600);}catch(e){if(e.code==='EEXIST')throw err(409,`Team state is locked. Retry after the other writer finishes. If its Host exited, inspect ${lock} before clearing it.`);throw e;}
    try{await handle.writeFile(JSON.stringify({pid:process.pid,startedAt:now()}));return await fn();}
    finally{await handle.close();await fs.unlink(lock);}
  });}
  const methods={
    templates(){return {templates:TEAM_PRESETS};},
    async preview(atlas,raw){const {kit,runDir}=await plan(atlas,raw); await inquiryOrigin(atlas,raw.origin);return {runDir,brief:kit.brief,seatCalls:kit.seatCalls};},
    create(atlas,raw){return mutate(async()=>{
      const {draft,kit,topic,runDir,n}=await plan(atlas,raw), requestId=idOf(raw.requestId), origin=await inquiryOrigin(atlas,raw.origin);
      // Retain the pre-inquiry fingerprint for ordinary/restored launch requests.
      const fingerprint=hash(JSON.stringify(origin ? {draft,origin} : draft)), rows=await load();
      const old=rows.find(r=>r.requestId===requestId);
      if(old && old.fingerprint!==fingerprint)throw err(409,'This request already started a different charter.');
      // A fresh browser/edited charter has another requestId; an actual team for
      // this exact reply, even without a lead receipt, must be inspected instead.
      const prior=old || (origin && rows.find(r=>!r.legacy && r.origin?.discussionId===origin.discussionId && r.origin.proposalId===origin.proposalId));
      if(prior)return {team:publicTeam(prior),brief:prior.brief,seatCalls:prior.seatCalls,replayed:true};
      for(const seat of draft.seats) if(!/^[a-z][a-z0-9-]{0,31}$/.test(seat.name))throw err(400,'Invalid role-card filename.');
      await ensureDir(dir); const t={id:randomUUID(),requestId,fingerprint,draft,...(origin?{origin}:{}),name:draft.name,goal:draft.goal,doneWhen:draft.doneWhen,topic,runDir,leadId:null,created:n,updated:n,seats:draft.seats,template:draft.template,leadModel:draft.leadModel || null,brief:kit.brief,seatCalls:kit.seatCalls,paused:false,ending:false,legacy:false,view:'flow'};
      await scaffold(kit,t);rows.push(t); try{await save(rows);}catch(e){throw err(409,`The run was created at ${runDir}, but its team record could not be saved. No session was started. ${e.message}`);}
      return {team:publicTeam(t),brief:t.brief,seatCalls:t.seatCalls,replayed:false};});},
    async list(atlas){const rows=await load(), teams=[];for(const t of rows){let summary;try{const {activity,...fields}=digestArtifacts(await scanArtifacts(atlas,t));summary={...fields,updated:Math.max(t.updated,activity)};}catch(e){summary={counts:blankCounts(),closing:false,artifactError:e.message};} teams.push({...publicTeam(t),...summary});}return {teams};},
    async artifacts(atlas,id){const team=find(await load(),id);return {...await scanArtifacts(atlas,team),root:atlas.root,teamId:team.id,origin:team.origin || null};},
    async needs(atlas){const decisions=[],leadIds=[],teamErrors=[]; for(const t of await load()){if(t.legacy)continue; if(t.leadId)leadIds.push(t.leadId);
      let a;try{a=await scanArtifacts(atlas,t,{decisionsOnly:true});}catch(e){teamErrors.push({teamId:t.id,teamName:t.name,message:e.message});continue;}
      if(a.errors.length)teamErrors.push({teamId:t.id,teamName:t.name,message:a.errors[0].message,errors:a.errors});
      for(const d of a.decisions)if(d.formatted && d.status==='open')decisions.push({teamId:t.id,teamName:t.name,topic:t.topic,id:d.id,question:d.question,answerable:d.answerable,answerIssue:d.answerIssue});}return {decisions,leadIds,teamErrors};},
    patch(id,raw){return mutate(async()=>{const rows=await load(),t=find(rows,id);writable(t);const keys=Object.keys(object(raw)); if(!keys.length || keys.some(k=>!['leadId','startedAt','name','paused','ending','view'].includes(k)))throw err(400,'Invalid team update.');
      if('leadId' in raw){const lead=idOf(raw.leadId); if((t.leadId && t.leadId!==lead) || rows.some(r=>r!==t && r.leadId===lead))throw err(409,'This lead is already bound.');t.leadId=lead;}
      if('startedAt' in raw){if(!t.leadId || !Number.isSafeInteger(raw.startedAt) || raw.startedAt<=0)throw err(400,'A bound lead and positive receipt timestamp are required.');if(t.startedAt && t.startedAt!==raw.startedAt)throw err(409,'The brief delivery timestamp is already recorded.');t.startedAt=raw.startedAt;}
      if('name' in raw){t.name=string(raw.name,160);if(!t.name)throw err(400,'The team needs a name.');}
      for(const k of ['paused','ending'])if(k in raw){if(typeof raw[k]!=='boolean')throw err(400,'Expected a Boolean team flag.');t[k]=raw[k];}
      if('view' in raw){if(!['flow','board','timeline'].includes(raw.view))throw err(400,'Unknown team view.');t.view=raw.view;}t.updated=now();await save(rows);return {team:publicTeam(t)};});},
    async import(atlas,records){if(!Array.isArray(records)||records.length>1000)throw err(400,'Expected up to 1000 old team records.');return mutate(async()=>{
      const rows=await load(), rejected=[];let existing=0,imported=0;
      for(const raw of records){try{const id=idOf(object(raw).id);if(raw.kind!=='team')throw err(400,'Not a legacy team.'); const ref=raw.context?.topic || raw.topic;const topic=ref==null?null:topicOf(atlas,ref);
        if(rows.some(r=>r.id===id && r.legacy)){existing++;continue;} if(rows.some(r=>r.id===id||r.leadId===id))throw err(409,'This session already belongs to a team.');
        const n=Number.isSafeInteger(raw.created)&&raw.created>0?raw.created:now();rows.push({id,leadId:id,name:string(raw.title || raw.label || 'Legacy team',2048),topic,created:n,updated:n,legacy:true,runDir:null,goal:'',doneWhen:'',seats:[],template:null,paused:false,ending:false,view:'board'});imported++;
      }catch(e){rejected.push({id:typeof raw?.id==='string'?raw.id.slice(0,120):null,reason:e.message});}}
      if(imported)await save(rows);return {imported,existing,rejected};});},
  };
  const eventsFile=id=>path.join(dir,`team-events-${idOf(id)}.jsonl`);
  async function readEvents(id){let log;try{log=(await readSafe(eventsFile(id),8*1024*1024)).text;}catch(e){if(absent(e))return [];throw e;}
    return log.split('\n').filter(Boolean).map(line=>JSON.parse(line));}
  methods.events=async(id,since=0)=>{find(await load(),id);const ts=Number(since);if(!Number.isSafeInteger(ts)||ts<0)throw err(400,'Invalid event cursor.');return {events:(await readEvents(id)).filter(e=>e.at>ts)};};
  methods.observe=(id,batch)=>mutate(async()=>{
    const team=find(await load(),id);writable(team);if(!Array.isArray(batch)||batch.length>128)throw err(400,'Expected up to 128 observed events.');
    const prior=await readEvents(id), known=new Map(prior.map(e=>[e.id,e])), add=[];let at=prior.at(-1)?.at||0;
    for(const e of batch){object(e);const event={id:e.id==null?randomUUID():string(e.id,256),type:string(e.type,80),text:string(e.text,2000),observed:true};
      if(!event.id || !event.type || !event.text)throw err(400,'Missing observed event data.');for(const k of ['seat','taskId'])if(e[k]!=null)event[k]=string(e[k],160);
      if(known.has(event.id))continue; at=Math.max(now(),at+1);event.at=at;known.set(event.id,event);add.push(event);}
    if(add.length){const target=eventsFile(id);await checked(dir);let fresh=false;try{await checked(target,'file');}catch(e){if(!absent(e))throw e;fresh=true;}
      const fh=await fs.open(target,(fresh ? constants.O_CREAT | constants.O_EXCL : 0) | constants.O_APPEND | constants.O_WRONLY | (constants.O_NOFOLLOW||0),0o600);
      try{const s=await fh.stat(),data=add.map(e=>JSON.stringify(e)+'\n').join('');if(!s.isFile() || s.nlink!==1 || s.size+Buffer.byteLength(data)>8*1024*1024)throw err(413,'Unsafe or full events log.'); await fh.writeFile(data);await fh.sync();}finally{await fh.close();}}
    return {events:add};});
  methods.addSeat=(atlas,id,raw)=>mutate(async()=>{
    const rows=await load(),t=find(rows,id);writable(t);const run=compatibleRun(atlas,t);await checked(run);
    const seat=object(raw.seat || raw);if(!/^[a-z][a-z0-9-]{0,31}$/.test(seat.name) || seat.name==='lead')throw err(400,'Invalid new seat name.');
    const existing=t.seats.find(s=>s.name===seat.name);
    const normalizedInput={...seat,task:seat.task || seat.description,roleCard:seat.roleCard || (seat.role==='custom'?seat.description:undefined)};
    const draft=validateTeamDraft({...t.draft,seats:[...t.seats.filter(s=>s.name!==seat.name),normalizedInput]});const normalized=draft.seats.find(s=>s.name===seat.name);
    const kit=renderTeamKit(draft,{runDir:run,date:dateOf(t.created)}),call=kit.seatCalls.find(c=>c.name===seat.name);
    if(!call || !kit.files[`roles/${seat.name}.md`])throw err(400,'Cannot render this role card.');
    if(existing){if(JSON.stringify(existing)!==JSON.stringify(normalized))throw err(409,'A different role already uses this seat name.');return {team:publicTeam(t),call,seatCall:call,replayed:true};}
    const work=path.join(run,'work',seat.name),card=path.join(run,'roles',`${seat.name}.md`);
    await checked(path.dirname(work));await checked(path.dirname(card));
    for(const p of [card,work]){try{await fs.lstat(p);}catch(e){if(absent(e))continue;throw e;}throw err(409,'Role card or seat directory already exists; no files were replaced.');}
    try{await fs.mkdir(work);await exclusiveFile(card,kit.files[`roles/${seat.name}.md`]);t.seats=draft.seats;t.draft=draft;t.seatCalls=kit.seatCalls;t.updated=now();await save(rows);}catch(e){throw err(409,`Seat could not be registered; inspect ${work} and its role card before retrying. ${e.message}`);}
    return {team:publicTeam(t),call,seatCall:call,replayed:false};});
  methods.answer=(atlas,id,did,raw)=>mutate(async()=>{
    const t=find(await load(),id);writable(t); idOf(did); object(raw);
    const choice=string(raw.choice,120),note=string(raw.note??'',8000),revision=string(raw.revision,64);
    if(!/^[a-f0-9]{64}$/.test(revision))throw err(400,'Supply the version of the decision that was shown.');
    const run=compatibleRun(atlas,t);const all=await scanArtifacts(atlas,t,{decisionsOnly:true});
    if(all.errors.length)throw err(409,`Decision inventory is partial; cannot verify a unique id. ${all.errors[0].message}`);
    const matches=all.decisions.filter(d=>d.formatted && d.id===did);if(matches.length!==1)throw err(matches.length?409:404,matches.length?'Duplicate decision id; the lead must resolve it.':'No formatted decision with this id.');
    const d=matches[0],file=d.path;if(fileKey(path.dirname(file))!==fileKey(path.join(run,'decisions')))throw err(403,'Unknown decision path.');
    const original=await readSafe(file,512*1024);if(hash(original.text)!==d.revision)throw err(409,'The decision changed; refresh it.');
    const token=hash(JSON.stringify([id,did,revision,choice,note])), marker=`<!-- atlas-answer:${token} -->`;
    const message=`Decision ${did} answered: ${choice}.${note?' '+note:''}`;
    if(d.status==='answered' && original.text.trimEnd().endsWith(marker))return {decision:d,message,replayed:true};
    if(d.status!=='open' || d.revision!==revision)throw err(409,'This decision has changed or is no longer open. Refresh before answering.');
    if(!Object.hasOwn(d.options||{},choice))throw err(400,'Choose an option listed in this decision.');
    // Edit exactly one top-level key in the front matter, not status-like lines in the body or options.
    const fm=/^(\uFEFF?---[^\S\r\n]*\r?\n)([\s\S]*?)(^---[^\S\r\n]*\r?$)/m.exec(original.text);
    if(!fm || fm.index!==0)throw err(409,'Cannot safely locate the front matter.');
    const status=/^(status[ \t]*:[ \t]*)(?:open|"open"|'open')([ \t]*(?:#[^\r\n]*)?)(?=\r?$)/gm;
    if([...fm[2].matchAll(status)].length!==1)throw err(409,'Cannot safely update the decision status.');
    const eol=original.text.includes('\r\n')?'\r\n':'\n';
    const body=fm[1]+fm[2].replace(status,'$1answered$2')+fm[3]+original.text.slice(fm[0].length);
    const output=body+(body.endsWith(eol)?'':eol)+eol+`## Answer (${dateOf(now())}, researcher)`+eol+eol+choice+(note?eol+eol+note:'')+eol+eol+marker+eol;
    const parsed=parseTeamArtifact('decision',output,{path:file,mtimeMs:now()});if(!parsed.formatted || parsed.status!=='answered'||parsed.id!==did)throw err(409,'Could not validate the updated decision. No change was made.');
    if(Buffer.byteLength(output)>512*1024)throw err(413,'The answer would exceed the artifact size limit.');
    await replaceChecked(file,output,async()=>{if(hash((await readSafe(file,512*1024)).text)!==revision)throw err(409,'The decision changed; no answer was written.');});
    return {decision:{...parsed,revision:hash(output)},message,replayed:false};});
  return methods;
}
