/* Zoho-inspired Webforms builder for CONVOSIS CRM.
 * Progressive enhancement of the existing platform record form.
 * Does not replace authentication, persistence or public submission backend.
 */
(() => {
  "use strict";
const crmDialogService = () => import("/static/js/core/dialogs.js?v=20261027-centered-popups-v1");
const alertDialog = async (...args) => (await crmDialogService()).alertDialog(...args);

  const CSS = `
  html[data-crm-theme="dark"] .zfw-dialog,html[data-crm-theme="dark"] .zfw-shell{color:#172944!important} 
  .zfw-dialog,.zfw-dialog *{color:#172944} .zfw-dialog h2,.zfw-dialog p,.zfw-dialog .zfw-hint{color:#273a58!important} .zfw-dialog select,.zfw-dialog textarea{background:#fff!important;color:#182a46!important;border:1px solid #c7cfe0!important} .zfw-dialog .zfw-btn{background:#fff!important;color:#2859cb!important} .zfw-shell .zfw-sidebar,.zfw-shell .zfw-sidebar b{color:#fff!important} .zfw-canvas .zfw-field label,.zfw-properties h3,.zfw-properties label{color:#172944!important} .zfw-shell .zfw-work,.zfw-shell .zfw-properties{color:#172944!important} .zfw-shell input,.zfw-shell select,.zfw-shell textarea{color:#172944!important;background:#fff!important} .zfw-shell .zfw-btn{color:#2859cb!important} .zfw-shell .zfw-primary{color:white!important;background:#305de8!important}

  .zfw-shell{border:1px solid #dce3f0;border-radius:12px;overflow:hidden;background:#f4f6fb;margin:10px 0 24px;color:#12223f;font:13px Arial,sans-serif}
  .zfw-top{display:flex;align-items:center;justify-content:space-between;padding:13px 18px;background:#fff;border-bottom:1px solid #d6dce8;gap:12px;flex-wrap:wrap}
  .zfw-top strong{font-size:19px}.zfw-top button,.zfw-sidebar button,.zfw-tools button,.zfw-actions button{cursor:pointer}
  .zfw-btn{border:1px solid #b9c7ed;border-radius:5px;background:#fff;padding:8px 13px;color:#2754bc}.zfw-primary{background:#305de8;color:white;border-color:#305de8}
  .zfw-layout{display:grid;grid-template-columns:244px minmax(310px,1fr) 240px;min-height:550px}
  .zfw-sidebar{background:#1f2b47;padding:17px;color:#fff;max-height:630px;overflow:auto}
  .zfw-sidebar input,.zfw-sidebar select{box-sizing:border-box;width:100%;padding:9px;margin:9px 0 13px;border:1px solid #77839e;border-radius:4px;background:#fff;color:#1b2742}
  .zfw-palette{display:flex;flex-direction:column;gap:5px}.zfw-palette button{background:#fff;border:1px solid #bec7d7;text-align:left;padding:9px 11px;color:#243451;border-radius:4px}
  .zfw-work{min-width:0;padding:0 18px 25px;overflow:auto}
  .zfw-tools{display:flex;justify-content:center;align-items:center;gap:7px;background:#fff;border:1px solid #d4dbe8;border-radius:4px;padding:8px;margin:12px auto;max-width:max-content;flex-wrap:wrap}
  .zfw-tools select,.zfw-tools input{max-width:110px;border:1px solid #cbd2e1;padding:5px}
  .zfw-canvas{max-width:690px;margin:0 auto;min-height:360px;background:#fff;box-shadow:0 2px 10px #182c4b1b;border-radius:4px;padding:29px 35px}
  .zfw-field{display:grid;grid-template-columns:minmax(100px,40%) 1fr;gap:12px;align-items:center;padding:8px;border:1px solid transparent;border-radius:4px;cursor:pointer}
  .zfw-field:hover,.zfw-field[aria-selected=true]{border-color:#87a1ec;background:#f2f5ff}.zfw-field label{font-size:13px;color:#152744}
  .zfw-field label b{color:#f05b60}.zfw-field input,.zfw-field select,.zfw-field textarea{width:100%;box-sizing:border-box;border:1px solid #c7cfdd;background:#fff;border-radius:2px;min-height:32px;padding:5px 8px;color:#1b2f4c}
  .zfw-properties{background:#fff;border-left:1px solid #d9dfeb;padding:16px;max-height:630px;overflow:auto}
  .zfw-properties h3{margin:0 0 14px;font-size:16px}.zfw-properties label{display:block;margin:10px 0 4px;font-weight:600}
  .zfw-properties input:not([type=checkbox]),.zfw-properties select{width:100%;box-sizing:border-box;border:1px solid #cbd3e1;padding:8px;border-radius:4px}
  .zfw-properties .zfw-inline{display:flex;align-items:center;gap:8px;margin:12px 0}
  .zfw-properties .zfw-inline input{width:auto}.zfw-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:15px}
  .zfw-hint{font-size:12px;color:#63718b;margin:9px 0}.zfw-bottom{padding:12px;background:#fff;border-top:1px solid #e0e5ed}
  .zfw-preview{position:fixed;inset:0;background:#111b2d99;z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px}
  .zfw-dialog{background:white;width:min(780px,95vw);max-height:90vh;overflow:auto;padding:25px;border-radius:14px;box-shadow:0 14px 40px #0003}
  .zfw-dialog h2{margin:0 0 12px}.zfw-format{margin:12px 0;padding:8px;width:100%;border:1px solid #bec9e2}
  .zfw-output{width:100%;min-height:145px;box-sizing:border-box;font:12px monospace;border:1px solid #cbd3e4;border-radius:6px;padding:10px}
  .zfw-preview-fields{max-width:600px;margin:18px auto;padding:22px;background:white;box-shadow:0 2px 12px #0001}
  .zfw-preview-fields .zfw-field{cursor:default}.zfw-hidden-source{display:none!important}
  @media(max-width:1050px){.zfw-layout{grid-template-columns:190px 1fr}.zfw-properties{grid-column:1/-1;max-height:none;border-top:1px solid #ddd}.zfw-sidebar{max-height:560px}}
  @media(max-width:650px){.zfw-layout{display:block}.zfw-sidebar{max-height:250px}.zfw-canvas{padding:12px}.zfw-field{grid-template-columns:1fr}.zfw-top{padding:10px}}

  /* Zoho-style editor surface: self-contained light appearance in either CRM theme. */
  .zfw-shell{width:100%;max-width:none!important;box-sizing:border-box;border-radius:0!important;background:#f5f7fa!important;color:#13243e!important}
  .zfw-shell .zfw-top{background:#fff!important;border-bottom:1px solid #dbe2ed!important}
  .zfw-shell .zfw-layout{grid-template-columns:258px minmax(360px,1fr) 255px!important;min-height:620px}
  .zfw-shell .zfw-sidebar{background:#202b45!important;color:#fff!important;padding:22px 18px!important}
  .zfw-shell .zfw-palette button{background:#fff!important;color:#24344d!important;border-radius:3px;min-height:32px;user-select:none;touch-action:none}
  .zfw-shell .zfw-palette button:hover{background:#e8eefc!important;border-color:#315ee7!important}
  .zfw-shell .zfw-work{background:#f7f8fc!important;padding:0 16px 20px}
  .zfw-shell .zfw-canvas{background:#fff!important;border:1px solid #e9edf3;min-height:470px!important;box-shadow:0 2px 10px #14213618;margin-top:15px;padding:25px 28px!important}
  .zfw-shell .zfw-tools{background:#fff!important;box-shadow:0 3px 9px #14213618}
  .zfw-shell .zfw-properties{background:#fff!important;color:#1b2c47!important}
  .zfw-shell .zfw-field{grid-template-columns:36% 1fr!important;min-height:36px;touch-action:pan-y}
  .zfw-shell .zfw-field[aria-selected="true"]{background:#f1f5ff!important;outline:1px solid #8ca9ee}
  .zfw-shell .zfw-field.zfw-drop-target{border:2px dashed #3160e9!important;background:#e5efff!important}
  .zfw-shell .zfw-canvas.zfw-drag-over{outline:2px dashed #315ee7;outline-offset:-7px}
  .zfw-shell .zfw-field label,.zfw-shell .zfw-properties label,.zfw-shell .zfw-properties h3{color:#152744!important}
  .zfw-shell .zfw-sidebar b,.zfw-shell .zfw-sidebar label{color:white!important}
  .zfw-shell input,.zfw-shell textarea,.zfw-shell select{color:#1c2b44!important;background:#fff!important}
  .zfw-dialog,.zfw-dialog *{color:#152742!important}
  .zfw-dialog{background:#fff!important;border:1px solid #dce2ef!important;box-shadow:0 14px 45px #0003!important}
  .zfw-dialog p,.zfw-dialog h2,.zfw-dialog label,.zfw-dialog .zfw-hint{color:#1b2a43!important}
  .zfw-dialog select,.zfw-dialog textarea,.zfw-dialog input{background:#fff!important;color:#162944!important;border:1px solid #bfc9dc!important}
  .zfw-dialog .zfw-btn.zfw-primary{background:#315ee8!important;color:white!important}
  @media(max-width:1100px){.zfw-shell .zfw-layout{grid-template-columns:210px minmax(0,1fr)!important}.zfw-shell .zfw-properties{grid-column:1/-1}}
  @media(max-width:680px){.zfw-shell .zfw-layout{display:block!important}.zfw-shell .zfw-field{grid-template-columns:1fr!important}}

/* Zoho-style centered Webform editor and preview */
.zfw-shell{width:100%!important;max-width:none!important;border:0!important;background:#f4f6fb!important}
.zfw-shell .zfw-top{background:white!important;border:1px solid #d8dfed!important;border-radius:9px 9px 0 0}
.zfw-shell .zfw-layout{display:grid!important;grid-template-columns:235px minmax(0,1fr) 250px!important;min-height:650px!important}
.zfw-shell .zfw-work{min-width:0!important;background:#f5f7fc!important;padding:15px 24px 35px!important}
.zfw-shell .zfw-canvas{width:min(100%,730px)!important;max-width:730px!important;margin:28px auto!important;padding:32px 36px!important;background:white!important;box-shadow:0 5px 19px #13253c26!important}
.zfw-shell .zfw-sidebar{background:#202b45!important;color:white!important}
.zfw-shell .zfw-properties{background:white!important}
.zfw-shell .zfw-bottom{background:white!important;margin:0 auto!important;max-width:730px!important;border:1px solid #d9e1f1!important}
.zfw-shell .zfw-field{grid-template-columns:35% minmax(0,1fr)!important;gap:16px!important;padding:7px 6px!important}
.zfw-shell .zfw-field label{color:#182b48!important}
.zfw-shell .zfw-field input,.zfw-shell .zfw-field select{height:34px!important;border:1px solid #c5cdda!important;border-radius:3px!important;color:#152945!important;background:white!important}
.zfw-shell .zfw-dialog{background:white!important;color:#192c48!important}
.zfw-shell .zfw-tools{background:white!important}
@media(max-width:1100px){.zfw-shell .zfw-layout{grid-template-columns:210px minmax(0,1fr)!important}.zfw-shell .zfw-properties{grid-column:1/-1!important}}
@media(max-width:680px){.zfw-shell .zfw-layout{display:block!important}.zfw-shell .zfw-field{grid-template-columns:1fr!important}}
body:has(.zfw-shell) .field:has(select[name="target_module"]),body:has(.zfw-shell) .field:has(select[name="status"]),body:has(.zfw-shell) .field:has(select[name="owner_id"]),body:has(.zfw-shell) .field:has(select[name="spam_protection"]),body:has(.zfw-shell) .field:has(input[name="redirect_url"]),body:has(.zfw-shell) .field:has(textarea[name="redirect_url"]){display:none!important}

/* Consolidated layout guard: the editor must never inherit record-field column widths. */
#modal-body:has(.zfw-shell){width:100%!important;max-width:none!important;min-width:0!important}
#modal-body:has(.zfw-shell)>.form-grid{width:100%;min-width:0}
#modal-body:has(.zfw-shell)>.form-grid>.field{max-width:none}
#modal-body:has(.zfw-shell)>.crm-platform-layout-label{display:none!important}
.zfw-shell,.zfw-shell *{box-sizing:border-box}
.zfw-shell{display:block;min-width:0!important;max-width:100%!important;margin:14px 0 22px!important;overflow:hidden!important}
.zfw-shell .zfw-top{min-width:0;display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.zfw-shell .zfw-top .zfw-actions{margin:0 0 0 auto}
.zfw-shell .zfw-layout{display:grid!important;grid-template-columns:minmax(185px,225px) minmax(0,1fr) minmax(215px,255px)!important;width:100%;min-width:0}
.zfw-shell .zfw-sidebar,.zfw-shell .zfw-properties{min-width:0;max-height:none!important;overflow-x:hidden}
.zfw-shell .zfw-work{min-width:0!important;overflow-x:hidden!important;padding:16px!important}
.zfw-shell .zfw-canvas{width:100%!important;max-width:700px!important;min-width:0!important;padding:22px!important;margin:15px auto!important}
.zfw-shell .zfw-field{display:grid!important;grid-template-columns:minmax(95px,35%) minmax(0,1fr)!important;gap:12px!important;min-width:0}
.zfw-shell .zfw-field>*{min-width:0;max-width:100%}
.zfw-shell .zfw-field label{overflow-wrap:anywhere}
.zfw-shell .zfw-tools{max-width:100%!important;width:max-content;min-width:0}
.zfw-shell .zfw-tools select{max-width:90px}
.zfw-shell .zfw-palette button[hidden]{display:none!important}
.zfw-shell .zfw-bottom{max-width:700px!important;width:100%!important}
.zfw-shell button:focus-visible,.zfw-shell input:focus-visible,.zfw-shell select:focus-visible{outline:2px solid #3562e9;outline-offset:2px}
@media(max-width:1250px){
 .zfw-shell .zfw-layout{grid-template-columns:minmax(170px,205px) minmax(0,1fr)!important}
 .zfw-shell .zfw-properties{grid-column:1/-1!important;border-left:0;border-top:1px solid #d9dfeb;display:block}
 .zfw-shell .zfw-work{padding:12px!important}
}
@media(max-width:650px){
 .zfw-shell .zfw-layout{display:flex!important;flex-direction:column}
 .zfw-shell .zfw-sidebar{max-height:230px!important}
 .zfw-shell .zfw-canvas{padding:13px!important}
 .zfw-shell .zfw-field{grid-template-columns:1fr!important;gap:5px!important}
 .zfw-shell .zfw-top .zfw-actions{margin-left:0}
}

/* Reference-style single canvas: no palette sidebar, color tools or properties inspector. */
.zfw-shell .zfw-layout{display:block!important;min-height:0!important;background:#f0f4fa!important;padding:22px 20px 28px}
.zfw-shell .zfw-sidebar,.zfw-shell .zfw-properties,.zfw-shell .zfw-tools{display:none!important}
.zfw-shell .zfw-work{padding:0!important;max-width:960px;margin:auto;background:transparent!important}
.zfw-shell .zfw-canvas{width:min(100%,720px)!important;max-width:720px!important;margin:10px auto 16px!important;padding:32px 38px!important;border-radius:9px!important;box-shadow:0 5px 22px #1e345025!important}
.zfw-shell .zfw-field{grid-template-columns:minmax(130px,34%) minmax(0,1fr)!important;gap:18px!important;padding:8px 10px!important;border-radius:5px}
.zfw-shell .zfw-field input,.zfw-shell .zfw-field select,.zfw-shell .zfw-field textarea{height:37px!important;min-height:37px!important;border-radius:5px!important}
.zfw-shell .zfw-bottom{max-width:720px!important;border-radius:6px;padding:16px 22px!important;display:flex;align-items:center;flex-wrap:wrap;gap:10px}
.zfw-shell .zfw-bottom>label{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.zfw-shell .zfw-bottom select{width:200px;max-width:100%;border:1px solid #ccd6e8;border-radius:5px;padding:8px}
.zfw-shell .zfw-bottom .zfw-actions{margin:0;flex:1 1 100%;justify-content:flex-end}
.zfw-shell .zfw-bottom .zfw-hint{flex:1 1 100%;margin:3px 0}
.zfw-shell .zfw-title-switch{margin-left:auto}
.zfw-shell .zfw-top{padding:17px 22px!important}
.zfw-shell .zfw-top strong{font-size:20px}
@media(max-width:650px){.zfw-shell .zfw-layout{padding:12px 8px}.zfw-shell .zfw-canvas{padding:17px!important}.zfw-shell .zfw-field{grid-template-columns:1fr!important;gap:6px!important}}

/* Full-width, centered Zoho reference workspace */
body:has(.zfw-shell) #modal-body,body:has(.zfw-shell) #modal-body>.form-grid{width:100%!important;max-width:none!important}
body:has(.zfw-shell) #modal-body .form-grid:has(.zfw-hidden-source){display:none!important}
.zfw-shell{margin:0!important;border:1px solid #d9dfeb!important;border-radius:12px!important}
.zfw-shell .zfw-top{padding:18px 24px!important}
.zfw-shell .zfw-top strong{font-size:23px!important}
.zfw-shell .zfw-top small{display:none}
.zfw-shell .zfw-layout{padding:22px 28px 42px!important;background:#f5f7fc!important;position:relative!important;min-height:580px!important}
.zfw-shell .zfw-work{max-width:none!important;width:100%!important}
.zfw-shell .zfw-canvas{width:min(100%,750px)!important;max-width:750px!important;min-height:500px!important;margin:12px auto!important;padding:34px 42px!important;border-radius:7px!important}
.zfw-shell .zfw-bottom{max-width:750px!important;background:transparent!important;border:0!important;box-shadow:none!important}
.zfw-shell .zfw-bottom .zfw-actions{justify-content:center!important}
.zfw-shell .zfw-top .zfw-actions{display:none!important}
.zfw-shell .zfw-rail{position:absolute;right:20px;top:35px;display:flex;flex-direction:column;gap:13px;z-index:3}
.zfw-shell .zfw-rail button{width:53px;height:53px;border-radius:50%;background:#60708e!important;color:#fff!important;border:0!important;box-shadow:0 3px 8px #172c4b40;cursor:pointer;font-size:21px}
.zfw-shell .zfw-rail button:hover{background:#3f5784!important}
.zfw-shell .zfw-field[aria-selected=true]{outline:1px solid #a0b7ff}
body:has(.zfw-shell) .field:has([name="name"]),body:has(.zfw-shell) .field:has([name="target_module"]){display:none!important}
@media(max-width:700px){.zfw-shell .zfw-layout{padding:12px 8px 90px!important}.zfw-shell .zfw-rail{top:auto;bottom:12px;right:12px;flex-direction:row}.zfw-shell .zfw-rail button{width:43px;height:43px}}

.zfw-shell .zfw-layout{padding-right:90px!important}
.zfw-shell .zfw-top .zfw-actions{display:none!important}
.zfw-shell .zfw-rail{display:flex!important;position:absolute;top:34px;right:20px;flex-direction:column;gap:13px}
.zfw-shell .zfw-rail button{width:54px;height:54px;padding:13px;border-radius:50%;background:white!important;border:1px solid #d6dfef!important;box-shadow:0 3px 10px #18304a1c}
.zfw-shell .zfw-rail button svg{display:block;width:100%;height:100%;fill:none;stroke:#254caa;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round}
.zfw-shell .zfw-rail button[aria-pressed=true]{background:#e7efff!important;border-color:#7c9ded!important}
.zfw-shell[data-mode=preview] .zfw-bottom{display:none!important}
.zfw-shell[data-mode=preview] .zfw-field{cursor:default!important}
.zfw-shell[data-mode=preview] .zfw-field[aria-selected=true]{outline:0!important;background:transparent!important;border-color:transparent!important}
.zfw-shell[data-mode=preview] .zfw-field input,.zfw-shell[data-mode=preview] .zfw-field select,.zfw-shell[data-mode=preview] .zfw-field textarea{pointer-events:none}
body:has(.zfw-shell[data-mode=preview]) #modal-submit{display:none!important}
@media(max-width:700px){.zfw-shell .zfw-layout{padding:14px 10px 85px!important}.zfw-shell .zfw-rail{top:auto;bottom:12px;right:12px;flex-direction:row}.zfw-shell .zfw-rail button{width:44px;height:44px;padding:10px}}

/* Action bar is deliberately in normal document flow, never in a clipped rail. */
.zfw-shell .zfw-top{display:flex!important;justify-content:space-between!important;align-items:center!important;gap:14px!important}
.zfw-shell .zfw-top .zfw-header-actions{display:flex!important;visibility:visible!important;opacity:1!important;position:static!important;margin:0 0 0 auto!important;flex-wrap:wrap!important;gap:9px!important}
.zfw-shell .zfw-header-actions button{display:inline-flex!important;align-items:center;justify-content:center;gap:7px;min-width:0;min-height:39px;padding:8px 11px!important;background:#fff!important;color:#1f4daf!important;border:1px solid #bacced!important;border-radius:7px;cursor:pointer}
.zfw-shell .zfw-header-actions button svg{display:block;width:18px;height:18px;flex-shrink:0;fill:none;stroke:currentColor;stroke-width:2.3;stroke-linecap:round;stroke-linejoin:round}
.zfw-shell .zfw-header-actions button[data-zfw=publish]{background:#315ee8!important;color:#fff!important}
.zfw-shell .zfw-layout{padding-right:28px!important}
@media(max-width:850px){.zfw-shell .zfw-top .zfw-header-actions{margin-left:0!important;width:100%;justify-content:flex-start}.zfw-shell .zfw-header-actions button span{font-size:12px}}

/* Four persistent icon actions matching the supplied reference controls. */
.zfw-shell .zfw-top .zfw-header-actions{display:none!important}
.zfw-shell .zfw-layout{position:relative!important;padding-right:90px!important}
.zfw-shell .zfw-rail{display:flex!important;position:sticky!important;float:right!important;top:112px!important;margin-right:-72px!important;width:54px!important;z-index:9!important;flex-direction:column!important;gap:12px!important}
.zfw-shell .zfw-rail button{display:grid!important;place-items:center!important;width:54px!important;height:54px!important;min-width:54px!important;border:1px solid #d0dcec!important;border-radius:50%!important;background:#fff!important;color:#174cbe!important;cursor:pointer!important;box-shadow:0 3px 10px #19294322!important;padding:12px!important}
.zfw-shell .zfw-rail button svg{display:block!important;width:100%!important;height:100%!important;fill:none!important;stroke:currentColor!important;stroke-width:2.3!important;stroke-linecap:round!important;stroke-linejoin:round!important}
.zfw-shell .zfw-rail button:hover,.zfw-shell .zfw-rail button:focus-visible{background:#eaf1ff!important;border-color:#7097f4!important}
.zfw-shell[data-mode="edit"] .zfw-rail button[data-zfw="edit"]{background:#315ee8!important;color:#fff!important}
.zfw-shell[data-mode="preview"] .zfw-bottom{display:none!important}
.zfw-shell[data-mode="preview"] .zfw-field{outline:none!important;background:#fff!important;border-color:transparent!important;cursor:default!important}
.zfw-shell[data-mode="preview"] .zfw-field input,.zfw-shell[data-mode="preview"] .zfw-field textarea{pointer-events:none!important}.zfw-shell[data-mode="preview"] .zfw-field select{pointer-events:auto!important;cursor:pointer!important}
@media(max-width:700px){.zfw-shell .zfw-layout{padding:12px 10px 80px!important}.zfw-shell .zfw-rail{top:auto!important;bottom:12px!important;right:12px!important;flex-direction:row!important}.zfw-shell .zfw-rail button{width:44px!important;height:44px!important;min-width:44px!important;padding:9px!important}}

.zfw-shell .zfw-choice-editor{display:grid;gap:8px;width:100%;padding:14px 18px;border:1px solid #d8e1f1;border-radius:8px;background:white}
.zfw-shell .zfw-choice-editor textarea{width:100%;min-height:105px;border:1px solid #cbd7e9;border-radius:6px;padding:10px;font:inherit}
.zfw-shell .zfw-choice-editor button{justify-self:start}

/* Webform action controls: single floating rail */
.zfw-shell .zfw-rail{display:flex!important;position:absolute!important;top:38px!important;right:20px!important;flex-direction:column!important;gap:14px!important;z-index:20!important;visibility:visible!important;opacity:1!important;overflow:visible!important}
.zfw-shell .zfw-rail button{display:grid!important;place-items:center!important;width:55px!important;height:55px!important;padding:12px!important;background:#fff!important;border:1px solid #cad5e7!important;border-radius:50%!important;cursor:pointer!important;box-shadow:0 3px 12px #172d4938!important}
.zfw-shell .zfw-rail button img{display:block!important;width:30px!important;height:30px!important;object-fit:contain!important;pointer-events:none}
.zfw-shell .zfw-rail button:hover{background:#eaf0ff!important}
.zfw-shell .zfw-top .zfw-header-actions{display:none!important}
.zfw-shell[data-mode=preview] .zfw-bottom{display:none!important}
.zfw-shell[data-mode=edit] .zfw-bottom{display:flex!important}
@media(max-width:700px){.zfw-shell .zfw-rail{top:auto!important;bottom:12px!important;right:12px!important;flex-direction:row!important}.zfw-shell .zfw-rail button{width:44px!important;height:44px!important;padding:9px!important}.zfw-shell .zfw-rail button img{width:25px!important;height:25px!important}}

body:has(.zfw-shell[data-mode="edit"]) #modal-body .field:has(input[name="name"]){display:flex!important;visibility:visible!important}
body:has(.zfw-shell[data-mode="edit"]) #modal-body .field:has(input[name="name"]) input{display:block!important;min-height:42px!important;width:100%!important}
body:has(.zfw-shell[data-mode="preview"]) #modal-body .field:has(input[name="name"]){display:none!important}

/* Visibility repair: form content may be wider than viewport.
   Anchor actions to viewport instead of overflow-clipped canvas. */
.zfw-shell .zfw-rail{position:fixed!important;top:190px!important;right:22px!important;left:auto!important;bottom:auto!important;transform:none!important;display:flex!important;flex-direction:column!important;z-index:10020!important;pointer-events:auto!important}
.zfw-shell .zfw-layout{overflow:visible!important}
.zfw-shell .zfw-rail button{flex-shrink:0!important;opacity:1!important;visibility:visible!important}
@media(max-width:700px){.zfw-shell .zfw-rail{top:auto!important;bottom:18px!important;right:14px!important;flex-direction:row!important;gap:8px!important}}

.zfw-name-editor{display:flex;align-items:center;gap:13px;padding:16px 24px;background:white;border-bottom:1px solid #dce4f1}
.zfw-name-editor[hidden]{display:none!important}
.zfw-name-editor label{font-weight:600;color:#243654;min-width:105px}
.zfw-name-editor input{min-width:0;flex:1;max-width:520px;border:1px solid #bfcde4;border-radius:6px;padding:11px;font:inherit;color:#172d4d}
.zfw-name-editor span{color:#d34444}
@media(max-width:650px){.zfw-name-editor{align-items:stretch;flex-direction:column}.zfw-name-editor label{min-width:0}}

/* Stable in-workspace toolbar: do not anchor buttons to the browser viewport. */
.zfw-shell{overflow:visible!important}
.zfw-shell .zfw-layout{position:relative!important;overflow:visible!important;display:flow-root!important;padding-right:94px!important}
.zfw-shell .zfw-rail{position:sticky!important;float:right!important;top:112px!important;right:auto!important;left:auto!important;bottom:auto!important;margin:0 -76px 0 0!important;width:56px!important;min-width:56px!important;z-index:40!important;display:flex!important;flex-direction:column!important;gap:12px!important;visibility:visible!important;opacity:1!important;transform:none!important}
.zfw-shell .zfw-rail button{width:54px!important;height:54px!important;min-width:54px!important;min-height:54px!important;display:grid!important;place-items:center!important;opacity:1!important}
.zfw-shell .zfw-rail button img{width:30px!important;height:30px!important;display:block!important}
@media(max-width:700px){.zfw-shell .zfw-layout{padding-right:14px!important;padding-bottom:90px!important}.zfw-shell .zfw-rail{position:sticky!important;top:8px!important;float:none!important;flex-direction:row!important;width:max-content!important;min-width:0!important;margin:0 0 12px auto!important}.zfw-shell .zfw-rail button{width:43px!important;height:43px!important;min-width:43px!important;min-height:43px!important}}

.zfw-shell .zfw-choice-editor{display:grid;gap:9px;max-width:100%;background:#eef3fc;border:1px solid #d9e3f5;border-radius:8px;padding:14px}
.zfw-shell .zfw-option-list{max-height:240px;overflow:auto;display:grid;gap:8px;padding:3px}
.zfw-shell .zfw-option-row{display:flex;align-items:center;gap:8px;min-width:0}
.zfw-shell .zfw-option-grip{cursor:grab;color:#8794a8;flex:none;font-size:20px}
.zfw-shell .zfw-option-input{flex:1;min-width:0;width:100%;height:42px;background:#fff;border:1px solid #d2ddee;border-radius:4px;padding:8px 10px;font:inherit}
.zfw-shell .zfw-option-input:focus{outline:2px solid #83a1ff}
.zfw-shell .zfw-option-actions{display:flex;gap:5px;flex:none}
.zfw-shell .zfw-option-actions button{border:1px solid #9caec7;border-radius:50%;width:31px;height:31px;background:#fff;color:#536b91;cursor:pointer;font-size:19px;padding:0}
.zfw-shell .zfw-option-note{font-size:12px;color:#718096}.zfw-shell .zfw-option-note button{border:0;background:transparent;color:#315ee8;cursor:pointer}
@media(max-width:600px){.zfw-shell .zfw-option-row{flex-wrap:wrap}.zfw-shell .zfw-option-actions{margin-left:auto}}

.zfw-shell .zfw-field textarea{min-height:96px!important;height:auto!important;resize:vertical!important;padding:10px!important}

/* Theme-safe Webforms surfaces: override global CRM form rules only inside the builder. */
html[data-crm-theme="dark"] .zfw-shell,
html[data-crm-theme="dark"] .zfw-shell .zfw-top,
html[data-crm-theme="dark"] .zfw-shell .zfw-name-editor,
html[data-crm-theme="dark"] .zfw-shell .zfw-canvas,
html[data-crm-theme="dark"] .zfw-shell .zfw-properties,
html[data-crm-theme="dark"] .zfw-shell .zfw-bottom,
html[data-crm-theme="dark"] .zfw-shell .zfw-choice-editor {
  background:#1b2738!important;color:#edf3ff!important;border-color:#3a4c65!important;
}
html[data-crm-theme="dark"] .zfw-shell .zfw-layout,
html[data-crm-theme="dark"] .zfw-shell .zfw-work {background:#121c2b!important;color:#edf3ff!important}
html[data-crm-theme="dark"] .zfw-shell :is(.zfw-field label,.zfw-name-editor label,.zfw-top strong,.zfw-properties label,.zfw-properties h3,.zfw-choice-editor label,.zfw-bottom label,.zfw-hint,.zfw-option-note) {color:#e8f0ff!important}
html[data-crm-theme="dark"] .zfw-shell .zfw-field:hover,
html[data-crm-theme="dark"] .zfw-shell .zfw-field[aria-selected="true"] {background:#273c5a!important;border-color:#648ae0!important}
html[data-crm-theme="dark"] .zfw-shell :is(input:not([type="checkbox"]):not([type="radio"]),select,textarea,.zfw-option-input),
html[data-crm-theme="dark"] .zfw-shell .zfw-field :is(input,select,textarea) {
 background:#111c2b!important;color:#f0f5ff!important;border:1px solid #536780!important;
}
html[data-crm-theme="dark"] .zfw-shell :is(input,textarea)::placeholder {color:#aebed5!important;opacity:1}
html[data-crm-theme="dark"] .zfw-shell select option {background:#18263a!important;color:#edf3ff!important}
html[data-crm-theme="dark"] .zfw-shell :is(.zfw-btn,.zfw-option-actions button) {background:#263952!important;color:#d8e6ff!important;border-color:#506a91!important}
html[data-crm-theme="dark"] .zfw-shell .zfw-rail button {background:#253750!important;border-color:#526b8b!important}
html[data-crm-theme="dark"] .zfw-shell .zfw-rail button:hover {background:#324b70!important}
html[data-crm-theme="dark"] .zfw-shell .zfw-primary {background:#315ee8!important;color:#fff!important}
html[data-crm-theme="dark"] .zfw-preview .zfw-dialog,
html[data-crm-theme="dark"] .zfw-dialog {background:#1b2738!important;color:#eaf1fd!important;border-color:#445a76!important}
html[data-crm-theme="dark"] .zfw-dialog :is(h2,p,label,.zfw-hint,[data-publish-status]) {color:#eaf1fd!important}
html[data-crm-theme="dark"] .zfw-dialog :is(select,textarea,input) {background:#111c2b!important;color:#f0f5ff!important;border:1px solid #536780!important}
html[data-crm-theme="dark"] .zfw-dialog select option {background:#18263a!important;color:#f0f5ff!important}
html[data-crm-theme="dark"] .zfw-dialog .zfw-btn:not(.zfw-primary) {background:#263952!important;color:#d8e6ff!important;border-color:#506a91!important}
html[data-crm-theme="dark"] .zfw-dialog .zfw-primary {background:#315ee8!important;color:#fff!important}
html[data-crm-theme="dark"] .zfw-preview-fields {background:#1b2738!important;color:#edf3ff!important}

/* Consistent, readable module badge in light and dark themes. */
.zfw-shell .zfw-top .zfw-module-badge{display:inline-flex;align-items:center;margin-left:12px;padding:4px 9px;border:1px solid #c5d4f2;border-radius:4px;background:#eef2ff;color:#16356a!important;font-size:12px;line-height:1.4;font-weight:600;vertical-align:middle}
html[data-crm-theme="dark"] .zfw-shell .zfw-top .zfw-module-badge{background:#263c60!important;border-color:#5a79aa!important;color:#e8f1ff!important}

/* Dark-mode icon rail: normalize SVG asset contrast, including selected state. */
html[data-crm-theme="dark"] .zfw-shell .zfw-rail button {
 background:#283e5c!important;color:#dceaff!important;border:1px solid #6580a5!important;
}
html[data-crm-theme="dark"] .zfw-shell .zfw-rail button img {
 filter:brightness(0) saturate(100%) invert(91%) sepia(12%) saturate(555%) hue-rotate(180deg) brightness(105%) contrast(102%)!important;
 opacity:1!important;
}
html[data-crm-theme="dark"] .zfw-shell .zfw-rail button:is(:hover,:focus-visible) {
 background:#395779!important;border-color:#95b8f8!important;
}
html[data-crm-theme="dark"] .zfw-shell[data-mode="edit"] .zfw-rail button[data-zfw="edit"] {
 background:#315ee8!important;border-color:#638aff!important;
}
html[data-crm-theme="dark"] .zfw-shell .zfw-rail button:is([aria-pressed="true"],[aria-current="true"]) {
 background:#315ee8!important;border-color:#709bff!important;
}
html[data-crm-theme="dark"] .zfw-shell .zfw-rail button:focus-visible {
 outline:2px solid #adc9ff!important;outline-offset:3px!important;
}
  `;
  const style=document.createElement("style");style.textContent=CSS+"\n/* Single dark-theme contract for designer, forms, preview and publish dialog. */\nhtml[data-crm-theme=\"dark\"] .zfw-shell,html[data-crm-theme=\"dark\"] .zfw-dialog{background:#152237!important;color:#eaf1fc!important;border-color:#334b69!important}\nhtml[data-crm-theme=\"dark\"] .zfw-shell :is(.zfw-top,.zfw-layout,.zfw-work,.zfw-tools,.zfw-canvas,.zfw-properties,.zfw-footer,.zfw-choice-editor,.zfw-option-editor,.zfw-option-row,.zfw-name-editor,.zfw-panel,.zfw-preview-fields){background:#1b2a40!important;color:#eaf1fc!important;border-color:#384e6b!important}\nhtml[data-crm-theme=\"dark\"] .zfw-shell :is(.zfw-sidebar,.zfw-palette){background:#142237!important;color:#eaf1fc!important}\nhtml[data-crm-theme=\"dark\"] .zfw-shell :is(h2,h3,h4,p,label,strong,small,.zfw-hint,.zfw-field label,.zfw-properties label,.zfw-option-note,.zfw-name-editor label){color:#eaf1fc!important}\nhtml[data-crm-theme=\"dark\"] .zfw-shell :is(input,textarea,select,.zfw-option-input),html[data-crm-theme=\"dark\"] .zfw-dialog :is(input,textarea,select){background:#101d30!important;color:#f0f6ff!important;border:1px solid #496380!important;color-scheme:dark!important}\nhtml[data-crm-theme=\"dark\"] .zfw-shell :is(input,textarea)::placeholder,html[data-crm-theme=\"dark\"] .zfw-dialog :is(input,textarea)::placeholder{color:#95aac6!important;opacity:1!important}\nhtml[data-crm-theme=\"dark\"] .zfw-shell :is(select option),html[data-crm-theme=\"dark\"] .zfw-dialog select option{background:#101d30!important;color:#f0f6ff!important}\nhtml[data-crm-theme=\"dark\"] .zfw-shell .zfw-field{background:transparent!important;color:#eaf1fc!important;border-color:transparent!important}\nhtml[data-crm-theme=\"dark\"] .zfw-shell .zfw-field:hover,html[data-crm-theme=\"dark\"] .zfw-shell .zfw-field[aria-selected=\"true\"]{background:#253958!important;border-color:#527fdd!important}\nhtml[data-crm-theme=\"dark\"] .zfw-shell :is(.zfw-btn,.zfw-actions button,.zfw-option-actions button,.zfw-palette button),html[data-crm-theme=\"dark\"] .zfw-dialog .zfw-btn{background:#233752!important;color:#dae8ff!important;border:1px solid #496486!important}\nhtml[data-crm-theme=\"dark\"] .zfw-shell :is(.zfw-primary,button.zfw-primary),html[data-crm-theme=\"dark\"] .zfw-dialog .zfw-primary{background:#2d6bea!important;color:#fff!important;border-color:#2d6bea!important}\nhtml[data-crm-theme=\"dark\"] .zfw-shell .zfw-option-list{background:#1b2a40!important}\nhtml[data-crm-theme=\"dark\"] .zfw-shell .zfw-option-grip{color:#9bb2d1!important}\nhtml[data-crm-theme=\"dark\"] .zfw-dialog{background:#1b2a40!important;box-shadow:0 25px 70px #020713aa!important}\nhtml[data-crm-theme=\"dark\"] .zfw-dialog :is(h2,h3,p,small,label,.zfw-hint,.zfw-note,.zfw-status){color:#e7f0ff!important}\nhtml[data-crm-theme=\"dark\"] .zfw-dialog :is(pre,code,.zfw-code){background:#101d30!important;color:#e8f1ff!important;border-color:#496380!important}\nhtml[data-crm-theme=\"dark\"] .zfw-shell :is(.zfw-rail button){background:#233752!important;border-color:#496380!important}\nhtml[data-crm-theme=\"dark\"] .zfw-shell :is(.zfw-rail button img){opacity:1!important}\n\n/* Semantic chips must retain their own contrast instead of inheriting the generic span rule. */\nhtml[data-crm-theme=\"dark\"] .zfw-shell .zfw-top .zfw-module-badge{background:#294469!important;border:1px solid #6689ba!important;color:#f0f6ff!important}\nhtml[data-crm-theme=\"light\"] .zfw-shell .zfw-top .zfw-module-badge{background:#eef2ff!important;border:1px solid #c5d4f2!important;color:#16356a!important}\n";document.head.appendChild(style);
  const html = value => String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const defaultFields=[
    ["first_name","First Name","text",false],["last_name","Last Name","text",true],
    ["phone","Mobile","tel",true],["email","Email","email",false],
    ["message","Message","text",false],["project","Project","text",false],
    ["requirement","Requirement","textarea",false],["budget","Budget","number",false],
    ["preferred_location","Preferred Location","text",false],["language","Language","select",false],
    ["source","Lead Source","select",false]
  ].map(([api_name,label,type,required])=>({api_name,label,type,required,options:type==="select"?["-None-"]:[]}));
  const available=["Salutation","Assigned To","Secondary Email","Lead Pipeline","Industry","Video Call Facility Details","Junk Lead","Meeting Date & Time","Meeting link","Visit Type","Social Lead ID","Qualification","Preferred Location","Company","Description","Website"];
  const parse = (el,fallback) => {try {const v=JSON.parse(el.value||"");return Array.isArray(v)?v:fallback;}catch{return fallback;}};
  const slug=s=>String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,"");
  let active=null;
  function fieldMarkup(f,i,selected,editable=true) {
    const tag=f.type==="select"?'<select><option value="">-None-</option>'+((f.options||[]).filter(x=>x!=="-None-").map(x=>'<option>'+html(x)+'</option>').join(""))+'</select>':f.type==="textarea"?'<textarea tabindex="-1" rows="2"></textarea>':'<input tabindex="-1" type="'+(["email","tel","number","date"].includes(f.type)?f.type:"text")+'" placeholder="'+html(f.placeholder||"")+'">';
    return '<div class="zfw-field" data-zfw-index="'+i+'" aria-selected="'+(i===selected)+'" '+(editable?'draggable="true" role="button" tabindex="0"':'')+'><label>'+html(f.label||f.api_name)+(f.required?'<b>*</b>':'')+'</label>'+tag+'</div>';
  }
  function enhance(){
    const path=location.pathname;
    if(!/^\/(?:setup\/)?webforms(?:\/|$)/.test(path))return;
    const textarea=document.querySelector('textarea[name="fields"]');
    if(!textarea || textarea.dataset.zfwBound==="1")return;
    const form=textarea.closest("form");
    if(!form)return;
    textarea.dataset.zfwBound="1";
    let fields=parse(textarea,defaultFields).map((f,i)=>typeof f==="string"?{api_name:slug(f),label:f,type:"text",required:false}:({...f,api_name:f.api_name||f.key||"field_"+i,label:f.label||f.api_name||f.key||"Field",type:f.type||"text"}));
    fields.forEach(f=>{if(f.type==="select")f.options=(Array.isArray(f.options)?f.options:[]).filter(v=>v!=="-None-");});
    fields.forEach(f=>{if(f.api_name==="requirement"){f.type="textarea";f.options=[];}});
    let selected=fields.length?0:-1;
    const optionUndo=Object.fromEntries(fields.map(f=>[f.api_name,[...(f.options||[])]]));
    let mode=/\/webforms\/create(?:\/|$)/.test(location.pathname)?"edit":"preview";
    const shell=document.createElement("section");shell.className="zfw-shell";shell.setAttribute("aria-label","Visual Webform builder");
    const sourceRow=textarea.closest(".field");
    // Mount outside the CRM's two-column field grid, otherwise the designer
    // becomes one narrow grid cell and its center canvas collapses.
    const nativeGrid=sourceRow?.closest(".form-grid");
    if(nativeGrid && nativeGrid.parentElement)nativeGrid.insertAdjacentElement("beforebegin",shell);
    else if(sourceRow)sourceRow.insertAdjacentElement("beforebegin",shell);
    else textarea.insertAdjacentElement("beforebegin",shell);
    if(sourceRow)sourceRow.classList.add("zfw-hidden-source");
    else textarea.classList.add("zfw-hidden-source");
    const sync=()=>{textarea.value=JSON.stringify(fields);textarea.dispatchEvent(new Event("change",{bubbles:true}));};
    const render=()=>{
      shell.dataset.mode=mode;
      const titleField=form.querySelector('[name="name"]');
      const formTitle=(titleField?.value||"New Webform").trim();
      shell.innerHTML='<div class="zfw-name-editor" '+(mode==="edit"?'':'hidden')+'><label for="zfw-form-name">Form name <span aria-hidden="true">*</span></label><input id="zfw-form-name" data-zfw-form-name type="text" maxlength="160" required placeholder="Enter a form name" value="'+html(titleField?.value||"")+'"><small data-zfw-name-error aria-live="polite"></small></div><header class="zfw-top"><div><strong>'+html(formTitle)+'</strong> <span class="zfw-module-badge">Leads</span></div><div class="zfw-actions zfw-header-actions"><button type="button" class="zfw-btn" data-zfw="edit" title="Edit"><svg viewBox="0 0 24 24"><path d="M4 17v3h4L20 8l-4-4L4 17Z"/><path d="m14 6 4 4"/></svg><span>Edit</span></button><button type="button" class="zfw-btn" data-zfw="clone" title="Clone"><svg viewBox="0 0 24 24"><rect x="8" y="3" width="13" height="13" rx="2"/><path d="M16 18v2a1 1 0 0 1-1 1H5a2 2 0 0 1-2-2V9a1 1 0 0 1 1-1h2"/></svg><span>Clone</span></button><button type="button" class="zfw-btn" data-zfw="analytics" title="Analytics"><svg viewBox="0 0 24 24"><path d="M3 21h18M5 18v-6h3v6M11 18V8h3v10M17 18V3h3v15"/></svg><span>Analytics</span></button><button type="button" class="zfw-btn" data-zfw="publish" title="Publish options"><svg viewBox="0 0 24 24"><path d="M12 16V3m0 0 5 5m-5-5L7 8"/><path d="M4 15v5h16v-5"/></svg><span>Publish options</span></button></div></header>'+
      '<div class="zfw-layout"><nav class="zfw-rail" aria-label="Webform actions"><button type="button" data-zfw="edit" title="Edit" aria-label="edit"><img alt="" src="/static/icons/webforms-edit.svg"></button><button type="button" data-zfw="clone" title="Clone" aria-label="clone"><img alt="" src="/static/icons/webforms-clone.svg"></button><button type="button" data-zfw="analytics" title="Analytics" aria-label="analytics"><img alt="" src="/static/icons/webforms-analytics.svg"></button><button type="button" data-zfw="publish" title="Publish options" aria-label="publish"><img alt="" src="/static/icons/webforms-publish.svg"></button></nav><aside class="zfw-sidebar"><b>Layout</b><select aria-label="Form layout"><option>Standard</option></select><input type="search" data-zfw-search placeholder="⌕ Search Fields" aria-label="Search fields"><b>Fields</b><div class="zfw-palette">'+available.map(x=>'<button type="button" draggable="true" data-zfw-add="'+html(x)+'">'+html(x)+'</button>').join("")+'</div></aside>'+
      '<div class="zfw-work"><div class="zfw-canvas">'+fields.map((f,i)=>fieldMarkup(f,i,selected)).join("")+'</div><div class="zfw-bottom"><label>Add Lead field <select data-zfw-insert><option value="">Select a field</option>'+available.map(x=>'<option value="'+html(x)+'">'+html(x)+'</option>').join("")+'</select></label><button type="button" class="zfw-btn" data-zfw-add-selected>Add field</button><label class="zfw-title-switch"><input type="checkbox" data-zfw-title> Include form name as title</label><small class="zfw-hint">Click a field to select it. Use the controls below to reorder or remove it.</small>'+(mode==="edit"&&selected>=0&&fields[selected].type==="select"?'<div class="zfw-choice-editor"><label>Dropdown options for '+html(fields[selected].label)+'</label><div class="zfw-option-list">'+(fields[selected].options||[]).filter(x=>x!=="-None-").map((value,index)=>'<div class="zfw-option-row" data-option-index="'+index+'" draggable="true"><span class="zfw-option-grip" title="Drag to reorder" aria-hidden="true">⠿</span><input class="zfw-option-input" data-option-value="'+index+'" aria-label="Option '+(index+1)+'" value="'+html(value)+'"><div class="zfw-option-actions"><button type="button" data-option-add="'+index+'" title="Add option below" aria-label="Add option below">+</button><button type="button" data-option-remove="'+index+'" title="Remove option" aria-label="Remove option">−</button><button type="button" data-option-down="'+index+'" title="Move option down" aria-label="Move option down">⇄</button></div></div>').join("")+'</div><div class="zfw-option-note">Changes appear in this Webform. <button type="button" data-option-undo>Undo</button></div><button type="button" data-option-add-end class="zfw-btn">+ Add option</button></div>':'')+'<div class="zfw-actions"><button type="button" class="zfw-btn" data-zfw="up">Move up</button><button type="button" class="zfw-btn" data-zfw="down">Move down</button><button type="button" class="zfw-btn" data-zfw="remove">Remove selected field</button></div></div></div>'+
      '<aside class="zfw-properties" hidden><h3>Field Properties</h3>'+ (selected<0?'<p>Select a field to edit its settings.</p>':'<label>Field label</label><input data-zfw-prop="label" value="'+html(fields[selected].label)+'"><label>CRM field API name</label><input data-zfw-prop="api_name" value="'+html(fields[selected].api_name)+'" readonly><label>Type</label><select data-zfw-prop="type">'+["text","textarea","email","tel","number","select","date"].map(t=>'<option value="'+t+'" '+(t===fields[selected].type?"selected":"")+'>'+t+'</option>').join("")+'</select><label>Placeholder</label><input data-zfw-prop="placeholder" value="'+html(fields[selected].placeholder||"")+'"><label class="zfw-inline"><input type="checkbox" data-zfw-prop="required" '+(fields[selected].required?"checked":"")+'> Mandatory field</label><label class="zfw-inline"><input type="checkbox" data-zfw-prop="hidden" '+(fields[selected].hidden?"checked":"")+'> Hidden field</label>'+(fields[selected].type==="select"?'<label>Options (one per line)</label><textarea data-zfw-options rows="4" style="width:100%">'+html((fields[selected].options||[]).join("\n"))+'</textarea>':"")+'<div class="zfw-actions"><button type="button" class="zfw-btn" data-zfw="up">↑ Move</button><button type="button" class="zfw-btn" data-zfw="down">↓ Move</button><button type="button" class="zfw-btn" data-zfw="remove">Remove</button></div>')+'</aside></div>';
      const nameEditor=shell.querySelector("[data-zfw-form-name]");
      if(nameEditor && titleField){
        nameEditor.addEventListener("input",()=>{titleField.value=nameEditor.value;titleField.dispatchEvent(new Event("input",{bubbles:true}));});
        nameEditor.addEventListener("change",()=>{titleField.value=nameEditor.value.trim();titleField.dispatchEvent(new Event("change",{bubbles:true}));});
      }
      shell.querySelectorAll("[data-zfw-index]").forEach(el=>{el.addEventListener("click",()=>{if(mode!=="edit")return;selected=Number(el.dataset.zfwIndex);render();});el.addEventListener("keydown",e=>{if(e.key==="Enter"){selected=Number(el.dataset.zfwIndex);render();}});el.addEventListener("dragstart",e=>{e.dataTransfer.effectAllowed="move";e.dataTransfer.setData("application/x-zfw-index",el.dataset.zfwIndex)});el.addEventListener("dragover",e=>{e.preventDefault();e.stopPropagation();e.dataTransfer.dropEffect=e.dataTransfer.types.includes("application/x-zfw-palette")?"copy":"move";el.classList.add("zfw-drop-target")});el.addEventListener("dragleave",()=>el.classList.remove("zfw-drop-target"));el.addEventListener("drop",e=>{e.preventDefault();e.stopPropagation();const b=Number(el.dataset.zfwIndex),label=e.dataTransfer.getData("application/x-zfw-palette");if(label){const key=slug(label);if(!fields.some(f=>f.api_name===key)){fields.splice(b,0,{api_name:key,label,type:"text",required:false});selected=b;sync();render();}return;}const raw=e.dataTransfer.getData("application/x-zfw-index");if(!/^[0-9]+$/.test(raw))return;const a=Number(raw);if(a>=0&&a<fields.length&&b>=0&&b<fields.length){const [v]=fields.splice(a,1);fields.splice(b,0,v);selected=b;sync();render();}});});
      shell.querySelectorAll("[data-zfw-add]").forEach(el=>el.addEventListener("dragstart",e=>{e.dataTransfer.effectAllowed="copy";e.dataTransfer.setData("application/x-zfw-palette",el.dataset.zfwAdd);}));
      const canvas=shell.querySelector(".zfw-canvas");canvas.addEventListener("dragover",e=>{e.preventDefault();canvas.classList.add("zfw-drag-over")});canvas.addEventListener("dragleave",()=>canvas.classList.remove("zfw-drag-over"));canvas.addEventListener("drop",e=>{canvas.classList.remove("zfw-drag-over");const label=e.dataTransfer.getData("application/x-zfw-palette");if(!label)return;e.preventDefault();const key=slug(label);if(fields.some(f=>f.api_name===key))return;fields.push({api_name:key,label,type:"text",required:false});selected=fields.length-1;sync();render();});
      shell.querySelector("[data-zfw-add-selected]")?.addEventListener("click",()=>{const picker=shell.querySelector("[data-zfw-insert]");const label=picker?.value;if(!label)return;const key=slug(label);if(fields.some(f=>f.api_name===key)){picker.setCustomValidity("Field already exists");picker.reportValidity();return;}fields.push({api_name:key,label,type:"text",required:false});selected=fields.length-1;sync();render();});
      shell.querySelector("[data-zfw-insert]")?.addEventListener("change",e=>e.target.setCustomValidity(""));
      const optionList=shell.querySelector(".zfw-option-list");
      if(optionList&&selected>=0){
        const field=fields[selected],key=field.api_name;
        const choices=()=>field.options||(field.options=[]);
        const commit=()=>{sync();render();};
        optionList.querySelectorAll("[data-option-value]").forEach(input=>input.addEventListener("input",()=>{
          const index=Number(input.dataset.optionValue);
          choices()[index]=input.value;
          const preview=shell.querySelector('.zfw-field[data-zfw-index="'+selected+'"] select');
          if(preview?.options[index+1]){preview.options[index+1].textContent=input.value;preview.options[index+1].value=input.value;}
          sync();
        }));
        optionList.querySelectorAll("[data-option-add]").forEach(btn=>btn.addEventListener("click",()=>{choices().splice(Number(btn.dataset.optionAdd)+1,0,"New Option");commit();}));
        optionList.querySelectorAll("[data-option-remove]").forEach(btn=>btn.addEventListener("click",()=>{choices().splice(Number(btn.dataset.optionRemove),1);commit();}));
        optionList.querySelectorAll("[data-option-down]").forEach(btn=>btn.addEventListener("click",()=>{const i=Number(btn.dataset.optionDown),arr=choices();if(i<arr.length-1){[arr[i],arr[i+1]]=[arr[i+1],arr[i]];commit();}}));
        optionList.querySelectorAll("[data-option-row]").forEach(row=>{
          row.addEventListener("dragstart",event=>{event.stopPropagation();event.dataTransfer.setData("application/x-zfw-option",row.dataset.optionIndex);});
          row.addEventListener("dragover",event=>{event.preventDefault();event.stopPropagation();});
          row.addEventListener("drop",event=>{event.preventDefault();event.stopPropagation();const from=Number(event.dataTransfer.getData("application/x-zfw-option")),to=Number(row.dataset.optionIndex),arr=choices();if(Number.isInteger(from)&&from>=0&&from<arr.length&&to>=0&&to<arr.length&&from!==to){arr.splice(to,0,arr.splice(from,1)[0]);commit();}});
        });
        shell.querySelector("[data-option-add-end]")?.addEventListener("click",()=>{choices().push("New Option");commit();});
        shell.querySelector("[data-option-undo]")?.addEventListener("click",()=>{const previous=optionUndo[key];if(previous){field.options=[...previous];commit();}});
      }
      shell.querySelectorAll("[data-zfw-add]").forEach(el=>el.onclick=()=>{const label=el.dataset.zfwAdd;const key=slug(label);if(fields.some(f=>f.api_name===key))return;fields.push({api_name:key,label,type:"text",required:false});selected=fields.length-1;sync();render();});
      shell.querySelectorAll("[data-zfw-prop]").forEach(el=>el.addEventListener("change",()=>{if(selected<0)return;fields[selected][el.dataset.zfwProp]=el.type==="checkbox"?el.checked:el.value;sync();render();}));
      const opt=shell.querySelector("[data-zfw-options]");if(opt)opt.onchange=()=>{fields[selected].options=opt.value.split("\n").map(x=>x.trim()).filter(Boolean);sync();render();};
      shell.querySelectorAll("[data-zfw]").forEach(el=>el.onclick=async()=>{const a=el.dataset.zfw;if(a==="preview"||a==="publish")dialog(a);else if(a==="edit"){mode="edit";render();shell.querySelector(".zfw-bottom")?.scrollIntoView({behavior:"smooth",block:"nearest"});}else if(a==="analytics"||a==="clone"){const id=(location.pathname.match(/\/webforms\/edit\/(\d+)/)||[])[1];if(!id){(await alertDialog("Save this form first."));return;}if(a==="analytics"){history.pushState({},"","/webforms/analytics/"+id);window.dispatchEvent(new PopStateEvent("popstate"));}else{window.webformClone?.(id).catch(async error=>(await alertDialog("Clone failed: "+error.message)));}}else if(selected>=0){if(a==="remove"){fields.splice(selected,1);selected=Math.min(selected,fields.length-1);}else{const b=selected+(a==="up"?-1:1);if(b>=0&&b<fields.length){[fields[selected],fields[b]]=[fields[b],fields[selected]];selected=b;}}sync();render();}});
      const search=shell.querySelector("[data-zfw-search]");search.oninput=()=>shell.querySelectorAll("[data-zfw-add]").forEach(b=>b.hidden=!b.textContent.toLowerCase().includes(search.value.toLowerCase()));

    };
    async function dialog(mode){
      const overlay=document.createElement("div");overlay.className="zfw-preview";overlay.setAttribute("role","dialog");overlay.setAttribute("aria-modal","true");
      const formId=(location.pathname.match(/\/webforms\/(?:edit\/)?(\d+)(?:\/|$)/)||[])[1];
      overlay.innerHTML='<div class="zfw-dialog"><div style="display:flex;justify-content:space-between;gap:12px"><h2>'+ (mode==="preview"?"Webform Preview":"Publish Options")+'</h2><button type="button" class="zfw-btn" data-close>Done</button></div><div data-publish-body></div></div>';
      document.body.appendChild(overlay);
      const close=()=>overlay.remove();
      overlay.querySelector("[data-close]").onclick=close;
      overlay.addEventListener("click",e=>{if(e.target===overlay)close();});
      const content=overlay.querySelector("[data-publish-body]");
      if(mode==="preview"){
        content.innerHTML='<div class="zfw-preview-fields">'+fields.filter(f=>!f.hidden).map((f,i)=>fieldMarkup(f,i,-1,false)).join("")+'<p class="zfw-hint">Preview only — no submissions are sent.</p></div>';return;
      }
      if(!formId){
        content.innerHTML='<p>Save this webform first, then open Edit to publish and generate its working URLs and QR code.</p>';return;
      }
      content.innerHTML='<p>Publishing makes this Lead form accessible through a public URL. Visitors who submit it will create CRM Leads.</p><button type="button" class="zfw-btn zfw-primary" data-publish-now>Publish and generate links</button><p data-publish-status role="status"></p><div data-publish-results></div>';
      content.querySelector("[data-publish-now]").onclick=async()=>{
        const button=content.querySelector("[data-publish-now]"),status=content.querySelector("[data-publish-status]");
        button.disabled=true;status.textContent="Publishing saved form...";
        try{
          const response=await fetch("/api/webforms/"+encodeURIComponent(formId)+"/publish",{method:"POST",credentials:"same-origin",headers:{"Accept":"application/json"}});
          const data=await response.json();
          if(!response.ok)throw new Error(typeof data.detail==="string"?data.detail:"Publishing failed");
          const url=new URL(data.url,location.origin).href;
          const source='<form method="post" action="'+url+'/submit">\n'+fields.filter(f=>!f.hidden).map(f=>'<label>'+html(f.label)+' <input name="'+html(f.api_name)+'"'+(f.required?' required':'')+'></label>').join('\n')+'\n<button type="submit">Submit</button></form>';
          const embed='<iframe src="'+url+'" title="Lead form" style="width:100%;min-height:640px;border:0"></iframe>';
          const snippets={"Source Code":source,"Embed":embed,"iFrame":embed,"Link":url,"QR Code":url};
          const results=content.querySelector("[data-publish-results]");
          results.innerHTML='<label for="zfw-format">Publishing Format</label><select id="zfw-format" class="zfw-format">'+Object.keys(snippets).map(k=>'<option>'+k+'</option>').join("")+'</select><textarea class="zfw-output" readonly aria-label="Generated publishing code"></textarea><button type="button" class="zfw-btn" data-copy>Copy</button><p data-qr hidden><img data-qr-image alt="QR code to open published webform" style="width:180px;height:180px" src="/public/webform/'+encodeURIComponent(url.split("/").pop())+'/qr"></p><p class="zfw-hint">Source Code is a simple HTML form; use Embed/iFrame to preserve the published form layout and validation.</p>';
          const select=results.querySelector("select"),output=results.querySelector("textarea"),qr=results.querySelector("[data-qr]");
          const update=()=>{output.value=snippets[select.value];qr.hidden=select.value!=="QR Code";};
          select.onchange=update;update();const qrImg=results.querySelector("[data-qr-image]");qrImg.onerror=()=>{qr.innerHTML="<span role=alert>QR image could not load. Use the form link above.</span>";};
          results.querySelector("[data-copy]").onclick=async()=>{
            const button=results.querySelector("[data-copy]");
            let ok=false;
            try{if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(output.value);ok=true;}}catch(_error){}
            if(!ok){try{output.focus();output.select();ok=document.execCommand("copy");}catch(_error){}}
            let message=results.querySelector("[data-copy-feedback]");
            if(!message){message=document.createElement("span");message.dataset.copyFeedback="true";message.setAttribute("role","status");message.style.marginLeft="12px";button.after(message);}
            message.textContent=ok?"Copied successfully!":"Unable to copy automatically. Select the text and press Ctrl+C.";
            message.style.color=ok?"#168357":"#ad3434";
            if(ok){button.textContent="Copied";setTimeout(()=>{if(button.isConnected)button.textContent="Copy";},2200);}
          };
          status.textContent="Published successfully. The generated URL is active.";
        }catch(error){status.textContent=error.message||"Unable to publish";}finally{button.disabled=false;}
      };
    }
    sync();render();
    form.addEventListener("submit",event=>{
      const name=form.querySelector('[name="name"]');
      const editor=shell.querySelector("[data-zfw-form-name]");
      if(name && !name.value.trim()){
        event.preventDefault();
        if(editor){editor.setCustomValidity("Enter a form name before creating the Webform.");editor.reportValidity();editor.focus();}
        else {mode="edit";render();shell.querySelector("[data-zfw-form-name]")?.focus();}
        return;
      }
      sync();
    });
    shell.addEventListener("input",event=>{if(event.target.matches("[data-zfw-form-name]"))event.target.setCustomValidity("");});
  }
  new MutationObserver(()=>enhance()).observe(document.documentElement,{childList:true,subtree:true});
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",enhance);else enhance();
})();
