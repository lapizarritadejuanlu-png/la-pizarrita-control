(()=>{
function archiveDocType(x){return x?.document_type||'invoice'}
function archiveDocLabel(x){return archiveDocType(x)==='delivery_note'?'albarán':archiveDocType(x)==='ticket'?'ticket':'documento'}
async function restoreUnlinkedTicketPrices(x){
  if(archiveDocType(x)!=='ticket')return 0;
  const items=Array.isArray(x?.extraction_json?.items)?x.extraction_json.items:[];
  const rows=items.filter(i=>i?.unit_price!==null&&i?.unit_price!==undefined&&Number.isFinite(Number(i.unit_price))&&Number(i.unit_price)>0).map(i=>({user_id:session.user.id,name:String(i.description||'').trim(),supplier:x.supplier,price_date:x.invoice_date,price:Number(i.unit_price),unit:i.unit||'sin especificar',net_cost:null,source_invoice_id:x.id})).filter(i=>i.name);
  await api(`/rest/v1/products?source_invoice_id=eq.${encodeURIComponent(x.id)}`,{method:'DELETE'}).catch(()=>{});
  if(rows.length)await api('/rest/v1/products',{method:'POST',headers:{Prefer:'return=minimal'},body:rows});
  return rows.length;
}
async function unlinkArchivedDocument(id){
  const x=(Array.isArray(invoices)?invoices:[]).find(i=>i.id===id);if(!x||x.document_status!=='linked')return;
  if(!confirm(`¿Desvincular este ${archiveDocLabel(x)} de su factura? ${archiveDocType(x)==='ticket'?'Volverá a contabilizarse como compra.':'Volverá a quedar pendiente de factura.'}`))return;
  try{
    setBusy(true);
    const status=archiveDocType(x)==='delivery_note'?'pending':'final';
    await api(`/rest/v1/invoices?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:{document_status:status,linked_to_invoice_id:null}});
    let restored=0;try{restored=await restoreUnlinkedTicketPrices(x)}catch(e){console.error('Restore unlinked prices',e?.message||'unknown')}
    toast(archiveDocType(x)==='ticket'?`Ticket desvinculado${restored?` · ${restored} precios restaurados`:''}`:'Albarán desvinculado · vuelve a pendiente');
    await loadData();
  }catch(e){toast('No se pudo desvincular: '+(e?.message||'error'))}finally{setBusy(false)}
}

const previousInvoiceRowArchive=invoiceRow;
invoiceRow=function(x,actions=false){
  let html=previousInvoiceRowArchive(x,actions);if(!actions||x?.document_status!=='linked')return html;
  return html.replace(/<button type="button" class="secondary danger invoice-delete" data-invoice-id="[^"]+">🗑 Borrar<\/button>/,`<button type="button" class="secondary" data-unlink-document="${esc(x.id)}">↩ Desvincular</button>`);
};

const previousBindArchive=bind;
bind=function(){
  previousBindArchive();
  document.querySelectorAll('[data-unlink-document]').forEach(b=>b.addEventListener('click',()=>unlinkArchivedDocument(b.dataset.unlinkDocument)));
};

if(session)renderApp();
})();
