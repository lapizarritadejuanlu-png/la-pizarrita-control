(()=>{
let unlinkAtomicBusy=false;
document.addEventListener('click',async e=>{
  const b=e.target?.closest?.('[data-unlink-document]');if(!b||unlinkAtomicBusy)return;
  e.preventDefault();e.stopImmediatePropagation();
  const id=b.dataset.unlinkDocument,x=(Array.isArray(invoices)?invoices:[]).find(i=>i.id===id);if(!x||x.document_status!=='linked')return;
  const type=x.document_type||'invoice',label=type==='delivery_note'?'albarán':type==='ticket'?'ticket':'documento';
  if(!confirm(`¿Desvincular este ${label} de su factura? ${type==='ticket'?'Volverá a contabilizarse como compra.':'Volverá a quedar pendiente de factura.'}`))return;
  try{
    unlinkAtomicBusy=true;setBusy(true);
    const restored=Number(await api('/rest/v1/rpc/unlink_document_atomic',{method:'POST',body:{p_document_id:id}}))||0;
    toast(type==='ticket'?`Ticket desvinculado${restored?` · ${restored} precios restaurados`:''}`:'Albarán desvinculado · vuelve a pendiente');
    await loadData();
  }catch(err){
    const m=String(err?.message||'error');
    if(/MONTH_LOCKED/i.test(m))toast('🔒 Ese mes está cerrado. Reábrelo antes de desvincular.');
    else toast('No se pudo desvincular: '+m);
  }finally{unlinkAtomicBusy=false;setBusy(false)}
},true);
})();
