/* FreeInk's platform-neutral stabilized ink geometry. No network or dependencies.
 * Keeps raw samples for editable notes and builds the same vector outline for
 * live canvas rendering and PDF export. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.FreeInkInk = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  const STABILIZATION_MS=24;
  function appendSample(points,point) {
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return false;
    const prev=points[points.length-1];
    if (prev && Math.hypot(point.x-prev.x,point.y-prev.y)<.18 &&
        Math.abs((point.p??.5)-(prev.p??.5))<.04 &&
        Math.abs((point.tx??0)-(prev.tx??0))<2 &&
        Math.abs((point.ty??0)-(prev.ty??0))<2) return false;
    points.push(point);return true;
  }
  function visibleSamples(points,now,delay=STABILIZATION_MS) {
    if (!delay) return points;
    const end=now-delay;
    let i=0;
    while(i<points.length&&(points[i].t??0)<=end)i++;
    return points.slice(0,i);
  }
  function smoothPoints(points){
    if(!Array.isArray(points)||points.length<3)return points||[];
    const out=points.map(x=>({...x}));
    // Keep endpoints and sharp corners. A short three-sample low-pass
    // reduces jitter without displacing deliberate letter corners.
    for(let i=1;i<points.length-1;i++){
      const a=points[i-1],b=points[i],c=points[i+1];
      const ab=Math.hypot(b.x-a.x,b.y-a.y),bc=Math.hypot(c.x-b.x,c.y-b.y);
      if(ab>12||bc>12||ab<.05||bc<.05)continue;
      const dot=((b.x-a.x)*(c.x-b.x)+(b.y-a.y)*(c.y-b.y))/(ab*bc);
      if(dot<.45)continue;
      out[i].x=(a.x+2*b.x+c.x)/4;
      out[i].y=(a.y+2*b.y+c.y)/4;
      out[i].p=clamp(((a.p??.5)+2*(b.p??.5)+(c.p??.5))/4,.03,1);
    }
    return out;
  }
  function widthAt(points,index,stroke){
    const pt=points[index],base=Number(stroke.width)||3;
    const pressure=clamp(Number.isFinite(pt.p)?pt.p:.5,.03,1);
    if(stroke.tool==='highlighter')return base*5;
    const pFactor=stroke.tool==='pencil'?.42+pressure*1.16:.5+pressure;
    const tx=clamp(Number(pt.tx)||0,-90,90),ty=clamp(Number(pt.ty)||0,-90,90);
    const magnitude=clamp(Math.hypot(tx,ty)/90,0,1);
    let cross=0;
    if(magnitude>.001&&points.length>1){
      const before=points[Math.max(0,index-1)],after=points[Math.min(points.length-1,index+1)];
      const angle=Math.atan2(after.y-before.y,after.x-before.x);
      cross=Math.abs(Math.sin(angle-Math.atan2(ty,tx)));
    }
    const tiltFactor=1+(stroke.tool==='pencil'?.58:.28)*magnitude*cross;
    return clamp(base*pFactor*tiltFactor,base*.18,base*2.2);
  }
  function outline(raw,stroke){
    const points=smoothPoints(raw||[]);
    if(!points.length)return {points:[],left:[],right:[],radii:[]};
    const left=[],right=[],radii=[];
    for(let i=0;i<points.length;i++){
      const p=points[i],a=points[Math.max(0,i-1)],b=points[Math.min(i+1,points.length-1)];
      const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1;
      const nx=-dy/len,ny=dx/len,r=widthAt(points,i,stroke)/2;
      left.push({x:p.x+nx*r,y:p.y+ny*r});right.push({x:p.x-nx*r,y:p.y-ny*r});radii.push(r);
    }
    return {points,left,right,radii};
  }
  function drawCanvas(ctx,raw,stroke){
    const o=outline(raw,stroke);if(!o.points.length)return;
    ctx.save();ctx.globalAlpha=stroke.tool==='highlighter'?.28:stroke.tool==='pencil'?.72:1;
    ctx.fillStyle=stroke.color||'#262e3a';
    if(o.points.length>1){
      ctx.beginPath();ctx.moveTo(o.left[0].x,o.left[0].y);
      for(let i=1;i<o.left.length;i++)ctx.lineTo(o.left[i].x,o.left[i].y);
      for(let i=o.right.length-1;i>=0;i--)ctx.lineTo(o.right[i].x,o.right[i].y);
      ctx.closePath();ctx.fill();
    }
    for(const i of o.points.length===1?[0]:[0,o.points.length-1]){
      ctx.beginPath();ctx.arc(o.points[i].x,o.points[i].y,o.radii[i],0,Math.PI*2);ctx.fill();
    }
    ctx.restore();
  }
  return {STABILIZATION_MS,appendSample,visibleSamples,smoothPoints,widthAt,outline,drawCanvas};
});
