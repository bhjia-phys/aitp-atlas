import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = name => readFileSync(new URL(`../client/${name}.js`, import.meta.url), 'utf8');
const data = source('23-inquiry-data'), view = source('24-inquiry');
function helpers(deps = {}) {
  return new Function(...Object.keys(deps), `${data}\n${view}\nreturn { INQUIRY_FIELDS, inquirySourceLink, inquiryBranches, useInquiryAction, InquiryEdges, InquiryStrip, InquiryDesk, InquiryBranchStep, ATLAS_INQUIRY_CSS };`)(...Object.values(deps));
}

test('input bounds and activatable source URLs match the shared seed contract', () => {
  const { inquirySourceLink: link, INQUIRY_FIELDS } = helpers();
  assert.deepEqual(Object.values(INQUIRY_FIELDS).map(f => f.limit), [4000,4000,2048,6000]);
  assert.equal(link('https://example.org/article?lang=en#page=2').hostname, 'example.org');
  for (const bad of ['file:///notes', 'javascript:alert(1)', '//example.org', 'https:///example.org', 'https://u:p@example.org', 'https://example.org/a\nb', 'not a URL']) assert.equal(link(bad), null, bad);
});

test('public chat read permission is offered only for a permitted URL and cleared on every URL edit', () => {
  const url = 'https://chatgpt.com/share/00000000-0000-0000-0000-000000000001', calls = [], patches = [];
  const h = (type, props, ...children) => (calls.push({type,props}), {type,props,children});
  const { InquiryDesk } = helpers({h, Icon:'icon', React:{useId:() => 'unique-help'}});
  const draw = inquiry => { calls.length = 0; InquiryDesk({inquiry,onChange:patch => patches.push(patch)}); return calls.find(c => c.type === 'input' && c.props.type === 'checkbox'); };
  assert.equal(draw({sourceUrl:'https://example.org/chat',readPublicSource:true}),undefined);
  const offered = draw({sourceUrl:url}); assert.equal(offered.props.checked,false); assert.deepEqual(patches,[]);
  offered.props.onChange({target:{checked:true}}); assert.deepEqual(patches,[{readPublicSource:true}]);
  assert.equal(draw({sourceUrl:url,readPublicSource:true}).props.checked,true);
  calls.find(c => c.props?.name === 'sourceUrl').props.onChange({sourceUrl:url+'?changed'});
  assert.deepEqual(patches.at(-1),{sourceUrl:url+'?changed',readPublicSource:false});
});

test('routes retain each branch, mutual link and distinct evidence without traversal or inferred edges', () => {
  const { inquiryBranches } = helpers();
  const edge = (from, to, status) => Object.freeze({from,to,status,assumptions:[],evidence:[]});
  const edges = Object.freeze([edge('A','B','open'),edge('B','A','conditional'),edge('A','C','open'),edge('A','B','conditional')]);
  assert.deepEqual(inquiryBranches(edges), [['A',[edges[0],edges[2],edges[3]]],['B',[edges[1]]]]);
  assert.deepEqual(inquiryBranches([]), []);
});

test('null transcript yields no discussion strip; branch items receive only their reported edge and navigation', () => {
  // Inspect component calls, not a DOM or a visual preview.
  const calls = [], h = (type, props, ...children) => (calls.push({type,props}), {type,props,children});
  const { InquiryStrip, InquiryEdges, InquiryBranchStep } = helpers({ h, Icon:'icon' });
  assert.equal(InquiryStrip({ mode:'discussion', inquiry:null }), null);
  const edges = [{from:'q',to:'a',status:'open',assumptions:[],evidence:[]},{from:'q',to:'b',status:'conditional',assumptions:['bound'],evidence:[]}];
  const open = () => assert.fail('Render must not open a pointer');
  const section = InquiryEdges({ edges, onOpenEvidence:open });
  assert.equal(section.type, 'details');
  assert.deepEqual(calls.filter(c => c.type === InquiryBranchStep).map(c => [c.props.edge,c.props.onOpenEvidence]), edges.map(e => [e,open]));
});

test('a previous map is labelled as history, preserves a user correction and never enables stale card actions', () => {
  const h = (type, props, ...children) => ({type,props,children});
  const { InquiryStrip } = helpers({h});
  const inquiry = {previous:true,edges:[],proposal:{},result:{}};
  const render = provenance => InquiryStrip({inquiry,provenance});
  assert.equal(render('lead').children[0].props.provenance,'prior');
  assert.equal(render('correction').children[0].props.provenance,'correction');
  assert.equal(render('lead').children[2].props.previous,true);
  assert.deepEqual(render('lead').children.slice(3),[false,false]);
});

test('async action guards repeated clicks, forwards failure detail, and can retry', async () => {
  const writes = [];
  const { useInquiryAction } = helpers({ useRef: current => ({current}), useState: initial => [initial, value => writes.push(value)] });
  const action = useInquiryAction(); let finish, calls = 0;
  const first = action.run('teach', () => { calls++; return new Promise(resolve => { finish = resolve; }); });
  assert.equal(await action.run('teach', () => { calls++; }), false); assert.equal(calls, 1);
  finish(); assert.equal(await first, true);
  assert.equal(await action.run('open', () => { throw new Error('Evidence file missing'); }), false);
  assert.ok(writes.includes('Evidence file missing'));
  assert.equal(await action.run('retry', () => { calls++; }), true); assert.equal(calls, 2);
});

test('stylesheet is registered with Atlas and references day/night tokens, not fixed palette colors', () => {
  const css = helpers().ATLAS_INQUIRY_CSS;
  const { day,night } = new Function('externalStore', `${source('05-theme')}\nreturn THEME_TOKENS;`)(() => ({}));
  for (const [,key] of css.matchAll(/var\(--([\w-]+)\)/g)) assert.ok(Object.hasOwn(day,key) && Object.hasOwn(night,key), key);
  assert.doesNotMatch(css, /#[\da-f]{3,8}\b/i);
  assert.match(source('80-styles'), /style\.textContent\s*=\s*\[[^\]]*\bATLAS_INQUIRY_CSS\b/);
});
