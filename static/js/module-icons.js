/* CONVOSIS minimal line-art icons: each sidebar module has a distinct SVG. */
(()=>{
const shapes={"dashboard":"<rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"2\"/><path d=\"M3 9h18M9 9v12M13 13h4m-4 4h4\"/>","leads":"<circle cx=\"12\" cy=\"12\" r=\"8\"/><circle cx=\"12\" cy=\"10\" r=\"2\"/><path d=\"M8.5 16c.6-2.5 6.4-2.5 7 0M12 1v3m0 16v3M1 12h3m16 0h3\"/>","contacts":"<circle cx=\"9\" cy=\"8\" r=\"3\"/><path d=\"M3 20v-2a6 6 0 0 1 12 0v2H3ZM16 5a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 5\"/>","accounts":"<rect x=\"7\" y=\"3\" width=\"10\" height=\"18\"/><path d=\"M7 9H3v12h18V9h-4M10 7h1m3 0h1m-5 4h1m3 0h1m-5 4h1m3 0h1m-4 6v-3h2v3\"/>","deals":"<path d=\"m2 8 5-4 4 2 3-1 8 5-4 8-3 1-3-2-2 1-3-2-2 1-4-5 1-4Z\"/><path d=\"m7 9 4 3 3-2 5 4m-9 4-3-3m6 2-3-3\"/>","tasks":"<rect x=\"4\" y=\"3\" width=\"16\" height=\"18\" rx=\"2\"/><path d=\"m7 8 1.5 1.5L11 7m2 1h4M7 15l1.5 1.5L11 14m2 1h4\"/>","meetings":"<rect x=\"3\" y=\"4\" width=\"18\" height=\"17\" rx=\"2\"/><path d=\"M7 2v4m10-4v4M3 9h18\"/><circle cx=\"9\" cy=\"14\" r=\"1.5\"/><circle cx=\"15\" cy=\"14\" r=\"1.5\"/><path d=\"M6 19c0-3 6-3 6 0m0 0c0-3 6-3 6 0\"/>","calls":"<path d=\"M6 3 3 6c-1 7 8 16 15 15l3-3-5-4-3 3c-3-1-5-3-6-6l3-3-4-5Z\"/><path d=\"M15 3c3 0 6 3 6 6m-6-3c1.5 0 3 1.5 3 3\"/>","products":"<path d=\"m12 2 9 5v10l-9 5-9-5V7l9-5Z\"/><path d=\"m3 7 9 5 9-5m-9 5v10M8 4l9 5\"/>","price_books":"<path d=\"M4 3h13a2 2 0 0 1 2 2v15H6a2 2 0 0 1-2-2V3Zm0 15a2 2 0 0 1 2-2h13\"/><path d=\"M8 7h6M8 11h4m4 1 4 4-4 4-4-4 4-4Z\"/>","vendors":"<path d=\"M3 10 5 4h14l2 6-2 3H5l-2-3Zm2 3v8h14v-8M9 21v-6h6v6M3 10h18\"/>","quotes":"<path d=\"M6 2h9l4 4v16H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z\"/><path d=\"M15 2v5h4M8 11h4m-4 4h8m-8 3h6\"/>","sales_orders":"<rect x=\"4\" y=\"3\" width=\"14\" height=\"18\" rx=\"2\"/><path d=\"M7 8h8M7 12h5m0 5h10m-3-3 3 3-3 3\"/>","purchase_orders":"<rect x=\"4\" y=\"4\" width=\"15\" height=\"17\" rx=\"2\"/><path d=\"M8 2h7v4H8zM8 10h7M8 14h4m5 0v8m-3-3 3 3 3-3\"/>","invoices":"<path d=\"M5 2h14v20l-3-2-4 2-4-2-3 2V2Z\"/><path d=\"M8 7h8M8 11h8m-5 3h3m-3 0c-3 2 4 2 1 4\"/>","campaigns":"<path d=\"m3 10 13-6v16L3 14v-4Zm13-2c6 0 6 8 0 8M6 15l2 6h4l-2-5\"/>","cases":"<path d=\"M4 5h16v5a2 2 0 0 0 0 4v5H4v-5a2 2 0 0 0 0-4V5Z\"/><path d=\"m9 12 2 2 4-4\"/>","solutions":"<path d=\"M9 18h6m-5 3h4M8 15c-6-5-3-12 4-12s10 7 4 12l-1 3H9l-1-3Z\"/><path d=\"m9 10 2 2 4-4\"/>","documents":"<path d=\"M6 3h10l4 4v14H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z\"/><path d=\"M16 3v5h4M8 12h8m-8 4h8\"/>","forecasts":"<path d=\"M3 21h18M5 18v-5h3v5m3 0V9h3v9m3 0V5h3v13M4 10l5-4 4 2 7-6\"/>","reports":"<path d=\"M6 2h9l4 4v16H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z\"/><path d=\"M15 2v5h4M8 17v-4m4 4V9m4 8v-6\"/>","ai":"<path d=\"M12 2 14 7l5 2-5 2-2 5-2-5-5-2 5-2 2-5Z\"/><path d=\"m19 15 .9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15Z\"/>","developer":"<rect x=\"2\" y=\"3\" width=\"20\" height=\"18\" rx=\"2\"/><path d=\"m9 9-3 3 3 3m6-6 3 3-3 3m-2-8-2 10\"/>","cpq":"<path d=\"M3 4h18v16H3zM3 9h18m-13 4h4m-4 4h8M16 13l2 2 3-3\"/>","security":"<path d=\"m12 2 9 4v6c0 6-4 9-9 10-5-1-9-4-9-10V6l9-4Z\"/><path d=\"m9 12 2 2 4-4\"/>","setup":"<path d=\"M4 4h16v16H4zM4 10h16M10 10v10\"/><path d=\"M7 7h.01M13 7h4M13 14h4m-4 3h2M7 14h.01M7 17h.01\"/>","setup-console":"<rect x=\"2\" y=\"3\" width=\"20\" height=\"18\" rx=\"2\"/><path d=\"M2 8h20M7 12v6m5-6v6m5-6v6\"/><circle cx=\"7\" cy=\"14\" r=\"2\"/><circle cx=\"12\" cy=\"17\" r=\"2\"/><circle cx=\"17\" cy=\"13\" r=\"2\"/>","subscriptions":"<path d=\"M12 2c4 3 6 7 5 13l-5 4-5-4C6 9 8 5 12 2Z\"/><circle cx=\"12\" cy=\"10\" r=\"2\"/><path d=\"M7 15 4 18l-1-5 4-3m10 5 3 3 1-5-4-3M10 20l2 3 2-3\"/>","site_visit":"<path d=\"M12 22s7-6.3 7-12a7 7 0 1 0-14 0c0 5.7 7 12 7 12Z\"/><path d=\"M9 10h6m-3-3v6\"/><circle cx=\"12\" cy=\"10\" r=\"4\"/>","sales_targets":"<circle cx=\"11\" cy=\"12\" r=\"9\"/><circle cx=\"11\" cy=\"12\" r=\"5\"/><circle cx=\"11\" cy=\"12\" r=\"1\"/><path d=\"m14 9 7-7m-4 0h4v4\"/>","payments":"<rect x=\"2\" y=\"5\" width=\"20\" height=\"14\" rx=\"2\"/><path d=\"M2 10h20M6 15h5\"/><circle cx=\"18\" cy=\"16\" r=\"3\"/>"};
const aliases={"site-visits":"site_visit","site_visits":"site_visit","sitevisit":"site_visit","sitevisit_reports":"site_visit","sales-targets":"sales_targets","sales-targets-incentives":"sales_targets","sales_targets_incentives":"sales_targets","payment":"payments","setup_console":"setup-console"};
function resolveIcon(link){
 const href=(link.getAttribute("href")||"").split("?")[0].replace(/\/$/,"").toLowerCase();
 const route=(link.getAttribute("data-route")||"").toLowerCase();
 const name=(link.textContent||"").trim().toLowerCase();
 const leaf=href.split("/").filter(Boolean).pop()||"";
 if(/site[ _-]?visits?/.test(name)||/site[-_]?visits?/.test(href))return "site_visit";
 if(/sales\s+targets?/.test(name)||/sales[-_]?targets?/.test(href))return "sales_targets";
 if(name==="payments"||/^\/payments(?:\/|$)/.test(href))return "payments";
 if(href.startsWith("/setup-console"))return "setup-console";
 if(href.startsWith("/subscriptions"))return "subscriptions";
 if(href==="/setup")return "setup";
 if(href==="/ai"||name.includes("apex ai"))return "ai";
 if(href.startsWith("/activities/") && shapes[leaf])return leaf;
 for(const key of [route,leaf]){const normalized=aliases[key]||key;if(shapes[normalized])return normalized;}
 return null;
}
function render(){
 document.querySelectorAll("#sidebar .primary-nav a[href]").forEach(link=>{
  const key=resolveIcon(link);
  const old=link.querySelector(".convosis-module-icon");
  if(!key){if(old)old.remove();return;}
  if(old&&old.dataset.iconKey===key)return;
  if(old)old.remove();
  const svg=document.createElementNS("http://www.w3.org/2000/svg","svg");
  svg.setAttribute("class","convosis-module-icon");
  svg.setAttribute("viewBox","0 0 24 24");
  svg.setAttribute("fill","none");
  svg.setAttribute("stroke","currentColor");
  svg.setAttribute("stroke-width","1.7");
  svg.setAttribute("stroke-linecap","round");
  svg.setAttribute("stroke-linejoin","round");
  svg.setAttribute("aria-hidden","true");
  svg.setAttribute("focusable","false");
  svg.dataset.iconKey=key;
  svg.innerHTML=shapes[key];
  link.prepend(svg);
 });
}
function init(){
 render();
 const sidebar=document.querySelector("#sidebar .primary-nav");
 if(sidebar){let scheduled=false;new MutationObserver(()=>{if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;render();});}).observe(sidebar,{childList:true,subtree:true,attributes:true,attributeFilter:["href","data-route"]});}
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
