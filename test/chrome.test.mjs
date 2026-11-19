// Exercise the same source modules as the bundle, without building or touching a DSH profile.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
const modules = ['71-rail', '73-focus', '74-palette'].map(s => readFileSync(new URL(`../client/${s}.js`, import.meta.url), 'utf8')).join('\n');
const view = (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity).filter(Boolean) });
const base = { h: view, React: { Fragment: 'fragment', useId:()=>':menu:' }, Icon: 'icon', Popover: 'popover', Kbd: 'kbd', atlasFocusNode: n=>n?.focus(),
  cx: (...v) => v.filter(Boolean).join(' '), THEME_LABEL: { auto: 'Auto', day: 'Day', night: 'Night' }, THEME_ICON: { auto: 'contrast', day: 'sun', night: 'moon' },
  PANEL_KEY: 'aitp-atlas', externalStore: (value) => ({ get: () => value, set: next => { value = next; } }), useState: init => [typeof init === 'function' ? init() : init, () => {}],
  useRef: initial => ({ current: initial }), useEffect() {}, rowOf: (rows, id) => rows?.byId?.[id], knownThread: (rows, t) => !!rows?.byId[t.id], teamOf: r => r?.team, threadLabel: t => t.title, baseName: p => p.split('/').pop() };
const chrome = new Function(...Object.keys(base), `${modules}\nreturn { AtlasWorkspaceMenu, atlasMenuCount, atlasBindChromeService, atlasChromeServices, atlasSidebarExpanded, atlasEnterFocus, atlasLeaveFocus, atlasToggleFullscreen, atlasEffectiveKeys, atlasPaletteItems, atlasPaletteResults, atlasChromeKey, atlasFrameAcceptsKey, atlasChromeInputOwner };`)(...Object.values(base));
const nodes = tree => [tree, ...(tree.children || []).flatMap(nodes)];
// Re-render one plain client function with real event handlers. Refs and state
// persist across renders; a deterministic clock drives the hover boundaries.
function controlsRuntime() {
  let cursor = 0, clock = 0, handle = 0;
  const slots = [], effects = [], timers = new Map();
  const hooks = { ...base, useState(init) { const i = cursor++; if (!(i in slots)) slots[i] = typeof init === 'function' ? init() : init; return [slots[i], val => { slots[i] = typeof val === 'function' ? val(slots[i]) : val; }]; },
    useRef(initial) { const i = cursor++; return slots[i] ||= {current: initial}; }, useMemo: fn => fn(), useEffect: fn => effects.push(fn),
    setTimeout(fn, delay) { const id=++handle; timers.set(id,{ at:clock+delay, fn }); return id; }, clearTimeout: id => timers.delete(id),
    useAtlasDialogFocus() {}, Kbd:'kbd', React:{ ...base.React, useId:()=>':palette:' } };
  const {useAtlasHotEdge, AtlasCommandPalette} = new Function(...Object.keys(hooks),`${modules}\nreturn {useAtlasHotEdge,AtlasCommandPalette};`)(...Object.values(hooks));
  return { edge: () => { cursor=0; return useAtlasHotEdge(120,600); }, palette: props => {cursor=0; return AtlasCommandPalette(props);},
    advance(ms) {clock+=ms; for(const [id,t] of timers) if(t.at<=clock) {timers.delete(id); t.fn();} },
    mount() { return effects.shift()(); } };
}

test('Focus header hot edge: bridge pointer crossings, honor both delays, cancel on unmount', () => {
  const rt = controlsRuntime(), first = rt.edge(), cleanup = rt.mount();
  first.enter(); rt.advance(119); assert.equal(rt.edge().shown,false);
  first.leave(); rt.advance(600); assert.equal(rt.edge().shown,false,'crossing the edge does not open the header');
  first.enter(); rt.advance(120); assert.equal(rt.edge().shown,true);
  first.leave(); rt.advance(599); assert.equal(rt.edge().shown,true); first.show(); rt.advance(30); assert.equal(rt.edge().shown,true);
  first.leave(); rt.advance(600); assert.equal(rt.edge().shown,false); first.enter(); cleanup(); rt.advance(500); assert.equal(rt.edge().shown,false);
});

