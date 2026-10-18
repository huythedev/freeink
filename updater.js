'use strict';
/** Desktop-only GitHub Release updater.
 * Upgrades the signed/hashed NSIS installer as a whole (not individual JS files).
 * Keeps user notes untouched in the Electron profile / IndexedDB; no executable
 * source is downloaded and eval'ed at runtime.
 */
const {app,ipcMain} = require('electron');
function setupUpdater(window,{beforeInstall=()=>{},trusted=event=>event.sender===window.webContents}={}){
  let stage='idle', version='', updater=null,detail={status:'idle',version:app.getVersion()};
  const handle=fn=>ipcMain.handle('freeink:update-action',(event,action)=>{if(!trusted(event))throw Error('Untrusted update request');return action==='status'?detail:fn(event,action)});
  const send=(status,message,more={})=>{
    stage=status;detail={status,message,version:app.getVersion(),...more};
    if(!window.isDestroyed())window.webContents.send('freeink:update-status',detail);
  };
  // Native MSI packages are upgraded by Windows Installer, not electron-updater.
  // This value is stamped into each packaged app by scripts/build-windows.cjs.
  const installerType=require('./package.json').freeinkInstallerType;
  if(app.isPackaged && installerType==='msi'){
    const message='This MSI installation is updated through Windows Installer. Download the newer MSI from GitHub Releases.';
    send('msi',message);
    handle(async()=>({status:'msi',message}));
    return;
  }
  if(app.isPackaged && process.platform==='darwin' && !require('./package.json').freeinkMacSigned){
    const message='This unsigned Mac test build is not eligible for automatic updates. Install a signed, notarized DMG release from GitHub.';
    send('mac-unsigned',message);
    handle(async()=>({status:'mac-unsigned',message}));
    return;
  }
  if(!app.isPackaged || !!process.env.PORTABLE_EXECUTABLE_DIR){
    send('dev','Updates work in the installed release, not dev/portable/browser mode.');
    handle(async()=>({status:'dev',message:'Build and install an NSIS GitHub Release to enable updates.'}));
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
  handle(async(_evt,action)=>{
    if(!updater)return {status:'error',message:'No updater configured'};
    try{
      if(action==='check'){
        if(stage==='checking'||stage==='downloading')return {status:stage,message:'Update already in progress'};
        send('checking','Checking GitHub Releases…');await updater.checkForUpdates();return {status:stage};
      }
      if(action==='download'&&stage==='available'){
        send('downloading','Starting download…');await updater.downloadUpdate();return {status:stage};
      }
      if(action==='install'&&stage==='downloaded'){
        send('installing','Installing update and restarting…');
        // The renderer flushes IndexedDB BEFORE it invokes this handler.
        setImmediate(()=>{beforeInstall();updater.quitAndInstall(false,true)});return {status:'installing'};
      }
      return {status:stage,message:'Check for updates first'};
    }catch(err){send('error',`Update failed: ${err.message}`);return {status:'error',message:err.message}}
  });
  // Check quietly after app launch; never install without consent.
  setTimeout(()=>{if(!window.isDestroyed()&&stage==='idle'&&updater){send('checking','Checking GitHub Releases…');updater.checkForUpdates().catch(e=>send('error','Update check failed: '+e.message))}},20000).unref?.();
}
module.exports={setupUpdater};
