(()=>{
function dscNum(v){const n=Number(String(v??'').replace(',','.'));return Number.isFinite(n)?n:null}
function dscSuccessMessage(msg=''){
  return /^(Factura|Ticket|Albar[aá]n)\s+(guardad[oa]|actualizad[oa])/i.test(String(msg||''));
}
const previousConfirmedSaveInvoice=saveInvoice;
saveInvoice=async function(){
  const wasEdit=!!editingInvoiceId;
  const snapshot={
    date:v('invDate'),
    supplier:v('invSupplier'),
    number:v('invNumber'),
    base:v('invBase'),
    vat:v('invVat'),
    total:dscNum(v('invTotal')),
    totalRaw:v('invTotal'),
    type:['invoice','ticket','delivery_note'].includes(v('invDocType'))?v('invDocType'):'invoice',
    notes:document.getElementById('invNotes')?.value||''
  };

  // No enseñamos nunca "Factura guardada" hasta comprobar que el registro
  // existe de verdad en Supabase. Las alertas y errores siguen mostrándose.
  const realToast=toast;
  let pendingSuccess='';
  toast=function(msg){
    if(dscSuccessMessage(msg)){pendingSuccess=String(msg||'');return}
    return realToast(msg);
  };

  let result;
  try{
    result=await previousConfirmedSaveInvoice.apply(this,arguments);
  }finally{
    toast=realToast;
  }

  if(wasEdit||!snapshot.date||!snapshot.supplier||snapshot.total===null)return result;
  const savedId=typeof result==='string'?result:null;
  if(!savedId)return result;

  try{
    const rows=await api(`/rest/v1/invoices?id=eq.${encodeURIComponent(savedId)}&select=*`);
    const match=Array.isArray(rows)?rows.find(x=>x.id===savedId&&!x.deleted_at):null;
    if(!match){
      realToast(`⚠ ${snapshot.type==='ticket'?'El ticket':snapshot.type==='delivery_note'?'El albarán':'La factura'} NO se ha podido confirmar en la nube. No la doy por guardada.`);
      return undefined;
    }

    if(!Array.isArray(invoices))invoices=[];
    const pos=invoices.findIndex(x=>x.id===match.id);
    if(pos<0)invoices=[match,...invoices];else invoices[pos]=match;
    if(route==='invoices'||route==='dashboard')renderApp();

    // Solo ahora mostramos el mensaje de éxito.
    realToast(pendingSuccess||`${snapshot.type==='ticket'?'Ticket':snapshot.type==='delivery_note'?'Albarán':'Factura'} guardada en la nube`);
    return savedId;
  }catch(e){
    console.warn('Document save confirmation',e?.message||'unknown');
    realToast(`⚠ No he podido verificar el guardado en la nube. No la doy por guardada.`);
    return undefined;
  }
};
})();
