'use strict';

// PROJECTS
async function loadProjects(){
  const{data}=await sb.from('proyectos').select('*').order('nombre');
  allProjects=data||[];
  populateProjectSelects();

  // If the app opens directly on New Order, projects may arrive after the page renders.
  // Reload the saved draft once the project options are available.
  if(currentPage==='nuevo-pedido'){
    loadOrderDraft();
    renderSelectedOrderItems();
  }
}

function populateProjectSelects(){
  const el=document.getElementById('order-project');
  if(el){
    const v=el.dataset.pendingValue || el.value;
    while(el.options.length>1)el.remove(1);
    allProjects.filter(p=>p.estado==='activo').forEach(p=>el.add(new Option(`${p.codigo?'['+p.codigo+'] ':''}${p.nombre}`,p.id)));
    el.value=v;
    delete el.dataset.pendingValue;
  }
  const all=document.getElementById('filter-all-project');
  if(all){while(all.options.length>1)all.remove(1);allProjects.forEach(p=>all.add(new Option(p.nombre,p.id)));}
}

async function loadMaterials(){
  const{data}=await sb.from('materiales').select('*, categorias(nombre, icono)').order('nombre');
  allMaterials=data||[];
  renderCatalog();
  renderAdminMaterials();
  renderNewOrderMaterials();
  renderSelectedOrderItems();
}
