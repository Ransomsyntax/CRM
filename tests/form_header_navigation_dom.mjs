import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const {JSDOM} = require('jsdom');
const dom = new JSDOM('<div id="crm-fullpage-form-host"></div><div id="modal-backdrop"><div id="modal"><header><h2 id="modal-title"></h2><div class="crm-layout-header-actions"><button>Edit Page Layout</button><select aria-label="Record layout"></select></div></header><div id="modal-body"></div><button id="modal-cancel">Cancel</button></div></div>');
const document = dom.window.document;
const source = await readFile(new URL('../static/js/app.js',import.meta.url),'utf8');
const start = source.indexOf('async function presentFullPageForm(');
const end = source.indexOf('function openFullPageRecord(', start);
const navigations = [];
const context = vm.createContext({document, MODULES:{}, pendingRecordPresets:new Map(), isFullPageRendering:false,
  $:s=>document.querySelector(s), navigate:path=>navigations.push(path),
  openPlatformModal:async()=>{
    document.querySelector('#modal-body').innerHTML='<label class="crm-platform-layout-label">Layout<select data-platform-layout-select aria-label="Select record layout"><option>Standard</option></select></label>';
  }
});
vm.runInContext(source.slice(start,end),context);
for (const resource of ['quotes','invoices','sales_orders','purchase_orders','quotes']) {
  await context.presentFullPageForm(resource);
  const header=document.querySelector('header');
  assert.equal(header.querySelectorAll('select').length,1,resource+' must have one layout selector');
  assert.equal(header.querySelectorAll('button').length,1,resource+' must have one layout editor');
  assert.equal(document.querySelectorAll('.crm-platform-layout-label').length,0);
  header.querySelector('button').click();
  assert.equal(navigations.at(-1),'/layout-editor/'+resource);
}
console.log('Form header navigation checks passed');
