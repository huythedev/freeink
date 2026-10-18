'use strict';
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const escapeScript=source=>source.replace(/<\/script/gi,'<\\/script');
let html=read('index.html').replace(/<link rel="stylesheet" href="style.css"\s*\/?>/,()=>`<style>\n${read('style.css')}\n</style>`);
const scripts=[];
html=html.replace(/<script src="([a-z0-9-]+\.js)"[^>]*><\/script>/g,(_tag,file)=>{scripts.push(`<script>\n${escapeScript(read(file))}\n</script>`);return ''});
html=html.replace('</body>',()=>scripts.join('\n')+'\n</body>');
const worker=['runtime.js','ink-engine.js','vector-pdf.js','file-worker.js'].map(read).join('\n');
html=html.replace('</head>',()=>`<script id="freeink-worker-source" type="text/plain">\n${escapeScript(worker)}\n</script>\n</head>`);
html=html.replace(/^[ \t]+$/gm,'');
const target=path.join(root,'FreeInk-Standalone.html');
if(process.argv.includes('--check')){if(read('FreeInk-Standalone.html')!==html)throw Error('Run npm run build:standalone to refresh FreeInk-Standalone.html')}
else fs.writeFileSync(target,html);
