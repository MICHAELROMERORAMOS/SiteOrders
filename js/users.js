'use strict';

// USERS
async function loadUsers(){
  const{data}=await sb.from('profiles').select('*').order('created_at',{ascending:false});
  allUsers=data||[];renderUsersList();pollPendingUsers();
}

function switchUserTab(tab){
  currentUserTab=tab;
  document.getElementById('tab-pending').classList.toggle('active',tab==='pending');
  document.getElementById('tab-all').classList.toggle('active',tab==='all');
  renderUsersList();
}

function renderUsersList(){
  const users=currentUserTab==='pending'?allUsers.filter(u=>u.status==='pendiente'):allUsers;
  const c=document.getElementById('users-list');

  if(!users.length){
    c.innerHTML=currentUserTab==='pending'
      ?'<div class="empty-state"><div class="empty-icon">✅</div><div class="empty-text">No pending approvals</div></div>'
      :'<div class="empty-state"><div class="empty-icon">👥</div><div class="empty-text">No users found</div></div>';
    return;
  }

  if(currentUserTab==='pending'){
    c.innerHTML=users.map(u=>`
      <div class="user-pending-card">
        <div class="user-avatar" style="width:40px;height:40px;font-size:15px;flex-shrink:0">${(u.full_name||u.email||'?')[0].toUpperCase()}</div>
        <div style="flex:1;min-width:0">
          <div class="user-pending-name">${u.full_name||'–'}</div>
          <div class="user-pending-meta">${u.email} · @${u.username||'–'}</div>
          <div style="font-size:11px;color:var(--text3);margin-top:2px">Registered ${new Date(u.created_at).toLocaleDateString('en',{day:'2-digit',month:'short',year:'numeric'})}</div>
        </div>
        <div style="display:flex;gap:7px;flex-shrink:0">
          <button class="btn btn-danger btn-sm" onclick="rejectUser('${u.id}')">✕ Reject</button>
          <button class="btn btn-success btn-sm" onclick="approveUser('${u.id}')">✓ Approve</button>
        </div>
      </div>`).join('');
    return;
  }

  const rows=users.map(u=>{
    const isSelf=u.id===currentUser.id;
    const sb2=u.status==='activo'?'<span class="badge badge-green">Active</span>':u.status==='pendiente'?'<span class="badge badge-yellow">Pending</span>':'<span class="badge badge-red">Inactive</span>';
    const roleCtrl=isSelf
      ?`<span class="badge badge-orange">Admin (you)</span>`
      :`<select class="form-input" style="width:110px;font-size:12px" onchange="changeUserRole('${u.id}',this.value)" ${u.status==='pendiente'?'disabled':''}>
          <option value="encargado" ${u.role==='encargado'?'selected':''}>Manager</option>
          <option value="admin" ${u.role==='admin'?'selected':''}>Admin</option>
        </select>`;
    const toggleCtrl=isSelf
      ?`<span style="font-size:11px;color:var(--text3)">—</span>`
      :u.status==='pendiente'
        ?`<button class="btn btn-success btn-xs" onclick="approveUser('${u.id}')">Approve</button>`
        :`<button class="btn ${u.status==='activo'?'btn-danger':'btn-success'} btn-xs" onclick="toggleUserStatus('${u.id}','${u.status}')">${u.status==='activo'?'Deactivate':'Activate'}</button>`;
    return`<tr>
      <td><div style="display:flex;align-items:center;gap:9px">
        <div class="user-avatar" style="width:28px;height:28px;font-size:11px">${(u.full_name||u.email||'?')[0].toUpperCase()}</div>
        <div><div style="font-weight:500">${u.full_name||'–'}${isSelf?' <span style="font-size:10px;color:var(--text3)">(you)</span>':''}</div><div style="font-size:10px;color:var(--text3)">@${u.username||'–'}</div></div>
      </div></td>
      <td style="font-size:12px;color:var(--text2)">${u.email}</td>
      <td>${roleCtrl}</td>
      <td>${sb2}</td>
      <td>${toggleCtrl}</td>
    </tr>`;
  }).join('');
  c.innerHTML=`<div class="table-wrap"><table><thead><tr><th>User</th><th>Email</th><th>Role</th><th>Status</th><th>Action</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

async function approveUser(id){await sb.from('profiles').update({status:'activo'}).eq('id',id);await loadUsers();}
async function rejectUser(id){if(!confirm('Reject this user?'))return;await sb.from('profiles').update({status:'inactivo'}).eq('id',id);await loadUsers();}
async function changeUserRole(id,role){await sb.from('profiles').update({role}).eq('id',id);await loadUsers();}
async function toggleUserStatus(id,current){
  if(id===currentUser.id)return;
  await sb.from('profiles').update({status:current==='activo'?'inactivo':'activo'}).eq('id',id);await loadUsers();
}
