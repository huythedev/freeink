'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {getConfig}=require('app-builder-lib/out/util/config/config');
(async()=>{
 const root=path.resolve(__dirname,'..');
 async function run(file,{failure=false}={}){
  const calls=[],directories=new Map(),copies=[];let exit=0;
  const fakeFs={async rm(){},async mkdir(){},async access(){},async copyFile(from,to){copies.push(to)},async readdir(dir,options){return directories.get(dir)||[]}};
  const builder={Platform:{WINDOWS:{createTarget:items=>items},MAC:{createTarget:items=>items}},Arch:{universal:4},async build(options){
   calls.push(options);if(failure)throw Error('Compiler failed');const target=options.targets[0],out=options.config.directories.output;
   directories.set(out,target==='dmg'?['test.dmg','test.zip']:[{name:'test.'+(target==='msi'?'msi':'exe'),isFile:()=>true}]);
  }};
  const context={require:name=>name==='electron-builder'?builder:name==='node:fs/promises'?fakeFs:name==='../package.json'?require('../package.json'):require(name),__dirname:path.join(root,'scripts'),console:{log(){},error(){}},process:{env:{},platform:file.includes('macos')?'darwin':'win32',exit:code=>exit=code}};
  await vm.runInNewContext(fs.readFileSync(path.join(root,'scripts',file),'utf8'),context);
  return {calls,copies,exit};
 }
 const win=await run('build-windows.cjs');assert.equal(win.calls.length,2);assert.equal(win.copies.length,2);
 const mac=await run('build-macos.cjs');assert.equal(mac.calls.length,1);
 for(const call of [...win.calls,...mac.calls]){
  const config=await getConfig(root,null,structuredClone(call.config));
  assert.equal(config.fileAssociations.length,1,'API overrides must not duplicate the association already loaded from package.json');
  assert.equal(config.fileAssociations[0].ext,'freeink');
 }
 const failed=await run('build-windows.cjs',{failure:true});assert.equal(failed.exit,1,'failed compilation must exit unsuccessfully, rather than proceed without an MSI');
 console.log('Packaging: actual electron-builder configuration merge registers .freeink once per target; compiler failures stop the build.');
})().catch(error=>{console.error(error);process.exitCode=1});
