'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const tests=path.join(__dirname,'../tests');
for(const file of fs.readdirSync(tests).filter(file=>file.endsWith('.test.cjs')).sort()){
 console.log('Running '+file);
 const result=spawnSync(process.execPath,[path.join(tests,file)],{stdio:'inherit'});
 if(result.error)throw result.error;
 if(result.status!==0){console.error(`${file} exited with status ${result.status}, signal ${result.signal}`);process.exit(1)}
}
