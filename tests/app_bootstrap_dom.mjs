import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {JSDOM}=require('jsdom');
const dom=new JSDOM(await readFile(new URL('../templates/index.html',import.meta.url),'utf8'),{url:'https://example.test/subscriptions',pretendToBeVisual:true});
for(const key of ['window','document','location','history','localStorage','sessionStorage','MutationObserver','FormData','Event','Option'])globalThis[key]=dom.window[key];
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});
globalThis.requestAnimationFrame=dom.window.requestAnimationFrame.bind(dom.window);
globalThis.setInterval=()=>0;
const requests=[];
assert.equal(document.getElementById('sidebar-upgrade-plan').hidden,true,'plan actions stay hidden until the subscription is known');
assert.equal(document.getElementById('upgrade-plan-button').hidden,true);
assert.ok(!document.getElementById('breadcrumbs').textContent.includes('Dashboard'),'the initial shell must not claim every route is Dashboard');
globalThis.fetch=async path=>{
 requests.push(path);
 let body={items:[],total:0};
 if(path==='/api/platform/catalog')body={resources:{},groups:[]};
 if(path==='/api/settings/profile')body={id:1,name:'Test Admin',username:'admin',role:'Administrator',plan_name:'Enterprise',subscription:{plan_code:'enterprise',plan_name:'Enterprise'},owner_console_access:true};
 if(path==='/api/meta')body={};
 if(path==='/api/settings/general')body={};
 if(path==='/api/plans')body={items:[],plans:[],current_subscription:{plan_code:'enterprise',plan_name:'Enterprise'}};
 return new Response(JSON.stringify(body),{status:200});
};
await import('../static/js/app.js');
await new Promise(resolve=>setTimeout(resolve,100));
assert.ok(requests.includes('/api/settings/profile'),'application initialization must reach its authenticated API requests');
assert.ok(requests.includes('/api/plans'),'application must render its initial route');
assert.ok(!document.querySelector('#app-content').textContent.includes('Loading your workspace'),'startup must leave the initial loading shell');
assert.equal(document.getElementById('upgrade-plan-button').hidden,true,'Enterprise must keep upgrade actions hidden');
assert.equal(document.getElementById('sidebar-upgrade-plan').hidden,true);
const {createOrganizationSettings}=await import('../static/js/features/organization-settings.js');
const orgFeature=createOrganizationSettings({
  api:async path=>path==='/api/organization'?{membership_role:'Owner',name:'Test Org',id:1,slug:'test'}:
    path==='/api/organization/members'?{items:[{user_id:1,name:'Owner',email:'owner@example.test',membership_role:'Owner',status:'Active'},{user_id:2,name:'Member',email:'member@example.test',membership_role:'Member',status:'Active'}]}:{items:[]},
  state:{profile:{role:'Administrator'}},esc:value=>String(value??''),$:()=>null,$$:()=>[],toast:()=>{},renderRoute:()=>{}
});
const orgContainer=document.createElement('div');
orgContainer.innerHTML=await orgFeature.organizationManagementView();
assert.equal(orgContainer.querySelector('[data-org-transfer]'),null,'platform owner membership must never be transferable');
assert.ok([...orgContainer.querySelectorAll('option')].every(option=>option.value!=='Owner'),'Owner must never be assignable');
const {createWorkflowRulesUI}=await import('../static/js/features/workflow-rules.js');
const workflowCalls=[];
const workflowState={profile:{subscription:{features:{custom_functions:false}}}};
let optionalFailure=null;
const workflow=createWorkflowRulesUI({state:workflowState,esc:value=>String(value??''),toast:()=>{},navigate:()=>{},renderRoute:()=>{},api:async path=>{
  workflowCalls.push(path);
  if(path.includes('/functions') && optionalFailure)throw optionalFailure;
  return {items:[]};
}});
assert.ok((await workflow.view()).includes('data-wf-create'),'Free users must be able to open basic workflows');
assert.ok(!workflowCalls.some(path=>path.includes('/functions')),'Free workflow rendering must not request a paid function list');
workflowState.profile.subscription.features.custom_functions=true;
optionalFailure=Object.assign(new Error('Function permission denied'),{status:403});
assert.ok((await workflow.view()).includes('data-wf-create'),'Denied optional function access must not hide the workflow builder');
optionalFailure=Object.assign(new Error('Service unavailable'),{status:500});
await assert.rejects(()=>workflow.view(),/Service unavailable/);
dom.window.close();
console.log('Application bootstrap check passed');

