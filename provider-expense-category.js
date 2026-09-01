(()=>{
const VALUE='proveedores';

function openProviderInvoiceAI(){
  if(typeof route!=='undefined')route='invoices';
  if(typeof renderApp==='function')renderApp();
  window.scrollTo(0,0);
}

function ensureSupplierFlow(){
  const select=document.getElementById('expenseCategory');
  if(!select)return;

  const providerOption=[...select.options].find(o=>o.value===VALUE);
  if(providerOption){
    const wasSelected=select.value===VALUE;
    providerOption.remove();
    if(wasSelected)select.value=select.options[0]?.value||'luz';
  }

  const card=select.closest('.card');
  const grid=card?.querySelector('.expense-grid');
  if(!card||!grid||document.getElementById('providerInvoiceShortcut'))return;

  const box=document.createElement('div');
  box.id='providerInvoiceShortcut';
  box.style.cssText='margin:0 0 16px;padding:14px;border:1px solid #4b4636;border-radius:14px;background:#15140f';
  box.innerHTML='<div style="font-weight:900;margin-bottom:6px">📦 Facturas de proveedores</div><div style="color:var(--muted);font-size:.84rem;line-height:1.4;margin-bottom:10px">Las compras a proveedores se registran como factura para que la IA lea proveedor, fecha, importes y productos. Así pasan automáticamente a Compras, Proveedores y Productos sin duplicar el gasto.</div><button id="providerInvoiceAI" type="button" class="ai-btn" style="margin:0">✨ Leer factura de proveedor con IA</button>';
  grid.parentNode.insertBefore(box,grid);
  document.getElementById('providerInvoiceAI')?.addEventListener('click',openProviderInvoiceAI);
}

let queued=false;
const observer=new MutationObserver(()=>{
  if(queued)return;
  queued=true;
  requestAnimationFrame(()=>{queued=false;ensureSupplierFlow()});
});
observer.observe(document.documentElement,{childList:true,subtree:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensureSupplierFlow,{once:true});
ensureSupplierFlow();
})();
