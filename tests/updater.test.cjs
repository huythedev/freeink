'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),{EventEmitter}=require('node:events');
(async()=>{
 let handler,checks=0,release,installs=0,prepared=0;
 const updater=new EventEmitter();updater.checkForUpdates=()=>{checks++;return new Promise(resolve=>release=resolve)};updater.quitAndInstall=()=>installs++;
 const win={webContents:{send(){}},isDestroyed:()=>false},app={isPackaged:true,getVersion:()=> '0.2.4'};
 const context={module:{exports:{}},require:name=>name==='electron'?{app,ipcMain:{handle(_channel,fn){handler=fn}}}:name==='electron-updater'?{autoUpdater:updater}: {},process:{platform:'win32',env:{}},setTimeout:()=>({unref(){}}),setImmediate,console};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../updater.js'),'utf8'),context);
 context.module.exports.setupUpdater(win,{beforeInstall:()=>prepared++});const event={sender:win.webContents};
 assert.equal((await handler(event,'status')).status,'idle');
 const first=handler(event,'check');await handler(event,'check');assert.equal(checks,1,'rapid clicks must not start concurrent update checks');release();await first;
 updater.emit('update-downloaded',{version:'0.2.5'});await handler(event,'install');await new Promise(resolve=>setImmediate(resolve));assert.equal(prepared,1);assert.equal(installs,1);
 assert.throws(()=>handler({sender:{}},'install'),/Untrusted/);
 // Actual renderer handler must flush successfully before requesting installation.
 const source=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
 let invokes=0;const button={dataset:{}},label={},c={$:id=>id==='update-btn'?button:label,t:s=>s,toast(){},console,window:{freeinkDesktop:{onUpdateStatus(){},updates:async action=>{if(action!=='status')invokes++;return {status:'downloaded'}}}},latestUpdateStatus:'downloaded',flushSave:async()=>{throw Error('Save failed')}};
 vm.createContext(c);vm.runInContext(source.slice(source.indexOf('function connectUpdater('),source.indexOf('\nfunction addEvents(')),c);c.connectUpdater();await button.onclick();assert.equal(invokes,0,'save failure must prevent update installation');
 console.log('Updater: status replay, duplicate checks, trusted sender, prepared exit and save-failure guard pass.');
})().catch(error=>{console.error(error);process.exitCode=1});
