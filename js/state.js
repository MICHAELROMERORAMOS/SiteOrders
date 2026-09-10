'use strict';
const { createClient } = supabase;
let sb, currentUser=null, currentProfile=null;
let _pdfOrder=null, _pdfItems=null;
let allMaterials=[], allOrders=[], allProjects=[], allUsers=[], allCategories=[], allUnits=[];
let orderItems=[], editingMaterialId=null, editingProjectId=null, currentUserTab='pending', currentPage='dashboard';
let selectedMaterialImageUrl='', storedImageLibrary=[], shareImageSourceMaterial=null, selectedShareMaterialIds=new Set();
let catalogPage=1, adminMatPage=1, newOrderMatPage=1;
const PAGE_SIZE=10;
const ORDER_DRAFT_VERSION=1;

const DEFAULT_UNITS=['kg','ton','g','mts','m²','m³','unit','bag','liter','roll','box','pair','set','sheet','pcs','load','drum','pallet'];
