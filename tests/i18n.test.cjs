const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const storage = new Map();
const translatedText = {dataset:{i18n:'My notes'},textContent:'My notes'};
const translatedTitle = {dataset:{i18nTitle:'Save note (Ctrl+S)'},setAttribute(k,v){this[k]=v;}};
const document = {documentElement:{lang:'en'},querySelectorAll:()=>[translatedText,translatedTitle],dispatchEvent:()=>{}};
const context = {window:{},document,localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},CustomEvent:class{}};
vm.runInNewContext(fs.readFileSync(require('node:path').resolve(__dirname,'../i18n.js'),'utf8'),context);
const i18n = context.window.FreeInkI18n;
assert.equal(i18n.t('My notes'),'My notes');
i18n.setLanguage('vi');
assert.equal(i18n.t('My notes'),'Ghi chú của tôi');
assert.equal(translatedText.textContent,'Ghi chú của tôi');
assert.equal(translatedTitle.title,'Lưu ghi chú (Ctrl+S)');
assert.equal(document.documentElement.lang,'vi');
assert.equal(i18n.t('Page {current} of {total}',{current:2,total:4}),'Trang 2/4');
assert.equal(storage.get('freeink-ui-language'),'vi');
i18n.setLanguage('en');
assert.equal(translatedText.textContent,'My notes');
assert.equal(document.documentElement.lang,'en');
console.log('Vietnamese/English interface and preference tests pass.');

// The packaged desktop HTTP server must serve the translation module.
const serverSource=fs.readFileSync(require('node:path').resolve(__dirname,'../server.js'),'utf8');
assert.match(serverSource,/const allowed=\[[^\]]*'i18n\.js'/);
