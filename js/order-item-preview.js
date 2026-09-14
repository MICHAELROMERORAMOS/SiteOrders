'use strict';

// Adds a large visual reference to the Add Material modal used in New Order.
// The existing material image URL is reused, so no extra file is stored in Supabase.

function ensureOrderItemPreviewContainer(){
  if(typeof document==='undefined')return null;

  const modal=document.getElementById('modal-order-item');
  const body=modal?.querySelector('.modal-body');
  if(!body)return null;

  let container=document.getElementById('order-item-visual-preview');
  if(container)return container;

  container=document.createElement('div');
  container.id='order-item-visual-preview';
  container.style.cssText='margin-bottom:16px';

  const materialBox=body.querySelector('.order-modal-material-box');
  if(materialBox)body.insertBefore(container,materialBox);
  else body.prepend(container);

  return container;
}

function renderOrderItemPreviewPlaceholder(container,material){
  container.replaceChildren();

  const frame=document.createElement('div');
  frame.style.cssText='height:210px;border:1px solid var(--border);border-radius:12px;background:var(--bg3);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:18px;text-align:center;color:var(--text3)';

  const icon=document.createElement('div');
  icon.style.cssText='font-size:46px;line-height:1';
  icon.textContent=material?.categorias?.icono||'📦';

  const text=document.createElement('div');
  text.style.cssText='font-size:12px;font-weight:600';
  text.textContent='No image available';

  frame.append(icon,text);
  container.appendChild(frame);
}

function renderOrderItemVisualPreview(material){
  const container=ensureOrderItemPreviewContainer();
  if(!container)return;

  const imageUrl=String(material?.imagen_url||'').trim();
  if(!imageUrl){
    renderOrderItemPreviewPlaceholder(container,material);
    return;
  }

  container.replaceChildren();

  const frame=document.createElement('div');
  frame.style.cssText='height:210px;border:1px solid var(--border);border-radius:12px;background:var(--bg3);display:flex;align-items:center;justify-content:center;overflow:hidden;padding:10px;position:relative';

  const img=document.createElement('img');
  img.src=imageUrl;
  img.alt=String(material?.nombre||'Material image');
  img.decoding='async';
  img.style.cssText='display:block;width:100%;height:100%;object-fit:contain;border-radius:8px';

  img.addEventListener('error',()=>{
    renderOrderItemPreviewPlaceholder(container,material);
  },{once:true});

  frame.appendChild(img);
  container.appendChild(frame);
}

(function installOrderItemVisualPreview(){
  if(typeof document==='undefined')return;

  const originalOpenOrderItemModal=window.openOrderItemModal;
  if(typeof originalOpenOrderItemModal!=='function')return;

  window.openOrderItemModal=function(materialId){
    const result=originalOpenOrderItemModal.apply(this,arguments);
    const material=allMaterials.find(m=>String(m.id)===String(materialId));
    if(material)renderOrderItemVisualPreview(material);
    return result;
  };
})();
