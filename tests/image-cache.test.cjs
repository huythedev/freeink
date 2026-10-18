'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const Runtime=require('../runtime');
(async()=>{
 const header=Buffer.alloc(24);header.writeUInt32BE(0x89504e47);header.write('IHDR',12);header.writeUInt32BE(6000,16);header.writeUInt32BE(4000,20);
 const src='data:image/png;base64,'+header.toString('base64');assert.deepEqual(Runtime.embeddedImageSize(src),{w:6000,h:4000});
 const imageCache=new Runtime.LruCache({maxEntries:2,onEvict:entry=>entry.controller.abort()}),jobs=[];
 class Image{naturalWidth=2000;naturalHeight=1333;set src(value){if(value)queueMicrotask(()=>this.onload?.())}}
 const c={Runtime,imageCache,rasterQueue:Promise.resolve(),AbortController,Image,runFileWorker:(_kind,payload,operation)=>new Promise((resolve,reject)=>{jobs.push({payload,operation,resolve});operation.signal.addEventListener('abort',()=>reject(Runtime.abortError()),{once:true})})};
 const source=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');vm.createContext(c);vm.runInContext(source.slice(source.indexOf('function loadRaster('),source.indexOf('function imageFor(')),c);
 const first=c.loadRaster(src);first.catch(()=>{});assert.equal(c.loadRaster(src),first,'simultaneous loads share one decode');await Promise.resolve();assert.equal(jobs.length,1);
 const second=c.loadRaster(src+'AAAA');const third=c.loadRaster(src+'BBBB');await assert.rejects(first,{name:'AbortError'});
 await new Promise(resolve=>setImmediate(resolve));assert.equal(jobs.length,2,'oversized legacy images normalize serially');assert(jobs[0].operation.signal.aborted);
 jobs[1].resolve({src:'data:image/png;base64,small'});await second;await new Promise(resolve=>setImmediate(resolve));assert.equal(jobs.length,3);
 jobs[2].resolve({src:'data:image/png;base64,small'});await third;
 assert(imageCache.weight<=64*1024*1024);imageCache.clear();assert.equal(imageCache.weight,0);
 console.log('Images: oversized legacy notebooks normalize serially, share pending loads and cancel evicted work.');
})().catch(error=>{console.error(error);process.exitCode=1});
