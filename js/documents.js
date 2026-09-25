'use strict';

async function loadCompanyBrandingForPDF(){
  const fallback={companyName:'Smart Effects Limited',logoData:null};
  try{
    const {data,error}=await sb.from('material_return_branding')
      .select('company_name,logo_path')
      .eq('id',1)
      .single();
    if(error||!data)return fallback;

    const result={companyName:data.company_name||fallback.companyName,logoData:null};
    if(!data.logo_path)return result;

    const download=await sb.storage.from('material-return-branding').download(data.logo_path);
    if(download.error||!download.data)return result;

    result.logoData=await new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onload=()=>resolve(reader.result);
      reader.onerror=reject;
      reader.readAsDataURL(download.data);
    });
    return result;
  }catch(error){
    console.warn('Company branding unavailable for PDF',error);
    return fallback;
  }
}

async function downloadOrderPDF(){
  if(!_pdfOrder||!_pdfItems)return;
  const branding=await loadCompanyBrandingForPDF();
  const{jsPDF}=window.jspdf;
  const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
  const order=_pdfOrder;
  const items=_pdfItems;

  // Material Request identity: green. Status remains workflow-dependent.
  const C_GREEN=[31,122,84];
  const C_DARK_GREEN=[22,78,57];
  const C_DARK=[20,20,22];
  const C_GRAY=[104,112,122];
  const C_LIGHT=[244,249,246];
  const C_WHITE=[255,255,255];
  const C_BORDER=[205,220,212];
  const pageW=210;
  const M=14;
  const orderId='#'+String(order.id).slice(-8).toUpperCase();
  const documentRef=order.document_name||order.order_number||orderId;

  // ── Compact branded header ───────────────────────────────
  doc.setFillColor(...C_GREEN);
  doc.rect(0,0,pageW,3,'F');

  let logoRight=M;
  let logoBottom=8;
  if(branding.logoData){
    try{
      const props=doc.getImageProperties(branding.logoData);
      // Three times the previous 38 x 17 mm maximum.
      const scale=Math.min(114/props.width,51/props.height);
      const logoW=props.width*scale;
      const logoH=props.height*scale;
      const logoY=5;
      doc.addImage(branding.logoData,'PNG',M,logoY,logoW,logoH);
      logoRight=M+logoW;
      logoBottom=logoY+logoH;
    }catch(error){
      console.warn('Logo could not be rendered in Material Request PDF',error);
    }
  }

  // Keep text close to the logo while preserving the large brand mark.
  const rightX=pageW-M;
  const textLeft=Math.min(Math.max(logoRight+2,118),rightX-46);
  doc.setFont('helvetica','bold');
  doc.setTextColor(...C_DARK_GREEN);
  doc.setFontSize(10);
  const companyLines=doc.splitTextToSize(branding.companyName||'Smart Effects Limited',rightX-textLeft).slice(0,2);
  doc.text(companyLines,rightX,10,{align:'right'});

  doc.setFontSize(12);
  doc.text('MATERIAL REQUEST',rightX,22,{align:'right'});

  // Make the request/document number immediately identifiable.
  doc.setFont('helvetica','bold');
  doc.setFontSize(10.8);
  doc.setTextColor(...C_DARK_GREEN);
  const refLines=doc.splitTextToSize(String(documentRef),82).slice(0,2);
  doc.text(refLines,rightX,29,{align:'right'});

  doc.setFont('helvetica','normal');
  doc.setFontSize(6.8);
  doc.setTextColor(...C_GRAY);
  doc.text('Construction Management',rightX,40,{align:'right'});

  const headerBottom=Math.max(44,logoBottom+2);
  doc.setDrawColor(...C_BORDER);
  doc.setLineWidth(0.25);
  doc.line(M,headerBottom,pageW-M,headerBottom);

  let y=headerBottom+7;

  // ── Status pill: color depends on workflow state ─────────
  const pillColors={
    pending:[251,191,36],
    approved:[74,222,128],
    awaiting_receipt:[96,165,250],
    partial:[251,191,36],
    completed:[74,222,128],
    rejected:[248,113,113],
    delivered:[96,165,250]
  };
  const pc=pillColors[order.status]||C_GRAY;
  doc.setFillColor(...pc);
  doc.roundedRect(M,y-4.6,36,6.5,1.8,1.8,'F');
  doc.setTextColor(...C_DARK);
  doc.setFontSize(7.2);
  doc.setFont('helvetica','bold');
  doc.text((order.status||'pending').replaceAll('_',' ').toUpperCase(),M+18,y-0.1,{align:'center'});

  doc.setTextColor(...C_GRAY);
  doc.setFontSize(7.2);
  doc.setFont('helvetica','normal');
  doc.text(
    'Generated: '+new Date().toLocaleString('en',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}),
    pageW-M,y,{align:'right'}
  );
  y+=9;

  // ── Compact info blocks ──────────────────────────────────
  const col1=M, col2=M+(pageW-M*2)/2+2;
  function infoBlock(x,yy,label,value){
    doc.setFontSize(6.5);doc.setFont('helvetica','bold');doc.setTextColor(...C_GRAY);
    doc.text(label,x,yy);
    doc.setFontSize(8.8);doc.setFont('helvetica','normal');doc.setTextColor(...C_DARK);
    doc.text(String(value||'–'),x,yy+3.8);
  }

  infoBlock(col1,y,'SITE / PROJECT',order.project_name_snapshot||order.proyectos?.nombre||'–');
  infoBlock(col2,y,'URGENCY',(order.urgencia||'normal').toUpperCase());
  y+=9.5;

  infoBlock(col1,y,'REQUESTED BY',order.requested_by_name||order.profiles?.full_name||currentProfile?.full_name||'–');
  if(order.delivery_date){
    infoBlock(col2,y,'REQUIRED BY',new Date(order.delivery_date+'T00:00:00').toLocaleDateString('en',{weekday:'short',day:'2-digit',month:'short',year:'numeric'}));
  }
  y+=9.5;

  if(order.created_at){
    infoBlock(col1,y,'ORDER DATE',new Date(order.created_at).toLocaleDateString('en',{day:'2-digit',month:'short',year:'numeric'}));

    doc.setFontSize(6.5);doc.setFont('helvetica','bold');doc.setTextColor(...C_GRAY);
    doc.text('ORDER NO.',col2,y);
    doc.setFontSize(10.4);doc.setFont('helvetica','bold');doc.setTextColor(...C_DARK_GREEN);
    doc.text(String(order.order_number||documentRef||orderId),col2,y+4.2);

    y+=9.5;
  }

  if(order.notas){
    doc.setFontSize(6.5);doc.setFont('helvetica','bold');doc.setTextColor(...C_GRAY);
    doc.text('NOTES',col1,y);y+=3.2;
    doc.setFontSize(8);doc.setFont('helvetica','normal');doc.setTextColor(...C_DARK);
    const lines=doc.splitTextToSize(order.notas,pageW-M*2);
    doc.text(lines,col1,y);
    y+=lines.length*3.8+2;
  }

  doc.setDrawColor(...C_BORDER);
  doc.setLineWidth(0.25);
  doc.line(M,y,pageW-M,y);
  y+=4.5;

  doc.setFontSize(7.2);
  doc.setFont('helvetica','bold');
  doc.setTextColor(...C_DARK_GREEN);
  doc.text('MATERIALS',M,y);
  y+=2.8;

  // ── Dense materials table ────────────────────────────────
  const rows=(items||[]).map(it=>[
    it.material_code_snapshot||it.materiales?.id_material||'–',
    it.material_name_snapshot||it.materiales?.nombre||'–',
    `${it.cantidad||''} ${it.unit_snapshot||it.materiales?.unidad_medida||''}`.trim(),
    it.observation||it.notas||''
  ]);

  doc.autoTable({
    startY:y,
    margin:{left:M,right:M,bottom:15},
    head:[['ID','Material','Qty','Notes']],
    body:rows.length?rows:[['–','No items','','']],
    styles:{
      fontSize:8,
      cellPadding:{top:1.25,right:1.6,bottom:1.25,left:1.6},
      textColor:C_DARK,
      lineColor:C_BORDER,
      lineWidth:0.15,
      minCellHeight:0
    },
    headStyles:{
      fillColor:C_DARK_GREEN,
      textColor:C_WHITE,
      fontStyle:'bold',
      fontSize:7.4,
      cellPadding:{top:1.45,right:1.6,bottom:1.45,left:1.6}
    },
    alternateRowStyles:{fillColor:C_LIGHT},
    columnStyles:{
      0:{cellWidth:27,fontStyle:'bold'},
      2:{cellWidth:25,halign:'right'},
      3:{cellWidth:42}
    },
    didParseCell:data=>{
      if(data.section!=='body'||data.column.index!==0)return;
      const item=items?.[data.row.index];
      if(item?.materiales?.imagen_url){
        data.cell.styles.textColor=C_GREEN;
        data.cell.styles.fontStyle='bold';
      }
    },
    didDrawCell:data=>{
      if(data.section!=='body'||data.column.index!==0)return;
      const item=items?.[data.row.index];
      const imageUrl=item?.materiales?.imagen_url;
      if(!imageUrl)return;

      // Make the SKU itself the clickable link to the material image.
      doc.link(data.cell.x,data.cell.y,data.cell.width,data.cell.height,{url:imageUrl});

      const sku=String(
        item.material_code_snapshot||
        item.materiales?.id_material||
        ''
      );
      if(sku){
        const padLeft=1.6;
        const maxWidth=Math.max(0,data.cell.width-padLeft*2);
        const underlineWidth=Math.min(doc.getTextWidth(sku),maxWidth);
        const underlineY=data.cell.y+data.cell.height-1.15;
        doc.setDrawColor(...C_GREEN);
        doc.setLineWidth(0.15);
        doc.line(data.cell.x+padLeft,underlineY,data.cell.x+padLeft+underlineWidth,underlineY);
      }
    }
  });

  // ── Footer on all pages ─────────────────────────────────
  const total=doc.internal.getNumberOfPages();
  for(let page=1;page<=total;page++){
    doc.setPage(page);
    const pH=doc.internal.pageSize.getHeight();
    doc.setFillColor(...C_DARK_GREEN);
    doc.rect(0,pH-8,pageW,8,'F');
    doc.setFontSize(6.6);doc.setTextColor(215,232,223);
    doc.text(`${branding.companyName||'Smart Effects Limited'} · SiteOrders`,M,pH-3.1);
    doc.text(`${order.order_number||orderId} · Page ${page}/${total}`,pageW-M,pH-3.1,{align:'right'});
  }

  const fileName=sanitizeDocumentFileName(order.document_name||`MATERIAL REQUEST - ${order.order_number||orderId}`)+'.pdf';
  doc.save(fileName);
}

