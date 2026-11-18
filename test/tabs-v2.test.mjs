import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';

const dir = new URL('../client/', import.meta.url);
const js = readdirSync(dir).filter(f => f.endsWith('.js') && f !== '90-register.js').sort().map(f => readFileSync(new URL(f, dir), 'utf8')).join('\n');
function client(storage = new Map()) {
  const window = { localStorage: { getItem: k => storage.get(k), setItem: (k, v) => storage.set(k, v) } };
  const React = { createElement() {}, createContext: () => ({}), Component: class {} };
  return new Function('require','window', js + '\nreturn { emptyTabState, tabSpec, tabDestination, tabOpenState, tabActivate, tabPromote, tabMoveState, tabCloseState, tabReopen, tabScreenLayout, tabFollowState, tabFoldPreviews, retainedTabIds, besideDiscussion, discussionObservations, discussionTargetRows, migrateTabState, restoreTabSnapshot, saveTabState, loadTabState, readTabSource, scopedTabState, tabStorageKey, tabSessionInScope, tabV2Label };')(n => n === 'react' ? React : {}, window);
}
const c = client();
const spec = (view, props = {}) => c.tabSpec({view, ...props},new Set(['/r/topic.md']));
const file = n => spec('doc',{path:'/r/' + n + '.md'});
const open = (s, spec, from='desk', opts={}, dirty) => c.tabOpenState(s,from,spec,opts,dirty);

test('RT-1…8: pure target selection, including a moved place, pane-relative modifiers, reuse and narrow folding', () => {
  let s = open(c.emptyTabState(), spec('map'));
  s = open(s, file('topic'), 'place:map');
  const targets = [
    ['file:/r/topic.md',spec('library'),{},'left'], ['place:map',file('a'),{},'right'], ['file:/r/topic.md',file('a'),{},'left'],
    ['desk',spec('discussion',{sessionId:'new'}),{},'left'], ['file:/r/topic.md',spec('discussion',{sessionId:'new'}),{},'left'],
    ['desk',file('a'),{ctrlKey:true},'left'], ['file:/r/topic.md',file('a'),{metaKey:true},'right'],
    ['file:/r/topic.md',file('a'),{shiftKey:true},'left'], ['desk',file('topic'),{ctrlKey:true},'right'],
    ['desk',spec('team',{sessionId:'lead'}),{},'left'], ['desk',spec('member',{sessionId:'child'}),{},'right'],
    ['file:/r/topic.md',spec('preview',{main:'/r/main.tex'}),{},'left'], ['desk',file('a'),{narrow:true},'left'],
  ];
  for (const [from,to,opts,p] of targets) assert.equal(c.tabDestination(s,from,to,opts),p,`${from} → ${to.key}`);
  s = open(s,spec('discussion',{sessionId:'q'}));
  assert.equal(c.tabDestination(s,'discussion:q',file('b')), 'right');
  s = c.tabMoveState(s,'place:map','right');
  assert.equal(c.tabDestination(s,'place:map',file('b')), 'right');
  assert.equal(c.tabDestination(s,'place:map',file('b'),{otherPane:true}), 'left');
});

test('TB-2…4: preview replacement is local; pin, drag, edit and passage promotion protect the body', () => {
  let s = open(c.emptyTabState(), file('topic'));
  const t = 'file:/r/topic.md';
  assert.equal(s.tabs[t].kind,'topic'); assert.equal(s.tabs[t].temporary,true);
  s = open(s,file('x'),t);
  s = open(s,spec('paper',{url:'https://arxiv.org/abs/2401.01234'}));
  assert.equal(s.tabs[t],undefined); assert.ok(s.tabs['file:/r/x.md']);
  s = c.tabPromote(s,'file:/r/x.md');
  const paper = s.layout.active.right;
  s = c.tabMoveState(s,paper,'left',0);
  assert.equal(s.layout.left[0],'desk'); assert.equal(s.tabs[paper].temporary,false);
  s = open(s,file('a'),'desk',{button:1}); assert.equal(s.tabs[s.layout.active.right].temporary,false);
  s = open(s,{...file('editing'),edit:true}); assert.equal(s.tabs[s.layout.active.right].temporary,false);
  s = open(s,file('dirty')); const dirty = s.layout.active.right;
  s = open(s,file('safe'),'desk',{}, {[dirty]:true}); assert.equal(s.tabs[dirty].temporary,false);
  const anchor = {...file('x'),anchor:'the-limit'};
  s = open(s,anchor); assert.equal(s.lastPane,'left'); assert.equal(s.tabs['file:/r/x.md'].anchor, 'the-limit');
  assert.equal(c.tabMoveState(s,'desk','right'),s); assert.equal(c.tabCloseState(s,'desk'),s);
});

