'use strict';

// Centralized, DOM-safe material image preview handling.
// Dynamic URLs/names are never interpolated into executable inline JavaScript.

function normalizeMaterialImageUrl(value){
  const raw=String(value??'').trim();
  if(!raw)return '';
  try{
    const parsed=new URL(raw,window.location.href);
    if(parsed.protocol!=='https:'&&parsed.protocol!=='http:')return '';
    return parsed.href;
  }catch(_error){
    return '';
  }
}

function ensureMaterialImagePreviewState(){
  const img=document.getElementById('item-image-modal-img');
  if(!img)return null;

  let status=document.getElementById('item-image-modal-status');
  if(!status){
    status=document.createElement('div');
    status.id='item-image-modal-status';
    status.style.cssText='display:none;padding:18px 10px;color:var(--text2);font-size:12px;line-height:1.5';
    img.insertAdjacentElement('afterend',status);
  }

  return {img,status};
}

function previewOrderItemImage(url,name){
  const title=document.getElementById('item-image-modal-title');
  const state=ensureMaterialImagePreviewState();
  if(!state)return;

  const {img,status}=state;
  const safeUrl=normalizeMaterialImageUrl(url);
  const safeName=String(name??'').trim()||'Material Image';

  if(title)title.textContent=safeName;

  img.onload=null;
  img.onerror=null;
  img.removeAttribute('src');
  img.alt=safeName;
  img.style.display='none';
  status.style.display='block';
  status.textContent=safeUrl?'Loading image…':'This material does not have a valid image URL.';

  openModal('modal-item-image');

  if(!safeUrl)return;

  img.onload=()=>{
    status.style.display='none';
    status.textContent='';
    img.style.display='inline-block';
  };

  img.onerror=()=>{
    img.style.display='none';
    status.style.display='block';
    status.textContent='The image could not be loaded. It may have been removed or the stored URL may no longer be valid.';
    console.warn('Material image failed to load:',safeUrl);
  };

  img.src=safeUrl;
}

function previewOrderItemImageFromButton(button){
  if(!(button instanceof Element))return;
  previewOrderItemImage(button.dataset.imageUrl||'',button.dataset.imageName||'Material Image');
}

function buildSafeMaterialImageButton(item){
  const imageUrl=normalizeMaterialImageUrl(item?.materiales?.imagen_url||item?.imagen_url||'');
  if(!imageUrl)return null;

  const materialName=String(
    item?.material_name_snapshot||
    item?.materiales?.nombre||
    item?.nombre||
    'Material Image'
  );

  const button=document.createElement('button');
  button.type='button';
  button.className='btn btn-ghost btn-xs material-image-preview-btn';
  button.title='View image';
  button.setAttribute('aria-label',`View image: ${materialName}`);
  button.dataset.imageUrl=imageUrl;
  button.dataset.imageName=materialName;
  button.dataset.safeImageButton='1';
  button.textContent='🖼';
  button.addEventListener('click',event=>{
    event.preventDefault();
    event.stopPropagation();
    previewOrderItemImageFromButton(button);
  });
  return button;
}

function enhanceWorkflowOrderImageButtons(){
  const items=window.workflowDialogContext?.items;
  if(!Array.isArray(items)||!items.length)return false;

  const rows=[...document.querySelectorAll('#order-detail-body > .wf-item')];
  if(!rows.length)return false;

  rows.forEach((row,index)=>{
    const item=items[index];
    if(!item)return;

    row.querySelectorAll('.material-image-preview-btn').forEach(el=>el.remove());
    const button=buildSafeMaterialImageButton(item);
    if(!button)return;

    const header=row.firstElementChild;
    if(header)header.appendChild(button);
    else row.insertBefore(button,row.firstChild);
  });
  return true;
}

function enhanceLegacyOrderImageButtons(){
  const items=window._pdfItems;
  if(!Array.isArray(items)||!items.length)return false;

  const rows=[...document.querySelectorAll('#order-detail-body tbody tr')];
  if(!rows.length)return false;

  rows.forEach((row,index)=>{
    const item=items[index];
    const cell=row.querySelector('td:first-child');
    if(!item||!cell)return;

    const button=buildSafeMaterialImageButton(item);
    cell.replaceChildren();
    if(button){
      cell.appendChild(button);
    }else{
      const icon=document.createElement('span');
      icon.style.cssText='font-size:16px;color:var(--text3)';
      icon.textContent=item?.materiales?.categorias?.icono||'📦';
      cell.appendChild(icon);
    }
  });
  return true;
}

function enhanceOrderImageButtons(){
  // Workflow V2 uses card-like material rows. Legacy orders use a table.
  // Supporting both prevents this bug from returning if either renderer is used.
  if(enhanceWorkflowOrderImageButtons())return;
  enhanceLegacyOrderImageButtons();
}

(function installSafeOrderImagePreview(){
  const originalViewOrder=window.viewOrder;
  if(typeof originalViewOrder==='function'){
    window.viewOrder=async function(...args){
      const result=await originalViewOrder.apply(this,args);
      enhanceOrderImageButtons();
      return result;
    };
  }

  // Defensive fallback: if another renderer updates the order modal later,
  // re-apply the safe buttons without relying on inline JS string arguments.
  const body=document.getElementById('order-detail-body');
  if(body&&typeof MutationObserver!=='undefined'){
    let scheduled=false;
    const observer=new MutationObserver(()=>{
      if(scheduled)return;
      scheduled=true;
      queueMicrotask(()=>{
        scheduled=false;
        enhanceOrderImageButtons();
      });
    });
    observer.observe(body,{childList:true,subtree:true});
  }
})();
