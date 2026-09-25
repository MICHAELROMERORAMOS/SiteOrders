'use strict';

// CATALOG
function filterCatalog(){catalogPage=1;renderCatalog();}
function renderCatalog(){
  const grid=document.getElementById('catalog-grid');if(!grid)return;
  const search=(document.getElementById('search-cat')?.value||'').toLowerCase();
  const cat=document.getElementById('filter-cat-cat')?.value||'';
  const filtered=allMaterials.filter(m=>(!search||m.nombre.toLowerCase().includes(search)||(m.id_material||'').toLowerCase().includes(search))&&(!cat||m.categoria_id==cat));
if(!filtered.length){grid.innerHTML='<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">🔍</div><div class="empty-text">No results</div></div>';document.getElementById('catalog-paginator').innerHTML='';return;}
  const totalPages=Math.ceil(filtered.length/PAGE_SIZE);
  if(catalogPage>totalPages)catalogPage=totalPages;
  const paged=filtered.slice((catalogPage-1)*PAGE_SIZE, catalogPage*PAGE_SIZE);
  const cards=paged.map(m=>{
    const imgEl=m.imagen_url?`<img src="${m.imagen_url}" class="material-card-img" style="display:block;object-fit:contain;padding:6px" alt="${m.nombre}">`:`<div class="material-card-img">${m.categorias?.icono||'📦'}</div>`;
    return`<div class="material-card">${imgEl}<div class="material-card-body">
      <div class="material-card-id">${m.id_material||''}</div>
      <div class="material-card-name">${m.nombre}</div>
      ${m.categorias?`<div style="margin-bottom:5px"><span class="badge badge-gray" style="font-size:10px">${m.categorias.icono||''} ${m.categorias.nombre}</span></div>`:''}
      ${m.descripcion?`<div style="font-size:11px;color:var(--text2);margin-top:4px">${m.descripcion.slice(0,60)}${m.descripcion.length>60?'…':''}</div>`:''}
    </div></div>`;
  }).join('');
grid.innerHTML=cards;
  document.getElementById('catalog-paginator').innerHTML=renderPaginator(catalogPage,totalPages,'catalogPage','renderCatalog','catalog-grid');
}

// ADMIN MATERIALS
function filterAdminMaterials(){adminMatPage=1;renderAdminMaterials();}
function renderAdminMaterials(){
  const c=document.getElementById('admin-materials-list');if(!c)return;
  const search=(document.getElementById('search-admin-mat')?.value||'').toLowerCase();
  const cat=document.getElementById('filter-admin-cat')?.value||'';
  const filtered=allMaterials.filter(m=>(!search||m.nombre.toLowerCase().includes(search)||(m.id_material||'').toLowerCase().includes(search))&&(!cat||m.categoria_id==cat));
  if(!filtered.length){c.innerHTML='<div class="empty-state"><div class="empty-icon">🔍</div><div class="empty-text">No results</div></div>';return;}
  const totalPages=Math.ceil(filtered.length/PAGE_SIZE);
  if(adminMatPage>totalPages)adminMatPage=totalPages;
  const paged=filtered.slice((adminMatPage-1)*PAGE_SIZE, adminMatPage*PAGE_SIZE);
  const rows=paged.map(m=>{
    const imgEl=m.imagen_url?`<img src="${m.imagen_url}" style="width:34px;height:34px;object-fit:cover;border-radius:6px">`:`<div style="width:34px;height:34px;background:var(--bg4);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:16px">${m.categorias?.icono||'📦'}</div>`;
    return`<tr>
      <td>${imgEl}</td>
      <td><div style="font-weight:500">${m.nombre}</div><div style="font-size:10px;color:var(--text3);font-family:'DM Mono',monospace">${m.id_material||''}</div></td>
      <td>${m.categorias?`<span class="badge badge-gray" style="font-size:10px">${m.categorias.icono||''} ${m.categorias.nombre}</span>`:'–'}</td>
      <td style="font-size:12px;color:var(--text2)">${m.unidad_medida||'–'}</td>
      <td style="font-size:12px;color:var(--text2)">${m.descripcion?m.descripcion.slice(0,45)+(m.descripcion.length>45?'…':''):'–'}</td>
      <td><div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn btn-secondary btn-sm" onclick='editMaterial(${JSON.stringify(m).replace(/'/g,"&#39;")})'>Edit</button>
        <button class="btn btn-secondary btn-sm" ${!m.imagen_url?'disabled':''} onclick="openShareImageModal(${m.id})">Similar Products</button>
        <button class="btn btn-danger btn-sm" onclick="deleteMaterial(${m.id})">✕</button>
      </div></td>
    </tr>`;
  }).join('');
  c.innerHTML=`<div class="table-wrap"><table><thead><tr><th></th><th>Material</th><th>Category</th><th>Unit</th><th>Description</th><th>Actions</th></tr></thead><tbody>${rows}</tbody></table></div>`
    +renderPaginator(adminMatPage,totalPages,'adminMatPage','renderAdminMaterials','admin-materials-list');
}

