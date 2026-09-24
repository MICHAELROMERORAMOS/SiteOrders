'use strict';

// SiteOrders workflow v2. Loaded after the legacy modules so it can extend them
// without replacing the existing application structure.
var workflowProjectIds=new Set();
var workflowEditingOrder=null;
var workflowDialogContext=null;

const wfLegacyInitNewOrder=window.siteOrdersLegacy.initNewOrder;
const wfLegacyRenderAdminMaterials=window.siteOrdersLegacy.renderAdminMaterials;
const wfLegacyOpenMaterialModal=window.siteOrdersLegacy.openMaterialModal;
const wfLegacySaveMaterial=window.siteOrdersLegacy.saveMaterial;

function wfEscape(value){
  return String(value??'')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'",'&#39;');
}

function wfNumber(value){
  const n=Number(value||0);
  return Number.isFinite(n)?n:0;
}

function wfFormatDate(value){
  if(!value)return '–';
  const d=new Date(value);
  if(Number.isNaN(d.getTime()))return '–';
  return d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
}

function wfRoleLabel(){
  const labels={worker:'👷 Worker',supervisor:'🦺 Supervisor',store:'📦 Store',admin:'⭐ Administrator'};
  return labels[workflowRole()]||workflowRole();
}

async function loadWorkflowContext(){
  workflowProjectIds=new Set();
  if(isSupervisorRole()){
    const{data,error}=await sb.from('project_members').select('project_id').eq('user_id',currentUser.id);
    if(!error)(data||[]).forEach(r=>workflowProjectIds.add(Number(r.project_id)));
  }
}

function ensureWorkflowDialog(){
  if(document.getElementById('modal-workflow-v2'))return;
  const el=document.createElement('div');
  el.className='modal-overlay';
  el.id='modal-workflow-v2';
  el.innerHTML=`
    <div class="modal" style="max-width:760px">
      <div class="modal-header">
        <span class="modal-title" id="workflow-v2-title">Workflow</span>
        <button class="modal-close" onclick="closeModal('modal-workflow-v2')">×</button>
      </div>
      <div class="modal-body" id="workflow-v2-body"></div>
      <div class="modal-footer" id="workflow-v2-footer"></div>
    </div>`;
  document.body.appendChild(el);
}

function openWorkflowDialog(title,body,footer=''){
  ensureWorkflowDialog();
  document.getElementById('workflow-v2-title').textContent=title;
  document.getElementById('workflow-v2-body').innerHTML=body;
  document.getElementById('workflow-v2-footer').innerHTML=footer;
  openModal('modal-workflow-v2');
}

