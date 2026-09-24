'use strict';

// UNITS
async function loadUnits(){
  const{data}=await sb.from('unidades').select('*').order('nombre');
  const db=(data||[]).map(u=>u.nombre);
  allUnits=[...new Set([...DEFAULT_UNITS,...db])].sort();
  refreshUnitDatalist();renderUnitsList();
}

function refreshUnitDatalist(){
  const dl=document.getElementById('units-datalist');
  if(dl)dl.innerHTML=allUnits.map(u=>`<option value="${u}">`).join('');
}

function renderUnitsList(){
  const c=document.getElementById('units-list');if(!c)return;
  c.innerHTML=allUnits.map(u=>`
    <div class="list-item-row">
      <span style="font-family:'DM Mono',monospace;font-size:12px">${u}</span>
      ${DEFAULT_UNITS.includes(u)?'<span style="font-size:10px;color:var(--text3)">default</span>':`<button class="btn btn-danger btn-xs" onclick="deleteUnit('${u}')">✕</button>`}
    </div>`).join('');
}

async function addUnit(){
  const inp=document.getElementById('new-unit-name');
  const name=inp.value.trim();if(!name)return;
  if(!allUnits.includes(name)){await sb.from('unidades').insert({nombre:name});}
  inp.value='';await loadUnits();
}

async function deleteUnit(name){
  if(!confirm(`Remove unit "${name}"?`))return;
  await sb.from('unidades').delete().eq('nombre',name);await loadUnits();
}

// CATEGORIES
async function loadCategories(){
  const{data}=await sb.from('categorias').select('*').order('nombre');
  allCategories=data||[];populateCategorySelects();renderCategoriesList();
}

function populateCategorySelects(){
  ['mat-cat','filter-cat-cat','filter-admin-cat','order-filter-category'].forEach(id=>{
    const el=document.getElementById(id);
    if(!el)return;
    const val=el.value;
    while(el.options.length>1)el.remove(1);
    allCategories.forEach(c=>el.add(new Option(`${c.icono||'📦'} ${c.nombre}`,c.id)));
    el.value=val;
  });
}

function renderCategoriesList(){
  const c=document.getElementById('categories-list');if(!c)return;
  if(!allCategories.length){c.innerHTML='<div style="font-size:12px;color:var(--text3);padding:8px 0">No categories yet</div>';return;}
  c.innerHTML=allCategories.map(cat=>`
    <div class="list-item-row">
      <span style="font-size:13px">${cat.icono||'📦'} ${cat.nombre}</span>
      <button class="btn btn-danger btn-xs" onclick="deleteCategory(${cat.id})">✕</button>
    </div>`).join('');
}

async function addCategory(){
  const icon=document.getElementById('new-cat-icon').value.trim()||'📦';
  const name=document.getElementById('new-cat-name').value.trim();if(!name)return;
  await sb.from('categorias').insert({nombre:name,icono:icon});
  document.getElementById('new-cat-icon').value='';document.getElementById('new-cat-name').value='';
  await loadCategories();
}

async function saveModalCategory(){
  const icon=document.getElementById('modal-cat-icon').value.trim()||'📦';
  const name=document.getElementById('modal-cat-name').value.trim();if(!name)return;
  await sb.from('categorias').insert({nombre:name,icono:icon});
  document.getElementById('modal-cat-icon').value='';document.getElementById('modal-cat-name').value='';
  closeModal('modal-category');await loadCategories();
}

async function deleteCategory(id){
  if(!confirm('Delete this category?'))return;
  await sb.from('categorias').delete().eq('id',id);await loadCategories();
}


// DOCUMENT SEQUENCES
let documentSequenceSettings={material_returns:[],material_requests:[]};

function settingsEscape(value){
  return String(value??'')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'","&#39;");
}

function formatSequenceNumber(value){
  const n=Math.max(0,Number(value)||0);
  return String(n).padStart(3,'0');
}

function setDocumentSequenceStatus(message,error=false){
  const el=document.getElementById('document-sequence-status');
  if(!el)return;
  el.textContent=message||'';
  el.style.color=error?'var(--red)':'var(--text2)';
}

async function loadDocumentSequenceSettings(){
  const returnContainer=document.getElementById('return-sequence-settings');
  const requestContainer=document.getElementById('request-sequence-settings');
  if(!returnContainer||!requestContainer)return;
  if(currentProfile?.role!=='admin'){
    returnContainer.textContent='Administrator access required.';
    requestContainer.textContent='Administrator access required.';
    return;
  }

  returnContainer.innerHTML='<div class="loading"><div class="spinner"></div> Loading...</div>';
  requestContainer.innerHTML='<div class="loading"><div class="spinner"></div> Loading...</div>';
  setDocumentSequenceStatus('');

  const {data,error}=await sb.rpc('admin_get_document_sequences');
  if(error){
    const message='Could not load document sequences: '+error.message;
    returnContainer.textContent=message;
    requestContainer.textContent=message;
    setDocumentSequenceStatus(message,true);
    return;
  }

  documentSequenceSettings=data||{material_returns:[],material_requests:[]};
  renderMaterialReturnSequenceSettings(documentSequenceSettings.material_returns||[]);
  renderMaterialRequestSequenceSettings(documentSequenceSettings.material_requests||[]);
}

