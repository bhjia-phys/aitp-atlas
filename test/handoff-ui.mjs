// Opt-in real-browser DS-22 acceptance. The shared runner creates (and removes)
// a private DSH_HOME, Atlas registry, loopback mock model and fresh Chromium.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {runBrowserSmoke} from './ui-smoke.mjs';

await runBrowserSmoke(async function handoffTwoWorkspaces({q,wait,click,key,ev,c,fx,place}) {
  // The debug service bridge is enabled only on THIS disposable origin. Reload
  // to activate it; never navigate to or query a user's Host/browser tab.
  assert.match(await ev('location.hostname'),/^127\.77\.\d+\.\d+$/);
  await ev("localStorage.setItem('aitp-atlas:debug','1')"); await c.call('Page.reload',{});
  await wait('!!window.__aitpAtlas','private Atlas fixture service bridge');
  if (!await ev(`Boolean(${q('[aria-label="Atlas destinations"]')})`)) {
    await click(q('button,[role="button"]',`[el.title,el.ariaLabel,el.textContent.trim()].includes('Atlas')`),'reopen fixture Atlas');
  }
  const targetDir=fx.file('secondary-empty-workspace'); await mkdir(targetDir);
  const targetId=await ev(`(async()=> (await __aitpAtlas.svc('workspaces').create({path:${JSON.stringify(targetDir)}})).workspaceId)()`);
  assert.ok(targetId);
  await place('Desk'); const question='Fixture hand-off: compare the two Monte Carlo estimates.';
  await click(q('[aria-label="Discussion question"]'),'source discussion input');
  await c.call('Input.insertText',{text:question}); await click(q('[aria-label="Send discussion"]'),'send fixture question');
  const sourceId=await wait(`(async()=> (await (await fetch('/aitp-atlas/api/discussions?status=all')).json()).discussions.find(r=>r.question===${JSON.stringify(question)})?.id)()`,'source persisted in private registry',40000);
  await wait(`Boolean(${q('[aria-label="Discussion options"]')})`,'source discussion header');
  await click(q('[aria-label="Discussion options"]'),'source header menu');
  await click(q('[role="menuitem"]',`el.textContent.includes('Continue in another workspace')`),'workspace hand-off dialog');
  const dialog='[role="dialog"]', submit=q(dialog+' button',`el.textContent.includes('Create and send hand-off')`);
  const dest=q(dialog+' select'), optIn=q(dialog+' input[type="checkbox"]');
  assert.equal(await ev(`(${submit}).disabled`), true); assert.equal(await ev(`(${optIn}).checked`),false);
  await wait(`(${dest})?.querySelector('option[value="'+${JSON.stringify(targetId)}+'"]')!==null && Boolean(${dest})`,'private secondary workspace available');
  // A native select's popup is browser chrome. Use its standard input/change
  // events for the exact option, then real hit-tested clicks for all buttons.
  await ev(`(()=>{const s=(${dest});s.value=${JSON.stringify(targetId)};s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  const preview=q(dialog+' details',`el.querySelector('summary')?.textContent==='Preview the hand-off'`);
  assert.ok(!await ev(`(${preview}).textContent.includes(${JSON.stringify(question)})`));
  await click(q(dialog+' summary',`el.textContent==='Preview the original question'`),'preview original fixture question');
  assert.ok(await ev(`Boolean(${q(dialog+' details[open] p',`el.textContent===${JSON.stringify(question)}`)})`));
  await click(optIn,'explicitly opt in original question');
  assert.ok(await ev(`(${preview}).textContent.includes(${JSON.stringify(question)})`));
  await click(submit,'confirm new session and limited hand-off');
  const childId=await wait(`(async()=> (await (await fetch('/aitp-atlas/api/discussions?status=all')).json()).discussions.find(r=>r.id===${JSON.stringify(sourceId)})?.movedTo)()`,'durable original-to-continuation link');
  assert.notEqual(childId,sourceId);
  const owners=await wait(`(()=>{const items=__aitpAtlas.svc('workspaces').list.getSnapshot().items;const source=items.find(w=>w.sessionIds.includes(${JSON.stringify(sourceId)})), dest=items.find(w=>w.sessionIds.includes(${JSON.stringify(childId)}));return source&&dest&&[source.workspaceId,dest.workspaceId];})()`,'two distinct DSH workspace memberships');
  assert.notEqual(owners[0],owners[1]); assert.equal(owners[1],targetId);
  const body=q('.atlas-companion-body',`el.innerText.includes(${JSON.stringify(sourceId)}) && el.innerText.includes('Original question:') && el.innerText.includes(${JSON.stringify(question)})`);
  await wait(`Boolean(${body})`,'new session received confirmed question and original session pointer',45000);
  assert.match(await ev(`(${body}).innerText`),/session_event_search/);
  assert.equal(await ev(`(async()=> (await (await fetch('/aitp-atlas/api/discussions?status=all')).json()).discussions.filter(r=>r.id===${JSON.stringify(childId)}).length)()`),1);
  console.log('PASS DS-22: original retained; distinct destination membership, opt-in, durable movedTo and actual new conversation hand-off verified.');
});
