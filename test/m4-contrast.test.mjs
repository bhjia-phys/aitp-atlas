// QB-1. Default: mathematical checks, no browser required. To include the actual
// shipped CSS cascade, set ATLAS_M4_CONTRAST_UI=1 and run the same test on a built checkout.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';

const dir = new URL('../client/', import.meta.url);
const body = readdirSync(dir).filter(f => f.endsWith('.js') && f !== '90-register.js').sort().map(f => readFileSync(new URL(f, dir), 'utf8')).join('\n');
const react = { createElement: () => null, createContext: () => ({}), Component: class {} };
const { moods, reveal } = Function('require', 'window', 'setTimeout', `${body}\nreturn {moods:MOOD_TOKENS, reveal:revealElement};`)(() => react, {}, () => {});

function color(s) {
  if (/^#[a-f\d]{6}$/i.test(s)) return [...s.slice(1).matchAll(/../g)].map(x => parseInt(x[0], 16)).concat(1);
  const rgb = /^rgba?\(([^)]+)\)$/.exec(s);
  if (!rgb) throw Error(`Unknown color: ${s}`);
  const [r, g, b, a = 1] = rgb[1].split(',').map(Number);
  return [r, g, b, a];
}
// Paint the CSS sRGB channels in stacking order, then linearize for WCAG relative luminance.
function over(a, b) { return a.slice(0,3).map((c,i) => c*a[3] + b[i]*(1-a[3])).concat(1); }
function luminance(c) {
  const rgb = c.slice(0,3).map(x => x/255).map(v => v <= .04045 ? v/12.92 : ((v+.055)/1.055)**2.4);
  return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];
}
function contrast(a,b) { const x=luminance(over(a,b)), y=luminance(b); return (Math.max(x,y)+.05)/(Math.min(x,y)+.05); }

const bases=['bg','surface','raised','sunken'];
const fills=[null,'hover','pressed','selected','accent-soft','gold-soft','danger-soft','success-soft'];
function audit(tokens) {
  const results={}, get=k=>color(tokens[k]);
  function state(base, fill) { return fill ? over(get(fill),get(base)) : get(base); }
  function sample(label, key, bg, ratio, where) {
    const value=contrast(get(key),bg);
    if (!results[label] || value<results[label].value) results[label]={value, where:`${key} on ${where}`};
    assert.ok(value >= ratio, `${label}: ${key} on ${where} is ${value.toFixed(4)}, needs ${ratio}`);
  }
  for (const base of bases) {
    for(const fill of fills){
      const bg=state(base,fill), where=[base,fill].filter(Boolean).join(' + ');
      for(const key of ['text-1','text-2','text-3']) sample(key,key,bg,4.5,where);
      for(const key of ['border-control','accent']) sample(key==='accent'?'focus ring':'control boundary',key,bg,3,where);
      for(const key of ['status-active','status-proposed','status-waiting','status-blocked','status-done','status-other','idle']) sample('labelled marks',key,bg,3,where);
    }
    for(const [key,fill] of [['gold','gold-soft'],['danger-text','danger-soft'],['success-text','success-soft'],['accent','accent-soft']]) {
      sample('status ink',key,state(base,fill),4.5,`${base} + ${fill}`);
    }
    for(const key of ['code-comment','code-key','code-math']) sample('code',key,get(base),4.5,base);
  }
  for(const [key,bg] of [['text-on-accent','accent'],['text-on-accent','accent-hover'],['gold-on','gold'],['mark-ink','mark-bg'],['paper-ink','paper']]) sample('solid fills',key,get(bg),4.5,bg);
  for(const key of Array.from({length:8},(_,i)=>`n${i+1}`).concat('dx')) {
    for(const base of ['surface','sunken']) sample('identity marks',key,get(base),3,base);
  }
  return results;
}

test('WCAG uses unclipped thresholds and composites alpha before calculating luminance', () => {
  assert.equal(contrast(color('#000000'),color('#FFFFFF')),21);
  assert.equal(contrast(color('#777777'),color('#777777')),1);
  assert.ok(contrast(color('rgba(0,0,0,.5)'),color('#FFFFFF')) < 4.5);
  assert.ok(contrast(color('#777777'),color('#FFFFFF')) < 4.5, '4.478 must not pass as 4.5');
});
for(const [mood,tokens] of Object.entries(moods)) test(`WCAG: ${mood} semantic foregrounds on opaque and composited states`, t => {
  const results=audit(tokens);
  for(const [k,{value,where}] of Object.entries(results)) t.diagnostic(`${mood} ${k}: ${value.toFixed(3)} (${where})`);
});

test('following a heading preserves the landing mark without forcing a smooth scroll in reduced motion', () => {
  for(const [reduce,expected] of [[true,'instant'],[false,'smooth']]) {
    let scroll, marked=false;
    reveal({ ownerDocument:{defaultView:{matchMedia(query){assert.equal(query,'(prefers-reduced-motion: reduce)');return {matches:reduce};}}},
      scrollIntoView(arg){scroll=arg;},classList:{remove(){},add(key){assert.equal(key,'atlas-target');marked=true;}} });
    assert.deepEqual(scroll,{behavior:expected,block:'start'});assert.ok(marked);
  }
});

