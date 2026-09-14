'use strict';

// MODALS
function openModal(id){document.getElementById(id).classList.add('open');}
function closeModal(id){document.getElementById(id).classList.remove('open');}

function toggleSidebar(){
  document.getElementById('app-sidebar').classList.toggle('open');
  document.getElementById('sidebar-overlay').style.display=
    document.getElementById('app-sidebar').classList.contains('open')?'block':'none';
}
function closeSidebar(){
  document.getElementById('app-sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').style.display='none';
}
document.addEventListener('click',e=>{if(e.target.classList.contains('modal-overlay'))e.target.classList.remove('open');});

// Workflow V2 is kept in separate files so the existing modules stay readable.
// ui.js is currently the final legacy script in index.html; loading these files
// synchronously here guarantees that role/workflow overrides are registered
// before DOMContentLoaded initializes the application.
document.write('<script src="./js/permissions.js?v=2"><\/script>');
document.write('<script src="./js/workflow-v2.js?v=2"><\/script>');
document.write('<script src="./js/image-preview.js?v=1"><\/script>');
document.write('<script src="./js/new-order-pagination.js?v=1"><\/script>');
document.write('<script src="./js/order-item-preview.js?v=1"><\/script>');
document.write('<script src="./js/app-stability.js?v=1"><\/script>');
