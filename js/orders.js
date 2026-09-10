'use strict';

// DASHBOARD
async function loadDashboard(){
  const isAdmin=currentProfile.role==='admin';
  const q=isAdmin
    ?sb.from('pedidos').select('*, proyectos(nombre, codigo), profiles(full_name)').order('created_at',{ascending:false}).limit(6)
    :sb.from('pedidos').select('*, proyectos(nombre, codigo)').eq('user_id',currentUser.id).order('created_at',{ascending:false}).limit(6);
  const{data:orders}=await q;
  const{data:all}=await(isAdmin?sb.from('pedidos').select('id,status'):sb.from('pedidos').select('id,status').eq('user_id',currentUser.id));
  document.getElementById('stat-my-orders').textContent=all?.length||0;
  document.getElementById('stat-pending').textContent=all?.filter(o=>o.status==='pending').length||0;
  document.getElementById('stat-approved').textContent=all?.filter(o=>o.status==='approved').length||0;
  document.getElementById('stat-projects').textContent=allProjects.filter(p=>p.estado==='activo').length;
  if(isAdmin)pollPendingUsers();
  const c=document.getElementById('dashboard-orders-list');
  if(!orders||orders.length===0){c.innerHTML='<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-text">No orders yet</div></div>';return;}
  c.innerHTML=renderOrderTable(orders,isAdmin);
}

// MY ORDERS
async function loadMyOrders(){
  const{data}=await sb.from('pedidos').select('*, proyectos(nombre, codigo)').eq('user_id',currentUser.id).order('created_at',{ascending:false});
  allOrders=data||[];renderMyOrdersList();
}
function filterOrders(){renderMyOrdersList();}
function renderMyOrdersList(){
  const search=document.getElementById('search-pedidos').value.toLowerCase();
  const status=document.getElementById('filter-status').value;
  const filtered=allOrders.filter(o=>(!search||(o.proyectos?.nombre||'').toLowerCase().includes(search))&&(!status||o.status===status));
  document.getElementById('orders-list').innerHTML=filtered.length?renderOrderTable(filtered,false):'<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-text">No orders found</div></div>';
}

// ALL ORDERS
async function loadAllOrders(){
  const{data}=await sb.from('pedidos').select('*, proyectos(nombre, codigo), profiles(full_name)').order('created_at',{ascending:false});
  allOrders=data||[];renderAllOrdersList();
}
function filterAllOrders(){renderAllOrdersList();}
function renderAllOrdersList(){
  const search=document.getElementById('search-all-orders').value.toLowerCase();
  const status=document.getElementById('filter-all-status').value;
  const project=document.getElementById('filter-all-project').value;
  const filtered=allOrders.filter(o=>
    (!search||(o.proyectos?.nombre||'').toLowerCase().includes(search)||(o.profiles?.full_name||'').toLowerCase().includes(search))&&
    (!status||o.status===status)&&(!project||o.project_id==project));
  document.getElementById('all-orders-list').innerHTML=filtered.length?renderOrderTable(filtered,true):'<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-text">No orders found</div></div>';
}

