'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const Ink=require('../ink-engine.js');

// Execute the actual canvas pointer handlers in a small event/animation harness.
// No Electron window or production-only debug API is needed.
const source=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
const start=source.indexOf('function loc('),end=source.indexOf('function startTextEdit(');
assert(start>=0&&end>start);
const events=new Map(),frames=new Map(),page={items:[]};
let clock=0,nextFrame=0,changes=0;
const state={tool:'pen',zoom:1,inkDelay:24,width:3,color:'#000000',gesture:null,selection:[]};
const canvas={style:{},getBoundingClientRect:()=>({left:0,top:0}),setPointerCapture(){},releasePointerCapture(){},
  addEventListener(type,handler){events.set(type,handler)}};
const context={Ink,state,PAGE_W:816,PAGE_H:1056,performance:{now:()=>clock},
  clamp:(n,a,b)=>Math.max(a,Math.min(b,n)),uid:()=>String(nextFrame++),
  document:{querySelector:()=>null},curPage:()=>page,
  area:{scrollTop:0,scrollLeft:0,scrollHeight:1056,clientHeight:1056,getBoundingClientRect:()=>({bottom:1000})},
  saveHistory(){},drawPage(){},setUndoButtons(){},markChanged(){changes++},
  requestAnimationFrame(callback){const id=++nextFrame;frames.set(id,callback);return id},
  cancelAnimationFrame(id){frames.delete(id)}};
vm.createContext(context);vm.runInContext(source.slice(start,end),context);context.bindDrawing(canvas,0);
function send(type,overrides={}){
  clock+=10;
  events.get(type)({type,pointerId:1,isPrimary:true,pointerType:'pen',button:0,clientX:100,clientY:100,pressure:.8,tiltX:10,tiltY:20,timeStamp:clock,...overrides});
}
function frame(){clock+=16;const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn(clock))}

send('pointerdown');const active=state.gesture;
for(let i=1;i<=100;i++){
  send('pointermove',{clientX:100+i*.01,getCoalescedEvents:()=>[
    {pointerType:'pen',clientX:100+(i-.5)*.01,clientY:100,pressure:.8,tiltX:10,tiltY:20,timeStamp:clock-1}
  ]});frame();
}
assert(active.points.length>50,'slow, coalesced input must be retained as editable samples');
assert(active.visible.at(-1).x>100,'stabilized ink must advance for fractional movements');
send('pointerdown',{pointerId:2,pointerType:'touch'});
assert.equal(state.gesture,active,'a palm or second pointer must not discard active ink');
send('pointerup',{pointerId:2});assert.equal(state.gesture,active);
send('pointercancel',{pointerId:2});assert.equal(state.gesture,active);
send('lostpointercapture',{pointerId:2});assert.equal(state.gesture,active);
send('lostpointercapture');
assert.equal(state.gesture,null,'lost capture must finish the active stroke');
assert.equal(page.items.length,1,'captured ink must survive an interruption');
assert.equal(frames.size,0,'finishing must cancel the delayed animation');
send('pointerup');assert.equal(page.items.length,1,'a late pointerup must not duplicate a stroke');

send('pointerdown',{pointerId:3,isPrimary:false});assert.equal(state.gesture,null);
send('pointerdown',{pointerId:3});
send('pointermove',{pointerId:3,clientX:102,pressure:.8});
send('pointerup',{pointerId:3,clientX:103,pressure:0});
assert.equal(page.items.length,2);
assert.equal(page.items[1].points.at(-1).x,103,'pen lift must preserve the final position');
assert.equal(page.items[1].points.at(-1).p,.8,'zero release pressure must not insert an unrelated width');
assert(!('t' in page.items[1].points[0]),'animation timestamps must not leak into saved note geometry');
send('pointerdown',{pointerId:4});send('pointercancel',{pointerId:4});
assert.equal(page.items.length,3,'pointer cancellation must preserve the partial stroke');
assert.equal(changes,3);
console.log('Slow coalesced input, pointer isolation, capture loss and pen-lift tests pass.');
