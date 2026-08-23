(()=>{
let openDocumentHistoryId=null;
function addDocumentHistoryStyles(){
  if(document.getElementById('documentHistoryStyle'))return;
  const s=document.createElement('style');s.id='documentHistoryStyle';s.textContent=`
  .document-history{margin:-2px 0 10px;padding:14px;border:1px solid #34362f;border-radius:14px;background:#11120f}.history-head{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:9px}.history-title{font-size:.9rem;font-weight:900}.history-count{font-size:.74rem;color:var(--muted)}.history-event{padding:10px 0;border-top:1px solid #2a2c27}.history-event:first-of-type{border-top:0}.history-event-head{display:flex;justify-content:space-between;gap:10px}.history-action{font-size:.82rem;font-weight:900}.history-time{font-size:.7rem;color:var(--muted);white-space:nowrap}.history-change{font-size:.73rem;color:#b9b5ad;line-height:1.4;margin-top:4px}.history-empty{font-size:.8rem;color:var(--muted)}
  `;document.head.appendChild(s);
}
function historyActionLabel(a){return a==='created'?'Documento creado':a==='updated'?'Documento corregido':a==='linked'?'Vinculado a factura':a==='unlinked'?'Desvinculado de factura':a==='trashed'?'Enviado a Papelera':a==='restored'?'Restaurado desde Papelera':a==='deleted'?'Borrado definitivamente':a==='baseline'?'Inicio del historial':'Cambio'}
function historyFieldLabel(k){return k==='supplier'?'Proveedor':k==='number'?'Nº documento':k==='date'?'Fecha':k==='base'?'Base':k==='vat'?'IVA':k==='total'?'Total':k==='type'?'Tipo':k==='status'?'Estado':k==='linked_to'?'Factura vinculada':k==='deleted_at'?'Papelera':k}
function historyType(v){return v==='ticket'?'Ticket':v==='delivery_note'?'Albarán':v==='invoice'?'Factura':v}
function historyStatus(v){return v==='linked'?'Sustituido':v==='pending'?'Pendiente':v==='final'?'Final':v}
function historyValue(k,v){if(v===null||v===undefined||v==='')return'—';if(['base','vat','total'].includes(k))return euro(v);if(k==='date')return fmtDate(String(v));if(k==='type')return historyType(v);if(k==='status')return historyStatus(v);if(k==='linked_to')return v?'Sí':'No';if(k==='deleted_at')return v?'En Papelera':'Activo';return String(v)}
function historyChanges(x){
  const c=x?.changed_fields&&typeof x.changed_fields==='object'?x.changed_fields:{};
  const out=[];
  for(const [k,pair] of Object.entries(c)){
    if(k==='source'||!Array.isArray(pair)||pair.length<2)continue;
    out.push(`${historyFieldLabel(k)}: ${historyValue(k,pair[0])} → ${historyValue(k,pair[1])}`);
  }
  if(out.length)return out.join(' · ');
  if(x.action==='baseline')return'El documento ya existía cuando se activó el historial.';
  if(x.action==='linked')return'El documento dejó de contabilizarse por quedar sustituido por una factura.';
  if(x.action==='unlinked')return'El documento volvió a su estado contable anterior.';
  if(x.action==='trashed')return'El documento se conserva y puede restaurarse desde Papelera.';
  if(x.action==='restored')return'El documento volvió a estar activo.';
  return'';
}
function historyTime(s){try{return new Intl.DateTimeFormat('es-ES',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(s))}catch{return''}}
function findHistoryRow(button){return button?.closest('.invoice-row')||null}
async function toggleDocumentHistory(id,button){
  const row=findHistoryRow(button);if(!row)return;
  const next=row.nextElementSibling;
  if(next?.classList?.contains('document-history')){next.remove();openDocumentHistoryId=null;return}
  document.querySelectorAll('.document-history').forEach(x=>x.remove());openDocumentHistoryId=id;
  const box=document.createElement('div');box.className='document-history';box.innerHTML='<div class="history-empty">Cargando historial…</div>';row.insertAdjacentElement('afterend',box);
  try{
    const events=await api(`/rest/v1/document_audit?document_id=eq.${encodeURIComponent(id)}&select=id,action,document_type,document_status,changed_fields,snapshot,created_at&order=created_at.desc&limit=50`);
    if(openDocumentHistoryId!==id)return;
    const list=Array.isArray(events)?events:[];
    if(!list.length){box.innerHTML='<div class="history-title">🕘 Historial</div><div class="history-empty">Todavía no hay cambios registrados para este documento.</div>';return}
    box.innerHTML=`<div class="history-head"><div class="history-title">🕘 Historial del documento</div><div class="history-count">${list.length} evento${list.length===1?'':'s'}</div></div>${list.map(x=>{const changes=historyChanges(x);return `<div class="history-event"><div class="history-event-head"><div class="history-action">${esc(historyActionLabel(x.action))}</div><div class="history-time">${esc(historyTime(x.created_at))}</div></div>${changes?`<div class="history-change">${esc(changes)}</div>`:''}</div>`}).join('')}`;
  }catch(e){box.innerHTML=`<div class="history-title">🕘 Historial</div><div class="history-empty">No se pudo cargar: ${esc(e?.message||'error')}</div>`}
}
addDocumentHistoryStyles();
const previousInvoiceRowHistory=invoiceRow;
invoiceRow=function(x,actions=false){
  let html=previousInvoiceRowHistory(x,actions);if(!actions)return html;
  return html.replace('<div class="invoice-actions">',`<div class="invoice-actions"><button type="button" class="secondary" data-document-history="${esc(x.id)}">🕘 Historial</button>`);
};
const previousBindHistory=bind;
bind=function(){previousBindHistory();addDocumentHistoryStyles();document.querySelectorAll('[data-document-history]').forEach(b=>b.addEventListener('click',()=>toggleDocumentHistory(b.dataset.documentHistory,b)))};
if(session)renderApp();
})();
