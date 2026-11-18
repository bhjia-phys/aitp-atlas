/** Opt-in, disposable real runtime acceptance: node test/m3-ui.mjs after building the M3 client.
 * Everything, including the model, browser profile, DSH team tree and example documents, is local.
 * The fixed model replies cannot fabricate a seat row. BOTH actual child model requests must contain
 * the exact approved task and the successful output of reading their own generated role card.
 */
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { runBrowserSmoke } from './ui-smoke.mjs';
import { seedTeamArtifacts } from './fixture.mjs';

// Screenshots are never updated during a normal regression run. Stage viewport-only bytes in
// memory and publish them only after the complete scenario and zero-console-error gate pass.
const capture=process.argv.includes('--capture') || process.env.ATLAS_M3_SHOTS==='1', shots=new Map();
await runBrowserSmoke(async function nativeTeams({q,wait,click,key,c,ev,place,model,fx}){
  const receipts=model.enableFixtureTeam(fx.root,'numerics');
  const desktop=async()=>{await c.call('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});await wait(`innerWidth===1440 && innerHeight===900`,'desktop screenshot viewport');};
  const shot=async name=>{if(!capture)return;await ev(`document.fonts.ready.then(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))`);shots.set(name,Buffer.from((await c.call('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false})).data,'base64'));};
  if(capture)await desktop();
  const goal='Check the fixture limiting coefficient and convention.';
  const js=JSON.stringify, byText=(sel,t)=>q(sel,`el.textContent.trim()===${js(t)}`);
  const fill=async(expr,text)=>{await click(expr,'write '+text);await key('a','KeyA',2);await c.call('Input.insertText',{text});};
  const getTeams=`(await (await fetch('/aitp-atlas/api/teams')).json()).teams`;
  const waitReceipt=async (f,label)=>{const end=Date.now()+60000;while(Date.now()<end){if(f(receipts()))return;await delay(100);}throw Error(label+'; fixture model receipts: '+js(receipts()));};
  // Simulate a previously pinned route removed by the installation. This is a fixture-only
  // preference, not a fabricated service/session: the real catalog must reject it before launch.
  assert.match(new URL(await ev('location.href')).hostname,/^127\.77\.\d+\.\d+$/);
  await ev(`localStorage.setItem('aitp-atlas:prefs.v1', JSON.stringify({...JSON.parse(localStorage.getItem('aitp-atlas:prefs.v1')||'{}'),model:{provider:'fixture-retired',model:'fixture-unavailable'}}))`);
  await c.call('Page.reload',{ignoreCache:true});await click(q('button[aria-label="Atlas"]'),'Atlas sidebar after fixture preference restore');
  await place('Desk');await fill(q('textarea[aria-label="Discussion question"]'),'Is the worm sampler equilibrating reproducibly?');
  await click(byText('[aria-label="Composer mode"] button','Team'),'team mode on Desk');
  await click(byText('button','Set up team…'),'inspect preselected unavailable team route');
  await fill(q('textarea[aria-label="Done when"]'),'The route should remain unavailable.');
  await wait(`document.body.innerText.includes('The selected lead model is not available')`,'real model catalog rejects retired route');
  assert.ok(await ev(`(${byText('button','Start the team')}).disabled`));
  assert.equal((await ev(`(async()=>${getTeams})()`)).length,0);
  await click(byText('.atlas-crew-sheet button','Cancel'),'dismiss blocked launch');
  console.log('PASS unavailable persisted lead route is explained and cannot create a run.');
  await place('Teams'); await click(byText('button','New team'),'start team assembly');
  await fill(q('textarea[aria-label="What should the team find out?"]'),goal);
  await fill(q('textarea[aria-label="Done when"]'),'Both named fixture seats have read their independent role cards.');
  // Use the real template, then remove the theorist in the assembly UI: exactly two real children.
  await click(byText('button','Theory and numerics'),'select template with numerical role');
  await click(q('[aria-label="Remove theorist"]'),'approve only numerics and referee');
  const select=q('select[aria-label="Topic"]');
  await click(select,'choose a real topic');
  await key('Escape','Escape'); await key('w','KeyW'); // use native type-ahead on the focused select
  if(await ev(`(${select}).value`)!=='mc/worm') {
    const idx=await ev(`Array.from((${select}).options).findIndex(o=>o.value==='mc/worm')`);assert.ok(idx>=0);
    await key('Home','Home');for(let i=0;i<idx;i++)await key('ArrowDown','ArrowDown');
  }
  assert.equal(await ev(`(${select}).value`),'mc/worm');
  await shot('assembly');
  await click(byText('button','Start the team'),'submit via actual Assemble dialog');
  const team=await wait(`(async()=>(${getTeams}).find(t=>t.goal===${js(goal)} && t.leadId))()`,'host-bound lead',30000);
  assert.ok(team.id && team.leadId);
  await waitReceipt(r=>r.roleRead.length===2,'Did not observe two actual child tasks and card reads');
  console.log('Private native-seat request evidence:',JSON.stringify(receipts()));
  await wait(`Boolean(${q('.atlas-team-room')})`,'native team room');
  assert.deepEqual(receipts().promptDelivered.sort(),['numerics','referee']);
  await click(byText('[aria-label="Team view"] button','Board'),'read real DSH team task');
  const taskId=await wait(`(${q('table[aria-label="Team board"] tr',`el.innerText.includes('Check the limiting coefficient')`)})?.querySelector('code')?.textContent`,'actual native board task',40000);
  assert.match(taskId,/^task-[0-9]+$/);await seedTeamArtifacts(fx, team.runDir,taskId);
  await click(byText('[aria-label="Team view"] button','Flow'),'return to flow');console.log('PASS genuine model-issued team_task_create visible in DSH board:',taskId);
  const roomTab=q('[role="tab"]',`el.getAttribute('aria-controls')===document.querySelector('.atlas-team-room')?.closest('[role="tabpanel"]')?.id`);
  const openRoom=()=>click(roomTab,'return to team room');
  const rowName=seat=>q('svg[aria-label="Team constellation"] [role="button"]',`el.getAttribute('aria-label')?.startsWith(${js(seat+' ·')})`);
  const members=[];
  for(const seat of ['numerics','referee']) {
    await click(rowName(seat),`open verified ${seat} session`);
    const body=q('.atlas-tab-body[data-session-id]',`el.innerText.includes(${js(`Fixture ${seat} received role card and first task.`)})`);
    const member=await wait(`(${body})?.getAttribute('data-session-id')`,'actual member transcript '+seat,25000);
    assert.notEqual(member,team.leadId);members.push(member);await openRoom();
  }
  assert.equal(new Set(members).size,2);
  console.log('PASS root lead → two real native named children, exact first prompts and generated role cards read via DSH.');

  const compose=q('textarea[aria-label="Message the team"]');
  await fill(compose,'@absent Do not route fixture unknown.'); await click(q('.atlas-room-composer button[type="submit"]'),'reject unknown address');
  await wait(`document.body.innerText.includes('Unknown team member')`,'visible unknown-member failure');
  await fill(compose,'@numerics Check fixture member delivery.');await click(q('.atlas-room-composer button[type="submit"]'),'send to numerics');
  await waitReceipt(r=>r.messages.member.length>0,'Member did not receive addressed prompt');
  assert.deepEqual(receipts().messages.member,['numerics']);assert.deepEqual(receipts().messages.unknown,[]);
  const pipeline='table[aria-label="Work pipeline"]';
  for(const [id,bodyText] of [['R01','Synthetic report text'],['V01','Synthetic review text']]) {
    const cell=q(`${pipeline} button`,`el.textContent.includes(${js(id)})`);
    await wait(`Boolean(${cell})`,id+' in Flow',40000); await click(cell,'open '+id);
    await wait(`Boolean(${q('[role="tabpanel"]',`el.innerText.includes(${js(bodyText)})`)})`,'real source '+id);await openRoom();
  }
  await click(byText('[aria-label="Team view"] button','Timeline'),'inspect the native team timeline');
  await wait(`Boolean(${q('.atlas-room-events li',`el.textContent.includes('R01')`)}) && Boolean(${q('.atlas-room-events li',`el.textContent.includes('V01')`)})`,'report and review file events in Timeline');
  await click(byText('[aria-label="Team view"] button','Flow'),'return to the evidence-linked work row');
  if(capture){
    // Close only the four fixture detail tabs using their own close controls; this does not
    // delete any native session, report, review or registry record. Restore single-room geometry.
    const closeDetails=q('button[aria-label^="Close "]',`/^(Close You are the (numerics|referee) seat|Close 0[1-9]-.*\\.md)/.test(el.ariaLabel)`);
    for(let i=0;i<6 && await ev(`Boolean(${closeDetails})`);i++)await click(closeDetails,'close fixture detail tab');
    await openRoom();await desktop();
    await wait(`document.querySelectorAll('.atlas-pane-divider').length===0 && Boolean(${q('aside[aria-label="Logbook"]')})`,'single wide Team room with Logbook');
    await wait(`Boolean(${q('button',`['Collapse sidebar','收起侧边栏'].includes(el.ariaLabel)`)})`,'native sidebar remains expanded');
    await wait(`Boolean(${q('table[aria-label="Work pipeline"] tr',`el.innerText.includes(${js(taskId)}) && el.innerText.includes('R01') && el.innerText.includes('V01')`)})`,'visible task → report → review on one Flow row');
    // The earlier @send feedback is transient; do not cover the review evidence with its toast.
    await wait(`!document.body.innerText.includes('Sent to numerics.')`,'toast finished',15000);
  }
  // Test both color palettes while the product chrome is visible, before focusing a single pane.
  const both=new Set();for(let i=0;i<5;i++) {
    const mode=await ev(`document.querySelector('.atlas-root').dataset.themeBase`);if(!both.has(mode))await shot('room-'+mode);both.add(mode);if(both.has('night')&&both.has('day'))break;
    await click(q('[aria-label="Atlas destinations"]'),'Atlas destinations theme');await click(q('[role="menuitem"]',`el.textContent.trim().startsWith('Theme:')`),'cycle mood');
  }
  assert.ok(both.has('night')&&both.has('day'));
  // Reading artifacts split the workbench. Use the product's own Focus pane so one pixel
  // of viewport changes the real Team room by one pixel instead of half as much.
  await click(q('button[aria-label="Focus pane"]',`el.closest('.atlas-strip')?.contains(${roomTab})`),'focus Team room pane');
  // Verify the actual component width (the native sidebar may consume viewport width).
  const resize=async target=>{let viewport=await ev('innerWidth');for(let i=0;i<6;i++){
    const actual=await ev(`Math.round(document.querySelector('.atlas-team-room').getBoundingClientRect().width)`);if(Math.abs(target-actual)<=1)return;
    viewport=Math.max(640,viewport+target-actual);await c.call('Emulation.setDeviceMetricsOverride',{width:Math.round(viewport),height:1000,deviceScaleFactor:1,mobile:false});await delay(120);
  }throw Error('Could not size real team room to '+target);};
  for(const target of [1041,1039,761,759]) {
    await resize(target);const columns=await ev(`getComputedStyle(document.querySelector('.atlas-room-band')).gridTemplateColumns.trim().split(/\\s+/).length`);
    assert.equal(columns,target>=760?2:1,`mission band at ${target}px`);
    const aside=q('aside[aria-label="Logbook"]');assert.equal(await ev(`Boolean(${aside})`),target>=1040,`Logbook at ${target}px`);
  }
  await click(q('.atlas-room-mission button',`el.textContent.trim().startsWith('Logbook')`),'open responsive Logbook');await click(q('button[aria-label="Answer D01"]'),'answer outstanding decision');
  await shot('logbook-narrow');
  await click(q('input[type="radio"][value="B"]'),'choose option B');await fill(q('.atlas-room-need textarea'),'fixture decision receipt');
  await click(byText('button','Save answer'),'save and dispatch decision');
  await waitReceipt(r=>r.messages.decision.length>0,'Decision did not reach actual lead');assert.deepEqual(receipts().messages.decision,['lead']);
  const answer=await fs.readFile(path.join(team.runDir,'decisions/D01-convention.md'),'utf8');assert.match(answer,/status:\s*answered/);assert.match(answer,/fixture decision receipt/);assert.equal((answer.match(/^## Answer/gm)||[]).length,1);
  console.log('PASS actual @seat routing, unknown address rejection, report+review sources, both moods, 1040/760 breakpoints, persisted decision and lead delivery.');
});
if(capture){
  assert.deepEqual([...shots.keys()].sort(),['assembly','logbook-narrow','room-day','room-night']);
  const dir=new URL('../design/1.0/reports/screens/',import.meta.url);await fs.mkdir(dir,{recursive:true});
  for(const [name,png] of shots)await fs.writeFile(new URL('m3-'+name+'.png',dir),png);
  console.log('Saved four private viewport PNGs in design/1.0/reports/screens.');
}