test('palette input: cycle the active option, Shift+Enter opens beside, narrowing resets selection; IME Enter is not a command', () => {
  const calls=[], rt=controlsRuntime(), items=['Alpha','Beta'].map(label=>({id:label,label,group:'Topics'}));
  const render=()=>rt.palette({items,recent:[],onClose(){},onRun:(item,beside)=>calls.push([item.id,beside])});
  const input=()=>nodes(render()).find(n=>n.type==='input').props;
  const hint=nodes(render()).find(n=>n.props?.id===input()['aria-describedby']);
  assert.deepEqual(hint.children.map(n=>n.children[0]), ['# topics','@ discussions & teams','> commands']);
  const press=(key,props={})=>input().onKeyDown({key, preventDefault(){},stopPropagation(){},...props});
  press('ArrowDown'); assert.equal(input()['aria-activedescendant'],':palette:-1'); press('Enter',{shiftKey:true});
  press('ArrowDown'); assert.equal(input()['aria-activedescendant'],':palette:-0'); press('ArrowUp');
  input().onChange({target:{value:'#alp'}}); assert.equal(input()['aria-activedescendant'],':palette:-0'); press('Enter',{isComposing:true}); press('Enter',{shiftKey:false});
  assert.deepEqual(calls,[['Beta',true],['Alpha',false]]);
});

test('workspace menu: one labeled trigger, no rail or hot edge, ignores both old rail prefs; keyboard opener selects first or last', () => {
  const calls=[], props={themeModes:['auto','day','night'],mode:'auto',shortcut:()=>'',onOpen:v=>calls.push(v)};
  for (const pref of [{railHidden:true},{railMode:'labels'}]) {
    const tree=chrome.AtlasWorkspaceMenu({...props,pref,open:false});
    assert.deepEqual(tree.children.map(n=>n.type),['button']); const t=tree.children[0];
    assert.equal(t.props['aria-label'],'Atlas destinations'); assert.equal(t.props['aria-expanded'],false);
    assert.ok(t.children.includes('Atlas')||nodes(t).includes('Atlas'));
    t.props.onKeyDown({key:'ArrowUp',preventDefault(){}}); t.props.onClick();
  }
  assert.deepEqual(calls,['last','first','last','first']);
  assert.deepEqual([0,-1,null,NaN,2,99,100].map(chrome.atlasMenuCount),['','','','','2','99','99+']);
});

test('workspace menu: explicit destinations and actions, accessible counts only from data, selection returns focus and preserves routing modifiers', () => {
  const calls = [], cb = id => (...a) => calls.push([id,...a]);
  const props = { open:'first', mode:'day', themeModes:['auto','day','night'], activePlace:'desk', unreadCount:101,
    shortcut:()=>'', onPalette:cb('cmd'), onQuick:cb('quick'), onRefresh:cb('refresh'), onShortcuts:cb('keys'),onAbout:cb('about'),
    openPlace:cb('place'), onTheme:cb('theme'), onClose:cb('closed') };
  const tree=chrome.AtlasWorkspaceMenu(props); const anchor=tree.children[0].props.ref;
  anchor.current={focus:()=>calls.push(['focus'])};
  const buttons=nodes(tree).filter(n=>n.props?.role==='menuitem');
  assert.deepEqual(buttons.map(b=>b.props['aria-label']),['Desk','Discussions','Teams','Map','Library','Learn','Write','Commands','Search','Add or write','Theme: Day','Read the files again','Keyboard shortcuts','About Atlas']);
  assert.equal(buttons[1].props['aria-description'],'101 unread replies');assert.ok(nodes(buttons[1]).includes('99+'));assert.equal(buttons[2].props['aria-description'],undefined);
  assert.equal(buttons[0].props['aria-current'],'page'); buttons[0].props.onClick({shiftKey:true});
  assert.deepEqual(calls.splice(0),[['focus'],['closed'],['place','desk',{focusComposer:true,otherPane:true,permanent:false}]]);
  buttons[3].props.onAuxClick({button:1,preventDefault(){}}); assert.equal(calls.pop()[2].permanent,true);
  buttons[10].props.onClick({}); assert.deepEqual(calls.pop(),['theme','night']);
  buttons[9].props.onClick({}); assert.deepEqual(calls.pop(),['quick','paper']);
});