function renderOrderTable(orders, isAdmin){
  const rows = orders.map(order => {
    const status = statusBadge(order.status);

    const urgencyClasses = {
      urgent: 'badge-yellow',
      critical: 'badge-red'
    };

    const urgencyBadge = urgencyClasses[order.urgencia]
      ? `<span class="badge ${urgencyClasses[order.urgencia]}"
          style="margin-left:4px">
          ${escapeOrderText(order.urgencia)}
        </span>`
      : '';

    const createdDate = order.created_at
      ? new Date(order.created_at).toLocaleDateString(
          'en-GB',
          {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
          }
        )
      : '–';

    const delivery = order.delivery_date
      ? `
        <div style="
          font-size:10px;
          color:var(--text3);
          margin-top:1px
        ">
          Due:
          ${new Date(order.delivery_date).toLocaleDateString(
            'en-GB',
            {
              day: '2-digit',
              month: 'short'
            }
          )}
        </div>
      `
      : '';

    const orderNumber =
      order.order_number ||
      `#${String(order.id).slice(-6)}`;

    const documentName =
      order.document_name || '';

    const projectName =
      order.project_name_snapshot ||
      order.proyectos?.nombre ||
      '–';

    const requesterColumn = isAdmin
      ? `
        <td style="font-size:12px;color:var(--text2)">
          ${
            escapeOrderText(
              order.requested_by_name ||
              order.profiles?.full_name ||
              '–'
            )
          }
        </td>
      `
      : '';

    return `
      <tr>
        <td>
          <div style="
            font-family:'DM Mono',monospace;
            font-size:11px;
            font-weight:700
          ">
            ${escapeOrderText(orderNumber)}
          </div>

          ${
            documentName
              ? `
                <div
                  title="${escapeOrderText(documentName)}"
                  style="
                    max-width:230px;
                    margin-top:3px;
                    font-size:9px;
                    color:var(--text3);
                    white-space:nowrap;
                    overflow:hidden;
                    text-overflow:ellipsis
                  "
                >
                  ${escapeOrderText(documentName)}
                </div>
              `
              : ''
          }
        </td>

        <td>
          <div style="font-weight:500">
            ${escapeOrderText(projectName)}
          </div>
          ${delivery}
        </td>

        ${requesterColumn}

        <td>
          ${status}
          ${urgencyBadge}
        </td>

        <td style="font-size:11px;color:var(--text2)">
          ${createdDate}
        </td>

        <td>
          <button
            class="btn btn-ghost btn-sm"
            onclick='viewOrder(${JSON.stringify(order).replace(/'/g, "&#39;")})'
          >
            View →
          </button>
        </td>
      </tr>
    `;
  }).join('');

  const requesterHeader = isAdmin
    ? '<th>Requester</th>'
    : '';

  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Order No.</th>
            <th>Site</th>
            ${requesterHeader}
            <th>Status</th>
            <th>Date</th>
            <th></th>
          </tr>
        </thead>

        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  `;
}

function escapeOrderText(value){
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function statusBadge(s){
  const m={pending:'badge-yellow',approved:'badge-green',rejected:'badge-red',delivered:'badge-blue'};
  return`<span class="badge ${m[s]||'badge-gray'}">${s||'–'}</span>`;
}

// VIEW ORDER

async function viewOrder(order){
  const{data:items}=await sb.from('pedido_items').select('*, materiales(nombre, unidad_medida, id_material, imagen_url, categorias(icono))').eq('pedido_id',order.id);
  _pdfOrder=order;
  _pdfItems=items||[];
  const isAdmin=currentProfile.role==='admin';


const itemRows = (items || []).map(item => {
  const imageUrl =
    item.materiales?.imagen_url || '';

  const materialCode =
    item.material_code_snapshot ||
    item.materiales?.id_material ||
    '';

  const materialName =
    item.material_name_snapshot ||
    item.materiales?.nombre ||
    '–';

  const materialUnit =
    item.unit_snapshot ||
    item.materiales?.unidad_medida ||
    '';

  const notes =
    item.observation ||
    item.notas ||
    '';

  const hasImage = Boolean(imageUrl);

  const imageButton = hasImage
    ? `
      <button
        class="btn btn-ghost btn-xs"
        title="View image"
        onclick="previewOrderItemImage(
          '${String(imageUrl).replace(/'/g, '&#39;')}',
          '${String(materialName).replace(/'/g, '&#39;')}'
        )"
      >
        🖼
      </button>
    `
    : `
      <span style="font-size:16px;color:var(--text3)">
        ${item.materiales?.categorias?.icono || '📦'}
      </span>
    `;

  return `
    <tr>
      <td>${imageButton}</td>

      <td>
        <span style="
          font-family:'DM Mono',monospace;
          font-size:10px;
          color:var(--text3)
        ">
          ${escapeOrderText(materialCode)}
        </span>
      </td>

      <td>
        ${escapeOrderText(materialName)}
      </td>

      <td style="text-align:right">
        ${Number(item.cantidad)}
        ${escapeOrderText(materialUnit)}
      </td>

      <td style="font-size:11px;color:var(--text2)">
        ${escapeOrderText(notes)}
      </td>
    </tr>
  `;
}).join('');
  const delRow=order.delivery_date?`<div><div style="font-size:10px;color:var(--text3);margin-bottom:3px">REQUIRED BY</div><div style="font-size:13px">${new Date(order.delivery_date).toLocaleDateString('en',{weekday:'short',day:'2-digit',month:'short',year:'numeric'})}</div></div>`:'';

const orderNumber =
  order.order_number ||
  `#${String(order.id).slice(-8)}`;

