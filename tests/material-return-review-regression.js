'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const elements=new Map();
function element(id){
  if(!elements.has(id))elements.set(id,{
    style:{display:''},classList:{add(){},remove(){}},value:'',disabled:false,
    innerHTML:'',textContent:'',add(){},title:''
  });
  return elements.get(id);
}
const pdfButton=element('pdf');
const storage=new Map();
const confirmations=[];
const calls=[];
const draft={id:'return-1',created_by:'worker-1',project_id:2,project_code:'C25_16',
  project_name:'MOXY HOTEL',project_sequence:null,status:'draft',return_date:'2026-09-24',updated_at:'2026-09-24T00:00:00Z'};
const material={id:7,id_material:'SKU-7',nombre:'Copper pipe',descripcion:'Copper pipe',unidad_medida:'m'};

const context={
  console,window:{},currentUser:{id:'worker-1',email:'worker@example.com'},
  currentProfile:{role:'encargado',status:'activo',full_name:'Worker'},
  allProjects:[{id:2,codigo:'C25_16',nombre:'MOXY HOTEL'}],allMaterials:[material],
  document:{getElementById:element,querySelectorAll:()=>[pdfButton]},
  localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},
  Option:function(label,value){this.label=label;this.value=value},
  confirm:()=>confirmations.shift(),setTimeout:()=>1,clearTimeout:()=>{},
  sb:{
    from:()=>({select:()=>({order:()=>({limit:async()=>({data:[],error:null})})})}),
    rpc:async(name)=>{
      calls.push(name);
      if(name==='save_material_return')return {data:{...draft},error:null};
      if(name==='submit_material_return')return {data:{...draft,status:'submitted',project_sequence:1},error:null};
      if(name==='reopen_material_return')return {data:{...draft,status:'draft',project_sequence:1},error:null};
      throw Error(`Unexpected RPC: ${name}`);
    }
  }
};
vm.createContext(context);
vm.runInContext(fs.readFileSync('js/material-returns.js','utf8'),context,{filename:'material-returns.js'});
vm.runInContext('mrState.current='+JSON.stringify(draft)+';mrState.items=[{material_id:7,quantity:2,sku_snapshot:"SKU-7",description_snapshot:"Copper pipe",unit_snapshot:"m"}]',context);

async function run(){
  context.renderMaterialReturnEditor();
  assert.equal(element('return-save-action').style.display,'');
  assert.equal(pdfButton.style.display,'none');

  confirmations.push(false);
  context.removeReturnMaterial(0);
  assert.equal(vm.runInContext('mrState.items.length',context),1,'cancelled removal keeps the line');

  confirmations.push(true);
  context.removeReturnMaterial(0);
  assert.equal(vm.runInContext('mrState.items.length',context),0,'confirmed removal deletes one line');
  context.addReturnMaterial(7);

  confirmations.push(false);
  await context.submitMaterialReturn();
  assert.equal(calls.length,0,'cancelled submission does not write');

  confirmations.push(true);
  await context.submitMaterialReturn();
  assert.deepEqual(calls,['save_material_return','submit_material_return']);
  assert.equal(vm.runInContext('mrState.current.status',context),'submitted');
  assert.equal(element('return-submit-action').style.display,'none');
  assert.equal(pdfButton.style.display,'');
  assert.equal(element('return-date').disabled,true);
  assert.equal(element('return-material-search').disabled,true);
  assert(!element('return-items').innerHTML.includes('removeReturnMaterial('),'submitted lines are read only');
  context.addReturnMaterial(7);
  assert.equal(vm.runInContext('mrState.items[0].quantity',context),1,'a submitted line cannot be changed');

  await context.reopenMaterialReturn();
  assert.equal(calls.length,2,'worker cannot reopen a return');
  context.currentProfile={role:'admin',status:'activo',full_name:'Admin'};
  confirmations.push(false);
  await context.reopenMaterialReturn();
  assert.equal(calls.length,2,'cancelled reopening does not write');
  confirmations.push(true);
  await context.reopenMaterialReturn();
  assert.equal(calls.at(-1),'reopen_material_return');
  assert.equal(vm.runInContext('mrState.current.project_sequence',context),1);
  assert.equal(element('return-date').disabled,false);
  assert.equal(element('return-project').disabled,true,'numbered project remains fixed');
  console.log('Material Return review controls and confirmations passed.');
}

run().catch(error=>{console.error(error);process.exitCode=1});