function ensureWorkflowStyles(){
  if(document.getElementById('workflow-v2-styles'))return;
  const style=document.createElement('style');
  style.id='workflow-v2-styles';
  style.textContent=`
    .wf-qty-grid{display:grid;grid-template-columns:repeat(4,minmax(80px,1fr));gap:8px;margin-top:7px}
    .wf-qty-box{padding:8px 9px;border:1px solid var(--border);border-radius:8px;background:var(--bg3)}
    .wf-qty-label{font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:.45px}
    .wf-qty-value{font-size:13px;font-weight:700;margin-top:2px}
    .wf-item{padding:12px 0;border-bottom:1px solid var(--border)}
    .wf-item:last-child{border-bottom:0}
    .wf-alert{padding:9px 11px;border:1px solid var(--accent-border);background:var(--accent-bg);border-radius:8px;font-size:12px;margin-top:8px}
    .wf-activity{padding:8px 0;border-bottom:1px solid var(--border);font-size:12px}
    .wf-activity:last-child{border-bottom:0}
    .wf-project-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;max-height:330px;overflow:auto}
    @media(max-width:700px){.wf-qty-grid{grid-template-columns:1fr 1fr}.wf-project-grid{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);
}

function setRoleUI(){
  ensureWorkflowStyles();
  ensureWorkflowStatusOptions();

  document.querySelectorAll('.admin-only').forEach(el=>el.style.display='none');

  const myOrders=document.getElementById('nav-pedidos');
  const newOrder=document.getElementById('nav-nuevo-pedido');
  const managed=document.getElementById('nav-admin-pedidos');
  const inventory=document.getElementById('nav-admin-materiales');
  const users=document.getElementById('nav-admin-usuarios');
  const sites=document.getElementById('nav-admin-proyectos');
  const settings=document.getElementById('nav-admin-settings');
  const materialReturns=document.getElementById('nav-material-returns');
  const returnBranding=document.getElementById('nav-return-branding');

  if(myOrders)myOrders.style.display=isStoreRole()?'none':'';
  if(newOrder)newOrder.style.display=canCreateOrder()?'':'none';
  if(materialReturns)materialReturns.style.display=canCreateOrder()?'':'none';

  if(managed){
    managed.style.display=canSeeManagedOrders()?'':'none';
    const label=isAdminRole()?'All Orders':isSupervisorRole()?'Project Orders':'Store Orders';
    managed.innerHTML=`<span class="nav-icon">📋</span> ${label}`;
  }
  if(inventory){
    inventory.style.display=canManageInventory()?'':'none';
    inventory.innerHTML='<span class="nav-icon">⚙️</span> Inventory';
  }
  if(users)users.style.display=isAdminRole()?'':'none';
  if(sites)sites.style.display=isAdminRole()?'':'none';
  if(settings)settings.style.display=isAdminRole()?'':'none';
  if(returnBranding)returnBranding.style.display=isAdminRole()?'':'none';

  const adminSections=[...document.querySelectorAll('.nav-section.admin-only')];
  adminSections.forEach(el=>el.style.display=(canSeeManagedOrders()||canManageInventory()||isAdminRole())?'':'none');

  const topNew=[...document.querySelectorAll('.top-bar [onclick="navigateTo(\'nuevo-pedido\')"]')][0];
  if(topNew)topNew.style.display=canCreateOrder()?'':'none';

  const roleEl=document.getElementById('user-role-sidebar');
  if(roleEl)roleEl.textContent=wfRoleLabel();

  const inventoryPage=document.getElementById('page-admin-materiales');
  if(inventoryPage){
    const categoryBtn=inventoryPage.querySelector('[onclick="openModal(\'modal-category\')"]');
    if(categoryBtn)categoryBtn.style.display=isAdminRole()?'':'none';
  }

  const statLabel=document.querySelector('#stat-my-orders')?.closest('.stat-card')?.querySelector('.stat-label');
  if(statLabel){
    statLabel.textContent=isWorkerRole()?'My Orders':isSupervisorRole()?'Project Orders':isStoreRole()?'Store Orders':'All Orders';
  }
}

function ensureWorkflowStatusOptions(){
  const options=[
    ['','All statuses'],['pending','Pending Approval'],['approved','Approved'],
    ['awaiting_receipt','Awaiting Receipt'],['partial','Partial'],['completed','Completed'],['rejected','Rejected'],['delivered','Delivered (legacy)']
  ];
  ['filter-status','filter-all-status'].forEach(id=>{
    const el=document.getElementById(id);if(!el)return;
    const current=el.value;
    el.innerHTML=options.map(([v,t])=>`<option value="${v}">${t}</option>`).join('');
    el.value=current;
  });
}

function showApp(){
  document.getElementById('auth-screen').style.display='none';
  document.getElementById('app').style.display='block';
  const init=(currentProfile.full_name||currentUser.email||'?')[0].toUpperCase();
  document.getElementById('user-avatar-sidebar').textContent=init;
  document.getElementById('user-name-sidebar').textContent=currentProfile.full_name||currentUser.email;

  (async()=>{
    await loadWorkflowContext();
    setRoleUI();
    await Promise.all([loadUnits(),loadCategories(),loadProjects()]);
    await loadMaterials();
    const saved=sessionStorage.getItem('currentPage')||'dashboard';
    navigateTo(canAccessWorkflowPage(saved)?saved:'dashboard');
    if(isAdminRole())pollPendingUsers();
  })().catch(err=>{
    console.error('Workflow initialization error:',err);
    navigateTo('dashboard');
  });
}

const WORKFLOW_PAGE_META={
  dashboard:['Dashboard','Overview'],
  pedidos:['My Orders','Orders requested for me'],
  'nuevo-pedido':['New Order','Submit a material request'],
  'material-returns':['Material Returns','Save and edit return lists'],
  'return-branding':['Company Branding','Company name and logo for document PDFs'],
  materiales:['Material Catalog','Browse available materials'],
  'admin-pedidos':['Orders','Workflow and material requests'],
  'admin-materiales':['Inventory','Material catalog administration'],
  'admin-usuarios':['Users','Manage access, roles and supervisors'],
  'admin-proyectos':['Sites & Projects','Manage construction sites'],
  'admin-settings':['Settings','Categories & units of measure']
};

function navigateTo(page){
  if(!canAccessWorkflowPage(page))page='dashboard';
  currentPage=page;
  sessionStorage.setItem('currentPage',page);
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  document.getElementById('page-'+page)?.classList.add('active');
  document.getElementById('nav-'+page)?.classList.add('active');
  const[title,sub]=WORKFLOW_PAGE_META[page]||[page,''];
  document.getElementById('top-title').textContent=title;
  document.getElementById('top-subtitle').textContent=sub;

  if(page==='dashboard')loadDashboard();
  else if(page==='pedidos')loadMyOrders();
  else if(page==='nuevo-pedido')initNewOrder();
  else if(page==='material-returns')loadMaterialReturnsPage();
  else if(page==='return-branding')loadReturnBranding();
  else if(page==='materiales')renderCatalog();
  else if(page==='admin-pedidos')loadAllOrders();
  else if(page==='admin-materiales')renderAdminMaterials();
  else if(page==='admin-usuarios')loadUsers();
  else if(page==='admin-proyectos')renderProjects();
  else if(page==='admin-settings'){renderCategoriesList();renderUnitsList();loadDocumentSequenceSettings();}
  closeSidebar();
}

function populateProjectSelects(){
  const allowed=isSupervisorRole()?allProjects.filter(p=>workflowProjectIds.has(Number(p.id))):allProjects;
  const orderSelect=document.getElementById('order-project');
  if(orderSelect){
    const v=orderSelect.dataset.pendingValue||orderSelect.value;
    while(orderSelect.options.length>1)orderSelect.remove(1);
    allowed.filter(p=>p.estado==='activo').forEach(p=>orderSelect.add(new Option(`${p.codigo?'['+p.codigo+'] ':''}${p.nombre}`,p.id)));
    orderSelect.value=v;
    delete orderSelect.dataset.pendingValue;
  }
  const all=document.getElementById('filter-all-project');
  if(all){
    while(all.options.length>1)all.remove(1);
    allowed.forEach(p=>all.add(new Option(p.nombre,p.id)));
  }
}

async function loadDashboard(){
  let query=sb.from('pedidos').select('*, proyectos(nombre,codigo)').order('created_at',{ascending:false});
  if(isWorkerRole())query=query.eq('user_id',currentUser.id);
  const{data,error}=await query;
  if(error)console.error(error);
  const orders=data||[];
  document.getElementById('stat-my-orders').textContent=orders.length;
  document.getElementById('stat-pending').textContent=orders.filter(o=>o.status==='pending').length;
  document.getElementById('stat-approved').textContent=orders.filter(o=>['approved','awaiting_receipt','partial'].includes(o.status)).length;
  document.getElementById('stat-projects').textContent=allProjects.filter(p=>p.estado==='activo').length;
  const c=document.getElementById('dashboard-orders-list');
  const recent=orders.slice(0,6);
  c.innerHTML=recent.length?renderOrderTable(recent,!isWorkerRole()):'<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-text">No orders yet</div></div>';
  if(isAdminRole())pollPendingUsers();
}

async function loadMyOrders(){
  const{data,error}=await sb.from('pedidos').select('*, proyectos(nombre,codigo)').eq('user_id',currentUser.id).order('created_at',{ascending:false});
  if(error)console.error(error);
  allOrders=data||[];
  renderMyOrdersList();
}

async function loadAllOrders(){
  const{data,error}=await sb.from('pedidos').select('*, proyectos(nombre,codigo)').order('created_at',{ascending:false});
  if(error){
    console.error(error);
    document.getElementById('all-orders-list').innerHTML=`<div class="alert alert-error">${wfEscape(error.message)}</div>`;
    return;
  }
  allOrders=data||[];
  renderAllOrdersList();
}

function renderAllOrdersList(){
  const search=(document.getElementById('search-all-orders')?.value||'').toLowerCase();
  const status=document.getElementById('filter-all-status')?.value||'';
  const project=document.getElementById('filter-all-project')?.value||'';
  const filtered=allOrders.filter(o=>
    (!search||(o.project_name_snapshot||o.proyectos?.nombre||'').toLowerCase().includes(search)||(o.requested_by_name||'').toLowerCase().includes(search)||(o.order_number||'').toLowerCase().includes(search))&&
    (!status||o.status===status)&&(!project||String(o.project_id)===String(project))
  );
  document.getElementById('all-orders-list').innerHTML=filtered.length?renderOrderTable(filtered,true):'<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-text">No orders found</div></div>';
}

function statusBadge(s){
  const cls={pending:'badge-yellow',approved:'badge-green',awaiting_receipt:'badge-blue',partial:'badge-yellow',completed:'badge-green',rejected:'badge-red',delivered:'badge-blue'};
  const label={pending:'Pending Approval',approved:'Approved',awaiting_receipt:'Awaiting Receipt',partial:'Partial',completed:'Completed',rejected:'Rejected',delivered:'Delivered'};
  return `<span class="badge ${cls[s]||'badge-gray'}">${wfEscape(label[s]||s||'–')}</span>`;
}

function renderOrderTable(orders,managed=false){
  const rows=orders.map(order=>{
    const number=order.order_number||`#${String(order.id).slice(-6)}`;
    const project=order.project_name_snapshot||order.proyectos?.nombre||'–';
    const requester=order.requested_by_name||'–';
    return `<tr>
      <td><div style="font-family:'DM Mono',monospace;font-size:11px;font-weight:700">${wfEscape(number)}</div>${order.document_name?`<div style="font-size:9px;color:var(--text3);margin-top:3px;max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${wfEscape(order.document_name)}</div>`:''}</td>
      <td><div style="font-weight:500">${wfEscape(project)}</div>${order.delivery_date?`<div style="font-size:10px;color:var(--text3)">Due: ${wfEscape(wfFormatDate(order.delivery_date))}</div>`:''}</td>
      ${managed?`<td style="font-size:12px;color:var(--text2)">${wfEscape(requester)}</td>`:''}
      <td>${statusBadge(order.status)}${order.urgencia&&order.urgencia!=='normal'?` <span class="badge ${order.urgencia==='critical'?'badge-red':'badge-yellow'}">${wfEscape(order.urgencia)}</span>`:''}</td>
      <td style="font-size:11px;color:var(--text2)">${wfEscape(wfFormatDate(order.created_at))}</td>
      <td><button class="btn btn-ghost btn-sm" onclick='viewOrder(${JSON.stringify(order).replace(/'/g,"&#39;")})'>View →</button></td>
    </tr>`;
  }).join('');
  return `<div class="table-wrap"><table><thead><tr><th>Order No.</th><th>Site</th>${managed?'<th>Requester</th>':''}<th>Status</th><th>Date</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

