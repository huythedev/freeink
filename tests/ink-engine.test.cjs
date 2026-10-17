'use strict';
const assert=require('node:assert/strict');
const ink=require('../ink-engine.js');
const PDF=require('../vector-pdf.js');
(async()=>{
  const pen={kind:'stroke',inkVersion:2,tool:'pen',color:'#397cda',width:5,points:[
    {x:10,y:10,p:.1,tx:0,ty:0,t:0},
    {x:15,y:10,p:.4,tx:0,ty:0,t:10},
    {x:20,y:10,p:.9,tx:0,ty:0,t:20},
    {x:26,y:10,p:.8,tx:0,ty:0,t:40}
  ]};
  assert.equal(ink.STABILIZATION_MS,24);
  assert.equal(ink.visibleSamples(pen.points,30).length,1,'moving pen should have a short delayed trail');
  assert.equal(ink.visibleSamples(pen.points,70).length,4,'delayed samples catch up');
  assert.equal(ink.widthAt(pen.points,2,pen)>ink.widthAt(pen.points,0,pen),true,'stylus pressure must change ink width');
  const tilted=pen.points.map(p=>({...p,tx:0,ty:75}));
  assert(ink.widthAt(tilted,1,pen)>ink.widthAt(pen.points,1,pen),'perpendicular tilt must affect nib width');
  const o=ink.outline(pen.points,pen);assert.equal(o.left.length,pen.points.length);
  const p=[];assert(ink.appendSample(p,{x:10,y:10,p:.5}));assert.equal(ink.appendSample(p,{x:10,y:10,p:.5}),false);
  const bytes=await PDF.createVectorPdf([{template:'blank',items:[pen]}]);
  const str=Buffer.from(await bytes.arrayBuffer()).toString('latin1');
  assert(str.includes('h f\n'),'new ink must use vector-filled outline paths');
  assert(!str.includes('/Subtype /Image'),'ink must not be rasterized');
  console.log('Stabilization, pressure/tilt and vector-outline PDF tests pass.');
})().catch(e=>{console.error(e);process.exitCode=1});
