// Complement the opt-in real React browser run: explicitly drive injected-scope
// generation/disposal, including an old scope leaving after a replacement.
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
const code=n=>readFileSync(new URL(`../client/${n}.js`,import.meta.url),'utf8');
function context() {
  const requests=new Map(), slots=[];
  const ctx={slots:{inject:(_k,f)=>f(), register:(v,f)=>slots.push({v,f})},inject:(deps,fn)=>requests.set(deps.join('/'),fn)};
  const React={createContext:()=>({}),createElement:()=>{},Component:class{}};
  const actual=new Function('require','window','ctx',`
    const ATLAS_DESTINATIONS=[];\n${code('00-runtime')}\n${code('60-threads')}\n${code('62-models')}\n${code('74-palette')}
    let teamScope=null; function injectStyles() {} const AtlasIcon='icon';
    const plugin=(function(){ ${code('90-register')} })(); plugin.apply(ctx);
    return {plugin,atlasModelAccess,atlasSelectSessionModel,atlasFetchModelCatalog,atlasChromeServices,team:()=>teamScope};
  `)(()=>React,{localStorage:{getItem:()=>null}},ctx);
  function bind(key,props){let cleanup;const scope={...props,effect:fn=>{cleanup=fn();}};requests.get(key)(scope);return {scope,off:()=>cleanup?.()};}
  return {actual,bind,slots};
}
test('only slots are required: main stays registered while optional teams/layout/model services bind, replace and dispose',()=>{
  const {actual:a,bind,slots}=context();assert.deepEqual(a.plugin.inject,['slots']);assert.ok(slots.some(s=>s.v.name==='main'));const before=slots.length;
  assert.equal(a.team(),null);assert.equal(a.atlasModelAccess.get(),null);assert.equal(a.atlasChromeServices.get().layout,undefined);
  const old=bind('remote/remote.agentTeams',{remote:{agentTeams:{}}}); const next=bind('remote/remote.agentTeams',{remote:{agentTeams:{}}});old.off();assert.equal(a.team(),next.scope);next.off();assert.equal(a.team(),null);
  const layout={},l=bind('layout',{get:()=>layout});assert.equal(a.atlasChromeServices.get().layout,layout);l.off();assert.equal(a.atlasChromeServices.get().layout,undefined);
  const service={};const m=bind('remote/remote.session',{remote:{session:service}}),m2=bind('remote/remote.session',{remote:{session:service}});m.off();assert.equal(a.atlasModelAccess.get(),service);m2.off();assert.equal(a.atlasModelAccess.get(),null);
  assert.equal(slots.length,before);
});
test('catalog read, session model mutation and late service disposal have independent outcomes',async()=>{
  const {actual:a,bind}=context(), groups=[{id:'test',models:[{id:'m'}]}];let release,calls=0;
  const face={modelCatalog:async()=>({ok:true,value:{groups}})};
  assert.deepEqual(await a.atlasFetchModelCatalog(face),{groups});bind('remote/remote.session',{remote:{session:face}});await assert.rejects(a.atlasSelectSessionModel('s',{provider:'test',model:'m'}),/unavailable/);
  const m=bind('remote/remote.session',{remote:{session:{modelCatalog:()=>new Promise(r=>release=r),selectModel:()=>{calls++;}}}});
  const attempt=a.atlasSelectSessionModel('s',{provider:'test',model:'m'});m.off();release({ok:true,value:{groups}});await assert.rejects(attempt,/No model was changed/);assert.equal(calls,0);
  await assert.rejects(a.atlasFetchModelCatalog({}),/catalog is unavailable/);await assert.rejects(a.atlasFetchModelCatalog({modelCatalog:async()=>({ok:true,value:{}})}),/usable model catalog/);
});
