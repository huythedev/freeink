// FreeInk Electron main process: one local editor, OS document opens and safe close.
'use strict';
const {app,BrowserWindow,ipcMain,shell,dialog}=require('electron');
const path=require('node:path');
const {makeServer}=require('./server');
const {setupUpdater}=require('./updater');
const {createDocumentQueue}=require('./desktop-files');
const PORT=17873; // Stable origin preserves existing IndexedDB notes across upgrades.
const ORIGIN=`http://127.0.0.1:${PORT}`;
let server=null,win=null,rendererReady=false,allowClose=false,closeRequest=0,closeTimer=null;
const documents=createDocumentQueue({notify:()=>{if(rendererReady&&!win?.isDestroyed())win.webContents.send('freeink:open-document')}});
const trusted=event=>win&&!win.isDestroyed()&&event.sender===win.webContents&&event.senderFrame?.url?.startsWith(ORIGIN+'/');
function focusWindow(){if(!win||win.isDestroyed())return;if(win.isMinimized())win.restore();win.show();win.focus()}
function clearCloseRequest(){clearTimeout(closeTimer);closeTimer=null;closeRequest=0}
function armCloseTimeout(requestId){
  closeTimer=setTimeout(async()=>{
    if(closeRequest!==requestId||win.isDestroyed())return;
    const result=await dialog.showMessageBox(win,{type:'warning',buttons:['Keep waiting','Close without saving'],defaultId:0,cancelId:0,title:'FreeInk is still saving',message:'The editor has not finished saving. Closing now may lose your latest changes.'});
    if(closeRequest!==requestId||win.isDestroyed())return;
    if(result.response===1){allowClose=true;clearCloseRequest();win.close()}else armCloseTimeout(requestId);
  },10000);closeTimer.unref?.();
}
if(!app.requestSingleInstanceLock())app.quit();
else{
  documents.enqueue(process.argv.slice(1));
  app.on('second-instance',(_event,argv,cwd)=>{documents.enqueue(argv,cwd);focusWindow()});
  app.on('open-file',(event,file)=>{event.preventDefault();documents.enqueue([file]);focusWindow()});
  ipcMain.handle('freeink:version',event=>{if(trusted(event))return {version:app.getVersion(),packaged:app.isPackaged}});
  ipcMain.handle('freeink:renderer-ready',event=>{if(trusted(event))rendererReady=true});
  ipcMain.handle('freeink:next-document',event=>trusted(event)?documents.next():null);
  ipcMain.on('freeink:close-result',async(event,result)=>{
    if(!trusted(event)||!closeRequest||result?.requestId!==closeRequest)return;
    clearCloseRequest();
    if(result.saved===true){allowClose=true;win.close()}
    else await dialog.showMessageBox(win,{type:'error',buttons:['Keep FreeInk open'],title:'Your changes could not be saved',message:'FreeInk will stay open. Export a .freeink backup before closing.',detail:String(result.error||'Local storage is unavailable').slice(0,1000)});
  });
  app.whenReady().then(async()=>{
    try{server=makeServer();await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(PORT,'127.0.0.1',resolve)})}
    catch(error){dialog.showErrorBox('FreeInk cannot start',`The local editor could not start on port ${PORT}.\n${error.message}`);app.quit();return}
    win=new BrowserWindow({width:1450,height:950,minWidth:760,minHeight:530,backgroundColor:'#f0f2f6',autoHideMenuBar:true,show:false,webPreferences:{preload:path.join(__dirname,'preload.js'),nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true}});
    win.once('ready-to-show',()=>win.show());
    win.webContents.on('did-start-loading',()=>{rendererReady=false});
    win.webContents.on('will-navigate',(event,url)=>{if(!url.startsWith(ORIGIN+'/'))event.preventDefault()});
    win.webContents.setWindowOpenHandler(({url})=>{if(url.startsWith('https://'))shell.openExternal(url);return {action:'deny'}});
    win.on('close',event=>{
      if(allowClose||!rendererReady)return;
      event.preventDefault();if(closeRequest)return;
      closeRequest=Date.now();win.webContents.send('freeink:prepare-close',closeRequest);armCloseTimeout(closeRequest);
    });
    win.on('closed',clearCloseRequest);
    setupUpdater(win,{beforeInstall:()=>{allowClose=true;clearCloseRequest()},trusted});
    await win.loadURL(ORIGIN+'/');
  }).catch(error=>{dialog.showErrorBox('FreeInk cannot start',error.message);app.quit()});
  app.on('window-all-closed',()=>app.quit());
  app.on('will-quit',()=>{clearCloseRequest();server?.close()});
}