test('focus: inspect a verified frame only, recognize collapsed rail and an open drawer', () => {
  function frame(width, attrs = [], drawerWidth = 0) { return { style: { gridTemplateColumns: width+'px minmax(0px, 1fr) minmax(0px, 0px)' },
    hasAttribute: key => attrs.includes(key), querySelector: q => q.includes('data-shell-bottom') ? {} : { nextElementSibling: { getBoundingClientRect: () => ({width:drawerWidth}) } } }; }
  const expanded = parentElement => chrome.atlasSidebarExpanded({ parentElement });
  assert.equal(expanded(frame(280)), true); assert.equal(expanded(frame(56)), false); assert.equal(expanded(frame(120)), false);
  assert.equal(expanded(frame(0, ['data-sidebar-drawer'], 280)), true); assert.equal(expanded(frame(0, ['data-sidebar-drawer','data-sidebar-collapsed'],280)), false);
  assert.equal(expanded({ ...frame(280), querySelector: () => null }), null, 'a lookalike nested grid is not the DSH sidebar');
});

test('focus: fold and restore only what Atlas owns; unload/replaced/missing layouts and manual re-expansion are safe', () => {
  let changes = 0;
  const layout = { toggleSidebar: () => changes++ };
  for (const expanded of [false, null]) assert.equal(chrome.atlasEnterFocus(layout, expanded), null);
  assert.equal(chrome.atlasEnterFocus(null, true), null);
  assert.equal(chrome.atlasEnterFocus({toggleSidebar() { throw Error('disposed'); }}, true), null);
  const owner = chrome.atlasEnterFocus(layout, true); assert.equal(owner, layout); assert.equal(changes, 1);
  chrome.atlasLeaveFocus(owner, {}, false); chrome.atlasLeaveFocus(owner, layout, null); chrome.atlasLeaveFocus(owner, layout, true);
  chrome.atlasLeaveFocus(null, layout, false); assert.equal(changes, 1);
  chrome.atlasLeaveFocus(owner, layout, false); assert.equal(changes, 2);
  const remove = chrome.atlasBindChromeService('layout', layout), next = {}; const dispose = chrome.atlasBindChromeService('layout', next);
  remove(); assert.equal(chrome.atlasChromeServices.get().layout, next); dispose(); assert.equal(chrome.atlasChromeServices.get().layout, undefined);
});

test('focus: request fullscreen on Atlas alone and surface browser denial', async () => {
  const log = [], flash = t => log.push(t);
  const root = { ownerDocument: { exitFullscreen: () => log.push('exit') }, requestFullscreen: () => log.push('enter') };
  await chrome.atlasToggleFullscreen(root, flash); root.ownerDocument.fullscreenElement = root; await chrome.atlasToggleFullscreen(root, flash);
  await chrome.atlasToggleFullscreen({ownerDocument:{},requestFullscreen: () => Promise.reject(Error('denied'))}, flash);
  assert.deepEqual(log, ['enter','exit','Full screen is not available here']);
});

