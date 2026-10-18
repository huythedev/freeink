'use strict';
const assert=require('node:assert/strict'),http=require('node:http');
const {makeServer}=require('../server');
(async()=>{
 const server=makeServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
 try{
  for(const file of ['runtime.js','storage.js','file-worker.js','ink-engine.js','color-picker.js']){const res=await fetch(base+'/'+file);assert.equal(res.status,200);assert.match(res.headers.get('content-type'),/javascript/);assert((await res.text()).length>50)}
  const head=await fetch(base+'/app.js',{method:'HEAD'});assert.equal(head.status,200);assert.equal((await head.text()).length,0);
  assert.equal((await fetch(base+'/app.js',{method:'POST'})).status,405);
  assert.equal((await fetch(base+'/%E0%A4%A')).status,400);
  assert.equal((await fetch(base+'/electron.js')).status,404,'native process source must not be exposed');
  const traversal=await new Promise((resolve,reject)=>{http.get({hostname:'127.0.0.1',port:server.address().port,path:'/node_modules/pdfjs-dist/build/%2e%2e/%2e%2e/%2e%2e/electron.js'},res=>{res.resume();resolve(res.statusCode)}).on('error',reject)});assert.equal(traversal,404,'asset routes must not bypass the whitelist using encoded traversal');
  await new Promise(resolve=>{const req=http.get(base+'/app.js',res=>{res.destroy();resolve()});req.on('error',resolve)});
  assert.equal((await fetch(base+'/')).status,200,'client disconnects must not crash the local server');
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}
 console.log('Server: worker assets, HEAD, method/path limits and aborted streams pass.');
})().catch(error=>{console.error(error);process.exitCode=1});
