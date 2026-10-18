/* Per-note, atomic persistence. Version 2 libraries remain readable and are
 * migrated only in the same successful transaction as all version 3 records. */
(function(root,factory){
  const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;root.FreeInkStorage=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function indexedDbAdapter(db){
    return {
      read(key){return new Promise((resolve,reject)=>{const request=db.transaction('app').objectStore('app').get(key);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)})},
      write(entries,deletes){return new Promise((resolve,reject)=>{
        const tx=db.transaction('app','readwrite'),store=tx.objectStore('app');
        tx.oncomplete=resolve;tx.onerror=tx.onabort=()=>reject(tx.error||Error('Save transaction aborted'));
        try{for(const [key,value] of entries)store.put(value,key);for(const key of deletes)store.delete(key)}catch(error){tx.abort();reject(error)}
      })}
    };
  }
  function createNotebookStore(adapter){
    let known=new Set(),migrating=false;
    return {
      async load(){
        const index=await adapter.read('library-index');
        if(index?.schemaVersion===3&&Array.isArray(index.noteIds)){
          const notes=[];
          // Sequential reads avoid cloning the entire library in one transaction.
          for(const id of index.noteIds){const note=await adapter.read('note:'+id);if(!note)throw Error('A saved notebook record is missing');notes.push(note)}
          known=new Set(index.noteIds);return {notes,currentId:index.currentId};
        }
        const legacy=await adapter.read('library');migrating=!!legacy;return legacy;
      },
      async save({notes,currentId},dirtyIds){
        const ids=notes.map(n=>n.id),next=new Set(ids),dirty=new Set(dirtyIds);
        const entries=notes.filter(n=>dirty.has(n.id)||!known.has(n.id)).map(n=>['note:'+n.id,n]);
        entries.push(['library-index',{schemaVersion:3,noteIds:ids,currentId}]);
        const deletes=[...known].filter(id=>!next.has(id)).map(id=>'note:'+id);
        if(migrating)deletes.push('library');
        await adapter.write(entries,deletes);known=next;migrating=false;
      }
    };
  }
  return {indexedDbAdapter,createNotebookStore};
});
