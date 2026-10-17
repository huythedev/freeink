'use strict';
// Narrow, enumerated desktop bridge. No Node APIs exposed to note contents.
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('freeinkDesktop',Object.freeze({
  version:()=>ipcRenderer.invoke('freeink:version'),
  updates:(action)=>{
    if(!['check','download','install'].includes(action))return Promise.reject(Error('Invalid update action'));
    return ipcRenderer.invoke('freeink:update-action',action);
  },
  onUpdateStatus:(fn)=>{
    if(typeof fn!=='function')return;
    ipcRenderer.on('freeink:update-status',(_event,detail)=>{
      if(detail&&typeof detail.status==='string')fn({status:detail.status,message:detail.message,version:detail.version,newVersion:detail.newVersion,percent:detail.percent})
    });
  }
}));
