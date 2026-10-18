'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),vm=require('node:vm'),{EventEmitter}=require('node:events');
const {createDocumentQueue,MAX_BYTES}=require('../desktop-files');
(async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'freeink-open-'));
 try{
  const name='ghi chú with spaces.FREEINK',file=path.join(dir,name);await fs.writeFile(file,'{"pages":[{"items":[]}]}');
  const queue=createDocumentQueue();queue.enqueue(['--ignored.freeink','photo.png',name,name],dir);assert.equal(queue.length,1);
  const opened=await queue.next();assert.equal(opened.name,name);assert.match(new TextDecoder().decode(opened.bytes),/pages/);assert.equal(await queue.next(),null);
  queue.enqueue(['missing.freeink'],dir);assert.match((await queue.next()).error,/Could not open/);
  const huge=createDocumentQueue({io:{open:async()=>({stat:async()=>({isFile:()=>true,size:MAX_BYTES+1}),close:async()=>{}})}});huge.enqueue(['huge.freeink']);assert.match((await huge.next()).error,/75 MB/);
  for(let i=0;i<40;i++)queue.enqueue([i+'.freeink']);assert.equal(queue.length,32,'OS open queue must be bounded');
  const source=await fs.readFile(path.join(__dirname,'../electron.js'),'utf8');
  async function boot(lock){
   const app=new EventEmitter();let quit=0,serverClosed=0,servers=0,window,updaterOptions;
   Object.assign(app,{isPackaged:true,requestSingleInstanceLock:()=>lock,quit:()=>quit++,getVersion:()=> '0.2.4',whenReady:()=>Promise.resolve()});
   const handlers=new Map(),ipcMain=new EventEmitter();ipcMain.handle=(channel,fn)=>handlers.set(channel,fn);
   const messages=[],dialogs=[];
   class Window extends EventEmitter{
    constructor(){super();window=this;this.webContents=new EventEmitter();Object.assign(this.webContents,{send:(...args)=>messages.push(args),setWindowOpenHandler(){}});this.closed=false;this.focused=0}
    isDestroyed(){return this.closed}isMinimized(){return false}restore(){}show(){}focus(){this.focused++}
    loadURL(url){this.url=url;return Promise.resolve()}
    close(){const event={preventDefault(){this.prevented=true}};this.emit('close',event);if(!event.prevented){this.closed=true;this.emit('closed')}}
   }
   const electron={app,BrowserWindow:Window,ipcMain,shell:{openExternal(){}},dialog:{showErrorBox(){},async showMessageBox(_win,options){dialogs.push(options);return {response:0}}}};
   const context={require:name=>name==='electron'?electron:name==='./server'?{makeServer(){servers++;const server=new EventEmitter();server.listen=(_port,_host,cb)=>cb();server.close=()=>serverClosed++;return server}}:name==='./desktop-files'?{createDocumentQueue}:name==='./updater'?{setupUpdater(_window,options){updaterOptions=options}}:require(name),__dirname:path.join(__dirname,'..'),process:{argv:['FreeInk.exe',file],cwd:()=>dir},setTimeout:()=>({unref(){}}),clearTimeout,Date,console};
   vm.runInNewContext(source,context);await new Promise(resolve=>setImmediate(resolve));
   return {app,handlers,ipcMain,messages,dialogs,get window(){return window},get servers(){return servers},get quit(){return quit},get serverClosed(){return serverClosed},get updaterOptions(){return updaterOptions}};
  }
  const secondary=await boot(false);assert.equal(secondary.quit,1);assert.equal(secondary.servers,0,'second instance must not start another server or renderer');
  const running=await boot(true),win=running.window,event={sender:win.webContents,senderFrame:{url:win.url}};
  assert.equal(await running.handlers.get('freeink:next-document')({sender:{}}),null);
  running.handlers.get('freeink:renderer-ready')(event);
  assert.equal((await running.handlers.get('freeink:next-document')(event)).name,name);
  running.app.emit('second-instance',{},['FreeInk.exe',file],dir);assert.equal(win.focused,1);assert(running.messages.some(([type])=>type==='freeink:open-document'));
  win.close();assert(!win.closed);const id=running.messages.at(-1)[1];
  running.ipcMain.emit('freeink:close-result',event,{requestId:id,saved:false,error:'Quota'});await new Promise(resolve=>setImmediate(resolve));assert(!win.closed);assert.equal(running.dialogs.length,1);
  running.app.emit('before-quit');assert.equal(running.serverClosed,0,'server must remain available while the editor saves');
  win.close();const next=running.messages.at(-1)[1];running.ipcMain.emit('freeink:close-result',event,{requestId:next,saved:true});assert(win.closed);
  running.app.emit('will-quit');assert.equal(running.serverClosed,1);
  const update=await boot(true);update.handlers.get('freeink:renderer-ready')({sender:update.window.webContents,senderFrame:{url:update.window.url}});update.updaterOptions.beforeInstall();update.window.close();assert(update.window.closed,'an update that already flushed saves must not deadlock on another close handshake');
  console.log('Desktop: single instance, OS file queue, spaces/Unicode, size limits, untrusted IPC, failed/successful close saves and update exit pass.');
 }finally{await fs.rm(dir,{recursive:true,force:true})}
})().catch(error=>{console.error(error);process.exitCode=1});
