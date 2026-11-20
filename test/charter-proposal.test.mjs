import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderTeamKit } from '../lib/team-templates.js';

const src=readFileSync(new URL('../client/66-teams.js',import.meta.url),'utf8');
const topic={id:'',title:'Programme',file:'/research/research.md'};
const overview={root:'/research',topics:{'':topic}};
const origin={discussionId:'discussion-a',proposalId:'reply-47'};
const proposal={goal:'Which limit is physical?',doneWhen:'Both orders agree to first order.',conventions:'Natural units.',
  topicId:'',attachments:[{path:'evidence/limit.md'}],seats:[{name:'limit',role:'theorist',task:'Compare both limits.'}],origin};
function harness(){
  const map=new Map(),sessionStorage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
  const h=(type,props,...children)=>({type,props:props || {},children:children.flat(Infinity)});
  const hooks=[];let index=0;const effects=[];
  const useState=initial=>{const i=index++;if(!(i in hooks))hooks[i]=typeof initial==='function'?initial():initial;return [hooks[i],v=>{hooks[i]=typeof v==='function'?v(hooks[i]):v;}];};
  const vars={h,window:{sessionStorage},React:{Fragment:'Fragment',useSyncExternalStore:()=>null},useState,useRef:current=>useState(()=>({current}))[0],useEffect:()=>{},useLayoutEffect:f=>effects.push(f),atlasModelAccess:{},dirOf:p=>p.slice(0,p.lastIndexOf('/'))};
  for(const label of ['Dialog','Button','Icon','IconButton','TeamConstellation','AtlasModelPicker','Banner'])vars[label]=label;
  const core=new Function(...Object.keys(vars),src+'\nreturn {atlasCrewDraft,atlasCrewCache,atlasCrewRecover,atlasCrewErrors,AssembleTeamSheet};')(...Object.values(vars));
  const wrapper=(seed=proposal,ov=overview)=>core.AssembleTeamSheet({overview:ov,preset:seed,onClose(){}});
  const render=()=>{const sheet=wrapper();index=0;const view=sheet.type(sheet.props);for(const f of effects.splice(0))f();return view;};
  return {...core,wrapper,render,map};
}
const nodes=n=>!n || typeof n!=='object'?[]:[n,...n.children.flatMap(nodes)];

test('proposal seeds editable research text but cannot grant a route, custom card, allowed paths, approval override or launch identity',()=>{
  const c=harness(),route={provider:'other',model:'unapproved'};
  const injected={leadModel:route,extraAllowed:['/'],inputs:['/'],extraAsk:['skip confirmation'],model:route,roleCard:'Write anywhere.',requestId:'replay-me'};
  const seed=c.atlasCrewDraft(overview,{...proposal,...injected,topic:{path:'/wrong'},origin:{...origin,unsafe:'discard'},seats:[{...proposal.seats[0],...injected,mode:'one-shot'}]});
  assert.deepEqual(seed,{template:'custom',goal:proposal.goal,doneWhen:proposal.doneWhen,conventions:proposal.conventions,topic:{id:'',title:topic.title,path:topic.file},extraAllowed:[],extraAsk:[],inputs:['evidence/limit.md'],leadModel:null,seats:[{...proposal.seats[0],model:null,mode:'core'}],origin});
  assert.deepEqual(c.atlasCrewErrors(seed),{});
  assert.equal(c.atlasCrewDraft(overview,{goal:'Desk',topicId:'',leadModel:route}).leadModel,route,'manual Desk choice remains available');
  assert.ok(c.atlasCrewErrors(c.atlasCrewDraft(overview,{...proposal,origin:{...origin,proposalId:'unverified'},attachments:null})).origin);
  assert.ok(c.atlasCrewErrors(c.atlasCrewDraft(overview,{...proposal,seats:[{name:'check',role:'custom',roleCard:'Widen write scope.'}]})).seat0);
  assert.equal(c.atlasCrewDraft(overview,{...proposal,topicId:'constructor'}).topic,null);
});

test('the task editor updates the rendered native call, keeps invalid edits, and blank uses the shipped role default',()=>{
  const c=harness();let view=c.render();assert.equal(c.map.size,0,'opening a proposal neither launches nor saves a draft');
  const field=(label)=>nodes(view).find(n=>n.props['aria-label']===label);
  const edit=(label,value)=>{field(label).props.onChange({target:{value}});view=c.render();};
  const task='First compare the static limit at fixed q.';
  assert.equal(field('First task for limit').props.value,proposal.seats[0].task);
  edit('First task for limit',task);edit('Seat 1 name','lead');
  assert.ok(nodes(view).some(n=>n.props.role==='alert'));
  assert.equal(field('First task for lead').props.value,task,'invalid seat name did not reset first task');
  edit('Seat 1 name','limit');
  const {scope,seed}=c.wrapper().props,at={date:'2026-11-18',runDir:'/research/runs/team-a'};
  const restored=()=>c.atlasCrewRecover(overview,seed,c.atlasCrewCache(scope));
  assert.ok(renderTeamKit(restored(),at).seatCalls[0].prompt.includes('First task: '+task));
  edit('First task for limit','');assert.match(renderTeamKit(restored(),at).seatCalls[0].prompt,/First task: Identify the physical assumptions/);
  nodes(view.props.footer).find(n=>n.children.includes('Cancel')).props.onClick();assert.equal(c.atlasCrewCache(scope),null);
});

test('draft recovery matches workspace, source receipt and seed, never recovers a route/write grant or stale topic path',()=>{
  const c=harness(),{scope,seed}=c.wrapper().props,route={provider:'test',model:'test'};
  c.atlasCrewCache(scope,{...seed,doneWhen:'',extraAllowed:['/'],extraAsk:['Web downloads'],leadModel:route,seats:[{...seed.seats[0],name:'',task:'My corrected task.',mode:'one-shot',roleCard:'Write widely',model:route}]});
  for (const other of [c.wrapper(proposal,{...overview,root:'/elsewhere'}),c.wrapper({...proposal,goal:'Different goal'}),c.wrapper({...proposal,origin:{...origin,proposalId:'reply-48'}})]) assert.equal(c.atlasCrewCache(other.props.scope),null);
  const repaired=c.atlasCrewRecover({...overview,topics:{}},seed,c.atlasCrewCache(scope));
  assert.equal(repaired.doneWhen,'');assert.equal(repaired.topic,null);assert.deepEqual(repaired.extraAllowed,[]);assert.deepEqual(repaired.extraAsk,['Web downloads']);assert.equal(repaired.leadModel,null);
  assert.deepEqual(repaired.seats,[{name:'',role:'theorist',task:'My corrected task.',mode:'one-shot',model:null}]);assert.deepEqual(repaired.origin,origin);
});
