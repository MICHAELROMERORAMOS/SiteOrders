'use strict';

function downloadOrderPDF(){
  if(!_pdfOrder||!_pdfItems)return;
  const{jsPDF}=window.jspdf;
  const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
  const order=_pdfOrder;
  const items=_pdfItems;
  const C_ORANGE=[249,115,22];
  const C_DARK=[20,20,22];
  const C_GRAY=[120,120,140];
  const C_LIGHT=[245,245,250];
  const C_WHITE=[255,255,255];
  const C_BORDER=[210,210,220];
  const pageW=210;
  const M=18;
  const orderId='#'+String(order.id).slice(-8).toUpperCase();

  // ── Header bar ──────────────────────────────────────────
  doc.setFillColor(...C_ORANGE);
  doc.rect(0,0,pageW,24,'F');
  doc.setTextColor(...C_WHITE);
  doc.setFontSize(14);doc.setFont('helvetica','bold');
  doc.text('SiteOrders',M,10);
  doc.setFontSize(8);doc.setFont('helvetica','normal');
  doc.text('Construction Management',M,16);
  doc.setFontSize(11);doc.setFont('helvetica','bold');
  doc.text('MATERIAL REQUEST ORDER',pageW-M,10,{align:'right'});
  doc.setFontSize(9);doc.setFont('helvetica','normal');
  doc.text(orderId,pageW-M,17,{align:'right'});

  let y=32;

  // ── Status pill ─────────────────────────────────────────
  const pillColors={pending:[251,191,36],approved:[74,222,128],rejected:[248,113,113],delivered:[96,165,250]};
  const pc=pillColors[order.status]||C_GRAY;
  doc.setFillColor(...pc);
  doc.roundedRect(M,y-5,32,7,2,2,'F');
  doc.setTextColor(...C_DARK);doc.setFontSize(8);doc.setFont('helvetica','bold');
  doc.text((order.status||'pending').toUpperCase(),M+16,y,{align:'center'});

  // ── Generated date ──────────────────────────────────────
  doc.setTextColor(...C_GRAY);doc.setFontSize(8);doc.setFont('helvetica','normal');
  doc.text('Generated: '+new Date().toLocaleString('en',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}),pageW-M,y,{align:'right'});
  y+=12;

  // ── Info blocks ─────────────────────────────────────────
  const col1=M, col2=M+(pageW-M*2)/2+2;
  function infoBlock(x,yy,label,value){
    doc.setFontSize(7);doc.setFont('helvetica','bold');doc.setTextColor(...C_GRAY);
    doc.text(label,x,yy);
    doc.setFontSize(10);doc.setFont('helvetica','normal');doc.setTextColor(...C_DARK);
    doc.text(String(value||'–'),x,yy+5);
  }
  infoBlock(col1,y,'SITE / PROJECT',order.proyectos?.nombre||'–');
  infoBlock(col2,y,'URGENCY',(order.urgencia||'normal').toUpperCase());
  y+=13;
  infoBlock(col1,y,'REQUESTED BY',order.profiles?.full_name||currentProfile?.full_name||'–');
  if(order.delivery_date)infoBlock(col2,y,'REQUIRED BY',new Date(order.delivery_date).toLocaleDateString('en',{weekday:'short',day:'2-digit',month:'short',year:'numeric'}));
  y+=13;
  if(order.created_at){
    infoBlock(col1,y,'ORDER DATE',new Date(order.created_at).toLocaleDateString('en',{day:'2-digit',month:'short',year:'numeric'}));
    y+=13;
  }
  if(order.notas){
    doc.setFontSize(7);doc.setFont('helvetica','bold');doc.setTextColor(...C_GRAY);
    doc.text('NOTES',col1,y);y+=4;
    doc.setFontSize(9);doc.setFont('helvetica','normal');doc.setTextColor(...C_DARK);
    const lines=doc.splitTextToSize(order.notas,pageW-M*2);
    doc.text(lines,col1,y);y+=lines.length*5+4;
  }
  y+=3;

  // ── Divider ─────────────────────────────────────────────
  doc.setDrawColor(...C_BORDER);doc.setLineWidth(0.3);
  doc.line(M,y,pageW-M,y);y+=7;

  // ── Materials label ──────────────────────────────────────
  doc.setFontSize(8);doc.setFont('helvetica','bold');doc.setTextColor(...C_GRAY);
  doc.text('MATERIALS',M,y);y+=4;

  // ── Materials table ──────────────────────────────────────
  const rows=(items||[]).map(it=>[
    it.materiales?.id_material||'–',
    it.materiales?.nombre||'–',
    `${it.cantidad||''} ${it.materiales?.unidad_medida||''}`.trim(),
    it.notas||''
  ]);
  doc.autoTable({
    startY:y,
    margin:{left:M,right:M},
    head:[['ID','Material','Qty','Notes']],
    body:rows.length?rows:[['–','No items','','']],
    styles:{fontSize:9,cellPadding:3.5,textColor:C_DARK,lineColor:C_BORDER,lineWidth:0.2},
    headStyles:{fillColor:C_DARK,textColor:C_WHITE,fontStyle:'bold',fontSize:8},
    alternateRowStyles:{fillColor:C_LIGHT},
    columnStyles:{0:{cellWidth:30,fontStyle:'bold'},2:{cellWidth:28,halign:'right'},3:{cellWidth:45}}
  });

  // ── Footer bar ───────────────────────────────────────────
  const pH=doc.internal.pageSize.getHeight();
  doc.setFillColor(...C_DARK);
  doc.rect(0,pH-10,pageW,10,'F');
  doc.setFontSize(7);doc.setTextColor(...C_GRAY);
  doc.text('SiteOrders · Construction Management',M,pH-4);
  doc.text(`${orderId} · ${new Date().getFullYear()}`,pageW-M,pH-4,{align:'right'});

  // ── Save ─────────────────────────────────────────────────
  doc.save(`SiteOrders_${orderId}_${new Date().toISOString().slice(0,10)}.pdf`);
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