test('isolated Chromium: both actual Atlas moods give visible controls and static reduced-motion substitutes', {skip:process.env.ATLAS_M4_CONTRAST_UI!=='1', timeout:180000}, async t=>{
  const {runBrowserSmoke}=await import('./ui-smoke.mjs');
  await runBrowserSmoke(async function measuredControls({q,wait,click,ev,c}) {
    const root=`document.querySelector('.atlas-root')`, theme=()=>ev(`${root}.dataset.themeBase`);
    const setMood=async target=>{for(let i=0;i<4;i++){
      if(await theme()===target)return;
      await click(q('button[aria-label="Atlas destinations"]'),'workspace menu');
      await click(q('[role="menuitem"]',`el.ariaLabel?.startsWith('Theme:')`),'cycle Atlas mood');
    }assert.equal(await theme(),target);};
    await wait(`Boolean(${q('.atlas-desk-composer textarea')})`,'fixture Desk');
    // Probes only materialize semantic roles that may not be present on an idle Desk
    // (e.g. a running seat). All styles come from the product, never injected CSS.
    const motion=['atlas-tab-working','atlas-almanac-mark is-working','atlas-disc-mark is-running','atlas-crew-twinkle','atlas-crew-light','atlas-desk-route-path'];
    for(const mood of ['day','night']){
      await setMood(mood);
      const observed=await ev(`(()=>{const root=${root}, css=el=>getComputedStyle(el);const fixture=document.createElement('div');fixture.dataset.contrastFixture='';fixture.inert=true;fixture.setAttribute('aria-hidden','true');fixture.className='atlas-control-dialog';root.append(fixture);
        const node=(tag,cls,parent=fixture)=>{const el=document.createElement(tag);el.className=cls;parent.append(el);return el;};
        const primary=node('button','atlas-button is-primary'), secondary=node('button','atlas-button'), ctrl=node('input','atlas-control-input'), select=node('select','atlas-control-select'), check=node('input','',node('label','atlas-control-check'));check.type='checkbox';
        const warn=node('span','atlas-chip atlas-chip-needs'),success=node('span','atlas-room-success',node('div','atlas-room-table')),error=node('span','atlas-crew-error');
        for(const cls of ${JSON.stringify(motion)})node('span',cls).dataset.motion='';
        const composer=root.querySelector('.atlas-desk-composer'),box=composer.querySelector('textarea');
        // Focus via the keyboard path is covered by m4-keyboard-ui. Here choose a known
        // visible native textbox and measure the focus-within border produced by the real CSS.
        const previous=document.activeElement;previous?.blur();const composerBorder=css(composer).borderTopColor;
        box.focus({preventScroll:true});const ring=css(composer).borderTopColor;box.blur();previous?.focus({preventScroll:true});
        return {raised:css(fixture).backgroundColor,surface:css(root.querySelector('.atlas-desk')).backgroundColor,body:css(box).color,
          placeholder:getComputedStyle(box,'::placeholder').color,secondary:css(secondary).borderTopColor,primary:[css(primary).color,css(primary).backgroundColor],
          inputs:[ctrl,select,check].map(el=>[css(el).borderTopColor,css(el).backgroundColor]),composerBorder,ring,
          warn:[css(warn).color,css(warn).backgroundColor],success:[css(success).color,css(success).backgroundColor],error:css(error).color};})()`);
      const check=(fg,bg,min,k)=>{const r=contrast(color(fg),bg);assert.ok(r>=min,`${mood} ${k} ${r.toFixed(3)}: ${fg} on ${bg}`);return r.toFixed(2);};
      const raised=color(observed.raised), surface=color(observed.surface);
      const samples={body:check(observed.body,raised,4.5,'composer ink'),placeholder:check(observed.placeholder,raised,4.5,'placeholder'),primary:check(observed.primary[0],color(observed.primary[1]),4.5,'primary'),secondary:check(observed.secondary,raised,3,'secondary outline'),composer:check(observed.composerBorder,surface,3,'composer outline'),focus:check(observed.ring,surface,3,'Desk focus')};
      assert.notEqual(observed.composerBorder,observed.ring);
      for(const [border,bg] of observed.inputs){check(border,color(bg),3,'input inner boundary');check(border,raised,3,'input outer boundary');}
      for(const [k,pair] of [['warning',observed.warn],['success',observed.success]])samples[k]=check(pair[0],over(color(pair[1]),raised),4.5,k);
      samples.error=check(observed.error,raised,4.5,'error');
      t.diagnostic(`${mood} computed CSS ratios ${JSON.stringify(samples)}`);
      for(const value of ['no-preference','reduce']){
        await c.call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value}]});
        const names=await ev(`Array.from(document.querySelectorAll('[data-contrast-fixture] [data-motion]'), el=>getComputedStyle(el).animationName)`);
        assert.equal(names.length,motion.length);assert.ok(names.every(n=>value==='reduce'?n==='none':n!=='none'),`${mood} ${value}: ${names}`);
        if(value==='reduce')assert.equal(await ev(`getComputedStyle(document.querySelector('[data-contrast-fixture] .atlas-button')).transitionDuration`),'0s');
      }
      await ev(`document.querySelector('[data-contrast-fixture]').remove()`);
    }
  });
});
