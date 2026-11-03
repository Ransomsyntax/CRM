"""Run the fallback drawer controller, including keyboard focus behavior."""
import shutil
import subprocess
from pathlib import Path

import pytest


def test_account_drawer_open_close_and_focus_loop():
    node = shutil.which('node')
    if not node:
        pytest.skip('Node is required for drawer controller checks')
    result = subprocess.run([node, '--input-type=module', '-'],
        cwd=Path(__file__).resolve().parents[1], text=True, capture_output=True,
        input=r"""
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const script = fs.readFileSync('templates/index.html','utf8').match(/<script data-account-drawer-bootstrap>([\s\S]*?)<\/script>/)[1];
let doc;
class Element {
  constructor(){this.hidden=true;this.style={removeProperty(){}};this.handlers={};this.attrs={};}
  addEventListener(type,handler){this.handlers[type]=handler;}
  setAttribute(name,value){this.attrs[name]=value;}
  focus(){doc.activeElement=this;}
  querySelector(selector){return selector.includes('strong')?{textContent:'Demo'}:selector.includes('small')?{textContent:'Sales rep'}:null;}
  querySelectorAll(){return [closeButton,lastButton];}
  getClientRects(){return [1];}
}
const ids=Object.fromEntries(['top-profile','crm-account-drawer','crm-account-mask','crm-account-close','crm-account-avatar','crm-account-name','crm-account-role'].map(id=>[id,new Element()]));
const trigger=ids['top-profile'], drawer=ids['crm-account-drawer'], closeButton=ids['crm-account-close'], lastButton=new Element();
closeButton.hidden=false;lastButton.hidden=false;
doc={activeElement:null,body:{style:{removeProperty(){}}},handlers:{},getElementById:id=>ids[id],addEventListener(type,handler){this.handlers[type]=handler;}};
vm.runInNewContext(script,{document:doc,fetch:async()=>({ok:false})});
const event=(key,shiftKey=false)=>({key,shiftKey,preventDefault(){this.prevented=true;},stopImmediatePropagation(){}});
trigger.handlers.click(event());
assert.equal(drawer.hidden,false);assert.equal(trigger.attrs['aria-expanded'],'true');
assert.equal(doc.activeElement,drawer);
doc.handlers.keydown(event('Tab'));assert.equal(doc.activeElement,closeButton);
doc.handlers.keydown(event('Tab',true));assert.equal(doc.activeElement,lastButton);
doc.handlers.keydown(event('Tab'));assert.equal(doc.activeElement,closeButton);
doc.handlers.keydown(event('Escape'));assert.equal(drawer.hidden,true);assert.equal(doc.activeElement,trigger);
trigger.handlers.click(event());ids['crm-account-mask'].handlers.click(event());assert.equal(drawer.hidden,true);
trigger.handlers.click(event());closeButton.handlers.click(event());assert.equal(drawer.hidden,true);
""")
    assert result.returncode == 0, result.stderr


def test_account_theme_modes_follow_system_and_restore_saved_preference():
    node = shutil.which('node')
    if not node:
        pytest.skip('Node is required for theme controller checks')
    result = subprocess.run([node, '--input-type=module', '-'],
        cwd=Path(__file__).resolve().parents[1], text=True, capture_output=True,
        input=r"""
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const script = fs.readFileSync('templates/index.html','utf8').match(/<script data-account-theme-controller>([\s\S]*?)<\/script>/)[1];
const store = new Map([['crm-account-theme','dark']]);
const media = {matches:false,addEventListener(type,callback){this.change=callback;}};
const buttons = ['light','dark','auto'].map(mode=>({dataset:{accountMode:mode},classList:{toggle(){}},setAttribute(){}}));
const document = {documentElement:{dataset:{}},querySelectorAll:()=>buttons,handlers:{},addEventListener(type,callback){this.handlers[type]=callback;}};
vm.runInNewContext(script,{document,window:{matchMedia:()=>media},localStorage:{getItem:key=>store.get(key),setItem:(key,value)=>store.set(key,value)}});
assert.equal(document.documentElement.dataset.crmTheme,'dark');
const select = mode=>document.handlers.click({target:{closest:()=>buttons.find(b=>b.dataset.accountMode===mode)},preventDefault(){},stopImmediatePropagation(){}});
select('light');assert.equal(document.documentElement.dataset.crmTheme,'light');
select('auto');assert.equal(document.documentElement.dataset.crmTheme,'light');
media.matches=true;media.change();assert.equal(document.documentElement.dataset.crmTheme,'dark');
assert.equal(document.documentElement.dataset.accountTheme,'auto');
assert.equal(store.get('crm-account-theme'),'auto');
""")
    assert result.returncode == 0, result.stderr
