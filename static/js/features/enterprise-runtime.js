// Settings surfaces for live integrations, protected fields and sandbox drafts.
export function createEnterpriseRuntime({api, esc, navigate, toast, confirmDialog, markFormSaved}) {
  const human = value => String(value).replaceAll('_', ' ').replace(/\b\w/g, c=>c.toUpperCase());
  const json = value => esc(JSON.stringify(value,null,2));
  const path = '/api/runtime';
  let bound=false;

  function operationForm(connection) {
    const provider=connection.provider;
    if(['google_ads','meta_ads'].includes(provider))return '';
    const fields=[];
    const add=(name,label,type='text',required=true)=>fields.push(`<label class="field">${label}<input class="field-input" name="${name}" type="${type}" ${required?'required':''}></label>`);
    let label='Submit action';
    if(['gmail','outlook'].includes(provider)){label='Send email';if(provider==='gmail')add('from','Authorized Gmail sender address','email');add('to','Recipient email','email');add('subject','Subject');}
    else if(['google_calendar','outlook_calendar','zoom'].includes(provider)){label=provider==='zoom'?'Create Zoom meeting':'Create calendar event';add('subject','Meeting title');add('start','Starts (your local time)','datetime-local');if(provider==='zoom')add('duration','Duration in minutes','number');else add('end','Ends (your local time)','datetime-local');}
    else if(provider==='slack'){label='Send channel message';add('channel','Slack channel ID');}
    else if(provider==='teams'){label='Send channel message';add('team_id','Team ID');add('channel_id','Channel ID');}
    else if(provider==='quickbooks'){label='Create QuickBooks customer';add('name','Customer display name');add('to','Customer email','email');}
    if(['gmail','outlook','slack','teams'].includes(provider))fields.push('<label class="field">Message<textarea class="field-textarea" name="body" rows="5" required></textarea></label>');
    return `<section class="card settings-section"><h3>${label}</h3><p>This action changes the connected provider account and requires confirmation.</p><form class="form-grid" data-runtime-action-form="${connection.id}">${fields.join('')}<div class="form-actions"><button class="button button-primary">${label}</button></div></form></section>`;
  }

  async function view(resource, parts=[]) {
    bind();
    if(resource==='protected_fields') {
      const data=await api(path+'/encrypted-fields');
      return `<section class="card settings-section"><h2>Protected fields</h2>${data.encryption_ready===false?'<p role="status">Encryption setup is pending. Contact your platform administrator.</p>':''}<p>Encrypt custom values in database storage. Decrypt permission controls who can read them. Unique, computed, lookup and record-name fields are excluded.</p><div class="table-wrap"><table class="data-table"><thead><tr><th>Module</th><th>Field</th><th>Protection</th><th>Action</th></tr></thead><tbody>${data.items.map(f=>`<tr><td>${esc(f.module)}</td><td>${esc(f.name)}</td><td>${f.encrypted?'Encrypted':'Plaintext'}</td><td><button class="button button-small" data-runtime-field="${f.id}" ${data.encryption_ready===false?"disabled":""} data-enabled="${!f.encrypted}">${f.encrypted?'Remove encryption':'Enable encryption'}</button></td></tr>`).join('')}</tbody></table></div>${data.items.length?'':'<p>No custom fields have been created yet.</p>'}</section>`;
    }
    if(resource==='sandboxes') {
      if(parts[0] && /^\d+$/.test(parts[0])) {
        const data=await api(path+'/sandboxes/'+parts[0]);
        return `<section class="card settings-section"><h2>${esc(data.name)}</h2><p>Configuration sandbox · ${esc(data.status)} · Revision ${data.revision}. Saving and testing do not change production. Publish applies validated components only if production has not changed.</p><form data-runtime-sandbox-save="${data.id}" data-revision="${data.revision}"><label class="field">Configuration components<textarea class="field-textarea" name="components" rows="22" spellcheck="false" required>${json(data.components)}</textarea></label><button class="button button-primary">Save draft</button></form><hr><form data-runtime-sandbox-test="${data.id}"><h3>Test a workflow against sample values</h3><label class="field">Module<input class="field-input" name="module" value="leads" required></label><label class="field">Sample record<textarea class="field-textarea" name="values" rows="5">{}</textarea></label><button class="button">Run test without actions</button></form><pre data-runtime-test-result style="white-space:pre-wrap"></pre><button class="button button-primary" data-runtime-promote="${data.id}" data-revision="${data.revision}">Publish to production</button></section>`;
      }
      const data=await api(path+'/sandboxes');
      return `<section class="card settings-section"><h2>Configuration sandboxes</h2><p>Create an isolated copy of workflows, email templates, pipelines, validation rules and custom views. Customer records and connection credentials are excluded.</p>${data.encryption_ready===false?'<p role="status">Encryption setup is pending. Contact your platform administrator.</p>':''}<form data-runtime-sandbox-new class="form-grid"><label class="field">Sandbox name<input class="field-input" name="name" required maxlength="160"></label><div class="form-actions"><button class="button button-primary" ${data.encryption_ready===false?"disabled":""}>Create sandbox</button></div></form>${data.items.map(row=>`<div class="rule-row"><div class="rule-info"><strong>${esc(row.name)}</strong><small>${esc(row.status)} · Revision ${row.revision}</small></div><a class="button" href="/setup/sandboxes/${row.id}">Open sandbox</a></div>`).join('')}</section>`;
    }
    const data=await api(path+'/integrations');
    if(parts[0] && /^\d+$/.test(parts[0])) {
      const connection=data.items.find(row=>String(row.id)===parts[0]);
      if(!connection)throw new Error('Connection not found');
      const inbox=await api(path+'/integrations/'+connection.id+'/items');
      return `<section class="card settings-section"><h2>${esc(connection.name)}</h2><p>${human(connection.provider)} · ${esc(connection.status)}</p>${connection.last_error?`<p role="alert">${esc(connection.last_error)}</p>`:''}<div class="form-actions"><button class="button" data-runtime-action="test" data-id="${connection.id}">Test connection</button><button class="button button-primary" data-runtime-action="sync" data-id="${connection.id}">Sync next batch</button><button class="button" data-runtime-action="disconnect" data-id="${connection.id}">Disconnect</button></div><p>Sync reads provider data into this encrypted inbox. Select a record to import it into CRM. Repeating an import does not create duplicates.</p>${operationForm(connection)}${inbox.items.map(item=>`<section class="card settings-section"><h3>${esc(item.data.title||item.data.id)}</h3><details><summary>View provider data</summary><pre style="white-space:pre-wrap;overflow-wrap:anywhere">${json(item.data)}</pre></details>${item.crm_record_id?`<a href="/${esc(item.crm_resource)}/${item.crm_record_id}">Open imported record</a>`:inbox.entity?`<button class="button" data-runtime-import="${item.id}" data-id="${connection.id}">Import into ${human(inbox.entity)}</button>`:''}</section>`).join('')||'<p>No records synced yet.</p>'}</section>`;
    }
    if(parts[0]==='new') {
      return `<section class="card settings-section"><h2>Connect a provider</h2><p>Use a provider-issued OAuth access token, with refresh credentials if available. These fields are write-only and stored encrypted. Your account password is not required.</p>${data.encryption_ready?'':'<p role="alert">The encryption key must be provisioned before connecting providers.</p>'}<form data-runtime-connect class="form-grid"><label class="field">Connection name<input class="field-input" name="name" required maxlength="160"></label><label class="field">Provider<select class="field-select" name="provider">${data.providers.map(p=>`<option value="${p.id}" ${p.available?'':'disabled'}>${esc(p.label)}${p.available?'':' · Requires another plan'}</option>`).join('')}</select></label>${[['access_token','Access token',true],['refresh_token','Refresh token',false],['client_id','OAuth client ID',false],['client_secret','OAuth client secret',false],['developer_token','Google Ads developer token',false]].map(([name,label,required])=>`<label class="field">${label}<input class="field-input" type="password" autocomplete="new-password" name="${name}" ${required?'required':''}></label>`).join('')}<label class="field">Token expiry (Unix timestamp, optional)<input class="field-input" type="number" name="expires_at"></label><label class="field">Provider settings<textarea class="field-textarea" name="configuration" rows="7" spellcheck="false">{}</textarea><small>Google Calendar: calendar_id. QuickBooks: realm_id and optional sandbox. Google Ads: customer_id and optional login_customer_id, api_version. Meta Ads: ad_account_id and api_version.</small></label><div class="form-actions"><button class="button button-primary" ${data.encryption_ready?'':'disabled'}>Save connection</button><a class="button" href="/setup/connections">Cancel</a></div></form></section>`;
    }
    return `<section class="card settings-section"><h2>Provider integrations</h2><p>Connect an account, verify its access, then sync records into an encrypted inbox.</p><a class="button button-primary" href="/setup/connections/new">Connect provider</a>${data.items.map(row=>`<div class="rule-row"><div class="rule-info"><strong>${esc(row.name)}</strong><small>${human(row.provider)} · ${esc(row.status)}${row.last_sync_at?' · Last synced '+esc(row.last_sync_at):''}</small></div><a class="button" href="/setup/connections/${row.id}">Open connection</a></div>`).join('')||'<p>No provider accounts connected yet.</p>'}</section>`;
  }

  function bind() {
    if(bound)return;bound=true;
    document.addEventListener('submit',async event=>{
      const form=event.target;
      if(!form.matches('[data-runtime-connect],[data-runtime-sandbox-new],[data-runtime-sandbox-save],[data-runtime-sandbox-test],[data-runtime-action-form]'))return;
      event.preventDefault();const button=form.querySelector('button');button.disabled=true;
      try {
        const values=Object.fromEntries(new FormData(form));
        if(form.matches('[data-runtime-action-form]')) {
          if(!(await confirmDialog('Submit this action to the connected provider account? Review the recipient, destination and content before continuing.')))return;
          const requestKey=form.dataset.requestKey||(form.dataset.requestKey=crypto.randomUUID());
          if(values.start)values.start=new Date(values.start).toISOString();
          if(values.end)values.end=new Date(values.end).toISOString();
          if(values.duration)values.duration=Number(values.duration);
          await api(path+'/integrations/'+form.dataset.runtimeActionForm+'/action',{method:'POST',body:JSON.stringify({values,confirmed:true,request_key:requestKey})});
          form.reset();delete form.dataset.requestKey;markFormSaved?.(form);toast('Accepted by provider','The provider accepted this action.');
        } else if(form.matches('[data-runtime-connect]')) {
          const credentials={};for(const key of ['access_token','refresh_token','client_id','client_secret','developer_token','expires_at'])if(values[key])credentials[key]=key==='expires_at'?Number(values[key]):values[key];
          const result=await api(path+'/integrations',{method:'POST',body:JSON.stringify({name:values.name,provider:values.provider,credentials,configuration:JSON.parse(values.configuration)})});
          form.reset();await navigate('/setup/connections/'+result.id);
        } else if(form.matches('[data-runtime-sandbox-new]')) {
          const result=await api(path+'/sandboxes',{method:'POST',body:JSON.stringify(values)});form.reset();await navigate('/setup/sandboxes/'+result.id);
        } else if(form.matches('[data-runtime-sandbox-save]')) {
          await api(path+'/sandboxes/'+form.dataset.runtimeSandboxSave,{method:'PUT',body:JSON.stringify({revision:Number(form.dataset.revision),components:JSON.parse(values.components)})});
          // A saved draft is now the baseline for the unsaved-changes guard.
          for(const el of form.querySelectorAll('textarea'))el.defaultValue=el.value;
          form.reset();markFormSaved?.(form);await navigate(location.pathname,true);toast('Sandbox saved','Production configuration is unchanged.');
        } else {
          const draft=document.querySelector('[data-runtime-sandbox-save] textarea');if(draft&&draft.value!==draft.defaultValue)throw new Error('Save the draft before testing it.');
          const result=await api(path+'/sandboxes/'+form.dataset.runtimeSandboxTest+'/test',{method:'POST',body:JSON.stringify({module:values.module,values:JSON.parse(values.values)})});
          document.querySelector('[data-runtime-test-result]').textContent=JSON.stringify(result,null,2);
        }
      }catch(error){toast('Operation failed',error.message,'error');}finally{button.disabled=false;}
    });
    document.addEventListener('click',async event=>{
      const button=event.target.closest('[data-runtime-action],[data-runtime-field],[data-runtime-promote],[data-runtime-import]');
      if(!button)return;button.disabled=true;
      try {
        if(button.dataset.runtimeField) {
          const encrypted=button.dataset.enabled==='true';
          if(!(await confirmDialog(encrypted?'Encrypt this field and migrate existing stored values?':'Remove encryption and store this field as plaintext?')))return;
          await api(path+'/encrypted-fields/'+button.dataset.runtimeField,{method:'PUT',body:JSON.stringify({encrypted})});
        } else if(button.dataset.runtimePromote) {
          const draft=document.querySelector('[data-runtime-sandbox-save] textarea');if(draft&&draft.value!==draft.defaultValue)throw new Error('Save the draft before publishing it.');
          if(!(await confirmDialog('Publish this sandbox configuration to production? Existing production changes will block publication.')))return;
          await api(path+'/sandboxes/'+button.dataset.runtimePromote+'/promote',{method:'POST',body:JSON.stringify({revision:Number(button.dataset.revision)})});
        } else if(button.dataset.runtimeImport) {
          await api(path+'/integrations/'+button.dataset.id+'/items/'+button.dataset.runtimeImport+'/import',{method:'POST',body:'{}'});
        } else {
          const action=button.dataset.runtimeAction;
          if(action==='disconnect'&&!(await confirmDialog('Remove this connection and its inbox? Imported CRM records are retained.')))return;
          const result=await api(path+'/integrations/'+button.dataset.id+(action==='disconnect'?'':'/'+action),{method:action==='disconnect'?'DELETE':'POST',body:action==='disconnect'?undefined:'{}'});
          if(action==='sync')toast('Sync complete',`${result.synced} records processed.${result.has_more?' Another batch is available.':''}`);
          if(action==='disconnect'){await navigate('/setup/connections');return;}
        }
        await navigate(location.pathname,true);
      }catch(error){toast('Operation failed',error.message,'error');}finally{button.disabled=false;}
    });
  }
  return {view};
}
