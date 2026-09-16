(()=>{
function dnfNorm(v=''){
  return String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
}
function dnfNumNorm(v=''){return dnfNorm(v).replace(/\s+/g,'')}
function dnfType(x){return x?.document_type||'invoice'}
function dnfMoney(v){const n=Number(String(v??'').replace(',','.'));return Number.isFinite(n)?n:null}

const previousSaveInvoiceNumberFix=saveInvoice;
saveInvoice=async function(){
  if(editingInvoiceId)return previousSaveInvoiceNumberFix.apply(this,arguments);

  const type=v('invDocType')||'invoice';
  const supplier=dnfNorm(v('invSupplier'));
  const number=dnfNumNorm(v('invNumber'));
  const date=v('invDate');
  const total=dnfMoney(v('invTotal'));

  if(!supplier||!number)return previousSaveInvoiceNumberFix.apply(this,arguments);

  const sameNumber=(Array.isArray(invoices)?invoices:[]).filter(x=>
    !x?.deleted_at&&
    dnfType(x)===type&&
    dnfNorm(x.supplier)===supplier&&
    dnfNumNorm(x.invoice_number)===number
  );
  if(!sameNumber.length)return previousSaveInvoiceNumberFix.apply(this,arguments);

  const exact=sameNumber.find(x=>
    String(x.invoice_date||'')===String(date||'')&&
    total!==null&&Math.abs((Number(x.total)||0)-total)<=0.01
  );
  if(exact){
    toast(`Ese ${type==='ticket'?'ticket':type==='delivery_note'?'albarán':'factura'} ya está guardado · ${fmtDate(exact.invoice_date)} · ${euro(exact.total)}`);
    return;
  }

  // Un mismo número aislado no basta para bloquear: la IA puede leer mal un número
  // antiguo. El archivo idéntico sigue protegido por SHA-256 y los duplicados reales
  // por fecha/importe continúan teniendo sus propias comprobaciones.
  const allInvoices=invoices;
  const ignored=new Set(sameNumber.map(x=>x.id));
  const filtered=(Array.isArray(allInvoices)?allInvoices:[]).filter(x=>!ignored.has(x.id));
  invoices=filtered;
  toast('⚠ El nº coincide con una factura antigua, pero fecha o importe son distintos. Se permite guardar; revisa el nº.');
  try{
    const result=await previousSaveInvoiceNumberFix.apply(this,arguments);
    if(invoices===filtered)invoices=allInvoices;
    return result;
  }catch(e){
    if(invoices===filtered)invoices=allInvoices;
    throw e;
  }
};
})();
