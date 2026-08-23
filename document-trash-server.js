(()=>{
deleteInvoice=async function(id){
  const x=(Array.isArray(invoices)?invoices:[]).find(i=>i.id===id);if(!x)return;
  const month=String(x.invoice_date||'').slice(0,7);
  if(typeof window.isAccountingMonthLocked==='function'&&window.isAccountingMonthLocked(month)){toast('🔒 Ese mes está cerrado. Reábrelo antes de enviar el documento a Papelera.');return}
  if(x.document_status==='linked'){toast('Primero desvincula este documento de su factura.');return}
  const dependents=(Array.isArray(invoices)?invoices:[]).filter(i=>i.linked_to_invoice_id===id);
  const type=(x.document_type||'invoice')==='ticket'?'ticket':(x.document_type||'invoice')==='delivery_note'?'albarán':'factura';
  const extra=dependents.length?`\n\nLos ${dependents.length} ticket/albarán vinculados volverán a quedar activos y sus precios se restaurarán automáticamente.`:'';
  if(!confirm(`¿Mover esta ${type} de ${x.supplier} por ${euro(x.total)} a Papelera?${extra}`))return;
  try{
    setBusy(true);
    await api('/rest/v1/rpc/trash_document',{method:'POST',body:{p_document_id:id}});
    if(editingInvoiceId===id){editingInvoiceId=null;editingFilePath=null}
    toast('Documento movido a Papelera');
    await loadData();
  }catch(e){
    const m=String(e?.message||'');
    if(/MONTH_LOCKED/i.test(m))toast('🔒 Ese mes está cerrado. Reábrelo antes de mover documentos.');
    else toast('No se pudo mover a Papelera: '+m);
  }finally{setBusy(false)}
};
})();
