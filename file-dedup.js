(()=>{
async function sha256File(file){
  const buf=await file.arrayBuffer(),digest=await crypto.subtle.digest('SHA-256',buf),bytes=new Uint8Array(digest);
  return [...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');
}
async function duplicateFile(hash,excludeId){
  const rows=await api(`/rest/v1/invoices?file_sha256=eq.${encodeURIComponent(hash)}&select=id,supplier,invoice_number,invoice_date,total,document_type`);
  return (Array.isArray(rows)?rows:[]).find(x=>x.id!==excludeId)||null;
}
function fileDocLabel(x){return (x?.document_type||'invoice')==='ticket'?'ticket':(x?.document_type||'invoice')==='delivery_note'?'albarán':'factura'}

const previousSaveInvoiceFileDedup=saveInvoice;
saveInvoice=async function(){
  const file=document.getElementById('invFile')?.files?.[0];
  if(!file)return previousSaveInvoiceFileDedup.apply(this,arguments);
  const editId=editingInvoiceId||null,beforeIds=new Set((Array.isArray(invoices)?invoices:[]).map(x=>x.id)),beforePath=editId?(invoices.find(x=>x.id===editId)?.file_path||null):null;
  let hash=null;
  try{
    hash=await sha256File(file);
    const dup=await duplicateFile(hash,editId);
    if(dup){toast(`Este mismo archivo ya está guardado como ${fileDocLabel(dup)} · ${dup.supplier||''} · ${fmtDate(dup.invoice_date)}`);return}
  }catch(e){console.warn('Document fingerprint precheck',e?.message||'unknown')}

  const result=await previousSaveInvoiceFileDedup.apply(this,arguments);
  if(!hash)return result;

  let target=null;
  if(editId){const row=(Array.isArray(invoices)?invoices:[]).find(x=>x.id===editId);if(row&&row.file_path&&row.file_path!==beforePath)target=row}
  else target=(Array.isArray(invoices)?invoices:[]).find(x=>!beforeIds.has(x.id))||null;
  if(!target)return result;

  try{
    await api(`/rest/v1/invoices?id=eq.${encodeURIComponent(target.id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:{file_sha256:hash}});
    target.file_sha256=hash;
  }catch(e){console.error('Document fingerprint save',e?.message||'unknown')}
  return result;
};
})();
