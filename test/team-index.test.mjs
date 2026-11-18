import assert from 'node:assert/strict';
import test from 'node:test';
import {readdirSync,readFileSync} from 'node:fs';
const dir=new URL('../client/',import.meta.url),js=readdirSync(dir).filter(f=>f.endsWith('.js') && f!=='90-register.js').sort().map(f=>readFileSync(new URL(f,dir),'utf8')).join('\n');
const h=(type,props,...children)=>({type,props:props || {},children:children.flat(Infinity)});
function harness({rows,workspaces,storage=new Map(),network,mode}={}) {
  const effects=[], react={createContext:value=>({value}),Component:class{},createElement:h,useMemo:f=>f(),useCallback:f=>f,useRef:current=>({current}),useContext:c=>c.value,useSyncExternalStore:(_,get)=>get(),useEffect:f=>effects.push(f),useLayoutEffect(){},useState:val=>[val==='discuss' && mode?mode:typeof val==='function'?val():val,()=>{}]};
  const services={sessions:{list:{getSnapshot:()=>rows}},workspaces:{list:{getSnapshot:()=>workspaces}}};
  const win={localStorage:{getItem:k=>storage.get(k) || null,setItem:(k,v)=>storage.set(k,v)},addEventListener(){},removeEventListener(){}};
  const ui=new Function('require','window','services','network','setInterval','clearInterval',js+`\npluginCtx={get:k=>services[k]};api=network; return {teamLegacyCandidates,teamIndexSummary,teamPlaceItems,teamIndexStore,useTeamIndexSnapshot,useTeamIndex,recordTeamInIndex,teamIndexRefresh,lookupTeam,deskAlmanacData,DeskAlmanac,DeskWorkspace,TopicWorkspace,TeamsPlace,AtlasActions,threadStore,teamIndexInitial};`)(n=>n==='react'?react:{},win,services,network,()=>1,()=>{});
  return {...ui,runEffects:()=>effects.splice(0).map(f=>f()).filter(Boolean)};
}
const settle=()=>new Promise(r=>setImmediate(r));
const root='/fixture/A',foreign='/fixture/B';
const old=(id,topic)=>({id,kind:'team',created:7,context:{topic:topic?{id,title:id,path:topic}:null}});
const rowList=byId=>({phase:'ready',byId});
const tree=t=>t && typeof t==='object'?[t,...t.children.flatMap(tree)]:[];

test('0.x teams import only under a witnessed root, store acknowledgements separately, resume after refusal, and never resubmit an acknowledged record',async()=>{
  const storage=new Map(),calls=[],backing=new Map();let fail=true;
  const rows=rowList({unfiled:{cwd:root},foreign:{cwd:foreign},ambiguous:{cwd:root+'/nested'}});
  const workspaces={phase:'ready',items:[{path:root,sessionIds:['unfiled']},{path:root+'/nested',sessionIds:['ambiguous']},{path:foreign,sessionIds:['foreign']}]};
  const oldThreads=[old('filed',root+'/topic/research.md'),old('unfiled'),old('ambiguous'),old('foreign',root+'/bogus.md'),old('unknown'),{id:'discussion'}];
  const source=JSON.stringify(oldThreads);storage.set('aitp-atlas:threads',source);storage.set('aitp-atlas:threads-imported:discussions:'+encodeURIComponent(root),JSON.stringify(['filed']));
  const network=async(name,opts)=>{if(name==='teams')return {root,teams:[...backing.values()]};assert.equal(name,'teams/import');assert.equal(opts.body.expectedRoot,root);const [r]=opts.body.records;calls.push(r.id);if(r.id==='unfiled' && fail)return {rejected:[{id:r.id,reason:'try again'}]};const existed=backing.has(r.id);if(!existed)backing.set(r.id,{id:r.id,name:r.id,legacy:true,leadId:r.id,runDir:null});return {existing:+existed,imported:+!existed};};
  const mount=()=>{const c=harness({network,rows,workspaces,storage});c.threadStore.set(oldThreads);c.useTeamIndex(root);return {c,cleanup:c.runEffects()};};
  const a=mount();await settle();assert.deepEqual(calls,['filed','unfiled']);assert.match(a.c.teamIndexStore.get().migrationError,/try again/);assert.deepEqual(a.c.useTeamIndexSnapshot(foreign).records,[]);a.cleanup.forEach(f=>f());
  fail=false;const b=mount();await settle();assert.deepEqual(calls,['filed','unfiled','unfiled']);assert.deepEqual(b.c.lookupTeam('filed',root),backing.get('filed'));assert.equal(b.c.lookupTeam('filed',foreign),null);b.cleanup.forEach(f=>f());
  const d=mount();await settle();assert.equal(calls.length,3);assert.equal(storage.get('aitp-atlas:threads'),source);d.cleanup.forEach(f=>f());
});

