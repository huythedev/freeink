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
  assert.equal(ink.visibleSamples(pen.points,30).length,2,'visible tip should interpolate smoothly behind the pen');
  assert.equal(ink.visibleSamples(pen.points,30).at(-1).x,13,'delayed pen tip must move between real samples');
  assert.equal(ink.visibleSamples(pen.points,70).length,4,'delayed samples catch up');
  assert.equal(ink.widthAt(pen.points,2,pen)>ink.widthAt(pen.points,0,pen),true,'stylus pressure must change ink width');
  const tilted=pen.points.map(p=>({...p,tx:0,ty:75}));
  assert(ink.widthAt(tilted,1,pen)>ink.widthAt(pen.points,1,pen),'perpendicular tilt must affect nib width');
  const o=ink.outline(pen.points,pen);assert.equal(o.left.length,pen.points.length);
  const p=[];assert(ink.appendSample(p,{x:10,y:10,p:.5}));assert.equal(ink.appendSample(p,{x:10,y:10,p:.5}),false);
  // Slow handwriting can contain hundreds of fractional movements, repeated
  // pressure-only events, and brief direction reversals. It must never split.
  const slow=[];
  for(let i=0;i<45;i++){
    slow.push({x:50+i*.075,y:82+Math.sin(i*.37)*.18,p:.3+(i%4)*.14,tx:15,ty:25,t:i*11});
  }
  slow.push({x:53.3,y:82.2,p:.8,t:502},{x:53.3,y:82.2,p:.2,t:513});
  slow.push({x:53.0,y:81.9,p:.8,t:530});
  const delayedA=ink.visibleSamples(slow,210,ink.STABILIZATION_MS);
  const delayedB=ink.visibleSamples(slow,215,ink.STABILIZATION_MS);
  assert(delayedB.at(-1).t>=delayedA.at(-1).t,'stabilized tip should progress over time');
  assert.notDeepEqual(delayedA.at(-1),delayedB.at(-1),'tip must animate without needing new pointer events');
  const slowOutline=ink.outline(slow,pen);
  assert.equal(slowOutline.points.length,slow.length);
  assert(slowOutline.segments.length>=slow.length-3,'even near-zero-motion samples should connect');
  assert(slowOutline.segments.every(q=>q.length===4&&q.every(v=>Number.isFinite(v.x)&&Number.isFinite(v.y))));
  for(let i=1;i<slow.length;i++){
    const gap=Math.hypot(slow[i].x-slow[i-1].x,slow[i].y-slow[i-1].y);
    if(gap>1e-5)assert(slowOutline.segments.length>0);
  }
  // One fill for all compound path segments prevents seams and alpha bands.
  const commands={fills:0,quads:0,arcs:0};
  const context={save(){},restore(){},beginPath(){},moveTo(){},lineTo(){commands.quads++},closePath(){},arc(){commands.arcs++},fill(){commands.fills++}};
  ink.drawCanvas(context,slow,{...pen,tool:'highlighter'});
  assert.equal(commands.fills,1,'all stroke joints must be filled in one operation');
  assert.equal(commands.arcs,slow.length,'every sample must have a round join');
  const slowPdf=await PDF.createVectorPdf([{template:'blank',items:[{...pen,points:slow}]}]);
  const pdfStream=Buffer.from(await slowPdf.arrayBuffer()).toString('latin1');
  assert.equal((pdfStream.match(/f Q\n/g)||[]).length,1,'PDF uses one unified stroke fill');
  assert(!pdfStream.includes('/Subtype /Image'),'PDF slow ink must stay vector');

  const bytes=await PDF.createVectorPdf([{template:'blank',items:[pen]}]);
  const str=Buffer.from(await bytes.arrayBuffer()).toString('latin1');
  assert(str.includes('f Q\n'), 'new ink must use vector-filled outline paths');
  assert(!str.includes('/Subtype /Image'),'ink must not be rasterized');
  console.log('Stabilization, pressure/tilt and vector-outline PDF tests pass.');
})().catch(e=>{console.error(e);process.exitCode=1});
