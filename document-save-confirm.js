(()=>{
function dscNum(v){const n=Number(String(v??'').replace(',','.'));return Number.isFinite(n)?n:null}
const previousConfirmedSaveInvoice=saveInvoice;
saveInvoice=async function(){
  const wasEdit=!!editingInvoiceId;
  const snapshot={
    date:v('invDate'),
    supplier:v('invSupplier'),
    total:dscNum(v('invTotal')),
    type:['invoice','ticket','delivery_note'].includes(v('invDocType'))?v('invDocType'):'invoice'
  };
  const result=await previousConfirmedSaveInvoice.apply(this,arguments);
  if(wasEdit||!snapshot.date||!snapshot.supplier||snapshot.total===null)return result;

  // The real save routine returns the cloud document id only when the save
  // completed successfully. If it returned nothing, it already showed the
  // useful reason (duplicate, upload error, session error, etc.). Do not
  // overwrite that message with a misleading verification warning.
  const savedId=typeof result==='string'?result:null;
  if(!savedId)return result;

  try{
    let match=Array.isArray(invoices)?invoices.find(x=>x.id===savedId&&!x.deleted_at):null;
    if(!match){
      const rows=await api(`/rest/v1/invoices?id=eq.${encodeURIComponent(savedId)}&select=*`);
      match=Array.isArray(rows)?rows.find(x=>x.id===savedId&&!x.deleted_at):null;
    }
    if(!match){
      toast(`⚠ ${snapshot.type==='ticket'?'El ticket':snapshot.type==='delivery_note'?'El albarán':'La factura'} se guardó, pero no he podido refrescarla en pantalla. Pulsa Nube para sincronizar.`);
      return result;
    }
    if(!Array.isArray(invoices))invoices=[];
    const pos=invoices.findIndex(x=>x.id===match.id);
    if(pos<0)invoices=[match,...invoices];else invoices[pos]=match;
    if(route==='invoices'||route==='dashboard')renderApp();
  }catch(e){
    console.warn('Document save confirmation',e?.message||'unknown');
  }
  return result;
};
})();
