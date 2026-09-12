(()=>{
function dupNorm(v=''){
  return String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
}
function dupAmount(v){
  const n=Number(String(v??'').replace(',','.'));
  return Number.isFinite(n)?n:null;
}
function dupType(x){return x?.document_type||'invoice'}
function dupIsActive(x){return x&&!x.deleted_at&&x.document_status!=='linked'}
function findLikelyDuplicate({supplier,date,total,type}){
  if(!supplier||!date||total===null)return null;
  const s=dupNorm(supplier);
  return (Array.isArray(invoices)?invoices:[]).find(x=>{
    if(!dupIsActive(x)||x.id===editingInvoiceId)return false;
    if(dupType(x)!==type)return false;
    if(dupNorm(x.supplier)!==s)return false;
    if(String(x.invoice_date||'')!==String(date))return false;
    return Math.abs((Number(x.total)||0)-total)<=0.01;
  })||null;
}
function dupLabel(type){return type==='ticket'?'ticket':type==='delivery_note'?'albarán':'factura'}

const previousSaveInvoiceDuplicateWarning=saveInvoice;
saveInvoice=async function(){
  // El control fuerte de duplicado por número/archivo sigue funcionando en los
  // wrappers anteriores. Aquí añadimos una alerta adicional para el caso común
  // de la misma compra leída con un número de factura distinto por la IA.
  if(!editingInvoiceId){
    const type=['invoice','ticket','delivery_note'].includes(v('invDocType'))?v('invDocType'):'invoice';
    const supplier=v('invSupplier'),date=v('invDate'),total=dupAmount(v('invTotal'));
    const dup=findLikelyDuplicate({supplier,date,total,type});
    if(dup){
      const number=String(dup.invoice_number||'Sin nº').trim()||'Sin nº';
      const msg=`⚠ POSIBLE DUPLICADO\n\nYa existe ${dupLabel(type)} de ${dup.supplier||supplier} con:\nFecha: ${fmtDate(dup.invoice_date)}\nImporte: ${euro(dup.total)}\nNº: ${number}\n\n¿Quieres guardarlo de todas formas?`;
      if(!window.confirm(msg)){
        toast('No se ha guardado. Revisa el documento que ya existe.');
        return;
      }
    }
  }
  return previousSaveInvoiceDuplicateWarning.apply(this,arguments);
};
})();
