import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Run the actual shipped functions. Capture React element props to exercise
// the same SVG button and popover callbacks the browser receives (no fake DOM).
const source = readFileSync(new URL('../client/67-constellation.js', import.meta.url), 'utf8');
function harness() {
  let pos = 0;
  const state = [];
  const useState = init => {
    const i = pos++;
    if (!(i in state)) state[i] = init;
    return [state[i], v => { state[i] = typeof v === 'function' ? v(state[i]) : v; }];
  };
  const h = (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity).filter(v => v != null && v !== false) });
  const helpers = { h, useState, useRef: current => ({ current }), useMemo: f => f(), useEffect() {}, useLayoutEffect() {},
    React: { useId: () => 'local' }, cx: (...s) => s.filter(Boolean).join(' '), Button: 'Button', Popover: 'Popover' };
  const lib = new Function(...Object.keys(helpers), source + '\nreturn {layoutConstellation, TeamConstellation, ATLAS_CONSTELLATION_CSS};')(...Object.values(helpers));
  return { ...lib, render(props) { pos = 0; return lib.TeamConstellation(props); } };
}
const all = (n, predicate) => typeof n !== 'object' || !n ? [] : [...(predicate(n) ? [n] : []), ...n.children.flatMap(c => all(c,predicate))];
const byType = (tree,type) => all(tree,n=>n.type===type);
const buttons = tree => all(tree,n=>n.props.role==='button');
const lead = { name:'lead', role:'Lead', sessionId:'l', state:'working', model:{provider:'p',model:'one',effort:'high'} };
const seats = [
  { name:'author', role:'Theorist', sessionId:'a', model:'p / two', state:'idle', done:2, total:5, reports:['R01','R03'] },
  { name:'reviewer', role:'Referee', sessionId:'r', task:'Check R03', state:'working', model:'p / three', done:0, total:1, reviews:['V03'] },
  { name:'writer', role:'Writer', state:'not-started' },
];

test('TM-20: centered lead and evenly spaced members in charter order, responsive across pane widths and team sizes', () => {
  const { layoutConstellation } = harness();
  for (const width of [248,344,360,528,560,1140]) for (const n of [0,1,2,3,6,12,40]) {
    const members = Array.from({length:n},(_,i)=>({name:`member-${i}`,role:'Custom',task:'Long localized label 示例文本',state:'working'}));
    const g = layoutConstellation({lead,seats:members,width});
    assert.deepEqual([g.cx,g.cy,g.height], [width/2,115,230]);
    assert.deepEqual([g.marks[0].x,g.marks[0].y], [g.cx,g.cy]);
    members.forEach((m,i)=>{
      const mark=g.marks[i+1], rad=(200+360*i/n)*Math.PI/180;
      assert.equal(mark.seat,m);
      assert.ok(Math.abs((mark.x-g.cx)/g.rx-Math.cos(rad))<1e-10);
      assert.ok(Math.abs((mark.y-g.cy)/g.ry-Math.sin(rad))<1e-10);
      assert.ok(Math.abs((mark.x-g.cx)**2/g.rx**2+(mark.y-g.cy)**2/g.ry**2-1)<1e-10);
      assert.equal(mark.color,i<8?`var(--n${i+1})`:'var(--dx)');
    });
    for (let j=0;j<g.labels.length;++j) {
      const b=g.labels[j].box;
      assert.ok(b.x>=b.w/2 && b.x+b.w/2<=width && b.y>=b.h/2 && b.y+b.h/2<=230);
      for (const other of g.labels.slice(0,j).map(l=>l.box)) assert.ok(Math.abs(b.x-other.x)*2>b.w+other.w || Math.abs(b.y-other.y)*2>b.h+other.h);
    }
    assert.deepEqual(g, layoutConstellation({lead,seats:members,width}));
  }
});

