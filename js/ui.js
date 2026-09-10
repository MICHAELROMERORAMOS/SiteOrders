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
