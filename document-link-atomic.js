(()=>{
window.afterDocumentSaved=async function({invoiceId,docType}){
  if(docType!=='invoice'){
    selectedDocumentLinks.clear();linkSelectionTouched=false;
    try{manualDocumentLinks.clear()}catch{}
    return{linkedCount:0};
  }
  rememberCurrentLinks();
  const ids=[...selectedDocumentLinks];
  if(!ids.length){
    selectedDocumentLinks.clear();linkSelectionTouched=false;
    try{manualDocumentLinks.clear()}catch{}
    return{linkedCount:0};
  }
  try{
    const result=await api('/rest/v1/rpc/link_documents_to_invoice_atomic',{method:'POST',body:{p_invoice_id:invoiceId,p_document_ids:ids}});
    return{linkedCount:Number(result)||ids.length};
  }catch(e){
    console.error('Atomic document link',e?.message||'unknown');
    return{linkedCount:0,linkError:true,linkMessage:e?.message||'No se pudieron vincular los documentos'};
  }finally{
    selectedDocumentLinks.clear();linkSelectionTouched=false;
    try{manualDocumentLinks.clear()}catch{}
  }
};
})();
