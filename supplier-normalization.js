(()=>{
function canonicalSupplierName(value=''){
  const raw=String(value||'').trim();
  const key=raw.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ');
  const compact=key.replace(/\s+/g,'');
  if(key.includes('maheso')) return 'Maheso GEDESCO, S.A.';
  if(key.includes('makro')) return 'Makro';
  if(key.includes('transgourmet')||compact.includes('grossmercat')||compact.includes('grosmercat')||compact.includes('gmcash')||compact.includes('grosmercado')) return 'Transgourmet Iberica S.A.U.';
  if(key.includes('assolim')||key.includes('lassolim')||key.includes('asolim')) return 'Assolim foodservices';
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
function loadMakroCompat(){
  if(document.querySelector('script[data-makro-history-compat]'))return;
  const s=document.createElement('script');
  s.src='/makro-history-compat.js?v=1';
  s.dataset.makroHistoryCompat='1';
  document.head.appendChild(s);
}
if(document.readyState==='complete')loadMakroCompat();else window.addEventListener('load',loadMakroCompat,{once:true});
})();