'use strict';

let profileLoadInFlight=null;

window.addEventListener('DOMContentLoaded',()=>{
  if(SUPABASE_URL.includes('TU_PROYECTO')){
    document.getElementById('config-notice').style.display='block';
    setTimeout(()=>document.getElementById('config-notice').style.display='none',9000);
  }
  try{
    sb=createClient(SUPABASE_URL,SUPABASE_KEY);

    sb.auth.onAuthStateChange((ev,session)=>{
      if(session?.user){
        const sameUser=currentUser?.id===session.user.id;
        currentUser=session.user;
        if(!sameUser||!currentProfile)loadProfile();
      }else{
        currentUser=null;
        currentProfile=null;
        showAuth();
      }
    });

    sb.auth.getSession().then(({data})=>{
      const user=data.session?.user||null;
      if(!user){showAuth();return;}
      const sameUser=currentUser?.id===user.id;
      currentUser=user;
      if(!sameUser||!currentProfile)loadProfile();
    });
  }catch(e){
    console.error('Supabase initialization error:',e);
    showAuth();
  }
});

function showAuth(){
  document.getElementById('auth-screen').style.display='flex';
  document.getElementById('app').style.display='none';
}

async function loadProfile(){
  if(profileLoadInFlight)return profileLoadInFlight;

  profileLoadInFlight=(async()=>{
    const userId=currentUser?.id;
    if(!userId){showAuth();return;}

    const{data,error}=await sb.from('profiles').select('*').eq('id',userId).single();
    if(error||!data){showAuth();return;}
    if(currentUser?.id!==userId)return;

    currentProfile=data;
    if(data.status!=='activo'){
      await sb.auth.signOut();
      showAuthMsg('error','Your account is pending admin approval.');
      return;
    }
    showApp();
  })();

  try{
    return await profileLoadInFlight;
  }finally{
    profileLoadInFlight=null;
  }
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
