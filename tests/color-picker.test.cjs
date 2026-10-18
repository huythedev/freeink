'use strict';
const assert=require('node:assert/strict');
const {normalizeHex,hsvToHex,hexToHsv,createPicker}=require('../color-picker');

assert.equal(normalizeHex(' #AbC '),'#aabbcc');assert.equal(normalizeHex('123456'),'#123456');
for(const value of ['#12','1234567','#gg0000','rgb(1,2,3)',null])assert.equal(normalizeHex(value),null);
for(const [h,hex] of [[0,'#ff0000'],[60,'#ffff00'],[120,'#00ff00'],[180,'#00ffff'],[240,'#0000ff'],[300,'#ff00ff'],[360,'#ff0000'],[-60,'#ff00ff']])assert.equal(hsvToHex(h,1,1),hex);
assert.equal(hsvToHex(10,0,.5),'#808080');assert.equal(hsvToHex(10,2,-1),'#000000');
assert.equal(hexToHsv('#808080',210).h,210,'gray must retain the hue so the next saturation drag is predictable');
for(let rgb=0;rgb<=0xffffff;rgb+=15437){const hex='#'+rgb.toString(16).padStart(6,'0'),hsv=hexToHsv(hex);assert.equal(hsvToHex(hsv.h,hsv.s,hsv.v),hex)}

// Exercise actual control handlers with deterministic frames, including a drag
// that ends/cancels before the next frame. No browser dependency is needed in CI.
class Element{
 constructor(tag){this.tagName=tag;this.children=[];this.attributes={};this.events={};this.style={setProperty(k,v){this[k]=v}};this.pointers=new Set()}
 append(...children){this.children.push(...children)}
 setAttribute(k,v){this.attributes[k]=v}removeAttribute(k){delete this.attributes[k]}
 addEventListener(type,fn){(this.events[type]??=[]).push(fn)}
 focus(){this.focused=true}getBoundingClientRect(){return {left:10,top:20,width:100,height:100}}
 setPointerCapture(id){this.pointers.add(id)}hasPointerCapture(id){return this.pointers.has(id)}releasePointerCapture(id){this.pointers.delete(id)}
 send(type,values={}){const event={type,preventDefault(){},stopPropagation(){},...values};for(const fn of this.events[type]||[])fn(event)}
}
const doc={createElement:tag=>new Element(tag)},frames=new Map();let nextFrame=0;
global.requestAnimationFrame=fn=>{const id=++nextFrame;frames.set(id,fn);return id};global.cancelAnimationFrame=id=>frames.delete(id);
const tick=()=>{const callbacks=[...frames.values()];frames.clear();callbacks.forEach(fn=>fn())};
const changes=[];let closed=0;
const picker=createPicker({color:'#ff0000',onChange:value=>changes.push(value),onClose:()=>closed++,document:doc});
const [,field,hueLabel,row]=picker.element.children,hue=hueLabel.children[0],hex=row.children[1].children[0];
const down={pointerId:1,pointerType:'mouse',button:0,clientX:110,clientY:20};
field.send('pointerdown',{...down,button:2});assert.equal(field.pointers.size,0,'right-click must not select a color');
field.send('pointerdown',down);assert.equal(changes.length,0,'unchanged colors must not activate another tool');
for(let y=21;y<=70;y++)field.send('pointermove',{...down,clientY:y});
assert.equal(changes.length,0);assert.equal(frames.size,1,'drag input must publish at most once per animation frame');tick();assert.equal(changes.at(-1),'#800000');
field.send('pointermove',{...down,clientY:75});field.send('pointerup',{...down,clientY:80});
assert.equal(changes.at(-1),'#660000','pointer-up must publish the final sample');assert.equal(frames.size,0);assert.equal(field.pointers.size,0);
field.send('pointermove',{...down,clientY:20});tick();assert.equal(changes.at(-1),'#660000','hover must not edit the color');
field.send('pointerdown',down);field.send('pointermove',{...down,clientX:-100,clientY:500});field.send('pointercancel',down);
assert.equal(changes.at(-1),'#000000','cancel must finish the last captured, clamped sample');assert.equal(field.pointers.size,0);
field.send('pointerdown',down);field.send('pointermove',{...down,clientX:60,clientY:20});field.send('lostpointercapture',down);assert.equal(changes.at(-1),'#ff8080');
hue.value='240';hue.send('input');hue.send('change');assert.equal(changes.at(-1),'#8080ff');assert.equal(frames.size,0);
field.send('keydown',{key:'ArrowDown',shiftKey:true});assert.equal(changes.at(-1),'#7373e6');
hex.value='#gg0000';hex.send('input');assert.equal(hex.attributes['aria-invalid'],'true');assert.equal(changes.at(-1),'#7373e6');
hex.value='#0af';hex.send('input');assert.equal(changes.at(-1),'#00aaff');hex.send('blur');assert.equal(hex.value,'#00aaff');
hex.send('keydown',{key:'Enter'});assert.equal(closed,1);
const count=changes.length;picker.destroy();picker.destroy();assert.equal(changes.length,count,'closing without a color change must not switch tools');
const next=createPicker({color:'#ff0000',onChange:value=>changes.push(value),onClose(){},document:doc});
next.element.children[2].children[0].value='120';next.element.children[2].children[0].send('input');next.destroy();
assert.equal(changes.at(-1),'#00ff00');assert.equal(frames.size,0,'closing must flush and cancel a pending color frame');
console.log('Color picker: HSV round trips, coalesced drag, final/cancelled samples, keyboard, hex validation and cleanup pass.');