function goToPaginatorPage(pageVar,page,renderFn){
  if(pageVar==='catalogPage')catalogPage=page;
  else if(pageVar==='adminMatPage')adminMatPage=page;
  else if(pageVar==='newOrderMatPage')newOrderMatPage=page;

  if(pageVar==='newOrderMatPage')saveOrderDraft();

  const renderers={
    renderCatalog,
    renderAdminMaterials,
    renderNewOrderMaterials
  };

  if(typeof renderers[renderFn]==='function')renderers[renderFn]();
}

function renderPaginator(currentPg, totalPages, pageVar, renderFn, containerId){
  if(totalPages<=1)return'';
  const btns=[];

  // Prev button
  btns.push(`<button class="btn btn-secondary btn-sm" ${currentPg===1?'disabled':''} onclick="goToPaginatorPage('${pageVar}',${currentPg-1},'${renderFn}')">‹ Prev</button>`);

  // Window of up to 5 pages centered around current page
  const windowSize=5;
  let startPage=Math.max(1, currentPg - Math.floor(windowSize/2));
  let endPage=Math.min(totalPages, startPage + windowSize - 1);
  if(endPage - startPage + 1 < windowSize) startPage=Math.max(1, endPage - windowSize + 1);

  // First page + ellipsis
  if(startPage>1){
    btns.push(`<button class="btn btn-secondary btn-sm" onclick="goToPaginatorPage('${pageVar}',1,'${renderFn}')">1</button>`);
    if(startPage>2) btns.push(`<span style="color:var(--text3);padding:0 2px;line-height:30px">…</span>`);
  }

  // Page window
  for(let i=startPage;i<=endPage;i++){
    btns.push(`<button class="btn btn-sm ${i===currentPg?'btn-primary':'btn-secondary'}" onclick="goToPaginatorPage('${pageVar}',${i},'${renderFn}')">${i}</button>`);
  }

  // Ellipsis + last page
  if(endPage<totalPages){
    if(endPage<totalPages-1) btns.push(`<span style="color:var(--text3);padding:0 2px;line-height:30px">…</span>`);
    btns.push(`<button class="btn btn-secondary btn-sm" onclick="goToPaginatorPage('${pageVar}',${totalPages},'${renderFn}')">${totalPages}</button>`);
  }

  // Next button
  btns.push(`<button class="btn btn-secondary btn-sm" ${currentPg===totalPages?'disabled':''} onclick="goToPaginatorPage('${pageVar}',${currentPg+1},'${renderFn}')">Next ›</button>`);

  return`<div style="display:flex;justify-content:center;align-items:center;gap:5px;margin-top:14px;flex-wrap:wrap">${btns.join('')}</div>`;
}

function setMaterialImageStatus(message,error=false){
  const el=document.getElementById('material-image-status');
  if(!el)return;
  el.textContent=message||'';
  el.classList.toggle('error',!!error);
}

function formatMaterialImageBytes(bytes){
  const value=Number(bytes)||0;
  if(value<1024)return `${value} B`;
  if(value<1024*1024)return `${(value/1024).toFixed(value<10240?1:0)} KB`;
  return `${(value/(1024*1024)).toFixed(2)} MB`;
}

async function loadMaterialImageSource(file){
  if('createImageBitmap' in window){
    const bitmap=await createImageBitmap(file);
    return {
      width:bitmap.width,
      height:bitmap.height,
      draw:(ctx,w,h)=>ctx.drawImage(bitmap,0,0,w,h),
      close:()=>bitmap.close?.()
    };
  }

  const url=URL.createObjectURL(file);
  try{
    const img=await new Promise((resolve,reject)=>{
      const el=new Image();
      el.onload=()=>resolve(el);
      el.onerror=()=>reject(new Error('The image could not be opened.'));
      el.src=url;
    });
    return {
      width:img.naturalWidth||img.width,
      height:img.naturalHeight||img.height,
      draw:(ctx,w,h)=>ctx.drawImage(img,0,0,w,h),
      close:()=>URL.revokeObjectURL(url)
    };
  }catch(error){
    URL.revokeObjectURL(url);
    throw error;
  }
}

