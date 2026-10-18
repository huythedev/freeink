// Local-only server. Serve only application assets, with bounded stream lifetimes.
'use strict';
const http=require('http'),fs=require('fs'),path=require('path');
const root=__dirname;
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.json':'application/json','.map':'application/json','.wasm':'application/wasm','.ico':'image/x-icon'};
function makeServer(){return http.createServer((req,res)=>{
  try{
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{Allow:'GET, HEAD'});res.end();return}
    const raw=decodeURIComponent((req.url||'/').split('?')[0]),name=raw==='/'?'index.html':raw.replace(/^\/+/, '');
    const allowed=['index.html','app.js','i18n.js','ink-engine.js','runtime.js','storage.js','file-worker.js','style.css','vector-pdf.js'];
    if(!allowed.includes(name)&&!/^node_modules\/pdfjs-dist\/(build|standard_fonts|cmaps|wasm)\/[a-zA-Z0-9_.\/-]+\.(mjs|js|wasm|bcmap|pfb|ttf)$/.test(name)&&name!=='node_modules/mammoth/mammoth.browser.js'&&!/^assets\/[a-zA-Z0-9_.\/-]+\.(png|svg|ico)$/.test(name)){res.writeHead(404);res.end('Not found');return}
    const file=path.resolve(root,name);if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return}
    fs.stat(file,(error,stat)=>{
      if(res.destroyed)return;
      if(error||!stat.isFile()){res.writeHead(404);res.end('Not installed or not found');return}
      res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Content-Length':stat.size,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});
      if(req.method==='HEAD'){res.end();return}
      const stream=fs.createReadStream(file);
      stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res);
    });
  }catch{res.writeHead(400);res.end('Bad request')}
})}
if(require.main===module)makeServer().listen(17873,'127.0.0.1',()=>console.log('FreeInk browser preview: http://127.0.0.1:17873'));
module.exports={makeServer};
