'use strict';

// Capture the original handlers before the workflow script declares replacements.
window.siteOrdersLegacy={
  initNewOrder:window.initNewOrder,
  renderAdminMaterials:window.renderAdminMaterials,
  openMaterialModal:window.openMaterialModal,
  saveMaterial:window.saveMaterial
};
