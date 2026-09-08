(()=>{
function phNorm(s=''){
  return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
}
function phSort(rows){
  rows.sort((a,b)=>String(b.price_date||'').localeCompare(String(a.price_date||''))||String(b.created_at||'').localeCompare(String(a.created_at||'')));
  return rows;
}
function harmonizeProductHistory(){
  if(!Array.isArray(products)||!products.length)return;
  const groups=new Map();
  for(const p of products){
    const key=phNorm(p?.name);
    if(!key)continue;
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push(p);
  }
  for(const rows of groups.values()){
    phSort(rows);
    const unit=String(rows[0]?.unit||'').trim();
    if(!unit)continue;
    for(const p of rows)p.unit=unit;
  }
}
function previewUnit(meta=''){
  const m=String(meta).match(/€\s*\/\s*([^·]+)/i);
  return m?String(m[1]||'').trim():'';
}
function harmonizePreviewHistory(){
  if(!Array.isArray(products)||!products.length)return;
  const supplier=phNorm(document.getElementById('invSupplier')?.value||'');
  document.querySelectorAll('#aiItemsPreview .ai-item').forEach(row=>{
    const name=phNorm(row.querySelector('.ai-item-name')?.textContent||'');
    const unit=previewUnit(row.querySelector('.ai-item-meta')?.textContent||'');
    if(!name||!unit)return;
    for(const p of products){
      if(phNorm(p?.name)!==name)continue;
      if(supplier&&phNorm(p?.supplier)!==supplier)continue;
      p.unit=unit;
    }
  });
}
const previousProductsViewIdentity=productsView;
productsView=function(){harmonizeProductHistory();return previousProductsViewIdentity.apply(this,arguments)};
const previousDashboardIdentity=dashboard;
dashboard=function(){harmonizeProductHistory();return previousDashboardIdentity.apply(this,arguments)};
const previousReadInvoiceIdentity=readInvoiceAI;
readInvoiceAI=async function(){
  const result=await previousReadInvoiceIdentity.apply(this,arguments);
  harmonizePreviewHistory();
  return result;
};
})();