test('rings encode only known valid counts; twinkles represent observed work, never startup, absent seat or a proposed crew', () => {
  const {layoutConstellation,render}=harness();
  const variants = [{done:4,total:4},{done:1,total:0},{done:2,total:1},{done:1.5,total:3},{done:0,total:3}].map((v,i)=>({name:'seat-'+i,...v}));
  const g=layoutConstellation({lead,seats:[...seats,...variants]});
  assert.deepEqual(g.marks.map(m=>m.fraction),[null,.4,0,null,1,null,null,null,0]);
  assert.deepEqual(g.marks.filter(m=>m.working).map(m=>m.name),['lead','reviewer']);
  assert.deepEqual(g.marks.filter(m=>m.missing).map(m=>m.name),['writer']);
  const tree=render({lead,seats});
  const progress=all(tree,n=>n.props.className==='atlas-crew-progress');
  assert.equal(progress.length,1); assert.equal(progress[0].props.strokeDasharray,'40 100'); assert.match(progress[0].props.transform,/^rotate\(-90 /);
  const missing=all(tree,n=>n.type==='circle' && n.props.strokeDasharray==='2 2');assert.equal(missing.length,1);
  const sr=byType(tree,'ul')[0];assert.equal(sr.children.length,4);
  assert.match(sr.children[0].children[0], /lead · Lead · p \/ one · high · working/);
  assert.match(sr.children[2].children[0], /reviewer · Referee · p \/ three · working · Check R03/);
  const proposed=render({mode:'assembly',lead,seats}), mini=render({mode:'thumbnail',lead,seats});
  assert.equal(byType(proposed,'svg')[0].props.height,120);assert.equal(buttons(proposed).length,0);
  assert.equal(all(proposed,n=>n.props.className==='atlas-crew-twinkle').length,0);
  assert.equal(byType(proposed,'ul')[0].children.some(li=>li.children[0].includes('working')),false);
  assert.deepEqual([mini.props.width,mini.props.height,mini.props['aria-hidden']],[48,32,true]);
  assert.equal(buttons(mini).length,0);
});

test('only independent in-progress review / submitted-to-lead routes; deduplicate, curve outward, cap six', () => {
  const {layoutConstellation,render,ATLAS_CONSTELLATION_CSS}=harness();
  const paths=[{from:'author',to:'lead',kind:'accepted',id:'closed'}, {from:'author',to:'reviewer',kind:'submitted',id:'mistarget'}, {from:'absent',to:'lead',kind:'submitted',id:'missing'}, {from:'author',to:'author',kind:'review',id:'self'},
    {from:'author',to:'reviewer',kind:'review',id:'V03'}, {from:'author',to:'reviewer',kind:'review',id:'V03'}, ...Array.from({length:9},(_,i)=>({from:'author',to:'lead',kind:'submitted',id:'R'+i}))];
  const g=layoutConstellation({lead,seats,paths});assert.deepEqual(g.arcs.map(a=>a.id),['V03','R0','R1','R2','R3','R4']);
  for(const a of g.arcs) {
    assert.ok(!a.d.includes('NaN'));assert.ok(a.d.endsWith(`${a.to.x},${a.to.y}`));
    const mx=(a.from.x+a.to.x)/2,my=(a.from.y+a.to.y)/2;
    assert.ok(Math.hypot(a.qx-g.cx,a.qy-g.cy)>=Math.hypot(mx-g.cx,my-g.cy));
  }
  assert.equal(layoutConstellation({lead,seats,paths,mode:'assembly'}).arcs.length,0);
  assert.equal(byType(render({lead,seats,paths}),'path').filter(n=>n.props.className?.includes('atlas-crew-light')).length,6);
  assert.match(ATLAS_CONSTELLATION_CSS, /prefers-reduced-motion:reduce\)\s*\{\s*\.atlas-crew-twinkle,\.atlas-crew-light\s*\{\s*animation:none/);
});

function keyboard(key) {return {key,currentTarget:{isConnected:true}, stopped:false, prevented:false, preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;}};}
test('interactive marks: Enter/Space open verified session; Down enters accessible seat card, Message targets the correct seat; missing seats ask the lead',()=>{
  const {render}=harness(),opened=[],mentioned=[],asked=[];
  const props={lead,seats,onOpen:s=>opened.push(s.sessionId),onMessage:s=>mentioned.push(s.name),onAskStart:s=>asked.push(s.name)};
  let tree=render(props),marks=buttons(tree);
  assert.equal(marks.length,4);assert.ok(marks.every(n=>n.props.tabIndex===0));
  for (const key of ['Enter',' ']) {const e=keyboard(key);marks[1].props.onKeyDown(e);assert.ok(e.stopped && e.prevented);}
  marks[2].props.onClick(keyboard(''));assert.deepEqual(opened,['a','a','r']);
  const noop=keyboard('Tab');marks[1].props.onKeyDown(noop);assert.equal(noop.stopped,false);
  const down=keyboard('ArrowDown');marks[1].props.onKeyDown(down);
  tree=render(props);let card=byType(tree,'Popover')[0];assert.equal(card.props.autoFocus,true);assert.equal(card.props.anchor,down.currentTarget);
  assert.match(card.props.label,/author seat details/);assert.ok(byType(card,'dd').some(n=>n.children.includes('R01, R03')));
  byType(card,'Button').find(b=>b.children[0]==='Message').props.onClick();assert.deepEqual(mentioned,['author']);
  tree=render(props);assert.equal(byType(tree,'Popover').length,0);
  buttons(tree)[3].props.onKeyDown(keyboard('Enter'));
  card=byType(render(props),'Popover')[0];const actions=byType(card,'Button');assert.deepEqual(actions.map(b=>b.children[0]),['Ask the lead to start it']);
  actions[0].props.onClick();assert.deepEqual(asked,['writer']);
  tree=render({lead,seats});buttons(tree)[1].props.onKeyDown(keyboard('Enter'));
  assert.equal(byType(byType(render({lead,seats}),'Popover')[0],'Button').length,0,'read-only legacy chart has no live actions');
});

test('Assembly: interactive mini may select an actual seat; never treats it as a running session',()=>{
  const {render}=harness(), selected=[];
  const tree=render({mode:'assembly',lead,seats,onSelect:s=>selected.push(s)});
  buttons(tree)[2].props.onKeyDown(keyboard(' '));assert.deepEqual(selected,[seats[1]]);
  assert.equal(byType(tree,'Popover').length,0);
});
