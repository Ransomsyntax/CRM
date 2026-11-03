"""Exercise real route code with out-of-order responses, without a browser install."""
from pathlib import Path
import subprocess


def test_slow_previous_route_cannot_replace_the_current_page():
    result = subprocess.run(['node', '--input-type=module', '-'],
        cwd=Path(__file__).resolve().parents[1], capture_output=True, text=True, input=r'''
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source = fs.readFileSync('static/js/app.js','utf8');
const routeCode = source.slice(source.indexOf('let routeRenderGeneration = 0;'),source.indexOf('async function dashboardView()'));
const noop = ()=>{};
const document = {querySelectorAll:()=>[],documentElement:{classList:{toggle:noop}},body:{classList:{toggle:noop}}};
const content = {innerHTML:'previous page',children:[{}],setAttribute:noop,removeAttribute:noop,querySelector:()=>null};
let finishOld;
const oldView = new Promise(resolve=>{finishOld=resolve});
const context = {window:{location:{pathname:'/dashboard'}},document,
  state:{platformCatalog:{resources:{}}},$:selector=>selector==='#app-content'?content:null,
  activeNav:noop,refreshNavCount:noop,ensureLookups:async()=>{},setBreadcrumb:noop,
  blockedPlanRoute:()=>null, loading:()=>'<loading>',dashboardView:()=>oldView,reportEngineView:async()=>'<reports>',
  bindDashboard:noop,bindReportDashboard:noop,usability:{enhance:noop},MODULES:{},
  PLATFORM_MODULE_ROUTES:[],viewError:()=>({title:'Old error'}),esc:String};
vm.createContext(context);
vm.runInContext(routeCode,context);
const first = context.renderRoute();
await new Promise(setImmediate);
assert.equal(content.innerHTML,'<loading>');
context.window.location.pathname='/reports';
await context.renderRoute();
assert.equal(content.innerHTML,'<reports>');
finishOld('<dashboard>');
await first;
assert.equal(content.innerHTML,'<reports>');
// An obsolete failing request must not replace the current page either.
let failOld;
context.dashboardView = ()=>new Promise((_,reject)=>{failOld=reject});
context.window.location.pathname='/dashboard';
const failed = context.renderRoute();
await new Promise(setImmediate);
context.window.location.pathname='/reports';
await context.renderRoute();
failOld(new Error('Old server failure'));
await failed;
assert.equal(content.innerHTML,'<reports>');
''')
    assert result.returncode == 0, result.stderr


def test_request_freshness_and_new_activity_dates_preserve_presets():
    result = subprocess.run(['node', '--input-type=module', '-'],
        cwd=Path(__file__).resolve().parents[1], capture_output=True, text=True, input=r'''
import assert from 'node:assert/strict';
import {requestJson} from './static/js/core/http.js';
import {activityDefaults} from './static/js/features/usability.js';
let sent;
globalThis.fetch = async (_,options)=>{sent=options;return {ok:true,text:async()=>'{}'}};
await requestJson('/api/leads',{cache:'force-cache'});
assert.equal(sent.cache,'no-store');
const created=activityDefaults('/activities/tasks',{},3);
assert.match(created.start_at,/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
assert.equal(created.start_at,created.due_at);
const existing=activityDefaults('/activities/tasks',{start_at:'2026-12-31T10:15',due_at:null},3);
assert.equal(existing.start_at,'2026-12-31T10:15');
assert.equal(existing.due_at,null);
''')
    assert result.returncode == 0, result.stderr

