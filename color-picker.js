/* Continuous ink colors: standalone DOM control, no browser/OS color dialog. */
(function(root,factory){
  const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;root.FreeInkColor=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const clamp=value=>Math.max(0,Math.min(1,Number(value)||0));
  function normalizeHex(value){
    let hex=String(value||'').trim().replace(/^#/,'');
    if(/^[0-9a-f]{3}$/i.test(hex))hex=[...hex].map(c=>c+c).join('');
    return /^[0-9a-f]{6}$/i.test(hex)?'#'+hex.toLowerCase():null;
  }
  function hsvToHex(h,s,v){
    h=((Number(h)||0)%360+360)%360;s=clamp(s);v=clamp(v);
    const c=v*s,x=c*(1-Math.abs(h/60%2-1)),m=v-c;
    const rgb=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];
    return '#'+rgb.map(n=>Math.round((n+m)*255).toString(16).padStart(2,'0')).join('');
  }
  function hexToHsv(value,previousHue=0){
    const hex=normalizeHex(value);if(!hex)throw Error('Invalid ink color');
    const [r,g,b]=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255),max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;
    let h=previousHue;
    if(d)h=60*(max===r?(g-b)/d+(g<b?6:0):max===g?(b-r)/d+2:(r-g)/d+4);
    return {h,s:max?d/max:0,v:max};
  }
  function createPicker({color,onChange,onClose,translate=key=>key,document:doc=globalThis.document}){
    let hsv=hexToHsv(color),lastColor=normalizeHex(color),activePointer=null,frame=0,destroyed=false;
    const make=(tag,className,text)=>{const el=doc.createElement(tag);el.className=className;if(text)el.textContent=text;return el};
    const root=make('div','popup color-picker');root.id='ink-color-picker';root.setAttribute('role','dialog');root.setAttribute('aria-label',translate('Ink color'));
    const heading=make('div','color-picker-heading'),title=make('strong','',translate('Ink color')),close=make('button','icon-button color-picker-close','×');
    close.type='button';close.setAttribute('aria-label',translate('Close'));close.title=translate('Close');close.onclick=onClose;heading.append(title,close);
    const field=make('div','color-field'),thumb=make('span','color-field-thumb');field.append(thumb);field.tabIndex=0;
    field.setAttribute('role','slider');field.setAttribute('aria-label',translate('Saturation and brightness'));field.setAttribute('aria-valuemin','0');field.setAttribute('aria-valuemax','100');
    const help=make('p','color-picker-help',translate('Drag to choose a color. Use arrow keys to fine-tune.'));help.id='ink-color-help';field.setAttribute('aria-describedby',help.id);
    const hueLabel=make('label','color-picker-label',translate('Hue')),hue=make('input','color-hue');hue.type='range';hue.min='0';hue.max='359';hue.step='1';hue.setAttribute('aria-label',translate('Hue'));hueLabel.append(hue);
    const row=make('div','color-picker-value'),preview=make('span','color-picker-preview'),hexLabel=make('label','color-picker-label',translate('Hex color')),hex=make('input','color-hex');
    hex.type='text';hex.maxLength=7;hex.spellcheck=false;hex.autocomplete='off';hex.setAttribute('autocapitalize','off');hex.setAttribute('aria-label',translate('Hex color'));hexLabel.append(hex);row.append(preview,hexLabel);
    root.append(heading,field,hueLabel,row,help);
    function paint(syncHex=true){
      const value=hsvToHex(hsv.h,hsv.s,hsv.v);field.style.setProperty('--color-hue',hsvToHex(hsv.h,1,1));thumb.style.left=`${hsv.s*100}%`;thumb.style.top=`${(1-hsv.v)*100}%`;
      field.setAttribute('aria-valuenow',String(Math.round(hsv.s*100)));
      field.setAttribute('aria-valuetext',translate('Saturation {s}%, brightness {v}%',{s:Math.round(hsv.s*100),v:Math.round(hsv.v*100)}));
      hue.value=String(Math.round(hsv.h)%360);preview.style.backgroundColor=value;
      if(syncHex){hex.value=value;hex.removeAttribute('aria-invalid')}
      return value;
    }
    function emit(value){if(!destroyed&&value!==lastColor){lastColor=value;onChange(value)}}
    function flush(){if(frame){cancelAnimationFrame(frame);frame=0}if(!destroyed)emit(paint())}
    function schedule(){if(!frame)frame=requestAnimationFrame(()=>{frame=0;if(!destroyed)emit(paint())})}
    function sample(event){const rect=field.getBoundingClientRect();if(!rect.width||!rect.height)return;hsv.s=clamp((event.clientX-rect.left)/rect.width);hsv.v=1-clamp((event.clientY-rect.top)/rect.height)}
    field.addEventListener('pointerdown',event=>{
      if(activePointer!==null||event.isPrimary===false||(event.pointerType==='mouse'&&event.button!==0))return;
      event.preventDefault();field.focus();activePointer=event.pointerId;field.setPointerCapture(event.pointerId);sample(event);flush();
    });
    field.addEventListener('pointermove',event=>{if(event.pointerId===activePointer){sample(event);schedule()}});
    const finish=event=>{
      if(event.pointerId!==activePointer)return;
      if(event.type==='pointerup')sample(event);const id=activePointer;activePointer=null;flush();if(field.hasPointerCapture(id))field.releasePointerCapture(id);
    };
    for(const name of ['pointerup','pointercancel','lostpointercapture'])field.addEventListener(name,finish);
    field.addEventListener('keydown',event=>{
      const step=event.shiftKey ? .1 : .01;
      if(event.key==='ArrowLeft')hsv.s=clamp(hsv.s-step);else if(event.key==='ArrowRight')hsv.s=clamp(hsv.s+step);
      else if(event.key==='ArrowUp')hsv.v=clamp(hsv.v+step);else if(event.key==='ArrowDown')hsv.v=clamp(hsv.v-step);
      else if(event.key==='Home')hsv.s=0;else if(event.key==='End')hsv.s=1;else return;
      event.preventDefault();event.stopPropagation();flush();
    });
    hue.addEventListener('input',()=>{hsv.h=Number(hue.value);schedule()});hue.addEventListener('change',flush);
    hex.addEventListener('input',()=>{
      const value=normalizeHex(hex.value);hex.setAttribute('aria-invalid',String(!value));if(!value)return;
      hsv=hexToHsv(value,hsv.h);if(frame){cancelAnimationFrame(frame);frame=0}paint(false);emit(value);
    });
    hex.addEventListener('blur',()=>paint());
    hex.addEventListener('keydown',event=>{if(event.key==='Enter'&&normalizeHex(hex.value)){event.preventDefault();onClose()}});
    root.addEventListener('keydown',event=>{if(event.key!=='Escape'&&event.key!=='Tab'&&!event.ctrlKey&&!event.metaKey){event.stopPropagation();if(event.code==='Space'&&event.target===field)event.preventDefault()}});
    paint();
    return {element:root,focus:()=>field.focus(),destroy(){if(destroyed)return;flush();destroyed=true;if(activePointer!==null&&field.hasPointerCapture(activePointer))field.releasePointerCapture(activePointer);activePointer=null}};
  }
  return {normalizeHex,hsvToHex,hexToHsv,createPicker};
});