const keys = chrome.atlasEffectiveKeys([], [], 'desktop');
test('shortcuts: effective customized chords and fixed actions reserve combinations; browser fallback, conflicts, all seven places', () => {
  const bindings = chrome.atlasEffectiveKeys([{ binding: { code:'KeyQ', secondCode:'KeyP', modifiers:['control','shift'] } }], [{bindings:[{code:'Backslash',modifiers:['control']},{code:'Backslash',modifiers:['control','shift']}]}], 'web');
  const combo = id => bindings.find(b => b.id === id).combo;
  assert.equal(combo('palette'),'Ctrl+.'); assert.equal(combo('destinations'),''); assert.equal(combo('close'),'Ctrl+Alt+W');
  for (const [id, key, code] of [['next','→','ArrowRight'], ['previous','←','ArrowLeft'], ['reopen','T','KeyT']]) {
    assert.equal(combo(id),'Ctrl+Alt+Shift+'+key);
    assert.equal(chrome.atlasChromeKey({ key, code, ctrlKey:true, altKey:true, shiftKey:true }, bindings, {canHandle:true}),id);
  }
  const places = bindings.filter(b => /^Alt\+\d$/.test(b.combo)); assert.deepEqual(places.map(b=>b.id), ['desk','discussions','teams','map','library','learn','write']);
});
test('missing runtime uses safe web chords; host collisions never fall back to browser tab actions', () => {
  for (const runtime of [undefined,null,'','web','unknown']) {
    const defaults=chrome.atlasEffectiveKeys([],[],runtime);
    assert.equal(defaults.find(b=>b.id==='close').combo,'Ctrl+Alt+W');
    assert.equal(chrome.atlasChromeKey({key:'w',code:'KeyW',ctrlKey:true},defaults,{canHandle:true}),'');
    const fixed=defaults.filter(b=>['next','previous','reopen','close'].includes(b.id)).map(b=>({bindings:[b.binding]}));
    const fallback=chrome.atlasEffectiveKeys([],fixed,runtime).find(b=>b.id==='close');
    assert.equal(fallback.combo,'Ctrl+Alt+Shift+W');
    assert.equal(chrome.atlasChromeKey({key:'W',code:'KeyW',ctrlKey:true,altKey:true,shiftKey:true},[fallback],{canHandle:true}),'close');
    assert.ok(chrome.atlasEffectiveKeys([{binding:fallback.binding}],fixed,runtime).filter(b=>['next','previous','reopen','close'].includes(b.id)).every(b=>b.combo===''&&!b.binding));
  }
});
test('shortcuts: Escape priority, fullscreen, conversation/editable fields, non-Atlas panels and composition', () => {
  const page = { canHandle:true, focused:true, overlay:false, editor:false, browserOwnsEsc:false };
  const press = (key, code, event = {}, flags = {}) => chrome.atlasChromeKey({key, code, ...event}, keys, {...page,...flags});
  for (const flags of [{focused:false},{editor:true},{overlay:true},{browserOwnsEsc:true},{canHandle:false}]) assert.equal(press('Escape','Escape',{},flags),'');
  assert.equal(press('Escape','Escape'),'focus'); assert.equal(press('F','KeyF',{ctrlKey:true,shiftKey:true},{editor:true}),'focus');
  for (const key of ['n','/']) assert.equal(press(key,key==='n'?'KeyN':'Slash',{},{editor:true}),'');
  assert.equal(press('F11','F11',{shiftKey:true},{focused:false}),''); assert.equal(press('F11','F11',{shiftKey:true}),'full');
  for (const e of [{defaultPrevented:true},{isComposing:true},{keyCode:229},{getModifierState:()=>true}]) assert.equal(press('n','KeyN',e),'');
  for (const key of ['B','K']) assert.equal(press(key,'Key'+key,{ctrlKey:true}),'');
  assert.equal(chrome.atlasChromeInputOwner({closest:q=>q.includes('.atlas-embedded')}),true);
  const doc = {body:{}}, root = { ownerDocument:doc, isConnected:true, getClientRects:()=>[{}], closest:()=>null, contains:t=>t==='here' };
  const layout = {panelInfo:{getSnapshot:()=>({activePanelId:'another'})}};
  assert.equal(chrome.atlasFrameAcceptsKey(root,'here',layout),false); assert.equal(chrome.atlasFrameAcceptsKey(root,'outside',null),false);
  assert.equal(chrome.atlasFrameAcceptsKey(root,doc.body,null),true); assert.equal(chrome.atlasFrameAcceptsKey({...root,getClientRects:()=>[]},'here',null),false);
});