async function viewOrder(order){
  const [itemsRes,dispatchRes,altRes,activityRes]=await Promise.all([
    sb.from('pedido_items').select('*, materiales(nombre,unidad_medida,id_material,imagen_url,categorias(icono))').eq('pedido_id',order.id).order('line_number'),
    sb.from('order_dispatches').select('*, order_dispatch_items(*)').eq('pedido_id',order.id).order('created_at',{ascending:true}),
    sb.from('order_alternatives').select('*').eq('pedido_id',order.id).order('created_at',{ascending:true}),
    sb.from('order_activity').select('*').eq('pedido_id',order.id).order('created_at',{ascending:false}).limit(30)
  ]);
  const items=itemsRes.data||[];
  const dispatches=dispatchRes.data||[];
  const alternatives=altRes.data||[];
  const activity=activityRes.data||[];
  const hasDispatch=dispatches.length>0;
  const pendingDispatch=dispatches.find(d=>!d.receipt_confirmed_at);

  _pdfOrder={...order,profiles:{full_name:order.requested_by_name||'–'}};
  _pdfItems=items.map(i=>({...i,qty_delivered:i.quantity_delivered}));

  const itemHtml=items.map(item=>{
    const unit=item.unit_snapshot||item.materiales?.unidad_medida||'';
    const ordered=wfNumber(item.cantidad);
    const dispatched=wfNumber(item.quantity_delivered);
    const received=wfNumber(item.quantity_received);
    const outstanding=Math.max(0,ordered-received);
    const alt=alternatives.filter(a=>a.pedido_item_id===item.id).slice(-1)[0];
    const actualAlt=alt?allMaterials.find(m=>Number(m.id)===Number(alt.alternative_material_id)):null;
    return `<div class="wf-item">
      <div style="display:flex;gap:9px;align-items:flex-start">
        <div style="flex:1"><div style="font-size:10px;color:var(--text3);font-family:'DM Mono',monospace">${wfEscape(item.material_code_snapshot||item.materiales?.id_material||'')}</div><div style="font-weight:700">${wfEscape(item.material_name_snapshot||item.materiales?.nombre||'–')}</div></div>
        ${canProposeAlternative(order)?`<button class="btn btn-secondary btn-xs" onclick="openAlternativeDialog(${order.id},${item.id})">Alternative</button>`:''}
      </div>
      <div class="wf-qty-grid">
        <div class="wf-qty-box"><div class="wf-qty-label">Requested</div><div class="wf-qty-value">${ordered} ${wfEscape(unit)}</div></div>
        <div class="wf-qty-box"><div class="wf-qty-label">Dispatched</div><div class="wf-qty-value">${dispatched} ${wfEscape(unit)}</div></div>
        <div class="wf-qty-box"><div class="wf-qty-label">Received</div><div class="wf-qty-value">${received} ${wfEscape(unit)}</div></div>
        <div class="wf-qty-box"><div class="wf-qty-label">Outstanding</div><div class="wf-qty-value">${outstanding} ${wfEscape(unit)}</div></div>
      </div>
      ${item.observation||item.notas?`<div style="font-size:11px;color:var(--text2);margin-top:7px">${wfEscape(item.observation||item.notas)}</div>`:''}
      ${alt?`<div class="wf-alert"><b>Store alternative:</b> ${wfEscape(actualAlt?.nombre||'Material #'+alt.alternative_material_id)} · ${wfEscape(alt.status)}${alt.reason?`<br>${wfEscape(alt.reason)}`:''}${alt.status==='pending'&&canDecideAlternative(order)?`<div style="margin-top:7px;display:flex;gap:6px"><button class="btn btn-danger btn-xs" onclick="decideAlternative(${alt.id},'rejected')">Reject</button><button class="btn btn-success btn-xs" onclick="decideAlternative(${alt.id},'approved')">Approve</button></div>`:''}</div>`:''}
    </div>`;
  }).join('');

  const activityHtml=activity.length?activity.map(a=>{
    const d=a.details||{};
    return `<div class="wf-activity"><div style="font-weight:600">${wfEscape(d.message||String(a.action||'').replaceAll('_',' '))}</div><div style="font-size:10px;color:var(--text3);margin-top:2px">${wfEscape(d.actor_name||'System')} · ${wfEscape(wfFormatDate(a.created_at))}</div></div>`;
  }).join(''):'<div style="font-size:12px;color:var(--text3)">No activity yet.</div>';

  const requester=order.requested_by_name||'–';
  const creator=order.created_by_name_snapshot||requester;
  document.getElementById('order-detail-body').innerHTML=`
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
      <div><div class="wf-qty-label">ORDER NO.</div><div style="font-family:'DM Mono',monospace;font-weight:700">${wfEscape(order.order_number||'#'+order.id)}</div></div>
      <div><div class="wf-qty-label">STATUS</div>${statusBadge(order.status)}</div>
      <div><div class="wf-qty-label">SITE</div><div>${wfEscape(order.project_name_snapshot||order.proyectos?.nombre||'–')}</div></div>
      <div><div class="wf-qty-label">REQUESTED FOR</div><div>${wfEscape(requester)}</div></div>
      <div><div class="wf-qty-label">CREATED BY</div><div>${wfEscape(creator)}</div></div>
      <div><div class="wf-qty-label">REQUIRED BY</div><div>${wfEscape(wfFormatDate(order.delivery_date))}</div></div>
      ${order.notas?`<div style="grid-column:1/-1"><div class="wf-qty-label">NOTES</div><div>${wfEscape(order.notas)}</div></div>`:''}
    </div>
    <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Materials</div>
    ${itemHtml||'<div class="empty-state"><div class="empty-text">No items</div></div>'}
    <hr class="section-divider">
    <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Activity</div>
    ${activityHtml}`;

  let footer='';
  if(canApproveOrder(order))footer+=`<button class="btn btn-danger" onclick="rejectWorkflowOrder(${order.id})">Reject</button><button class="btn btn-success" onclick="approveWorkflowOrder(${order.id})">✓ Approve</button>`;
  if(canEditWorkflowOrder(order,hasDispatch))footer+=`<button class="btn btn-secondary" onclick='startEditWorkflowOrder(${JSON.stringify(order).replace(/'/g,"&#39;")})'>Edit</button>`;
  if(canDispatchOrder(order))footer+=`<button class="btn btn-primary" onclick="openDispatchDialog(${order.id})">Dispatch</button>`;
  if(canConfirmReceipt(order)&&pendingDispatch)footer+=`<button class="btn btn-success" onclick="openReceiptDialog(${pendingDispatch.id})">Confirm Receipt</button>`;
  if(isAdminRole()||(isSupervisorRole()&&workflowProjectAllowed(order.project_id)))footer+=`<button class="btn btn-danger" onclick="deleteMaterialRequest(${order.id})">Delete request</button>`;
  footer+=`<button class="btn btn-secondary btn-sm" onclick="downloadOrderExcel()">⬇ Excel</button><button class="btn btn-secondary btn-sm" onclick="downloadOrderPDF()">⬇ PDF</button><button class="btn btn-ghost" onclick="closeModal('modal-order-detail')">Close</button>`;
  document.getElementById('order-detail-footer').innerHTML=footer;
  workflowDialogContext={order,items,dispatches,alternatives};
  openModal('modal-order-detail');
}

