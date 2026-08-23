(()=>{
let deletedDocuments=[];
function addTrashStyles(){
  if(document.getElementById('documentTrashStyle'))return;
  const s=document.createElement('style');s.id='documentTrashStyle';s.textContent=`
  .trash-card{border-color:#4a4034}.trash-title{font-size:1rem;font-weight:900}.trash-help{font-size:.8rem;color:var(--muted);line-height:1.45;margin-top:6px}.trash-list{display:flex;flex-direction:column;gap:8px;margin-top:12px}.trash-row{border-top:1px solid #302d28;padding-top:10px}.trash-row:first-child{border-top:0;padding-top:0}.trash-head{display:flex;justify-content:space-between;gap:10px}.trash-name{font-size:.84rem;font-weight:900}.trash-meta{font-size:.72rem;color:var(--muted);margin-top:3px}.trash-amount{font-size:.82rem;font-weight:900;white-space:nowrap}.trash-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:7px}.trash-actions button{padding:7px 9px!important;font-size:.72rem!important}.trash-empty{font-size:.8rem;color:var(--muted);margin-top:8px}
  `;document.head.appendChild(s);
}
function trashType(x){const t=x?.document_type||'invoice';return t==='ticket'?'Ticket':t==='delivery_note'?'Albarán':'Factura'}
function trashNorm(s=''){return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'').trim()}
function filterDeletedFromLoadedData(){
  const all=Array.isArray(invoices)?[...invoices]:[];deletedDocuments=all.filter(x=>!!x.deleted_at);window.deletedDocuments=deletedDocuments;
  const deletedIds=new Set(deletedDocuments.map(x=>x.id));invoices=all.filter(x=>!x.deleted_at);
  products=(Array.isArray(products)?products:[]).filter(p=>!p?.source_invoice_id||!deletedIds.has(p.source_invoice_id));
}
async function restorePricesAfterInvoiceTrash(restoredRows){
  const ids=new Set((Array.isArray(restoredRows)?restoredRows:[]).filter(x=>x.restored_type==='ticket').map(x=>x.restored_id));if(!ids.size)return;
  const allRows=Array.isArray(invoices)?invoices:[];
  for(const id of ids){const x=allRows.find(i=>i.id===id);if(!x)continue;const items=Array.isArray(x?.extraction_json?.items)?x.extraction_json.items:[];const rows=items.filter(i=>i?.unit_price!==null&&i?.unit_price!==undefined&&Number.isFinite(Number(i.unit_price))&&Number(i.unit_price)>0).map(i=>({user_id:session.user.id,name:String(i.description||'').trim(),supplier:x.supplier,price_date:x.invoice_date,price:Number(i.unit_price),unit:i.unit||'sin especificar',net_cost:null,source_invoice_id:x.id})).filter(i=>i.name);await api(`/rest/v1/products?source_invoice_id=eq.${encodeURIComponent(id)}`,{method:'DELETE'}).catch(()=>{});if(rows.length)await api('/rest/v1/products',{method:'POST',headers:{Prefer:'return=minimal'},body:rows}).catch(()=>{})}
}
async function moveDocumentToTrash(id){
  const x=(Array.isArray(invoices)?invoices:[]).find(i=>i.id===id);if(!x)return;
  if(x.document_status==='linked'){toast('Primero desvincula este documento de su factura.');return}
  const dependents=(Array.isArray(invoices)?invoices:[]).filter(i=>i.linked_to_invoice_id===id);const extra=dependents.length?`\n\nLos ${dependents.length} ticket${dependents.length===1?'':'s'}/albarán${dependents.length===1?'':'es'} vinculados volverán a quedar activos.`:'';
  if(!confirm(`¿Mover esta ${trashType(x).toLowerCase()} de ${x.supplier} por ${euro(x.total)} a Papelera?${extra}`))return;
  try{
    setBusy(true);
    const restored=await api('/rest/v1/rpc/trash_document',{method:'POST',headers:{Prefer:'return=representation'},body:{p_document_id:id}});
    await restorePricesAfterInvoiceTrash(restored);
    if(editingInvoiceId===id){editingInvoiceId=null;editingFilePath=null}
    toast('Documento movido a Papelera');await loadData();
  }catch(e){toast('No se pudo mover a Papelera: '+(e?.message||'error'))}finally{setBusy(false)}
}
async function restoreDeletedDocument(id){
  const x=deletedDocuments.find(i=>i.id===id);if(!x)return;
  try{setBusy(true);const ok=await api('/rest/v1/rpc/restore_document',{method:'POST',body:{p_document_id:id}});if(ok===false)throw new Error('No se pudo restaurar');toast('Documento restaurado');await loadData()}catch(e){const m=e?.message||'';if(/duplicate key|unique constraint|23505/i.test(m))toast('No se puede restaurar porque existe otro documento igual.');else toast('No se pudo restaurar: '+m)}finally{setBusy(false)}
}
async function deleteDeletedDocumentForever(id){
  const x=deletedDocuments.find(i=>i.id===id);if(!x)return;
  if(!confirm(`BORRADO DEFINITIVO\n\n¿Eliminar para siempre ${trashType(x).toLowerCase()} de ${x.supplier} por ${euro(x.total)}? Esta acción no se puede deshacer.`))return;
  try{setBusy(true);await api(`/rest/v1/invoices?id=eq.${encodeURIComponent(id)}&deleted_at=not.is.null`,{method:'DELETE'});if(x.file_path)await deleteStorageFile(x.file_path).catch(()=>{});toast('Documento eliminado definitivamente');await loadData()}catch(e){toast('No se pudo borrar definitivamente: '+(e?.message||'error'))}finally{setBusy(false)}
}
function trashView(){
  const rows=deletedDocuments.slice().sort((a,b)=>String(b.deleted_at||'').localeCompare(String(a.deleted_at||''))).slice(0,20);
  return `<div class="section-title">Papelera de documentos</div><div class="card trash-card"><div class="trash-title">🗑 Papelera${deletedDocuments.length?` · ${deletedDocuments.length}`:''}</div><div class="trash-help">Borrar un documento ya no destruye sus datos ni su archivo. Puedes restaurarlo desde aquí.</div>${rows.length?`<div class="trash-list">${rows.map(x=>`<div class="trash-row"><div class="trash-head"><div><div class="trash-name">${esc(trashType(x))} · ${esc(x.supplier||'Sin proveedor')}</div><div class="trash-meta">${fmtDate(x.invoice_date)} · ${esc(x.invoice_number||'Sin nº')} · enviado a Papelera ${x.deleted_at?historyLikeDate(x.deleted_at):''}</div></div><div class="trash-amount">${euro(x.total)}</div></div><div class="trash-actions"><button type="button" class="secondary" data-trash-restore="${esc(x.id)}">↩ Restaurar</button>${x.file_path?`<button type="button" class="secondary" data-trash-file="${esc(x.file_path)}">📎 Ver archivo</button>`:''}<button type="button" class="secondary danger" data-trash-delete="${esc(x.id)}">🗑 Borrar definitivamente</button></div></div>`).join('')}</div>`:'<div class="trash-empty">La Papelera está vacía.</div>'}</div>`;
}
function historyLikeDate(s){try{return new Intl.DateTimeFormat('es-ES',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(s))}catch{return''}}
const previousLoadDataTrash=loadData;
loadData=async function(){const result=await previousLoadDataTrash.apply(this,arguments);filterDeletedFromLoadedData();if(session)renderApp();return result};
const previousDeleteTrash=deleteInvoice;
deleteInvoice=async function(id){return moveDocumentToTrash(id)};
const previousSaveTrash=saveInvoice;
saveInvoice=async function(){
  if(!editingInvoiceId){const t=v('invDocType')||'invoice',supplier=trashNorm(v('invSupplier')),number=trashNorm(v('invNumber'));if(number&&supplier){const dup=deletedDocuments.find(x=>(x.document_type||'invoice')===t&&trashNorm(x.supplier)===supplier&&trashNorm(x.invoice_number)===number);if(dup){toast(`Ese ${trashType(dup).toLowerCase()} está en Papelera. Restáuralo en vez de guardarlo otra vez.`);return}}}
  return previousSaveTrash.apply(this,arguments);
};
const previousMoreTrash=moreView;
moreView=function(){return previousMoreTrash()+trashView()};
const previousBindTrash=bind;
bind=function(){previousBindTrash();addTrashStyles();document.querySelectorAll('[data-trash-restore]').forEach(b=>b.addEventListener('click',()=>restoreDeletedDocument(b.dataset.trashRestore)));document.querySelectorAll('[data-trash-delete]').forEach(b=>b.addEventListener('click',()=>deleteDeletedDocumentForever(b.dataset.trashDelete)));document.querySelectorAll('[data-trash-file]').forEach(b=>b.addEventListener('click',()=>openInvoiceFile(b.dataset.trashFile)))};
addTrashStyles();filterDeletedFromLoadedData();if(session)renderApp();
})();
