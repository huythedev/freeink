'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{execFileSync}=require('node:child_process');
execFileSync(process.execPath,[path.join(__dirname,'../scripts/build-standalone.cjs'),'--check']);
const html=fs.readFileSync(path.join(__dirname,'../FreeInk-Standalone.html'),'utf8');
assert(!/<script src=/.test(html));assert(!/<link rel="stylesheet"/.test(html));
let scripts=0;
for(const match of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)){new vm.Script(match[2],{filename:'standalone-inline-'+scripts++})}
assert.equal(scripts,7,'all six editor modules and the standalone worker must be embedded');
console.log('Standalone: regenerated HTML matches sources; all inline editor/worker scripts parse without external app assets.');