test('TB-5: last 20 closed entries, original pane and position, independent DSH sessions, no replay of a dirty editor', () => {
  let s = c.emptyTabState();
  for (let i=0;i<23;i++) {s=open(s,file(String(i)),'desk',{permanent:true});s=c.tabCloseState(s,s.layout.active.right);}
  assert.equal(s.closed.length,20); s=c.tabReopen(s); assert.equal(s.tabs[s.layout.active.right].path,'/r/22.md');
  s=open(s,spec('discussion',{sessionId:'q'}));s=open(s,spec('discussion',{sessionId:'r'}));
  assert.equal(s.tabs['discussion:q'].sessionId,'q'); s=c.tabCloseState(s,'discussion:q'); assert.equal(s.closed.at(-1).tab.sessionId,'q');
  s=c.tabReopen(s); assert.equal(s.tabs['discussion:r'].sessionId,'r'); assert.equal(s.tabs['discussion:q'].sessionId,'q');
  s=open(s,{...file('dirty'), edit:true});s=c.tabCloseState(s,s.layout.active.right);s=c.tabReopen(s);
  assert.ok(!s.tabs[s.layout.active.right].edit); assert.ok(!s.tabs[s.layout.active.right].temporary);
});

test('DS-11: two conversations stay visible, move/close/reopen/restore keep their identity, only the least recently shown hidden provider is evicted',()=>{
  let s=c.emptyTabState(),cache=[];
  const q=i=>'discussion:q'+i, view=()=>{cache=c.retainedTabIds(s.tabs,s.order,[s.layout.active[s.lastPane],...Object.values(s.layout.active)],cache);};
  s=open(s,spec('discussion',{sessionId:'q0'}));view();
  for(let i=1;i<=5;i++){s=open(s,spec('discussion',{sessionId:'q'+i}),q(0),{otherPane:true});view();}
  assert.deepEqual(s.layout.active,{left:q(0),right:q(5)}); assert.equal(cache.length,6);
  s=c.tabActivate(s,q(1));view(); s=open(s,spec('discussion',{sessionId:'q6'}),q(0),{otherPane:true});view();
  assert.ok(!cache.includes(q(2)));assert.ok(cache.includes(q(0)));assert.ok(cache.includes(q(1)));assert.ok(s.tabs[q(2)]);
  s=c.tabActivate(s,q(2));view();assert.ok(cache.includes(q(2)));assert.ok(!cache.includes(q(3)));
  const t=s.tabs[q(2)],order=s.order;s=c.tabMoveState(s,q(2),'left',0);assert.equal(s.tabs[q(2)],t);assert.equal(s.order,order);
  s=c.tabCloseState(s,q(2));view();assert.ok(!cache.includes(q(2)));s=c.tabReopen(s);view();assert.equal(s.tabs[q(2)].sessionId,'q2');assert.equal(s.layout.active.left,q(2));
  c.saveTabState(s,'/r');const restored=c.loadTabState('/r',{registry:{root:'/r', records:Array.from({length:7},(_,i)=>({id:'q'+i}))}});assert.deepEqual(restored.layout,s.layout);assert.equal(restored.order.filter(id=>id.startsWith('discussion:')).length,7);
});

test('DS-19/20: current is strictly the visible opposite discussion, never a hidden discussion, a member, or a discussion on the same side',()=>{
  let s=open(c.emptyTabState(),file('note'),'desk',{samePane:true});const from=s.layout.active.left;
  s=open(s,spec('discussion',{sessionId:'a'}),from);s=open(s,spec('discussion',{sessionId:'b'}),from);
  const visible=Object.values(s.layout.active);assert.equal(c.besideDiscussion(s.tabs,s.layout,visible,from),'b');assert.equal(c.besideDiscussion(s.tabs,s.layout,visible,'desk'),null);
  assert.equal(c.besideDiscussion(s.tabs,s.layout,[from],from),null);s=c.tabActivate(s,'discussion:a');assert.equal(c.besideDiscussion(s.tabs,s.layout,Object.values(s.layout.active),from),'a');
  s=open(s,spec('member',{sessionId:'child'}),from);assert.equal(c.besideDiscussion(s.tabs,s.layout,Object.values(s.layout.active),from),null);assert.equal(c.besideDiscussion(s.tabs,c.tabScreenLayout(s,true),[from],from),null);
  const records=[{id:'a',title:'Renamed A'},{id:'b',title:'Resolved B',status:'resolved'},{id:'c',title:'Other C'},{id:'d',title:'Deleted'}];
  assert.deepEqual(c.discussionTargetRows(s.tabs,s.order,records,{phase:'ready',byId:{a:{},b:{},c:{}}}),[{id:'a',title:'Renamed A'},{id:'c',title:'Other C'}]);
});

