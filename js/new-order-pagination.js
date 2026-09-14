'use strict';

// Keeps the New Order paginator outside the material grid so it behaves like Catalog:
// centered, stable below the cards, and never stacked vertically inside grid columns.

function ensureNewOrderPaginatorContainer(){
  if(typeof document==='undefined')return null;
  let container=document.getElementById('new-order-paginator');
  if(container)return container;

  const picker=document.querySelector('#page-nuevo-pedido .new-order-picker');
  if(!picker)return null;

  container=document.createElement('div');
  container.id='new-order-paginator';
  container.style.cssText='width:100%;min-height:36px;margin-top:14px;display:flex;justify-content:center;align-items:center;overflow-x:auto;overflow-y:hidden;padding:2px 0 4px';
  picker.insertAdjacentElement('afterend',container);
  return container;
}

function normalizeNewOrderPaginator(){
  if(typeof document==='undefined')return;
  const grid=document.getElementById('new-order-material-grid');
  const container=ensureNewOrderPaginatorContainer();
  if(!grid||!container)return;

  const paginator=[...grid.children].find(child=>
    child instanceof HTMLElement &&
    child.querySelector('button[onclick*="newOrderMatPage"]')
  );

  if(!paginator){
    container.replaceChildren();
    return;
  }

  paginator.style.display='flex';
  paginator.style.justifyContent='center';
  paginator.style.alignItems='center';
  paginator.style.gap='5px';
  paginator.style.marginTop='0';
  paginator.style.flexWrap='nowrap';
  paginator.style.width='max-content';
  paginator.style.minWidth='100%';

  paginator.querySelectorAll('button,span').forEach(el=>{
    el.style.flexShrink='0';
  });

  container.replaceChildren(paginator);
  container.scrollLeft=0;
}

(function installNewOrderPaginationLayout(){
  if(typeof document==='undefined'||typeof window==='undefined')return;

  const original=window.renderNewOrderMaterials;
  if(typeof original!=='function')return;

  window.renderNewOrderMaterials=function(...args){
    const result=original.apply(this,args);
    normalizeNewOrderPaginator();
    return result;
  };

  ensureNewOrderPaginatorContainer();
  normalizeNewOrderPaginator();
})();