test('palette: subsequence, word starts, case, recency, prefixes and bounded grouped results', () => {
  const r = (id,label,group,updated) => ({id,label,group,updated});
  const list = [r('a','Workbench','Topics'),r('b','Wave Boundary','Topics'),r('c','Wave Boundary','Topics'),r('d','Split','Commands'),r('e','Blue','Discussions'),r('f','Blue','Teams')];
  const ids = (...args)=>chrome.atlasPaletteResults(...args).map(x=>x.id);
  assert.deepEqual(ids(list,'#WB',['c']),['c','b','a']); assert.deepEqual(ids(list,'>st'),['d']);
  assert.deepEqual(ids(list,'@BL'),['e','f']); assert.deepEqual(ids(list,'nomatch'),[]);
  assert.deepEqual(ids([r('old','file','Recent files',1),r('new','file','Recent files',Date.now())],''),['new','old']);
  const many = ['Commands','Places','Topics','Discussions','Teams','Recent files'].flatMap(group => Array.from({length:12},(_,i)=>r(group+i,group+i,group)));
  const matches = chrome.atlasPaletteResults(many,''); assert.equal(matches.length,30); assert.ok(many.every(x=>matches.filter(y=>y.group===x.group).length<=6));
});

test('palette: real sources and callbacks, never deleted sessions; Shift+Enter intent reaches file/topic/thread, commands are explicit', () => {
  const calls = [], cb = id => (...args) => calls.push([id, ...args]);
  const p = { overview: {topics:{x:{id:'x',file:'/r/x',title:'X'}}}, recentFiles:[{path:'/r/note.md'}], themeModes:['auto','day','night'],
    openTopic:cb('topic'), openFile:cb('file'),openThread:cb('thread'),openPlace:cb('place'),onTheme:cb('theme'),onQuick:cb('quick') };
  const items = chrome.atlasPaletteItems(p, [{id:'lost'},{id:'real',title:'Test thread'}],{byId:{real:{}}},keys,{focused:false},()=>{},()=>{});
  assert.ok(!items.some(i=>i.id==='session:lost')); assert.ok(items.find(i=>i.id==='cmd:full').disabled); assert.ok(items.find(i=>i.id==='cmd:team').disabled);
  for (const id of ['topic:/r/x','file:/r/note.md','session:real','place:desk','cmd:theme:night','cmd:tex']) items.find(i=>i.id===id).run({otherPane:true});
  assert.deepEqual(calls,[['topic','/r/x',{otherPane:true}],['file','/r/note.md',{otherPane:true}],['thread','real',{otherPane:true}],['place','desk',{otherPane:true,focusComposer:true}],['theme','night'],['quick','tex']]);
  assert.ok(!items.some(i=>i.id==='cmd:moveDiscussion'), 'no filing action for a place or a member session');
  const active = chrome.atlasPaletteItems({...p,onMoveDiscussion:cb('open-existing-move')},[],{},keys,{focused:false},()=>{},()=>{});
  const [filing] = chrome.atlasPaletteResults(active,'>move discussion');
  assert.equal(filing.label,'Move discussion to a topic…'); filing.run({otherPane:true}); assert.deepEqual(calls.at(-1),['open-existing-move']);
  const sessions = [{id:'old',title:'Old entry'}, {id:'team',title:'Legacy team',kind:'team'}], rows={byId:{old:{},team:{},real:{}}};
  const registered = records => chrome.atlasPaletteItems({...p,discussionRecords:records},sessions,rows,keys,{focused:false},()=>{},()=>{}).filter(x=>x.id.startsWith('session:'));
  assert.deepEqual(registered([]).map(x=>x.id), ['session:team']);
  const native=chrome.atlasPaletteItems({...p,discussionRecords:[],teamRecords:[{id:'run-id',name:'Worm team',topic:{title:'Monte Carlo'}}],onAssemble:cb('assemble'),openTeam:cb('room')},sessions,rows,keys,{focused:false},()=>{},()=>{});
  assert.equal(native.filter(x=>x.group==='Teams').length,1,'a verified root registry supersedes raw legacy rows');
  native.find(i=>i.id==='cmd:team').run();native.find(i=>i.id==='team:run-id').run({otherPane:true});assert.deepEqual(calls.slice(-2),[['assemble'],['room','run-id',{otherPane:true}]]);
  assert.deepEqual(registered([{id:'real',title:'Renamed',topic:{title:'Filed topic'}}]).map(x=>[x.label,x.detail]),[['Legacy team','Team discussion'],['Renamed','Filed topic']]);
});
