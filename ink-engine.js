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
    if (prev && Math.hypot(point.x-prev.x,point.y-prev.y)<.045 &&
        Math.abs((point.p??.5)-(prev.p??.5))<.04 &&
        Math.abs((point.tx??0)-(prev.tx??0))<2 &&
        Math.abs((point.ty??0)-(prev.ty??0))<2) return false;
    points.push(point);return true;
  }
  // Display an interpolated delayed tip; otherwise slow movements jump as
  // old samples become eligible, causing staccato or fragmented ink.
  function visibleSamples(points,now,delay=STABILIZATION_MS){
    if(!points?.length)return [];
    if(!delay)return points;
    const end=now-delay;
    if(end<(points[0].t??0))return [points[0]];
    let i=0;
    while(i<points.length&&(points[i].t??0)<=end)i++;
    if(i>=points.length)return points.slice();
    const result=points.slice(0,i),a=points[i-1],b=points[i];
    const span=(b.t??0)-(a.t??0);
    if(span>0){
      const w=clamp((end-(a.t??0))/span,0,1);
      if(w>0&&w<1){
        result.push({...a,x:a.x+(b.x-a.x)*w,y:a.y+(b.y-a.y)*w,
          p:(a.p??.5)+((b.p??.5)-(a.p??.5))*w,
          tx:(a.tx??0)+((b.tx??0)-(a.tx??0))*w,
          ty:(a.ty??0)+((b.ty??0)-(a.ty??0))*w,
          twist:(a.twist??0)+((b.twist??0)-(a.twist??0))*w,t:end});
      }
    }
    return result;
  }
  function smoothPoints(points){
    if(!Array.isArray(points)||points.length<3)return points||[];
    const out=points.map(x=>({...x}));
    // Keep endpoints and sharp corners. The short three-sample low-pass rejects
    // digitizer jitter without displacing deliberate letter corners.
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
    if(stroke.tool==='highlighter')return base*5; // Fixed broad marker nib.
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
    const left=[],right=[],radii=[],segments=[];
    for(let i=0;i<points.length;i++){
      const pt=points[i],prev=points[Math.max(0,i-1)],next=points[Math.min(i+1,points.length-1)];
      const dx=next.x-prev.x,dy=next.y-prev.y,len=Math.hypot(dx,dy)||1;
      const nx=-dy/len,ny=dx/len,r=widthAt(points,i,stroke)/2;
      left.push({x:pt.x+nx*r,y:pt.y+ny*r});
      right.push({x:pt.x-nx*r,y:pt.y-ny*r});radii.push(r);
    }
    for(let i=1;i<points.length;i++){
      const a=points[i-1],b=points[i],dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);
      if(len<1e-5)continue; // Avoid degenerate polygons at stationary pressure samples.
      const nx=-dy/len,ny=dx/len,r0=radii[i-1],r1=radii[i];
      // Independent quads cannot self-intersect when a slow stroke reverses.
      segments.push([
        {x:a.x+nx*r0,y:a.y+ny*r0},
        {x:a.x-nx*r0,y:a.y-ny*r0},
        {x:b.x-nx*r1,y:b.y-ny*r1},
        {x:b.x+nx*r1,y:b.y+ny*r1}
      ]);
    }
    return {points,left,right,radii,segments};
  }
  function drawCanvas(ctx,raw,stroke){
    const o=outline(raw,stroke);if(!o.points.length)return;
    ctx.save();ctx.globalAlpha=stroke.tool==='highlighter'?.28:stroke.tool==='pencil'?.72:1;
    ctx.fillStyle=stroke.color||'#262e3a';
    // Fill joined segments and circular joints together, once. One alpha
    // operation avoids transparent highlighter seams and broken slow strokes.
    ctx.beginPath();
    for(const quad of o.segments){
      ctx.moveTo(quad[0].x,quad[0].y);
      for(let i=1;i<4;i++)ctx.lineTo(quad[i].x,quad[i].y);
      ctx.closePath();
    }
    for(let i=0;i<o.points.length;i++){
      const pt=o.points[i];ctx.moveTo(pt.x+o.radii[i],pt.y);
      ctx.arc(pt.x,pt.y,o.radii[i],0,Math.PI*2);
      ctx.closePath();
    }
    ctx.fill();ctx.restore();
  }
  return {STABILIZATION_MS,appendSample,visibleSamples,smoothPoints,widthAt,outline,drawCanvas};
});