const documentName =
  order.document_name ||
  'Not assigned';

const requesterName =
  order.requested_by_name ||
  order.profiles?.full_name ||
  '–';

const projectName =
  order.project_name_snapshot ||
  order.proyectos?.nombre ||
  '–';

const projectCode =
  order.project_code_snapshot ||
  order.proyectos?.codigo ||
  '';

const deliveryLocation =
  order.delivery_location || '';

const supplier =
  order.supplier || '';

document.getElementById('order-detail-body').innerHTML = `
  <div
    style="
      display:grid;
      grid-template-columns:1fr 1fr;
      gap:12px;
      margin-bottom:16px
    "
  >
    <div>
      <div style="
        font-size:10px;
        color:var(--text3);
        margin-bottom:3px
      ">
        ORDER NO.
      </div>

      <div style="
        font-family:'DM Mono',monospace;
        font-size:13px;
        font-weight:700
      ">
        ${escapeOrderText(orderNumber)}
      </div>
    </div>

    <div>
      <div style="
        font-size:10px;
        color:var(--text3);
        margin-bottom:3px
      ">
        STATUS
      </div>

      ${statusBadge(order.status)}
    </div>

    <div style="grid-column:span 2">
      <div style="
        font-size:10px;
        color:var(--text3);
        margin-bottom:3px
      ">
        DOCUMENT
      </div>

      <div style="font-size:12px;font-weight:600">
        ${escapeOrderText(documentName)}
      </div>
    </div>

    <div>
      <div style="
        font-size:10px;
        color:var(--text3);
        margin-bottom:3px
      ">
        SITE
      </div>

      <div style="font-size:13px">
        ${escapeOrderText(projectName)}
        ${
          projectCode
            ? `<span style="color:var(--text3)">
                [${escapeOrderText(projectCode)}]
              </span>`
            : ''
        }
      </div>
    </div>

    <div>
      <div style="
        font-size:10px;
        color:var(--text3);
        margin-bottom:3px
      ">
        REQUESTER
      </div>

      <div style="font-size:13px">
        ${escapeOrderText(requesterName)}
      </div>
    </div>

    <div>
      <div style="
        font-size:10px;
        color:var(--text3);
        margin-bottom:3px
      ">
        URGENCY
      </div>

      <div style="font-size:13px">
        ${escapeOrderText(order.urgencia || 'normal')}
      </div>
    </div>

    ${delRow}

    ${
      supplier
        ? `
          <div>
            <div style="
              font-size:10px;
              color:var(--text3);
              margin-bottom:3px
            ">
              SUPPLIER
            </div>

            <div style="font-size:13px">
              ${escapeOrderText(supplier)}
            </div>
          </div>
        `
        : ''
    }

    ${
      deliveryLocation
        ? `
          <div>
            <div style="
              font-size:10px;
              color:var(--text3);
              margin-bottom:3px
            ">
              DELIVERY LOCATION
            </div>

            <div style="font-size:13px">
              ${escapeOrderText(deliveryLocation)}
            </div>
          </div>
        `
        : ''
    }

    ${
      order.notas
        ? `
          <div style="grid-column:span 2">
            <div style="
              font-size:10px;
              color:var(--text3);
              margin-bottom:3px
            ">
              NOTES
            </div>

            <div style="font-size:13px">
              ${escapeOrderText(order.notas)}
            </div>
          </div>
        `
        : ''
    }
  </div>

  <div style="
    font-size:10px;
    font-weight:600;
    color:var(--text3);
    text-transform:uppercase;
    letter-spacing:.6px;
    margin-bottom:8px
  ">
    Materials
  </div>

  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th></th>
          <th>ID</th>
          <th>Material</th>
          <th style="text-align:right">Qty</th>
          <th>Notes</th>
        </tr>
      </thead>

      <tbody>
        ${
          itemRows ||
          `
            <tr>
              <td
                colspan="5"
                style="text-align:center;color:var(--text3)"
              >
                No items
              </td>
            </tr>
          `
        }
      </tbody>
    </table>
  </div>
`;
  const footer=document.getElementById('order-detail-footer');
  footer.innerHTML='';
  if(isAdmin&&order.status==='pending'){
    footer.innerHTML=`<button class="btn btn-danger" onclick="updateOrderStatus(${order.id},'rejected')">Reject</button>
      <button class="btn btn-success" onclick="updateOrderStatus(${order.id},'approved')">✓ Approve</button>
      <button class="btn btn-primary" onclick="updateOrderStatus(${order.id},'delivered')">Mark Delivered</button>`;
  }else if(isAdmin&&order.status==='approved'){
    footer.innerHTML=`<button class="btn btn-primary" onclick="updateOrderStatus(${order.id},'delivered')">Mark Delivered</button>`;
  }
  footer.innerHTML+=`<button class="btn btn-secondary btn-sm" onclick="downloadOrderExcel()" title="Download Excel">⬇ Excel</button>`;
  footer.innerHTML+=`<button class="btn btn-secondary btn-sm" onclick="downloadOrderPDF()" title="Download PDF">⬇ PDF</button>`;
  footer.innerHTML+=`<button class="btn btn-ghost" onclick="closeModal('modal-order-detail')">Close</button>`;
  openModal('modal-order-detail');
}



