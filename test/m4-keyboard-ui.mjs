/** Opt-in M4 keyboard-only acceptance on throwaway DSH + Chromium. node test/m4-keyboard-ui.mjs */
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { runBrowserSmoke } from './ui-smoke.mjs';
const j=JSON.stringify, A='document.activeElement';
const buttons=(text)=>`el.textContent.trim()===${j(text)}`;
const keys={Backspace:[8,'Backspace'],Tab:[9,'Tab'],Enter:[13,'Enter'],Escape:[27,'Escape'],ArrowUp:[38,'ArrowUp'],ArrowDown:[40,'ArrowDown'],ArrowLeft:[37,'ArrowLeft'],ArrowRight:[39,'ArrowRight'],Home:[36,'Home'],End:[35,'End'],' ':[32,'Space'],'?':[191,'Slash'],'.':[190,'Period'],'\\':[220,'Backslash'],'#':[51,'Digit3'],'/':[191,'Slash']};
let strokes=0;
function keyboard({c,ev,q,wait}){
  const press=async(k,modifiers=0,text='')=>{if(k==='Enter'&&!text)text='\r';const [vk,code]=keys[k]||[k.toUpperCase().charCodeAt(0),/\d/.test(k)?'Digit'+k:'Key'+k.toUpperCase()];
    const info={key:k,code,windowsVirtualKeyCode:vk,nativeVirtualKeyCode:vk,modifiers};
    await c.call('Input.dispatchKeyEvent',{...info,type:text?'keyDown':'rawKeyDown',...(text?{text}: {})});await c.call('Input.dispatchKeyEvent',{...info,type:'keyUp'});strokes++;
  };
  const type=async text=>{for(const k of text)await press(k,/[A-Z?#]/.test(k)?8:0,k);};
  const focused=async expr=>ev(`${A}===(${expr})`);
  const seek=async (expr,label,stroke='Tab',mod=0,max=170)=>{
    await wait(`Boolean(${expr})`,label+' available');
    for(let n=0;n<max;n++){if(await focused(expr))return n;await press(stroke,mod);}
    throw Error('Keyboard could not reach '+label+'; final active control '+await ev(`${A}?.outerHTML.slice(0,350)`));
  };
  const act=async(expr,label,stroke,mod,max)=>{await seek(expr,label,stroke,mod,max);await press('Enter');};
  return {press,type,focused,seek,act};
}
async function keyboardStartup({q,wait,ev,c}){
  const {act}=keyboard({q,wait,ev,c});
  await act(q('button',`['Continue','继续'].includes(el.textContent.trim()) && /预览版说明|preview release|preview notice|preview version/i.test(document.body.innerText)`),'clean DSH preview notice');
  await act(q('button[aria-label="Atlas"]'),'native sidebar Atlas');
}
await runBrowserSmoke(async function keyboardAcceptance({q,ev,wait,c,model,fx}){
  const {press,type,seek,act,focused}=keyboard({q,wait,ev,c});const trigger=q('button[aria-label="Atlas destinations"]');
  await c.call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});assert.equal(await ev(`matchMedia('(prefers-reduced-motion:reduce)').matches`),true);
  await c.call('Accessibility.enable');
  const ax=async(role,name)=>{const tree=await c.call('Accessibility.getFullAXTree');assert.ok(tree.nodes.some(n=>!n.ignored && n.role?.value===role && n.name?.value===name),`missing exposed ${role}: ${name}`);};
  const menu=q('[role="menu"][aria-label="Atlas destinations"]');const item=name=>q('[role="menuitem"]',`el.ariaLabel===${j(name)}`);
  const openMenu=async()=>{await seek(trigger,'Atlas destinations');await press('ArrowDown');await wait(`(${menu})?.contains(${A})`,'menu received keyboard focus');};
  const choose=async name=>{await openMenu();await act(item(name),name,'ArrowDown',0,18);};
  const names=['Desk','Discussions','Teams','Map','Library','Learn','Write'];
  const activePlace=name=>q('[role="tab"][aria-selected="true"]',`el.title===${j(name)} || el.innerText.trim()===${j(name)}`);
  await openMenu();await ax('menu','Atlas destinations');for(const name of names)await ax('menuitem',name);
  await press('Escape');await wait(`${A}===(${trigger})`,'menu Escape restored trigger');
  for(const name of names){await choose(name);await wait(`Boolean(${activePlace(name)})`,'selected tab '+name);}
  await seek(trigger,'start position for shortcut');await press('5',1);await wait(`Boolean(${activePlace('Library')})`,'Alt+5 reached Library');
  console.log('PASS seven destinations using menu/arrow/Enter, menu Escape return, Alt+5 and Chromium AX roles.');
  await seek(trigger,'palette invoking focus');
  // Use the installation’s advertised palette binding rather than assuming DSH has not claimed it.
  await openMenu();const palHint=await ev(`(${item('Commands')}).querySelector('kbd')?.textContent || (${item('Commands')}).innerText`);await press('Escape');
  if(palHint.includes('Ctrl+.'))await press('.',2);else await press('P',10);
  const palette=q('[role="dialog"][aria-label="Command palette"]');await wait(`(${palette})?.contains(${A})`,'keyboard command palette');
  await ax('dialog','Command palette');await ax('listbox','Results');
  for(const m of [0,8,0,8]){await press('Tab',m);assert.ok(await ev(`(${palette}).contains(${A})`),'palette trapped Tab');}
  await press('Escape');await wait(`${A}===(${trigger})`,'palette Escape restored original trigger');
  await choose('Commands');await type('#worm');await wait(`Boolean(${q('[role="option"][aria-selected="true"]',`el.textContent.toLowerCase().includes('worm')`)})`,'palette topic result');await press('Enter');
  await wait(`Boolean(${q('[role="tabpanel"]',`el.innerText.includes('Worm algorithm') && el.innerText.includes('The equilibrium distribution')`)})`,'topic content opened through palette');
  await choose('Keyboard shortcuts');const bindRow=q('.atlas-shortcut-list dt',buttons('Close tab'));
  const closeHint=await wait(`(${bindRow})?.nextElementSibling?.textContent`,'effective close binding');await press('Escape');
  const parts=closeHint.split('+'),closeKey=parts.at(-1);const validBinding=/^[A-Z]$/.test(closeKey) && parts.includes('Ctrl') && parts.includes('Alt');console.log('Close tab binding:',closeHint);
  const rightList=q('[role="tablist"][aria-label="Right pane"]');
  assert.equal(await ev(`(${rightList}).querySelectorAll('[role="tab"]').length`),1,'precondition: last tab in the right pane');
  const rightTopic=q('[role="tabpanel"] button',`el.textContent.trim()==='Discuss' && el.closest('[role="tabpanel"]').id===(${rightList}).querySelector('[role="tab"][aria-selected="true"]').getAttribute('aria-controls')`);
  await seek(rightTopic,'actual control inside last right content panel');
  // Never send Chromium's own Ctrl+W or substitute a dismiss button for this assertion.
  assert.ok(validBinding,'No browser-safe content-close chord: '+closeHint);await press(closeKey.toLowerCase(),3+(parts.includes('Shift')?8:0));
  await wait(`!(${rightList})`,'dismissed final right tab');
  await wait(`${A}===(${q('[role="tablist"][aria-label="Left pane"] [role="tab"][aria-selected="true"]')})`,'closing the last right tab restored actual focus to left selected tab');
  console.log('PASS real command shortcut, palette trap/return, actual focus after closing last right pane from content.');
  await choose('Map');await act(q('.atlas-map-controls button',buttons('Topic list')),'switch Map from chart to topic list');await wait(`Boolean(${q('.atlas-map-list button',`el.textContent.includes('Topological insulators')`)})`,'actual map topics accessible as a list');
  await choose('Library');const filter=q('input[aria-label="Filter papers and entries"]');await seek(filter,'local library filter');const libraryPaper=q('[role="tabpanel"] button',`el.textContent.trim()==='Three lectures on topological phases of matter'`);await wait(`Boolean(${libraryPaper})`,'actual paper before filtering');await type('zzfixturemissing');await wait(`!(${libraryPaper}) && (${filter}).value==='zzfixturemissing'`,'library actually filtered out the fixture paper');await press('a',2);await press('Backspace');await wait(`Boolean(${libraryPaper})`,'paper restored after clearing filter');
  await choose('Learn');const learnSelect=q('.atlas-learn select[aria-label="Topic"]');await seek(learnSelect,'Learn topic selector');
  const initialLearn=await ev(`(${learnSelect}).value`);const learnPick=await ev(`Array.from((${learnSelect}).options).map((o,idx)=>({title:o.textContent,idx,path:o.value})).find(v=>v.path!==${j(initialLearn)} && v.title.includes('Worm algorithm'))`);assert.ok(learnPick,'a distinct fixture learning topic');
  await press('Home');for(let i=0;i<learnPick.idx;i++)await press('ArrowDown');
  const learnTitle=q('.atlas-learn h1 button',buttons(learnPick.title));await act(learnTitle,'open selected Learn topic content');await wait(`Boolean(${q('[role="tabpanel"]',`el.innerText.includes('The equilibrium distribution')`)})`,'Learn opened selected topic note');
  await choose('Write');await act(q('.atlas-write-row button',`el.title.replaceAll('\\\\','/').endsWith('/topology/manuscript/draft.tex')`),'open fixture TeX from Write list');
  const source=q('textarea[aria-label="Source of draft.tex"]');await seek(source,'actual TeX source text box');const original=await ev(`(${source}).value`);assert.ok(original.includes('\\\\section{Edge}')||original.includes('section{Edge}'));
  await press('Tab');assert.ok(!await focused(source),'Tab leaves source editor');await press('Tab',8);assert.ok(await focused(source),'reverse Tab returns to source');await press('Tab',8);assert.ok(!await focused(source),'Shift+Tab leaves source editor backwards');assert.equal(await ev(`(${source}).value`),original,'navigation did not modify the draft');
  const outline=q('.atlas-write-panels button',buttons('Outline'));if(await ev(`(${outline}).getAttribute('aria-pressed')`)!=='true')await act(outline,'show Outline beside source');
  const divider=q('[role="separator"][aria-label="Resize the source and the panel beside it"]');await seek(divider,'resizable source outline divider');
  const measure=`(()=>{const e=(${divider});return [Number(e.getAttribute('aria-valuenow')),Math.round(e.previousElementSibling.getBoundingClientRect().width)];})()`;
  // Exercise an interior, feasible split: the outline's 220px minimum can clamp a 64→65%
  // change in a narrow tab even though the accessible requested share changes.
  await press('Home');for(let i=0;i<20;i++)await press('ArrowRight');
  const before=await ev(measure);assert.equal(before[0],50);await press('ArrowRight');await delay(100);console.log('Source divider [percent, actual pixels]:',before,'→',await ev(measure));await wait(`(()=>{const [v,w]=${measure};return v>${before[0]} && w>${before[1]}})()`,'keyboard resized source width');await press('ArrowLeft');await wait(`(${measure})[0]===${before[0]}`,'keyboard restored split');
  console.log('PASS Learn changed topic and opened it; Write opened real TeX, bidirectional Tab escapes unchanged source and arrows resize the source/outline divider.');
  const moods=new Set();for(let i=0;i<5;i++){
    const theme=await ev(`document.querySelector('.atlas-root').dataset.themeBase`);
    const motion=await ev(`(()=>{const nodes=[...document.querySelectorAll('.atlas-root button,.atlas-root svg,.atlas-root [role="tab"]')].filter(n=>n.checkVisibility()&&!n.closest('[inert],[aria-hidden="true"]'));return {count:nodes.length,moving:nodes.filter(n=>{const s=getComputedStyle(n);return s.animationName!=='none'||s.transitionDuration.split(',').some(t=>parseFloat(t)>0)||s.scrollBehavior==='smooth';}).length}})()`);
    assert.ok(motion.count>10);assert.equal(motion.moving,0,theme+'-theme visible controls respect reduced motion');moods.add(theme);if(moods.size===2)break;
    await openMenu();await act(q('[role="menuitem"]',`el.ariaLabel?.startsWith('Theme:')`),'switch theme','ArrowDown',0,18);
  }assert.ok(moods.has('day')&&moods.has('night'));
  await choose('Desk');const question=q('[aria-label="Discussion question"]');await seek(question,'discussion textbox');await type('Is the worm sampler equilibrating reproducibly?');await press('Enter');
  const conversation=q('.atlas-tab-body[data-session-id]',`el.innerText.includes('This is the Atlas fixture.')`);await wait(`Boolean(${conversation})`,'new native DSH discussion with streamed response',30000);
  const link=q('.atlas-tab-body[data-session-id] button',`el.title==='mc/worm/research.md'`);await act(link,'assistant file reference');
  await wait(`Boolean(${q('[role="tabpanel"]',`el.innerText.includes('Worm algorithm') && el.innerText.includes('The equilibrium distribution')`)})`,'open assistant-referenced note');
  await act(q('.atlas-tab-body[data-session-id] a',`el.href.includes('arxiv.org/abs/1510.07698')`),'assistant paper reference');
  await wait(`Boolean(${q('canvas[aria-label="Page 1"]',`el.width>0 && el.height>0`)}) && Boolean(${q('.atlas-pdf-text span',`el.textContent.includes('Atlas reading fixture')`)})`,'fixture PDF selectable text and accessible first page',30000);
  console.log('PASS both themes with computed reduced-motion styles, native discussion and assistant note/paper activation to real offline PDF.');
  const receipts=model.enableFixtureTeam(fx.root,'theorist');await choose('Teams');const newTeam=q('button',buttons('New team'));
  await act(newTeam,'new team');const sheet=q('.atlas-crew-sheet[role="dialog"]');await wait(`(${sheet})?.contains(${A})`,'assembly sheet focus');await ax('dialog','Assemble a team');
  // Exercise an entire modal cycle in both directions, not just two middle controls.
  for(const m of [0,8]){const start=(await c.call('Runtime.evaluate',{expression:A})).result.objectId;let cycle=0;for(;cycle<100;cycle++){
    await press('Tab',m);assert.ok(await ev(`(${sheet}).contains(${A})`),'focus escaped team dialog');
    if((await c.call('Runtime.callFunctionOn',{objectId:start,functionDeclaration:'function(){return this===document.activeElement}',returnByValue:true})).result.value)break;
  }assert.ok(cycle>=3&&cycle<100,'full tab cycle');await c.call('Runtime.releaseObject',{objectId:start});}
  await press('Escape');await wait(`${A}===(${newTeam})`,'assembly Escape returned to New team');await press('Enter');
  const fill=async(sel,label,text)=>{await seek(q(sel),label);await type(text);};
  await fill('textarea[aria-label="What should the team find out?"]','team goal','Check the fixture convention.');await fill('textarea[aria-label="Done when"]','done when','Both fixture roles confirm their cards.');
  const topic=q('select[aria-label="Topic"]');await seek(topic,'native topic selector');const ix=await ev(`Array.from((${topic}).options).findIndex(o=>o.value==='mc/worm')`);assert.ok(ix>=0);await press('Home');for(let i=0;i<ix;i++)await press('ArrowDown');assert.equal(await ev(`(${topic}).value`),'mc/worm');
  await act(q('button',buttons('Start the team')),'start native team');await wait(`Boolean(${q('.atlas-team-room')})`,'team room',30000);
  const end=Date.now()+60000;while(receipts().roleRead.length<2 && Date.now()<end)await delay(150);assert.deepEqual(receipts().roleRead.sort(),['referee','theorist']);
  const seat=q('svg[aria-label="Team constellation"] [role="button"]',`el.getAttribute('aria-label')?.startsWith('theorist ·')`);await seek(seat,'verified member star');await ax('button',await ev(`(${seat}).getAttribute('aria-label')`));
  await press('ArrowDown');const card=q('[role="dialog"]',`el.ariaLabel?.includes('theorist')`);await wait(`Boolean(${card})`,'seat detail popover');await press('Escape');await wait(`${A}===(${seat})`,'seat details restored star focus');await press('Enter');
  await wait(`Boolean(${q('.atlas-tab-body[data-session-id]',`el.innerText.includes('Fixture theorist received role card and first task.')`)})`,'real child transcript opened with Enter',30000);
  console.log('PASS bidirectional team modal trap / Escape return, real two-seat launch, focusable role star & member transcript; key presses:',strokes);
},{startup:keyboardStartup});