async function downloadOrderExcel(){
  if(!_pdfOrder||!_pdfItems){
    alert('Order information is not loaded.');
    return;
  }

  try{
    const response=await fetch('./assets/templates/material-request-template.xlsx');
    if(!response.ok)throw new Error('The Excel template could not be loaded.');

    const templateBuffer=await response.arrayBuffer();
    const workbook=new ExcelJS.Workbook();
    await workbook.xlsx.load(templateBuffer);

    const sheet=workbook.getWorksheet('MATERIAL REQUEST');
    if(!sheet)throw new Error('Worksheet "MATERIAL REQUEST" was not found.');

    const order=_pdfOrder;
    const items=_pdfItems||[];
    const projectCode=order.proyectos?.codigo||'';
    const projectName=order.proyectos?.nombre||'';
    const requestNumber=order.request_number||createMaterialRequestNumber(order);
    const requesterName=order.profiles?.full_name||currentProfile?.full_name||'';

    sheet.getCell('J2').value=`ORDER NO: ${requestNumber}`;
    sheet.getCell('J3').value=`${projectCode} ${projectName}`.trim();
    sheet.getCell('J4').value=`DATE: ${formatMaterialRequestDate(order.created_at||new Date())}`;

    // The supplied template has 21 prepared material rows (6–26).
    // Extra items are written below with copied formatting; the signature is moved down.
    const firstItemRow=6;
    const originalLastItemRow=26;
    const originalCapacity=originalLastItemRow-firstItemRow+1;
    let signatureRow=28;

    if(items.length>originalCapacity){
      const extra=items.length-originalCapacity;
      sheet.spliceRows(27,0,...Array.from({length:extra},()=>[]));
      for(let i=0;i<extra;i++)copyExcelRowStyle(sheet,26,27+i);
      signatureRow+=extra;
    }

    const lastClearRow=Math.max(originalLastItemRow,firstItemRow+items.length-1);
    for(let row=firstItemRow;row<=lastClearRow;row++){
      for(const col of ['C','D','E','F','G','H','I','J'])sheet.getCell(`${col}${row}`).value=null;
    }

    items.forEach((item,index)=>{
      const row=firstItemRow+index;
      const material=item.materiales||{};
      sheet.getCell(`C${row}`).value=index+1;
      sheet.getCell(`D${row}`).value=material.nombre||'';
      sheet.getCell(`E${row}`).value=order.delivery_date?new Date(`${order.delivery_date}T00:00:00`):null;
      if(order.delivery_date)sheet.getCell(`E${row}`).numFmt='dd-mmm-yyyy';
      sheet.getCell(`F${row}`).value=item.supplier||material.default_supplier||'';
      sheet.getCell(`G${row}`).value=Number(item.cantidad)||0;
      sheet.getCell(`H${row}`).value=material.unidad_medida||'';
      sheet.getCell(`I${row}`).value=item.qty_delivered??'';
      sheet.getCell(`J${row}`).value=item.observation||item.notas||'';
    });

    // Preserve the template's signature formatting and update only the text.
    sheet.getCell(`D${signatureRow}`).value=currentProfile?.job_title||'Projects Engineer / Supervisor';
    sheet.getCell(`E${signatureRow}`).value=requesterName;

    workbook.creator=requesterName||'SiteOrders';
    workbook.modified=new Date();

    const buffer=await workbook.xlsx.writeBuffer();
    const blob=new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    const safeProject=sanitizeDocumentFileName(projectCode||projectName||'PROJECT');
    saveAs(blob,`MATERIAL REQUEST - ${safeProject} - ${requestNumber}.xlsx`);
  }catch(error){
    console.error(error);
    alert(`Excel generation error: ${error.message}`);
  }
}