function previewOrderItemImage(url, name){
  document.getElementById('item-image-modal-title').textContent=name||'Material Image';
  document.getElementById('item-image-modal-img').src=url;
  document.getElementById('item-image-modal-img').alt=name||'';
  openModal('modal-item-image');
}
async function updateOrderStatus(orderId,status){
  await sb.from('pedidos').update({status,updated_at:new Date().toISOString()}).eq('id',orderId);
  closeModal('modal-order-detail');
  if(document.getElementById('page-admin-pedidos').classList.contains('active'))loadAllOrders();
  else loadDashboard();
  pollPendingUsers();
}


// NEW ORDER
let currentMaterialForOrder=null;


function initNewOrder(){
  currentMaterialForOrder=null;
  setupOrderDraftAutosave();

  const restored=loadOrderDraft();

  // First clean load only. Do not reset when navigating away and back.
  if(!restored && !orderItems.length){
    document.getElementById('order-notes').value='';
    document.getElementById('order-urgency').value='normal';
    document.getElementById('order-project').value='';
    document.getElementById('order-delivery-date').value='';

    const searchEl=document.getElementById('order-filter-search');
    const catEl=document.getElementById('order-filter-category');

    if(searchEl) searchEl.value='';
    if(catEl) catEl.value='';
    newOrderMatPage=1;
  }

  renderNewOrderMaterials();
  renderSelectedOrderItems();
}

function getOrderDraftKey(){
  if(!currentUser?.id)return null;
  return `siteorders:new-order-draft:${currentUser.id}`;
}

function collectOrderDraft(){
  return {
    version: ORDER_DRAFT_VERSION,
    projectId: document.getElementById('order-project')?.value || '',
    deliveryDate: document.getElementById('order-delivery-date')?.value || '',
    urgency: document.getElementById('order-urgency')?.value || 'normal',
    notes: document.getElementById('order-notes')?.value || '',
    search: document.getElementById('order-filter-search')?.value || '',
    category: document.getElementById('order-filter-category')?.value || '',
    newOrderMatPage,
    items: orderItems,
    updatedAt: new Date().toISOString()
  };
}

function saveOrderDraft(){
  const key=getOrderDraftKey();
  if(!key)return;

  try{
    localStorage.setItem(key, JSON.stringify(collectOrderDraft()));
  }catch(e){
    console.warn('Could not save order draft:', e);
  }
}