async function deleteMaterialRequest(orderId){
  if(!isAdminRole()&&!(isSupervisorRole()&&workflowProjectAllowed(workflowDialogContext?.order?.project_id)))return;
  const label=workflowDialogContext?.order?.order_number||`#${orderId}`;
  if(!confirm(`Delete Material Request ${label} and its associated records? This cannot be undone.`))return;
  const {data,error}=await sb.from('pedidos').delete().eq('id',orderId).select('id');
  if(error||!data?.length){alert(error?.message||'The request could not be deleted.');return;}
  closeModal('modal-order-detail');
  await refreshWorkflowOrders();
}

async function approveWorkflowOrder(orderId){
  const{error}=await sb.rpc('approve_material_request_v2',{p_order_id:orderId});
  if(error)return alert(error.message);
  closeModal('modal-order-detail');
  await refreshWorkflowOrders();
}

async function rejectWorkflowOrder(orderId){
  const reason=prompt('Reason for rejection (optional):','')??null;
  if(reason===null)return;
  const{error}=await sb.rpc('reject_material_request_v2',{p_order_id:orderId,p_reason:reason});
  if(error)return alert(error.message);
  closeModal('modal-order-detail');
  await refreshWorkflowOrders();
}

async function refreshWorkflowOrders(){
  if(document.getElementById('page-admin-pedidos')?.classList.contains('active'))await loadAllOrders();
  else if(document.getElementById('page-pedidos')?.classList.contains('active'))await loadMyOrders();
  else await loadDashboard();
}

