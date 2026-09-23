'use strict';

const fs=require('fs');
const vm=require('vm');
const assert=require('assert');

const imagePreview=fs.readFileSync('js/image-preview.js','utf8');
const page=fs.readFileSync('index.html','utf8');
const workflow=fs.readFileSync('js/workflow-v2.js','utf8');

assert(page.includes('<script src="./js/image-preview.js?v=1"></script>'), 'the page must load the safe image preview handler');
assert(imagePreview.includes('button.dataset.imageUrl=imageUrl'), 'image URL must be stored through dataset, not executable HTML');
assert(imagePreview.includes('button.dataset.imageName=materialName'), 'material name must be stored through dataset');
assert(imagePreview.includes("button.addEventListener('click'"), 'image preview must use an event listener');
assert(!imagePreview.includes('onclick="previewOrderItemImage('), 'safe image preview must not use inline dynamic onclick');
assert(!workflow.includes('onclick="previewOrderItemImage('), 'workflow renderer must not reintroduce inline image preview arguments');

const context={
  window:{location:{href:'https://example.test/app/'},viewOrder:()=>{}},
  URL,
  console
};
vm.createContext(context);
vm.runInContext(imagePreview,context,{filename:'image-preview.js'});

const valid='https://example.test/storage/material image.webp';
assert.strictEqual(
  context.normalizeMaterialImageUrl(valid),
  'https://example.test/storage/material%20image.webp'
);
assert.strictEqual(context.normalizeMaterialImageUrl('javascript:alert(1)'), '');

const tricky='ACR COPPER 90° ELBOW 3/4 " & O\'Ring <test>';
const data=context.getMaterialImageData({
  material_name_snapshot:tricky,
  materiales:{imagen_url:'https://example.test/image.webp'}
});
assert.strictEqual(data.materialName,tricky, 'special characters must remain intact as data');
assert.strictEqual(data.imageUrl,'https://example.test/image.webp');

console.log('Image preview regression checks passed.');
