// M2 registry glue: no system browser, external model, production profile or disk state.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { makeFixture } from './fixture.mjs';
import { loadAtlas } from '../lib/atlas.js';
import { createDiscussions } from '../lib/discussions.js';
import test from 'node:test';
const code = readFileSync(new URL('../client/61-discussions.js',import.meta.url),'utf8');
function ui(api=()=>{ throw new Error('Unexpected API call'); }) {
  return new Function('api',`
    const externalStore=initial=>{let value=initial;return {get:()=>value,set:v=>value=v};};
    const React={useId:()=>':discussions-test:'}, h=(type,props,...children)=>({type,props,children:children.flat()});
    const rowOf=(rows,id)=>rows?.byId?.[id], knownThread=(rows,t)=>rows?.phase!=='ready'||Boolean(rowOf(rows,t.id));
    const parentOf=row=>row.parentId,teamOf=row=>row.projectionValues?.agentTeam?.enabled;
    ${code}
    return {registryLegacyCandidates,registryImportLegacy,registryMoveController,registryVisibleList,RegistryDiscussionList,registryOtherRows,registryTopicTree,registryGet,registryCreate,registryPatch,registryRefresh,registryState,registryAdoption,registryUnread};`)(api);
}
const root='/physics', topic={id:'worm',title:'Worm',path:'/physics/worm/research.md'};
const old=(id,ctx={topic})=>({id,title:id,context:ctx,created:1,status:'open'});
const rowsOf=byId=>({byId,ids:Object.keys(byId),phase:'ready'});

test('import requires a workspace witness; leave the complete 0.x index and legacy teams for M3',()=>{
  const c=ui(), original=[old('a'),old('team'),old('unfiled',{}),old('unproved',{}),old('doc-other',{}),old('wrong'),old('capital',{topic:{path:'/Physics/x.md'}})]; original[1].kind='team';
  const saved=structuredClone(original);
  const r=rowsOf({unfiled:{cwd:root},'doc-other':{cwd:'/physics-elsewhere'},wrong:{cwd:'/different'}});
  assert.deepEqual(c.registryLegacyCandidates(original,root,r).map(t=>t.id),['a','unfiled']);
  assert.deepEqual(c.registryLegacyCandidates(original,root,{...r,phase:'loading'}).map(t=>t.id),['a']);
  assert.deepEqual(original,saved);
  assert.deepEqual(c.registryLegacyCandidates([old('drive',{topic:{path:'C:\\Work\\Topic\\research.md'}})],'c:/work',null).map(t=>t.id),['drive']);
});

test('partially acknowledged migration retries; a second source adds missing sessions but cannot overwrite newer registry data',async()=>{
  const c=ui(), registry=new Map([['survivor',{title:'renamed by researcher'}]]); let ack=[],offlineOnce=true;
  const post=async({records:[r]})=>{
    if(r.id==='b' && offlineOnce){offlineOnce=false;throw new Error('offline');}
    if(r.id==='bad')return {imported:0,existing:0,rejected:[{id:r.id,reason:'bad record'}]};
    const existed=registry.has(r.id); if(!existed) registry.set(r.id,r);
    return {imported:Number(!existed),existing:Number(existed),rejected:[]};
  };
  const first=['survivor','a','b','bad'].map(id=>old(id));
  await assert.rejects(c.registryImportLegacy(first,ack,post,x=>{ack=x;}),/offline/);
  assert.deepEqual(ack,['survivor','a']);
  assert.deepEqual(await c.registryImportLegacy(first,ack,post,x=>{ack=x;}),['bad record']);
  assert.deepEqual(ack,['survivor','a','b']);
  let second=[]; await c.registryImportLegacy([old('a'),old('c')],second,post,x=>{second=x;});
  assert.deepEqual(second,['a','c']);assert.deepEqual([...registry.keys()],['survivor','a','b','c']);assert.equal(registry.get('survivor').title,'renamed by researcher');
});

