'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const tests=path.join(__dirname,'../tests');
for(const file of fs.readdirSync(tests).filter(file=>file.endsWith('.test.cjs')).sort()){
 const result=spawnSync(process.execPath,[path.join(tests,file)],{stdio:'inherit'});
 if(result.error)throw result.error;
 if(result.status!==0)process.exit(result.status||1);
}