function renderMaterialReturnSequenceSettings(rows){
  const c=document.getElementById('return-sequence-settings');if(!c)return;
  if(!rows.length){
    c.innerHTML='<div class="sequence-empty">No projects available.</div>';
    return;
  }
  c.innerHTML='<div class="sequence-table-wrap"><table class="sequence-table"><thead><tr><th>Project</th><th>Last issued</th><th>Next number</th><th></th></tr></thead><tbody>'+
    rows.map(row=>`
      <tr>
        <td>
          <div class="sequence-project-code">${settingsEscape(row.project_code||'')}</div>
          <div class="sequence-project-name">${settingsEscape(row.project_name||'Project')}</div>
        </td>
        <td><span class="sequence-number-readonly">${formatSequenceNumber(row.last_issued)}</span></td>
        <td><input class="form-input sequence-next-input" id="return-seq-${row.project_id}" type="number" min="1" step="1" value="${Number(row.next_number)||1}" inputmode="numeric"></td>
        <td><button class="btn btn-secondary btn-sm" onclick="saveMaterialReturnSequence(${row.project_id})">Save</button></td>
      </tr>`).join('')+
    '</tbody></table></div>';
}

function renderMaterialRequestSequenceSettings(rows){
  const c=document.getElementById('request-sequence-settings');if(!c)return;
  if(!rows.length){
    c.innerHTML='<div class="sequence-empty">No active requesters with document initials are configured.</div>';
    return;
  }

  const groups=new Map();
  rows.forEach(row=>{
    const key=String(row.project_id);
    if(!groups.has(key))groups.set(key,{project_id:row.project_id,project_code:row.project_code,project_name:row.project_name,rows:[]});
    groups.get(key).rows.push(row);
  });

  c.innerHTML=[...groups.values()].map(group=>`
    <div class="request-sequence-project">
      <div class="request-sequence-project-head">
        <span class="sequence-project-code">${settingsEscape(group.project_code||'')}</span>
        <strong>${settingsEscape(group.project_name||'Project')}</strong>
      </div>
      <div class="sequence-table-wrap">
        <table class="sequence-table">
          <thead><tr><th>Requester</th><th>Initials</th><th>Last issued</th><th>Next number</th><th></th></tr></thead>
          <tbody>
            ${group.rows.map(row=>`
              <tr>
                <td>${settingsEscape(row.requester_name||'User')}</td>
                <td><span class="sequence-initials">${settingsEscape(row.requester_initials||'')}</span></td>
                <td><span class="sequence-number-readonly">${formatSequenceNumber(row.last_issued)}</span></td>
                <td><input class="form-input sequence-next-input" id="request-seq-${row.project_id}-${row.user_id}" type="number" min="1" step="1" value="${Number(row.next_number)||1}" inputmode="numeric"></td>
                <td><button class="btn btn-secondary btn-sm" onclick="saveMaterialRequestSequence(${row.project_id},'${row.user_id}')">Save</button></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`).join('');
}

async function saveMaterialReturnSequence(projectId){
  const row=(documentSequenceSettings.material_returns||[]).find(r=>Number(r.project_id)===Number(projectId));
  const input=document.getElementById(`return-seq-${projectId}`);
  const next=Number.parseInt(input?.value,10);
  if(!Number.isInteger(next)||next<1){
    setDocumentSequenceStatus('Next Material Return number must be 1 or greater.',true);
    input?.focus();return;
  }
  if(next<=Number(row?.last_issued||0)){
    setDocumentSequenceStatus(`Next number must be greater than the last issued number (${formatSequenceNumber(row?.last_issued)}).`,true);
    input?.focus();return;
  }
  const project=[row?.project_code,row?.project_name].filter(Boolean).join(' - ');
  if(!confirm(`Set the next Material Return for ${project} to ${formatSequenceNumber(next)}?`))return;

  setDocumentSequenceStatus('Saving Material Return sequence...');
  const {error}=await sb.rpc('admin_set_material_return_next',{p_project_id:Number(projectId),p_next_number:next});
  if(error){setDocumentSequenceStatus(error.message,true);return;}
  setDocumentSequenceStatus(`Next Material Return for ${project} is now ${formatSequenceNumber(next)}.`);
  await loadDocumentSequenceSettings();
}

async function saveMaterialRequestSequence(projectId,userId){
  const row=(documentSequenceSettings.material_requests||[]).find(r=>Number(r.project_id)===Number(projectId)&&String(r.user_id)===String(userId));
  const input=document.getElementById(`request-seq-${projectId}-${userId}`);
  const next=Number.parseInt(input?.value,10);
  if(!Number.isInteger(next)||next<1){
    setDocumentSequenceStatus('Next Material Request number must be 1 or greater.',true);
    input?.focus();return;
  }
  if(next<=Number(row?.last_issued||0)){
    setDocumentSequenceStatus(`Next number must be greater than the last issued number (${formatSequenceNumber(row?.last_issued)}).`,true);
    input?.focus();return;
  }
  const project=[row?.project_code,row?.project_name].filter(Boolean).join(' - ');
  const requester=`${row?.requester_name||'Requester'} [${row?.requester_initials||''}]`;
  if(!confirm(`Set the next Material Request for ${project} / ${requester} to ${formatSequenceNumber(next)}?`))return;

  setDocumentSequenceStatus('Saving Material Request sequence...');
  const {error}=await sb.rpc('admin_set_material_request_next',{p_project_id:Number(projectId),p_user_id:userId,p_next_number:next});
  if(error){setDocumentSequenceStatus(error.message,true);return;}
  setDocumentSequenceStatus(`Next Material Request for ${project} / ${requester} is now ${formatSequenceNumber(next)}.`);
  await loadDocumentSequenceSettings();
}
