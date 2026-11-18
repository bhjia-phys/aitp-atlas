import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const modules=['66-teams','67-team-flow','67-team-room'].map(n=>readFileSync(new URL('../client/'+n+'.js',import.meta.url),'utf8')).join('\n');
const {target,send,answer,address,data,state,snapshot,diff} = new Function(modules+'\nreturn {target:teamRoomTarget,send:teamRoomSend,answer:teamRoomAnswer,address:teamRoomAddress,data:teamRoomData,state:teamRoomState,snapshot:teamRoomSnapshot,diff:teamRoomDiff};')();
const team={id:'run-a',leadId:'L',created:10,startedAt:10,seats:[{name:'theorist',role:'theorist'},{name:'referee',role:'referee'},{name:'missing'}]};
const rows={phase:'ready',byId:{L:{id:'L',running:false,projectionValues:{agentTeam:{enabled:true,tasks:[{id:'task-1',subject:'Check signs',status:'completed',owner:'theorist'},{id:'task-2',subject:'Review R01',status:'in_progress',owner:'referee'}]},subagentCatalog:[{id:'T',name:'theorist'},{id:'R',name:'referee'}]}},T:{id:'T',parentId:'L',running:false},R:{id:'R',parentId:'L',running:true}}};
const decision={id:'D01',status:'open',formatted:true,revision:'fingerprint',options:{A:'Submit job',B:'Reduce scope'}};
test('leading mention addresses one declared seat; bare text goes to lead, malformed addressing never silently reroutes',()=>{
  assert.deepEqual(address(' @theorist  Check the sign.\nExplain why.'),{name:'theorist',text:'Check the sign.\nExplain why.'});
  assert.deepEqual(address('Compare with @referee'),{name:'lead',text:'Compare with @referee'});
  for(const m of ['@','@referee','@referee @theorist both','@../bad text',' '])assert.throws(()=>address(m));
});
test('exact descendant of this verified root, not display name, sibling team, duplicate, archived or legacy record',()=>{
  assert.equal(target(team,rows,'lead'),'L');assert.equal(target(team,rows,'theorist'),'T');
  const byId=rows.byId, root=byId.L, pv=root.projectionValues;
  for(const [t,r,s] of [[team,rows,'missing'],[team,rows,'unknown'],[{...team,legacy:true},rows,'lead'],[team,{...rows,phase:'loading'},'lead'],[team,{...rows,byId:{...byId,L:{...root,id:'other'}}},'lead'],[team,{...rows,byId:{...byId,T:{parentId:'X'}}},'theorist'],[team,{...rows,byId:{...byId,T:{archived:true}}},'theorist'],[team,{...rows,byId:{...byId,L:{...root,projectionValues:{...pv,subagentCatalog:[...pv.subagentCatalog,{id:'T2',name:'theorist'}]}}}},'theorist']])assert.throws(()=>target(t,r,s));
});
test('real binding shape: recheck membership after acquisition; no child failure may prompt another session',async()=>{
  let live=rows, sent=[], releases=0; const sessions={list:{getSnapshot:()=>live},retain(id,opts){assert.deepEqual(opts,{source:'atlas'});return {sessionId:id,ready:Promise.resolve({session:{prompt:async(parts,mode)=>{sent.push({id,parts,mode});return {ok:true};}}}),release:()=>++releases};}};
  assert.equal(await send(team,'referee','Evidence?',sessions,()=>{}),'R');assert.deepEqual(sent,[{id:'R',parts:[{type:'text',text:'Evidence?'}],mode:'queue'}]);
  const base=sessions.retain; sessions.retain=(id,opts)=>{const ref=base(id,opts);live={phase:'ready',byId:{}};return ref;};
  await assert.rejects(()=>send(team,'theorist','spurious',sessions,()=>{})); assert.equal(sent.length,1);assert.equal(releases,2);
  await assert.rejects(()=>send({...team,legacy:true},'lead','mutate',sessions,()=>{}));assert.equal(releases,2);
});
test('scope guard requires exactly one live owner; workspace switching while retain opens sends nothing',async()=>{
  let ws={phase:'ready',items:[{path:'/fixture/a',sessionIds:['L']}]};const root='/fixture/a', registry={root,records:[team]}, store={get:()=>registry};
  let seen=0, sends=0, released=0;
  const guard=new Function('teamIndexStore','svc','tabRootKey','tabTeamMember',modules+'\nreturn teamRoomScopeGuard;')(store,()=>({list:{getSnapshot:()=>ws}}),s=>s,({sessionId,seatName},scope)=>{seen++;return scope.teams===registry && scope.rows===rows && sessionId==='T' && seatName==='theorist';})(team,root,()=>({root}));
  const sessions={list:{getSnapshot:()=>rows},retain:()=>{ws={...ws,items:[{path:'/fixture/b',sessionIds:['L']}]};return {ready:Promise.resolve({session:{prompt:()=>sends++}}),release:()=>released++};}};
  await assert.rejects(()=>send(team,'theorist','do not deliver',sessions,guard),/research workspace/);assert.equal(seen,1);assert.equal(sends,0);assert.equal(released,1);
  ws={phase:'ready',items:[{path:root,sessionIds:['L']},{path:'/fixture/b',sessionIds:['L']}]}; assert.throws(()=>guard('T','theorist',rows),/Cannot verify/);
  await assert.rejects(()=>send(team,'theorist','no guard',sessions),/verify the research workspace/);
});
test('decision uses revision and fresh receipt; no optimistic lead send; ambiguous or replayed results cannot duplicate prompt',async()=>{
  const calls=[];const write=async(...args)=>{calls.push(args);return {message:'Decision D01 answered: B.',replayed:false};};const notify=async s=>calls.push(s);
  assert.match(await answer(team,decision,'B','smaller',write,notify),/and sent/);assert.deepEqual(calls,[['teams/run-a/decisions/D01/answer',{method:'POST',body:{choice:'B',note:'smaller',revision:'fingerprint'}}],'Decision D01 answered: B.']);
  assert.match(await answer(team,decision,'B','',async()=>({replayed:true,message:'Never duplicate'}),notify),/already saved/);assert.equal(calls.length,2);
  await assert.rejects(()=>answer(team,decision,'B','',async()=>({message:'Unknown'}),notify),/no message was sent/);
  await assert.rejects(()=>answer(team,decision,'B','',write,async()=>{throw Error('Offline');}),/Answer saved to D01; delivery to the lead was not confirmed/);
  for(const [t,d,ch] of [[team,decision,'X'],[team,{...decision,revision:null},'B'],[{...team,legacy:true},decision,'B']])await assert.rejects(()=>answer(t,d,ch,'',()=>assert.fail('no writes'),notify),/Choose one/);
});
test('Flow and constellation evidence use exact report links and actual member activity; missing member is not invented',()=>{
  const artifact={formatted:true,id:'R01',title:'Sign report',seat:'theorist',status:'submitted',path:'/fixture/R01.md',task:'task-1'};
  const d=data(team,rows,{reports:[artifact],reviews:[]},200010);
  assert.equal(d.boardKnown,true); assert.equal(d.seats[0].done,1);assert.equal(d.seats[1].state,'working');assert.equal(d.seats[2].state,'not-started');assert.equal(d.seats[2].sessionId,null);
  assert.deepEqual(d.paths,[{id:'R01',from:'theorist',to:'referee',kind:'review'}]);assert.equal(d.flow[0].integrated,false);
  assert.equal(state(team,[d.lead,...d.seats],[decision],0,false),'Waiting on you');assert.equal(state({...team,ending:true},[d.lead],[],0,false),'Ending');assert.equal(state(team,[{state:'working'}],[],0,true),'Working');assert.equal(state(team,[d.lead],[],0,true),'Done');
});
test('Timeline diff does not invent historic timestamps at mount, replay unchanged rows, or treat unavailable as idle',()=>{
  const a=snapshot([{id:'task-3',owner:'referee',status:'pending'}],[{name:'lead',state:'unknown'}]);
  const b=snapshot([{id:'task-3',owner:'referee',status:'completed'}],[{name:'lead',state:'idle'}]);
  assert.deepEqual(diff(null,a),[]);assert.deepEqual(diff(a,a),[]);assert.deepEqual(diff(a,b),[{type:'task',text:'task-3: completed · referee',taskId:'task-3',observed:true}]);
});
