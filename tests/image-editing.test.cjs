'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const Images=require('../image-tools'),Runtime=require('../runtime'),Ink=require('../ink-engine');
const box={x:100,y:200,w:200,h:100},close=(a,b)=>assert(Math.abs(a-b)<.00001,`${a} != ${b}`);
assert.deepEqual(Images.resizeBox(box,'e',80,60),{x:100,y:200,w:280,h:100},'an edge must adjust only its own dimension');
assert.deepEqual(Images.resizeBox(box,'nw',-20,-30),{x:80,y:170,w:220,h:130});
assert.deepEqual(Images.resizeBox(box,'se',80,60),{x:100,y:200,w:280,h:160},'corners must allow independent dimensions');
assert.deepEqual(Images.moveBox(box,1000,-1000),{x:616,y:0,w:200,h:100});
for(const {id} of Images.handles){
 for(const [dx,dy] of [[90,40],[-900,-900],[10000,10000]]){
  for(const keepAspect of [false,true]){const resized=Images.resizeBox(box,id,dx,dy,{keepAspect});assert(resized.w>=8&&resized.h>=8);assert(resized.x>=0&&resized.y>=0&&resized.x+resized.w<=816.00001&&resized.y+resized.h<=1056.00001);if(keepAspect)close(resized.w/resized.h,2)}
 }
}
const proportional=Images.resizeBox(box,'w',-100,0,{keepAspect:true});close(proportional.y+proportional.h/2,250);close(proportional.x+proportional.w,300);
const placed=Images.placeImage({w:4000,h:3000},{x:0,y:700,w:816,h:356});assert(placed.y>=700&&placed.y+placed.h<=1056);assert(placed.h<300,'large pasted images must fit the visible portion of a page');
const dropped=Images.placeImage({w:100,h:60},{x:0,y:0,w:816,h:1056},{point:{x:300,y:500}});close(dropped.x,250);close(dropped.y,470);
for(const size of [{w:4096,h:1},{w:1,h:4096}]){const placed=Images.placeImage(size,{x:0,y:0,w:816,h:1056});assert(placed.w>=1&&placed.h>=1,'thin banners must stay visible and valid in editable backups')}
const restored=Images.restoreProportions({x:700,y:1000,w:400,h:100},.5);close(restored.w/restored.h,2);assert(restored.x+restored.w<=816&&restored.y+restored.h<=1056);

// Run the actual pointer handlers, with one deterministic animation queue.
const source=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8'),events=new Map(),frames=new Map();let clock=0,serial=0,histories=0,changes=0;
const original={id:'photo',kind:'image',...box,erasures:[{width:10,points:[{x:150,y:250}]}]},page={items:[original]},state={tool:'hand',zoom:1,selection:[],gesture:null};
const captures=new Set(),canvas={style:{},dataset:{ready:'true'},getBoundingClientRect:()=>({left:0,top:0}),focus(){},setPointerCapture:id=>captures.add(id),hasPointerCapture:id=>captures.has(id),releasePointerCapture:id=>captures.delete(id),addEventListener:(type,handler)=>events.set(type,handler)};
const context={state,Images,Runtime,Ink,performance:{now:()=>++clock},PAGE_W:816,PAGE_H:1056,clamp:(n,a,b)=>Math.max(a,Math.min(b,n)),uid:()=>String(++serial),document:{querySelector:()=>null},curPage:()=>page,getBounds:item=>item,maskBounds:item=>item,
 area:{scrollLeft:0,scrollTop:200},saveHistory(){histories++},markChanged(){changes++},drawPage(){},setUndoButtons(){},updateImageControls(){},redrawSelection(){},toast(){},requestAnimationFrame(fn){const id=++serial;frames.set(id,fn);return id},cancelAnimationFrame:id=>frames.delete(id)};
vm.createContext(context);vm.runInContext(source.slice(source.indexOf('function loc('),source.indexOf('function startTextEdit(')),context);context.bindDrawing(canvas,0);
const send=(type,values={})=>{const event={type,isPrimary:true,pointerType:'mouse',button:0,pointerId:1,clientX:140,clientY:220,preventDefault(){},...values};events.get(type)(event)};
const tick=()=>{const list=[...frames.values()];frames.clear();list.forEach(fn=>fn())};
send('pointerdown');assert.equal(state.gesture.mode,'move');assert.equal(histories,0);send('pointerup');assert.equal(histories,0,'selecting without dragging must preserve undo and redo');assert.equal(changes,0);
send('pointerdown');for(let i=1;i<=30;i++)send('pointermove',{clientX:140+i,clientY:220+i});assert.equal(frames.size,1);assert.equal(histories,0);tick();assert.equal(histories,1);
assert.equal(original.x,100,'history geometry must stay immutable');assert.equal(original.erasures[0].points[0].x,150);
send('pointerup',{clientX:190,clientY:250});assert.equal(page.items[0].x,150);assert.equal(page.items[0].y,230);assert.equal(changes,1);assert.equal(histories,1);assert.equal(frames.size,0);
assert.equal(page.items[0].erasures[0].points[0].x,200);
// All handles share the same capture/finish path, including a release before RAF.
canvas._imageResize({pointerId:2,isPrimary:true,pointerType:'mouse',button:0,clientX:350,clientY:280,preventDefault(){}},'e');
send('pointermove',{pointerId:2,clientX:450,clientY:280});send('pointerup',{pointerId:2,clientX:470,clientY:280});
assert.equal(page.items[0].w,320);assert.equal(page.items[0].h,100);close(page.items[0].erasures[0].aspect,200/320);assert.equal(histories,2);assert.equal(changes,2);assert.equal(captures.size,0);assert.equal(frames.size,0);
state.spacePan=true;const before=page.items[0].x;send('pointerdown',{clientX:180,clientY:250});assert.equal(state.gesture.mode,'pan');send('pointermove',{clientX:180,clientY:200});send('pointerup',{clientX:180,clientY:200});assert.equal(page.items[0].x,before);assert.equal(context.area.scrollTop,250);assert.equal(histories,2);
state.spacePan=false;send('pointerdown',{button:1,clientX:180,clientY:250});assert.equal(state.gesture.mode,'pan');state.gesture.finish();
send('pointerdown',{clientX:180,clientY:250});send('pointermove',{clientX:200,clientY:260});send('pointercancel');assert.equal(changes,3);assert.equal(frames.size,0,'cancellation must flush pending object geometry');
const locked=page.items[0];locked.locked=true;send('pointerdown',{clientX:200,clientY:260});assert.equal(state.gesture.mode,'pan','imported PDF backgrounds must remain locked');send('pointerup');locked.locked=false;
state.tool='eraser';const count=histories;send('pointerdown',{clientX:800,clientY:900});send('pointerup',{clientX:800,clientY:900});assert.equal(histories,count,'erasing empty space must not discard redo');
console.log('Image editing: eight resize anchors, independent dimensions, Shift ratio, viewport placement, direct pointer editing, immutable undo, coalescing, final/cancelled samples and forced pan pass.');
