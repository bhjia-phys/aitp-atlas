import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readInquiryFigure } from '../lib/inquiry-figure.js';
import { routeTable, handlerFor } from '../lib/routes.js';

// Deliberately non-scientific parser/renderer fixtures. Not shipped research data.
const source = 'tables/check.atlas-figure.json', data = 'tables/check.csv', report = 'tables/replay.md';
const manifest = {kind:'computed', data, report, xLabel:'index', xUnit:'1', yLabel:'test value', yUnit:'1', normalization:'none', commonParameters:'same synthetic inputs'};
async function fixture(t) {
  const tmp = await fs.mkdtemp(path.join(await fs.realpath(os.tmpdir()),'atlas-figure-test-'));
  t.after(()=>fs.rm(tmp,{recursive:true,force:true}));
  const root = path.join(tmp,'workspace');
  await fs.mkdir(path.join(root,'tables'),{recursive:true});
  const set = (rel, str) => fs.writeFile(path.join(root,rel), typeof str === 'object' && !Buffer.isBuffer(str) ? JSON.stringify(str) : str);
  await Promise.all([set(source,manifest),set(data,'index,A,"B, synthetic"\r\n0,-2,9\r\n1,0,1\r\n3,4,2e1\r\n'),set(report,'# Replay\nSynthetic parser test only. No scientific calculation.')]);
  return {tmp,root,set,read:(pointer=source)=>readInquiryFigure(root,pointer)};
}
function limited(result, pattern) { assert.deepEqual(Object.keys(result).sort(),['available','limitation']); assert.equal(result.available,false); assert.match(result.limitation,pattern); }

test('strict computed CSV comparison preserves the reported samples, not a verification status',async t=>{
  const f = await fixture(t), v = await f.read();
  assert.equal(v.available,true); assert.equal(v.kind,'computed'); assert.equal(v.report,report);
  assert.deepEqual(v.columns,['index','A','B, synthetic']); assert.deepEqual(v.rows,[[0,-2,9],[1,0,1],[3,4,20]]);
  assert.deepEqual(v.domain,{x:[0,3],y:[-2,20]}); assert.equal(v.verified,undefined); assert.equal(v.reportBody,undefined);
});

test('missing comparison conditions or unreadable evidence stop all computed curves',async t=>{
  const f=await fixture(t);
  for (const [k,message] of [['xUnit',/x unit/],['yLabel',/y label/],['normalization',/normalization/],['commonParameters',/common parameters/],['report',/replay or evidence/]]) {
    const m={...manifest}; delete m[k]; await f.set(source,m); limited(await f.read(),message);
  }
  await f.set('tables/template.md','---\ntype: report\n---\n# Replay\n<!-- attach a real run -->\nTODO');
  for (const [change,pattern] of [[{report:'tables/template.md'},/placeholders/],[{kind:'verified'},/schematic or computed/],[{xUnit:'unknown'},/x unit/],[{report:'no-report.md'},/report is missing/],[{report:'tables/empty.txt'},/report is empty/],[{curves:[[0,1]]},/unrecognized/]]) {
    await f.set('tables/empty.txt','  \n'); await f.set(source,{...manifest,...change}); limited(await f.read(),pattern);
  }
});

test('an explicit schematic reads a numeric wide JSON grid without a computed claim or implied units',async t=>{
  const f=await fixture(t), p='tables/rows.json';
  await f.set(source,{kind:'schematic',data:p,xLabel:'index',yLabel:'test value'});
  await f.set(p,{columns:['index','A','B'],rows:[[0,-1,-1],[2,-1,-1]]});
  const v=await f.read(); assert.equal(v.available,true); assert.equal(v.kind,'schematic'); assert.deepEqual(v.domain.y,[-1,-1]); assert.equal(v.xUnit,undefined); assert.equal(v.report,undefined);
  for (const [table,msg] of [[{columns:['wrong','A','B'],rows:[]},/match/],[{columns:['index','A','A'],rows:[]},/distinct/],[{columns:['index','A','B'],rows:[[0,'0',1],[1,0,1]]},/finite/],[{columns:['index','A','B'],rows:[[0,0,1],[1,0,1]],conditions:{A:'odd',B:'even'}},/two to six/]]) {
    await f.set(p,table); limited(await f.read(),msg);
  }
});

