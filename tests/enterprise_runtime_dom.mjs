import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {createEnterpriseRuntime} from '../static/js/features/enterprise-runtime.js';

const dom=new JSDOM('<body></body>',{url:'https://crm.example.test/setup/connections'});
globalThis.document=dom.window.document;
globalThis.location=dom.window.location;
globalThis.FormData=dom.window.FormData;
const calls=[];let saved=0;
let connected=false;let encrypted=false;
let sandbox={id:2,name:'Test sandbox',status:'Draft',revision:1,components:[]};
const api=async(url,options={})=>{
  const data=options.body?JSON.parse(options.body):undefined;
  calls.push({url,options,data});
  if(url==='/api/runtime/integrations'&&options.method==='POST'){connected=true;assert.equal(data.credentials.access_token,'secret-token');return{id:1};}
  if(url==='/api/runtime/integrations')return{providers:[{id:'gmail',label:'Gmail',available:true}],items:connected?[{id:1,name:'Work Gmail',provider:'gmail',status:'Not tested'}]:[],encryption_ready:true};
  if(url.endsWith('/items'))return{items:[],entity:'emails'};
  if(url.endsWith('/action')){assert.equal(data.confirmed,true);assert.ok(data.request_key);return{accepted:true};}
  if(url==='/api/runtime/sandboxes'&&options.method==='POST')return{id:2};
  if(url==='/api/runtime/sandboxes')return{items:[sandbox]};
  if(url==='/api/runtime/sandboxes/2'&&options.method==='PUT'){sandbox={...sandbox,components:data.components,revision:2};return{revision:2};}
  if(url==='/api/runtime/sandboxes/2')return sandbox;
  if(url.endsWith('/test'))return{valid:true,side_effects:false,rules:[]};
  if(url.endsWith('/promote')){sandbox={...sandbox,status:'Published',revision:3};return{revision:3};}
  if(url==='/api/runtime/encrypted-fields')return{items:[{id:7,name:'Secret value',module:'Customers',encrypted}]};
  if(url==='/api/runtime/encrypted-fields/7'){encrypted=data.encrypted;return{encrypted};}
  throw new Error('Unexpected API request: '+url);
};
let feature;
const render=async(resource,parts=[])=>{document.body.innerHTML=await feature.view(resource,parts);};
const navigate=async path=>{const parts=path.split('/').filter(Boolean);dom.reconfigure({url:'https://crm.example.test'+path});await render(parts[1],parts.slice(2));};
const messages=[];
feature=createEnterpriseRuntime({api,esc:value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),navigate,toast:(...args)=>messages.push(args),confirmDialog:async()=>true,markFormSaved:()=>saved++});
const wait=async predicate=>{for(let i=0;i<50;i++){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,5));}assert.fail('UI operation did not finish: '+JSON.stringify(messages));};
const fill=(name,value)=>{document.querySelector(`[name="${name}"]`).value=value;};
const submit=selector=>document.querySelector(selector).dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));

await render('connections',['new']);
fill('name','Work Gmail');fill('provider','gmail');fill('access_token','secret-token');
submit('[data-runtime-connect]');
await wait(()=>document.querySelector('[data-runtime-action-form]'));
assert.ok(!document.body.textContent.includes('secret-token'));
fill('from','sender@example.test');fill('to','recipient@example.test');fill('subject','Hello');fill('body','Confirmed message');
submit('[data-runtime-action-form]');
await wait(()=>messages.some(item=>item[0]==='Accepted by provider'));
assert.equal(calls.filter(call=>call.url.endsWith('/action')).length,1);

await navigate('/setup/sandboxes/2');
fill('components',JSON.stringify([{source_id:null,resource:'email_templates',values:{name:'Draft',subject:'Hello',content:'Draft body'}}]));
submit('[data-runtime-sandbox-save]');
await wait(()=>document.querySelector('[data-runtime-sandbox-save]')?.dataset.revision==='2');
assert.ok(saved>0);
submit('[data-runtime-sandbox-test]');
await wait(()=>document.querySelector('[data-runtime-test-result]').textContent.includes('"side_effects": false'));
document.querySelector('[data-runtime-promote]').click();
await wait(()=>document.querySelector('[data-runtime-sandbox-save]')?.dataset.revision==='3');

await navigate('/setup/protected_fields');
document.querySelector('[data-runtime-field]').click();
await wait(()=>document.body.textContent.includes('Remove encryption'));
assert.equal(encrypted,true);
assert.ok(!messages.some(item=>item[0]==='Operation failed'),messages);
console.log('Enterprise runtime DOM journeys passed');