test('DS-3/12: independent turn/seen transitions; rename, disconnect and row absence are not finished replies',()=>{
  const records=[{id:'a'},{id:'b'}];let previous=new Map();
  const step=(r,visible,time)=>{const out=c.discussionObservations(previous,records,{byId:r},visible,time);previous=out.snapshots;return out.patches;};
  assert.deepEqual(step({a:{running:true},b:{running:true}},['b'],10),[]);
  assert.deepEqual(step({a:{running:false},b:{running:false}},['b'],11),[{id:'a',patch:{observeTurn:{after:0,seen:false}}},{id:'b',patch:{observeTurn:{after:0,seen:true}}}]);
  records[0].title='New title';records[0].updated=15;assert.deepEqual(step({a:{running:false},b:{running:false}},['b'],16),[]);
  assert.deepEqual(step({a:{running:false},b:{running:false}},['a'],20),[{id:'a',patch:{observeTurn:{after:0,seen:true}}}]);
  step({a:{running:true}},[],21);assert.deepEqual(step({},[],22),[]);assert.deepEqual(step({a:{running:false}},[],23),[]);
});

test('MG-2: migrated route, old IDs/anchors/order, companion identity, one read of the old keys', () => {
  const store = new Map(); const local=client(store);
  const set=(k,v)=>store.set('aitp-atlas:'+k,JSON.stringify(v));
  set('tabs',{tabs:[{id:'f1',kind:'file',path:'/r/x.md',anchor:'h'},{id:'pdf1',kind:'preview',main:'/r/doc.tex',pdf:'/r/doc.pdf'}],layout:{left:['discussion'],right:['f1','page','pdf1'],active:{left:'discussion',right:'page'},split:77}});
  set('route',{view:'doc',path:'/r/x.md',anchor:'new'});set('companion',{id:'real'});set('companion-last','older');
  const scope={registry:{root:'/r',records:[{id:'real'}]}};
  let s=local.loadTabState('/r',scope);assert.deepEqual(s.layout.left,['desk','discussion:real']);assert.deepEqual(s.layout.right,['f1','pdf1']);assert.equal(s.tabs.f1.anchor,'new');assert.equal(s.layout.active.right,'f1');
  assert.equal(s.lastDiscussion,'real');assert.equal(s.layout.split,77);
  local.saveTabState(s,'/r');set('companion',{id:'obsolete'});set('route',{view:'search'});const v2=local.loadTabState('/r',scope);assert.deepEqual(v2.layout,s.layout);assert.equal(v2.tabs['discussion:obsolete'],undefined);assert.ok(store.has('aitp-atlas:tabs'));
  assert.equal(local.migrateTabState(null,{view:'activity'},null,'last').tabs['place:discussions'].view,'discussions');
  assert.equal(local.migrateTabState(null,{view:'doc',path:'/r/topic.md'},null,null,null,new Set(['/r/topic.md'])).tabs['file:/r/topic.md'].kind,'topic');
  assert.deepEqual(local.migrateTabState(null,{view:'home'},null,null,{path:'/r/x.md',anchor:'h'}).layout.right,['file:/r/x.md']);
});

test('root-bound layout never retains another root’s transcript or reopens its closed history, even during catalog startup',()=>{
  const store=new Map(), local=client(store), a='/fixture/Research', b='/fixture/research';
  const aRegistry={root:a,records:[{id:'A'}]}, bRegistry={root:b,records:[{id:'B'}]};
  let s=open(c.emptyTabState(),spec('discussion',{sessionId:'A',title:'A private title'}));
  s=open(s,spec('discussion',{sessionId:'closed-A'}));s=c.tabCloseState(s,'discussion:closed-A');
  local.saveTabState(s,a); assert.notEqual(local.tabStorageKey(a),local.tabStorageKey(b));
  assert.equal(local.tabStorageKey('C:\\Fixture\\ROOT\\'),local.tabStorageKey('c:/fixture/root'));
  const snapshot=store.get('aitp-atlas:'+local.tabStorageKey(a));store.set('aitp-atlas:tabs.v2',snapshot);
  const rows={phase:'ready',byId:{A:{cwd:a},'closed-A':{cwd:a},B:{cwd:b}}};
  const buckets=[{}, {registry:aRegistry,rows}, {registry:{...bRegistry,loading:true},rows}, {registry:{...bRegistry,error:'offline'},rows}, {registry:bRegistry,rows}];
  for (const scope of buckets) {
    const view=local.loadTabState(b,scope);assert.deepEqual(c.retainedTabIds(view.tabs,view.order,Object.values(view.layout.active),[]),[]);assert.deepEqual(view.closed,[]);assert.equal(view.lastDiscussion,null);assert.ok(!JSON.stringify(view).includes('private title'));
    assert.equal(c.tabReopen(view),view);
  }
  assert.deepEqual(local.loadTabState(a,{registry:aRegistry,rows}).layout,s.layout);assert.equal(local.loadTabState(a,{registry:aRegistry,rows}).closed[0].tab.sessionId,'closed-A');assert.equal(store.get('aitp-atlas:tabs.v2'),snapshot);
});