function canvasToMaterialImageBlob(canvas,type,quality){
  return new Promise(resolve=>canvas.toBlob(resolve,type,quality));
}

async function compressMaterialImage(file){
  if(!file||!String(file.type||'').startsWith('image/')){
    throw new Error('Please select or paste an image.');
  }

  const MAX_DIMENSION=1400;
  const TARGET_BYTES=250*1024;
  const source=await loadMaterialImageSource(file);

  try{
    const maxSide=Math.max(source.width,source.height);
    const needsResize=maxSide>MAX_DIMENSION;
    const scale=needsResize?MAX_DIMENSION/maxSide:1;
    const width=Math.max(1,Math.round(source.width*scale));
    const height=Math.max(1,Math.round(source.height*scale));

    // Small images are kept untouched to avoid unnecessary quality loss.
    if(!needsResize&&file.size<=TARGET_BYTES){
      return {file,originalBytes:file.size,finalBytes:file.size,changed:false,width,height};
    }

    const canvas=document.createElement('canvas');
    canvas.width=width;
    canvas.height=height;
    const ctx=canvas.getContext('2d',{alpha:true});
    if(!ctx)throw new Error('Image compression is not supported in this browser.');

    ctx.imageSmoothingEnabled=true;
    ctx.imageSmoothingQuality='high';
    source.draw(ctx,width,height);

    const qualities=[0.82,0.76,0.70,0.64,0.58];
    let bestBlob=null;

    for(const quality of qualities){
      const blob=await canvasToMaterialImageBlob(canvas,'image/webp',quality);
      if(!blob)continue;
      bestBlob=blob;
      if(blob.size<=TARGET_BYTES)break;
    }

    if(!bestBlob){
      bestBlob=await canvasToMaterialImageBlob(canvas,'image/jpeg',0.76);
    }
    if(!bestBlob)throw new Error('The browser could not compress this image.');

    const baseName=String(file.name||'material-image')
      .replace(/\.[^.]+$/,'')
      .replace(/[^a-z0-9_-]+/gi,'-')
      .replace(/^-+|-+$/g,'')||'material-image';
    const isWebp=bestBlob.type==='image/webp';
    const finalFile=new File(
      [bestBlob],
      `${baseName}.${isWebp?'webp':'jpg'}`,
      {type:bestBlob.type||'image/webp',lastModified:Date.now()}
    );

    return {
      file:finalFile,
      originalBytes:file.size,
      finalBytes:finalFile.size,
      changed:true,
      width,
      height
    };
  }finally{
    source.close?.();
  }
}

async function applyMaterialImageFile(file,sourceLabel='Image'){
  if(!file)return;
  setMaterialImageStatus('Optimizing image...');
  try{
    const result=await compressMaterialImage(file);
    selectedMaterialImageFile=result.file;
    selectedMaterialImageUrl='';

    const reader=new FileReader();
    reader.onload=e=>setMaterialImagePreview(e.target.result);
    reader.readAsDataURL(result.file);

    if(result.changed){
      setMaterialImageStatus(
        `${sourceLabel} ready · ${formatMaterialImageBytes(result.originalBytes)} → ${formatMaterialImageBytes(result.finalBytes)} · ${result.width}×${result.height}px`
      );
    }else{
      setMaterialImageStatus(
        `${sourceLabel} ready · ${formatMaterialImageBytes(result.finalBytes)} · already optimized`
      );
    }
  }catch(error){
    console.error(error);
    selectedMaterialImageFile=null;
    setMaterialImageStatus(error.message||'The image could not be prepared.',true);
    alert(error.message||'The image could not be prepared.');
  }
}

