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

function getMaterialImageData(item){
  const imageUrl=normalizeMaterialImageUrl(item?.materiales?.imagen_url||item?.imagen_url||'');
  const materialName=String(
    item?.material_name_snapshot||
    item?.materiales?.nombre||
    item?.nombre||
    'Material Image'
  );
  return {imageUrl,materialName};
}

function buildSafeMaterialImageButton(item){
  const {imageUrl,materialName}=getMaterialImageData(item);
  if(!imageUrl)return null;

  const button=document.createElement('button');
  button.type='button';
  button.className='btn btn-secondary material-image-preview-btn';
  button.title='View image';
  button.setAttribute('aria-label',`View image: ${materialName}`);
  button.dataset.imageUrl=imageUrl;
  button.dataset.imageName=materialName;
  button.dataset.safeImageButton='1';
  button.style.cssText='width:60px;height:60px;min-width:60px;min-height:60px;padding:0;display:inline-flex;align-items:center;justify-content:center;border-radius:12px;cursor:pointer;line-height:1;flex:0 0 60px';

  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox','0 0 24 24');
  svg.setAttribute('width','38');
  svg.setAttribute('height','38');
  svg.setAttribute('aria-hidden','true');
  svg.setAttribute('focusable','false');
  svg.style.cssText='display:block;pointer-events:none';

  const eye=document.createElementNS('http://www.w3.org/2000/svg','path');
  eye.setAttribute('d','M2.4 12s3.4-6 9.6-6 9.6 6 9.6 6-3.4 6-9.6 6-9.6-6-9.6-6Z');
  eye.setAttribute('fill','none');
  eye.setAttribute('stroke','currentColor');
  eye.setAttribute('stroke-width','1.8');
  eye.setAttribute('stroke-linecap','round');
  eye.setAttribute('stroke-linejoin','round');

  const pupil=document.createElementNS('http://www.w3.org/2000/svg','circle');
  pupil.setAttribute('cx','12');
  pupil.setAttribute('cy','12');
  pupil.setAttribute('r','2.8');
  pupil.setAttribute('fill','none');
  pupil.setAttribute('stroke','currentColor');
  pupil.setAttribute('stroke-width','1.8');

  svg.append(eye,pupil);
  button.appendChild(svg);

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

    const {imageUrl,materialName}=getMaterialImageData(item);
    const existing=row.querySelector('.material-image-preview-btn');

    if(!imageUrl){
      existing?.remove();
      return;
    }

    if(existing&&existing.dataset.imageUrl===imageUrl&&existing.dataset.imageName===materialName)return;
    existing?.remove();

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

    const {imageUrl,materialName}=getMaterialImageData(item);
    const existing=cell.querySelector('.material-image-preview-btn');
    if(existing&&existing.dataset.imageUrl===imageUrl&&existing.dataset.imageName===materialName)return;

    cell.replaceChildren();
    const button=buildSafeMaterialImageButton(item);
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

function enhanceLogoutButton(){
  const button=document.querySelector('.sidebar-user button[onclick="doLogout()"]');
  if(!button||button.dataset.largeLogoutButton==='1')return;

  button.dataset.largeLogoutButton='1';
  button.type='button';
  button.className='btn sidebar-logout-power-btn';
  button.title='Sign out';
  button.setAttribute('aria-label','Sign out');
  button.replaceChildren();
  button.style.cssText='width:52px;height:52px;min-width:52px;min-height:52px;padding:0;display:inline-flex;align-items:center;justify-content:center;border-radius:50%;cursor:pointer;line-height:1;flex:0 0 52px;color:#ef4444;border:1px solid rgba(239,68,68,.42);background:rgba(239,68,68,.10);box-shadow:0 0 0 1px rgba(239,68,68,.06) inset;transition:transform .15s ease,background .15s ease,border-color .15s ease';

  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox','0 0 24 24');
  svg.setAttribute('width','30');
  svg.setAttribute('height','30');
  svg.setAttribute('aria-hidden','true');
  svg.setAttribute('focusable','false');
  svg.style.cssText='display:block;pointer-events:none';

  const stem=document.createElementNS('http://www.w3.org/2000/svg','path');
  stem.setAttribute('d','M12 2v10');
  stem.setAttribute('fill','none');
  stem.setAttribute('stroke','currentColor');
  stem.setAttribute('stroke-width','2.4');
  stem.setAttribute('stroke-linecap','round');

  const ring=document.createElementNS('http://www.w3.org/2000/svg','path');
  ring.setAttribute('d','M6.34 6.34a8 8 0 1 0 11.32 0');
  ring.setAttribute('fill','none');
  ring.setAttribute('stroke','currentColor');
  ring.setAttribute('stroke-width','2.4');
  ring.setAttribute('stroke-linecap','round');

  svg.append(stem,ring);
  button.appendChild(svg);

  button.addEventListener('mouseenter',()=>{
    button.style.background='rgba(239,68,68,.18)';
    button.style.borderColor='rgba(239,68,68,.65)';
    button.style.transform='scale(1.05)';
  });
  button.addEventListener('mouseleave',()=>{
    button.style.background='rgba(239,68,68,.10)';
    button.style.borderColor='rgba(239,68,68,.42)';
    button.style.transform='scale(1)';
  });
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

  enhanceLogoutButton();
})();
