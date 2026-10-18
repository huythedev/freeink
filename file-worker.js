/* CPU-heavy file work stays off the editor thread. One task per worker. */
'use strict';
if(!self.FreeInkRuntime)importScripts('./runtime.js');
const Runtime=self.FreeInkRuntime;
async function importImage(payload){
  if(typeof OffscreenCanvas==='undefined'||typeof createImageBitmap==='undefined')throw Error('Image import needs a browser with offscreen canvas support');
  const blob=payload.file||await (await fetch(payload.src)).blob();
  const size=Runtime.imageSize(await blob.slice(0,1024*1024).arrayBuffer());
  if(!size)throw Error('Unsupported image format. Use PNG, JPG, WebP or GIF.');
  if(size.w*size.h>100000000)throw Error('Image exceeds the 100-megapixel import limit');
  const oriented=Runtime.orientedImageSize(size),fitted=Runtime.fittedImage(oriented.w,oriented.h);
  const image=await createImageBitmap(blob,{resizeWidth:fitted.w,resizeHeight:fitted.h,resizeQuality:'high'});
  const target=Runtime.fittedImage(image.width,image.height),canvas=new OffscreenCanvas(target.w,target.h);
  try{
    canvas.getContext('2d').drawImage(image,0,0,target.w,target.h);
    const encoded=await canvas.convertToBlob({type:blob.type==='image/jpeg'?'image/jpeg':'image/png',quality:.92});
    const bytes=new Uint8Array(await encoded.arrayBuffer()),parts=[];
    for(let i=0;i<bytes.length;i+=32768)parts.push(String.fromCharCode(...bytes.subarray(i,i+32768)));
    return {src:`data:${encoded.type};base64,${btoa(parts.join(''))}`,w:target.w,h:target.h};
  }finally{image.close();canvas.width=canvas.height=1}
}
async function jpegImage(src){
  if(!/^data:image\/(?:png|jpe?g|webp|gif);base64,/i.test(src))throw Error('Unsupported embedded image');
  const blob=await (await fetch(src)).blob(),bytes=new Uint8Array(await blob.arrayBuffer());
  const size=Runtime.imageSize(bytes);
  if(!size)throw Error('Could not read embedded image dimensions');
  if(size.w*size.h>100000000)throw Error('Image exceeds the 100-megapixel import limit');
  const native=Runtime.fittedImage(size.w,size.h);
  if(/^data:image\/jpe?g;base64,/i.test(src)&&native.w===size.w&&native.h===size.h&&(!size.orientation||size.orientation===1))return {bytes,w:size.w,h:size.h};
  if(typeof OffscreenCanvas==='undefined'||typeof createImageBitmap==='undefined')throw Error('This browser cannot convert embedded images for PDF export');
  const oriented=Runtime.orientedImageSize(size),fitted=Runtime.fittedImage(oriented.w,oriented.h);
  const image=await createImageBitmap(blob,{resizeWidth:fitted.w,resizeHeight:fitted.h,resizeQuality:'high'});
  const target=Runtime.fittedImage(image.width,image.height),canvas=new OffscreenCanvas(target.w,target.h);
  try{
    const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,target.w,target.h);ctx.drawImage(image,0,0,target.w,target.h);
    const result=await canvas.convertToBlob({type:'image/jpeg',quality:.95});
    return {bytes:new Uint8Array(await result.arrayBuffer()),w:target.w,h:target.h};
  }finally{image.close();canvas.width=canvas.height=1}
}
self.onmessage=async({data})=>{
  try{
    const {kind,payload}=data;let result;
    if(kind==='note-import'){
      result=Runtime.validateNote(JSON.parse(payload.text??await payload.file.text()));
      const normalized=new Map();
      for(const page of result.pages)for(const item of page.items)if(item.kind==='image'){
        if(!normalized.has(item.src)){
          const blob=await (await fetch(item.src)).blob(),size=Runtime.imageSize(await blob.slice(0,1024*1024).arrayBuffer());
          if(!size)throw Error('Could not read embedded image dimensions');
          if(size.w*size.h>100000000)throw Error('Image exceeds the 100-megapixel import limit');
          const fit=Runtime.fittedImage(size.w,size.h);
          normalized.set(item.src,fit.w!==size.w||fit.h!==size.h||size.orientation>1?(await importImage({file:blob})).src:item.src);
        }
        item.src=normalized.get(item.src);
      }
    }
    else if(kind==='image-import')result=await importImage(payload);
    else if(kind==='note-export')result=new Blob([JSON.stringify({app:'FreeInk',version:2,exported:payload.exported,note:payload.note})],{type:'application/json'});
    else if(kind==='pdf-export'){
      if(!self.FreeInkInk)importScripts('./ink-engine.js');
      if(!self.FreeInkVectorPDF)importScripts('./vector-pdf.js');
      const ctx=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(1,1).getContext('2d'):null;
      const measure=ctx?(text,size)=>{ctx.font=`${size}px Arial, sans-serif`;return ctx.measureText(text).width}:undefined;
      result=await self.FreeInkVectorPDF.createVectorPdf(payload.note.pages,{images:jpegImage,measure,
        onProgress:progress=>self.postMessage({type:'progress',...progress})});
    }else if(kind==='docx-import'){
      const buffer=payload.buffer??await payload.file.arrayBuffer();Runtime.checkDocxZip(buffer);
      importScripts('./node_modules/mammoth/mammoth.browser.js');
      result=await self.mammoth.convertToHtml({arrayBuffer:buffer});
      if(result.value.length>2000000)throw Error('DOCX content exceeds the import limit');
    }else throw Error('Unsupported file operation');
    self.postMessage({type:'result',result});
  }catch(error){self.postMessage({type:'error',message:error.message||'File operation failed'})}
};
