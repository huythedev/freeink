'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),{Worker}=require('node:worker_threads'),{createRequire}=require('node:module');
const root=path.resolve(__dirname,'..');
const bootstrap=`
const {parentPort}=require('node:worker_threads'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const root=${JSON.stringify(root)};
const {createCanvas,loadImage}=require(${JSON.stringify(require.resolve('@napi-rs/canvas'))});
const context=vm.createContext({TextEncoder,TextDecoder,Blob,Uint8Array,DataView,ArrayBuffer,console,btoa,atob,setTimeout,fetch});
context.OffscreenCanvas=class{constructor(w,h){const canvas=createCanvas(w,h);canvas.convertToBlob=async({type='image/png',quality=.92}={})=>new Blob([canvas.toBuffer(type,type==='image/jpeg'?Math.round(quality*100):undefined)],{type});return canvas}};
context.createImageBitmap=async(blob,options={})=>{const image=await loadImage(Buffer.from(await blob.arrayBuffer())),canvas=createCanvas(options.resizeWidth||image.width,options.resizeHeight||image.height);canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);canvas.close=()=>{canvas.width=canvas.height=1};return canvas};
context.self=context;context.postMessage=value=>parentPort.postMessage(value);
context.importScripts=(...files)=>{for(const file of files)vm.runInContext(fs.readFileSync(path.resolve(root,file),'utf8'),context,{filename:file})};
context.importScripts('./file-worker.js');
parentPort.on('message',data=>context.onmessage({data}));
`;
function run(kind,payload){return new Promise((resolve,reject)=>{
 const worker=new Worker(bootstrap,{eval:true});const progress=[];
 worker.on('message',async data=>{if(data.type==='progress'){progress.push(data);return}await worker.terminate();data.type==='result'?resolve({result:data.result,progress}):reject(Error(data.message))});worker.on('error',reject);worker.postMessage({kind,payload});
})}
(async()=>{
 const note={title:'Worker test',pages:[{template:'blank',items:[{kind:'stroke',tool:'pen',inkVersion:2,color:'#000000',width:5,points:[{x:5,y:10},{x:20,y:10}],erasures:[{width:2,points:[{x:10,y:10}]}]}]}]};
 const imported=(await run('note-import',{text:JSON.stringify({note})})).result;assert.equal(imported.title,note.title);assert.equal(imported.pages[0].items[0].erasures.length,1);
 const exported=(await run('note-export',{note,exported:'test'})).result;assert.equal(JSON.parse(await exported.text()).note.title,note.title);
 const pdf=await run('pdf-export',{note});assert.equal(pdf.progress.length,1);assert.match(Buffer.from(await pdf.result.arrayBuffer()).toString('latin1'),/\/SMask/);
 await assert.rejects(run('note-import',{text:'{bad json'}),/JSON|property|Unexpected/i);
 await assert.rejects(run('note-import',{text:JSON.stringify({pages:Array.from({length:201},()=>({items:[]}))})}),/200/);
 const Zip=createRequire(require.resolve('mammoth'))('jszip'),zip=new Zip();
 zip.file('[Content_Types].xml','<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
 zip.file('word/document.xml','<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Converted in worker</w:t></w:r></w:p></w:body></w:document>');
 const {createCanvas}=require('@napi-rs/canvas'),raster=createCanvas(2400,1800);raster.getContext('2d').fillRect(0,0,2400,1800);
 const png=new Blob([raster.toBuffer('image/png')],{type:'image/png'}),image=(await run('image-import',{file:png})).result;
 assert(image.w*image.h<=4003000&&image.w<2400,'images must be normalized to a bounded decoded size');
 const photoNote={pages:[{items:[{kind:'image',src:raster.toDataURL('image/png'),x:0,y:0,w:240,h:180}]}]};
 const normalized=(await run('note-import',{text:JSON.stringify(photoNote)})).result;
 assert.notEqual(normalized.pages[0].items[0].src,photoNote.pages[0].items[0].src,'legacy backups must receive the same image size limits');
 const withPhoto=await run('pdf-export',{note:normalized});assert.match(Buffer.from(await withPhoto.result.arrayBuffer()).toString('latin1'),/DCTDecode/);
 const header=Buffer.alloc(24);header.writeUInt32BE(0x89504e47);header.write('IHDR',12);header.writeUInt32BE(20000,16);header.writeUInt32BE(20000,20);
 await assert.rejects(run('image-import',{file:new Blob([header],{type:'image/png'})}),/100-megapixel/);
 const exif=Buffer.alloc(36);exif.writeUInt16BE(0xffe1,0);exif.writeUInt16BE(34,2);exif.write('Exif\0\0',4,'binary');exif.write('II',10);exif.writeUInt16LE(42,12);exif.writeUInt32LE(8,14);exif.writeUInt16LE(1,18);exif.writeUInt16LE(0x0112,20);exif.writeUInt16LE(3,22);exif.writeUInt32LE(1,24);exif.writeUInt16LE(6,28);
 const small=createCanvas(20,10).toBuffer('image/jpeg'),rotated=Buffer.concat([small.subarray(0,2),exif,small.subarray(2)]);
 const metadata=require('../runtime').imageSize(rotated);assert.equal(metadata.orientation,6);assert.deepEqual(require('../runtime').orientedImageSize(metadata),{w:10,h:20});
 const oriented=(await run('image-import',{file:new Blob([rotated],{type:'image/jpeg'})})).result;assert.equal(oriented.w,10);assert.equal(oriented.h,20,'EXIF-rotated photos must keep their portrait aspect ratio');
 const docx=await zip.generateAsync({type:'arraybuffer'});const html=(await run('docx-import',{buffer:docx})).result;assert.match(html.value,/Converted in worker/,'actual Mammoth browser bundle must support worker conversion');
 console.log('File workers: actual JSON import/export, partial masks, vector PDF/progress, input limits and Mammoth DOCX conversion pass.');
})().catch(error=>{console.error(error);process.exitCode=1});