function initNewOrder(){
  if(workflowEditingOrder){
    const {order,items}=workflowEditingOrder;
    currentMaterialForOrder=null;
    orderItems=items.map(i=>({material_id:i.material_id,cantidad:wfNumber(i.cantidad),notas:i.notas||i.observation||''}));
    document.getElementById('order-project').value=order.project_id||'';
    document.getElementById('order-project').disabled=true;
    document.getElementById('order-delivery-date').value=order.delivery_date||'';
    document.getElementById('order-urgency').value=order.urgencia||'normal';
    document.getElementById('order-notes').value=order.notas||'';
    renderNewOrderMaterials();
    renderSelectedOrderItems();
    prepareRequestedForControl(order.user_id);
    document.getElementById('top-title').textContent='Edit Order';
    return;
  }
  document.getElementById('order-project').disabled=false;
  wfLegacyInitNewOrder();
  prepareRequestedForControl();
}

async function prepareRequestedForControl(selectedUserId=null){
  const project=document.getElementById('order-project');
  if(!project)return;
  let wrap=document.getElementById('order-requested-for-wrap');
  if(!wrap){
    wrap=document.createElement('div');
    wrap.id='order-requested-for-wrap';
    wrap.className='form-group';
    wrap.style.marginBottom='13px';
    wrap.innerHTML='<label class="form-label">Requested for / Receiver</label><select class="form-input" id="order-requested-for"><option value="">Select receiver...</option></select>';
    project.closest('.two-col')?.insertAdjacentElement('afterend',wrap);
  }
  wrap.style.display=(isSupervisorRole()||isAdminRole())?'block':'none';
  if(!(isSupervisorRole()||isAdminRole()))return;
  if(!project.dataset.workflowReceiverListener){
    project.addEventListener('change',()=>loadRequestReceivers());
    project.dataset.workflowReceiverListener='1';
  }
  await loadRequestReceivers(selectedUserId);
}

async function loadRequestReceivers(selectedUserId=null){
  const projectId=Number(document.getElementById('order-project')?.value||0);
  const select=document.getElementById('order-requested-for');
  if(!select)return;
  select.innerHTML='<option value="">Select receiver...</option>';
  if(!projectId)return;
  const{data,error}=await sb.rpc('list_request_receivers_v2',{p_project_id:projectId});
  if(error){console.error(error);return;}
  (data||[]).forEach(u=>select.add(new Option(`${u.full_name||'Unnamed'}${u.position?' · '+u.position:''}`,u.id)));
  const wanted=selectedUserId||workflowEditingOrder?.order?.user_id||'';
  if(wanted)select.value=wanted;
  select.disabled=Boolean(workflowEditingOrder);
}

