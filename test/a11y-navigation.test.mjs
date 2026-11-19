import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const source=n=>readFileSync(new URL(`../client/${n}.js`,import.meta.url),'utf8');
const h=(type,props,...children)=>({type,props:props||{},children:children.flat(Infinity).filter(Boolean)});
const nodes=el=>typeof el==='object'?[el,...el.children.flatMap(nodes)]:[];
const setup=(text,deps)=>new Function(...Object.keys(deps),text)(...Object.values(deps));
function strip(cancel=false){
  const calls=[]; const successor={focus:()=>calls.push('focus successor')};
  const ref={current:{closest:()=>null,querySelector:()=>successor}};
  const deps={h,useRef:()=>ref,useState:v=>[v,()=>{}],useLayoutEffect:()=>{},cx:(...s)=>s.filter(Boolean).join(' '),tabV2Label:t=>t.title,tabV2Icon:()=>'',Icon:'Icon',IconButton:'IconButton',editorDirty:{},requestAnimationFrame:f=>f(),document:{getElementById:id=>({focus:()=>calls.push('focus '+id)})}};
  const render=setup(source('72-tabs').split('function AtlasTabStrip(')[1].split('const ATLAS_TAB_CSS')[0].replace(/^/,'return function AtlasTabStrip('),deps);
  const ids=['desk','r','s'];const view=render({pane:'left',ids,active:'r',tabs:{desk:{title:'Desk'},r:{title:'Results'},s:{title:'Summary'}},running:t=>t.title==='Results',onDropAt:()=>({}),domId:(part,id)=>part+'-'+id,onShow:id=>calls.push('show '+id),onClose:id=>{calls.push('close '+id);return !cancel;}});
  return {view,calls,all:nodes(view)};
}
function key(node,k,other={}){const target={};let blocked=false;node.props.onKeyDown({key:k,target,currentTarget:target,preventDefault(){blocked=true;},...other});return blocked;}
test('pane tabs have one roving entry, only the tab labels and statuses as names, and no nested buttons',()=>{
  const {all,calls}=strip(); const tabs=all.filter(el=>el.props.role==='tab');
  assert.deepEqual(tabs.map(t=>t.props.tabIndex),[-1,0,-1]);assert.deepEqual(tabs.map(t=>t.props['aria-controls']),['panel-desk','panel-r','panel-s']);
  assert.equal(tabs[1].props['aria-label'],'Results · Working');assert.ok(tabs.every(t=>nodes(t).slice(1).every(n=>n.type!=='button')));
  assert.equal(key(tabs[1],'ArrowRight'),true);assert.equal(key(tabs[2],'ArrowRight'),true);assert.equal(key(tabs[0],'End'),true);assert.equal(key(tabs[2],'Home'),true);
  assert.deepEqual(calls,['show s','focus tab-s','show desk','focus tab-desk','show s','focus tab-s','show desk','focus tab-desk']);assert.equal(key(tabs[1],'ArrowLeft',{altKey:true}),false);
});
test('Delete and separately named close share restoration; Desk and cancelled closes keep focus',()=>{
  const {all,calls}=strip(); const tabs=all.filter(n=>n.props.role==='tab');assert.equal(key(tabs[0],'Delete'),false);assert.equal(key(tabs[1],'Delete'),true);
  const close=all.find(n=>n.props['aria-label']==='Close Results');close.props.onClick();assert.deepEqual(calls,['close r','focus successor','close r','focus successor']);
  const cancelled=strip(true);cancelled.all.find(n=>n.props['aria-label']==='Close Results').props.onClick();assert.deepEqual(cancelled.calls,['close r']);
});
test('global close from a right panel restores the surviving tab even when the right strip unmounts',()=>{
  const code=source('70-shell').split('const close = (id,returnFocus=false) => {')[1].split('\n  };')[0];
  const focusNext=setup(source('72-tabs').split('function tabFocusSuccessor(')[1].split('\nfunction tabScreenLayout(')[0].replace(/^/,'return function('),{});
  const old={tabs:{r:{},desk:{}},layout:{active:{left:'desk',right:'r'}}},stateRef={current:old},calls=[];
  const close=setup(`return (id,returnFocus=false)=>{${code}}`,{stateRef,live:{current:true},narrow:false,editorDirty:{},tabFocusSuccessor:focusNext,tabScreenLayout:s=>s.layout,paneOfTab:()=> 'right',tabCloseState:()=>({tabs:{desk:{}},layout:{active:{left:'desk',right:null}}}),update:f=>stateRef.current=f(stateRef.current),requestAnimationFrame:f=>f(),domId:(s,id)=>s+'-'+id,document:{getElementById:id=>({focus:()=>calls.push(id)})}});
  assert.equal(close('r',true),true);assert.deepEqual(calls,['tab-desk']);assert.equal(close('desk',true),false);assert.deepEqual(calls,['tab-desk']);
  assert.match(source('70-shell'),/onClose:\(\)=>close\(active,true\)/);
});
test('Write source divider is focusable and reports bounded arrow / Home / End changes',()=>{
  const options=source('45-write').split("open ? h('div', { className: 'atlas-write-divider',")[1].split(' }) : null')[0];
  let saved;const controls=setup(`return split=>({${options}});`,{saveSplit:v=>saved=v,startSplit:()=>{}});
  for(const [start,key,end] of [[64,'ArrowRight',65],[79,'End',80],[80,'ArrowRight',80],[64,'Home',30],[30,'ArrowLeft',30]]){
    const props=controls(start);assert.equal(props.tabIndex,0);assert.equal(props['aria-valuenow'],start);assert.equal(props['aria-valuemin'],30);assert.equal(props['aria-valuemax'],80);
    let blocked=false;props.onKeyDown({key,preventDefault(){blocked=true;},stopPropagation(){}});assert.equal(blocked,true);assert.equal(saved,end);
  }
});
for(const name of ['40-reader','45-write'])test(`${name}: native Tab/Shift+Tab survive; explicit indent preserves caret`,()=>{
  const fn=source(name).split('const onKeyDown = (e) => {')[1].split('\n  };')[0];const el={selectionStart:1,selectionEnd:1};let value='ab';const handle=setup(`return (e)=>{${fn}\n}`,{text:value,setText:x=>value=x,requestAnimationFrame:f=>f(),dirty:false});
  const call=(k,props)=>{let stopped=false;handle({key:k,target:el,preventDefault(){stopped=true;},...props});return stopped;};assert.equal(call('Tab',{}),false);assert.equal(call('Tab',{shiftKey:true}),false);assert.equal(value,'ab');assert.equal(call(']',{ctrlKey:true}),true);assert.equal(value,'a  b');assert.equal(el.selectionStart,3);
});
