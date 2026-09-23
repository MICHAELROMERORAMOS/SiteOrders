'use strict';

// Return drafts are stored in Supabase. The per-user local copy covers edits
// made just before a tab closes or while a network request is in flight.
const mrState={current:null,items:[],list:[],revision:0,timer:null,saving:Promise.resolve(),opening:0,logoUrl:null};
const MR_BUCKET='material-return-branding';
const MR_LOGO='company-logo.png';

function mrCanEdit(){return Boolean(currentUser&&currentProfile?.status==='activo'&&['admin','supervisor','encargado'].includes(currentProfile.role));}
function mrCanPdf(){return mrCanEdit();}
function mrIsAdmin(){return currentProfile?.status==='activo'&&currentProfile.role==='admin';}
function mrIsDraft(){return mrState.current?.status==='draft';}
function mrEscape(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function mrToday(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function mrNumber(sequence){return sequence?String(sequence).padStart(3,'0'):'Draft';}
function mrFilePart(value){return String(value||'').replace(/[\\/:*?"<>|\x00-\x1f]/g,' ').replace(/\s+/g,' ').trim()||'UNNAMED';}
function mrCacheKey(id){return `siteorders:material-return:${currentUser?.id}:${id}`;}
function mrActiveKey(){return `siteorders:active-material-return:${currentUser?.id}`;}
function mrStatus(message,error=false){const el=document.getElementById('return-save-status');if(el){el.textContent=message;el.style.color=error?'var(--red)':'var(--text2)';}}
function mrDraft(){return {returnId:mrState.current?.id,projectId:document.getElementById('return-project').value||null,returnDate:document.getElementById('return-date').value,items:mrState.items.map(i=>({...i}))};}
function mrRemember(){if(!mrIsDraft())return;mrState.revision++;try{localStorage.setItem(mrCacheKey(mrState.current.id),JSON.stringify({version:1,...mrDraft()}));}catch(e){console.warn('Material Return local backup unavailable',e);}}

function mrUpdateActions(){
  const submitted=mrState.current?.status==='submitted';
  document.getElementById('return-save-action').style.display=submitted?'none':'';
  document.getElementById('return-submit-action').style.display=submitted?'none':'';
  document.getElementById('return-reopen-action').style.display=submitted&&mrIsAdmin()?'':'none';
  document.querySelectorAll('.return-pdf-action').forEach(b=>b.style.display=submitted&&mrCanPdf()?'':'none');
  document.getElementById('return-workflow-note').textContent=submitted
    ?'Sent for review · Editing is locked until an administrator allows it.'
    :'Draft · A number is assigned when you send it for review.';
}

async function loadMaterialReturnsPage(){
  if(!mrCanEdit()){
    document.getElementById('returns-list').textContent='Your account does not have access to Material Returns.';
    return;
  }
  if(!await refreshMaterialReturnsList())return;
  if(mrState.current){renderMaterialReturnEditor();return;}
  let savedId;
  try{savedId=localStorage.getItem(mrActiveKey());}catch(e){console.warn('Material Return local backup unavailable',e);}
  const target=mrState.list.find(r=>r.id===savedId)||mrState.list[0];
  if(target)await openMaterialReturn(target.id);
}

async function refreshMaterialReturnsList(){
  const {data,error}=await sb.from('material_returns')
    .select('id,project_code,project_name,project_sequence,status,return_date,updated_at,created_by,material_return_items(id)')
    .order('updated_at',{ascending:false}).limit(100);
  if(error){
    document.getElementById('returns-list').textContent='Could not load Material Returns: '+error.message;
    mrStatus(error.message,true);
    return false;
  }
  mrState.list=data||[];
  const container=document.getElementById('returns-list');
  container.innerHTML=mrState.list.length?mrState.list.map(r=>`
    <button type="button" class="return-list-entry ${mrState.current?.id===r.id?'active':''}" onclick="openMaterialReturn('${r.id}')">
      <strong>${mrEscape(mrNumber(r.project_sequence))} · ${mrEscape([r.project_code,r.project_name].filter(Boolean).join(' · ')||'Project pending')}</strong>
      <small>${mrEscape(r.return_date)} · ${r.material_return_items?.length||0} items · ${r.status==='submitted'?'Sent for review':'Draft'}</small>
    </button>`).join(''):'<p class="return-helper">No returns yet. Create one to start a list.</p>';
  return true;
}

async function newMaterialReturn(){
  if(!mrCanEdit())return;
  if(mrState.current&&!await saveMaterialReturnNow())return;
  const {data,error}=await sb.from('material_returns').insert({created_by:currentUser.id,return_date:mrToday()}).select().single();
  if(error){mrStatus(error.message,true);return;}
  mrState.current=data;mrState.items=[];mrState.revision=0;
  localStorage.setItem(mrActiveKey(),data.id);
  renderMaterialReturnEditor();await refreshMaterialReturnsList();
}

async function openMaterialReturn(id){
  if(!mrCanEdit())return;
  if(mrState.current?.id!==id&&mrState.current&&!await saveMaterialReturnNow())return;
  const token=++mrState.opening;
  const [{data:record,error:recordError},{data:items,error:itemsError}]=await Promise.all([
    sb.from('material_returns').select('*').eq('id',id).single(),
    sb.from('material_return_items').select('*').eq('return_id',id).order('id')
  ]);
  if(token!==mrState.opening)return;
  if(recordError||itemsError||!record){mrStatus(recordError?.message||itemsError?.message||'Return unavailable',true);return;}
  mrState.current=record;
  mrState.items=(items||[]).map(i=>({material_id:i.material_id,quantity:Number(i.quantity),sku_snapshot:i.sku_snapshot,description_snapshot:i.description_snapshot,unit_snapshot:i.unit_snapshot}));
  mrState.revision=0;
  localStorage.setItem(mrActiveKey(),id);
  renderMaterialReturnEditor();
  try{
    if(record.status==='submitted')localStorage.removeItem(mrCacheKey(id));
    const backup=JSON.parse(localStorage.getItem(mrCacheKey(id))||'null');
    if(record.status==='draft'&&backup?.version===1&&backup.returnId===id&&Array.isArray(backup.items)){
      document.getElementById('return-project').value=backup.projectId||'';
      document.getElementById('return-date').value=backup.returnDate||record.return_date;
      mrState.items=backup.items;
      renderReturnItems();
      mrRemember();mrScheduleSave();
    }
  }catch(e){console.warn('Material Return local backup invalid',e);}
  await refreshMaterialReturnsList();
}

function renderMaterialReturnEditor(){
  if(!mrState.current)return;
  const submitted=mrState.current.status==='submitted';
  document.getElementById('return-editor').style.display='block';
  document.getElementById('return-editor-title').textContent='Material Return '+mrNumber(mrState.current.project_sequence)+' · '+(mrState.current.project_code||'New draft');
  const select=document.getElementById('return-project');
  select.innerHTML='<option value="">Select project...</option>';
  allProjects.forEach(p=>select.add(new Option(`${p.codigo?'['+p.codigo+'] ':''}${p.nombre}`,p.id)));
  select.value=mrState.current.project_id||'';
  select.disabled=submitted||Boolean(mrState.current.project_sequence);
  select.title=select.disabled?'The project is fixed after its return number is assigned.':'';
  document.getElementById('return-date').value=mrState.current.return_date||mrToday();
  document.getElementById('return-date').disabled=submitted;
  document.getElementById('return-material-search').value='';
  document.getElementById('return-material-search').disabled=submitted;
  renderReturnMaterialMatches();renderReturnItems();mrUpdateActions();
  mrStatus(submitted?'Sent for review · Locked':'Saved in Supabase');
}

function renderReturnMaterialMatches(){
  const container=document.getElementById('return-material-matches');
  if(!mrIsDraft()){
    container.textContent='Materials cannot be changed while this return is under review.';
    return;
  }
  const term=document.getElementById('return-material-search').value.trim().toLowerCase();
  if(!term){container.innerHTML='<span class="return-helper">Search the catalogue to add a line.</span>';return;}
  const found=allMaterials.filter(m=>[m.id_material,m.nombre,m.descripcion,m.sku_alternativos].some(v=>String(v||'').toLowerCase().includes(term))).slice(0,24);
  container.innerHTML=found.length?found.map(m=>`<button type="button" class="return-match" onclick="addReturnMaterial(${m.id})"><span>${mrEscape(m.nombre)}</span><small>${mrEscape(m.id_material)} · ${mrEscape(m.unidad_medida)}</small></button>`).join(''):'<span class="return-helper">No matching material.</span>';
}

function renderReturnItems(){
  const container=document.getElementById('return-items');
  if(!mrState.items.length){container.innerHTML='<p class="return-helper">No materials selected yet.</p>';return;}
  container.innerHTML=`<div class="return-table-wrap"><table class="return-table"><thead><tr><th>SKU</th><th>Description</th><th>Quantity</th><th>Unit</th><th></th></tr></thead><tbody>${mrState.items.map((item,index)=>{
    const material=allMaterials.find(m=>m.id===item.material_id);
    return `<tr><td>${mrEscape(material?.id_material||item.sku_snapshot||'–')}</td>
      <td class="return-description">${mrEscape(material?.descripcion||item.description_snapshot||material?.nombre||'–')}</td>
      <td><input class="form-input return-quantity" type="number" min="0.001" max="999999999" step="0.001" value="${Number(item.quantity)||''}" ${mrIsDraft()?'':'disabled'} oninput="returnQuantityChanged(${index},this.value)" aria-label="Quantity for ${mrEscape(material?.id_material||item.sku_snapshot||'material')}"></td>
      <td>${mrEscape(material?.unidad_medida||item.unit_snapshot||'pcs')}</td>
      <td>${mrIsDraft()?`<button type="button" class="btn btn-danger btn-xs" onclick="removeReturnMaterial(${index})" aria-label="Remove material">×</button>`:''}</td></tr>`;
  }).join('')}</tbody></table></div>`;
}

function addReturnMaterial(id){
  if(!mrIsDraft())return;
  const material=allMaterials.find(m=>m.id===id);if(!material)return;
  const existing=mrState.items.find(i=>i.material_id===id);
  if(existing)existing.quantity=Number(existing.quantity)+1;
  else mrState.items.push({material_id:id,quantity:1,sku_snapshot:material.id_material,description_snapshot:material.descripcion||material.nombre,unit_snapshot:material.unidad_medida});
  document.getElementById('return-material-search').value='';
  renderReturnMaterialMatches();renderReturnItems();returnDraftChanged();
}

function returnQuantityChanged(index,value){
  if(!mrIsDraft()||!mrState.items[index])return;
  mrState.items[index].quantity=value===''?0:Number(value);
  returnDraftChanged();
}
function removeReturnMaterial(index){
  if(!mrIsDraft()||!mrState.items[index])return;
  const name=mrState.items[index].description_snapshot||mrState.items[index].sku_snapshot||'this material';
  if(!confirm(`Remove ${name} from Materials to return?`))return;
  mrState.items.splice(index,1);renderReturnItems();returnDraftChanged();
}
function returnDraftChanged(){
  if(!mrIsDraft())return;
  mrRemember();mrStatus('Unsaved changes');mrScheduleSave();
}
function mrScheduleSave(){clearTimeout(mrState.timer);mrState.timer=setTimeout(()=>{saveMaterialReturnNow();},550);}

async function saveMaterialReturnNow(){
  clearTimeout(mrState.timer);
  if(!mrState.current)return true;
  if(!mrIsDraft())return true;
  const draft=mrDraft();
  if(!draft.returnDate||mrState.items.some(i=>!Number.isFinite(Number(i.quantity))||Number(i.quantity)<=0)){
    mrStatus('Enter a date and positive quantities before saving.',true);return false;
  }
  const revision=mrState.revision;
  const task=async()=>{
    mrStatus('Saving...');
    const {data,error}=await sb.rpc('save_material_return',{
      p_return_id:draft.returnId,p_project_id:draft.projectId?Number(draft.projectId):null,
      p_return_date:draft.returnDate,
      p_items:draft.items.map(i=>({material_id:i.material_id,quantity:Number(i.quantity),sku_snapshot:i.sku_snapshot,description_snapshot:i.description_snapshot,unit_snapshot:i.unit_snapshot}))
    });
    if(error){mrStatus('Could not save: '+error.message,true);return false;}
    if(mrState.current?.id===draft.returnId){
      mrState.current=data;
      if(mrState.revision===revision){
        localStorage.removeItem(mrCacheKey(draft.returnId));
        document.getElementById('return-editor-title').textContent='Material Return '+mrNumber(data.project_sequence)+' · '+(data.project_code||'New draft');
        document.getElementById('return-project').disabled=Boolean(data.project_sequence);
        mrUpdateActions();
        mrStatus('Saved in Supabase');
      }
      else mrScheduleSave();
    }
    await refreshMaterialReturnsList();
    return true;
  };
  mrState.saving=mrState.saving.catch(()=>false).then(task);
  return mrState.saving;
}

async function submitMaterialReturn(){
  if(!mrIsDraft())return;
  if(!confirm('Send this Material Return for review? It will be locked until an administrator allows editing again.'))return;
  if(!await saveMaterialReturnNow())return;
  if(!mrState.current.project_id||!mrState.items.length){
    mrStatus('Select a project and add at least one material before sending.',true);return;
  }
  const {data,error}=await sb.rpc('submit_material_return',{p_return_id:mrState.current.id});
  if(error){mrStatus('Could not send for review: '+error.message,true);return;}
  mrState.current=data;
  clearTimeout(mrState.timer);
  localStorage.removeItem(mrCacheKey(data.id));
  renderMaterialReturnEditor();
  await refreshMaterialReturnsList();
}

async function reopenMaterialReturn(){
  if(!mrIsAdmin()||mrState.current?.status!=='submitted')return;
  if(!confirm('Allow editing this Material Return again? Its number will stay the same.'))return;
  const {data,error}=await sb.rpc('reopen_material_return',{p_return_id:mrState.current.id});
  if(error){mrStatus('Could not allow editing: '+error.message,true);return;}
  mrState.current=data;
  renderMaterialReturnEditor();
  await refreshMaterialReturnsList();
}

async function loadReturnBranding(){
  if(!mrIsAdmin())return;
  const {data,error}=await sb.from('material_return_branding').select('*').eq('id',1).single();
  if(error){mrBrandingStatus(error.message,true);return;}
  document.getElementById('return-company-name').value=data.company_name;
  const preview=document.getElementById('return-logo-preview');
  if(mrState.logoUrl){URL.revokeObjectURL(mrState.logoUrl);mrState.logoUrl=null;}
  if(!data.logo_path){preview.textContent='No logo uploaded yet.';return;}
  const download=await sb.storage.from(MR_BUCKET).download(data.logo_path);
  if(download.error){preview.textContent='Logo unavailable: '+download.error.message;return;}
  mrState.logoUrl=URL.createObjectURL(download.data);
  preview.innerHTML=`<img src="${mrState.logoUrl}" alt="Company logo">`;
}
function mrBrandingStatus(message,error=false){const el=document.getElementById('return-branding-status');el.textContent=message;el.style.color=error?'var(--red)':'var(--green)';}

async function mrPngBlob(file){
  if(!['image/png','image/jpeg'].includes(file.type)||file.size>2097152)throw new Error('Choose a PNG or JPEG image up to 2 MB.');
  const url=URL.createObjectURL(file);
  try{
    const image=new Image();image.src=url;await image.decode();
    const scale=Math.min(1,700/Math.max(image.naturalWidth,image.naturalHeight));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
    canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
    if(!blob||blob.size>2097152)throw new Error('The converted PNG is too large. Choose a smaller logo.');
    return blob;
  }finally{URL.revokeObjectURL(url);}
}

async function saveReturnBranding(){
  if(!mrIsAdmin())return;
  const name=document.getElementById('return-company-name').value.trim();
  const file=document.getElementById('return-logo-file').files[0];
  if(!name)return mrBrandingStatus('Enter the company name.',true);
  mrBrandingStatus('Saving...');
  try{
    let logoPath;
    if(file){
      const png=await mrPngBlob(file);
      const {error:uploadError}=await sb.storage.from(MR_BUCKET).upload(MR_LOGO,png,{upsert:true,contentType:'image/png',cacheControl:'3600'});
      if(uploadError)throw uploadError;
      logoPath=MR_LOGO;
    }
    const changes={company_name:name,updated_at:new Date().toISOString()};
    if(logoPath)changes.logo_path=logoPath;
    const {error}=await sb.from('material_return_branding').update(changes).eq('id',1);
    if(error)throw error;
    document.getElementById('return-logo-file').value='';
    await loadReturnBranding();mrBrandingStatus('Company branding saved.');
  }catch(e){mrBrandingStatus(e.message||String(e),true);}
}

async function mrBlobDataUrl(blob){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(blob);});}
async function downloadMaterialReturnPDF(){
  if(!mrCanPdf()||!mrState.current)return;
  if(!await saveMaterialReturnNow())return;
  const id=mrState.current.id;
  const [recordResult,itemsResult,brandResult]=await Promise.all([
    sb.from('material_returns').select('*').eq('id',id).single(),
    sb.from('material_return_items').select('*').eq('return_id',id).order('id'),
    sb.from('material_return_branding').select('*').eq('id',1).single()
  ]);
  if(recordResult.error||itemsResult.error||brandResult.error){mrStatus('Could not load the return for PDF.',true);return;}
  const record=recordResult.data,items=itemsResult.data||[],brand=brandResult.data;
  if(record.status!=='submitted'){mrStatus('Send the return for review before generating the PDF.',true);return;}
  if(!record.project_id||!items.length){mrStatus('Select a project and at least one material first.',true);return;}
  if(!record.project_sequence){mrStatus('Save the project first to assign a return number.',true);return;}
  if(!brand.logo_path){mrStatus('An administrator must upload the company logo before generating the PDF.',true);return;}
  const {data:logo,error:logoError}=await sb.storage.from(MR_BUCKET).download(brand.logo_path);
  if(logoError){mrStatus('The stored logo could not be loaded: '+logoError.message,true);return;}
  try{
    const logoData=await mrBlobDataUrl(logo);
    const {jsPDF}=window.jspdf;
    const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
    const W=doc.internal.pageSize.getWidth(),H=doc.internal.pageSize.getHeight(),margin=14;
    const navy=[24,46,70],teal=[16,119,128],muted=[86,101,117],pale=[240,247,249];
    const number=mrNumber(record.project_sequence);
    const generatedBy=currentProfile.full_name?.trim()||currentUser.email||'User';
    const props=doc.getImageProperties(logoData);
    const scale=Math.min(126/props.width,54/props.height);
    const logoWidth=props.width*scale,logoHeight=props.height*scale;
    const drawHeader=()=>{
      doc.setFillColor(...navy);doc.rect(0,0,W,3,'F');
      doc.addImage(logoData,'PNG',margin,8,logoWidth,logoHeight);
      doc.setFont('helvetica','bold');doc.setTextColor(...navy);doc.setFontSize(10);
      const companyLines=doc.splitTextToSize(brand.company_name,44).slice(0,4);
      doc.text(companyLines,W-margin,15,{align:'right'});
      doc.setFillColor(...navy);doc.roundedRect(margin,66,W-2*margin,11,1.6,1.6,'F');
      doc.setFontSize(12);doc.setTextColor(255,255,255);
      doc.text('MATERIAL RETURN',margin+4,73.3);
      doc.setFontSize(10);doc.text(number,W-margin-4,73.3,{align:'right'});
      doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(...muted);
      doc.text(`PROJECT CODE  ${record.project_code||'–'}`,margin,84);
      const projectLines=doc.splitTextToSize(`PROJECT  ${record.project_name||'–'}`,110);
      doc.text(projectLines.slice(0,2),82,84);
      doc.text(`DATE  ${record.return_date}`,margin,97);
      doc.text(`GENERATED BY  ${generatedBy}`,82,97);
      doc.setDrawColor(210,225,228);doc.line(margin,100,W-margin,100);
    };
    doc.autoTable({
      startY:104,margin:{left:margin,right:margin,top:104,bottom:22},
      head:[['#','SKU','MATERIAL DESCRIPTION','QTY','UNIT','OK']],
      body:items.map((item,index)=>[
        String(index+1),item.sku_snapshot,item.description_snapshot,
        String(Number(item.quantity)),item.unit_snapshot,''
      ]),
      theme:'grid',
      styles:{font:'helvetica',fontSize:8,cellPadding:2.2,overflow:'linebreak',lineColor:[216,226,233],lineWidth:0.12,textColor:navy,valign:'middle'},
      headStyles:{fillColor:navy,textColor:[255,255,255],fontStyle:'bold',lineColor:navy},
      alternateRowStyles:{fillColor:pale},
      columnStyles:{0:{cellWidth:9},1:{cellWidth:28},3:{cellWidth:17,halign:'right'},4:{cellWidth:16},5:{cellWidth:13,halign:'center'}},
      didDrawCell:data=>{
        if(data.section==='body'&&data.column.index===5){
          doc.setDrawColor(...teal);doc.setLineWidth(0.45);
          doc.rect(data.cell.x+data.cell.width/2-2.4,data.cell.y+data.cell.height/2-2.4,4.8,4.8);
        }
      },
      didDrawPage:drawHeader
    });
    let y=doc.lastAutoTable.finalY+8;
    if(y+53>H-17){doc.addPage();drawHeader();y=111;}
    doc.setFillColor(...pale);doc.roundedRect(margin,y,W-2*margin,8,1.5,1.5,'F');
    doc.setFont('helvetica','bold');doc.setFontSize(8.5);doc.setTextColor(...teal);
    doc.text('OBSERVATIONS',margin+3,y+5.5);
    doc.setDrawColor(184,202,214);doc.setLineWidth(0.25);
    for(let line=1;line<=3;line++)doc.line(margin+2,y+8+line*8,W-margin-2,y+8+line*8);
    doc.setTextColor(...navy);doc.setFontSize(8);doc.setFont('helvetica','normal');
    doc.text('Returned by: ______________________________',margin,y+46);
    doc.text('Received by: ______________________________',W-margin,y+46,{align:'right'});
    const total=doc.internal.getNumberOfPages();
    for(let page=1;page<=total;page++){
      doc.setPage(page);doc.setDrawColor(215,225,231);doc.line(margin,H-14,W-margin,H-14);
      doc.setTextColor(...muted);doc.setFontSize(8);
      doc.text(`${record.project_code||'PROJECT'} · MATERIAL RETURN ${number}`,margin,H-9);
      doc.text(`Page ${page} / ${total}`,W-margin,H-9,{align:'right'});
    }
    const fileName=`${mrFilePart(record.project_code)} - ${mrFilePart(record.project_name)} - MATERIAL RETURN - ${number}.pdf`;
    doc.save(fileName);
    mrStatus('PDF generated');
  }catch(e){console.error(e);mrStatus('Could not generate PDF: '+(e.message||e),true);}
}
