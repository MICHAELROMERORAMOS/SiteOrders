'use strict';

// PROJECTS
function renderProjects(){
  const c=document.getElementById('projects-list');if(!c)return;
  if(!allProjects.length){c.innerHTML='<div class="empty-state"><div class="empty-icon">🏢</div><div class="empty-text">No sites registered</div></div>';return;}
  const sm={activo:'badge-green',pausado:'badge-yellow',finalizado:'badge-gray'};
  const sl={activo:'Active',pausado:'On Hold',finalizado:'Completed'};
  const rows=allProjects.map(p=>`<tr>
    <td><div style="font-weight:500">${p.nombre}</div><div style="font-size:10px;font-family:'DM Mono',monospace;color:var(--text3)">${p.codigo||''}</div></td>
    <td style="font-size:12px;color:var(--text2)">${p.direccion||'–'}</td>
    <td style="font-size:12px;color:var(--text2)">${p.responsable||'–'}</td>
    <td><span class="badge ${sm[p.estado]||'badge-gray'}">${sl[p.estado]||p.estado}</span></td>
    <td><div style="display:flex;gap:6px">
      <button class="btn btn-secondary btn-sm" onclick='editProject(${JSON.stringify(p).replace(/'/g,"&#39;")})'>Edit</button>
      <button class="btn btn-danger btn-sm" onclick="deleteProject(${p.id})">✕</button>
    </div></td>
  </tr>`).join('');
  c.innerHTML=`<div class="table-wrap"><table><thead><tr><th>Site</th><th>Address</th><th>Manager</th><th>Status</th><th>Actions</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function openProjectModal(){
  editingProjectId=null;
  document.getElementById('modal-project-title').textContent='New Site / Project';
  ['proj-name','proj-code','proj-address','proj-manager','proj-desc'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('proj-status').value='activo';
  openModal('modal-project');
}

function editProject(proj){
  editingProjectId=proj.id;
  document.getElementById('modal-project-title').textContent='Edit Site';
  document.getElementById('proj-name').value=proj.nombre||'';
  document.getElementById('proj-code').value=proj.codigo||'';
  document.getElementById('proj-status').value=proj.estado||'activo';
  document.getElementById('proj-address').value=proj.direccion||'';
  document.getElementById('proj-manager').value=proj.responsable||'';
  document.getElementById('proj-desc').value=proj.descripcion||'';
  openModal('modal-project');
}

async function saveProject(){
  const data={
    nombre:document.getElementById('proj-name').value.trim(),
    codigo:document.getElementById('proj-code').value.trim()||null,
    estado:document.getElementById('proj-status').value,
    direccion:document.getElementById('proj-address').value.trim(),
    responsable:document.getElementById('proj-manager').value.trim(),
    descripcion:document.getElementById('proj-desc').value.trim(),
  };
  if(!data.nombre)return alert('Name is required.');
  let error;
  if(editingProjectId)({error}=await sb.from('proyectos').update(data).eq('id',editingProjectId));
  else({error}=await sb.from('proyectos').insert(data));
  if(error)return alert('Error: '+error.message);
  closeModal('modal-project');await loadProjects();renderProjects();
}

async function deleteProject(id){
  if(!confirm('Delete this site? Associated orders will not be deleted.'))return;
  await sb.from('proyectos').delete().eq('id',id);await loadProjects();renderProjects();
}
