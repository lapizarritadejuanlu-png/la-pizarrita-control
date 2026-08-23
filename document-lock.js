(()=>{
function editingDocument(){
  if(!editingInvoiceId||!Array.isArray(invoices))return null;
  return invoices.find(i=>i.id===editingInvoiceId)||null;
}
function linkedEditingDocument(){
  const x=editingDocument();
  return x?.document_status==='linked'?x:null;
}
function invoiceWithDependents(){
  const x=editingDocument();
  if(!x||(x.document_type||'invoice')!=='invoice')return null;
  const count=(Array.isArray(invoices)?invoices:[]).filter(i=>i.linked_to_invoice_id===x.id).length;
  return count?{x,count}:null;
}
function lockProtectedDocumentType(){
  if(route!=='invoices')return;
  const linked=linkedEditingDocument(),dependent=invoiceWithDependents(),select=document.getElementById('invDocType');
  if(!select)return;
  const help=select.closest('.field')?.querySelector('.doc-type-help');
  if(linked){
    select.value=linked.document_type||'ticket';
    select.disabled=true;
    if(help)help.textContent='Este documento ya fue sustituido por una factura. Puedes corregir sus datos, pero no cambiar su tipo.';
    return;
  }
  if(dependent){
    select.value='invoice';
    select.disabled=true;
    if(help)help.textContent=`Esta factura sustituye ${dependent.count} documento${dependent.count===1?'':'s'}. Puedes corregir sus datos, pero seguirá siendo factura mientras existan esos vínculos.`;
  }
}
const previousBindDocumentLock=bind;
bind=function(){previousBindDocumentLock();lockProtectedDocumentType()};

const previousReadDocumentLock=readInvoiceAI;
readInvoiceAI=async function(){
  const linked=linkedEditingDocument(),dependent=invoiceWithDependents();
  const result=await previousReadDocumentLock.apply(this,arguments);
  if(linked)fill('invDocType',linked.document_type||'ticket');
  else if(dependent)fill('invDocType','invoice');
  lockProtectedDocumentType();
  return result;
};

const previousSaveDocumentLock=saveInvoice;
saveInvoice=async function(){
  const linked=linkedEditingDocument(),dependent=invoiceWithDependents();
  if(linked)fill('invDocType',linked.document_type||'ticket');
  else if(dependent)fill('invDocType','invoice');
  return previousSaveDocumentLock.apply(this,arguments);
};

if(session)renderApp();
})();
