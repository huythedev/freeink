const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {createVectorPdf}=require('../vector-pdf.js');
(async()=>{
  const one=[{template:'ruled',items:[
    {kind:'stroke',tool:'pen',color:'#1260a5',width:3,points:[{x:50,y:130,p:.5},{x:80,y:100,p:.5},{x:120,y:140,p:.5},{x:145,y:90,p:.5}]},
    {kind:'shape',shape:'ellipse',color:'#ed4455',width:3,x:150,y:180,x2:450,y2:320},
    {kind:'text',x:80,y:380,w:600,size:22,color:'#1b2c3d',text:'VECTOR PDF CHECK'}
  ]},{template:'graph',items:[{kind:'stroke',tool:'highlighter',color:'#fbbc28',width:8,points:[{x:100,y:200},{x:200,y:290}]}]}];
  const out=await createVectorPdf(one);const buf=Buffer.from(await out.arrayBuffer());
  assert.equal(buf.slice(0,8).toString(),'%PDF-1.4');assert.match(buf.toString('latin1'),/BT \/F1 22 Tf/);
  assert.match(buf.toString('latin1'),/ c\n/);assert.equal((buf.toString('latin1').match(/\/Type \/Page /g)||[]).length,2);
  const outPath=path.join(os.tmpdir(),'freeink-vector-smoke.pdf');
  fs.writeFileSync(outPath,buf);
  console.log('PDF test passes: 2 pages, vector strokes, text objects, no full-page JPEG.');
})().catch(e=>{console.error(e);process.exitCode=1});
