'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8'),item={id:'text',kind:'text',text:'Keep my formatting',x:40,y:50,w:608.5,size:28,weight:600,color:'#07c5ab'},page={items:[item]},state={selection:['text'],color:'#123456'};
let editor,histories=0,changes=0,removed=0;
const document={querySelector:()=>null,createElement(){
 const events=new Map(),node={style:{},isConnected:false,focus(){},addEventListener:(name,fn)=>events.set(name,fn),remove(){removed++;if(removed>20)throw Error('Reentrant removal');events.get('blur')?.();this.isConnected=false}};
 // Browser CSS normalizes assigned hex colors when they are read back.
 Object.defineProperty(node.style,'color',{set(){},get:()=> 'rgb(7, 197, 171)'});editor=node;return node;
}};
const canvas={focus(){},parentElement:{appendChild(node){node.isConnected=true}}},c={document,state,PAGE_W:816,PAGE_H:1056,t:message=>message,curPage:()=>page,textLayout:()=>({h:80}),saveHistory(){histories++},markChanged(){changes++},drawPage(){},updateImageControls(){},uid:()=> 'new-text',finishActiveText(){}};
vm.createContext(c);vm.runInContext(source.slice(source.indexOf('function startTextEdit('),source.indexOf('function deleteSelection(')),c);
c.startTextEdit(canvas,0,{x:40,y:50},item);editor._finish(true);
assert.equal(removed,1,'removing a focused editor must not re-enter the blur commit');assert.equal(histories,0,'opening and closing unchanged text must preserve redo');assert.equal(changes,0);assert.equal(page.items[0].w,608.5);
c.startTextEdit(canvas,0,{x:40,y:50},item);editor.value='Edited once';editor._finish(true);editor._finish(true);
assert.equal(histories,1);assert.equal(changes,1);assert.equal(page.items[0].color,'#07c5ab','editing must retain a backup-safe hex color');assert.equal(page.items[0].w,608.5);assert.equal(page.items[0].weight,600);
c.startTextEdit(canvas,0,{x:40,y:50},page.items[0]);editor.value='';editor._finish(true);assert.equal(page.items.length,0,'clearing an existing text block must remove it');assert.equal(histories,2);assert.equal(changes,2);
c.startTextEdit(canvas,0,{x:800,y:100});editor.value='New text';editor._finish(false);assert.equal(page.items.length,0);assert.equal(histories,2,'Escape must discard new text without history');
c.startTextEdit(canvas,0,{x:800,y:100});editor.value='New text';editor._finish(true);assert.equal(page.items.length,1);assert.equal(page.items[0].x,656,'new editors at the page edge must stay reachable');assert.equal(page.items[0].w,160);assert.equal(page.items[0].color,'#123456');
console.log('Text editing: reentrant blur, unchanged commits, width/color/weight retention, deletion, cancellation and page-edge placement pass.');
