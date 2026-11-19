/** QB-2. Opt-in benchmark against the built client in a fresh DSH web/Chromium
 * profile and generated research fixture. No production profile, DB seeds,
 * direct HTTP writes or mock React state. Prints every sample plus percentiles.
 * Run: node test/m4-performance-ui.mjs   (build client.js separately if needed).
 */
import assert from 'node:assert/strict';
import os from 'node:os';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {runBrowserSmoke} from './ui-smoke.mjs';

const round=n=>Math.round(n*10)/10;
function stats(samples,target){const s=[...samples].sort((a,b)=>a-b),p=k=>round(s[Math.ceil(k*s.length)-1]);return {n:s.length,min:round(s[0]),p50:p(.5),p95:p(.95),max:p(1),...(target?{under:s.filter(t=>t<target).length,target}:{}),samples:samples.map(round)};}
const code=readFileSync(new URL('../client.js',import.meta.url));
await runBrowserSmoke(async function qb2({q,wait,click,c,ev,place}) {
  const meta={os:os.platform()+' '+os.release(),cpu:os.cpus()[0]?.model,logicalCPUs:os.availableParallelism(),node:process.version,browser:(await c.call('Browser.getVersion')).product,client: createHash('sha256').update(code).digest('hex').slice(0,12),viewport:await ev('[innerWidth,innerHeight,devicePixelRatio]')};
  console.log('environment',JSON.stringify(meta));
  const field='textarea[aria-label="Discussion question"]', input=q(field), deskTab=q('[role=tab]',`el.title==='Desk'`);
  await wait(`Boolean(${input})`,'configured Desk');
  // Arm before page JavaScript runs. Query Resource Timing and the DOM in the
  // same performance clock; CDP polling never contributes to a timing sample.
  const observer=`(()=>{const run=()=>{const r=performance.getEntriesByType('resource').filter(e=>new URL(e.name).pathname==='/aitp-atlas/api/overview').at(-1);const t=document.querySelector('${field}');if(r?.responseEnd && t && !t.disabled && !t.closest('[aria-hidden=true]') && document.querySelector('.atlas-desk-sky')) {window.__qbDesk=performance.now()-r.responseEnd;return;}requestAnimationFrame(run);};requestAnimationFrame(run);})();`;
  await c.call('Page.addScriptToEvaluateOnNewDocument',{source:observer});
  const desk=[];for(let i=0;i<8;i++){
    await c.call('Page.reload');await delay(180);
    const atlas=q('button,[role="button"]',`[el.title,el.ariaLabel,el.textContent.trim()].includes('Atlas')`);
    const status=await wait(`(${input})?'desk':(${atlas})?'nav':false`,'private DSH ready after warm reload');
    if(status==='nav') await click(atlas,'reopen Atlas on warm host');
    desk.push(await wait('window.__qbDesk','first frame with configured Desk'));
  }
  console.log('deskFromOverview',JSON.stringify(stats(desk,300)));
  const frames=async(n=2)=>ev(`new Promise(resolve=>{let n=${n};const step=()=>--n?requestAnimationFrame(step):resolve();requestAnimationFrame(step)})`);
  const erase=async()=>{await click(input,'route input');await c.call('Input.dispatchKeyEvent',{type:'rawKeyDown',key:'a',code:'KeyA',modifiers:2,windowsVirtualKeyCode:65});await c.call('Input.dispatchKeyEvent',{type:'keyUp',key:'a',code:'KeyA',modifiers:2,windowsVirtualKeyCode:65});for(const type of ['rawKeyDown','keyUp'])await c.call('Input.dispatchKeyEvent',{type,key:'Backspace',code:'Backspace',windowsVirtualKeyCode:8});await wait(`(${input}).value==='' && !document.querySelector('.atlas-desk-routing')`,'old route cleared');};
  const route=[];for(let i=0;i<12;i++){
    await erase();const question=`Compare worm sampler equilibration in fixture ${i}`;
    await ev(`(()=>{const t=document.querySelector('${field}'),key=${JSON.stringify(question)};window.__qbRoute=undefined;const listener=e=>{if(e.isTrusted && t.value===key){t.removeEventListener('input',listener,true);const start=e.timeStamp;const frame=()=>{const rs=performance.getEntriesByType('resource').filter(e=>new URL(e.name).pathname==='/aitp-atlas/api/route' && new URL(e.name).searchParams.get('q')===key && e.startTime>=start);const r=rs.at(-1);if(r && document.querySelector('.atlas-desk-routing .atlas-chip, .atlas-desk-routing button')){window.__qbRoute={debounce:r.startTime-start,ttfb:r.responseStart-r.requestStart,request:r.responseEnd-r.startTime,ready:performance.now()-r.startTime,total:performance.now()-start};return;}requestAnimationFrame(frame);};requestAnimationFrame(frame);}};t.addEventListener('input',listener,true);})()`);
    const before=await ev(`performance.getEntriesByType('resource').filter(e=>new URL(e.name).pathname==='/aitp-atlas/api/route').length`);
    for(const piece of [question.slice(0,14),question.slice(14,-2),question.slice(-2)]){await c.call('Input.insertText',{text:piece});await delay(25);}
    route.push(await wait('window.__qbRoute','route suggestion frame'));
    assert.equal(await ev(`performance.getEntriesByType('resource').filter(e=>new URL(e.name).pathname==='/aitp-atlas/api/route').length`),before+1,'rapid edits coalesce into one request');
  }
  for(const k of ['debounce','ttfb','request','ready','total'])console.log('route.'+k,JSON.stringify(stats(route.map(r=>r[k]),['ttfb','ready','total'].includes(k)?150:null)));
  await erase();
  // Create real sessions via Desk and wait for replies, preserving a genuine
  // assistant link object (not just the tab/body shell) across switches.
  const sel=id=>`.atlas-tab-body[data-session-id="${id}"]`, tab=id=>q('[role=tab]',`el.getAttribute('aria-controls')===document.querySelector(${JSON.stringify(sel(id))})?.id`);
  const ids=[];for(let i=1;i<=7;i++){
    if(i>1)await click(deskTab,'Desk');await click(input,'question input');await c.call('Input.insertText',{text:'Performance fixture '+i});await click(q('[aria-label="Send discussion"]'),'create fixture discussion');
    const id=await wait(`(()=>{const n=document.querySelector('.atlas-tab-body[data-session-id]:not(.is-hidden)');return n && !${JSON.stringify(ids)}.includes(n.dataset.sessionId) && n.querySelector('.atlas-companion-body a[href*="arxiv.org/abs/1510.07698"]') && !n.querySelector('button[aria-label="Stop generating"],button[aria-label="停止生成"]') && n.dataset.sessionId;})()`,'visible completed fixture reply',30000);ids.push(id);
  }
  const count=await wait(`(()=>{const all=Array.from(document.querySelectorAll('.atlas-tab-body[data-session-id]'));const keep=all.filter(n=>n.dataset.conversationRetained==='true');if(all.length!==7 || keep.length!==6)return false;return {open:all.length,retained:keep.length,messages:all.filter(n=>n.querySelector('.atlas-companion-body')).length,evicted:all.filter(n=>!keep.includes(n)).map(n=>n.dataset.sessionId)};})()`,'seven real sessions and six retained');
  assert.deepEqual(count.evicted,[ids[0]]);assert.equal(count.messages,6);
  const pair=ids.slice(-2);await click(tab(pair[0]),'warm both transcripts');await frames();
  await delay(300);await frames();
  await ev(`window.__qbRefs=${JSON.stringify(pair)}.map(id=>{const body=document.querySelector('[data-session-id="'+id+'"].atlas-tab-body');return [body,body.querySelector('.atlas-companion-body a[href]')];});true`);
  const times=[];for(let i=0;i<40;i++){
    const id=pair[(i+1)%2], selector=sel(id);
    await ev(`(()=>{window.__qbSwitch=undefined;const t=${tab(id)},body=document.querySelector(${JSON.stringify(selector)});t.addEventListener('click',e=>{if(!e.isTrusted)throw Error('untrusted click');const start=e.timeStamp;const frame=()=>{if(body.getAttribute('aria-hidden')!=='true'&&t.getAttribute('aria-selected')==='true'){window.__qbSwitch={ms:performance.now()-start,connected:window.__qbRefs.every(([b,node])=>node?.isConnected && node===b.querySelector('.atlas-companion-body a[href]'))};}else requestAnimationFrame(frame);};requestAnimationFrame(frame);},{capture:true,once:true});})()`);
    await click(tab(id),'switch retained tab');const result=await wait('window.__qbSwitch','tab frame');assert.equal(result.connected,true,'assistant DOM nodes persist');times.push(result.ms);
  }
  console.log('switchRetained',JSON.stringify(stats(times,50)));
  console.log('lru',JSON.stringify({open:count.open,retained:count.retained,actualBodies:count.messages,oldestEvicted:true}));
  await c.call('Performance.enable');
  const layoutCount=async()=>(await c.call('Performance.getMetrics')).metrics.find(x=>x.name==='LayoutCount').value;
  const layout=async(hidden,desk=false)=>{
    const results=[];for(let i=0;i<10;i++){
      await frames();const pre=await layoutCount();
      await ev(`(()=>{const n=document.querySelector('.atlas-tab-body${hidden?'.is-hidden':':not(.is-hidden)'}${desk?' .atlas-desk-composer':'[data-conversation-retained="true"] .atlas-companion-body'}');if(!n)throw Error('missing layout probe');n.style.paddingBottom='${i%2?21:39}px';})();`);
      await frames(3);results.push((await layoutCount())-pre);
    }return results;
  };
  const hidden=await layout(true),visible=await layout(false);const cv=await ev(`Array.from(document.querySelectorAll('.atlas-tab-body.is-hidden')).every(n=>getComputedStyle(n).contentVisibility==='hidden')`);
  const browseHidden=await layout(true,true);await click(deskTab,'show Desk for layout control');await frames(4);const browseVisible=await layout(false,true);
  console.log('layout',JSON.stringify({hidden,visible,browseHidden,browseVisible,hiddenContentVisibility:cv}));assert.ok(cv);assert.ok(visible.some(n=>n>0) && browseVisible.some(n=>n>0),'visible positive controls');
  await click(tab(ids[0]),'reacquire evicted history');await wait(`document.querySelector(${JSON.stringify(sel(ids[0]))}).innerText.includes('This is the Atlas fixture.')`,'evicted history readable');
});