test('legacy migration demands matching path/owner evidence; DSH-confirmed hand-offs remain accessible despite an external destination',()=>{
  const root='/fixture/r',elsewhere='/fixture/r-long', nested=root+'/nested';
  const registry={root,records:[{id:'here',movedTo:'handoff'}]};
  const rows={phase:'ready',byId:{here:{cwd:root},mine:{cwd:root},foreign:{cwd:elsewhere},collision:{cwd:nested},child:{parentId:'mine'},shared:{cwd:elsewhere},handoff:{cwd:elsewhere}}};
  const workspaces={phase:'ready',items:[{path:root,sessionIds:['here','mine']},{path:nested,sessionIds:['collision']},{path:elsewhere,sessionIds:['foreign','handoff','shared']}]};
  const scope={root,registry,rows,workspaces,legacy:[{id:'shared',context:{topic:{path:root+'/shared.md'}}}]};
  for(const id of ['here','mine','child','handoff'])assert.equal(c.tabSessionInScope(id,scope),true,id);
  for(const id of ['foreign','collision','shared','unknown'])assert.equal(c.tabSessionInScope(id,scope),false,id);
  assert.equal(c.tabSessionInScope('mine',{...scope,registry:{root:elsewhere,records:[{id:'mine'}]}}),false);
  assert.equal(c.tabSessionInScope('foreign',{...scope,workspaces:null,rows:{phase:'pending',byId:{foreign:{cwd:root}}}}),false);
  let s=c.emptyTabState();for(const [view,fields] of [['doc',{path:root+'/mine.md'}],['doc',{path:elsewhere+'/secret.md'}],['doc',{path:root+'/../else.md'}],['preview',{main:root+'/ok.tex',pdf:elsewhere+'/secret.pdf'}],['paper',{url:'https://example.invalid/private'}],['search',{q:'foreign query'}]])s=open(s,spec(view,fields),'desk',{permanent:true});
  const recovered=c.scopedTabState({state:s,legacy:true},scope);assert.deepEqual(recovered.order,['desk','file:'+root+'/mine.md','place:search']);assert.ok(!JSON.stringify(recovered).includes('foreign query'));
});

test('M3: a room is keyed by run, a member by a verified lead and named seat, never just a cached title',()=>{
  let s=c.emptyTabState(); const team={id:'run',name:'Renamed room',leadId:'real-lead',seats:[{name:'numerics'}]};
  const room=spec('team',{teamId:'run',title:'Stale'}),member=spec('member',{teamId:'run',sessionId:'child',seatName:'numerics'});
  s=open(s,room); s=open(s,member,room.key);
  const root='/mine'; const scope={root,teams:{root,records:[team]},registry:{root,records:[]},rows:{phase:'ready',byId:{'real-lead':{cwd:root,projectionValues:{agentTeam:{enabled:true},subagentCatalog:[{name:'numerics',id:'child'}]}},child:{parentId:'real-lead'}}}};
  const snapshot={state:s,legacy:false},restore=scope=>c.scopedTabState(snapshot,scope);
  assert.deepEqual(restore(scope).layout.right,[member.key]);assert.equal(restore(scope).tabs[room.key].title,'Renamed room');
  const changed={...scope,teams:{root,records:[{...team,leadId:null}]}};assert.ok(restore(changed).tabs[room.key]);assert.equal(restore(changed).tabs[member.key],undefined);
  for(const teams of [{root:'/other',records:[team]},{root,loading:true,records:[team]},{root,records:[]}])assert.deepEqual(restore({...scope,teams}).order,['desk']);
  assert.equal(restore({...scope,teams:{root,records:[{...team,legacy:true}]}}).tabs[member.key],undefined);
});

