import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const code=['65-activity','66-teams','67-team-room','69-team-seat','72-tabs'].map(n=>readFileSync(new URL(`../client/${n}.js`,import.meta.url),'utf8')).join('\n');
const c=new Function(`const rowOf=(s,id)=>s?.byId?.[id],h=(type,props,...children)=>({type,props,children}),Empty='empty',TextButton='button',SeatGlyph='glyph',EmbeddedConversation='chat',Banner='banner';${code}\nreturn {atlasAddTeamSeat,atlasSeatLeadGuard,atlasSeatBinding,TeamMemberTab,teamRoomSend}`)();
const root='/fixture',first={name:'theorist',role:'theorist',model:null},draft={name:'referee',role:'referee',description:'Check the sign.',mode:'one-shot'};
function setup(){const team={id:'t',name:'Ward',leadId:'lead-id',seats:[first]};const scope={root,teams:{root,records:[team]},registry:{root,records:[]},rows:{phase:'ready',byId:{'lead-id':{id:'lead-id',cwd:root,running:false,projectionValues:{agentTeam:{enabled:true},subagentCatalog:[{id:'child',name:'theorist',phase:'idle'}]}},child:{id:'child',parentId:'lead-id',running:true,projectionValues:{modelSelection:{lastUsed:{model:'observed'}}}}}}};
const call={name:'referee',description:'Check the sign.',prompt:'Read the charter and role, derive the sign and report.'},events=[];const result={team:{...team,seats:[...team.seats,draft]},seatCall:call,replayed:false};
const deps={scope:()=>scope,services:{sessions:{retain(){}},teams:{setEnabled(){}}},post:async(...args)=>{events.push(['post',...args]);return result;},send:async(...args)=>{events.push(['send',...args]);}};return {team,scope,call,events,result,deps};}
function all(node){return !node || typeof node!=='object'?[]:[node,...(node.children||[]).flat(Infinity).flatMap(all)];}
test('the verified named seat has a real model, role and state; only a retained native member gets a conversation',()=>{
 const {team,scope}=setup();let teamLink;const props={team,seatName:'theorist',sessionId:'child',scope,overview:{root},onTeam:id=>teamLink=id,retained:true};
 const drawn=c.TeamMemberTab(props);assert.ok(all(drawn).find(n=>n.type==='chat'&&n.props.sessionId==='child'));assert.equal(c.atlasSeatBinding(team,'theorist','child',scope).model,'observed');assert.ok(all(drawn).some(n=>n.children.includes('running')));all(drawn).find(n=>n.props?.title==='Open Team room').props.onClick();assert.equal(teamLink,'t');
 for(const change of [{retained:false},{team:{...team,legacy:true}},{sessionId:'alien'},{overview:{root:'/another'}},{seatName:'referee'}])assert.ok(!all(c.TeamMemberTab({...props,...change})).some(n=>n.type==='chat'));
 scope.rows.byId.child.parentId='not-this-team';assert.equal(c.atlasSeatBinding(team,'theorist','child',scope),null);
});
test('post the role to its workspace before sending the exact host-generated call to its verified lead',async()=>{
 const {team,deps,call,events}=setup();const out=await c.atlasAddTeamSeat(team,root,draft,deps);assert.equal(out.delivered,true);assert.equal(events.length,2);assert.deepEqual(events[0],['post','teams/t/seats',{...draft,model:null},{expectedRoot:root}]);assert.equal(events[1][0],'send');assert.equal(events[1][1],'lead-id');assert.ok(events[1][2].endsWith('subagent '+JSON.stringify(call)));
});
test('the shared room sender rechecks workspace ownership after awaiting a DSH binding and releases without prompting',async()=>{
 const a=setup();let activeRoot=root,releases=0,prompts=0;const sessions={list:{getSnapshot:()=>a.scope.rows},retain:()=>({ready:Promise.resolve().then(()=>{activeRoot='/replacement';return {session:{prompt:async()=>{prompts++;return {ok:true};}}};}),release:()=>releases++})};
 a.deps.send=(_id,text)=>c.teamRoomSend(a.team,'lead',text,sessions,()=>{if(activeRoot!==root)throw Error('workspace changed');});
 await assert.rejects(c.atlasAddTeamSeat(a.team,root,draft,a.deps),/workspace changed/);assert.equal(prompts,0);assert.equal(releases,1);assert.equal(a.events[0][3].expectedRoot,root);
});
test('a replayed seat never sends again; uncertain first or second stages never retry automatically',async()=>{
 const a=setup();a.result.replayed=true;assert.equal((await c.atlasAddTeamSeat(a.team,root,draft,a.deps)).delivered,false);assert.equal(a.events.length,1);
 const b=setup();let posts=0;b.deps.post=async()=>{posts++;throw Error('lost response');};await assert.rejects(c.atlasAddTeamSeat(b.team,root,draft,b.deps),e=>e.attempted&&/unconfirmed/.test(e.message));assert.equal(posts,1);assert.deepEqual(b.events,[]);
 const d=setup();let sends=0;d.deps.send=async()=>{sends++;throw Error('carrier closed');};await assert.rejects(c.atlasAddTeamSeat(d.team,root,draft,d.deps),e=>e.team===d.result.team&&e.call===d.call&&/Delivery to the lead is unconfirmed/.test(e.message));assert.equal(sends,1);assert.equal(d.events.length,1);
});
test('closed workspace, legacy/disabled team, unknown catalog and duplicate live name fail before posting; recheck after POST',async()=>{
 for(const modify of [a=>{a.scope.root='/different';},a=>{a.team.legacy=true;},a=>{a.team.ending=true;},a=>{a.scope.rows.byId['lead-id'].projectionValues.agentTeam.enabled=false;},a=>{delete a.scope.rows.byId['lead-id'].projectionValues.subagentCatalog;},a=>{a.scope.rows.byId['lead-id'].projectionValues.subagentCatalog.push({name:draft.name,id:'other'});},a=>{a.deps.services.sessions={};}]){const a=setup();modify(a);await assert.rejects(c.atlasAddTeamSeat(a.team,root,draft,a.deps));assert.deepEqual(a.events,[]);}
 const a=setup(),post=a.deps.post;a.deps.post=async(...args)=>{const r=await post(...args);a.scope.root='/new';return r;};await assert.rejects(c.atlasAddTeamSeat(a.team,root,draft,a.deps),/seat is recorded/);assert.equal(a.events.length,1);
});
