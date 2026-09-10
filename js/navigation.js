'use strict';

// NAVIGATION
const pageMeta={
  'dashboard':['Dashboard','Overview'],
  'pedidos':['My Orders','Order history'],
  'nuevo-pedido':['New Order','Submit a material request'],
  'materiales':['Material Catalog','Browse available materials'],
  'admin-pedidos':['All Orders','Manage all requests'],
  'admin-materiales':['Inventory','Manage materials & stock'],
  'admin-usuarios':['Users','Manage access & roles'],
  'admin-proyectos':['Sites & Projects','Manage construction sites'],
  'admin-settings':['Settings','Categories & units of measure'],
};

function navigateTo(page){
  currentPage=page;
  sessionStorage.setItem('currentPage', page);
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  const pg=document.getElementById('page-'+page);if(pg)pg.classList.add('active');
  const nv=document.getElementById('nav-'+page);if(nv)nv.classList.add('active');
  const[title,sub]=pageMeta[page]||[page,''];
  document.getElementById('top-title').textContent=title;
  document.getElementById('top-subtitle').textContent=sub;
  if(page==='dashboard')loadDashboard();
  else if(page==='pedidos')loadMyOrders();
  else if(page==='nuevo-pedido')initNewOrder();
  else if(page==='materiales')renderCatalog();
  else if(page==='admin-pedidos')loadAllOrders();
  else if(page==='admin-materiales')renderAdminMaterials();
  else if(page==='admin-usuarios')loadUsers();
  else if(page==='admin-proyectos')renderProjects();
  else if(page==='admin-settings'){renderCategoriesList();renderUnitsList();}
  closeSidebar();
}