async function submitOrder(){
  if(isStoreRole())return alert('Store users cannot create material requests.');
  const projectId=Number(document.getElementById('order-project').value||0);
  const notes=document.getElementById('order-notes').value.trim();
  const urgency=document.getElementById('order-urgency').value;
  const deliveryDate=document.getElementById('order-delivery-date').value||null;
  if(!projectId)return alert('Select a project.');
  if(!orderItems.length)return alert('Add at least one material.');
  const invalid=orderItems.find(i=>!i.material_id||wfNumber(i.cantidad)<=0);
  if(invalid)return alert('All materials require a valid quantity.');

  let requestedFor=currentUser.id;
  if(isSupervisorRole()||isAdminRole()){
    requestedFor=document.getElementById('order-requested-for')?.value||'';
    if(!requestedFor)return alert('Select who will receive this order.');
  }
  const p_items=orderItems.map(i=>({material_id:Number(i.material_id),cantidad:wfNumber(i.cantidad),notas:String(i.notas||'').trim()}));
  const btn=document.querySelector('[onclick="submitOrder()"]');
  if(btn)btn.disabled=true;
  try{
    let result;
    if(workflowEditingOrder){
      result=await sb.rpc('update_material_request_v2',{
        p_order_id:workflowEditingOrder.order.id,p_project_id:projectId,p_requested_for:requestedFor,
        p_notes:notes||null,p_urgency:urgency,p_delivery_date:deliveryDate,p_items
      });
    }else{
      result=await sb.rpc('create_material_request_v2',{
        p_project_id:projectId,p_notes:notes||null,p_urgency:urgency,p_delivery_date:deliveryDate,
        p_supplier:null,p_delivery_location:null,p_items,p_requested_for:requestedFor
      });
    }
    if(result.error)return alert(result.error.message);
    clearOrderDraft();
    resetNewOrderForm();
    workflowEditingOrder=null;
    alert('Material Request saved successfully.');
    navigateTo(isWorkerRole()?'pedidos':'admin-pedidos');
  }finally{
    if(btn)btn.disabled=false;
  }
}

async function startEditWorkflowOrder(order){
  const{data:items,error}=await sb.from('pedido_items').select('*').eq('pedido_id',order.id).order('line_number');
  if(error)return alert(error.message);
  workflowEditingOrder={order,items:items||[]};
  closeModal('modal-order-detail');
  navigateTo('nuevo-pedido');
}

async function openDispatchDialog(orderId){
  const{data:items,error}=await sb.from('pedido_items').select('*, materiales(nombre,unidad_medida)').eq('pedido_id',orderId).order('line_number');
  if(error)return alert(error.message);
  const{data:alts}=await sb.from('order_alternatives').select('*').eq('pedido_id',orderId).eq('status','approved');
  const rows=(items||[]).map(i=>{
    const outstanding=Math.max(0,wfNumber(i.cantidad)-wfNumber(i.quantity_received));
    if(outstanding<=0)return'';
    const alt=(alts||[]).filter(a=>a.pedido_item_id===i.id).slice(-1)[0];
    const altMat=alt?allMaterials.find(m=>Number(m.id)===Number(alt.alternative_material_id)):null;
    return `<div class="wf-item" data-dispatch-item="${i.id}">
      <div style="font-weight:700">${wfEscape(i.material_name_snapshot||i.materiales?.nombre||'Material')}</div>
      <div style="font-size:11px;color:var(--text3)">Outstanding: ${outstanding} ${wfEscape(i.unit_snapshot||i.materiales?.unidad_medida||'')}</div>
      ${altMat?`<div class="wf-alert">Approved alternative: <b>${wfEscape(altMat.nombre)}</b></div>`:''}
      <div class="two-col" style="margin-top:8px">
        <div class="form-group" style="margin:0"><label class="form-label">Dispatch now</label><input class="form-input wf-dispatch-qty" type="number" min="0" max="${outstanding}" step="any" value="0"></div>
        <div class="form-group" style="margin:0"><label class="form-label">Material sent</label><select class="form-input wf-dispatch-material"><option value="${i.material_id}">Original material</option>${altMat?`<option value="${altMat.id}">Alternative: ${wfEscape(altMat.nombre)}</option>`:''}</select></div>
      </div>
    </div>`;
  }).join('');
  openWorkflowDialog('Dispatch Materials',rows||'<div class="empty-state"><div class="empty-text">Nothing outstanding.</div></div>',`<button class="btn btn-ghost" onclick="closeModal('modal-workflow-v2')">Cancel</button><button class="btn btn-primary" onclick="submitDispatch(${orderId})">Dispatch Materials</button>`);
}

async function submitDispatch(orderId){
  const lines=[...document.querySelectorAll('#workflow-v2-body [data-dispatch-item]')].map(el=>({
    pedido_item_id:Number(el.dataset.dispatchItem),quantity:wfNumber(el.querySelector('.wf-dispatch-qty').value),material_id:Number(el.querySelector('.wf-dispatch-material').value)
  })).filter(x=>x.quantity>0);
  if(!lines.length)return alert('Enter at least one quantity to dispatch.');
  const note=prompt('Dispatch note (optional):','')??'';
  const{error}=await sb.rpc('dispatch_material_request_v2',{p_order_id:orderId,p_note:note||null,p_items:lines});
  if(error)return alert(error.message);
  closeModal('modal-workflow-v2');closeModal('modal-order-detail');
  await refreshWorkflowOrders();
}

async function openReceiptDialog(dispatchId){
  const{data:dispatch,error}=await sb.from('order_dispatches').select('*, order_dispatch_items(*)').eq('id',dispatchId).single();
  if(error)return alert(error.message);
  const itemIds=(dispatch.order_dispatch_items||[]).map(x=>x.pedido_item_id);
  const{data:orderItemsData}=itemIds.length?await sb.from('pedido_items').select('id,material_name_snapshot,unit_snapshot').in('id',itemIds):{data:[]};
  const byId=new Map((orderItemsData||[]).map(i=>[i.id,i]));
  const rows=(dispatch.order_dispatch_items||[]).map(di=>{
    const i=byId.get(di.pedido_item_id)||{};
    return `<div class="wf-item" data-receipt-item="${di.id}">
      <div style="font-weight:700">${wfEscape(i.material_name_snapshot||'Material')}</div>
      <div style="font-size:11px;color:var(--text3)">Store dispatched: ${wfNumber(di.quantity_dispatched)} ${wfEscape(i.unit_snapshot||'')}</div>
      <div class="two-col" style="margin-top:8px">
        <div class="form-group" style="margin:0"><label class="form-label">Actually received</label><input class="form-input wf-received-qty" type="number" min="0" max="${wfNumber(di.quantity_dispatched)}" step="any" value="${wfNumber(di.quantity_dispatched)}"></div>
        <div class="form-group" style="margin:0"><label class="form-label">Observation</label><input class="form-input wf-received-note" placeholder="Missing, damaged, etc."></div>
      </div>
    </div>`;
  }).join('');
  openWorkflowDialog('Confirm Material Receipt',rows,`<button class="btn btn-ghost" onclick="closeModal('modal-workflow-v2')">Cancel</button><button class="btn btn-success" onclick="submitReceipt(${dispatchId})">Confirm Receipt</button>`);
}

