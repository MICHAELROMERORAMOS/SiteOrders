'use strict';

window.addEventListener('DOMContentLoaded',()=>{
  if(SUPABASE_URL.includes('TU_PROYECTO')){
    document.getElementById('config-notice').style.display='block';
    setTimeout(()=>document.getElementById('config-notice').style.display='none',9000);
  }
  try{
    sb=createClient(SUPABASE_URL,SUPABASE_KEY);
    sb.auth.onAuthStateChange((ev,session)=>{
      if(session?.user){currentUser=session.user;loadProfile();}
      else showAuth();
    });
    sb.auth.getSession().then(({data})=>{if(!data.session)showAuth();});
  }catch(e){showAuth();}
});

function showAuth(){
  document.getElementById('auth-screen').style.display='flex';
  document.getElementById('app').style.display='none';
}

async function loadProfile(){
  const{data,error}=await sb.from('profiles').select('*').eq('id',currentUser.id).single();
  if(error||!data){showAuth();return;}
  currentProfile=data;
  if(data.status!=='activo'){
    await sb.auth.signOut();
    showAuthMsg('error','Your account is pending admin approval.');
    return;
  }
  showApp();
}

function showApp(){
  document.getElementById('auth-screen').style.display='none';
  document.getElementById('app').style.display='block';
  const init=(currentProfile.full_name||currentUser.email||'?')[0].toUpperCase();
  document.getElementById('user-avatar-sidebar').textContent=init;
  document.getElementById('user-name-sidebar').textContent=currentProfile.full_name||currentUser.email;
  document.getElementById('user-role-sidebar').textContent=currentProfile.role==='admin'?'⭐ Administrator':'👷 Site Manager';
  if(currentProfile.role==='admin')document.querySelectorAll('.admin-only').forEach(el=>el.style.display='');
  loadUnits();loadCategories();loadProjects();loadMaterials();
  const savedPage=sessionStorage.getItem('currentPage')||'dashboard';
  navigateTo(savedPage);
  if(currentProfile.role==='admin')pollPendingUsers();
}
