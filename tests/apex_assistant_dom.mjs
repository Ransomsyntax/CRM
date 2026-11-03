import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createAiFeature } from '../static/js/features/ai.js';

const dom = new JSDOM('<main></main>');
const document = dom.window.document;
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
let resolveRequest;
let calls = 0;
const api = async (url) => {
  if (url === '/api/ai/dashboard') return {totals:{}, performance:{}, journey:[]};
  calls++;
  return new Promise((resolve) => { resolveRequest = resolve; });
};
const feature = createAiFeature({state:{}, $, $$, esc, api,
  formatMoney:String, formatDateTime:String, pageHeader:()=>'',
  emptyState:()=>'<p>No records</p>', performanceTable:()=>''});
$('main').innerHTML = await feature.aiDashboardView();
feature.bindApexAssistant();
const form = $('[data-apex-assistant-form]');
const input = form.elements.question;
const submit = () => form.dispatchEvent(new dom.window.Event('submit', {bubbles:true, cancelable:true}));
submit();
assert.equal(calls, 0);
assert.match($('[data-apex-output]').textContent, /at least 3 characters/);
assert.equal(form.noValidate, true);
input.value = 'Show all deals';
submit();
assert.equal(calls, 1);
assert.equal($('[data-apex-output]').getAttribute('aria-busy'), 'true');
assert.ok($$('form button, [data-apex-prompt]').every((b) => b.disabled));
submit();
assert.equal(calls, 1, 'Repeated submission must not race or duplicate API calls');
resolveRequest({intent:'search', answer:'Found records', result:{results:[]}});
await new Promise((resolve) => setTimeout(resolve, 0));
assert.match($('[data-apex-output]').textContent, /Found records/);
assert.ok($$('form button, [data-apex-prompt]').every((b) => !b.disabled));
assert.equal($('[data-apex-output]').getAttribute('aria-busy'), null);
console.log('APEX form validation, loading controls, and duplicate-request guard passed');