function copyExcelRowStyle(sheet,sourceRowNumber,targetRowNumber){
  const source=sheet.getRow(sourceRowNumber);
  const target=sheet.getRow(targetRowNumber);
  target.height=source.height;
  source.eachCell({includeEmpty:true},(cell,colNumber)=>{
    const targetCell=target.getCell(colNumber);
    targetCell.style=JSON.parse(JSON.stringify(cell.style||{}));
    targetCell.numFmt=cell.numFmt;
    targetCell.alignment=cell.alignment?JSON.parse(JSON.stringify(cell.alignment)):undefined;
    targetCell.border=cell.border?JSON.parse(JSON.stringify(cell.border)):undefined;
    targetCell.fill=cell.fill?JSON.parse(JSON.stringify(cell.fill)):undefined;
    targetCell.font=cell.font?JSON.parse(JSON.stringify(cell.font)):undefined;
    targetCell.protection=cell.protection?JSON.parse(JSON.stringify(cell.protection)):undefined;
  });
}

function createMaterialRequestNumber(order){
  const raw=String(order?.id??'').replace(/\D/g,'');
  return `SE-MR-${(raw||'0').slice(-4).padStart(4,'0')}`;
}

function formatMaterialRequestDate(value){
  const date=new Date(value);
  if(Number.isNaN(date.getTime()))return '';
  return date.toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'}).replace(/ /g,'-');
}

function sanitizeDocumentFileName(value){
  return String(value??'')
    .trim()
    .replace(/[<>:"/\\|?*]/g,'-')
    .replace(/\s+/g,' ');
}
