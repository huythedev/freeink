/* Geometry for direct image editing. Page coordinates, independent of UI zoom. */
(function(root,factory){const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;root.FreeInkImages=api})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
  const handles=[['nw',0,0,'Resize top left'],['n',.5,0,'Resize top'],['ne',1,0,'Resize top right'],['e',1,.5,'Resize right'],['se',1,1,'Resize bottom right'],['s',.5,1,'Resize bottom'],['sw',0,1,'Resize bottom left'],['w',0,.5,'Resize left']].map(([id,x,y,label])=>({id,x,y,label}));
  const sameBox=(a,b)=>['x','y','w','h'].every(key=>Math.abs(a[key]-b[key])<.00001);
  function moveBox(box,dx,dy,width=816,height=1056){return {x:clamp(box.x+dx,0,Math.max(0,width-box.w)),y:clamp(box.y+dy,0,Math.max(0,height-box.h)),w:box.w,h:box.h}}
  function resizeBox(box,handle,dx,dy,{width=816,height=1056,keepAspect=false,minSize=8}={}){
    const west=handle.includes('w'),east=handle.includes('e'),north=handle.includes('n'),south=handle.includes('s');
    const right=box.x+box.w,bottom=box.y+box.h,minW=Math.min(minSize,box.w),minH=Math.min(minSize,box.h);
    if(keepAspect){
      const sx=1+(west?-dx:dx)/box.w,sy=1+(north?-dy:dy)/box.h;
      const desired=handle.length===2?(Math.abs(sx-1)>Math.abs(sy-1)?sx:sy):west||east?sx:sy,cx=box.x+box.w/2,cy=box.y+box.h/2;
      const maxX=west?right/box.w:east?(width-box.x)/box.w:2*Math.min(cx,width-cx)/box.w,maxY=north?bottom/box.h:south?(height-box.y)/box.h:2*Math.min(cy,height-cy)/box.h;
      const scale=clamp(desired,Math.max(minW/box.w,minH/box.h),Math.min(maxX,maxY));
      const w=box.w*scale,h=box.h*scale;return {x:west?right-w:east?box.x:cx-w/2,y:north?bottom-h:south?box.y:cy-h/2,w,h};
    }
    const x=west?clamp(box.x+dx,0,right-minW):box.x,y=north?clamp(box.y+dy,0,bottom-minH):box.y;
    return {x,y,w:(east?clamp(right+dx,x+minW,width):right)-x,h:(south?clamp(bottom+dy,y+minH,height):bottom)-y};
  }
  function placeImage(size,view,{point=null,offset=0}={}){
    const scale=Math.min(1,640/size.w,750/size.h,Math.max(40,view.w*.85)/size.w,Math.max(40,view.h*.75)/size.h),w=Math.max(1,size.w*scale),h=Math.max(1,size.h*scale);
    const center=point||{x:view.x+view.w/2,y:view.y+view.h/2};
    return {x:clamp(center.x-w/2+offset,0,816-w),y:clamp(center.y-h/2+offset,0,1056-h),w,h};
  }
  function restoreProportions(box,ratio){
    const w=Math.max(1,Math.min(box.w,816,1056/ratio)),h=Math.max(1,Math.min(1056,w*ratio));
    return {x:clamp(box.x+(box.w-w)/2,0,816-w),y:clamp(box.y+(box.h-h)/2,0,1056-h),w,h};
  }
  // Points stay in page coordinates. Aspect records elliptical eraser footprints
  // after stretching, so old masks stay attached and new erasing stays circular.
  function transformImage(item,box){
    const sx=box.w/item.w,sy=box.h/item.h;
    for(const mask of item.erasures||[]){
      mask.width*=sx;const aspect=(mask.aspect||1)*sy/sx;
      if(Math.abs(aspect-1)<1e-10)delete mask.aspect;else mask.aspect=aspect;
      for(const p of mask.points){p.x=box.x+(p.x-item.x)*sx;p.y=box.y+(p.y-item.y)*sy}
    }
    Object.assign(item,{x:box.x,y:box.y,w:box.w,h:box.h});return item;
  }
  return {handles,sameBox,moveBox,resizeBox,placeImage,restoreProportions,transformImage};
});
