'use strict';

function workflowRole(){
  const role=currentProfile?.role||'';
  return role==='encargado'?'worker':role;
}

function isWorkerRole(){return workflowRole()==='worker';}
function isSupervisorRole(){return workflowRole()==='supervisor';}
function isStoreRole(){return workflowRole()==='store';}
function isAdminRole(){return workflowRole()==='admin';}

function canCreateOrder(){return isWorkerRole()||isSupervisorRole()||isAdminRole();}
function canSeeManagedOrders(){return isSupervisorRole()||isStoreRole()||isAdminRole();}
function canManageInventory(){return isStoreRole()||isAdminRole();}
function canManageUsers(){return isAdminRole();}
function canManageProjects(){return isAdminRole();}
function canManageSettings(){return isAdminRole();}

function workflowProjectAllowed(projectId){
  if(isAdminRole()||isStoreRole()||isWorkerRole())return true;
  if(!isSupervisorRole())return false;
  return workflowProjectIds instanceof Set && workflowProjectIds.has(Number(projectId));
}

function canApproveOrder(order){
  return Boolean(order) && order.status==='pending' &&
    (isAdminRole() || (isSupervisorRole() && workflowProjectAllowed(order.project_id)));
}

function canEditWorkflowOrder(order,hasDispatch=false){
  if(!order||hasDispatch||['completed','rejected'].includes(order.status))return false;
  if(isWorkerRole())return order.user_id===currentUser?.id && order.status==='pending';
  if(isSupervisorRole())return workflowProjectAllowed(order.project_id) && ['pending','approved'].includes(order.status);
  return isAdminRole() && ['pending','approved'].includes(order.status);
}

function canDispatchOrder(order){
  return Boolean(order) && ['approved','partial'].includes(order.status) && (isStoreRole()||isAdminRole());
}

function canProposeAlternative(order){
  return Boolean(order) && ['approved','partial'].includes(order.status) && (isStoreRole()||isAdminRole());
}

function canDecideAlternative(order){
  return Boolean(order) && (isAdminRole() || (isSupervisorRole() && workflowProjectAllowed(order.project_id)));
}

function canConfirmReceipt(order){
  if(!order||order.status!=='awaiting_receipt')return false;
  if(isWorkerRole())return order.user_id===currentUser?.id;
  return isSupervisorRole() && workflowProjectAllowed(order.project_id);
}

function canAccessWorkflowPage(page){
  if(['dashboard','materiales'].includes(page))return true;
  if(page==='pedidos')return !isStoreRole();
  if(page==='nuevo-pedido')return canCreateOrder();
  if(page==='admin-pedidos')return canSeeManagedOrders();
  if(page==='admin-materiales')return canManageInventory();
  if(page==='admin-usuarios')return canManageUsers();
  if(page==='admin-proyectos')return canManageProjects();
  if(page==='admin-settings')return canManageSettings();
  return false;
}
