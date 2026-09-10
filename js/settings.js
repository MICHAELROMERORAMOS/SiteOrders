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