function openMaterialModal(mat=null){
  editingMaterialId=mat?.id||null;
  selectedMaterialImageUrl=mat?.imagen_url||'';
  selectedMaterialImageFile=null;

  document.getElementById('modal-material-title').textContent=mat?'Edit Material':'New Material';
  document.getElementById('mat-id').value=mat?.id_material||'';
  document.getElementById('mat-name').value=mat?.nombre||'';
  document.getElementById('mat-desc').value=mat?.descripcion||'';
  document.getElementById('mat-cat').value=mat?.categoria_id||'';
  document.getElementById('mat-unit').value=mat?.unidad_medida||'';
  document.getElementById('mat-img-file').value='';

  setMaterialImagePreview(selectedMaterialImageUrl);
  setMaterialImageStatus(
    selectedMaterialImageUrl
      ? 'Existing image selected. New uploads and pasted screenshots are compressed automatically.'
      : 'Images are compressed automatically before upload.'
  );
  openModal('modal-material');
}

function editMaterial(mat){openMaterialModal(mat);}

function setMaterialImagePreview(url){
  const prev=document.getElementById('img-preview-el');
  const ph=document.getElementById('img-placeholder');
  const area=document.getElementById('img-upload-area');

  if(url){
    prev.src=url;
    prev.style.display='block';
    ph.style.display='none';
    area.classList.add('has-img');
  }else{
    prev.removeAttribute('src');
    prev.style.display='none';
    ph.style.display='block';
    area.classList.remove('has-img');
  }
}

function clearMaterialImageSelection(){
  selectedMaterialImageUrl='';
  selectedMaterialImageFile=null;
  const fileInput=document.getElementById('mat-img-file');
  if(fileInput)fileInput.value='';
  setMaterialImagePreview('');
  setMaterialImageStatus('Image cleared. Images are compressed automatically before upload.');
}

function materialImageExtension(file){
  const type=String(file?.type||'').toLowerCase();
  if(type==='image/webp')return 'webp';
  if(type==='image/png')return 'png';
  if(type==='image/gif')return 'gif';
  return 'jpg';
}

async function saveMaterial(){
  const data={
    id_material:document.getElementById('mat-id').value.trim(),
    nombre:document.getElementById('mat-name').value.trim(),
    descripcion:document.getElementById('mat-desc').value.trim(),
    categoria_id:document.getElementById('mat-cat').value||null,
    unidad_medida:document.getElementById('mat-unit').value.trim()||'unit',
  };

  if(!data.nombre)return alert('Name is required.');

  if(selectedMaterialImageFile){
    setMaterialImageStatus('Uploading optimized image...');
    const file=selectedMaterialImageFile;
    const ext=materialImageExtension(file);
    const path=`materiales/${Date.now()}.${ext}`;
    const{error:upErr}=await sb.storage.from('material-images').upload(path,file,{
      upsert:false,
      contentType:file.type||undefined,
      cacheControl:'31536000'
    });
    if(upErr){
      setMaterialImageStatus('Image upload error: '+upErr.message,true);
      return alert('Image upload error: '+upErr.message);
    }
    const{data:ud}=sb.storage.from('material-images').getPublicUrl(path);
    data.imagen_url=ud.publicUrl;
  }else if(selectedMaterialImageUrl!==undefined){
    data.imagen_url=selectedMaterialImageUrl||null;
  }

  let error;
  if(editingMaterialId)({error}=await sb.from('materiales').update(data).eq('id',editingMaterialId));
  else({error}=await sb.from('materiales').insert(data));

  if(error)return alert('Error: '+error.message);

  closeModal('modal-material');
  selectedMaterialImageUrl='';
  selectedMaterialImageFile=null;
  await loadMaterials();
}

async function deleteMaterial(id){
  if(!confirm('Delete this material?'))return;
  await sb.from('materiales').delete().eq('id',id);await loadMaterials();
}

async function previewImage(input){
  if(!input.files[0])return;
  await applyMaterialImageFile(input.files[0],'Selected image');
}

async function handleMaterialImageDrop(event){
  event.preventDefault();
  event.currentTarget?.classList.remove('drag-over');
  const file=[...(event.dataTransfer?.files||[])].find(f=>String(f.type||'').startsWith('image/'));
  if(!file){
    setMaterialImageStatus('Drop an image file here.',true);
    return;
  }
  await applyMaterialImageFile(file,'Dropped image');
}

async function handleMaterialImagePaste(event){
  const modal=document.getElementById('modal-material');
  if(!modal?.classList.contains('open'))return false;

  const items=[...(event.clipboardData?.items||[])];
  const imageItem=items.find(item=>String(item.type||'').startsWith('image/'));
  if(!imageItem)return false;

  const file=imageItem.getAsFile();
  if(!file)return false;
  event.preventDefault();
  await applyMaterialImageFile(file,'Pasted image');
  return true;
}

