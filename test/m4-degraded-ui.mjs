/** Private runtime fault injection, NOT an unmodified-distribution smoke test. The original
 * plugin's main slot, component tree, actual React/renderer, host routes, model and Chromium
 * come from the usual disposable smoke lifecycle. Only Atlas's optional service boundary in
 * the staged copy changes: the rest of DSH (including its required sidebar) stays intact. */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import {runBrowserSmoke} from './ui-smoke.mjs';
const source = new URL('../client/',import.meta.url);
function fixtureContext(real) {
  if (!/^127\.77\.\d+\.\d+$/.test(location.hostname)) throw Error('This test client must run in private DSH.');
  const fault=sessionStorage.getItem('fixture-service-fault') || 'sessions';
  const off=name=>name===fault || (fault==='teams' && name==='remote.agentTeams');
  const reads=window.__fixtureAtlasCounts={creates:0};
  const wrappers=new WeakMap();
  const own={get(name){if(off(name))return undefined; const service=real.get(name);if(name!=='sessions' || !service)return service;
    if(!wrappers.has(service))wrappers.set(service,new Proxy(service,{get(obj,k){if(k==='create')return (...args)=>{reads.creates++;return obj.create(...args);};const value=obj[k];return typeof value==='function'?value.bind(obj):value;}}));
    return wrappers.get(service);},
    inject(keys,start){if(keys.some(off))return;return real.inject(keys,scope=>{
      if(keys.includes('remote.session') && ['catalog','selectModel'].includes(fault)) {
        const route=scope.remote.session, masked={};
        if(fault!=='catalog')masked.modelCatalog=(...args)=>route.modelCatalog(...args);
        if(fault!=='selectModel')masked.selectModel=(...args)=>route.selectModel(...args);
        // Keep the real Cordis effect/disposer; swap only this optional face.
        return start({remote:{session:masked},effect:(...args)=>scope.effect(...args)});
      }
      return start(scope);
    });},slots:real.slots};
  return own;
}
const version=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8')).version;
const parts=readdirSync(source).filter(n=>n.endsWith('.js')).sort().map(n=>{
  const text=readFileSync(new URL(n,source),'utf8');if(n!=='90-register.js')return text;
  assert.equal(text.split('apply(ctx) {').length,2);return text.replace('apply(ctx) {',`apply(original) { const ctx=(${fixtureContext.toString()})(original);`);
});
const fixtureClientSource=`window.__ModuleLoader__.load({id:'aitp-atlas',factory(require){'use strict';const ATLAS_VERSION=${JSON.stringify(version)};\n${parts.join('\n')}\n}});`;
await runBrowserSmoke(async function serviceOmissions({q,click,ev,wait,c,key,place}) {
  const text=(selector,value)=>q(selector,`el.textContent.trim()===${JSON.stringify(value)}`);
  const visible=s=>`Boolean(${q(s)})`, inPage=value=>`document.body.innerText.includes(${JSON.stringify(value)})`;
  const desk=()=>place('Desk');
  const reload=async(fault,model=null)=>{
    await ev(`sessionStorage.setItem('fixture-service-fault',${JSON.stringify(fault)});localStorage.setItem('aitp-atlas:prefs.v1',JSON.stringify({...JSON.parse(localStorage.getItem('aitp-atlas:prefs.v1') || '{}'),model:${JSON.stringify(model)}}))`);
    await c.call('Page.reload',{ignoreCache:true});
    await click(q('button[aria-label="Atlas"]'),'reopen fixture Atlas after switch to '+fault);await desk();
  };
  const readNote=async()=>{
    await place('Library'); await wait(visible('.atlas-page'),'Library still opens');
    await click(q('button',`/^(Read|Read PDF|PDF)$/i.test(el.textContent.trim()) || /^(Open|Read) (the )?PDF$/i.test(el.title)`),'open local fixture PDF');
    await wait(visible('canvas[aria-label="Page 1"]'),'reading still renders a local PDF page');
  };
  await desk();await wait(inPage('This DSH cannot start discussions inside Atlas.'),'missing sessions reason');assert.equal(await ev(`(${q('[aria-label="Discussion question"]')}).disabled`),true);
  await readNote();console.log('PASS sessions withheld: composer disabled, fixture library PDF still opens');
  await reload('layout');
  const focus=q('button[aria-label="Focus pane"]');
  await click(focus,'local Focus without DSH layout');await wait(inPage('DSH layout is unavailable'),'local focus explains retained sidebar');await key('Escape','Escape');await place('Library');console.log('PASS layout withheld: local Focus, exit, navigation');
  await reload('teams');await place('Teams');await click(text('button','New team'),'inspect team assembly');
  // Use a valid charter: Start must be disabled by missing Agent Teams, not an empty goal/topic.
  for(const [label,value] of [['What should the team find out?','Compare the two fixture conventions.'],['Done when','Both independent checks agree.']]) {
    await click(q(`textarea[aria-label="${label}"]`),label);await c.call('Input.insertText',{text:value});
  }
  const topic=q('select[aria-label="Topic"]');await click(topic,'choose a fixture topic');await key('Escape','Escape');await key('Home','Home');await key('ArrowDown','ArrowDown');
  assert.notEqual(await ev(`(${topic}).value`),'__choose__');
  await wait(inPage('Agent Teams is not available'),'missing team remote reason');assert.equal(await ev(`(${text('button','Start the team')}).disabled`),true);assert.equal(await ev('window.__fixtureAtlasCounts.creates'),0);
  assert.equal(await ev(`fetch('/aitp-atlas/api/teams').then(r=>r.json()).then(r=>r.teams.length)`),0);
  await click(text('.atlas-crew-sheet button','Cancel'),'close unavailable team');
  console.log('PASS Agent Teams withheld: assembly remains readable; cannot launch');
  for (const fault of ['catalog','selectModel']) {
    await reload(fault,{provider:'fixture-saved',model:'old-choice'});
    const reason=fault==='catalog'?'DSH’s model catalog is unavailable.':'DSH model switching is unavailable.';
    await wait(inPage(reason),fault+' reason next to model');
    const box=q('textarea[aria-label="Discussion question"]');await click(box,'enter question under service omission');await c.call('Input.insertText',{text:'Fixture question under '+fault});
    const send=q('button[aria-label="Send discussion"]');assert.equal(await ev(`(${send}).disabled`),true);
    await key('Enter','Enter');assert.equal(await ev('window.__fixtureAtlasCounts.creates'),0);
    await click(text('button','Use DSH default'),'remove saved override');await wait(`!(${send}).disabled`,'default discussion action is available');
    await click(send,'submit using DSH default');await wait(`Boolean(${q('.atlas-companion-body',`el.innerText.includes(${JSON.stringify('Fixture question under '+fault)}) && el.innerText.includes('This is the Atlas fixture.')`)})`,'visible default reply for this specific question',45000);
    assert.equal(await ev('window.__fixtureAtlasCounts.creates'),1);
    console.log('PASS',fault,'withheld: saved explicit route blocked before creation; researcher-selected default delivered exactly once');
  }
}, {fixtureClientSource});
