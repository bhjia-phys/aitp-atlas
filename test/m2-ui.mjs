/** Opt-in M2 acceptance: `node test/m2-ui.mjs` after the normal client build.
 * Seven real DSH sessions. No injected app state, fake React callbacks, external model or HTTP writes.
 * Only the private in-process Messages fixture is gated to exercise overlapping streams.
 */
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { runBrowserSmoke } from './ui-smoke.mjs';

await runBrowserSmoke(async function smokeM2({q, wait, click, c, ev, place, model}) {
  const registry = `(await (await fetch('/aitp-atlas/api/discussions')).json()).discussions`;
  const record = async id => ev(`(async()=>(${registry}).find(r=>r.id===${JSON.stringify(id)}))()`);
  const dlg = '[role="dialog"][aria-label="Move discussion"]';
  const body = id => `.atlas-tab-body[data-session-id="${id}"]`;
  const tab = id => q('[role="tab"]',`el.getAttribute('aria-controls')===document.querySelector(${JSON.stringify(body(id))})?.id`);
  const shown = id => `Boolean(${q(body(id))})`;
  const txt = (id,text) => `document.querySelector(${JSON.stringify(body(id))})?.textContent.includes(${JSON.stringify(text)})`;
  const untilRecord = (expression, label) => wait(`(async()=>{const rows=${registry};return ${expression};})()`,label);
  const begin = async (question, suggested) => {
    await click(q('[role="tab"]', `el.title==='Desk'`),'Desk tab');
    const field = q('textarea[aria-label="Discussion question"]');
    await click(field,'question field');
    assert.equal(await ev(`(${field}).value`),'');
    await c.call('Input.insertText',{text:question});
    if(suggested) await wait(`Boolean(${q('[aria-label="Likely topic"] button',`el.textContent.toLowerCase().includes(${JSON.stringify(suggested.toLowerCase())}) && el.textContent.includes('auto')`)})`,'automatic topic suggestion');
    await click(q('[aria-label="Send discussion"]'),'send '+question);
    const rec = await untilRecord(`rows.find(r=>r.question===${JSON.stringify(question)})`,'new discussion in authenticated registry');
    assert.equal(rec.origin,'desk');assert.match(rec.id,/^[\w.-]+$/);
    await wait(shown(rec.id),'new discussion tab');return rec;
  };
  const panelMenu = async id => {
    const menu=q('button[aria-label="Pane menu"]',`el.closest('.atlas-strip')?.contains(${tab(id)})`);
    await click(menu,'pane menu containing discussion');
    await click(q('[role="menuitem"]',`el.textContent.includes('Move tab to the other pane')`),'move discussion into opposite pane');
  };
  const first=model.holdNext('A'), second=model.holdNext('B'); let a,b;
  try {
    // Each DSH request holds after its first named delta. Do not release A until B has
    // already streamed into another actual session; never infer overlap from UI timing alone.
    a=await begin('Is the worm sampler equilibrating reproducibly?','Worm');
    assert.equal(a.topic?.id,'mc/worm');assert.equal(a.filing,'auto');
    await wait(txt(a.id,'Fixture stream A begins.'),'first partial reply',30000);
    await panelMenu(a.id); // pin the first live transcript on the right; Desk and B stay left
    b=await begin('How does the window choice affect analytic continuation spectra?');
    await wait(txt(b.id,'Fixture stream B begins.'),'second partial reply while first is held',30000);
    assert.notEqual(a.id,b.id);
    assert.ok(await ev(`${shown(a.id)} && ${shown(b.id)} && !${txt(a.id,'Stream A complete.')} && !${txt(b.id,'Stream B complete.')}`));
    second.release();
    await wait(txt(b.id,'Stream B complete.'),'second stream finishes first');
    assert.ok(!await ev(txt(a.id,'Stream A complete.')));
    first.release();await wait(txt(a.id,'Stream A complete.'),'first stream resumes and finishes');
  } finally { first.release();second.release(); }
  const refLink = q(`${body(a.id)} a`,`el.href.includes('arxiv.org/abs/1510.07698')`);
  await wait(`Boolean(${refLink})`,'first assistant paper link rendered');
  const ref=(await c.call('Runtime.evaluate',{expression:refLink,objectGroup:'messages'})).result.objectId;
  const same = async () => assert.equal((await c.call('Runtime.callFunctionOn',{objectId:ref,functionDeclaration:`function(){return this.isConnected && this===(${refLink})}`,returnByValue:true})).result.value,true);
  await click(q('[role="tab"]',`el.title==='Desk'`),'switch away from second transcript');
  await click(tab(b.id),'restore second transcript');await same();
  assert.ok(!await ev(txt(b.id,'Fixture stream A begins.')));
  assert.ok(!await ev(txt(a.id,'Fixture stream B begins.')));
  console.log('PASS two interleaved DSH transcripts, automatic filing, split and node retention');

  const note='this discussion is now filed under';
  const countNote = () => ev(`(document.querySelector(${JSON.stringify(body(a.id))}).innerText.toLowerCase().split(${JSON.stringify(note)}).length-1)`);
  const move = async () => {
    await click(q(`${body(a.id)} button[aria-label="Move to a topic"]`),'topic chip for A');
    await wait(`Boolean(${q(dlg)})`,'move popover');
    await click(q(`${dlg} label,${dlg} [role="option"],${dlg} [role="radio"]`, `el.textContent.includes('Topological insulators')`),'new topic');
    const tell=await ev(`(${q(`${dlg} input[type="checkbox"],${dlg} [role="checkbox"]`)})`+`?.checked ?? (${q(`${dlg} [role="checkbox"]`)})?.ariaChecked`);
    assert.ok(tell===true || tell==='true','Tell the AI default is checked');
    await click(q(`${dlg} button`,`el.textContent.trim()==='Move'`),'apply move');
    await untilRecord(`rows.find(r=>r.id===${JSON.stringify(a.id)})?.topic?.id==='topology'`,'registry move committed');
  };
  const initialNotes = await countNote();
  await move();
  await click(q('button',`el.textContent.trim()==='Undo'`),'Undo before notification deadline');
  await untilRecord(`rows.find(r=>r.id===${JSON.stringify(a.id)})?.topic?.id==='mc/worm'`,'Undo restored original filing');
  await delay(6300);assert.equal(await countNote(),initialNotes,'undo must not send a delayed prompt');
  await move();assert.equal(await countNote(),initialNotes,'no immediate notification');
  await delay(4200);assert.equal(await countNote(),initialNotes,'no notification during undo window');
  await wait(`document.querySelector(${JSON.stringify(body(a.id))}).innerText.toLowerCase().includes(${JSON.stringify(note)})`,'one delayed, real session message');
  assert.equal(await countNote(),initialNotes+1);
  assert.equal((await record(a.id)).topic.id,'topology');
  console.log('PASS real Move → Undo, no prompt; committed Move → one delayed prompt');

  // A stays visible at right. B was last shown before the five new discussions and
  // is the oldest hidden one; closing a tab is NOT a substitute for testing eviction.
  for(let i=3;i<=7;i++) {
    const rec=await begin('Fixture retention check '+i+'.');
    await wait(txt(rec.id,'This is the Atlas fixture.'),'reply '+i);
  }
  const retained='.atlas-tab-body[data-conversation-retained="true"]';
  await wait(`document.querySelectorAll('.atlas-tab-body[data-session-id]').length===7 && document.querySelectorAll(${JSON.stringify(retained)}).length===6`,'seven open / six retained');
  assert.equal(await ev(`document.querySelector(${JSON.stringify(body(b.id))}).dataset.conversationRetained`),'false');
  assert.ok(!await ev(txt(b.id,'Fixture stream B begins.')),'evicted transcript DOM was released');await same();
  await click(tab(b.id),'reopen oldest hidden transcript');
  await wait(txt(b.id,'Stream B complete.'),'evicted session reacquired its history');
  assert.equal(await ev(`document.querySelectorAll(${JSON.stringify(retained)}).length`),6);
  await same();await place('Discussions');await wait(`document.body.innerText.includes('Unfiled')`,'discussions place');
  const all=await ev(`(async()=>${registry})()`);assert.equal(new Set(all.map(r=>r.id)).size,7);
  console.log('PASS seven real sessions, LRU hidden release/remount at six and durable topic registry');
});
