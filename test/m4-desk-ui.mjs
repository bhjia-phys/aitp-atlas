// Run after building. Optional --capture publishes only the four successful fixture views, never a sign-in URL.
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { runBrowserSmoke } from './ui-smoke.mjs';
const capture=process.argv.includes('--capture'), shots=[];
await runBrowserSmoke(async function reviewDesk({q,wait,click,ev,c,place}){
  await place('Desk');const trigger=q('[aria-label="Atlas destinations"]');
  const prompt=q('[aria-label="Discussion question"]');await click(prompt,'question');
  await c.call('Input.insertText',{text:'Is the worm sampler equilibrating reproducibly?'});
  await wait(`Boolean(${q('button',`el.title.startsWith('Worm algorithm:') && el.innerText.includes('Worm')`)})`,'visible suggested topic');
  const palettes=new Set();
  for(let i=0;i<4 && palettes.size<2;i++){
    const mood=await ev(`document.querySelector('.atlas-root').dataset.themeBase`);
    if(!palettes.has(mood))for(const [width,height] of [[1440,900],[1024,768]]){
      await c.call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
      await wait(`innerWidth===${width} && innerHeight===${height}`,'real viewport');
      await ev('document.fonts.ready.then(()=>new Promise(f=>requestAnimationFrame(()=>requestAnimationFrame(f))))');
      assert.equal(await ev(`document.documentElement.scrollWidth<=innerWidth`),true,'page overflows viewport');
      assert.equal(await ev(`(${prompt}).getBoundingClientRect().width>150`),true,'composer remains usable');
      if(capture)shots.push([`m4-desk-${mood}-${width}.png`,Buffer.from((await c.call('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false})).data,'base64')]);
    }
    palettes.add(mood);if(palettes.size===2)break;
    await click(trigger,'Atlas menu');await click(q('[role="menuitem"]',`el.textContent.trim().startsWith('Theme:')`),'switch theme');
  }
  assert.deepEqual([...palettes].sort(),['day','night']);
});
if(capture){const dir=new URL('../design/1.0/reports/screens/',import.meta.url);for(const [name,data] of shots)await fs.writeFile(new URL(name,dir),data);}
