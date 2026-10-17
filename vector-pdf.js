/* FreeInk vector PDF exporter. No third-party dependency; works offline in browsers and in Node tests.
   Paper and ink paths are PDF graphics commands at true resolution independence.
   Photographs and imported scanned PDF pages remain raster images by nature. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.FreeInkVectorPDF = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const PW = 816, PH = 1056, A = new TextEncoder();
  const Ink = typeof module !== 'undefined' && module.exports ? require('./ink-engine.js') : globalThis.FreeInkInk;
  const fmt = x => (Number.isFinite(x) ? Number(x.toFixed(3)).toString() : '0');
  const rgb = hex => {
    const h = /^#[0-9a-f]{6}$/i.test(hex || '') ? hex.slice(1) : '24364c';
    return [0, 2, 4].map(j => fmt(parseInt(h.slice(j, j + 2), 16) / 255)).join(' ');
  };
  // CP1252 / WinAnsi PDF builtin font. Non-encodable glyphs use '?' (see README).
  const cp = new Map(Array.from('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ').map((c,i) => [c,[128,130,131,132,133,134,135,136,137,138,139,140,142,145,146,147,148,149,150,151,152,153,154,155,156,158,159][i]]));
  const literal = s => {
    let out = '(';
    for (const c of String(s)) {
      let code=c.codePointAt(0);
      if (cp.has(c)) code=cp.get(c);
      if (code>255 || (code<32 && code!==9)) code=63;
      if (code===40 || code===41 || code===92) out+='\\';
      if (code===10 || code===13) code=32;
      out+=String.fromCharCode(code);
    }
    return out+')';
  };
  // PDF stream source strings require a byte-preserving 1:1 encoding.
  const latinBytes = text => Uint8Array.from(text, c => c.charCodeAt(0) & 255);
  const base64 = encoded => {
    if (typeof atob !== 'undefined') { const bin=atob(encoded), out=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);return out; }
    return new Uint8Array(Buffer.from(encoded, 'base64'));
  };
  const line = (a,b) => `${fmt(a.x)} ${fmt(a.y)} m ${fmt(b.x)} ${fmt(b.y)} l S\n`;
  function penPath(points) {
    if (!points?.length) return '';
    const p=points, first=p[0];
    if (p.length===1) return `${fmt(first.x)} ${fmt(first.y)} ${fmt(.02)} 0 360 arc\n`; // replaced as dot below
    let s=`${fmt(first.x)} ${fmt(first.y)} m\n`, prev=first;
    for(let i=1;i<p.length-1;i++){
      const q=p[i],r=p[i+1],end={x:(q.x+r.x)/2,y:(q.y+r.y)/2};
      const c1={x:prev.x+(q.x-prev.x)*2/3,y:prev.y+(q.y-prev.y)*2/3};
      const c2={x:end.x+(q.x-end.x)*2/3,y:end.y+(q.y-end.y)*2/3};
      s+=`${fmt(c1.x)} ${fmt(c1.y)} ${fmt(c2.x)} ${fmt(c2.y)} ${fmt(end.x)} ${fmt(end.y)} c\n`;prev=end;
    }
    return s+`${fmt(p[p.length-1].x)} ${fmt(p[p.length-1].y)} l S\n`;
  }
  function filledCircle(p,r,fill=true){
    const k=.5522847498;
    let s=`${fmt(p.x+r)} ${fmt(p.y)} m\n`;
    for(const c of [[p.x+r,p.y+k*r,p.x+k*r,p.y+r,p.x,p.y+r],[p.x-k*r,p.y+r,p.x-r,p.y+k*r,p.x-r,p.y],[p.x-r,p.y-k*r,p.x-k*r,p.y-r,p.x,p.y-r],[p.x+k*r,p.y-r,p.x+r,p.y-k*r,p.x+r,p.y]])s+=c.map(fmt).join(' ')+' c\n';
    return s+(fill?'h f\n':'h\n');
  }
  function pressureStroke(item){
    if(!Ink)throw Error('Ink engine missing');
    const o=Ink.outline(item.points,item);
    if(!o.points.length)return '';
    let s=`q /${item.tool==='highlighter'?'GS28':item.tool==='pencil'?'GS72':'GS100'} gs ${rgb(item.color)} rg\n`;
    // Fill every segment and round joint in one vector operation. No
    // winding holes on reversals and no opacity stripes on marker strokes.
    for(const quad of o.segments){
      s+=`${fmt(quad[0].x)} ${fmt(quad[0].y)} m\n`;
      for(let i=1;i<4;i++)s+=`${fmt(quad[i].x)} ${fmt(quad[i].y)} l\n`;
      s+='h\n';
    }
    for(let i=0;i<o.points.length;i++)s+=filledCircle(o.points[i],o.radii[i],false);
    return s+'f Q\n';
  }
  function stroke(item){
    if(item.inkVersion===2)return pressureStroke(item);
    const pts=item.points||[];if(!pts.length)return '';
    const width=(item.tool==='highlighter' ? 5 : 1)*(item.width||3)*(.75+.5*(pts[0].p??.5));
    let s=`q /${item.tool==='highlighter'?'GS28':item.tool==='pencil'?'GS72':'GS100'} gs ${rgb(item.color)} RG ${rgb(item.color)} rg ${fmt(width)} w 1 J 1 j\n`;
    if(pts.length===1){const r=width/2,p=pts[0];
      // Filled circle from four Bezier quarters.
      const k=.5522847498;
      s+=`${fmt(p.x+r)} ${fmt(p.y)} m\n`;
      for(const c of [[p.x+r,p.y+k*r,p.x+k*r,p.y+r,p.x,p.y+r],[p.x-k*r,p.y+r,p.x-r,p.y+k*r,p.x-r,p.y],[p.x-r,p.y-k*r,p.x-k*r,p.y-r,p.x,p.y-r],[p.x+k*r,p.y-r,p.x+r,p.y-k*r,p.x+r,p.y]])s+=c.map(fmt).join(' ')+' c\n';
      return s+'f Q\n';
    }
    return s+penPath(pts)+'Q\n';
  }
  function shape(e){
    const x=e.x,y=e.y,dx=e.x2-x,dy=e.y2-y;
    let s=`q ${rgb(e.color)} RG ${fmt(e.width||3)} w 1 J 1 j\n`;
    if(e.shape==='rect')s+=`${fmt(x)} ${fmt(y)} ${fmt(dx)} ${fmt(dy)} re S\n`;
    else if(e.shape==='triangle')s+=`${fmt(x+dx/2)} ${fmt(y)} m ${fmt(e.x2)} ${fmt(e.y2)} l ${fmt(x)} ${fmt(e.y2)} l h S\n`;
    else if(e.shape==='ellipse'){
      const rx=Math.max(1,Math.abs(dx/2)),ry=Math.max(1,Math.abs(dy/2)),cx=x+dx/2,cy=y+dy/2,k=.5522847498;
      s+=`${fmt(cx+rx)} ${fmt(cy)} m\n`;
      for(const c of [[cx+rx,cy+k*ry,cx+k*rx,cy+ry,cx,cy+ry],[cx-k*rx,cy+ry,cx-rx,cy+k*ry,cx-rx,cy],[cx-rx,cy-k*ry,cx-k*rx,cy-ry,cx,cy-ry],[cx+k*rx,cy-ry,cx+rx,cy-k*ry,cx+rx,cy]])s+=c.map(fmt).join(' ')+' c\n';
      s+='h S\n';
    }else {
      s+=`${fmt(x)} ${fmt(y)} m ${fmt(e.x2)} ${fmt(e.y2)} l S\n`;
      if(e.shape==='arrow'){
        const a=Math.atan2(dy,dx),r=Math.max(12,(e.width||3)*5);
        const p1={x:e.x2-r*Math.cos(a-.45),y:e.y2-r*Math.sin(a-.45)},p2={x:e.x2-r*Math.cos(a+.45),y:e.y2-r*Math.sin(a+.45)};
        s+=`${fmt(p1.x)} ${fmt(p1.y)} m ${fmt(e.x2)} ${fmt(e.y2)} l ${fmt(p2.x)} ${fmt(p2.y)} l S\n`;
      }
    }
    return s+'Q\n';
  }
  function paper(t){
    let s='q 1 1 1 rg 0 0 816 1056 re f\n';
    if(t==='dark') s='q .105 .137 .19 rg 0 0 816 1056 re f\n';
    const grid=(step,color,width)=>{s+=`${color} RG ${width} w\n`;for(let x=step;x<PW;x+=step)s+=`${x} 0 m ${x} ${PH} l S\n`;for(let y=step;y<PH;y+=step)s+=`0 ${y} m ${PW} ${y} l S\n`};
    if(t==='ruled'){s+='.81 .87 .93 RG .65 w\n';for(let y=88;y<PH;y+=32)s+=`48 ${y} m 782 ${y} l S\n`;s+='.96 .68 .68 RG .7 w 86 0 m 86 1056 l S\n';}
    else if(t==='graph')grid(24,'.87 .91 .95',.5);
    else if(t==='dots'){s+='.8 .84 .89 rg\n';for(let y=24;y<PH;y+=24)for(let x=24;x<PW;x+=24)s+=`${x} ${y} .8 .8 re f\n`}
    else if(t==='music'){s+='.78 .84 .9 RG .6 w\n';for(let y=90;y<PH-40;y+=122)for(let k=0;k<5;k++)s+=`56 ${y+k*12} m 770 ${y+k*12} l S\n`;}
    return s+'Q\n';
  }
  function textItem(e, measure){
    const size=+e.size||22, width=e.w||500, lines=[];
    for(const raw of String(e.text||'').split('\n')){
      let acc='';for(const part of raw.split(/\s+/)){const next=acc?acc+' '+part:part;
        if(acc && measure(next,size)>width){lines.push(acc);acc=part}else acc=next;
      }lines.push(acc);
    }
    let s=`q ${rgb(e.color)} rg\n`;
    lines.forEach((l,i)=>{const y=e.y+i*size*1.44+size;s+=`BT /F1 ${fmt(size)} Tf 1 0 0 -1 ${fmt(e.x)} ${fmt(y)} Tm ${literal(l)} Tj ET\n`});
    return s+'Q\n';
  }
  function defaultMeasure(text,size){return String(text).length*size*.55}
  class Writer {
    constructor(){this.objects=[null];}
    alloc(){this.objects.push(null);return this.objects.length-1}
    put(id, dict, bytes){this.objects[id]={dict,bytes};}
    output(){let pos=0, chunks=[], offsets=[0];const add = data => {const b=typeof data==='string'?A.encode(data):data;chunks.push(b);pos+=b.length};
      add('%PDF-1.4\n%FreeInk vector\n');
      for(let id=1;id<this.objects.length;id++){const o=this.objects[id];if(!o)throw Error('Unwritten PDF object '+id);offsets[id]=pos;add(`${id} 0 obj\n${o.dict}`);if(o.bytes){add(`\nstream\n`);add(o.bytes);add('\nendstream')}add('\nendobj\n')}
      const start=pos;add(`xref\n0 ${this.objects.length}\n0000000000 65535 f \n`);for(let i=1;i<offsets.length;i++)add(String(offsets[i]).padStart(10,'0')+' 00000 n \n');add(`trailer\n<</Size ${this.objects.length} /Root 1 0 R>>\nstartxref\n${start}\n%%EOF\n`);
      return typeof Blob!=='undefined'?new Blob(chunks,{type:'application/pdf'}):Buffer.concat(chunks.map(b=>Buffer.from(b)));
    }
  }
  /**
   * @param pages {Array<{template:string,items:Array}>}
   * @param options.images - async function(src)-> {bytes:Uint8Array,w:number,h:number}, JPEG bytes.
   * @param options.measure - (text,size)->width in page units.
   */
  async function createVectorPdf(pages, options={}) {
    if(!Array.isArray(pages) || !pages.length)throw Error('No pages to export');
    const w=new Writer(),rootId=w.alloc(),pagesId=w.alloc(),fontId=w.alloc(),gs100=w.alloc(),gs72=w.alloc(),gs28=w.alloc();
    w.put(fontId,'<</Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding>>');
    w.put(gs100,'<</Type /ExtGState /CA 1 /ca 1>>');w.put(gs72,'<</Type /ExtGState /CA .72 /ca .72>>');w.put(gs28,'<</Type /ExtGState /CA .28 /ca .28>>');
    const kids=[];
    for(const page of pages){
      const pageId=w.alloc(),contentId=w.alloc(),imageRefs=[],items=page.items||[];
      kids.push(`${pageId} 0 R`);
      let stream='q .75 0 0 -.75 0 792 cm\n'+paper(page.template);
      for(const it of items){
        if(it.kind==='stroke')stream+=stroke(it);
        else if(it.kind==='shape')stream+=shape(it);
        else if(it.kind==='text')stream+=textItem(it, options.measure||defaultMeasure);
        else if(it.kind==='image' && options.images){
          const img=await options.images(it.src);
          if(!img?.bytes?.length)continue;
          const imgId=w.alloc(),name='Im'+imageRefs.length;
          w.put(imgId,`<</Type /XObject /Subtype /Image /Width ${Math.round(img.w)} /Height ${Math.round(img.h)} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.bytes.length}>>`,img.bytes);
          imageRefs.push({name,id:imgId});
          stream+=`q ${fmt(it.w)} 0 0 ${fmt(it.h)} ${fmt(it.x)} ${fmt(it.y)} cm /${name} Do Q\n`;
        }
      }
      stream+='Q\n';const bytes=latinBytes(stream),resources=`<</Font <</F1 ${fontId} 0 R>> /ExtGState <</GS100 ${gs100} 0 R /GS72 ${gs72} 0 R /GS28 ${gs28} 0 R>> /XObject <<${imageRefs.map(im=>`/${im.name} ${im.id} 0 R`).join(' ')}>>>>`;
      w.put(contentId,`<</Length ${bytes.length}>>`,bytes);
      w.put(pageId,`<</Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Resources ${resources} /Contents ${contentId} 0 R>>`);
    }
    w.put(pagesId,`<</Type /Pages /Kids [${kids.join(' ')}] /Count ${kids.length}>>`);w.put(rootId,`<</Type /Catalog /Pages ${pagesId} 0 R>>`);
    return w.output();
  }
  return {createVectorPdf,base64,fmt};
});