function loadOrderDraft(){
  const key=getOrderDraftKey();
  if(!key)return false;

  try{
    const raw=localStorage.getItem(key);
    if(!raw)return false;

    const draft=JSON.parse(raw);
    if(!draft || draft.version!==ORDER_DRAFT_VERSION)return false;

    orderItems=Array.isArray(draft.items) ? draft.items.map(i=>({
      material_id: i.material_id,
      cantidad: Number(i.cantidad) || 0,
      notas: i.notas || ''
    })).filter(i=>i.material_id && i.cantidad>0) : [];

    const projectEl=document.getElementById('order-project');
    if(projectEl){
      projectEl.value=draft.projectId || '';
      if(draft.projectId && projectEl.value!==String(draft.projectId)){
        projectEl.dataset.pendingValue=String(draft.projectId);
      }
    }

    const deliveryEl=document.getElementById('order-delivery-date');
    const urgencyEl=document.getElementById('order-urgency');
    const notesEl=document.getElementById('order-notes');
    const searchEl=document.getElementById('order-filter-search');
    const catEl=document.getElementById('order-filter-category');

    if(deliveryEl)deliveryEl.value=draft.deliveryDate || '';
    if(urgencyEl)urgencyEl.value=draft.urgency || 'normal';
    if(notesEl)notesEl.value=draft.notes || '';
    if(searchEl)searchEl.value=draft.search || '';
    if(catEl)catEl.value=draft.category || '';

    newOrderMatPage=Number(draft.newOrderMatPage) || 1;
    return true;
  }catch(e){
    console.warn('Could not load order draft:', e);
    return false;
  }
}

function clearOrderDraft(){
  const key=getOrderDraftKey();
  if(key)localStorage.removeItem(key);
}

function resetNewOrderForm(){
  orderItems=[];
  currentMaterialForOrder=null;
  newOrderMatPage=1;

  document.getElementById('order-project').value='';
  document.getElementById('order-delivery-date').value='';
  document.getElementById('order-urgency').value='normal';
  document.getElementById('order-notes').value='';

  const searchEl=document.getElementById('order-filter-search');
  const catEl=document.getElementById('order-filter-category');
  if(searchEl)searchEl.value='';
  if(catEl)catEl.value='';

  renderNewOrderMaterials();
  renderSelectedOrderItems();
}

function setupOrderDraftAutosave(){
  ['order-project','order-delivery-date','order-urgency','order-notes','order-filter-search','order-filter-category'].forEach(id=>{
    const el=document.getElementById(id);
    if(!el || el.dataset.draftAutosaveBound==='1')return;

    el.addEventListener('input', saveOrderDraft);
    el.addEventListener('change', saveOrderDraft);
    el.dataset.draftAutosaveBound='1';
  });
}


function filterNewOrderMaterials(){
  newOrderMatPage=1;
  saveOrderDraft();
  renderNewOrderMaterials();
}


function renderNewOrderMaterials(){
  const grid=document.getElementById('new-order-material-grid');
  if(!grid)return;

  const search=(document.getElementById('order-filter-search')?.value||'').trim().toLowerCase();
  const cat=document.getElementById('order-filter-category')?.value||'';

  // Solo muestra materiales si hay algo buscado o filtrado
  if(!search && !cat){
    grid.innerHTML=`<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">🔍</div><div class="empty-text">Search or filter to show materials</div></div>`;
    return;
  }

  const filtered=allMaterials.filter(m=>{
    const name=(m.nombre||'').toLowerCase();
    const code=(m.id_material||'').toLowerCase();
    const matchesSearch=!search || name.includes(search) || code.includes(search);
    const matchesCat=!cat || String(m.categoria_id)===String(cat);
    return matchesSearch && matchesCat;
  });

  if(!filtered.length){
    grid.innerHTML=`<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">🔍</div><div class="empty-text">No materials found</div></div>`;
    return;
  }

  const totalPages=Math.ceil(filtered.length/PAGE_SIZE);
  if(newOrderMatPage>totalPages)newOrderMatPage=totalPages;
  const paged=filtered.slice((newOrderMatPage-1)*PAGE_SIZE, newOrderMatPage*PAGE_SIZE);

  const cards=paged.map(m=>{
    const selected=orderItems.find(i=>String(i.material_id)===String(m.id));
    const imgEl=m.imagen_url
      ? `<img src="${m.imagen_url}" class="material-card-img" style="display:block;object-fit:contain;padding:6px" alt="${m.nombre}">`
      : `<div class="material-card-img">${m.categorias?.icono||'📦'}</div>`;
    const selectedBadge=selected
      ? `<div style="margin-top:6px"><span class="badge badge-orange">Added: ${selected.cantidad} ${m.unidad_medida||''}</span></div>`
      : '';
    return `<div class="material-card selectable" onclick="openOrderItemModal(${m.id})">
        ${imgEl}
        <div class="material-card-body">
          <div class="material-card-id">${m.id_material||''}</div>
          <div class="material-card-name">${m.nombre}</div>
          ${m.categorias ? `<div style="margin-bottom:5px"><span class="badge badge-gray" style="font-size:10px">${m.categorias.icono||''} ${m.categorias.nombre}</span></div>` : ''}
          ${selectedBadge}
          <div style="margin-top:10px">
            <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); openOrderItemModal(${m.id})">
              ${selected ? 'Edit quantity' : 'Add'}
            </button>
          </div>
        </div>
      </div>`;
  }).join('');
  grid.innerHTML=cards+renderPaginator(newOrderMatPage,totalPages,'newOrderMatPage','renderNewOrderMaterials','new-order-material-grid');
}

