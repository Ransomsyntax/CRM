// Source-level theme and icon regression smoke checks.
// Run with: node tests/theme_icon_regression.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const html=read('templates/index.html');
const icons=read('static/js/module-icons.js');
const iconCSS=read('static/css/module-icons.css');
const darkCSS=read('static/css/dark-theme.css');
const sidebarCSS=read('static/css/sidebar-collapse.css');
assert.match(html, /data-account-mode="light"/);
assert.match(html, /data-account-mode="dark"/);
assert.match(html, /data-account-mode="auto"/);
assert.match(html, /dataset\.crmTheme=resolved/, 'theme must resolve light/dark/auto');
assert.match(html, /localStorage\.setItem\(key,mode\)/, 'theme choice must persist');
assert.match(icons, /stroke","currentColor"/);
assert.match(icons, /new MutationObserver/, 'dynamic sidebar must update icons');
assert.match(icons, /old\.dataset\.iconKey===key/, 'avoid duplicating already matching icons');
assert.match(iconCSS, /\.convosis-module-icon/);
assert.match(iconCSS, /visibility: visible/);
assert.match(iconCSS, /stroke: currentColor/);
assert.match(darkCSS, /--crm-focus-ring/);
assert.match(darkCSS, /:focus-visible/);
assert.match(darkCSS, /::placeholder/);
assert.match(sidebarCSS, /crm-sidebar-collapsed/);
assert.match(html, /dark-theme\.css\?v=[^"\s]+/, 'load the versioned dark theme stylesheet');
assert.match(html, /module-icons\.css\?v=[^"\s]+/, 'load the versioned module icon stylesheet');
console.log('Theme/icon source regression smoke checks passed.');

