(()=>{
function dscNum(v){const n=Number(String(v??'').replace(',','.'));return Number.isFinite(n)?n:null}
function dscNorm(v){return String(v??'').trim().toLowerCase().replace(/\s+/g,' ')}
const previousConfirmedSaveInvoice=saveInvoice;
saveInvoice=async function(){
  const wasEdit=!!editingInvoiceId;
  const snapshot={
    date:v('invDate'),
    supplier:v('invSupplier'),
    number:v('invNumber'),
    total:dscNum(v('invTotal')),
    type:['invoice','ticket','delivery_note'].includes(v('invDocType'))?v('invDocType'):'invoice',
    startedAt:Date.now()
  };
  const result=await previousConfirmedSaveInvoice.apply(this,arguments);
  if(wasEdit||!snapshot.date||!snapshot.supplier||snapshot.total===null)return result;
  try{
    const savedId=typeof result==='string'?result:null;
    let match=savedId&&Array.isArray(invoices)?invoices.find(x=>x.id===savedId&&!x.deleted_at):null;
    if(!match&&savedId){
      const rows=await api(`/rest/v1/invoices?id=eq.${encodeURIComponent(savedId)}&select=*`);
      match=Array.isArray(rows)?rows.find(x=>x.id===savedId&&!x.deleted_at):null;
    }
    if(!match){
      const recent=await api('/rest/v1/invoices?select=*&order=created_at.desc&limit=50');
      const minTime=snapshot.startedAt-300000;
      match=(Array.isArray(recent)?recent:[]).find(x=>{
        const created=Date.parse(x.created_at||'')||0;
        return !x.deleted_at&&created>=minTime&&x.invoice_date===snapshot.date&&(x.document_type||'invoice')===snapshot.type&&dscNorm(x.supplier)===dscNorm(snapshot.supplier)&&Math.abs((Number(x.total)||0)-snapshot.total)<=0.01&&(!snapshot.number||dscNorm(x.invoice_number)===dscNorm(snapshot.number));
      });
    }
    if(!match){
      toast(`⚠ No he podido verificar ${snapshot.type==='ticket'?'el ticket':snapshot.type==='delivery_note'?'el albarán':'la factura'} en la nube. Revisa Documentos antes de volver a guardar.`);
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
