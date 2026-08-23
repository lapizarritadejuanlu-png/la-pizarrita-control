(()=>{
function linkedEditingDocument(){
  if(!editingInvoiceId||!Array.isArray(invoices))return null;
  const x=invoices.find(i=>i.id===editingInvoiceId);
  return x?.document_status==='linked'?x:null;
}
function lockLinkedDocumentType(){
  if(route!=='invoices')return;
  const existing=linkedEditingDocument(),select=document.getElementById('invDocType');
  if(!existing||!select)return;
  select.value=existing.document_type||'ticket';
  select.disabled=true;
  const help=select.closest('.field')?.querySelector('.doc-type-help');
  if(help)help.textContent='Este documento ya fue sustituido por una factura. Puedes corregir sus datos, pero no cambiar su tipo.';
}
const previousBindDocumentLock=bind;
bind=function(){previousBindDocumentLock();lockLinkedDocumentType()};

const previousReadDocumentLock=readInvoiceAI;
readInvoiceAI=async function(){
  const existing=linkedEditingDocument();
  const result=await previousReadDocumentLock.apply(this,arguments);
  if(existing){fill('invDocType',existing.document_type||'ticket');lockLinkedDocumentType()}
  return result;
};

const previousSaveDocumentLock=saveInvoice;
saveInvoice=async function(){
  const existing=linkedEditingDocument();
  if(existing)fill('invDocType',existing.document_type||'ticket');
  return previousSaveDocumentLock.apply(this,arguments);
};

if(session)renderApp();
})();
