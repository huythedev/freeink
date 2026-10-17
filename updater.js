'use strict';
/** Desktop-only GitHub Release updater.
 * Upgrades the signed/hashed NSIS installer as a whole (not individual JS files).
 * Keeps user notes untouched in the Electron profile / IndexedDB; no executable
 * source is downloaded and eval'ed at runtime.
 */
const {app,ipcMain} = require('electron');
function setupUpdater(window){
  let stage='idle', version='', updater=null;
  const send=(status,message,more={})=>{
    stage=status;
    if(!window.isDestroyed())window.webContents.send('freeink:update-status',{status,message,version:app.getVersion(),...more});
  };
  if(!app.isPackaged || !!process.env.PORTABLE_EXECUTABLE_DIR){
    send('dev','Updates work in the installed release, not dev/portable/browser mode.');
    ipcMain.handle('freeink:update-action',async()=>({status:'dev',message:'Build and install an NSIS GitHub Release to enable updates.'}));
    return;
  }
  try{
    ({autoUpdater:updater}=require('electron-updater'));
    updater.autoDownload=false;updater.autoInstallOnAppQuit=false;
    updater.on('checking-for-update',()=>send('checking','Checking GitHub Releases…'));
    updater.on('update-available', info=>{version=info.version;send('available',`FreeInk ${info.version} is available`,{newVersion:info.version})});
    updater.on('update-not-available',()=>send('current','You have the latest FreeInk version.'));
    updater.on('download-progress',p=>send('downloading',`Downloading FreeInk ${version}: ${Math.round(p.percent)}%`,{percent:Math.round(p.percent)}));
    updater.on('update-downloaded',info=>send('downloaded',`FreeInk ${info.version} is ready to install`,{newVersion:info.version}));
    updater.on('error',err=>{console.error('FreeInk update failed',err);send('error',`Update failed: ${err.message}`)});
  }catch(err){console.error('Updater setup failed',err);send('error','Updater unavailable: '+err.message)}
  ipcMain.handle('freeink:update-action',async(_evt,action)=>{
    if(!updater)return {status:'error',message:'No updater configured'};
    try{
      if(action==='check'){
        if(stage==='checking'||stage==='downloading')return {status:stage,message:'Update already in progress'};
        await updater.checkForUpdates();return {status:stage};
      }
      if(action==='download'&&stage==='available'){
        send('downloading','Starting download…');await updater.downloadUpdate();return {status:stage};
      }
      if(action==='install'&&stage==='downloaded'){
        send('installing','Installing update and restarting…');
        // The renderer flushes IndexedDB BEFORE it invokes this handler.
        setImmediate(()=>updater.quitAndInstall(false,true));return {status:'installing'};
      }
      return {status:stage,message:'Check for updates first'};
    }catch(err){send('error',`Update failed: ${err.message}`);return {status:'error',message:err.message}}
  });
  // Check quietly after app launch; never install without consent.
  setTimeout(()=>{if(!window.isDestroyed()&&stage==='idle')updater?.checkForUpdates().catch(e=>send('error','Update check failed: '+e.message))},20000).unref?.();
}
module.exports={setupUpdater};
