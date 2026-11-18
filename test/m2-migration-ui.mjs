/** Real private DSH + Chromium: v0.9 localStorage import and last-key-to-suggestion latency.
 * Run `node test/m2-migration-ui.mjs` with the M2 client built. No user profile or clock mocking.
 */
import assert from 'node:assert/strict';
import { runBrowserSmoke } from './ui-smoke.mjs';

await runBrowserSmoke(async function migrationAndLatency({c,ev,q,click,key,wait,place,fx}) {
  const queries=[
    ['How does the Pade ensemble choose the real frequency continuation window?', 'Analytic continuation'],
    ['Is the worm sampler equilibrating reproducibly?', 'Worm algorithm'],
    ['How does the Pade ensemble choose the real frequency continuation window?', 'Analytic continuation'],
    ['Is the worm sampler equilibrating reproducibly?', 'Worm algorithm'],
  ];
  await place('Desk');
  const timings=[];
  for(const [query,topic] of queries) {
    const field=q('textarea[aria-label="Discussion question"]');
    await click(field,'Desk question');await key('a','KeyA',2);
    await c.call('Input.insertText',{text:query.slice(0,-1)});
    await ev(`(()=>{const field=${field}; field.addEventListener('keydown',e=>{
      if(!e.isTrusted || e.key!=='?')return; const start=performance.now();
      window.fixtureRouteLatency=new Promise((resolve,reject)=>{
        let scheduled=false;
        const hit=()=> field.value===${JSON.stringify(query)} && [...document.querySelectorAll('[aria-label="Likely topic"] button')].some(b=>b.checkVisibility() && b.textContent.includes(${JSON.stringify(topic)}));
        const obs=new MutationObserver(()=>{if(!hit()||scheduled)return;scheduled=true;requestAnimationFrame(()=>{if(hit()){clearTimeout(timer);obs.disconnect();resolve(performance.now()-start);}else scheduled=false;});});
        const timer=setTimeout(()=>{obs.disconnect();reject(new Error('No corresponding route chips'));},3000);
        obs.observe(document.querySelector('.atlas-desk'),{childList:true,subtree:true,characterData:true});
      });
    },{once:true,capture:true});})()`);
    await c.call('Input.dispatchKeyEvent',{type:'keyDown',key:'?',code:'Slash',modifiers:8,text:'?',windowsVirtualKeyCode:191});
    await c.call('Input.dispatchKeyEvent',{type:'keyUp',key:'?',code:'Slash',modifiers:8,windowsVirtualKeyCode:191});
    const ms=await ev('window.fixtureRouteLatency');assert.ok(Number.isFinite(ms));timings.push(Number(ms.toFixed(1)));
  }
  console.log('Desk latency (ms, trusted final keydown to next frame with corresponding visible chip):',JSON.stringify({warmup:timings[0],samples:timings.slice(1)}));
  // Reset the temporary browser once to enable the documented development service hook. Use
  // real DSH operations with no Atlas registration, representing a pre-upgrade session.
  const reload=async()=>{
    await c.call('Page.reload',{ignoreCache:true});
    await click(q('button[aria-label="Atlas"]'),'DSH sidebar Atlas after refresh');
    await wait(`Boolean(${q('.atlas-root')})`,'restored Atlas');
  };
  await ev(`localStorage.setItem('aitp-atlas:debug','1')`);await reload();
  const id=await ev(`(async()=>{
    const {svc}=window.__aitpAtlas, ws=await svc('workspaces').create({path:${JSON.stringify(fx.root)}});
    const sessions=svc('sessions'), id=await sessions.create({workspaceId:ws.id||ws.workspaceId});
    const ref=sessions.retain(id,{source:'fixture-legacy'});try{const binding=await ref.ready;await binding.session.rename('Legacy fixture DSH row');}finally{ref.release();}return id;
  })()`);
  assert.match(id,/^[\w-]+$/);
  const registry=`(await (await fetch('/aitp-atlas/api/discussions')).json()).discussions`;
  assert.equal((await ev(`(async()=>${registry})()`)).length,0);
  const topic={id:'mc/worm',title:'Worm algorithm',path:fx.file('topics/mc/worm/research.md')};
  const legacy={id,title:'Legacy fixture: worm estimator',question:'Which fixture made this estimate?',created:Date.now()-10000,status:'open',intent:'ask',context:{topic,doc:null,page:'',section:'',lines:'',selection:''}};
  const saved=JSON.stringify([legacy]);
  await ev(`localStorage.setItem('aitp-atlas:threads', ${JSON.stringify(saved)})`);
  for(let pass=1;pass<=2;pass++) {
    await reload();await place('Discussions');
    const row=await wait(`(async()=>{const r=${registry};return r.length===1 && r[0].id===${JSON.stringify(id)} && r[0];})()`,'exactly one migrated registry row');
    assert.equal(row.origin,'import');assert.equal(row.topic.id,'mc/worm');assert.equal(row.title,legacy.title);
    await wait(`Boolean(${q('.atlas-disc-results',`el.innerText.includes(${JSON.stringify(legacy.title)})`)})`,'imported real row visible in Discussions');
    assert.equal(await ev(`localStorage.getItem('aitp-atlas:threads')`),saved);
  }
  console.log('PASS same-browser 0.9 import: native DSH session, one visible imported record on two refreshes; original localStorage retained unchanged.');
  assert.ok(timings.slice(1).every(x=>x<=400), 'one or more warm key-to-chip samples exceeded 400 ms');
});
