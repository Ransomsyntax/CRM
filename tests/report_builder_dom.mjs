import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createReportBuilder} from '../static/js/features/report-builder.js';
const require=createRequire(import.meta.url);
const {JSDOM}=require('jsdom');
const dom=new JSDOM('<main></main>');
globalThis.FormData=dom.window.FormData;
const document=dom.window.document;
const calls=[], notices=[], routes=[];
const esc=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const feature=createReportBuilder({
  api:async(path,options)=>{calls.push({path,options});return {items:[],total:0};},
  $:s=>document.querySelector(s), $$:s=>[...document.querySelectorAll(s)],
  esc,titleCase:x=>x,formatMoney:x=>String(x),MODULES:{},badge:()=>'',emptyState:()=>'',pageHeader:()=>'',
  toast:(...args)=>notices.push(args),renderRoute:async()=>{},navigate:async(...args)=>routes.push(args)
});
document.querySelector('main').innerHTML=await feature.reportEngineView();
feature.bindReportDashboard();
const form=document.querySelector('[data-report-form]');
form.querySelector('[name=name]').value='Pipeline';
form.querySelector('[name=columns]').value='{bad json';
form.dispatchEvent(new dom.window.Event('submit',{cancelable:true}));
await new Promise(r=>setTimeout(r,0));
assert.equal(calls.length,1,'invalid report JSON must never be sent');
assert.equal(notices.at(-1)[0],'Could not save report');
form.querySelector('[name=columns]').value='["name","amount"]';
form.dispatchEvent(new dom.window.Event('submit',{cancelable:true}));
await new Promise(r=>setTimeout(r,0));
assert.equal(calls.at(-1).path,'/api/platform/reports');
assert.equal(calls.at(-1).options.method,'POST');
assert.deepEqual(JSON.parse(calls.at(-1).options.body).columns,['name','amount']);
assert.deepEqual(routes.at(-1),['/reports',true]);
document.querySelector('main').innerHTML=await feature.dashboardBuilderView();
feature.bindReportDashboard();
const dashboard=document.querySelector('[data-dashboard-form]');
dashboard.querySelector('[name=components]').value='{}';
const before=calls.length;
dashboard.dispatchEvent(new dom.window.Event('submit',{cancelable:true}));
await new Promise(r=>setTimeout(r,0));
assert.equal(calls.length,before,'non-list widgets must not be submitted');
assert.equal(notices.at(-1)[1],'Widgets must be a JSON list.');
console.log('Report and dashboard editor checks passed');