async function pasteMaterialImageFromClipboard(){
  if(!navigator.clipboard?.read){
    setMaterialImageStatus('Clipboard image access is not available here. Use Ctrl+V / Paste inside this window instead.',true);
    return;
  }

  setMaterialImageStatus('Reading image from clipboard...');
  try{
    const items=await navigator.clipboard.read();
    for(const item of items){
      const type=item.types.find(t=>t.startsWith('image/'));
      if(!type)continue;
      const blob=await item.getType(type);
      const file=new File([blob],`clipboard-${Date.now()}`,{type});
      await applyMaterialImageFile(file,'Pasted image');
      return;
    }
    setMaterialImageStatus('There is no image in the clipboard.',true);
  }catch(error){
    console.warn(error);
    setMaterialImageStatus('Clipboard access was blocked. Use Ctrl+V / Paste while the material window is open.',true);
  }
}

document.addEventListener('paste',event=>{
  handleMaterialImagePaste(event);
});


async function openImageLibraryModal(){
  document.getElementById('image-library-search').value='';
  openModal('modal-image-library');
  await loadStoredImageLibrary(false);
}

async function loadStoredImageLibrary(force=false){
  const grid=document.getElementById('image-library-grid');
  if(grid)grid.innerHTML='<div class="loading" style="grid-column:1/-1"><div class="spinner"></div> Loading images...</div>';

  const images=[];
  const seen=new Set();

  function addImage(url,title,source){
    if(!url || seen.has(url))return;
    seen.add(url);
    images.push({url,title:title||'Stored image',source:source||'library'});
  }

  allMaterials
    .filter(m=>m.imagen_url)
    .forEach(m=>addImage(m.imagen_url,m.nombre||m.id_material||'Material image','used by material'));

  const {data,error}=await sb.storage
    .from('material-images')
    .list('materiales',{limit:300,sortBy:{column:'created_at',order:'desc'}});

  if(!error && Array.isArray(data)){
    data
      .filter(file=>file && file.name && !file.name.endsWith('/'))
      .forEach(file=>{
        const {data:ud}=sb.storage.from('material-images').getPublicUrl(`materiales/${file.name}`);
        addImage(ud.publicUrl,file.name,'storage');
      });
  }

  storedImageLibrary=images;
  renderImageLibrary();
}

function renderImageLibrary(){
  const grid=document.getElementById('image-library-grid');
  if(!grid)return;

  const search=(document.getElementById('image-library-search')?.value||'').trim().toLowerCase();
  const filtered=storedImageLibrary.filter(img=>
    !search ||
    (img.title||'').toLowerCase().includes(search) ||
    (img.source||'').toLowerCase().includes(search) ||
    (img.url||'').toLowerCase().includes(search)
  );

  if(!filtered.length){
    grid.innerHTML='<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">🖼️</div><div class="empty-text">No stored images found</div></div>';
    return;
  }

  grid.innerHTML=filtered.map(img=>`
    <div class="image-library-card ${img.url===selectedMaterialImageUrl?'active':''}" onclick="selectExistingImage('${escapeForJsArg(img.url)}')">
      <img src="${img.url}" alt="${escapeHtml(img.title)}">
      <div class="image-library-title">${escapeHtml(img.title)}</div>
      <div class="image-library-sub">${escapeHtml(img.source)}</div>
    </div>
  `).join('');
}

function selectExistingImage(url){
  selectedMaterialImageUrl=url;
  selectedMaterialImageFile=null;
  const fileInput=document.getElementById('mat-img-file');
  if(fileInput)fileInput.value='';
  setMaterialImagePreview(url);
  closeModal('modal-image-library');
}

function escapeHtml(value){
  return String(value??'')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'",'&#39;');
}

function escapeForJsArg(value){
  return String(value??'')
    .replaceAll('\\','\\\\')
    .replaceAll("'","\\'")
    .replaceAll('\n','');
}

