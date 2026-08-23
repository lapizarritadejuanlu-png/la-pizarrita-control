(()=>{
let atomicPendingDocumentLinkIds=null;
function atomicSelectedDocumentLinkIds(){
  return [...new Set([...document.querySelectorAll('[data-doc-link]:checked')].map(x=>String(x.value||'').trim()).filter(Boolean))];
}
document.addEventListener('click',e=>{
  const button=e.target?.closest?.('#saveInvoice');
  if(!button)return;
  atomicPendingDocumentLinkIds=(v('invDocType')||'invoice')==='invoice'?atomicSelectedDocumentLinkIds():[];
},true);
window.afterDocumentSaved=async function({invoiceId,docType}){
  if(docType!=='invoice'){
    atomicPendingDocumentLinkIds=null;
    return{linkedCount:0};
  }
  const ids=Array.isArray(atomicPendingDocumentLinkIds)?atomicPendingDocumentLinkIds:atomicSelectedDocumentLinkIds();
  atomicPendingDocumentLinkIds=null;
  if(!ids.length)return{linkedCount:0};
  try{
    const result=await api('/rest/v1/rpc/link_documents_to_invoice_atomic',{method:'POST',body:{p_invoice_id:invoiceId,p_document_ids:ids}});
    return{linkedCount:Number(result)||ids.length};
  }catch(e){
    console.error('Atomic document link',e?.message||'unknown');
    return{linkedCount:0,linkError:true,linkMessage:e?.message||'No se pudieron vincular los documentos'};
  }
};
})();
