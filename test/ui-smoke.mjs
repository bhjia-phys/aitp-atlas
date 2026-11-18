/** Opt-in browser regression: `node test/ui-smoke.mjs` after building client.js.
 * Requires a local Chromium/Chrome/Edge executable (ATLAS_SMOKE_CHROMIUM can name it).
 * Uses only a new disposable DSH + browser profile; no screenshots, installs or live sessions.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { withPreview } from '../scripts/preview.mjs';

const chromium = [process.env.ATLAS_SMOKE_CHROMIUM, ...['PROGRAMFILES', 'PROGRAMFILES(X86)', 'LOCALAPPDATA'].flatMap(k =>
  process.env[k] ? ['Google/Chrome/Application/chrome.exe','Microsoft/Edge/Application/msedge.exe'].map(n => path.join(process.env[k], n)) : []),
  '/usr/bin/chromium', '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(p => p && path.isAbsolute(p) && existsSync(p));
if (!chromium) throw new Error('No Chromium installed. Set ATLAS_SMOKE_CHROMIUM to its absolute executable path.');

async function until(probe, label, ms = 15000) {
  const end = Date.now() + ms;
  do { const value = await probe(); if (value) return value; await delay(100); } while (Date.now() < end);
  throw new Error(`Timed out: ${label}`);
}

async function connect(socketUrl, report) {
  const ws = new WebSocket(socketUrl), calls = new Map(); let seq = 0;
  ws.addEventListener('message', ({data}) => {
    const m = JSON.parse(data);
    if (m.id) { const done = calls.get(m.id); if (done) { calls.delete(m.id); done(m); } }
    else report(m.method, m.params);
  });
  await new Promise((ok,no) => { ws.addEventListener('open',ok,{once:true}); ws.addEventListener('error',no,{once:true}); });
  return { close: () => ws.close(), call: (method,params={}) => new Promise((ok,no) => {
    const id = ++seq, timeout = setTimeout(() => { calls.delete(id); no(new Error(`CDP timeout: ${method}`)); }, 10000);
    calls.set(id, m => {clearTimeout(timeout); if (m.error) no(new Error(m.error.message)); else ok(m.result);});
    ws.send(JSON.stringify({id,method,params}));
  }) };
}

// Both suites run on the same real, private browser/Host lifecycle, never a user tab.
export async function runBrowserSmoke(flow = smokeM1) {
  return withPreview(async ({url,fx,env,model}) => {
  const browserDir=fx.file('chromium-profile');
  // Chromium needs native OS account discovery on Windows; --user-data-dir, not an
  // invented Windows account layout, selects its fresh browser profile. No DSH/model env.
  const browserEnv = Object.fromEntries(Object.entries(process.env).filter(([k]) => /^(path|systemroot|windir|comspec|pathext|systemdrive|programfiles(?:\(x86\))?|programw6432|programdata|commonprogramfiles(?:\(x86\))?|commonprogramw6432|localappdata|appdata|userprofile|homedrive|homepath|home|username|userdomain|computername|lang|lc_all|tz)$/i.test(k)));
  Object.assign(browserEnv, { TMP:env.TMP, TEMP:env.TEMP, TMPDIR:env.TMPDIR });
  const browser=spawn(chromium,['--headless=new','--disable-background-networking','--disable-sync','--no-first-run','--no-default-browser-check',
    '--disable-extensions','--disable-component-update','--no-pings','--disable-breakpad','--disable-crash-reporter',
    '--proxy-server=http://127.0.0.1:9',`--proxy-bypass-list=${new URL(url).hostname};127.0.0.1`,
    '--remote-debugging-address=127.0.0.1','--remote-debugging-port=0',`--user-data-dir=${browserDir}`,'--window-size=1600,1000','about:blank'],{env:browserEnv,windowsHide:true,stdio:'ignore',detached:process.platform!=='win32'});
  const closed=new Promise((ok,no)=>{browser.once('close',ok);browser.once('error',no);});
  let c, ev; const errors=[], httpErrors=[], atlasFailures=[];
  try {
    const port=await until(()=>fs.readFile(path.join(browserDir,'DevToolsActivePort'),'utf8').then(s=>Number(s.split('\n')[0]),()=>false),'private Chromium port');
    const pages=await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    const page=pages.find(p=>p.type==='page' && p.url==='about:blank'); assert.ok(page);
    c=await connect(page.webSocketDebuggerUrl,(method,p)=>{
      if(method==='Runtime.exceptionThrown') errors.push(p.exceptionDetails.exception?.description || p.exceptionDetails.text);
      if(method==='Runtime.consoleAPICalled' && p.type==='error') errors.push(p.args.map(a=>a.value||a.description).join(' '));
      if(method==='Log.entryAdded' && p.entry.level==='error') errors.push(p.entry.text);
      if(method==='Network.responseReceived' && p.response.status>=400) {
        const pathname=new URL(p.response.url).pathname;httpErrors.push([p.response.status,pathname]);
        if(pathname.startsWith('/aitp-atlas/api/')) atlasFailures.push({id:p.requestId,status:p.response.status,pathname});
      }
    });
    for(const k of ['Page','Runtime','Network','Log']) await c.call(k+'.enable');
    ev=async expression=>{const v=await c.call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true}); if(v.exceptionDetails)throw Error(v.exceptionDetails.exception?.description || v.exceptionDetails.text);return v.result.value;};
    // Every click is a real CDP input event at a visible, hit-tested DOM target, not a React callback.
    const q=(sel,extra='true')=>`[...document.querySelectorAll(${JSON.stringify(sel)})].find(el=>el.checkVisibility({contentVisibilityAuto:true}) && !el.closest('[aria-hidden="true"], [inert]') && (${extra}))`;
    const wait=(expr,label,ms)=>until(()=>ev(expr),label,ms);
    const click=async (expr,label)=>{
      const point=await wait(`(()=>{const el=(${expr});if(!el||el.disabled)return false;el.scrollIntoView({block:'nearest'});const r=el.getBoundingClientRect();const x=r.x+r.width/2,y=r.y+r.height/2;return el.contains(document.elementFromPoint(x,y))&&{x,y};})()`,label);
      await c.call('Input.dispatchMouseEvent',{type:'mouseMoved',...point});
      for(const type of ['mousePressed','mouseReleased']) await c.call('Input.dispatchMouseEvent',{type,button:'left',clickCount:1,...point});
    };
    const key=async(key,code,modifiers=0)=>{ for(const type of ['rawKeyDown','keyUp'])await c.call('Input.dispatchKeyEvent',{type,key,code,modifiers,windowsVirtualKeyCode:code==='Escape'?27:code.startsWith('Key')?code.charCodeAt(3):0}); };
    await c.call('Page.navigate',{url});
    // Fresh DSH web profiles show the release notice asynchronously over the panel.
    const notice=q('button',`['继续','Continue'].includes(el.textContent.trim()) && /预览版说明|preview release|preview notice|preview version/i.test(document.body.innerText)`);
    await click(notice,'private-profile DSH preview notice');
    await click(q('button,[role="button"]',`[el.title,el.ariaLabel,el.textContent.trim()].includes('Atlas')`),'DSH sidebar Atlas');
    const place=async name=>{
      const trigger=q('button[aria-label="Atlas destinations"]');
      await wait(`Boolean(${trigger}) || Boolean(${q('.atlas-rail button')})`,'Atlas navigation ready');
      if(await ev(`Boolean(${trigger})`)) {
        await click(trigger,'Atlas destinations');
        await click(q('[role="menuitem"]',`el.textContent.trim().startsWith(${JSON.stringify(name)})`),name+' menu destination');
      } else await click(q('.atlas-rail button',`el.ariaLabel.split(',')[0]===${JSON.stringify(name)}`),name+' rail destination');
    };
    await flow({q,wait,click,key,ev,c,place,fx,model});
    const problems=[...errors,...httpErrors.map(x=>x.join(' '))];
    assert.deepEqual(problems,[]);
    console.log('PASS',flow.name,'— browser console, page and HTTP errors: 0');
  } catch(error) {
    // Error-only, from our disposable Atlas fixture. Never print credentials,
    // requests, transcripts, full response bodies or unrelated DSH traffic.
    for (const {id,status,pathname} of atlasFailures.slice(-5)) {
      try { const result=await c.call('Network.getResponseBody',{requestId:id});const {error:problem}=JSON.parse(result.body);if(problem)console.error('Atlas API failure:',status,pathname, String(problem.code || '').slice(0,80),String(problem.message || '').slice(0,500)); } catch {}
    }
    console.error('Browser diagnostics:',JSON.stringify({errors,httpErrors,visible:await ev?.(`document.body.innerText.slice(-3500)`).catch(()=>null),buttons:await ev?.(`Array.from(document.querySelectorAll('button')).filter(x=>x.checkVisibility()).slice(0,65).map(x=>[x.ariaLabel,x.title,x.textContent.trim().slice(0,60)])`).catch(()=>null)}));
    throw error;
  } finally {
    if(c){await c.call('Browser.close').catch(()=>{});c.close();}
    // On a CDP startup failure the main process may still own renderers. Terminate only
    // the process tree we launched; never locate or terminate the user's browser by name.
    const force=setTimeout(()=>{
      if(!browser.pid || browser.exitCode!==null || browser.signalCode!==null)return;
      if(process.platform==='win32') {
        const kill=spawn(path.join(process.env.SystemRoot,'System32','taskkill.exe'),['/PID',String(browser.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});
        kill.once('error',()=>browser.kill('SIGKILL'));
      } else { try {process.kill(-browser.pid,'SIGKILL');}catch(error){if(error.code!=='ESRCH')throw error;} }
    },4000);
    try { await closed; } finally {clearTimeout(force);}
  }
});
}

async function smokeM1({q,wait,click,key,ev,c,place}) {
    await place('Desk'); // M1 rail or the consolidated Atlas ▾ destination menu.
    await click(q('.atlas-desk-topic,button[aria-label^="Choose topic"]'),'Desk topic picker');
    await click(q('.atlas-desk-choice',`el.textContent.includes('Worm algorithm:')`),'worm topic');
    assert.match(await ev(`document.querySelector('.atlas-desk-topic').textContent`),/Worm algorithm/);
    const question='Show the two fixture reading links.';
    await click(q('[aria-label="Discussion question"]'),'Desk question');
    await c.call('Input.insertText',{text:question});
    await click(q('[aria-label="Send discussion"]'),'Send discussion');
    const transcript='.atlas-companion-body';
    await wait(`document.querySelector(${JSON.stringify(transcript)})?.innerText.includes('This is the Atlas fixture.')`,'real DSH assistant reply',45000);
    const link=q(`${transcript} a, ${transcript} button`, `el.textContent.includes('worm note') || /mc[\\\\/]worm[\\\\/]research\\.md/i.test(el.title)`);
    const paper=q(`${transcript} a`, `el.href.includes('arxiv.org/abs/1510.07698')`);
    await wait(`Boolean(${paper})`,'streamed arXiv link');
    assert.match(await ev(`document.querySelector('.atlas-disc-topic,.atlas-companion-title')?.textContent || ''`),/Worm algorithm/);
    const retained=await c.call('Runtime.evaluate',{expression:`${paper}`,objectGroup:'smoke',returnByValue:false});
    // Keep a remote reference to an actual assistant-message node (not just the Atlas wrapper).
    const sameTranscript=async()=>assert.equal((await c.call('Runtime.callFunctionOn',{objectId:retained.result.objectId,functionDeclaration:`function(){return this===(${paper})&&this.isConnected;}`,returnByValue:true})).result.value,true);
    await click(link,'assistant file link');
    await wait(`Boolean(${q('[role="tablist"][aria-label="Right pane"] [role="tab"][aria-selected="true"]',`/worm/i.test(el.title)` )})`,'fixture file opened in other pane');
    await sameTranscript();
    await click(paper,'assistant arXiv link');
    const paperTab=q('[role="tablist"][aria-label="Right pane"] [role="tab"][aria-selected="true"]',`/1510.07698/.test(el.title+' '+el.innerText)`);
    await wait(`Boolean(${paperTab})`,'paper opened opposite retained discussion');
    await sameTranscript();
    const pageOne=`Boolean(${q('canvas[aria-label="Page 1"]',`el.width>0 && el.height>0`)}) && Boolean(${q('.atlas-pdf-place', `el.textContent.includes('1 / 1')`)}) && Boolean(${q('.atlas-pdf-text span', `el.textContent.includes('Atlas reading fixture')`)})`;
    await wait(pageOne,'paper link rendered the local PDF without a network lookup');
    await click(`${paperTab}?.querySelector('button[aria-label^="Close "]')`,'close the paper');
    await wait(`!(${paperTab})`,'closed tab disappeared');
    await click(q('[aria-label="Pane menu"]'),'pane menu');
    await click(q('[role="menuitem"]',`el.textContent.includes('Reopen closed tab')`),'reopen closed paper');
    await wait(`Boolean(${paperTab})`,'reopened paper');
    await sameTranscript();
    // The Atlas keyboard map reserves Ctrl+K for DSH; Alt+5 opens Library.
    await click(paperTab,'activate reopened tab'); await key('5','Digit5',1);
    await wait(`Boolean(${q('[role="tab"][aria-selected="true"]',`el.innerText.trim()==='Library'`)})`,'Alt+5 opened Library');
    await click(q('.atlas-library button, .atlas-shelf button, [role="tabpanel"] button',`/^(Read|Open PDF|Read PDF|PDF)$/i.test(el.textContent.trim()) || /^(Open|Read) (the )?PDF$/i.test(el.title)`),'read local fixture PDF');
    await wait(pageOne,'PDF.js first fixture page from Library');
}

if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) await runBrowserSmoke();
