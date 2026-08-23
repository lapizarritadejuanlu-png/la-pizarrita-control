(()=>{
let activeDocumentFileHash=null;

async function sha256File(file){
  const buf=await file.arrayBuffer(),digest=await crypto.subtle.digest('SHA-256',buf),bytes=new Uint8Array(digest);
  return [...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');
}
async function duplicateFile(hash,excludeId){
  const rows=await api(`/rest/v1/invoices?file_sha256=eq.${encodeURIComponent(hash)}&select=id,supplier,invoice_number,invoice_date,total,document_type`);
  return (Array.isArray(rows)?rows:[]).find(x=>x.id!==excludeId)||null;
}
function fileDocLabel(x){return (x?.document_type||'invoice')==='ticket'?'ticket':(x?.document_type||'invoice')==='delivery_note'?'albarán':'factura'}

// Inject the fingerprint into the same INSERT/PATCH that saves the document.
// This lets the database unique index reject an exact duplicate atomically.
const previousApiFileDedup=api;
api=async function(path,options={}){
  const method=String(options?.method||'GET').toUpperCase();
  if(activeDocumentFileHash&&path.startsWith('/rest/v1/invoices')&&(method==='POST'||method==='PATCH')&&options?.body?.file_path){
    options={...options,body:{...options.body,file_sha256:activeDocumentFileHash}};
  }
  return previousApiFileDedup(path,options);
};

const previousSaveInvoiceFileDedup=saveInvoice;
saveInvoice=async function(){
  const file=document.getElementById('invFile')?.files?.[0];
  if(!file)return previousSaveInvoiceFileDedup.apply(this,arguments);
  const editId=editingInvoiceId||null;
  let hash=null;
  try{
    hash=await sha256File(file);
    const dup=await duplicateFile(hash,editId);
    if(dup){toast(`Este mismo archivo ya está guardado como ${fileDocLabel(dup)} · ${dup.supplier||''} · ${fmtDate(dup.invoice_date)}`);return}
  }catch(e){
    console.warn('Document fingerprint precheck',e?.message||'unknown');
    hash=null;
  }

  activeDocumentFileHash=hash;
  try{
    return await previousSaveInvoiceFileDedup.apply(this,arguments);
  }catch(e){
    const msg=String(e?.message||'');
    if(/invoices_user_file_sha256_unique|duplicate key|23505/i.test(msg)){
      toast('Este mismo archivo ya está guardado. No se ha creado un duplicado.');
      return;
    }
    throw e;
  }finally{
    activeDocumentFileHash=null;
  }
};
})();