function openOrderItemModal(materialId){
  const material=allMaterials.find(m=>String(m.id)===String(materialId));
  if(!material)return;

  currentMaterialForOrder=material;

  const existing=orderItems.find(i=>String(i.material_id)===String(materialId));

  document.getElementById('order-item-modal-name').textContent=material.nombre||'Material';
  document.getElementById('order-item-modal-code').textContent=material.id_material||'';
  document.getElementById('order-item-modal-meta').innerHTML=`
  ${material.categorias ? `<span class="badge badge-gray">${material.categorias.icono||''} ${material.categorias.nombre}</span>` : ''}
  <span class="order-unit-highlight">${material.unidad_medida||'unit'}</span>
`;

  document.getElementById('order-item-modal-qty').value=existing?.cantidad ?? '';
  document.getElementById('order-item-modal-notes').value=existing?.notas ?? '';

  openModal('modal-order-item');

  setTimeout(()=>{
    const qtyInput=document.getElementById('order-item-modal-qty');
    if(qtyInput) qtyInput.focus();
  },50);
}

function confirmOrderItemSelection(){
  if(!currentMaterialForOrder)return;

  const qty=parseFloat(document.getElementById('order-item-modal-qty').value)||0;
  const notes=document.getElementById('order-item-modal-notes').value.trim();

  if(qty<=0){
    alert('Please enter a valid quantity.');
    return;
  }

  const existingIndex=orderItems.findIndex(i=>String(i.material_id)===String(currentMaterialForOrder.id));

  if(existingIndex>=0){
    orderItems[existingIndex]={
      ...orderItems[existingIndex],
      cantidad: qty,
      notas: notes
    };
  }else{
    orderItems.push({
      material_id: currentMaterialForOrder.id,
      cantidad: qty,
      notas: notes
    });
  }

closeModal('modal-order-item');
currentMaterialForOrder=null;

saveOrderDraft();
renderSelectedOrderItems();
renderNewOrderMaterials();
}

function renderSelectedOrderItems(){
  const container=document.getElementById('selected-order-items');
  if(!container)return;

  if(!orderItems.length){
    container.innerHTML=`
      <div class="empty-state" style="padding:24px 20px">
        <div class="empty-icon">📦</div>
        <div class="empty-text">No materials added yet</div>
      </div>`;
    return;
  }

  container.innerHTML=orderItems.map(item=>{
    const material=allMaterials.find(m=>String(m.id)===String(item.material_id));
    if(!material)return '';

    const thumb=material.imagen_url
      ? `<div class="selected-order-thumb"><img src="${material.imagen_url}" alt="${material.nombre}"></div>`
      : `<div class="selected-order-thumb">${material.categorias?.icono||'📦'}</div>`;

    return `
      <div class="selected-order-row">
        <div class="selected-order-main">
          ${thumb}
          <div class="selected-order-meta">
            <div class="selected-order-name">${material.nombre}</div>
            <div class="selected-order-code">${material.id_material||''}</div>
            <div class="selected-order-extra">
              ${material.categorias ? `<span class="badge badge-gray">${material.categorias.icono||''} ${material.categorias.nombre}</span>` : ''}
              <span class="badge badge-orange">${item.cantidad} ${material.unidad_medida||''}</span>
              ${item.notas ? `<span class="badge badge-blue">${item.notas}</span>` : ''}
            </div>
          </div>
        </div>
        <div class="selected-order-actions">
          <button class="btn btn-secondary btn-sm" onclick="openOrderItemModal(${material.id})">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="removeSelectedOrderItem(${material.id})">✕</button>
        </div>
      </div>`;
  }).join('');
}

