'use strict';
const assert=require('node:assert/strict');
const R=require('../runtime');
const points=Array.from({length:200000},(_,i)=>({x:i/250,y:50,p:.5}));
const item={id:'ink',kind:'stroke',width:3,points};
const pages=[{id:'page',template:'ruled',items:[item]}];
const snapshot=R.snapshotPages(pages);
assert.equal(snapshot[0].items[0],item);
assert.equal(snapshot[0].items[0].points,points,'history must not copy unchanged samples');
const editable=R.writableItem(item);editable.points[0].x=100;
assert.equal(points[0].x,0,'moving a stroke must not mutate undo history');
assert(R.strokeBounds(item).w>799,'long strokes must not overflow the argument stack');
for(let n=0;n<200;n++){
  const range=R.pageWindow({count:200,scrollTop:n*1082,height:800,pageHeight:1056});
  assert(range.end-range.start<5,'canvas allocation must depend on viewport, not notebook length');
  assert(range.current>=0&&range.current<200);
}
const mask={width:20,points:[{x:20,y:50},{x:40,y:50}]};
const erased=R.eraseItems([item,{kind:'image',x:0,y:500,w:10,h:10}],mask,it=>it===item?R.strokeBounds(it):it);
assert(erased.changed);assert.equal(erased.items[0].erasures[0],mask);assert.equal(item.erasures,undefined);
assert.equal(erased.items[1].erasures,undefined,'distant objects must not gain masks');
const moved=R.writableItem(erased.items[0]);R.translateErasures(moved,10,5);R.scaleErasures(moved,2,0,0);
assert.deepEqual(moved.erasures[0].points[0],{x:60,y:110});assert.equal(mask.points[0].x,20);
let serial=0;const duplicate=R.duplicatePage(pages[0],()=>String(++serial));
assert.notEqual(duplicate.id,pages[0].id);assert.notEqual(duplicate.items[0].id,item.id);
const cache=new R.LruCache({maxEntries:2,maxWeight:20});cache.set('a',1,8);cache.set('b',2,8);cache.get('a');cache.set('c',3,8);
assert.equal(cache.get('b'),undefined);assert.equal(cache.weight,16);
cache.set('large',4,50);assert.equal(cache.entries.size,1);cache.clear();assert.equal(cache.weight,0);
assert.deepEqual(R.fittedImage(10000,10000),{w:2000,h:2000});
assert(R.fittedImage(12000,1000).w<=4096);
const note=R.validateNote({note:{pages:[{items:[{...item,points:points.slice(0,2),erasures:[mask]}]}]}});
assert.deepEqual(note.pages[0].items[0].erasures,[mask]);
assert.throws(()=>R.validateNote({pages:[{items:[{kind:'image',src:'https://example.com/a.png',x:0,y:0,w:10,h:10}]}]}),/embedded/);
assert.throws(()=>R.validateNote({pages:[{items:[{...item,points:[{x:Infinity,y:0}]}]}]}),/coordinates/);
assert.throws(()=>R.validateNote({pages:[{items:[{kind:'text',text:'a'.repeat(250001)}]}]}),/text/);
function zip(expanded){const bytes=new ArrayBuffer(68),v=new DataView(bytes);v.setUint32(0,0x02014b50,true);v.setUint32(24,expanded,true);v.setUint32(46,0x06054b50,true);v.setUint16(56,1,true);return bytes}
R.checkDocxZip(zip(100));assert.throws(()=>R.checkDocxZip(zip(101*1024*1024)),/100 MB/);
const abort=new AbortController();abort.abort();assert.throws(()=>R.checkAbort(abort.signal),{name:'AbortError'});
console.log('Runtime: viewport limits, shared history, long strokes, pixel masks, resource budgets and cancellation pass.');
