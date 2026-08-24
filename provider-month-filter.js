(()=>{
function providerMonthCount(row){
  const text=row.querySelector('.row-meta')?.textContent||'';
  const m=text.match(/^\s*(\d+)\s+(?:factura|facturas|compra|compras)/i);
  return m?Number(m[1])||0:0;
}
function applyProviderMonthOnly(){
  if(typeof route!=='undefined'&&route!=='providers')return;
  const rows=[...document.querySelectorAll('.provider-smart-row')];
  if(!rows.length)return;
  const input=document.getElementById('providerSearch');
  const q=(input?.value||'').trim().toLowerCase();
  let count=0,total=0;
  for(const row of rows){
    const hasPurchases=providerMonthCount(row)>0;
    const matches=!q||(row.dataset.search||'').includes(q);
    const show=hasPurchases&&matches;
    row.style.display=show?'flex':'none';
    if(show){count++;total+=Number(row.dataset.monthTotal)||0}
  }
  const c=document.getElementById('providerVisibleCount');
  const t=document.getElementById('providerVisibleTotal');
  const e=document.getElementById('providerNoResults');
  if(c)c.textContent=`${count} proveedor${count===1?'':'es'}`;
  if(t)t.textContent=`Mes: ${euro(total)}`;
  if(e){e.textContent='No hay proveedores con compras en este mes.';e.style.display=count?'none':'block'}
}
const previousBindProviderMonth=bind;
bind=function(){
  previousBindProviderMonth();
  applyProviderMonthOnly();
  document.getElementById('providerSearch')?.addEventListener('input',applyProviderMonthOnly);
};
if(session)renderApp();
})();
