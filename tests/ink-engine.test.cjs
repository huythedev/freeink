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
  assert(ink.appendSample(p,{x:10.001,y:10,p:.5}),'tiny valid movements must reach the delayed tip');
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
  assert(slowOutline.points.length<slow.length,'subpixel events should not create overlapping nibs for every event');
  assert.equal(slowOutline.points[0].x,slow[0].x);assert.equal(slowOutline.points[0].y,slow[0].y);
  assert.deepEqual(slowOutline.points.at(-1),slow.at(-1),'the final position must not be shortened');
  assert(slowOutline.segments.every(q=>q.length===4&&q.every(v=>Number.isFinite(v.x)&&Number.isFinite(v.y))));
  for(const sample of slow)assert(slowOutline.points.some((point,i)=>
    Math.hypot(sample.x-point.x,sample.y-point.y)<=slowOutline.radii[i]),
    'discarding redundant geometry must preserve ink coverage at every raw sample');
  const dense=Array.from({length:10000},(_,i)=>({x:50+10*i/9999,y:82+Math.sin(i*.3)*.05,p:.5}));
  const before=JSON.stringify(dense),denseOutline=ink.outline(dense,pen);
  assert(denseOutline.points.length<50,'geometry cost must follow distance, not the input event rate');
  assert.equal(JSON.stringify(dense),before,'raw editable samples must remain intact');
  const stationary=ink.outline([{x:50,y:82,p:.2},{x:50,y:82,p:.9},{x:50,y:82,p:.1}],pen);
  assert.equal(stationary.points.length,1,'pressure-only input must not stack duplicate circles');
  assert.equal(stationary.points[0].p,.9,'stationary pressure retains the widest dot');
  const commands={fills:[],arcs:0,composites:[],parts:0};
  const paint={globalAlpha:1,setTransform(){},clearRect(){},beginPath(){commands.parts=0},moveTo(){},lineTo(){},closePath(){commands.parts++},arc(){commands.arcs++},fill(){commands.fills.push(commands.parts);assert.equal(this.globalAlpha,1)}};
  global.OffscreenCanvas=class{constructor(w,h){this.width=w;this.height=h}getContext(){return paint}};
  const context={canvas:{width:300,height:200},globalAlpha:1,getTransform(){return {a:1,b:0,c:0,d:1,e:0,f:0}},save(){this.savedAlpha=this.globalAlpha},restore(){this.globalAlpha=this.savedAlpha},setTransform(){},drawImage(){commands.composites.push(this.globalAlpha)}};
  ink.drawCanvas(context,slow,{...pen,tool:'highlighter'});
  assert.deepEqual(commands.composites,[.28],'stroke opacity must be applied once after opaque accumulation');
  assert.equal(commands.arcs,slowOutline.points.length,'every geometric join must be round');
  const reversals=Array.from({length:600},(_,i)=>({x:50+(i%2)*30,y:82,p:.5}));
  ink.drawCanvas(context,reversals,pen);
  assert(commands.fills.length>1);
  assert(commands.fills.every(parts=>parts<=ink.PATH_BATCH_SIZE),'even repeated retracing must have bounded path overlap');
  assert.equal(context.globalAlpha,1,'rendering must restore the caller state');
  const slowPdf=await PDF.createVectorPdf([{template:'blank',items:[{...pen,points:slow}]}]);
  const pdfStream=Buffer.from(await slowPdf.arrayBuffer()).toString('latin1');
  assert.equal((pdfStream.match(/\/S \/Transparency/g)||[]).length,1,'PDF uses one isolated group per stroke');
  assert.match(pdfStream,/\/GS100 gs \/Ink0 Do Q/,'PDF composites the complete stroke once');
  assert(!pdfStream.includes('/Subtype /Image'),'PDF slow ink must stay vector');

  const bytes=await PDF.createVectorPdf([{template:'blank',items:[pen]}]);
  const str=Buffer.from(await bytes.arrayBuffer()).toString('latin1');
  assert(str.includes('/Subtype /Form')&&str.includes('f\nQ\n'), 'new ink must use vector-filled outline paths');
  assert(!str.includes('/Subtype /Image'),'ink must not be rasterized');
  console.log('Stabilization, pressure/tilt and vector-outline PDF tests pass.');
})().catch(e=>{console.error(e);process.exitCode=1});