function openShareImageModal(materialId){
  const material=allMaterials.find(m=>String(m.id)===String(materialId));
  if(!material)return;
  if(!material.imagen_url)return alert('This material does not have an image to share.');

  shareImageSourceMaterial=material;
  selectedShareMaterialIds=new Set();

  document.getElementById('share-image-search').value='';
  document.getElementById('share-only-without-image').checked=true;

  document.getElementById('share-image-source').innerHTML=`
    <img src="${material.imagen_url}" alt="${escapeHtml(material.nombre)}">
    <div style="min-width:0;flex:1">
      <div style="font-size:10px;color:var(--text3);text-transform:uppercase;font-weight:700;letter-spacing:.6px">Source material</div>
      <div style="font-size:15px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(material.nombre)}</div>
      <div style="font-size:11px;color:var(--text3);font-family:'DM Mono',monospace">${escapeHtml(material.id_material||'')}</div>
    </div>
  `;

  openModal('modal-share-image');
  renderShareImageProducts();
}

function getVisibleShareProducts(){
  if(!shareImageSourceMaterial)return [];

  const search=(document.getElementById('share-image-search')?.value||'').trim().toLowerCase();
  const onlyWithout=document.getElementById('share-only-without-image')?.checked;
  const sourceCat=shareImageSourceMaterial.categoria_id;

  return allMaterials.filter(m=>{
    if(String(m.id)===String(shareImageSourceMaterial.id))return false;
    if(onlyWithout && m.imagen_url)return false;

    const matchesSearch=!search ||
      (m.nombre||'').toLowerCase().includes(search) ||
      (m.id_material||'').toLowerCase().includes(search);

    // When search is empty, prioritize same category as "similar".
    const matchesSimilarity=search ? true : String(m.categoria_id||'')===String(sourceCat||'');

    return matchesSearch && matchesSimilarity;
  });
}

function renderShareImageProducts(){
  const list=document.getElementById('share-product-list');
  const counter=document.getElementById('share-image-counter');
  if(!list || !counter)return;

  const products=getVisibleShareProducts();
  counter.textContent=`${selectedShareMaterialIds.size} product${selectedShareMaterialIds.size===1?'':'s'} selected`;

  if(!products.length){
    list.innerHTML='<div class="empty-state" style="padding:24px 20px"><div class="empty-icon">🔍</div><div class="empty-text">No similar products found</div></div>';
    return;
  }

  list.innerHTML=products.map(m=>{
    const checked=selectedShareMaterialIds.has(String(m.id))?'checked':'';
    const thumb=m.imagen_url
      ? `<img src="${m.imagen_url}" alt="${escapeHtml(m.nombre)}">`
      : `<div class="share-product-placeholder">${m.categorias?.icono||'📦'}</div>`;
    return `
      <label class="share-product-row">
        <input type="checkbox" ${checked} onchange="toggleShareProductSelection(${m.id},this.checked)">
        ${thumb}
        <div style="min-width:0">
          <div class="share-product-name">${escapeHtml(m.nombre)}</div>
          <div class="share-product-code">${escapeHtml(m.id_material||'')}</div>
        </div>
        <div class="share-product-existing">${m.imagen_url?'Has image':'No image'}</div>
      </label>`;
  }).join('');
}

function toggleShareProductSelection(materialId,checked){
  const key=String(materialId);
  if(checked)selectedShareMaterialIds.add(key);
  else selectedShareMaterialIds.delete(key);
  document.getElementById('share-image-counter').textContent=`${selectedShareMaterialIds.size} product${selectedShareMaterialIds.size===1?'':'s'} selected`;
}

function selectVisibleShareProducts(){
  getVisibleShareProducts().forEach(m=>selectedShareMaterialIds.add(String(m.id)));
  renderShareImageProducts();
}

function clearShareImageSelection(){
  selectedShareMaterialIds.clear();
  renderShareImageProducts();
}

async function applySharedImageToProducts(){
  if(!shareImageSourceMaterial?.imagen_url)return alert('Source material has no image.');
  const ids=[...selectedShareMaterialIds].map(id=>Number(id)).filter(Boolean);
  if(!ids.length)return alert('Please select at least one product.');

  const {error}=await sb
    .from('materiales')
    .update({imagen_url:shareImageSourceMaterial.imagen_url,updated_at:new Date().toISOString()})
    .in('id',ids);

  if(error)return alert('Error sharing image: '+error.message);

  alert(`✅ Image shared with ${ids.length} product${ids.length===1?'':'s'}.`);
  closeModal('modal-share-image');
  shareImageSourceMaterial=null;
  selectedShareMaterialIds.clear();
  await loadMaterials();
}