async function submitReceipt(dispatchId){
  const lines=[...document.querySelectorAll('#workflow-v2-body [data-receipt-item]')].map(el=>({
    dispatch_item_id:Number(el.dataset.receiptItem),quantity_received:wfNumber(el.querySelector('.wf-received-qty').value),observation:el.querySelector('.wf-received-note').value.trim()
  }));
  const{error}=await sb.rpc('confirm_dispatch_receipt_v2',{p_dispatch_id:dispatchId,p_items:lines});
  if(error)return alert(error.message);
  closeModal('modal-workflow-v2');closeModal('modal-order-detail');
  await refreshWorkflowOrders();
}

function openAlternativeDialog(orderId,itemId){
  const source=workflowDialogContext?.items?.find(i=>i.id===itemId);
  const opts=allMaterials.filter(m=>Number(m.id)!==Number(source?.material_id)).map(m=>`<option value="${m.id}">${wfEscape(m.id_material||'')} · ${wfEscape(m.nombre)}</option>`).join('');
  openWorkflowDialog('Propose Alternative',`<div class="form-group"><label class="form-label">Alternative material</label><select class="form-input" id="wf-alt-material"><option value="">Select material...</option>${opts}</select></div><div class="form-group"><label class="form-label">Reason / note</label><textarea class="form-input" id="wf-alt-reason" rows="3" placeholder="Why is this alternative proposed?"></textarea></div>`,`<button class="btn btn-ghost" onclick="closeModal('modal-workflow-v2')">Cancel</button><button class="btn btn-primary" onclick="submitAlternative(${orderId},${itemId})">Send to Supervisor</button>`);
}

async function submitAlternative(orderId,itemId){
  const materialId=Number(document.getElementById('wf-alt-material').value||0);
  const reason=document.getElementById('wf-alt-reason').value.trim();
  if(!materialId)return alert('Select an alternative material.');
  const{error}=await sb.rpc('propose_alternative_v2',{p_order_id:orderId,p_pedido_item_id:itemId,p_alternative_material_id:materialId,p_reason:reason||null});
  if(error)return alert(error.message);
  closeModal('modal-workflow-v2');closeModal('modal-order-detail');
  await refreshWorkflowOrders();
}

async function decideAlternative(alternativeId,decision){
  const note=prompt(decision==='approved'?'Approval note (optional):':'Rejection note (optional):','')??null;
  if(note===null)return;
  const{error}=await sb.rpc('decide_alternative_v2',{p_alternative_id:alternativeId,p_decision:decision,p_note:note||null});
  if(error)return alert(error.message);
  closeModal('modal-order-detail');
  await refreshWorkflowOrders();
}

function renderAdminMaterials(){
  if(!isStoreRole())return wfLegacyRenderAdminMaterials();
  const c=document.getElementById('admin-materials-list');if(!c)return;
  const search=(document.getElementById('search-admin-mat')?.value||'').toLowerCase();
  const cat=document.getElementById('filter-admin-cat')?.value||'';
  const filtered=allMaterials.filter(m=>(!search||m.nombre.toLowerCase().includes(search)||(m.id_material||'').toLowerCase().includes(search))&&(!cat||String(m.categoria_id)===String(cat)));
  c.innerHTML=filtered.length?`<div class="table-wrap"><table><thead><tr><th>Code</th><th>Material</th><th>Category</th><th>Unit</th></tr></thead><tbody>${filtered.map(m=>`<tr><td style="font-family:'DM Mono',monospace;font-size:11px">${wfEscape(m.id_material||'')}</td><td>${wfEscape(m.nombre)}</td><td>${wfEscape(m.categorias?.nombre||'–')}</td><td>${wfEscape(m.unidad_medida||'–')}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty-state"><div class="empty-text">No materials found.</div></div>';
}

function openMaterialModal(mat=null){
  if(isStoreRole()&&mat)return alert('Store can add new materials but cannot edit existing materials.');
  return wfLegacyOpenMaterialModal(mat);
}