function removeSelectedOrderItem(materialId){
  orderItems=orderItems.filter(i=>String(i.material_id)!==String(materialId));
  saveOrderDraft();
  renderSelectedOrderItems();
  renderNewOrderMaterials();
}
async function submitOrder(){
  const projectId = document.getElementById('order-project').value;
  const notes = document.getElementById('order-notes').value.trim();
  const urgency = document.getElementById('order-urgency').value;
  const deliveryDate =
    document.getElementById('order-delivery-date').value || null;

  if(!currentUser?.id){
    alert('Your session is not valid. Please sign in again.');
    return;
  }

  if(!projectId){
    alert('Please select a site.');
    return;
  }

  if(orderItems.length === 0){
    alert('Add at least one material.');
    return;
  }

  const invalidItem = orderItems.find(item =>
    !item.material_id ||
    !Number.isFinite(Number(item.cantidad)) ||
    Number(item.cantidad) <= 0
  );

  if(invalidItem){
    alert('Please review the selected materials and quantities.');
    return;
  }

  /*
   * The RPC accepts the same basic information already collected
   * by the current form.
   *
   * Supplier and delivery location are sent as null for now.
   * Supabase will use the project or global defaults configured
   * in the database.
   */
  const rpcItems = orderItems.map(item => ({
    material_id: Number(item.material_id),
    cantidad: Number(item.cantidad),
    notas: String(item.notas || '').trim()
  }));

  const submitButton =
    document.querySelector('[onclick="submitOrder()"]');

  const originalButtonText = submitButton?.innerHTML;

  if(submitButton){
    submitButton.disabled = true;
    submitButton.innerHTML = 'Submitting...';
  }

  try{
    const {data, error} = await sb.rpc(
      'create_material_request',
      {
        p_project_id: Number(projectId),
        p_notes: notes || null,
        p_urgency: urgency || 'normal',
        p_delivery_date: deliveryDate,
        p_supplier: null,
        p_delivery_location: null,
        p_items: rpcItems
      }
    );

    if(error){
      console.error('Material request RPC error:', error);

      let message = error.message || 'Unknown database error.';

      if(message.includes('Document initials')){
        message =
          'Your document initials have not been configured. ' +
          'Please contact an administrator.';
      }else if(message.includes('account is not active')){
        message =
          'Your account is not active. Please contact an administrator.';
      }else if(message.includes('project is not active')){
        message =
          'The selected project is not active.';
      }else if(message.includes('project code')){
        message =
          'The selected project does not have a project code.';
      }else if(message.includes('materials no longer exist')){
        message =
          'One or more selected materials no longer exist. ' +
          'Reload the catalog and try again.';
      }

      alert('Error creating material request:\n\n' + message);
      return;
    }

    if(!data?.id){
      console.error('Unexpected RPC response:', data);
      alert(
        'The request was processed, but Supabase returned an unexpected response.'
      );
      return;
    }

    clearOrderDraft();
    resetNewOrderForm();

    await loadMyOrders();

    alert(
      '✅ Material Request created successfully.\n\n' +
      'Order No: ' + data.order_number + '\n' +
      'Document: ' + data.document_name
    );

    navigateTo('pedidos');
  }catch(exception){
    console.error('Unexpected submitOrder error:', exception);

    alert(
      'An unexpected error occurred while creating the Material Request.\n\n' +
      (exception?.message || String(exception))
    );
  }finally{
    if(submitButton){
      submitButton.disabled = false;
      submitButton.innerHTML =
        originalButtonText || 'Submit Order';
    }
  }
}