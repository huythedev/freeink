// FreeInk Electron main process: local-only editor, separately managed NSIS updater.
'use strict';
const {app,BrowserWindow,ipcMain,shell,dialog}=require('electron');
const path=require('node:path');
const {makeServer}=require('./server');
const {setupUpdater}=require('./updater');
let server=null;
const PORT=17873; // Stable origin preserves existing IndexedDB notes across app upgrades.
ipcMain.handle('freeink:version',()=>({version:app.getVersion(),packaged:app.isPackaged}));
app.whenReady().then(async()=>{
  try{server=makeServer();await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(PORT,'127.0.0.1',resolve)})}
  catch(e){dialog.showErrorBox('FreeInk cannot start',`Port ${PORT} is already in use. Close other copies of FreeInk.\n${e.message}`);app.quit();return}
  const win=new BrowserWindow({width:1450,height:950,minWidth:760,minHeight:530,backgroundColor:'#f0f2f6',autoHideMenuBar:true,show:false,webPreferences:{preload:path.join(__dirname,'preload.js'),nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true}});
  win.once('ready-to-show',()=>win.show());
  win.loadURL(`http://127.0.0.1:${PORT}`);
  win.webContents.setWindowOpenHandler(({url})=>{if(url.startsWith('https://'))shell.openExternal(url);return{action:'deny'}});
  setupUpdater(win);
});
app.on('window-all-closed',()=>app.quit());
app.on('before-quit',()=>{server?.close()});
