'use strict';

// Stability fixes loaded after workflow-v2.js.
// 1) Preserve the active page when the browser/tab is backgrounded or reloaded.
// 2) Default Supervisor/Admin orders to the current user when no receiver is chosen.
(function(){
  const LAST_PAGE_KEY='siteorders:lastPage';

  function userPageKey(){
    return currentUser?.id?`${LAST_PAGE_KEY}:${currentUser.id}`:LAST_PAGE_KEY;
  }

  function rememberPage(page){
    if(!page)return;
    try{
      sessionStorage.setItem('currentPage',page);
      localStorage.setItem(LAST_PAGE_KEY,page);
      if(currentUser?.id)localStorage.setItem(userPageKey(),page);
    }catch(e){
      console.warn('Could not persist current page:',e);
    }
  }

  function getRememberedPage(){
    try{
      if(currentUser?.id){
        const own=localStorage.getItem(userPageKey());
        if(own)return own;
      }
      return localStorage.getItem(LAST_PAGE_KEY)||sessionStorage.getItem('currentPage')||'dashboard';
    }catch(e){
      return sessionStorage.getItem('currentPage')||'dashboard';
    }
  }

  const baseNavigateTo=window.navigateTo;
  if(typeof baseNavigateTo==='function'){
    window.navigateTo=function(page){
      const result=baseNavigateTo(page);
      const resolved=(typeof currentPage!=='undefined'&&currentPage)?currentPage:page;
      rememberPage(resolved);
      return result;
    };
  }

  const baseShowApp=window.showApp;
  if(typeof baseShowApp==='function'){
    window.showApp=function(){
      const saved=getRememberedPage();
      try{sessionStorage.setItem('currentPage',saved);}catch(e){}
      return baseShowApp();
    };
  }

  function ensureSelfReceiverOption(select){
    if(!select||!currentUser?.id)return;
    const selfId=String(currentUser.id);
    let option=[...select.options].find(o=>String(o.value)===selfId);
    if(!option){
      const name=currentProfile?.full_name||currentUser.email||'Me';
      option=new Option(`${name} · Me`,selfId);
      select.add(option,Math.min(1,select.options.length));
    }
  }

  function updateReceiverLabel(){
    const wrap=document.getElementById('order-requested-for-wrap');
    const label=wrap?.querySelector('.form-label');
    if(label)label.textContent='Requested for / Receiver (defaults to you)';
  }

  const baseLoadRequestReceivers=window.loadRequestReceivers;
  if(typeof baseLoadRequestReceivers==='function'){
    window.loadRequestReceivers=async function(selectedUserId=null){
      const result=await baseLoadRequestReceivers(selectedUserId);
      const select=document.getElementById('order-requested-for');
      if(!select)return result;

      ensureSelfReceiverOption(select);
      updateReceiverLabel();

      const wanted=selectedUserId||workflowEditingOrder?.order?.user_id||'';
      if(wanted){
        select.value=String(wanted);
      }else if(!select.value&&currentUser?.id){
        select.value=String(currentUser.id);
      }
      return result;
    };
  }

  const basePrepareRequestedForControl=window.prepareRequestedForControl;
  if(typeof basePrepareRequestedForControl==='function'){
    window.prepareRequestedForControl=async function(selectedUserId=null){
      const result=await basePrepareRequestedForControl(selectedUserId);
      const select=document.getElementById('order-requested-for');
      if(select&&(isSupervisorRole()||isAdminRole())){
        ensureSelfReceiverOption(select);
        updateReceiverLabel();
        const wanted=selectedUserId||workflowEditingOrder?.order?.user_id||'';
        if(wanted)select.value=String(wanted);
        else if(!select.value&&currentUser?.id)select.value=String(currentUser.id);
      }
      return result;
    };
  }

  const baseSubmitOrder=window.submitOrder;
  if(typeof baseSubmitOrder==='function'){
    window.submitOrder=async function(){
      if(isSupervisorRole()||isAdminRole()){
        let select=document.getElementById('order-requested-for');
        if(!select&&typeof window.prepareRequestedForControl==='function'){
          await window.prepareRequestedForControl(currentUser?.id||null);
          select=document.getElementById('order-requested-for');
        }
        if(select){
          ensureSelfReceiverOption(select);
          if(!select.value&&currentUser?.id)select.value=String(currentUser.id);
        }
      }
      return baseSubmitOrder();
    };
  }

  function persistCurrentPage(){
    const page=(typeof currentPage!=='undefined'&&currentPage)||sessionStorage.getItem('currentPage');
    if(page)rememberPage(page);
  }

  document.addEventListener('visibilitychange',()=>{
    if(document.hidden)persistCurrentPage();
  });
  window.addEventListener('pagehide',persistCurrentPage);
  window.addEventListener('beforeunload',persistCurrentPage);
})();
