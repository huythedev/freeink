'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
(async()=>{
 const source=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8'),state={operation:null},nodes=new Map(),messages=[];
 for(const id of ['operation-label','operation-progress','operation-status','operation-cancel'])nodes.set(id,{hidden:true,removeAttribute(){},focus(){}});
 const topbar={},workspace={},active={isConnected:true,focus(){}};let worker,terminated=0,revoked=0,completed=0;
 class FileWorker{constructor(){worker=this}postMessage(){}terminate(){terminated++}}
 const context={state,Runtime:require('../runtime'),$:id=>id==='freeink-worker-source'?{textContent:'worker'}:nodes.get(id),t:s=>s,toast:v=>messages.push(v),finishActiveText(){},finishGesture(){},document:{activeElement:active,querySelector:selector=>selector==='.workspace'?workspace:topbar},AbortController,Blob,Worker:FileWorker,URL:{createObjectURL:()=> 'blob:worker',revokeObjectURL(){revoked++}},console};
 vm.createContext(context);vm.runInContext(source.slice(source.indexOf('function updateOperation('),source.indexOf('function downloadBlob(')),context);
 const cancel=context.runOperation('Work',async operation=>{await context.runFileWorker('pdf-export',{},operation);completed++});
 await new Promise(resolve=>setTimeout(resolve,5));assert(topbar.inert&&workspace.inert);assert.equal(await context.runOperation('Other',()=>{}),false);
 state.operation.cancel();assert.equal(await cancel,false);assert.equal(completed,0);assert.equal(terminated,1);assert.equal(revoked,1);assert.equal(state.operation,null);assert(!topbar.inert&&!workspace.inert);assert(messages.includes('Operation cancelled'));
 const success=context.runOperation('Next',async operation=>{assert.equal(await context.runFileWorker('note-import',{},operation),42);completed++});
 await new Promise(resolve=>setTimeout(resolve,5));worker.onmessage({data:{type:'result',result:42}});assert.equal(await success,true);assert.equal(completed,1);assert.equal(terminated,2);assert.equal(revoked,2);
 console.log('Operations: busy guard, actual worker bridge termination, cancellation, URL cleanup and editor recovery pass.');
})().catch(error=>{console.error(error);process.exitCode=1});
