'use strict';

// New Order and Inventory already use the in-memory material catalogue after
// application initialization. Their original HTML contained permanent
// "Loading..." placeholders, which could flash when opening those pages even
// though no new network request was taking place.
(function installMaterialPageLoadingFix(){
  if(typeof window==='undefined'||typeof document==='undefined')return;

  function hasOnlyStaticLoader(container){
    if(!container)return false;
    return Boolean(container.querySelector(':scope > .loading')) &&
      container.children.length===1;
  }

  function prepareNewOrderPage(){
    const grid=document.getElementById('new-order-material-grid');
    if(!hasOnlyStaticLoader(grid))return;

    grid.innerHTML=`
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-icon">🔍</div>
        <div class="empty-text">Search or filter to show materials</div>
      </div>`;
  }

  function prepareInventoryPage(){
    const list=document.getElementById('admin-materials-list');
    if(!hasOnlyStaticLoader(list))return;

    // Inventory is populated synchronously from allMaterials once the catalogue
    // has loaded. A blank container is preferable to showing a false spinner.
    list.replaceChildren();
  }

  function removeStaticMaterialLoaders(){
    prepareNewOrderPage();
    prepareInventoryPage();
  }

  const baseNavigateTo=window.navigateTo;
  if(typeof baseNavigateTo==='function'){
    window.navigateTo=function(page){
      // Clean the target while it is still hidden, before navigateTo activates it.
      if(page==='nuevo-pedido')prepareNewOrderPage();
      else if(page==='admin-materiales')prepareInventoryPage();
      return baseNavigateTo(page);
    };
  }

  document.addEventListener('DOMContentLoaded',removeStaticMaterialLoaders);
})();