test('never invents, imputes, sorts or downsamples CSV values',async t=>{
  const f=await fixture(t);
  for (const [input,pattern] of [['index,A\n0,1\n1,1',/two to six/],['index,A,B\n0,0,0',/sample rows/],['index,A,B\n0,,1\n1,0,1',/finite/],['index,A,B\n0,=1,1\n1,0,1',/finite/],['index,A,B\n0,2,1\n0,0,1',/increase/],['index,A,B\n1,2,1\n0,0,1',/increase/],['index,A,B\n0,1e999,1\n1,0,1',/finite/],['index,A,B\n-1e308,0,1\n1e308,0,1',/range/],['index,A,B\n'+'1,2,3\n'.repeat(2001),/exceeds 2000/],['index,A,B\n0,2,1\n1,2,3,4',/finite/]]) {
    await f.set(data,input); limited(await f.read(),pattern);
  }
});

test('rejects nonlocal, hidden, device, linked and oversized inputs without returning contents',async t=>{
  const f=await fixture(t);
  for (const p of ['../x.atlas-figure.json','/outside.atlas-figure.json','https://outside/a.atlas-figure.json','\\\\server\\a.atlas-figure.json','C:/a.atlas-figure.json','a%2fb.atlas-figure.json','.git/a.atlas-figure.json','aux.atlas-figure.json','tables/other.json']) limited(await f.read(p),/safe workspace-relative/);
  for (const [key,p] of [['data','../other.csv'],['report','tables/no.pdf'],['report','C:/outside/report.md'],['data','https://host/data.json'],['data','.private/data.csv']]) {
    await f.set(source,{...manifest,[key]:p}); limited(await f.read(),/safe workspace-relative/);
  }
  const outside=path.join(f.tmp,'outside'); await fs.mkdir(outside);
  await fs.writeFile(path.join(outside,'external.csv'),'external sentinel');
  await fs.symlink(outside,path.join(f.root,'linked'),'junction'); await f.set(source,{...manifest,data:'linked/external.csv'}); limited(await f.read(),/unlinked/);
  await fs.link(path.join(outside,'external.csv'),path.join(f.root,'hard.csv')); await f.set(source,{...manifest,data:'hard.csv'}); limited(await f.read(),/unlinked/);
  await f.set(source,manifest); await f.set(data,Buffer.alloc(256*1024+1)); limited(await f.read(),/exceeds/);
  await f.set(source,' '.repeat(16*1024+1)); limited(await f.read(),/exceeds/);
});

test('figure route requires matching root, one pointer, read-only verb and authentication',async t=>{
  const f=await fixture(t);
  const route=routeTable({settings:{root:f.root}}).find(r=>r.path.endsWith('/inquiry-figure'));
  async function request(query,{method='GET',denied=false}={}) {
    let json; const res={setHeader(){},end(value){json=JSON.parse(value);}};
    await handlerFor(route,()=>({requestRejection:()=>denied ? 403 : 0}))({url:route.path+'?'+new URLSearchParams(query),headers:{},method},res);
    return {code:res.statusCode,json};
  }
  const q={source,expectedRoot:f.root}; assert.equal((await request(q)).json.available,true);
  assert.equal((await request(q,{denied:true})).code,403); assert.equal((await request(q,{method:'POST'})).code,405);
  assert.equal((await request({source})).code,400); assert.equal((await request({...q,expectedRoot:f.tmp})).code,409);
  assert.equal((await request({...q,data})).code,400); assert.equal((await request([...Object.entries(q),['source',source]])).code,400);
});