test('client move and import match the real disk registry contract, including concurrent claims and metadata-only undo',async t=>{
  const fx=await makeFixture();t.after(()=>fx.cleanup());
  const atlas=await loadAtlas({root:fx.root}), server=createDiscussions({root:fx.root,stateDir:path.join(fx.base,'atlas-state')});
  const t1=atlas.topics.get('mc/worm'),t2=atlas.topics.get('topology'), a={id:t1.id,path:t1.file,title:t1.title},b={id:t2.id,path:t2.file,title:t2.title};
  const c=ui(), ack=[]; await c.registryImportLegacy([old('sample',{topic:a})],[],body=>server.import(atlas,body.records),ids=>ack.push(...ids)); assert.deepEqual(ack,['sample']);
  const timers=[],toasts=[],sent=[];
  const controller=c.registryMoveController({ patch:(id,p)=>server.patch(atlas,id,p),send:async(id,text)=>{sent.push([id,text]);},timer:cb=>(timers.push(cb),timers.length-1),cancel(){},token:()=>`token-${timers.length}` });
  await controller(['sample'],b,true,(msg,o)=>toasts.push(o)); await toasts[0].action.onClick(); await timers[0]();
  assert.equal((await server.list())[0].topic.id,a.id);assert.deepEqual(sent,[]);
  await controller(['sample'],b,true,(msg,o)=>toasts.push(o));await timers[1]();const [record]=await server.list();
  assert.equal(record.topic.id,b.id);assert.equal(record.context.topic.id,a.id);assert.equal(record.moves.at(-1).told,true);assert.equal(sent.length,1);
  assert.equal((await server.patch(atlas,'sample',{claimMove:record.moves.at(-1).token})).claimed,false);
});

