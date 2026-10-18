/* Shared resource limits and notebook helpers. No DOM, Electron or network access. */
(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.FreeInkRuntime=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const LIMITS=Object.freeze({pages:200,items:20000,points:1000000,text:250000,imagePixels:4000000,imageEdge:4096,zipBytes:100*1024*1024});
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  // Items are shared until the editor explicitly makes one writable. History
  // copies only page metadata and item lists, never every point in the notebook.
  const snapshotPages=pages=>pages.map(page=>({...page,items:page.items.slice()}));
  function writableItem(item){
    const copy=item.kind==='stroke'?{...item,points:item.points.map(p=>({...p}))}:{...item};
    if(item.erasures)copy.erasures=item.erasures.map(mask=>({...mask,points:mask.points.map(p=>({...p}))}));
    return copy;
  }
  const duplicatePage=(page,uid)=>({...page,id:uid(),items:page.items.map(item=>({...item,id:uid()}))});
  function strokeBounds(item){
    let x=Infinity,y=Infinity,x2=-Infinity,y2=-Infinity;
    for(const p of item.points||[]){
      if(!Number.isFinite(p.x)||!Number.isFinite(p.y))continue;
      x=Math.min(x,p.x);y=Math.min(y,p.y);x2=Math.max(x2,p.x);y2=Math.max(y2,p.y);
    }
    if(x===Infinity)return {x:0,y:0,w:0,h:0};
    const pad=(item.width||3)*(item.tool==='highlighter'?2.5:1.1)+5;
    return {x:x-pad,y:y-pad,w:x2-x+pad*2,h:y2-y+pad*2};
  }
  function pageWindow({count,scrollTop,height,pageHeight,top=29,gap=26,overscan=1}){
    if(!count)return {start:0,end:-1,current:0};
    const step=pageHeight+gap;
    return {
      start:clamp(Math.floor((scrollTop-top)/step)-overscan,0,count-1),
      end:clamp(Math.floor((scrollTop+height-top)/step)+overscan,0,count-1),
      current:clamp(Math.round((scrollTop+height*.42-top-pageHeight/2)/step),0,count-1)
    };
  }
  function eraseItems(items,mask,bounds){
    const area=strokeBounds({points:mask.points,width:mask.width});let changed=false;
    const result=items.map(item=>{
      const box=bounds(item);
      if(box.x+box.w<area.x||area.x+area.w<box.x||box.y+box.h<area.y||area.y+area.h<box.y)return item;
      changed=true;return {...item,erasures:[...(item.erasures||[]),mask]};
    });
    return {items:result,changed};
  }
  function translateErasures(item,dx,dy){for(const mask of item.erasures||[])for(const p of mask.points){p.x+=dx;p.y+=dy}}
  function scaleErasures(item,scale,x,y){for(const mask of item.erasures||[]){mask.width*=scale;for(const p of mask.points){p.x=x+(p.x-x)*scale;p.y=y+(p.y-y)*scale}}}
  class LruCache{
    constructor({maxEntries=8,maxWeight=64*1024*1024,onEvict=()=>{}}={}){this.entries=new Map();this.weight=0;Object.assign(this,{maxEntries,maxWeight,onEvict})}
    has(key){return this.entries.has(key)}
    get(key){const entry=this.entries.get(key);if(!entry)return;this.entries.delete(key);this.entries.set(key,entry);return entry.value}
    set(key,value,weight=0){
      const old=this.entries.get(key);if(old){this.weight-=old.weight;this.entries.delete(key)}
      this.entries.set(key,{value,weight});this.weight+=weight;
      // Keep a single legacy oversized image usable, while evicting all others.
      while(this.entries.size>this.maxEntries||(this.weight>this.maxWeight&&this.entries.size>1))this.delete(this.entries.keys().next().value);
      return value;
    }
    delete(key){const entry=this.entries.get(key);if(!entry)return;this.entries.delete(key);this.weight-=entry.weight;this.onEvict(entry.value)}
    clear(){for(const key of [...this.entries.keys()])this.delete(key)}
  }
  function abortError(){const error=new Error('Operation cancelled');error.name='AbortError';return error}
  function checkAbort(signal){if(signal?.aborted)throw abortError()}
  async function yieldToMain(signal){checkAbort(signal);await new Promise(resolve=>setTimeout(resolve,0));checkAbort(signal)}
  function imageSize(bytes){
    const b=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes),v=new DataView(b.buffer,b.byteOffset,b.byteLength);
    const text=(start,n)=>String.fromCharCode(...b.subarray(start,start+n));
    if(b.length>=24&&v.getUint32(0)===0x89504e47&&text(12,4)==='IHDR')return {w:v.getUint32(16),h:v.getUint32(20)};
    if(b.length>=10&&text(0,3)==='GIF')return {w:v.getUint16(6,true),h:v.getUint16(8,true)};
    if(b.length>=30&&text(0,4)==='RIFF'&&text(8,4)==='WEBP'){
      if(text(12,4)==='VP8X')return {w:1+b[24]+(b[25]<<8)+(b[26]<<16),h:1+b[27]+(b[28]<<8)+(b[29]<<16)};
      if(text(12,4)==='VP8 ')return {w:v.getUint16(26,true)&0x3fff,h:v.getUint16(28,true)&0x3fff};
      if(text(12,4)==='VP8L'&&b[20]===0x2f){const n=v.getUint32(21,true);return {w:(n&0x3fff)+1,h:((n>>>14)&0x3fff)+1}}
    }
    if(b.length>=4&&v.getUint16(0)===0xffd8){
      let dimensions=null,orientation=1;
      for(let p=2;p+4<=b.length;){
        if(b[p++]!==0xff)continue;
        while(p<b.length&&b[p]===0xff)p++;
        const marker=b[p++];if(marker===0xda||marker===0xd9)break;
        if(marker===0x01||marker>=0xd0&&marker<=0xd8)continue;
        if(p+2>b.length)break;const size=v.getUint16(p);
        if(size<2||p+size>b.length)break;
        if(marker===0xe1&&size>=16&&text(p+2,6)==='Exif\0\0'){
          const start=p+8,end=p+size,little=v.getUint16(start)===0x4949;
          if((little||v.getUint16(start)===0x4d4d)&&v.getUint16(start+2,little)===42){
            const ifd=start+v.getUint32(start+4,little);
            if(ifd>=start&&ifd+2<=end){
              const entries=Math.min(v.getUint16(ifd,little),4096);
              for(let j=0;j<entries;j++){
                const entry=ifd+2+j*12;if(entry+12>end)break;
                if(v.getUint16(entry,little)===0x0112&&v.getUint16(entry+2,little)===3&&v.getUint32(entry+4,little)===1){
                  const value=v.getUint16(entry+8,little);if(value>=1&&value<=8)orientation=value;break;
                }
              }
            }
          }
        }
        if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)&&size>=7)dimensions={w:v.getUint16(p+5),h:v.getUint16(p+3)};
        p+=size;
      }
      if(dimensions)return {...dimensions,orientation};
    }
    return null;
  }
  function embeddedImageSize(src){
    if(typeof src!=='string'||!/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(src))return null;
    try{
      const start=src.indexOf(',')+1,jpeg=/^data:image\/jpe?g;/i.test(src);
      const read=n=>{const header=atob(src.slice(start,start+n));return imageSize(Uint8Array.from(header,c=>c.charCodeAt(0)))};
      const size=read(jpeg?65536:128);return size||jpeg&&read(1398100)||null;
    }catch{return null}
  }
  const orientedImageSize=size=>size.orientation>=5?{w:size.h,h:size.w}:size;
  function fittedImage(w,h){
    if(!Number.isFinite(w)||!Number.isFinite(h)||w<=0||h<=0)throw Error('Invalid image dimensions');
    const scale=Math.min(1,LIMITS.imageEdge/Math.max(w,h),Math.sqrt(LIMITS.imagePixels/(w*h)));
    return {w:Math.max(1,Math.floor(w*scale)),h:Math.max(1,Math.floor(h*scale))};
  }
  function checkDocxZip(buffer){
    const v=new DataView(buffer);let end=-1;
    for(let p=v.byteLength-22;p>=Math.max(0,v.byteLength-65557);p--)if(v.getUint32(p,true)===0x06054b50){end=p;break}
    if(end<0)throw Error('Invalid DOCX archive');
    const count=v.getUint16(end+10,true),offset=v.getUint32(end+16,true);
    if(v.getUint16(end+4,true)||v.getUint16(end+6,true)||count>5000)throw Error('DOCX archive has too many entries');
    let p=offset,total=0;
    for(let i=0;i<count;i++){
      if(p+46>end||v.getUint32(p,true)!==0x02014b50)throw Error('Invalid DOCX archive directory');
      const size=v.getUint32(p+24,true);total+=size;
      if(size===0xffffffff||total>LIMITS.zipBytes)throw Error('DOCX expands beyond the 100 MB import limit');
      p+=46+v.getUint16(p+28,true)+v.getUint16(p+30,true)+v.getUint16(p+32,true);
    }
    if(p>end)throw Error('Invalid DOCX archive directory');
  }
  function validateNote(data){
    const source=data?.note||data;
    if(!source||!Array.isArray(source.pages)||!source.pages.length||source.pages.length>LIMITS.pages)throw Error('Invalid note or too many pages (200 maximum)');
    let items=0,points=0,text=0;
    const number=(value,fallback,min=-10000,max=10000)=>{const n=value??fallback;if(!Number.isFinite(n)||n<min||n>max)throw Error('Invalid note coordinates or dimensions');return n};
    const color=value=>/^#[0-9a-f]{6}$/i.test(value||'')?value:'#262e3a';
    const pages=source.pages.map(page=>{
      if(!Array.isArray(page?.items))throw Error('Invalid note page');
      return {template:['ruled','blank','graph','dots','dark','music'].includes(page.template)?page.template:'blank',items:page.items.map(item=>{
        if(++items>LIMITS.items)throw Error('Note exceeds the 20,000-item import limit');
        if(item?.kind==='stroke'){
          if(!Array.isArray(item.points)||!item.points.length||(points+=item.points.length)>LIMITS.points)throw Error('Invalid ink or note exceeds the 1,000,000-point import limit');
          return {kind:'stroke',inkVersion:item.inkVersion===2?2:1,tool:['pen','pencil','highlighter'].includes(item.tool)?item.tool:'pen',color:color(item.color),width:number(item.width,3,.1,100),points:item.points.map(p=>({x:number(p?.x),y:number(p?.y),p:number(p?.p,.5,0,1),tx:number(p?.tx,0,-90,90),ty:number(p?.ty,0,-90,90),twist:number(p?.twist,0,0,360)}))};
        }
        if(item?.kind==='shape')return {kind:'shape',shape:['line','arrow','rect','triangle','ellipse'].includes(item.shape)?item.shape:'line',x:number(item.x),y:number(item.y),x2:number(item.x2),y2:number(item.y2),width:number(item.width,3,.1,100),color:color(item.color)};
        if(item?.kind==='text'){
          const value=String(item.text||'');if((text+=value.length)>LIMITS.text)throw Error('Note text exceeds the 250,000-character import limit');
          return {kind:'text',text:value,x:number(item.x),y:number(item.y),w:number(item.w,500,1,10000),size:number(item.size,22,1,200),weight:item.weight===600?600:400,color:color(item.color)};
        }
        if(item?.kind==='image'){
          if(typeof item.src!=='string'||!/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(item.src))throw Error('Notes may contain embedded raster images only');
          return {kind:'image',src:item.src,x:number(item.x),y:number(item.y),w:number(item.w,1,1,10000),h:number(item.h,1,1,10000),locked:!!item.locked};
        }
        throw Error('Unsupported note item');
      })};
    });
    const sharedMasks=new Map();
    pages.forEach((page,i)=>page.items.forEach((item,j)=>{
      const masks=source.pages[i].items[j].erasures;if(masks===undefined)return;
      if(!Array.isArray(masks)||masks.length>5000)throw Error('Invalid pixel eraser data');
      item.erasures=masks.map(mask=>{
        if(!Array.isArray(mask?.points)||!mask.points.length||mask.points.length>LIMITS.points)throw Error('Pixel eraser data exceeds the import limit');
        const value={width:number(mask.width,20,.1,2000),points:mask.points.map(p=>({x:number(p?.x),y:number(p?.y)}))},key=JSON.stringify(value);
        if(sharedMasks.has(key))return sharedMasks.get(key);
        if((points+=value.points.length)>LIMITS.points)throw Error('Pixel eraser data exceeds the import limit');
        sharedMasks.set(key,value);return value;
      });
    }));
    return {title:String(source.title||'Imported note').slice(0,200),pages};
  }
  return {LIMITS,snapshotPages,writableItem,duplicatePage,strokeBounds,pageWindow,eraseItems,translateErasures,scaleErasures,LruCache,abortError,checkAbort,yieldToMain,imageSize,embeddedImageSize,orientedImageSize,fittedImage,checkDocxZip,validateNote};
});
