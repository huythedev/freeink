// FreeInk editor — source repository: https://github.com/huythedev/freeink
/* FreeInk — offline, editable ink notes. MIT License. No tracking or cloud dependency. */
(() => {
'use strict';
const PAGE_W = 816, PAGE_H = 1056, DB_NAME = 'freeink-notebooks', DB_VERSION = 1;
const $ = (id) => document.getElementById(id);
const I = window.FreeInkI18n;
const Ink = window.FreeInkInk;
if(!Ink)throw Error('FreeInk ink engine failed to load');
const t = (message,vars) => I ? I.t(message,vars) : message;
const uid = () => (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`);
const deep = (x) => JSON.parse(JSON.stringify(x));
const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
const esc = (s) => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const palette = ['#262e3a','#db464c','#f0a829','#49b976','#397cda','#9359cb','#ec78ad','#ffffff'];
const templateLabels = {ruled:'Ruled paper',blank:'Blank paper',graph:'Graph paper',dots:'Dot grid',dark:'Blackboard',music:'Music staff'};
const pageEl = $('pages'), area = $('document-area');
function inkDelayPreference(){try{return localStorage.getItem('freeink-ink-stabilization')==='off'?0:Ink.STABILIZATION_MS}catch{return Ink.STABILIZATION_MS}}
let state = {notes:[],currentId:null,tool:'pen',color:'#262e3a',width:3,shape:'line',zoom:1,sidebar:false,ruler:false,selection:[],gesture:null,db:null,history:[],future:[],saveTimer:null,popup:null,toastTimer:null,saving:false,inkDelay:inkDelayPreference()};
const imageCache = new Map();
const current = () => state.notes.find(n=>n.id===state.currentId);
const curPage = (idx) => current()?.pages[idx];
const newPage = (template='ruled') => ({id:uid(),template,items:[]});
const newNote = (title='Untitled note',template='ruled') => ({id:uid(),title,created:Date.now(),modified:Date.now(),pages:[newPage(template)]});
function initialNote(){
  const n=newNote('Welcome to FreeInk','ruled');
  n.pages[0].items = [
    {id:uid(),kind:'text',text:'Your ideas, in your own handwriting.',x:107,y:104,w:620,size:28,color:'#233751'},
    {id:uid(),kind:'text',text:'A little space for big ideas ✦',x:108,y:165,w:520,size:18,color:'#6480a2'},
    {id:uid(),kind:'stroke',tool:'pen',color:'#377ad7',width:3,points:[{x:108,y:219,p:.5},{x:171,y:223,p:.5},{x:243,y:220,p:.7},{x:324,y:225,p:.5},{x:408,y:220,p:.5}]},
    {id:uid(),kind:'text',text:'Start writing anywhere with your mouse, touch, or stylus.\nUse the toolbar to switch pens, choose colors and insert shapes.',x:108,y:275,w:620,size:18,color:'#60738b'},
    {id:uid(),kind:'text',text:'Everything saves on your device — no account, no subscription.',x:108,y:416,w:620,size:17,color:'#5385ad'}
  ];
  return n;
}
function toast(message){const element=$('toast');element.textContent=t(message);element.classList.add('visible');clearTimeout(state.toastTimer);state.toastTimer=setTimeout(()=>element.classList.remove('visible'),2700)}
function formatDate(ts){const d=new Date(ts);return d.toLocaleDateString(I?.getLanguage()==='vi'?'vi-VN':'en-US',{month:'short',day:'numeric'})}
function documentName(){return (current()?.title||'FreeInk Note').replace(/[\\/:*?"<>|]/g,'_').trim().slice(0,90)||'FreeInk Note'}
function showSaved(msg='Saved'){const el=$('saved-indicator');el.innerHTML=`<span class="saved-dot"></span> ${esc(t(msg))}`}

async function openDB(){return new Promise((resolve,reject)=>{if(!('indexedDB' in window)){reject(Error('IndexedDB missing'));return}const req=indexedDB.open(DB_NAME,DB_VERSION);req.onupgradeneeded=()=>req.result.createObjectStore('app');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
async function getSaved(){try{state.db=await openDB();return await new Promise((resolve,reject)=>{const req=state.db.transaction('app').objectStore('app').get('library');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}catch(e){try{return JSON.parse(localStorage.getItem('freeink-backup'))}catch{return null}}}
function migrateLibrary(data){
 const result={...data,notes:[]};
 for(const note of data.notes||[]){if(!note||!Array.isArray(note.pages))continue;result.notes.push({...note,pages:note.pages.map(p=>({...p,template:p.template||'ruled',items:Array.isArray(p.items)?p.items:[]}))})}
 return result;
}
function queueSave(){showSaved('Saving…');state.saving=true;clearTimeout(state.saveTimer);state.saveTimer=setTimeout(persist,650)}
async function persist(){const data={schemaVersion:2,notes:state.notes,currentId:state.currentId};try{if(state.db){await new Promise((resolve,reject)=>{const tx=state.db.transaction('app','readwrite');tx.objectStore('app').put(data,'library');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)})}else{localStorage.setItem('freeink-backup',JSON.stringify(data))}showSaved();state.saving=false}catch(e){showSaved('Storage full');toast('Could not save locally. Export your note to keep a copy.');console.error(e)}}
function flushSave(){clearTimeout(state.saveTimer);return persist()}
function markChanged(){const n=current();if(n)n.modified=Date.now();queueSave()}
// Snapshots deliberately share immutable image data URL strings instead of serializing
// them repeatedly. This keeps undo usable even after a many-page PDF import.
function clonePages(pages){return pages.map(p=>({...p,items:p.items.map(item=>item.kind==='stroke'?{...item,points:item.points.map(pt=>({...pt}))}:{...item})}))}
function capture(){const n=current();return {pages:clonePages(n.pages),title:n.title}}
function saveHistory(){const n=current();if(!n)return;state.history.push(capture());if(state.history.length>45)state.history.shift();state.future=[];setUndoButtons()}
function undo(){if(!state.history.length)return;const n=current();state.future.push(capture());const data=state.history.pop();n.pages=data.pages;n.title=data.title;state.selection=[];refreshDocument();markChanged();setUndoButtons()}
function redo(){if(!state.future.length)return;const n=current();state.history.push(capture());const data=state.future.pop();n.pages=data.pages;n.title=data.title;state.selection=[];refreshDocument();markChanged();setUndoButtons()}
function setUndoButtons(){$('undo').disabled=!state.history.length;$('redo').disabled=!state.future.length}
function updateHeader(){const n=current();if(!n)return;$('note-title').value=n.title;document.title=n.title+' · FreeInk';$('page-status').textContent=t('Page {current} of {total}',{current:Math.max(1,visiblePage()+1),total:n.pages.length});$('template-status').textContent=t(templateLabels[n.pages[Math.max(0,visiblePage())]?.template]||'Paper');$('notes-count').textContent=state.notes.length}
function renderGallery(){const list=$('note-list');const q=$('note-search').value.toLowerCase().trim();let notes=[...state.notes].sort((a,b)=>b.modified-a.modified).filter(n=>n.title.toLowerCase().includes(q));list.innerHTML=notes.map(n=>{const paper=n.pages[0]?.template||'ruled';const ink=n.pages.some(p=>p.items.some(i=>i.kind==='stroke'));return `<div class="note-item ${n.id===state.currentId?'selected':''}" data-note="${esc(n.id)}" role="button" tabindex="0" aria-label="Open ${esc(n.title)}"><div class="note-thumb ${esc(paper)}">${ink?'<div class="note-squiggle"></div>':''}</div><div class="note-meta"><strong>${esc(n.title)}</strong><small>${formatDate(n.modified)} · ${t(n.pages.length===1?'{count} page':'{count} pages',{count:n.pages.length})}</small></div><button data-note-menu="${esc(n.id)}" class="icon-button note-action" title="${t('Note actions')}"><svg><use href="#i-dots"/></svg></button></div>`}).join('')||`<div class="empty-notes">${t('No matching notes')}</div>`;
  list.querySelectorAll('[data-note]').forEach(el=>{el.addEventListener('click',e=>{if(e.target.closest('[data-note-menu]'))return;switchNote(el.dataset.note)});el.addEventListener('keydown',e=>{if(e.key==='Enter')switchNote(el.dataset.note)})});list.querySelectorAll('[data-note-menu]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();noteMenu(b.dataset.noteMenu,b)}))}
function toggleSidebar(force){state.sidebar=typeof force==='boolean'?force:!state.sidebar;$('sidebar').classList.toggle('is-hidden',!state.sidebar);$('sidebar-backdrop').classList.toggle('show',state.sidebar)}
function switchNote(id){if(!state.notes.some(n=>n.id===id))return;state.currentId=id;state.history=[];state.future=[];state.selection=[];state.gesture=null;setUndoButtons();refreshDocument();area.scrollTop=0;renderGallery();queueSave();if(innerWidth<760)toggleSidebar(false)}
function createNote(title,template){const n=newNote(title,template);state.notes.unshift(n);switchNote(n.id);toast('New note created');return n}
function showNewNoteModal(){let chosen='ruled';modal({title:'Create a new note',desc:'Choose a starting paper style. You can change it later.',content:`<input type="text" id="new-note-title" maxlength="90" value="Untitled note" aria-label="New note title"><div style="height:16px"></div><div class="modal-templates" id="new-note-templates">${['ruled','blank','graph','dots','dark','music'].map(t=>`<button class="modal-template ${t==='ruled'?'selected':''}" data-template="${t}"><div class="paper-preview ${t}"></div>${esc(I ? I.t(templateLabels[t]) : templateLabels[t])}</button>`).join('')}</div>`,action:'Create note',onReady:(m)=>{m.querySelectorAll('[data-template]').forEach(b=>b.onclick=()=>{chosen=b.dataset.template;m.querySelectorAll('[data-template]').forEach(x=>x.classList.toggle('selected',x===b))});m.querySelector('input').select()},onConfirm:(m)=>{createNote(m.querySelector('input').value.trim()||'Untitled note',chosen)}})}
function noteMenu(id,anchor){const n=state.notes.find(x=>x.id===id);if(!n)return;showPopup(anchor,[{label:'Open note',icon:'book',fn:()=>switchNote(id)},{label:'Duplicate',icon:'copy',fn:()=>{const clone=deep(n);clone.id=uid();clone.title+=' (copy)';clone.created=Date.now();clone.modified=Date.now();state.notes.unshift(clone);switchNote(clone.id);toast('Note duplicated')}},{label:'Rename',icon:'text',fn:()=>modal({title:'Rename note',desc:'Give your note a new name.',content:`<input id="rename-input" type="text" maxlength="90" value="${esc(n.title)}">`,action:'Rename',onReady:m=>m.querySelector('input').select(),onConfirm:m=>{n.title=m.querySelector('input').value.trim()||'Untitled note';n.modified=Date.now();renderGallery();updateHeader();queueSave()}})},{label:'Delete note',icon:'trash',fn:()=>modal({title:'Delete this note?',desc:`“${n.title}” and all its pages will be removed from this device. This cannot be undone.`,action:'Delete note',danger:true,onConfirm:()=>{state.notes=state.notes.filter(x=>x.id!==id);if(!state.notes.length)state.notes.push(newNote());switchNote(state.notes[0].id);toast('Note deleted')}})}])}
function visiblePage(){const pages=[...pageEl.querySelectorAll('.page-shell')];if(!pages.length)return 0;const middle=area.getBoundingClientRect().top+area.clientHeight*.42;let i=0,d=Infinity;pages.forEach((el,j)=>{const r=el.getBoundingClientRect();const dist=Math.abs((r.top+r.bottom)/2-middle);if(dist<d){i=j;d=dist}});return i}
function addPage(manual=true){const n=current();if(!n)return;const prev=n.pages[n.pages.length-1];if(manual)saveHistory();n.pages.push(newPage(prev?.template||'ruled'));refreshDocument();markChanged();if(manual){const last=pageEl.lastElementChild;last?.scrollIntoView({block:'start',behavior:'smooth'});toast('Page added')}}
function refreshDocument(){const n=current();if(!n)return;pageEl.innerHTML='';n.pages.forEach((p,index)=>{const shell=document.createElement('div');shell.className='page-shell';shell.dataset.page=index;shell.style.width=`${PAGE_W*state.zoom}px`;shell.style.height=`${PAGE_H*state.zoom}px`;shell.innerHTML=`<div class="sheet ${state.ruler?'show-ruler':''}" data-template="${p.template}" data-tool="${state.tool}" style="width:${PAGE_W}px;height:${PAGE_H}px;transform:scale(${state.zoom})"><canvas width="${PAGE_W}" height="${PAGE_H}" aria-label="Page ${index+1} ink canvas"></canvas><div class="ruler-overlay"></div></div><span class="page-tag">${index+1} / ${n.pages.length}</span>`;pageEl.appendChild(shell);const canvas=shell.querySelector('canvas');bindDrawing(canvas,index);drawPage(index)});updateHeader();updateToolButtons()}
function setZoom(z){state.zoom=clamp(Math.round(z*100)/100,.4,1.8);$('zoom-display').textContent=`${Math.round(state.zoom*100)}%`;refreshDocument()}
function fitZoom(){const width=area.clientWidth-60;setZoom(Math.min(1.25,Math.max(.4,width/PAGE_W)))}
function updateToolButtons(){document.querySelectorAll('[data-tool]').forEach(b=>{b.classList.toggle('active',b.dataset.tool===state.tool);b.setAttribute('aria-pressed',String(b.dataset.tool===state.tool))});document.querySelectorAll('.sheet').forEach(s=>s.dataset.tool=state.tool);$('ruler-toggle').classList.toggle('active',state.ruler);$('ruler-toggle').setAttribute('aria-pressed',String(state.ruler))}
function setTool(tool){state.tool=tool;state.gesture=null;state.selection=[];updateToolButtons();for(let i=0;i<current().pages.length;i++)drawPage(i)}
function updatePalette(){const el=$('color-palette');el.innerHTML=palette.map(color=>`<button class="color-swatch ${state.color===color?'selected':''}" style="--swatch:${color};${color==='#ffffff'?'border:1px solid #cad1db;':''}" data-color="${color}" title="${color}" aria-label="Color ${color}"></button>`).join('');el.querySelectorAll('[data-color]').forEach(b=>b.onclick=()=>{state.color=b.dataset.color;$('custom-color').value=state.color;updatePalette();if(['eraser','lasso','hand'].includes(state.tool))setTool('pen')})}
function setWidth(w){state.width=+w;$('stroke-width').value=w;$('width-value').textContent=w;$('width-preview').style.width=`${Math.min(17,Math.max(4,4+w/2))}px`;$('width-preview').style.height=$('width-preview').style.width}

// Canvas rendering uses persisted vector strokes. Paper template is a separate CSS layer.
function getContext(canvas){const dpr=Math.min(devicePixelRatio||1,2);if(canvas.width!==Math.round(PAGE_W*dpr)||canvas.height!==Math.round(PAGE_H*dpr)){canvas.width=Math.round(PAGE_W*dpr);canvas.height=Math.round(PAGE_H*dpr)}const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);return ctx}
function smoothStroke(ctx,pts,stroke){if(!pts?.length)return;if(stroke.inkVersion===2){Ink.drawCanvas(ctx,pts,stroke);return}ctx.save();ctx.lineCap='round';ctx.lineJoin='round';const base=stroke.tool==='highlighter'?stroke.width*5:stroke.width;ctx.globalAlpha=stroke.tool==='highlighter'?.28:stroke.tool==='pencil'?.72:1;ctx.strokeStyle=stroke.color;ctx.fillStyle=stroke.color;ctx.lineWidth=base*(.75+(.5*(pts[0].p??.5)));if(pts.length===1){ctx.beginPath();ctx.arc(pts[0].x,pts[0].y,ctx.lineWidth/2,0,Math.PI*2);ctx.fill();ctx.restore();return}ctx.beginPath();ctx.moveTo(pts[0].x,pts[0].y);for(let j=1;j<pts.length-1;j++){const pt=pts[j],n=pts[j+1];ctx.quadraticCurveTo(pt.x,pt.y,(pt.x+n.x)/2,(pt.y+n.y)/2)}const end=pts[pts.length-1];ctx.lineTo(end.x,end.y);ctx.stroke();ctx.restore()}
function drawShape(ctx,e){const x=e.x,y=e.y,x2=e.x2,y2=e.y2,w=x2-x,h=y2-y;ctx.save();ctx.lineWidth=e.width;ctx.strokeStyle=e.color;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();switch(e.shape){case'rect':ctx.rect(x,y,w,h);break;case'ellipse':ctx.ellipse(x+w/2,y+h/2,Math.max(1,Math.abs(w/2)),Math.max(1,Math.abs(h/2)),0,0,Math.PI*2);break;case'triangle':ctx.moveTo(x+w/2,y);ctx.lineTo(x2,y2);ctx.lineTo(x,y2);ctx.closePath();break;case'arrow':ctx.moveTo(x,y);ctx.lineTo(x2,y2);const a=Math.atan2(h,w),r=Math.max(12,e.width*5);ctx.moveTo(x2-r*Math.cos(a-.45),y2-r*Math.sin(a-.45));ctx.lineTo(x2,y2);ctx.lineTo(x2-r*Math.cos(a+.45),y2-r*Math.sin(a+.45));break;default:ctx.moveTo(x,y);ctx.lineTo(x2,y2)}ctx.stroke();ctx.restore()}
function wrapText(ctx,text,maxWidth){const output=[];String(text).split('\n').forEach(raw=>{const parts=raw.split(/\s+/);let line='';for(const part of parts){const candidate=line?line+' '+part:part;if(ctx.measureText(candidate).width>maxWidth&&line){output.push(line);line=part}else line=candidate}output.push(line)});return output}
function drawText(ctx,e){ctx.save();ctx.fillStyle=e.color||'#24364c';ctx.font=`${e.weight||400} ${e.size||22}px "Segoe UI",Arial,sans-serif`;ctx.textBaseline='top';const lines=wrapText(ctx,e.text,e.w||500);lines.forEach((line,i)=>ctx.fillText(line,e.x,e.y+i*(e.size||22)*1.44));ctx.restore()}
function imageFor(src,index){if(!src)return null;if(!imageCache.has(src)){const img=new Image();imageCache.set(src,img);img.onload=()=>{if(index===undefined)refreshDocument();else drawPage(index)};img.src=src}const img=imageCache.get(src);return img.complete&&img.naturalWidth?img:null}
function drawItem(ctx,item,index){switch(item.kind){case'stroke':smoothStroke(ctx,item.points,item);break;case'shape':drawShape(ctx,item);break;case'text':drawText(ctx,item);break;case'image':{const img=imageFor(item.src,index);if(img)ctx.drawImage(img,item.x,item.y,item.w,item.h);break}}}
function getBounds(item){if(item.kind==='stroke'){const p=item.points;const xs=p.map(v=>v.x),ys=p.map(v=>v.y);const pad=(item.width||3)*(item.tool==='highlighter'?2.5:1)+5;return {x:Math.min(...xs)-pad,y:Math.min(...ys)-pad,w:Math.max(...xs)-Math.min(...xs)+pad*2,h:Math.max(...ys)-Math.min(...ys)+pad*2}}if(item.kind==='shape')return {x:Math.min(item.x,item.x2)-8,y:Math.min(item.y,item.y2)-8,w:Math.abs(item.x2-item.x)+16,h:Math.abs(item.y2-item.y)+16};if(item.kind==='image')return {x:item.x,y:item.y,w:item.w,h:item.h};return {x:item.x,y:item.y,w:item.w||350,h:(item.text?.split('\n').length||1)*(item.size||22)*1.5}}
function drawSelection(ctx,page){if(!state.selection.length)return;ctx.save();ctx.strokeStyle='#3485ed';ctx.fillStyle='#3485ed';ctx.lineWidth=1.5;ctx.setLineDash([5,4]);page.items.filter(i=>state.selection.includes(i.id)).forEach(item=>{const b=getBounds(item);ctx.strokeRect(b.x-4,b.y-4,b.w+8,b.h+8);ctx.setLineDash([]);for(const [x,y] of [[b.x-4,b.y-4],[b.x+b.w+4,b.y-4],[b.x+b.w+4,b.y+b.h+4],[b.x-4,b.y+b.h+4]])ctx.fillRect(x-3,y-3,6,6);ctx.setLineDash([5,4])});ctx.restore()}
function drawPage(index){const p=curPage(index);const c=pageEl.querySelectorAll('canvas')[index];if(!p||!c)return;const ctx=getContext(c);ctx.clearRect(0,0,PAGE_W,PAGE_H);for(const item of p.items)drawItem(ctx,item,index);if(state.gesture?.index===index){const g=state.gesture;if(g.mode==='draw')smoothStroke(ctx,g.visible||[],g.stroke);else if(g.mode==='shape')drawShape(ctx,{kind:'shape',shape:state.shape,x:g.start.x,y:g.start.y,x2:g.end.x,y2:g.end.y,color:state.color,width:state.width});else if(g.mode==='lasso'){ctx.save();ctx.beginPath();ctx.moveTo(g.points[0].x,g.points[0].y);for(const v of g.points.slice(1))ctx.lineTo(v.x,v.y);ctx.strokeStyle='#3279d9';ctx.setLineDash([6,4]);ctx.lineWidth=1.5;ctx.stroke();ctx.restore()}}drawSelection(ctx,p)}
function templateOnCanvas(ctx,template){ctx.save();ctx.fillStyle=template==='dark'?'#243340':'white';ctx.fillRect(0,0,PAGE_W,PAGE_H);ctx.lineWidth=1;ctx.strokeStyle='#d8e6f7';if(template==='ruled'){for(let y=31;y<PAGE_H;y+=32){ctx.beginPath();ctx.moveTo(0,y+.5);ctx.lineTo(PAGE_W,y+.5);ctx.stroke()}ctx.strokeStyle='#ffced0';ctx.beginPath();ctx.moveTo(72,0);ctx.lineTo(72,PAGE_H);ctx.stroke()}if(template==='graph'){for(let x=0;x<PAGE_W;x+=32){ctx.beginPath();ctx.moveTo(x+.5,0);ctx.lineTo(x+.5,PAGE_H);ctx.stroke()}for(let y=0;y<PAGE_H;y+=32){ctx.beginPath();ctx.moveTo(0,y+.5);ctx.lineTo(PAGE_W,y+.5);ctx.stroke()}}if(template==='dots'){ctx.fillStyle='#b8cde5';for(let x=12;x<PAGE_W;x+=24)for(let y=12;y<PAGE_H;y+=24){ctx.beginPath();ctx.arc(x,y,1.15,0,Math.PI*2);ctx.fill()}}if(template==='music'){for(let y0=19;y0<PAGE_H;y0+=168)for(let t=0;t<5;t++){const y=y0+t*12;ctx.beginPath();ctx.moveTo(0,y+.5);ctx.lineTo(PAGE_W,y+.5);ctx.stroke()}}ctx.restore()}
async function pageToCanvas(page,index,scale=1){const canvas=document.createElement('canvas');canvas.width=Math.round(PAGE_W*scale);canvas.height=Math.round(PAGE_H*scale);const ctx=canvas.getContext('2d');ctx.scale(scale,scale);templateOnCanvas(ctx,page.template);for(const item of page.items){if(item.kind==='image'){let img=imageFor(item.src,index);if(!img){img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=item.src})}ctx.drawImage(img,item.x,item.y,item.w,item.h)}else drawItem(ctx,item,index)}return canvas}

// Pointer-based input works with Windows touchscreens, mice, and pressure-sensitive pens.
function loc(e,canvas){const r=canvas.getBoundingClientRect();return {
  x:clamp((e.clientX-r.left)/state.zoom,0,PAGE_W),
  y:clamp((e.clientY-r.top)/state.zoom,0,PAGE_H),
  p:e.pointerType==='pen'&&e.pressure>0?clamp(e.pressure,.03,1):.5,
  tx:e.pointerType==='pen'?clamp(e.tiltX||0,-90,90):0,
  ty:e.pointerType==='pen'?clamp(e.tiltY||0,-90,90):0,
  twist:e.pointerType==='pen'?(e.twist||0):0
}}
// Capture coalesced pen samples at the device input rate; only presentation trails.
function sampleInk(g,e,canvas){
  let samples=[];
  try{samples=typeof e.getCoalescedEvents==='function'?e.getCoalescedEvents():[]}catch{}
  for(const sample of [...samples,e]){
    const p=loc(sample,canvas);
    const clock=performance.now();
    let time=Number.isFinite(sample.timeStamp)&&Math.abs(sample.timeStamp-clock)<60000?sample.timeStamp:clock;
    const last=g.points[g.points.length-1];
    if(last)time=Math.max(time,last.t);
    Ink.appendSample(g.points,{...p,t:time});
  }
}
function animateInk(g,index){
  if(g.raf)return;
  g.raf=requestAnimationFrame(()=>{
    g.raf=0;
    if(state.gesture!==g)return;
    const visible=Ink.visibleSamples(g.points,performance.now(),g.delay);
    if(visible.length!==g.visible.length){g.visible=visible;drawPage(index)}
    if(visible.length<g.points.length)animateInk(g,index);
  });
}
function pointSegmentDistance(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,l=dx*dx+dy*dy;const t=l?clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/l,0,1):0;return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy)}
function hitItem(item,p){if(item.locked)return false;if(item.kind==='stroke'){const ps=item.points,rad=Math.max(10,item.width*(item.tool==='highlighter'?3:1.8));if(ps.length===1)return Math.hypot(p.x-ps[0].x,p.y-ps[0].y)<rad;for(let i=1;i<ps.length;i++)if(pointSegmentDistance(p,ps[i-1],ps[i])<rad)return true;return false}const b=getBounds(item);if(item.kind==='shape'&&['line','arrow'].includes(item.shape))return pointSegmentDistance(p,{x:item.x,y:item.y},{x:item.x2,y:item.y2})<13;return p.x>=b.x-8&&p.y>=b.y-8&&p.x<=b.x+b.w+8&&p.y<=b.y+b.h+8}
function pointInPoly(p,vs){let inside=false;for(let i=0,j=vs.length-1;i<vs.length;j=i++){const a=vs[i],b=vs[j];if(((a.y>p.y)!==(b.y>p.y))&&(p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x))inside=!inside}return inside}
function hitSelected(page,p){return page.items.some(item=>state.selection.includes(item.id)&&hitItem(item,p))}
function moveItem(item,dx,dy){if(item.kind==='stroke'){item.points.forEach(p=>{p.x+=dx;p.y+=dy})}else{item.x+=dx;item.y+=dy;if(item.kind==='shape'){item.x2+=dx;item.y2+=dy}}}
function eraseAt(page,p){for(let i=page.items.length-1;i>=0;i--){if(hitItem(page.items[i],p)){page.items.splice(i,1);return true}}return false}
function bindDrawing(canvas,index){
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  canvas.addEventListener('dblclick',e=>{if(state.tool!=='lasso'&&state.tool!=='text')return;const point=loc(e,canvas);const item=[...curPage(index).items].reverse().find(item=>item.kind==='text'&&hitItem(item,point));if(item)startTextEdit(canvas,index,{x:item.x,y:item.y},item)});
  canvas.addEventListener('pointerdown',e=>{if(e.button!==0&&e.pointerType==='mouse')return;if(document.querySelector('.text-editor'))finishActiveText(true);const p=loc(e,canvas);const page=curPage(index);if(!page)return;
    canvas.setPointerCapture(e.pointerId);
    if(state.tool==='hand'||state.spacePan){state.gesture={mode:'pan',index,startX:e.clientX,startY:e.clientY,scrollLeft:area.scrollLeft,scrollTop:area.scrollTop};canvas.style.cursor='grabbing';return}
    if(state.tool==='text'){canvas.releasePointerCapture(e.pointerId);startTextEdit(canvas,index,p);return}
    if(state.tool==='eraser'){saveHistory();state.gesture={mode:'erase',index,changed:false};if(eraseAt(page,p)){state.gesture.changed=true;drawPage(index)}return}
    if(state.tool==='lasso'){const selectedImage=page.items.find(item=>item.kind==='image'&&state.selection.includes(item.id));
      if(selectedImage){const b=getBounds(selectedImage);if(Math.hypot(p.x-(b.x+b.w+4),p.y-(b.y+b.h+4))<23){saveHistory();state.gesture={mode:'resize',index,id:selectedImage.id,start:p,w:selectedImage.w,h:selectedImage.h,changed:false};return}}
      if(state.selection.length&&hitSelected(page,p)){saveHistory();state.gesture={mode:'move',index,last:p,changed:false};return}state.selection=[];state.gesture={mode:'lasso',index,points:[p]};drawPage(index);return}
    saveHistory();if(state.tool==='shape'){state.gesture={mode:'shape',index,start:p,end:p}}else{const g={mode:'draw',index,pointerId:e.pointerId,points:[],visible:[],delay:state.inkDelay,raf:0,stroke:{id:uid(),kind:'stroke',inkVersion:2,tool:state.tool,color:state.color,width:state.width,points:[]}};state.gesture=g;sampleInk(g,e,canvas);animateInk(g,index)}drawPage(index);
  });
  canvas.addEventListener('pointermove',e=>{const g=state.gesture;if(!g||g.index!==index||(g.pointerId!=null&&g.pointerId!==e.pointerId))return;const p=loc(e,canvas);if(g.mode==='pan'){area.scrollLeft=g.scrollLeft-(e.clientX-g.startX);area.scrollTop=g.scrollTop-(e.clientY-g.startY);return}
    if(g.mode==='draw'){sampleInk(g,e,canvas);animateInk(g,index)}
    else if(g.mode==='lasso'){const pts=g.points,last=pts[pts.length-1];if(Math.hypot(p.x-last.x,p.y-last.y)>.8)pts.push(p)}
    else if(g.mode==='shape')g.end=p;
    else if(g.mode==='erase'){if(eraseAt(curPage(index),p))g.changed=true}
    else if(g.mode==='resize'){const img=curPage(index).items.find(i=>i.id===g.id);if(img){const w=clamp(g.w+p.x-g.start.x,35,PAGE_W-img.x),ratio=g.h/g.w;img.w=w;img.h=clamp(w*ratio,30,PAGE_H-img.y);g.changed=true}}
    else if(g.mode==='move'){const dx=p.x-g.last.x,dy=p.y-g.last.y;curPage(index).items.filter(item=>state.selection.includes(item.id)).forEach(item=>moveItem(item,dx,dy));g.last=p;g.changed=true}
    if(g.mode!=='draw')drawPage(index);
    if(g.mode==='draw'&&e.clientY>area.getBoundingClientRect().bottom-48&&area.scrollTop+area.clientHeight<area.scrollHeight-10)area.scrollTop+=4;
  });
  function finish(e){const g=state.gesture;if(!g||g.index!==index||(g.pointerId!=null&&g.pointerId!==e.pointerId))return;if(g.raf)cancelAnimationFrame(g.raf);state.gesture=null;canvas.style.cursor='';const page=curPage(index);if(!page)return;
    if(g.mode==='draw'){if(e.type==='pointerup')sampleInk(g,e,canvas);if(g.points.length){page.items.push({...g.stroke,points:g.points.map(({t,...point})=>point)});markChanged()}}
    else if(g.mode==='shape'){if(Math.hypot(g.end.x-g.start.x,g.end.y-g.start.y)>4){page.items.push({id:uid(),kind:'shape',shape:state.shape,color:state.color,width:state.width,x:g.start.x,y:g.start.y,x2:g.end.x,y2:g.end.y});markChanged()}}
    else if(g.mode==='lasso'){const selected=page.items.filter(item=>{if(item.locked)return false;if(item.kind==='stroke')return item.points.some(p=>pointInPoly(p,g.points));const b=getBounds(item);return pointInPoly({x:b.x+b.w/2,y:b.y+b.h/2},g.points)});state.selection=selected.map(x=>x.id);if(selected.length)toast(`${selected.length} item${selected.length===1?'':'s'} selected · drag to move`)}
    else if((g.mode==='erase'||g.mode==='move'||g.mode==='resize')&&g.changed)markChanged();
    drawPage(index);setUndoButtons();
  }
  canvas.addEventListener('pointerup',finish);canvas.addEventListener('pointercancel',finish);canvas.addEventListener('lostpointercapture',()=>{if(state.gesture?.index===index&&state.gesture.mode==='pan')state.gesture=null});
}
function startTextEdit(canvas,index,p,item=null){if(document.querySelector('.text-editor'))finishActiveText(true);const sheet=canvas.parentElement;const editor=document.createElement('textarea');editor.className='text-editor';editor.value=item?.text||'';editor.style.left=`${p.x}px`;editor.style.top=`${p.y}px`;editor.style.color=item?.color||state.color;editor.style.fontSize=`${item?.size||22}px`;editor.placeholder=t('Type your note…');sheet.appendChild(editor);editor.focus();const finish=(save)=>{if(!editor.isConnected)return;const text=editor.value.trim();editor.remove();if(save&&text){saveHistory();if(item){item.text=text;item.color=editor.style.color;item.w=editor.offsetWidth||item.w}else{curPage(index).items.push({id:uid(),kind:'text',text,x:p.x,y:p.y,w:Math.max(270,editor.offsetWidth||270),size:22,color:state.color})}markChanged()}drawPage(index)};editor._finish=finish;editor.addEventListener('blur',()=>finish(true));editor.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();finish(false)}if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();finish(true)}})}
function finishActiveText(save=true){document.querySelector('.text-editor')?._finish?.(save)}
function deleteSelection(){if(!state.selection.length)return;saveHistory();current().pages.forEach(p=>p.items=p.items.filter(i=>!state.selection.includes(i.id)));const count=state.selection.length;state.selection=[];refreshDocument();markChanged();toast(`${count} item${count===1?'':'s'} deleted`)}
function duplicateSelection(){if(!state.selection.length)return;saveHistory();for(const page of current().pages){const copied=page.items.filter(i=>state.selection.includes(i.id)).map(x=>{const c=deep(x);c.id=uid();moveItem(c,22,22);return c});page.items.push(...copied);if(copied.length)state.selection=copied.map(x=>x.id)}refreshDocument();markChanged();toast('Selection duplicated')}

function hidePopup(){state.popup?.remove();state.popup=null}
function showPopup(anchor,items,title){hidePopup();const div=document.createElement('div');div.className='popup';if(title)div.innerHTML=`<div class="popup-title">${esc(t(title))}</div>`;for(const item of items){if(item.separator){div.insertAdjacentHTML('beforeend','<div class="popup-divider"></div>');continue}const b=document.createElement('button');b.className='popup-item';b.innerHTML=(item.preview?`<span class="paper-preview ${item.preview}"></span>`:item.icon?`<svg><use href="#i-${item.icon}"/></svg>`:'')+`<span>${esc(t(item.label))}</span>`+(item.selected?'<svg class="check"><use href="#i-check"/></svg>':item.hint?`<span class="hint">${esc(t(item.hint))}</span>`:'');b.onclick=()=>{hidePopup();item.fn?.()};div.appendChild(b)}$('popup-layer').appendChild(div);const a=anchor.getBoundingClientRect(),h=div.getBoundingClientRect().height,w=div.getBoundingClientRect().width;let left=Math.max(8,Math.min(innerWidth-w-8,a.left));let top=a.bottom+6;if(top+h>innerHeight-12)top=Math.max(8,a.top-h-6);div.style.left=left+'px';div.style.top=top+'px';state.popup=div;setTimeout(()=>document.addEventListener('pointerdown',outsidePopup,{once:true}),0)}
function outsidePopup(e){if(state.popup&&!state.popup.contains(e.target))hidePopup();else if(state.popup)setTimeout(()=>document.addEventListener('pointerdown',outsidePopup,{once:true}),0)}
function modal({title,desc,content='',action='Done',danger=false,onConfirm=()=>{},onReady=()=>{}}){hidePopup();const backdrop=document.createElement('div');backdrop.className='modal-backdrop';backdrop.innerHTML=`<div class="modal" role="dialog" aria-modal="true" aria-label="${esc(t(title))}"><h2>${esc(t(title))}</h2><p>${esc(t(desc||''))}</p>${content}<div class="modal-actions"><button class="cancel">${esc(t('Cancel'))}</button><button class="primary confirm" style="${danger?'background:#d84b4b;border-color:#d84b4b;':''}">${esc(t(action))}</button></div></div>`;document.body.appendChild(backdrop);const box=backdrop.querySelector('.modal');const close=()=>backdrop.remove();box.querySelector('.cancel').onclick=close;box.querySelector('.confirm').onclick=()=>{onConfirm(box);close()};backdrop.addEventListener('click',e=>{if(e.target===backdrop)close()});backdrop.addEventListener('keydown',e=>{if(e.key==='Escape')close();if(e.key==='Enter'&&e.target.tagName==='INPUT'){e.preventDefault();onConfirm(box);close()}});onReady(box)}
function templateMenu(anchor){showPopup(anchor,Object.entries(templateLabels).map(([key,label])=>({label,preview:key,selected:curPage(visiblePage())?.template===key,fn:()=>{saveHistory();curPage(visiblePage()).template=key;refreshDocument();markChanged();toast(label+' applied')}})).concat([{separator:true},{label:'Apply this paper to all pages',icon:'paper',fn:()=>{saveHistory();const t=curPage(visiblePage()).template;current().pages.forEach(p=>p.template=t);refreshDocument();markChanged();toast('Paper applied to every page')}}]),'PAPER STYLE')}
function shapeMenu(anchor){showPopup(anchor,[['line','Line'],['arrow','Arrow'],['rect','Rectangle'],['ellipse','Ellipse / circle'],['triangle','Triangle']].map(([key,label])=>({label,icon:'shape',selected:state.shape===key,fn:()=>{state.shape=key;setTool('shape');toast(label+' tool ready')}})),'DRAW A SHAPE')}
function moreMenu(anchor){showPopup(anchor,[
 {label:'Insert image',icon:'image',fn:()=>$('image-import').click()},
 {label:'Import PDF / DOCX',icon:'file',fn:()=>$('file-import').click()},
 {label:'Paste image / text · Ctrl+V',icon:'image',fn:()=>toast('Copy an image or text, then press Ctrl+V over the page')},
 {label:I?.getLanguage()==='vi'?(state.inkDelay?'Làm mượt nét bút: Bật (24 ms)':'Làm mượt nét bút: Tắt'):(state.inkDelay?'Stroke stabilization: On (24 ms)':'Stroke stabilization: Off'),icon:'settings',selected:!!state.inkDelay,fn:()=>{state.inkDelay=state.inkDelay?0:Ink.STABILIZATION_MS;try{localStorage.setItem('freeink-ink-stabilization',state.inkDelay?'on':'off')}catch{}toast(I?.getLanguage()==='vi'?(state.inkDelay?'Đã bật làm mượt nét bút':'Đã tắt làm mượt nét bút'):(state.inkDelay?'Stroke stabilization on':'Stroke stabilization off'))}},
 {label:'Duplicate selected items',icon:'copy',fn:duplicateSelection},
 {separator:true},
 {label:'Duplicate current page',icon:'copy',fn:()=>{saveHistory();const index=visiblePage(),page=deep(curPage(index));page.id=uid();current().pages.splice(index+1,0,page);refreshDocument();markChanged();toast('Page duplicated')}},
 {label:'Clear current page',icon:'eraser',fn:()=>modal({title:'Clear this page?',desc:'Remove all ink, text, and inserted images on this page?',action:'Clear page',danger:true,onConfirm:()=>{saveHistory();curPage(visiblePage()).items=[];refreshDocument();markChanged()}})},
 {label:'Delete current page',icon:'trash',fn:()=>{if(current().pages.length<=1){toast('Every note needs at least one page');return}saveHistory();current().pages.splice(visiblePage(),1);refreshDocument();markChanged()}},
 {separator:true},{label:'User guide',icon:'book',fn:showManualGuide},{label:'Keyboard shortcuts',icon:'settings',fn:showHelp},
 {label:'About FreeInk',icon:'book',fn:()=>modal({title:'FreeInk · Prototype',desc:'A free, offline-first handwriting notebook inspired by the workflow of Windows inking apps. Your notes are stored in your browser/desktop app on this device. Export a .freeink backup for safekeeping.',action:'Close'})}
 ],'NOTE OPTIONS')}
function showHelp(){modal({title:'Keyboard shortcuts',desc:'Use these while your focus is on the canvas.',content:`<div class="help-grid">${[['P','Pen'],['K','Pencil'],['H','Highlighter'],['E','Eraser'],['L','Lasso selection'],['S','Shapes'],['T','Text'],['Space (hold)','Pan'],['Ctrl + Z','Undo'],['Ctrl + Y','Redo'],['Ctrl + S','Save'],['Ctrl + N','New note'],['Delete','Delete selected'],['Ctrl + D','Duplicate selection']].map(x=>`<span><kbd>${esc(x[0])}</kbd>${esc(t(x[1]))}</span>`).join('')}</div>`,action:'Got it'})}


function showManualGuide(){
 const vi=I?.getLanguage()==='vi';
 const content=vi?`<div class="guide-content">
 <h3>1. Bắt đầu</h3><p>Nhấn <b>+</b> để tạo ghi chú, đặt tên và chọn giấy kẻ dòng, trắng, ô vuông, chấm hoặc khuông nhạc. Chọn ghi chú trong thư viện bên trái.</p>
 <h3>2. Viết và chỉnh sửa</h3><p>Dùng chuột, màn hình cảm ứng hoặc bút cảm ứng. Chọn Bút mực, Bút chì, Bút đánh dấu, Tẩy, Khoanh chọn, Hình dạng hay Văn bản trên thanh công cụ. Đổi màu và độ dày nét.</p>
 <p><b>Nét bút ổn định:</b> Khi viết, nét mực theo sau đầu bút khoảng 24 ms để giảm rung; khi nhấc bút, nét hoàn thiện ngay. Bút hỗ trợ áp lực và độ nghiêng nếu phần cứng cung cấp. Có thể bật/tắt tại <b>Tùy chọn ghi chú → Làm mượt nét bút</b>.</p>
 <h3>3. Chèn tài liệu</h3><p>Nhấn <b>Nhập tệp</b> để thêm ảnh, PDF, DOCX hoặc tệp <b>.freeink</b>. Dán ảnh chụp màn hình bằng <kbd>Ctrl/⌘ + V</kbd>. Dùng công cụ Khoanh chọn để di chuyển và thay đổi kích thước ảnh. PDF và DOCX cần bản desktop có đủ thư viện; nội dung Word có thể mất định dạng phức tạp.</p>
 <h3>4. Lưu và xuất</h3><p>Ghi chú được tự động lưu trên <b>thiết bị hiện tại</b>, không đồng bộ đám mây. Nhấn <b>Xuất tệp → PDF vector</b> để giữ nét viết sắc nét ở mọi mức phóng to. Ảnh và trang PDF nhập vào vẫn phụ thuộc độ phân giải gốc. Xuất <b>.freeink</b> thường xuyên để sao lưu và chuyển máy.</p>
 <h3>5. Trang, phóng to và cập nhật</h3><p>Nhấn <b>Thêm trang</b>, thay mẫu giấy, dùng nút +/− để phóng to. Bản cài đặt EXE Windows có nút Cập nhật từ GitHub Releases; bản MSI được nâng cấp bằng Windows Installer. Bản Mac dùng gói DMG; chức năng tự cập nhật cần ứng dụng đã ký và công chứng.</p>
 <h3>6. Phím tắt</h3><p><kbd>P</kbd> Bút · <kbd>K</kbd> Bút chì · <kbd>H</kbd> Đánh dấu · <kbd>E</kbd> Xóa · <kbd>L</kbd> Khoanh · <kbd>S</kbd> Hình · <kbd>T</kbd> Chữ · <kbd>Space</kbd> Di chuyển · <kbd>Ctrl/⌘ + S</kbd> Lưu · <kbd>Ctrl/⌘ + N</kbd> Tạo mới · <kbd>Ctrl/⌘ + Z</kbd> Hoàn tác · <kbd>Ctrl/⌘ + Y</kbd> Làm lại.</p>
 <p><b>Lưu ý:</b> Hãy sao lưu ghi chú trước khi gỡ cài đặt hoặc xóa dữ liệu ứng dụng. Đây là ứng dụng đang phát triển.</p>
 </div>`:`<div class="guide-content">
 <h3>1. Get started</h3><p>Click <b>+</b> to create a notebook, name it, and choose lined, blank, grid, dotted, or music paper. Select saved notebooks from the gallery on the left.</p>
 <h3>2. Draw and edit</h3><p>Write with a mouse, touchscreen, or pen. Choose Pen, Pencil, Highlighter, Eraser, Lasso, Shape, or Text in the toolbar. Adjust color and line thickness.</p>
 <p><b>Stabilized ink:</b> While writing, the visible ink trails the stylus by about 24 ms to reduce jitter. It catches up on pen-up. Pressure and tilt affect line width on compatible hardware. Turn it on/off in <b>Note options → Stroke stabilization</b>.</p>
 <h3>3. Import documents</h3><p>Use <b>Import</b> for images, PDF, DOCX, and <b>.freeink</b> files. Paste screenshots with <kbd>Ctrl/⌘ + V</kbd>. Use Lasso to move or resize images. PDF/DOCX import requires the installed desktop dependencies; complex Word layouts may change.</p>
 <h3>4. Save and export</h3><p>Notes auto-save <b>on this device</b>; there is no cloud sync. Choose <b>Export → Vector PDF</b> to keep handwriting and shapes sharp at any zoom. Imported images and PDF backgrounds have their original pixel resolution. Export <b>.freeink</b> backups regularly for safekeeping and transferring devices.</p>
 <h3>5. Pages, zoom, and updates</h3><p>Click <b>Add page</b>, change paper templates, or use +/− to zoom. The Windows NSIS EXE checks for GitHub updates; MSI upgrades use Windows Installer. On macOS, DMG builds require developer signing and notarization for smooth distribution and self-updating.</p>
 <h3>6. Keyboard shortcuts</h3><p><kbd>P</kbd> Pen · <kbd>K</kbd> Pencil · <kbd>H</kbd> Highlighter · <kbd>E</kbd> Eraser · <kbd>L</kbd> Lasso · <kbd>S</kbd> Shapes · <kbd>T</kbd> Text · <kbd>Space</kbd> Pan · <kbd>Ctrl/⌘ + S</kbd> Save · <kbd>Ctrl/⌘ + N</kbd> New · <kbd>Ctrl/⌘ + Z</kbd> Undo · <kbd>Ctrl/⌘ + Y</kbd> Redo.</p>
 <p><b>Important:</b> Back up notes before uninstalling or clearing application data. FreeInk is still in development.</p>
 </div>`;
 modal({title:vi?'Hướng dẫn sử dụng FreeInk':'FreeInk user guide',desc:vi?'Cơ bản, nhập tệp, sao lưu và phím tắt.':'Writing, importing, backups, and shortcuts.',content,action:'Close',onReady:m=>m.classList.add('guide-dialog')});
}

// Exports: PNG is bitmap; PDF uses native resolution-independent ink and shapes.
function downloadBlob(blob,filename){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000)}
async function exportPNG(){const i=visiblePage(),canvas=await pageToCanvas(curPage(i),i,2);canvas.toBlob(blob=>{if(blob){downloadBlob(blob,`${documentName()} - page ${i+1}.png`);toast('PNG exported')}},'image/png')}
function exportFreeInk(){const blob=new Blob([JSON.stringify({app:'FreeInk',version:2,exported:new Date().toISOString(),note:current()},null,2)],{type:'application/json'});downloadBlob(blob,`${documentName()}.freeink`);toast('Editable note backed up')}
async function imageToPdfJpeg(src){
 const img=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(Error('Failed to load an inserted image'));im.src=src});
 const parts=/^data:image\/jpeg;base64,(.*)$/is.exec(src);
 if(parts)return {bytes:FreeInkVectorPDF.base64(parts[1]),w:img.naturalWidth,h:img.naturalHeight};
 const scale=Math.min(1,4096/Math.max(img.naturalWidth,img.naturalHeight));
 const c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.naturalWidth*scale));c.height=Math.max(1,Math.round(img.naturalHeight*scale));
 const ctx=c.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(img,0,0,c.width,c.height);
 const b64=c.toDataURL('image/jpeg',.96).split(',')[1];return {bytes:FreeInkVectorPDF.base64(b64),w:c.width,h:c.height};
}
async function exportPDF(){const note=current();if(!note)return;
 toast(`Writing ${note.pages.length} vector PDF page${note.pages.length===1?'':'s'}…`);
 try{
  const measureCtx=document.createElement('canvas').getContext('2d');
  const measure=(value,size)=>{measureCtx.font=`${size}px Arial, sans-serif`;return measureCtx.measureText(value).width};
  const pdf=await FreeInkVectorPDF.createVectorPdf(note.pages,{images:imageToPdfJpeg,measure});
  downloadBlob(pdf,`${documentName()}.pdf`);toast('Vector PDF saved · ink remains sharp at any zoom');
 }catch(e){console.error(e);toast('PDF export failed: '+(e.message||'Unknown error'))}
}
function exportMenu(anchor){showPopup(anchor,[{label:'Vector PDF · all pages, sharp ink',icon:'file',fn:exportPDF},{label:'PNG image · current page',icon:'image',fn:exportPNG},{separator:true},{label:'FreeInk file · editable backup',icon:'save',fn:exportFreeInk}],'EXPORT NOTE')}
function readFileAsDataUrl(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(file)})}
async function importImage(file){const data=await readFileAsDataUrl(file),img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=data});const idx=visiblePage(),s=Math.min(640/img.width,750/img.height,1),w=Math.round(img.width*s),h=Math.round(img.height*s);saveHistory();curPage(idx).items.push({id:uid(),kind:'image',src:data,x:(PAGE_W-w)/2,y:90,w,h});refreshDocument();markChanged();toast('Image inserted · use Lasso to move or resize it')}
function importNote(data){const note=data.note||data;if(!Array.isArray(note.pages)||!note.pages.every(p=>Array.isArray(p.items)))throw Error('Invalid note format');const n=deep(note);n.id=uid();n.title=(n.title||'Imported note')+' (imported)';n.created=n.modified=Date.now();for(const p of n.pages){p.id=uid();p.items.forEach(item=>{item.id=uid()})}state.notes.unshift(n);switchNote(n.id);toast('Editable note imported')}
async function importPDF(file){let pdfjs;try{pdfjs=await import('./node_modules/pdfjs-dist/build/pdf.mjs')}catch(e){throw Error('PDF import requires the Windows desktop setup (npm install). PNG, PDF export, and inking work without it.')}pdfjs.GlobalWorkerOptions.workerSrc=new URL('./node_modules/pdfjs-dist/build/pdf.worker.mjs',location.href).href;const bytes=await file.arrayBuffer();const base=new URL('./node_modules/pdfjs-dist/',location.href).href;const task=pdfjs.getDocument({data:new Uint8Array(bytes),standardFontDataUrl:base+'standard_fonts/',cMapUrl:base+'cmaps/',cMapPacked:true,wasmUrl:base+'wasm/'});const pdf=await task.promise;const n=newNote(file.name.replace(/\.pdf$/i,''),'blank');n.pages=[];const limit=Math.min(pdf.numPages,50);toast(`Importing ${limit} PDF pages…`);for(let i=1;i<=limit;i++){const p=await pdf.getPage(i);const native=p.getViewport({scale:1}),scale=Math.min(PAGE_W/native.width,PAGE_H/native.height),vp=p.getViewport({scale:Math.min(scale*2.4,3.5)}),canvas=document.createElement('canvas');canvas.width=Math.ceil(vp.width);canvas.height=Math.ceil(vp.height);const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);await p.render({canvasContext:ctx,viewport:vp,canvas}).promise;const pg=newPage('blank');pg.items.push({id:uid(),kind:'image',locked:true,src:canvas.toDataURL('image/jpeg',.94),x:(PAGE_W-native.width*scale)/2,y:(PAGE_H-native.height*scale)/2,w:native.width*scale,h:native.height*scale});n.pages.push(pg);p.cleanup()}state.notes.unshift(n);switchNote(n.id);toast(t('{count} PDF pages ready for annotation',{count:limit}))}
// The DOCX bridge uses Mammoth to read Word files as HTML; we extract *only*
// textContent and embedded data images, never insert the converted HTML into our UI.
// This is reflowable import, not pixel-perfect Microsoft Word layout conversion.
async function loadMammoth(){
 if(window.mammoth)return window.mammoth;
 if(!location.protocol.startsWith('http'))throw Error('DOCX import needs the installed Windows app or npm browser preview');
 if(!window.__mammothLoading)window.__mammothLoading=new Promise((resolve,reject)=>{
   const script=document.createElement('script');script.src='./node_modules/mammoth/mammoth.browser.js';
   script.onload=()=>window.mammoth?resolve(window.mammoth):reject(Error('Mammoth library not found'));
   script.onerror=()=>reject(Error('DOCX import library missing. Run npm install.'));document.head.appendChild(script);
 });
 try{return await window.__mammothLoading}catch(err){window.__mammothLoading=null;throw err}
}
async function importDOCX(file){
 if(file.size>25*1024*1024)throw Error('DOCX exceeds the 25 MB prototype import limit');
 const mammoth=await loadMammoth();const result=await mammoth.convertToHtml({arrayBuffer:await file.arrayBuffer()});
 const dom=new DOMParser().parseFromString(result.value,'text/html');
 const n=newNote(file.name.replace(/\.docx$/i,''),'blank');n.pages=[];
 let pg=newPage('blank'),y=64;const margin=55,contentW=706,bottom=990;
 const nextPage=()=>{n.pages.push(pg);if(n.pages.length>=200)throw Error('DOCX exceeds the 200-page import limit');pg=newPage('blank');y=64};
 const ctx=document.createElement('canvas').getContext('2d');
 const addParagraph=(raw,isHeading=false)=>{
  let txt=String(raw).replace(/\s+/g,' ').trim();if(!txt)return;
  // Split text into editor-compatible blocks within page boundaries.
  const size=isHeading?25:19;ctx.font=`${size}px Segoe UI,Arial,sans-serif`;
  const lines=wrapText(ctx,txt,contentW),rowH=size*1.44;
  let segment=[],flush=()=>{if(!segment.length)return;pg.items.push({id:uid(),kind:'text',text:segment.join('\n'),x:margin,y,w:contentW,size,color:'#273449',weight:isHeading?600:400});y+=segment.length*rowH+12;segment=[]};
  for(const line of lines){if(y+(segment.length+1)*rowH>bottom){flush();nextPage()}segment.push(line)}flush();
 };
 const addImage=async(src)=>{
  if(!/^data:image\/(?:png|jpeg|jpg|webp|gif);base64,/i.test(src))return;
  const img=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=src});
  const sc=Math.min(1,contentW/img.width,600/img.height),w=img.width*sc,h=img.height*sc;
  if(y+h>bottom)nextPage();pg.items.push({id:uid(),kind:'image',src,x:margin,y,w,h});y+=h+16;
 };
 // Walk the sanitized DOM's text and embedded images in reading order.
 let charCount=0;
 async function walk(node){
  if(node.nodeType!==1)return;
  const tag=node.tagName.toLowerCase();
  if(tag==='img'){await addImage(node.getAttribute('src')||'');return}
  if(['p','h1','h2','h3','li','blockquote','pre'].includes(tag)){
   const ownText=[...node.childNodes].filter(n=>n.nodeType===3||n.nodeType===1&&n.tagName?.toLowerCase()!=='img').map(n=>n.textContent).join(' ');
   charCount+=ownText.length;if(charCount>250000)throw Error('DOCX text exceeds import limit');
   addParagraph(ownText,/^h[123]$/.test(tag));for(const im of node.querySelectorAll('img'))await addImage(im.getAttribute('src')||'');return;
  }
  if(tag==='table'){for(const tr of node.querySelectorAll('tr'))addParagraph([...tr.querySelectorAll('td,th')].map(c=>c.textContent.trim()).join('  |  '));return}
  for(const child of node.children)await walk(child);
 }
 await walk(dom.body);n.pages.push(pg);if(!n.pages.length)n.pages.push(newPage('blank'));
 state.notes.unshift(n);switchNote(n.id);toast(`DOCX imported: ${n.pages.length} editable page${n.pages.length===1?'':'s'}`);
}
async function importFile(file){if(!file)return;try{
 if(file.size>75*1024*1024)throw Error('File too large (75 MB limit)');
 if(file.type.startsWith('image/')||/\.(png|jpe?g|webp|gif)$/i.test(file.name))await importImage(file);
 else if(/\.pdf$/i.test(file.name))await importPDF(file);
 else if(/\.docx$/i.test(file.name))await importDOCX(file);
 else if(/\.(json|freeink)$/i.test(file.name)){const raw=JSON.parse(await file.text());importNote(raw)}
 else toast('Supported: PDF, DOCX, PNG, JPG, WebP, .freeink');
 }catch(e){console.error(e);toast(e.message||'Could not import this file')}
}
function insertPastedText(input){
 const text=String(input).slice(0,18000).trim();if(!text)return;
 const index=visiblePage();saveHistory();const pg=curPage(index);
 pg.items.push({id:uid(),kind:'text',text,x:54,y:72,w:690,size:22,color:state.color});
 refreshDocument();markChanged();toast('Pasted text · double-click with Text tool to edit');
}
async function pasteIntoCanvas(e){
 const target=e.target;
 if(target.closest?.('input,textarea,[contenteditable="true"],.modal'))return;
 const clip=e.clipboardData;if(!clip)return;
 const file=[...clip.files].find(f=>f.type.startsWith('image/')||/\.(pdf|docx|png|jpg|jpeg|webp)$/i.test(f.name));
 const imageItem=[...clip.items].find(i=>i.kind==='file'&&i.type.startsWith('image/'));
 if(file||imageItem){e.preventDefault();await importFile(file||imageItem.getAsFile());return}
 const txt=clip.getData('text/plain');if(txt){e.preventDefault();insertPastedText(txt)}
}

// Native updater is outside the editor. Standalone HTML cannot update itself.
let latestUpdateStatus='idle';
function connectUpdater(){
 const button=$('update-btn'),label=$('update-label');
 const setStatus=(value,message)=>{
  latestUpdateStatus=value;button.dataset.status=value;button.title=t(message||'Check for updates');
  label.textContent=t(value==='available'?'Download update':value==='downloaded'?'Restart to update':value==='downloading'?'Downloading…':value==='checking'?'Checking…':value==='msi'?'MSI updates':value==='mac-unsigned'?'Mac updates':'Updates');
  if(['available','downloaded','error'].includes(value)&&message)toast(message);
 };
 if(!window.freeinkDesktop){button.onclick=()=>toast('Automatic updates require the installed Windows NSIS version');return}
 window.freeinkDesktop.onUpdateStatus(detail=>setStatus(detail.status,detail.message));
 button.onclick=async()=>{
  if(['downloading','checking','installing'].includes(latestUpdateStatus))return;
  const action=latestUpdateStatus==='available'?'download':latestUpdateStatus==='downloaded'?'install':'check';
  try{if(action==='install')await flushSave();const r=await window.freeinkDesktop.updates(action);if(r?.message){setStatus(r.status,r.message);if(!['available','downloaded','error'].includes(r.status))toast(r.message)}}
  catch(e){toast('Could not update: '+e.message)}
 };
}

function addEvents(){
 $('language-select').value=I?.getLanguage()||'en';
 $('language-select').addEventListener('change',e=>I?.setLanguage(e.target.value));
 $('guide-btn').onclick=showManualGuide;
 document.addEventListener('freeink:language',()=>{I.apply();renderGallery();updateHeader();showSaved(state.saving?'Saving…':'Saved');const status=latestUpdateStatus;const labels={idle:'Updates',checking:'Checking…',available:'Download update',downloading:'Downloading…',downloaded:'Restart to update',msi:'MSI updates'};$('update-label').textContent=t(labels[status]||'Updates');});
 $('gallery-toggle').onclick=()=>toggleSidebar();$('sidebar-close').onclick=()=>toggleSidebar(false);$('sidebar-backdrop').onclick=()=>toggleSidebar(false);
 $('new-note').onclick=$('sidebar-new').onclick=showNewNoteModal;
 $('save-note').onclick=async()=>{await flushSave();toast('All changes saved locally')};$('undo').onclick=undo;$('redo').onclick=redo;
 $('note-search').addEventListener('input',renderGallery);
 $('note-title').addEventListener('change',e=>{const value=e.target.value.trim()||'Untitled note';if(value!==current().title){saveHistory();current().title=value;markChanged();renderGallery();updateHeader()}});
 $('template-btn').onclick=e=>templateMenu(e.currentTarget);
 $('export-btn').onclick=e=>exportMenu(e.currentTarget);
 $('options-btn').onclick=e=>moreMenu(e.currentTarget);
 $('import-btn').onclick=()=>$('file-import').click();
 $('file-import').onchange=e=>{importFile(e.target.files[0]);e.target.value=''};$('image-import').onchange=e=>{importFile(e.target.files[0]);e.target.value=''};
 document.querySelectorAll('[data-tool]').forEach(b=>b.addEventListener('click',()=>{if(b.dataset.tool==='shape'&&state.tool==='shape')shapeMenu(b);else setTool(b.dataset.tool)}));
 $('ruler-toggle').onclick=()=>{state.ruler=!state.ruler;document.querySelectorAll('.sheet').forEach(el=>el.classList.toggle('show-ruler',state.ruler));updateToolButtons();toast(state.ruler?'Ruler displayed (visual guide)':'Ruler hidden')};
 $('stroke-width').oninput=e=>setWidth(e.target.value);
 $('custom-color').oninput=e=>{state.color=e.target.value;updatePalette()};
 $('add-page').onclick=()=>addPage(true);
 $('zoom-in').onclick=()=>setZoom(state.zoom+.1);$('zoom-out').onclick=()=>setZoom(state.zoom-.1);$('zoom-fit').onclick=fitZoom;
 area.addEventListener('scroll',()=>{updateHeader();const n=current();if(n&&n.pages[n.pages.length-1].items.length&&area.scrollHeight-area.scrollTop-area.clientHeight<100){addPage(false)}},{passive:true});
 document.addEventListener('paste',pasteIntoCanvas);
 area.addEventListener('dragover',e=>{if(e.dataTransfer.types.includes('Files'))e.preventDefault()});area.addEventListener('drop',e=>{e.preventDefault();for(const f of e.dataTransfer.files)importFile(f)});
 document.addEventListener('keydown',e=>{const editing=['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)||document.activeElement?.isContentEditable;
  if(e.key==='Escape'){hidePopup();if(state.selection.length){state.selection=[];refreshDocument()}return}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();flushSave().then(()=>toast('Saved locally'));return}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='n'){e.preventDefault();showNewNoteModal();return}
  if(editing||document.querySelector('.modal-backdrop'))return;
  if(e.key==='?' && !e.ctrlKey && !e.metaKey){e.preventDefault();showManualGuide();return}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();if(e.shiftKey)redo();else undo();return}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();redo();return}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='d'){e.preventDefault();duplicateSelection();return}
  if((e.key==='Delete'||e.key==='Backspace')&&state.selection.length){e.preventDefault();deleteSelection();return}
  if(e.code==='Space'&&!e.repeat){e.preventDefault();state.spacePan=true;document.querySelectorAll('.sheet').forEach(s=>s.dataset.tool='hand');return}
  const shortcuts={p:'pen',k:'pencil',h:'highlighter',e:'eraser',l:'lasso',s:'shape',t:'text'};if(!e.ctrlKey&&!e.metaKey&&shortcuts[e.key.toLowerCase()])setTool(shortcuts[e.key.toLowerCase()]);
 });
 document.addEventListener('keyup',e=>{if(e.code==='Space'){state.spacePan=false;updateToolButtons()}});
 window.addEventListener('beforeunload',()=>{if(state.saveTimer){clearTimeout(state.saveTimer);persist()}});
}
async function main(){I?.apply();addEvents();connectUpdater();updatePalette();setWidth(3);const saved=await getSaved();if(saved?.notes?.length){state.notes=migrateLibrary(saved).notes;state.currentId=state.notes.some(n=>n.id===saved.currentId)?saved.currentId:state.notes[0].id}else{state.notes=[initialNote(),newNote('Quick notes','graph')];state.currentId=state.notes[0].id;queueSave()}
  toggleSidebar(false);refreshDocument();renderGallery();setUndoButtons();updateHeader();
  // Functional diagnostics, intentionally limited to a single read-only object.
  Object.defineProperty(window,'__freeinkDebug',{value:Object.freeze({getState:()=>({noteCount:state.notes.length,title:current()?.title,pageCount:current()?.pages.length,items:current()?.pages.map(p=>p.items.length),tool:state.tool,zoom:state.zoom}),exportPDF}),configurable:false});
}
main().catch(e=>{console.error(e);toast('Something went wrong while starting FreeInk')});
})();
