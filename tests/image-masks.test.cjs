'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm');
const {createCanvas,loadImage}=require('@napi-rs/canvas'),Images=require('../image-tools'),Runtime=require('../runtime'),Ink=require('../ink-engine'),{createVectorPdf}=require('../vector-pdf');
global.OffscreenCanvas=class{constructor(w,h){return createCanvas(w,h)}};
(async()=>{
 const raster=createCanvas(20,10),paint=raster.getContext('2d');paint.fillStyle='#00aa00';paint.fillRect(0,0,20,10);
 const src=raster.toDataURL('image/png'),native=await loadImage(src),imageCache=new Runtime.LruCache();imageCache.set(src,{image:native});
 const source=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8'),c={Ink,Runtime,imageCache,performance,document:{createElement:()=>createCanvas(1,1)}};
 vm.createContext(c);vm.runInContext(source.slice(source.indexOf('function smoothStroke('),source.indexOf('function drawSelection(')),c);
 const original={kind:'image',src,x:100,y:200,w:200,h:100,erasures:[{width:20,points:[{x:150,y:250}]}]},snapshot=Runtime.snapshotPages([{items:[original]}]);
 const stretched=Images.transformImage(Runtime.writableItem(original),{x:200,y:400,w:400,h:50});
 assert.equal(stretched.erasures[0].aspect,.25);assert.equal(original.erasures[0].width,20);assert.equal(snapshot[0].items[0].erasures[0].aspect,undefined,'stretching must not mutate undo masks');
 const render=(item,scale=1)=>{const canvas=createCanvas(816*scale,1056*scale),ctx=canvas.getContext('2d');ctx.scale(scale,scale);c.drawItem(ctx,item,0);ctx.globalCompositeOperation='destination-over';ctx.fillStyle='white';ctx.fillRect(0,0,816,1056);return canvas};
 const pixel=(canvas,x,y,scale=1)=>Array.from(canvas.getContext('2d').getImageData(x*scale,y*scale,1,1).data).slice(0,3);
 for(const scale of [1,2]){
  const canvas=render(stretched,scale);assert.deepEqual(pixel(canvas,300,425,scale),[255,255,255]);assert.deepEqual(pixel(canvas,315,425,scale),[255,255,255],'a stretched eraser dot widens with the photo');
  assert.deepEqual(pixel(canvas,300,433,scale),[0,170,0],'the same dot must shrink vertically with the photo');assert.deepEqual(pixel(canvas,327,425,scale),[0,170,0]);
 }
 const masked=Runtime.eraseItems([stretched],{width:12,points:[{x:550,y:425}]},item=>item).items[0],canvas=render(masked);
 assert.deepEqual(pixel(canvas,550,425),[255,255,255]);assert.deepEqual(pixel(canvas,559,425),[0,170,0]);assert.deepEqual(pixel(canvas,550,434),[0,170,0],'new erasing must remain circular after a stretch');
 const note=Runtime.validateNote(JSON.parse(JSON.stringify({pages:[{template:'blank',items:[masked]}]}))),restored=render(note.pages[0].items[0]);
 assert.equal(Buffer.compare(canvas.toBuffer('image/png'),restored.toBuffer('image/png')),0,'editable backups must preserve elliptical masks exactly');
 assert.throws(()=>Runtime.validateNote({pages:[{items:[{...original,erasures:[{width:10,points:[{x:1,y:1}],aspect:Infinity}]}]}]}),/coordinates/);
 const pdf=await createVectorPdf(note.pages,{images:async()=>({bytes:raster.toBuffer('image/jpeg'),w:20,h:10})}),bytes=Buffer.from(await pdf.arrayBuffer());
 assert.match(bytes.toString('latin1'),/q 1 0 0 0\.250000000000 0 0 cm/);assert.match(bytes.toString('latin1'),/\/SMask/);
 const dir=path.join(os.tmpdir(),'freeink-image-masks');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'stretched.pdf'),bytes);fs.writeFileSync(path.join(dir,'canvas.png'),canvas.toBuffer('image/png'));
 Ink.releaseBuffers();console.log('Image masks: real Skia pixels, independent stretching, circular new erasing, immutable undo, editable backup and vector PDF masks pass.');
})().catch(e=>{console.error(e);process.exitCode=1});
