'use strict';
const path=require('node:path');
const fs=require('node:fs/promises');
const MAX_BYTES=75*1024*1024;
// Only OS launch arguments enter this queue. The renderer cannot supply paths.
function createDocumentQueue({notify=()=>{},io=fs}={}){
  const pending=[];
  return {
    enqueue(args,cwd=process.cwd()){
      for(const arg of args){
        if(typeof arg!=='string'||arg.startsWith('-')||path.extname(arg).toLowerCase()!=='.freeink')continue;
        const file=path.resolve(cwd,arg);
        if(pending.length<32&&!pending.includes(file))pending.push(file);
      }
      if(pending.length)notify();
    },
    async next(){
      const file=pending.shift();if(!file)return null;
      let handle;
      try{
        handle=await io.open(file,'r');const stat=await handle.stat();
        if(!stat.isFile()||stat.size>MAX_BYTES)throw Error('FreeInk files must be smaller than 75 MB');
        const bytes=new Uint8Array(stat.size);let offset=0;
        while(offset<bytes.length){const result=await handle.read(bytes,offset,bytes.length-offset,offset);if(!result.bytesRead)throw Error('File changed while opening');offset+=result.bytesRead}
        return {name:path.basename(file),bytes};
      }catch(error){return {error:`Could not open ${path.basename(file)}: ${error.message}`}}
      finally{try{await handle?.close()}catch{}}
    },
    get length(){return pending.length}
  };
}
module.exports={createDocumentQueue,MAX_BYTES};