async function saveMaterial(){
  if(!isStoreRole())return wfLegacySaveMaterial();
  if(editingMaterialId)return alert('Store can add new materials but cannot edit existing materials.');
  const data={
    id_material:document.getElementById('mat-id').value.trim(),
    nombre:document.getElementById('mat-name').value.trim(),
    descripcion:document.getElementById('mat-desc').value.trim(),
    categoria_id:document.getElementById('mat-cat').value||null,
    unidad_medida:document.getElementById('mat-unit').value.trim()||'unit'
  };
  if(!data.nombre)return alert('Name is required.');
  const fi=document.getElementById('mat-img-file');
  if(fi?.files?.[0]){
    const file=fi.files[0];
    const ext=(file.name.split('.').pop()||'jpg').toLowerCase();
    const path=`materiales/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
    const up=await sb.storage.from('material-images').upload(path,file,{upsert:false});
    if(up.error)return alert('Image upload error: '+up.error.message);
    data.imagen_url=sb.storage.from('material-images').getPublicUrl(path).data.publicUrl;
  }else if(selectedMaterialImageUrl){
    data.imagen_url=selectedMaterialImageUrl;
  }
  const{error}=await sb.from('materiales').insert(data);
  if(error)return alert('Error: '+error.message);
  closeModal('modal-material');
  selectedMaterialImageUrl='';
  await loadMaterials();
}

function renderUsersList(){
  if(!isAdminRole())return;
  const users=currentUserTab==='pending'?allUsers.filter(u=>u.status==='pendiente'):allUsers;
  const c=document.getElementById('users-list');
  if(!users.length){c.innerHTML='<div class="empty-state"><div class="empty-icon">👥</div><div class="empty-text">No users found</div></div>';return;}
  if(currentUserTab==='pending'){
    c.innerHTML=users.map(u=>`<div class="user-pending-card"><div class="user-avatar" style="width:40px;height:40px">${wfEscape((u.full_name||u.email||'?')[0].toUpperCase())}</div><div style="flex:1"><div class="user-pending-name">${wfEscape(u.full_name||'–')}</div><div class="user-pending-meta">${wfEscape(u.email||'')}</div></div><button class="btn btn-danger btn-sm" onclick="rejectUser('${u.id}')">Reject</button><button class="btn btn-success btn-sm" onclick="approveUser('${u.id}')">Approve</button></div>`).join('');
    return;
  }
  const rows=users.map(u=>{
    const self=u.id===currentUser.id;
    const role=u.role==='encargado'?'worker':u.role;
    const roleControl=self?'<span class="badge badge-orange">Admin (you)</span>':`<select class="form-input" style="width:135px;font-size:12px" onchange="changeUserRole('${u.id}',this.value)" ${u.status==='pendiente'?'disabled':''}><option value="encargado" ${role==='worker'?'selected':''}>Worker</option><option value="supervisor" ${role==='supervisor'?'selected':''}>Supervisor</option><option value="store" ${role==='store'?'selected':''}>Store</option><option value="admin" ${role==='admin'?'selected':''}>Admin</option></select>`;
    const status=u.status==='activo'?'<span class="badge badge-green">Active</span>':u.status==='pendiente'?'<span class="badge badge-yellow">Pending</span>':'<span class="badge badge-red">Inactive</span>';
    const projectBtn=role==='supervisor'?`<button class="btn btn-secondary btn-xs" onclick="openSupervisorProjects('${u.id}','${String(u.full_name||'Supervisor').replace(/'/g,"&#39;")}')">Projects</button>`:'';
    const toggle=self?'—':u.status==='pendiente'?`<button class="btn btn-success btn-xs" onclick="approveUser('${u.id}')">Approve</button>`:`<button class="btn ${u.status==='activo'?'btn-danger':'btn-success'} btn-xs" onclick="toggleUserStatus('${u.id}','${u.status}')">${u.status==='activo'?'Deactivate':'Activate'}</button>`;
    return `<tr><td><b>${wfEscape(u.full_name||'–')}</b><div style="font-size:10px;color:var(--text3)">${wfEscape(u.email||'')}</div></td><td>${roleControl}</td><td>${status}</td><td><div style="display:flex;gap:6px">${projectBtn}${toggle}</div></td></tr>`;
  }).join('');
  c.innerHTML=`<div class="table-wrap"><table><thead><tr><th>User</th><th>Role</th><th>Status</th><th>Action</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

async function openSupervisorProjects(userId,name){
  const{data:assigned,error}=await sb.from('project_members').select('project_id').eq('user_id',userId);
  if(error)return alert(error.message);
  const set=new Set((assigned||[]).map(x=>Number(x.project_id)));
  const checks=allProjects.map(p=>`<label style="display:flex;gap:8px;align-items:center;border:1px solid var(--border);padding:9px;border-radius:8px"><input type="checkbox" class="wf-project-check" value="${p.id}" ${set.has(Number(p.id))?'checked':''}> <span>${wfEscape(p.codigo?'['+p.codigo+'] ':'')}${wfEscape(p.nombre)}</span></label>`).join('');
  openWorkflowDialog(`Projects · ${name}`,`<div class="wf-project-grid">${checks}</div>`,`<button class="btn btn-ghost" onclick="closeModal('modal-workflow-v2')">Cancel</button><button class="btn btn-primary" onclick="saveSupervisorProjects('${userId}')">Save Projects</button>`);
}

async function saveSupervisorProjects(userId){
  const ids=[...document.querySelectorAll('.wf-project-check:checked')].map(x=>Number(x.value));
  const del=await sb.from('project_members').delete().eq('user_id',userId);
  if(del.error)return alert(del.error.message);
  if(ids.length){
    const ins=await sb.from('project_members').insert(ids.map(project_id=>({project_id,user_id:userId})));
    if(ins.error)return alert(ins.error.message);
  }
  closeModal('modal-workflow-v2');
  alert('Supervisor projects updated.');
}

// Compatibility: legacy UI may still call this function. Workflow changes go through RPCs.
async function updateOrderStatus(orderId,status){
  if(status==='approved')return approveWorkflowOrder(orderId);
  if(status==='rejected')return rejectWorkflowOrder(orderId);
  alert('Use the workflow actions for dispatch and receipt.');
}

document.addEventListener('DOMContentLoaded',()=>{
  ensureWorkflowDialog();
  ensureWorkflowStyles();
  ensureWorkflowStatusOptions();
});