test('Desk Team mode opens the sheet with its goal, chosen topic and pointers, without creating a session; Topic opens the same sheet',async()=>{
  const storage=new Map();storage.set('aitp-atlas:prefs.v1',JSON.stringify({deskDraft:{root,question:'Check the limits',topicId:'x',attachments:[{label:'Notes',path:root+'/n.md'}]}}));
  const c=harness({mode:'team',storage,rows:rowList({}),network:()=>assert.fail('opening the setup sheet must not start a team')});const calls=[];
  c.AtlasActions.value={assembleTeam:p=>calls.push(p)};const topic={id:'x',title:'Bounds',ancestors:[],threads:[],children:[],contents:[],file:root+'/x/research.md'};
  const ov={root,topics:{x:topic},directions:[]};const desk=tree(c.DeskWorkspace({overview:ov,go(){},onStartDiscussion:()=>assert.fail('team setup is not a new discussion')}));
  await desk.find(n=>n.children.includes('Set up team…')).props.onClick();assert.deepEqual(calls[0],{goal:'Check the limits',topicId:'x',leadModel:null,attachments:[{label:'Notes',path:root+'/n.md'}]});
  const screen=tree(c.TopicWorkspace({data:{topic,path:topic.file,body:'',linkedFrom:[],mtimeMs:1},ov,go(){}}));screen.find(n=>n.children.includes('Start a team')).props.onClick();assert.deepEqual(calls[1],{topicId:'x'});
});

test('switching root hides prior team records synchronously and delayed reads cannot write into the next index',async()=>{
  const pending=[];const c=harness({rows:rowList({}),network:()=>new Promise(resolve=>pending.push(resolve))});
  c.useTeamIndex(root);const clean=c.runEffects();assert.equal(pending.length,1);c.recordTeamInIndex(root,{id:'A',name:'Private A'});assert.deepEqual(c.useTeamIndexSnapshot(foreign).records,[]);
  clean.forEach(f=>f());c.useTeamIndex(foreign);c.runEffects();pending[1]({root:foreign,teams:[{id:'B',name:'B only'}]});await settle();pending[0]({root,teams:[{id:'A',name:'Private A'}]});await settle();assert.deepEqual(c.teamIndexStore.get().records,[{id:'B',name:'B only'}]);
  const changing=c.teamIndexRefresh(foreign);pending[2]({root,teams:[{id:'A'}]});await changing;assert.deepEqual(c.teamIndexStore.get().records,[]);assert.match(c.teamIndexStore.get().error,/another workspace/);
});

test('native and legacy directory filters, progress, actual decision counts and read-only legacy paths agree with the Desk',()=>{
  const records=[{id:'quiet',name:'Quiet',leadId:'quiet',seats:[],updated:10},{id:'legacy',name:'Historical',legacy:true,leadId:'old-lead',updated:6},{id:'waiting',name:'Review bounds',leadId:'lead-1',seats:[],counts:{openDecisions:1},updated:4},{id:'done',name:'Complete',leadId:'lead-2',closing:true}];
  const rows=rowList({quiet:{},'old-lead':{projectionValues:{agentTeam:{enabled:true,tasks:[{status:'completed'},{status:'in_progress'}]},subagentCatalog:[{id:'worker',name:'calc'}]}},worker:{parentId:'old-lead',running:true},'lead-1':{},'lead-2':{}});
  const needs={waiting:[],reviews:[],decisions:[{teamId:'waiting',id:'D01',question:'Choose bounds',teamName:'Review bounds'}]}, ov={root,topics:{}};
  const c=harness({rows}),ids=filter=>c.teamPlaceItems(records,rows,needs,filter).map(x=>x.team.id);
  assert.deepEqual(ids('active'),['waiting','legacy','quiet']);assert.deepEqual(ids('waiting'),['waiting']);assert.deepEqual(ids('done'),['done']);
  const al=c.deskAlmanacData(ov,[],rows,needs,records);assert.deepEqual(al.running.map(x=>[x.id,x.progress]),[['legacy','1 of 2'],['worker','working']]);assert.deepEqual(al.waiting.map(x=>[x.kind,x.id]),[['decision','D01']]);
  c.teamIndexStore.set({...c.teamIndexInitial,root,loading:false,records});const hits=[];
  c.AtlasActions.value={openTeam:(...args)=>hits.push(args),openThread:()=>assert.fail('legacy member must not open a writable transcript')};
  const ar=tree(c.DeskAlmanac({ov,go(){},onOpenThread:()=>assert.fail('legacy member must open the read-only room'),registry:{root,records:[],needs}}));
  ar.find(x=>x.children.includes('Answer')).props.onClick();ar.find(x=>x.props.title?.includes('calc · Historical')).props.onClick();assert.deepEqual(hits,[['waiting',{decisionId:'D01'}],['legacy']]);
  const place=tree(c.TeamsPlace({overview:ov,go(){},onTeam:id=>hits.push([id])}));const legacy=place.find(x=>x.type==='button' && tree(x).some(n=>n.children.includes('Legacy')));legacy.props.onClick();assert.deepEqual(hits.at(-1),['legacy']);assert.equal(place.filter(x=>x.children.includes('New team')).length,1);
});
