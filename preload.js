'use strict';
// Narrow, enumerated desktop bridge. No filesystem or Node APIs exposed.
const {contextBridge,ipcRenderer}=require('electron');
function subscribe(channel,fn,convert=value=>value){
  if(typeof fn!=='function')return ()=>{};
  const listener=(_event,value)=>fn(convert(value));ipcRenderer.on(channel,listener);
  return ()=>ipcRenderer.removeListener(channel,listener);
}
contextBridge.exposeInMainWorld('freeinkDesktop',Object.freeze({
  version:()=>ipcRenderer.invoke('freeink:version'),
  updates:action=>['status','check','download','install'].includes(action)?ipcRenderer.invoke('freeink:update-action',action):Promise.reject(Error('Invalid update action')),
  onUpdateStatus:fn=>subscribe('freeink:update-status',fn,detail=>({status:detail?.status,message:detail?.message,version:detail?.version,newVersion:detail?.newVersion,percent:detail?.percent})),
  onOpenDocument:fn=>subscribe('freeink:open-document',fn,()=>undefined),
  nextDocument:()=>ipcRenderer.invoke('freeink:next-document'),
  ready:()=>ipcRenderer.invoke('freeink:renderer-ready'),
  onPrepareClose:fn=>subscribe('freeink:prepare-close',fn),
  closeResult:result=>{if(Number.isFinite(result?.requestId))ipcRenderer.send('freeink:close-result',{requestId:result.requestId,saved:result.saved===true,error:String(result.error||'').slice(0,1000)})}
}));
