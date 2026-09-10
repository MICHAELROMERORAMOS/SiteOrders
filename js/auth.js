'use strict';

// AUTH
function switchAuthTab(tab){
  document.getElementById('login-form').style.display=tab==='login'?'block':'none';
  document.getElementById('register-form').style.display=tab==='register'?'block':'none';
  document.querySelectorAll('.auth-tab').forEach((t,i)=>t.classList.toggle('active',(i===0&&tab==='login')||(i===1&&tab==='register')));
  clearAuthAlert();
}

async function doLogin(){
  const email=document.getElementById('login-email').value.trim();
  const pass=document.getElementById('login-pass').value;
  if(!email||!pass)return showAuthMsg('error','Please fill in all fields.');
  const{error}=await sb.auth.signInWithPassword({email,password:pass});
  if(error)showAuthMsg('error','Incorrect email or password.');
}

async function doRegister(){
  const name=document.getElementById('reg-name').value.trim();
  const username=document.getElementById('reg-username').value.trim();
  const email=document.getElementById('reg-email').value.trim();
  const pass=document.getElementById('reg-pass').value;
  if(!name||!username||!email||!pass)return showAuthMsg('error','Please fill in all fields.');
  if(pass.length<8)return showAuthMsg('error','Password must be at least 8 characters.');
  const{data,error}=await sb.auth.signUp({email,password:pass,options:{data:{full_name:name,username}}});
  if(error)return showAuthMsg('error',error.message);
  await sb.auth.signOut();
  document.getElementById('pending-msg').style.display='block';
  showAuthMsg('success','Registration submitted successfully.');
}

function showAuthMsg(type,msg){document.getElementById('auth-alert').innerHTML=`<div class="alert alert-${type}">${msg}</div>`;}
function clearAuthAlert(){document.getElementById('auth-alert').innerHTML='';}
async function doLogout(){await sb.auth.signOut();currentUser=null;currentProfile=null;showAuth();}

// PENDING BADGE
async function pollPendingUsers(){
  const{data}=await sb.from('profiles').select('id').eq('status','pendiente');
  const count=data?.length||0;
  const badge=document.getElementById('pending-badge');
  const banner=document.getElementById('pending-banner');
  const tabBadge=document.getElementById('tab-pending-count');
  if(count>0){
    badge.textContent=count;badge.style.display='inline-flex';
    banner.style.display='flex';
    document.getElementById('pending-banner-text').textContent=`${count} user${count>1?'s':''} waiting for approval`;
    if(tabBadge){tabBadge.textContent=count;tabBadge.style.display='inline-flex';}
  }else{
    badge.style.display='none';banner.style.display='none';
    if(tabBadge)tabBadge.style.display='none';
  }
}