const client = readFileSync(new URL('../client/26-inquiry-figure.js',import.meta.url),'utf8');
const h = (type,props,...children)=>({type,props:props || {},children:children.flat(Infinity).filter(c=>c!=null && c!==false)});
const nodes = v=>v && typeof v === 'object' ? [v,...v.children.flatMap(nodes)] : [];
const text = v=>typeof v === 'object' ? v.children.map(text).join(' ') : String(v);

test('loading is explicitly requested, stale requests are aborted, and missing evidence never renders SVG',async()=>{
  let state, cleanup, rejectLoad; const flight={current:null}, calls=[];
  const factory = new Function('h','Button','useEffect','useState','useRef','fetch','API',client+';return [InquiryFigure, InquiryFigureRequest, InquiryFigurePlot]');
  const [container,request,plot] = factory(h,'Button',effect=>{cleanup=effect();},()=>[state,v=>{state=v;}],()=>flight,(addr,opts)=>{calls.push({addr,opts});return new Promise((_,rej)=>{rejectLoad=rej;});},'/api');
  const opts={root:'/workspace',source}; assert.match(text(container({root:opts.root})),/No comparison dataset/);
  assert.notEqual(container({root:opts.root,figure:{source}}).props.key,container({root:'/else',figure:{source}}).props.key);
  const initial=request(opts); assert.equal(calls.length,0); assert.equal(nodes(initial).some(n=>n.type===plot),false);
  const loading=nodes(initial).find(n=>n.type==='Button').props.onClick(); assert.equal(calls.length,1);
  const url=new URL(calls[0].addr,'http://local'); assert.deepEqual(Object.fromEntries(url.searchParams),{expectedRoot:opts.root,source});
  cleanup(); assert.equal(calls[0].opts.signal.aborted,true); rejectLoad(new Error('stale')); await loading; assert.equal(state.limitation,undefined);
  state={available:false,limitation:'no report'}; const limitedUI=request(opts); assert.match(text(limitedUI),/Comparison unavailable: no report/); assert.equal(nodes(limitedUI).some(n=>n.type===plot),false);
});

test('the plot uses one domain, supplied samples, distinguishable strokes and an explicit provenance boundary',async t=>{
  const f=await fixture(t), table=await f.read(), refs=[];
  const plot=new Function('h','joinPath',client+';return InquiryFigurePlot;')(h,path.join);
  const view=plot({table,root:f.root,onOpenRef:x=>refs.push(x)});
  assert.match(text(view),/did not replay or independently verify/); assert.match(text(view),/Common parameters:.*synthetic/); assert.match(text(view),/Normalization:.*none/);
  const curves=nodes(view).filter(n=>n.type==='polyline'); assert.equal(curves.length,2); assert.notEqual(curves[0].props.strokeDasharray,curves[1].props.strokeDasharray);
  const xy=curve=>curve.props.points.split(' ').map(p=>p.split(',').map(Number)); assert.deepEqual(xy(curves[0]).map(p=>p[0]),xy(curves[1]).map(p=>p[0])); assert.ok(xy(curves[0])[0][1] > xy(curves[1])[0][1]);
  nodes(view).find(n=>n.type==='button' && text(n)===report).props.onClick(); assert.equal(refs[0],path.join(f.root,report));
  assert.match(text(plot({table:{...table,kind:'schematic'},root:f.root})),/not a computed result/);
  const tight = plot({table:{...table, rows:[[10000,0,1],[10001,0,Number.MAX_VALUE]],domain:{x:[10000,10001],y:[0,Number.MAX_VALUE]}},root:f.root});
  assert.match(text(tight),/10000 to 10001/); assert.doesNotMatch(text(tight),/Infinity/); assert.deepEqual(nodes(tight).filter(n=>n.type==='text').slice(-2).map(text),['min','max']);
});
