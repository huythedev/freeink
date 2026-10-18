'use strict';
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(require('node:path').join(__dirname,'../app.js'),'utf8');
(async()=>{
  let release,fail=false,calls=0;const statuses=[];
  const state={notes:[{id:'a',pages:[{items:[]}]}],currentId:'a',revision:0,savedRevision:0,dirtyNotes:new Set(),saving:false,store:{async save(){calls++;await new Promise(resolve=>release=resolve);if(fail)throw Error('Quota')}}};
  const c={state,Runtime:require('../runtime'),showSaved:v=>statuses.push(v),toast(){},console:{error(){}},setTimeout:()=>1,clearTimeout(){},localStorage:{removeItem(){}},finishActiveText(){},finishGesture(){state.gesture=null}};
  vm.createContext(c);vm.runInContext(source.slice(source.indexOf('function armSave('),source.indexOf('function markChanged(')),c);
  c.queueSave('a');const saving=c.persist();await Promise.resolve();c.queueSave('a');release();await saving;
  assert.equal(state.savedRevision,1);assert.equal(state.revision,2);assert.equal(statuses.at(-1),'Saving…','older save must not hide newer unsaved changes');
  const second=c.flushSave();await Promise.resolve();release();await second;assert.equal(state.savedRevision,2);
  fail=true;c.queueSave('a');const bad=c.flushSave();await Promise.resolve();release();await assert.rejects(bad,/Quota/);
  assert(state.dirtyNotes.has('a'));assert.equal(state.savePromise,null);assert.equal(statuses.at(-1),'Save failed');
  fail=false;const retry=c.flushSave();await Promise.resolve();release();await retry;assert.equal(state.saveError,null);assert.equal(state.savedRevision,state.revision);
  delete state.store;c.queueSave('a');c.localStorage.setItem=()=>{throw Error('Storage unavailable')};
  await assert.rejects(c.flushSave(),/unavailable/);assert.equal(state.savePromise,null,'synchronous storage errors must not leave a stuck save promise');
  assert.equal(calls,4);
  console.log('Persistence: concurrent edits, failed close/update saves, retries and fallback failure pass.');
})().catch(error=>{console.error(error);process.exitCode=1});