function moveHarness() {
  const c=ui(), db=new Map(), queued=[], timers=[],toasts=[]; let next=0;
  const make=()=>c.registryMoveController({
    token:()=>`move-${++next}`,
    timer:(cb,ms)=>{assert.equal(ms,6000);timers.push(cb);return timers.length-1;},cancel:i=>{timers[i]=null;},
    send:async(id,text)=>{queued.push({id,text});},
    patch:async(id,p)=>{
      const r=db.get(id)||{id,topic:null};
      if(p.topic){db.set(id,{...r,before:r.topic,topic:p.topic.to,token:p.topic.token,claimed:false,told:false});return {discussion:db.get(id)};}
      if(p.claimMove){if(r.token!==p.claimMove||r.claimed)return{discussion:r,claimed:false};r.claimed=true;return {discussion:r,claimed:true};}
      if(p.undoMove){if(r.claimed||p.undoMove!==r.token)throw Error('superseded'); db.set(id,{...r,topic:r.before,token:null});return {discussion:db.get(id)};}
      if(p.toldMove===r.token){r.told=true;return {discussion:r};} throw Error('stale');
    },
  });
  return {db,queued,timers,toasts,make,flash:(text,opts)=>toasts.push({text,opts})};
}
test('bulk move is immediate, one six-second Undo restores all; late timer and double clicks cannot send',async()=>{
  const m=moveHarness();await m.make()(['a','b','a'],topic,true,m.flash);
  assert.equal(m.db.size,2);assert.equal(m.db.get('a').topic,topic);assert.equal(m.toasts.length,1);assert.equal(m.toasts[0].opts.duration,6000);assert.equal(m.queued.length,0);
  const timer=m.timers[0],undo=m.toasts[0].opts.action.onClick;await Promise.all([undo(),undo(),timer()]);
  assert.equal(m.db.get('a').topic,null);assert.equal(m.db.get('b').topic,null);assert.deepEqual(m.queued,[]);
});
test('a later move from another tab supersedes the older pending send; expiry is at most once and Tell off never queues',async()=>{
  const m=moveHarness();await m.make()(['a'],topic,true,m.flash);
  const other={id:'q',title:'Q',path:'/physics/q/research.md'};
  await m.make()(['a'],other,true,m.flash);await m.timers[0]();await Promise.all([m.timers[1](),m.timers[1]()]);
  assert.deepEqual(m.queued.map(x=>x.id),['a']);assert.match(m.queued[0].text,/“Q”.*\/physics\/q\/research\.md/);assert.equal(m.db.get('a').told,true);
  await m.toasts[0].opts.action.onClick();assert.equal(m.db.get('a').topic,other);
  await m.make()(['a'],null,false,m.flash);await m.timers[2]();assert.equal(m.queued.length,1);
  m.make();assert.equal(m.timers.length,3,'a newly mounted browser does not replay notifications');
});
test('filters use filing rather than original context, truthful unread turns, known DSH roots and review observations',()=>{
  const c=ui(), records=[{...old('a'),topic,lastTurnAt:2,seenAt:1,pinned:true},{...old('b'),topic:null,question:'The edge',updated:20},{...old('c'),status:'resolved'},{...old('gone')}];
  const rows=rowsOf({a:{cwd:root,running:true},b:{cwd:root},c:{cwd:root},t:{cwd:root},x:{cwd:root,title:'Import me'},y:{cwd:root,parentId:'a'},z:{cwd:'/different'},w:{cwd:root,projectionValues:{agentTeam:{enabled:true}}}}),needs={reviews:[{session:'b',edits:1}]};
  const list=(f,q)=>c.registryVisibleList(records,rows,needs,f,q).map(r=>r.id);
  assert.deepEqual(list('unread'),['a']);assert.deepEqual(list('running'),['a']);assert.deepEqual(list('unfiled'),['b']);assert.deepEqual(list('topic:worm'),['a']);assert.deepEqual(list('resolved'),['c']);assert.deepEqual(list('needs'),['b']);assert.deepEqual(list('','edge'),['b']);assert.deepEqual(list('pinned'),['a']);
  assert.deepEqual(c.registryOtherRows(root,rows,records,[{id:'t',kind:'team'}],'import').map(x=>x.id),['x']);
  assert.equal(c.registryAdoption('x',rows.byId.x,99).origin,'import');assert.equal(c.registryAdoption('x',rows.byId.x,99).seenAt,99);
});
test('Running groups use accessible topic headings, keep matching rows sorted and distinguish unfiled from the programme',()=>{
  const c=ui(), file=(id,title)=>({id,title,path:'/physics/'+id+'/research.md'}), a=file('alpha','Shared'), b=file('beta','Shared'), programme=file('','Programme');
  const records=[['1','Zeta',a,40],['2','Gamma',b,50],['3','Alpha',a,20],['4','Unfiled row',null,10],['5','Programme row',programme,30],['6','Idle',a,100]].map(([id,title,topic,updated])=>({...old(id),title,topic,updated,question:'fixture'}));
  const rows=rowsOf(Object.fromEntries(records.map(r=>[r.id,{running:r.id!=='6'}])));
  const render=(filter,search,sort)=>c.RegistryDiscussionList({filter,list:c.registryVisibleList(records,rows,{},filter,search,sort),row:r=>({type:'li',id:r.id})});
  const groups=render('running','','title');
  assert.deepEqual(groups.map(g=>g.children[0].children[0]),['Programme','Shared (alpha)','Shared (beta)','Unfiled']);
  assert.deepEqual(groups.map(g=>g.children[1].children.map(r=>r.id)),[['5'],['3','1'],['2'],['4']]);
  assert.deepEqual(render('running','','activity').map(g=>g.children[1].children.map(r=>r.id)),[['5'],['1','3'],['2'],['4']]);
  assert.equal(new Set(groups.map(g=>g.children[0].props.id)).size,4);
  for(const g of groups){const [heading,list]=g.children;assert.equal(g.type,'section');assert.equal(heading.type,'h2');assert.equal(list.type,'ul');assert.equal(g.props['aria-labelledby'],heading.props.id);assert.equal(list.props['aria-labelledby'],heading.props.id);assert.equal(heading.props.tabIndex,undefined);}
  assert.deepEqual(render('running','Zeta','title').map(g=>g.children[1].children.map(r=>r.id)),[['1']]);
  assert.deepEqual(render('running','unmatched','title'),[]);
  assert.equal(render('','','title').type,'ul','other filters remain flat and keep their existing row actions');
});

test('GET/POST/PATCH share one canonical store; network failures do not optimistically corrupt it',async()=>{
  let saved=null;const needs={reviews:[],decisions:[],waiting:[]};const calls=[];
  const c=ui(async (path,opts)=>{calls.push([path,opts]); if(path==='needs')return needs;if(!opts.method)return{discussions:saved?[saved]:[]};
    if(opts.method==='POST'){saved=opts.body;return {discussion:saved};}if(opts.body.bad)throw Error('forbidden');saved={...saved,...opts.body};return {discussion:saved};});
  c.registryState.set({...c.registryState.get(),root});await c.registryCreate(old('x/key'));
  await Promise.all([c.registryRefresh(),c.registryPatch('x/key',{title:'renamed'})]);
  assert.equal(c.registryGet('x/key').title,'renamed');assert.equal(c.registryState.get().needs,needs);
  assert.ok(calls.some(([path,opts])=>path==='discussions/x%2Fkey'&&opts.method==='PATCH'));
  await assert.rejects(c.registryPatch('x/key',{bad:true}),/forbidden/);assert.equal(c.registryGet('x/key').bad,undefined);
});
