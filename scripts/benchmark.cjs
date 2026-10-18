'use strict';
// Synthetic V8 heap/capture comparison; this is not a Windows process benchmark.
const {spawnSync}=require('node:child_process');
if(!process.argv[2]){
 for(const mode of ['deep-copy','shared-items']){
  const child=spawnSync(process.execPath,['--expose-gc',__filename,mode],{encoding:'utf8'});
  if(child.status!==0)throw Error(child.stderr);process.stdout.write(child.stdout);
 }
}else{
 const {snapshotPages}=require('../runtime');
 const pages=[{items:Array.from({length:300},(_,i)=>({kind:'stroke',points:Array.from({length:100},(_,j)=>({x:i+j/10,y:j,p:.5}))}))}];
 global.gc();const before=process.memoryUsage().heapUsed,start=performance.now(),history=[];
 for(let i=0;i<45;i++)history.push(process.argv[2]==='deep-copy'?JSON.parse(JSON.stringify(pages)):snapshotPages(pages));
 const ms=performance.now()-start;global.gc();const delta=process.memoryUsage().heapUsed-before;
 console.log(JSON.stringify({mode:process.argv[2],points:30000,history:history.length,ms:Math.round(ms),retainedMiB:Math.round(delta/1048576*100)/100,check:history.at(-1)[0].items.length}));
}
