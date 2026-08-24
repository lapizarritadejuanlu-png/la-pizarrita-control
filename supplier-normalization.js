(()=>{
function canonicalSupplierName(value=''){
  const raw=String(value||'').trim();
  const key=raw.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ');
  if(key.includes('maheso')) return 'Maheso GEDESCO, S.A.';
  return raw;
}
function normalizeSupplierField(){
  const el=document.getElementById('invSupplier');
  if(!el)return;
  const fixed=canonicalSupplierName(el.value);
  if(fixed&&fixed!==el.value) el.value=fixed;
}
const oldReadSupplier=readInvoiceAI;
readInvoiceAI=async function(){
  const result=await oldReadSupplier.apply(this,arguments);
  normalizeSupplierField();
  return result;
};
const oldSaveSupplier=saveInvoice;
saveInvoice=async function(){
  normalizeSupplierField();
  return oldSaveSupplier.apply(this,arguments);
};
})();