test('in-place anchors and LaTeX jumps guard the originating editor, including case-folded aliases and an already-open target', () => {
  const ask = [], dirty = {'file:/r/main.tex':true};
  let s = open(c.emptyTabState(),spec('doc',{path:'/r/main.tex',edit:true}));
  const id = s.layout.active.right;
  const follow=(from,path,fields,allow)=>c.tabFollowState(s,from,spec('doc',{path,...fields}),{},dirty,k=>{ask.push(k);return allow;});
  s=follow('desk','/R/Main.TEX',{anchor:'L42'},false);
  assert.equal(s.tabs[id].path,'/r/main.tex','link reuse cannot change the editor mount key'); assert.equal(s.tabs[id].edit,true); assert.equal(s.tabs[id].anchor,'L42');
  s=follow(id,'/R/Main.TEX',{anchor:'L8'},false);assert.equal(s.tabs[id].edit,true);assert.equal(s.tabs[id].path,'/r/main.tex');assert.deepEqual(ask,[]);
  assert.equal(follow(id,'/r/main.tex',{edit:false},false),s);assert.equal(follow(id,'/r/section.tex',{stay:true,edit:true},false),s);
  s=follow(id,'/r/section.tex',{stay:true,edit:true,anchor:'L4'},true);assert.deepEqual(ask,[id,id,id]);assert.equal(s.tabs[id].path,'/r/section.tex');assert.equal(s.tabs[id].anchor,'L4');
  s=open(s,spec('doc',{path:'/r/open.tex',edit:true}),id);s=follow(id,'/r/open.tex',{stay:true,edit:true},false);assert.equal(s.tabs[id].path,'/r/section.tex');assert.equal(s.layout.active.left,'file:/r/open.tex');assert.equal(ask.length,3);
});

test('narrow fold keeps both mounted in stable order but a subsequent preview replaces just the last-used slot', () => {
  let s = open(c.emptyTabState(),file('a'));s=open(s,file('b'),s.layout.active.right);const order=s.order;
  s=c.tabFoldPreviews(s);assert.equal(s.order,order);assert.equal(s.tabs['file:/r/a.md'].temporary,false);assert.equal(s.tabs['file:/r/b.md'].temporary,true);
  s=open(s,file('c'),'desk',{narrow:true});assert.ok(s.tabs['file:/r/a.md']);assert.equal(s.tabs['file:/r/b.md'],undefined);assert.deepEqual(s.layout.right,['file:/r/a.md']);
});

test('v2 labels distinguish topic notes, paper URLs and compiled LaTeX previews', () => {
  const ov={rootFile:'/r/root.md',title:'Research',topics:{t:{file:'/r/topic.md',title:'Topic: the question'}}};
  assert.deepEqual([spec('desk'),spec('write'),file('topic'),spec('doc',{path:'/r/root.md'}),file('x'),spec('preview',{main:'/r/main.tex'}),spec('paper',{url:'https://arxiv.org/abs/2401.01234v5'})].map(t=>c.tabV2Label(t,ov)),['Desk','Write','Topic','Research','x.md','Preview · main.pdf','arXiv 2401.01234v5']);
});

test('SH-4/6: narrow layout projects both strips without reparenting or destroying the saved layout; corrupt storage is sanitized', () => {
  const s = open(c.emptyTabState(), file('a'));const order=s.order;
  assert.deepEqual(c.tabScreenLayout(s,true).left,['desk',s.layout.active.right]);assert.equal(c.tabScreenLayout(s,true).active.left,s.layout.active.right);
  assert.equal(c.tabScreenLayout(s,false),s.layout);assert.equal(s.order,order);
  const restored=c.restoreTabSnapshot({tabs:[{id:'a',kind:'file',path:'/a',temporary:true},{id:'b',kind:'file',path:'/b',temporary:true},{id:'x',kind:'paper',url:'javascript:alert(1)'},{id:'__proto__',kind:'file',path:'/e'}],layout:{left:['a','b','missing','a','desk'],right:['a','desk'],active:{left:'invalid'},split:99},closed:'oops'});
  assert.deepEqual(restored.order,['desk','a','b']);assert.deepEqual(restored.layout.left,restored.order);assert.deepEqual(restored.layout.right,[]);assert.equal(restored.layout.split,80);assert.equal(restored.tabs.b.temporary,false);
  const blocked=client({get(){throw Error('blocked')},set(){throw Error('blocked')}});assert.deepEqual(blocked.loadTabState(),c.emptyTabState());assert.doesNotThrow(()=>blocked.saveTabState(s));
});
