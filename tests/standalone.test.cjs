'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{execFileSync}=require('node:child_process');
execFileSync(process.execPath,[path.join(__dirname,'../scripts/build-standalone.cjs'),'--check']);
const html=fs.readFileSync(path.join(__dirname,'../FreeInk-Standalone.html'),'utf8');
assert(!/<script src=/.test(html));assert(!/<link rel="stylesheet"/.test(html));
let scripts=0;
for(const match of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)){new vm.Script(match[2],{filename:'standalone-inline-'+scripts++})}
assert.equal(scripts,9,'all eight editor modules and the standalone worker must be embedded');
// Windows git checkouts may use CRLF; generated content must stay identical.
const temp=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'freeink-crlf-'));
try{
 fs.mkdirSync(path.join(temp,'scripts'));
 for(const file of ['index.html','style.css','i18n.js','runtime.js','storage.js','ink-engine.js','vector-pdf.js','color-picker.js','image-tools.js','app.js','file-worker.js','FreeInk-Standalone.html'])fs.writeFileSync(path.join(temp,file),fs.readFileSync(path.join(__dirname,'..',file),'utf8').replace(/\r?\n/g,'\r\n'));
 fs.copyFileSync(path.join(__dirname,'../scripts/build-standalone.cjs'),path.join(temp,'scripts/build-standalone.cjs'));
 execFileSync(process.execPath,[path.join(temp,'scripts/build-standalone.cjs'),'--check']);
}finally{fs.rmSync(temp,{recursive:true,force:true})}
console.log('Standalone: regenerated HTML matches sources; all inline editor/worker scripts parse without external app assets.');
