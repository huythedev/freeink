'use strict';
const assert=require('node:assert/strict');
const {createNotebookStore}=require('../storage');
(async()=>{
  let data=new Map([['library',{notes:[{id:'a',pages:[]},{id:'b',pages:[]}],currentId:'a'}]]),fail=false,writes=[];
  const adapter={async read(key){return structuredClone(data.get(key))},async write(entries,deletes){
    writes.push({entries,deletes});if(fail)throw Error('Quota exceeded');
    const next=new Map(data);for(const [key,value] of entries)next.set(key,structuredClone(value));for(const key of deletes)next.delete(key);data=next;
  }};
  const store=createNotebookStore(adapter),saved=await store.load();fail=true;
  await assert.rejects(store.save(saved,['a']),/Quota/);assert(data.has('library'));assert(!data.has('library-index'));
  fail=false;await store.save(saved,['a']);assert(!data.has('library'));assert(data.has('note:a')&&data.has('note:b'));
  saved.notes[0].title='Changed';await store.save(saved,['a']);
  assert.deepEqual(writes.at(-1).entries.map(([key])=>key),['note:a','library-index'],'only dirty notes should be cloned by IndexedDB');
  const removed={notes:[saved.notes[0]],currentId:'a'};await store.save(removed,[]);assert(!data.has('note:b'));
  const loaded=await createNotebookStore(adapter).load();assert.equal(loaded.notes[0].title,'Changed');
  data.delete('note:a');await assert.rejects(createNotebookStore(adapter).load(),/missing/,'failed loads must not replace the library');
  console.log('Storage: atomic migration, retry, dirty-note writes, deletion and missing-record protection pass.');
})().catch(error=>{console.error(error);process.exitCode=1});
