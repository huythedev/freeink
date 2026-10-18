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
  const PATH_BATCH_SIZE=64;
  // Geometry is spaced in page units, not event counts. A slow digitizer can
  // report thousands of samples in one pixel; keep those raw samples for
  // editing, but do not feed thousands of overlapping contours to the rasterizer.
  function geometryPoints(raw,stroke){
    const spacing=clamp((Number(stroke.width)||3)*.12,.2,.6),points=[];
    let tip=null;
    for(const sample of raw||[]){
      if(!sample||!Number.isFinite(sample.x)||!Number.isFinite(sample.y))continue;
      tip=sample;
      const last=points[points.length-1];
      if(!last||Math.hypot(sample.x-last.x,sample.y-last.y)>=spacing){points.push({...sample});continue}
      // Pressure-only samples at rest must retain the widest impression.
      if((sample.p??.5)>(last.p??.5))last.p=sample.p;
    }
    const last=points[points.length-1];
    if(last&&tip&&(tip.x!==last.x||tip.y!==last.y))points.push({...tip});
    return points;
  }
  function appendSample(points,point) {
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return false;
    const prev=points[points.length-1];
    if (prev && point.x===prev.x && point.y===prev.y &&
        (point.p??.5)===(prev.p??.5) && (point.tx??0)===(prev.tx??0) &&
        (point.ty??0)===(prev.ty??0) && (point.twist??0)===(prev.twist??0)) return false;
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
    const points=smoothPoints(geometryPoints(raw,stroke));
    if(!points.length)return {points:[],left:[],right:[],radii:[],segments:[]};
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
  // Accumulate bounded paths opaquely, then apply stroke opacity once. This
  // avoids both dense compound-path winding limits and dark marker overlaps.
  let surface=null,surfaceUsedW=0,surfaceUsedH=0,maskSurface=null;
  function drawCanvas(ctx,raw,stroke){
    const o=outline(raw,stroke);if(!o.points.length)return;
    const m=ctx.getTransform();
    let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
    for(let i=0;i<o.points.length;i++){
      const p=o.points[i],r=o.radii[i];
      left=Math.min(left,p.x-r);top=Math.min(top,p.y-r);
      right=Math.max(right,p.x+r);bottom=Math.max(bottom,p.y+r);
    }
    const corners=[[left,top],[right,top],[left,bottom],[right,bottom]].map(([x,y])=>({x:m.a*x+m.c*y+m.e,y:m.b*x+m.d*y+m.f}));
    const x=Math.max(0,Math.floor(Math.min(...corners.map(p=>p.x)))-2);
    const y=Math.max(0,Math.floor(Math.min(...corners.map(p=>p.y)))-2);
    const w=Math.min(ctx.canvas.width,Math.ceil(Math.max(...corners.map(p=>p.x)))+2)-x;
    const h=Math.min(ctx.canvas.height,Math.ceil(Math.max(...corners.map(p=>p.y)))+2)-y;
    if(w<=0||h<=0)return;
    if(!surface){
      if(typeof OffscreenCanvas!=='undefined')surface=new OffscreenCanvas(w,h);
      else if(ctx.canvas.ownerDocument)surface=ctx.canvas.ownerDocument.createElement('canvas');
      else throw Error('An offscreen canvas is required to render ink');
    }
    // Reuse a single surface, growing in blocks instead of allocating per sample.
    if(surface.width<w)surface.width=Math.ceil(w/64)*64;
    if(surface.height<h)surface.height=Math.ceil(h/64)*64;
    const paint=surface.getContext('2d');
    paint.setTransform(1,0,0,1,0,0);paint.clearRect(0,0,Math.max(surfaceUsedW,w),Math.max(surfaceUsedH,h));surfaceUsedW=w;surfaceUsedH=h;
    paint.setTransform(m.a,m.b,m.c,m.d,m.e-x,m.f-y);
    paint.globalAlpha=1;paint.fillStyle=stroke.color||'#262e3a';
    let parts=0;paint.beginPath();
    const added=()=>{if(++parts===PATH_BATCH_SIZE){paint.fill();paint.beginPath();parts=0}};
    for(const quad of o.segments){
      paint.moveTo(quad[0].x,quad[0].y);
      for(let i=1;i<4;i++)paint.lineTo(quad[i].x,quad[i].y);
      paint.closePath();added();
    }
    for(let i=0;i<o.points.length;i++){
      const pt=o.points[i];paint.moveTo(pt.x+o.radii[i],pt.y);
      paint.arc(pt.x,pt.y,o.radii[i],0,Math.PI*2);
      paint.closePath();added();
    }
    if(parts)paint.fill();
    ctx.save();ctx.setTransform(1,0,0,1,0,0);
    ctx.globalAlpha*=stroke.tool==='highlighter'?.28:stroke.tool==='pencil'?.72:1;
    ctx.drawImage(surface,0,0,w,h,x,y,w,h);ctx.restore();
  }
  function eraseCanvas(ctx,points,width){
    ctx.save();ctx.globalCompositeOperation='destination-out';ctx.globalAlpha=1;
    drawCanvas(ctx,points.map(p=>({x:p.x,y:p.y,p:.5})),{tool:'pen',width,color:'#000000'});ctx.restore();
  }
  function drawMasked(ctx,masks,draw,bounds){
    const m=ctx.getTransform(),corners=[[bounds.x,bounds.y],[bounds.x+bounds.w,bounds.y],[bounds.x,bounds.y+bounds.h],[bounds.x+bounds.w,bounds.y+bounds.h]].map(([x,y])=>({x:m.a*x+m.c*y+m.e,y:m.b*x+m.d*y+m.f}));
    const x=Math.max(0,Math.floor(Math.min(...corners.map(p=>p.x)))-2),y=Math.max(0,Math.floor(Math.min(...corners.map(p=>p.y)))-2);
    const w=Math.min(ctx.canvas.width,Math.ceil(Math.max(...corners.map(p=>p.x)))+2)-x,h=Math.min(ctx.canvas.height,Math.ceil(Math.max(...corners.map(p=>p.y)))+2)-y;
    if(w<=0||h<=0)return;
    if(!maskSurface){if(typeof OffscreenCanvas!=='undefined')maskSurface=new OffscreenCanvas(w,h);else maskSurface=ctx.canvas.ownerDocument.createElement('canvas')}
    if(maskSurface.width<w)maskSurface.width=Math.ceil(w/64)*64;if(maskSurface.height<h)maskSurface.height=Math.ceil(h/64)*64;
    const paint=maskSurface.getContext('2d');paint.setTransform(1,0,0,1,0,0);paint.clearRect(0,0,maskSurface.width,maskSurface.height);paint.setTransform(m.a,m.b,m.c,m.d,m.e-x,m.f-y);
    draw(paint);for(const mask of masks)eraseCanvas(paint,mask.points,mask.width);
    ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.drawImage(maskSurface,0,0,w,h,x,y,w,h);ctx.restore();
  }
  function releaseBuffers(){if(surface)surface.width=surface.height=1;if(maskSurface)maskSurface.width=maskSurface.height=1;surfaceUsedW=surfaceUsedH=0}
  return {STABILIZATION_MS,PATH_BATCH_SIZE,appendSample,visibleSamples,smoothPoints,widthAt,outline,drawCanvas,eraseCanvas,drawMasked,releaseBuffers};
});

