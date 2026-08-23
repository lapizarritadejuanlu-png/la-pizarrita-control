(()=>{
let accountingMonthLocks=[];

function addMonthLockStyles(){
  if(document.getElementById('monthLockStyle'))return;
  const s=document.createElement('style');s.id='monthLockStyle';s.textContent=`
  .month-lock-card{border-color:#3c4b40}.month-lock-card.closed{border-color:#315b3e;background:linear-gradient(145deg,#132019,#11130f)}.month-lock-card.blocked{border-color:#63542f}.month-lock-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.month-lock-title{font-size:1rem;font-weight:900}.month-lock-state{font-size:.75rem;font-weight:950;border:1px solid #3d4039;border-radius:999px;padding:5px 8px;white-space:nowrap}.month-lock-card.closed .month-lock-state{color:#7bd79a;border-color:#315b3e}.month-lock-help{font-size:.79rem;color:var(--muted);line-height:1.45;margin-top:7px}.month-lock-warning{font-size:.78rem;color:#e5c374;line-height:1.4;margin-top:8px}.month-lock-btn{width:100%;margin-top:11px}.doc-month-lock{font-size:.7rem;color:#7bd79a;font-weight:900;margin-top:6px}.month-lock-snapshot{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:11px}.month-lock-stat{border:1px solid #2d4434;border-radius:10px;padding:9px;background:#101712}.month-lock-stat span{display:block;font-size:.66rem;color:var(--muted);text-transform:uppercase}.month-lock-stat strong{display:block;margin-top:3px;font-size:.87rem}.month-lock-time{font-size:.7rem;color:#8eb99a;margin-top:8px}@media(max-width:390px){.month-lock-snapshot{grid-template-columns:1fr}}
  `;document.head.appendChild(s);
}
function monthStart(m){return `${m}-01`}
function lockMonthKey(date){return String(date||'').slice(0,7)}
function lockRecord(m){return accountingMonthLocks.find(x=>String(x.month||'').slice(0,7)===m)||null}
function isMonthLocked(m){return !!lockRecord(m)}
window.isAccountingMonthLocked=isMonthLocked;
function documentMonthLocked(x){return !!x&&isMonthLocked(lockMonthKey(x.invoice_date))}
function closeBlockers(m){
  const docs=(Array.isArray(invoices)?invoices:[]).filter(x=>lockMonthKey(x.invoice_date)===m&&!x.deleted_at);
  const pending=docs.filter(x=>(x.document_type||'invoice')==='delivery_note'&&x.document_status!=='linked');
  const review=docs.filter(x=>typeof window.documentNeedsReview==='function'&&window.documentNeedsReview(x));
  return{pending,review};
}
function monthSnapshot(m){
  const docs=(Array.isArray(invoices)?invoices:[]).filter(x=>lockMonthKey(x.invoice_date)===m&&!x.deleted_at);
  const accounting=docs.filter(x=>typeof window.isAccountingDocument==='function'?window.isAccountingDocument(x):((x.document_type||'invoice')!=='delivery_note'&&x.document_status!=='linked'));
  const formal=accounting.filter(x=>(x.document_type||'invoice')==='invoice');
  const sum=(rows,key)=>rows.reduce((a,x)=>a+(Number(x[key])||0),0);
  return{
    document_count:docs.length,
    accounting_count:accounting.length,
    invoice_count:formal.length,
    ticket_count:accounting.filter(x=>x.document_type==='ticket').length,
    supplier_count:new Set(accounting.map(x=>String(x.supplier||'').trim().toLowerCase()).filter(Boolean)).size,
    net_total:sum(accounting,'total'),
    invoice_base:sum(formal,'base_amount'),
    invoice_vat:sum(formal,'vat_amount'),
    captured_at:new Date().toISOString()
  };
}
async function loadMonthLocks(){
  try{const rows=await api('/rest/v1/accounting_month_locks?select=month,locked_at,summary&order=month.desc');accountingMonthLocks=Array.isArray(rows)?rows:[];window.accountingMonthLocks=accountingMonthLocks}catch(e){console.warn('Month locks',e?.message||'unknown');accountingMonthLocks=[]}
}
function closedAtText(s){try{return new Intl.DateTimeFormat('es-ES',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(s))}catch{return''}}
function snapshotHtml(lock){
  const s=lock?.summary||{};if(!s||typeof s!=='object'||s.accounting_count===undefined)return'';
  return `<div class="month-lock-snapshot"><div class="month-lock-stat"><span>Compras contabilizadas</span><strong>${Number(s.accounting_count)||0}</strong></div><div class="month-lock-stat"><span>Total neto</span><strong>${euro(Number(s.net_total)||0)}</strong></div><div class="month-lock-stat"><span>Base facturas</span><strong>${euro(Number(s.invoice_base)||0)}</strong></div><div class="month-lock-stat"><span>IVA facturas</span><strong>${euro(Number(s.invoice_vat)||0)}</strong></div></div>${lock.locked_at?`<div class="month-lock-time">Cierre guardado: ${esc(closedAtText(lock.locked_at))}</div>`:''}`;
}
function monthLockCard(){
  const m=selectedMonth,lock=lockRecord(m),locked=!!lock,b=closeBlockers(m),blocked=!locked&&(b.pending.length||b.review.length),future=m>localDate().slice(0,7);
  const cls=locked?' closed':blocked?' blocked':'';
  if(locked)return `<div class="section-title">Cierre mensual</div><div class="card month-lock-card closed"><div class="month-lock-head"><div class="month-lock-title">🔒 ${esc(monthLabel(m))}</div><div class="month-lock-state">CERRADO</div></div><div class="month-lock-help">Los documentos de este mes están protegidos contra altas, correcciones, vinculaciones, Papelera y borrado accidental. Las cifras siguientes son la foto exacta guardada al cerrar.</div>${snapshotHtml(lock)}<button type="button" id="reopenAccountingMonth" class="secondary month-lock-btn">🔓 Reabrir mes</button></div>`;
  const warnings=[];if(b.pending.length)warnings.push(`${b.pending.length} albarán${b.pending.length===1?'':'es'} pendiente${b.pending.length===1?'':'s'}`);if(b.review.length)warnings.push(`${b.review.length} documento${b.review.length===1?'':'s'} por revisar`);if(future)warnings.push('es un mes futuro');
  return `<div class="section-title">Cierre mensual</div><div class="card month-lock-card${cls}"><div class="month-lock-head"><div class="month-lock-title">🔓 ${esc(monthLabel(m))}</div><div class="month-lock-state">ABIERTO</div></div><div class="month-lock-help">Cuando hayas revisado el mes o enviado sus datos al gestor, puedes cerrarlo. La app guardará una foto de las cifras y bloqueará cambios accidentales.</div>${warnings.length?`<div class="month-lock-warning">⚠ No se puede cerrar todavía: ${esc(warnings.join(' · '))}.</div>`:''}<button type="button" id="closeAccountingMonth" class="secondary month-lock-btn" ${warnings.length?'disabled':''}>🔒 Cerrar mes y guardar cifras</button></div>`;
}
async function closeAccountingMonth(){
  const m=selectedMonth,b=closeBlockers(m);if(b.pending.length||b.review.length||m>localDate().slice(0,7)){toast('Este mes todavía no se puede cerrar.');return}
  const summary=monthSnapshot(m);
  if(!confirm(`¿Cerrar ${monthLabel(m)}?\n\nSe guardará una foto de sus cifras y no se podrán crear, editar, vincular ni borrar documentos de ese mes.`))return;
  try{setBusy(true);await api('/rest/v1/accounting_month_locks',{method:'POST',headers:{Prefer:'return=minimal'},body:{user_id:session.user.id,month:monthStart(m),summary}});await loadMonthLocks();toast(`${monthLabel(m)} cerrado · cifras guardadas`);renderApp()}catch(e){toast('No se pudo cerrar el mes: '+(e?.message||'error'))}finally{setBusy(false)}
}
async function reopenAccountingMonth(){
  const m=selectedMonth;if(!confirm(`¿Reabrir ${monthLabel(m)}?\n\nVolverás a poder modificar sus documentos. La foto de este cierre dejará de ser el cierre vigente.`))return;
  try{setBusy(true);await api(`/rest/v1/accounting_month_locks?month=eq.${encodeURIComponent(monthStart(m))}`,{method:'DELETE'});await loadMonthLocks();toast(`${monthLabel(m)} reabierto`);renderApp()}catch(e){toast('No se pudo reabrir el mes: '+(e?.message||'error'))}finally{setBusy(false)}
}
function blockLockedCandidateLinks(){
  document.querySelectorAll('[data-doc-link]').forEach(input=>{
    const x=(Array.isArray(invoices)?invoices:[]).find(i=>i.id===input.value);if(!x||!documentMonthLocked(x))return;
    input.checked=false;input.disabled=true;
    const meta=input.closest('.doc-candidate')?.querySelector('.doc-candidate-meta');if(meta&&!meta.textContent.includes('mes cerrado'))meta.append(' · 🔒 mes cerrado');
  });
}
function lockedEditTarget(){return editingInvoiceId?(Array.isArray(invoices)?invoices:[]).find(x=>x.id===editingInvoiceId):null}

const previousLoadDataMonthLock=loadData;
loadData=async function(){const r=await previousLoadDataMonthLock.apply(this,arguments);await loadMonthLocks();if(session)renderApp();return r};

const previousDashboardMonthLock=dashboard;
dashboard=function(){return previousDashboardMonthLock()+monthLockCard()};

const previousInvoiceRowMonthLock=invoiceRow;
invoiceRow=function(x,actions=false){
  let html=previousInvoiceRowMonthLock(x,actions);if(!actions||!documentMonthLocked(x))return html;
  html=html.replace(/<button type="button" class="secondary invoice-edit"[^>]*>✏️ Editar<\/button>/g,'')
           .replace(/<button type="button" class="secondary danger invoice-delete"[^>]*>🗑 Borrar<\/button>/g,'')
           .replace(/<button type="button" class="secondary" data-unlink-document="[^"]+">↩ Desvincular<\/button>/g,'');
  return html.replace('<div class="invoice-actions">','<div class="doc-month-lock">🔒 Mes cerrado</div><div class="invoice-actions">');
};

const previousStartEditMonthLock=startEditInvoice;
startEditInvoice=function(id){const x=(Array.isArray(invoices)?invoices:[]).find(i=>i.id===id);if(documentMonthLocked(x)){toast(`🔒 ${monthLabel(lockMonthKey(x.invoice_date))} está cerrado. Reábrelo para editar.`);return}return previousStartEditMonthLock.apply(this,arguments)};

const previousSaveInvoiceMonthLock=saveInvoice;
saveInvoice=async function(){
  const date=v('invDate'),m=lockMonthKey(date),existing=lockedEditTarget();
  if((m&&isMonthLocked(m))||documentMonthLocked(existing)){toast(`🔒 ${monthLabel(documentMonthLocked(existing)?lockMonthKey(existing.invoice_date):m)} está cerrado. Reábrelo antes de guardar.`);return}
  try{return await previousSaveInvoiceMonthLock.apply(this,arguments)}catch(e){if(/MONTH_LOCKED/i.test(String(e?.message||''))){toast('🔒 Ese mes está cerrado. Reábrelo antes de modificar documentos.');return}throw e}
};

const previousDeleteInvoiceMonthLock=deleteInvoice;
deleteInvoice=async function(id){const x=(Array.isArray(invoices)?invoices:[]).find(i=>i.id===id);if(documentMonthLocked(x)){toast(`🔒 ${monthLabel(lockMonthKey(x.invoice_date))} está cerrado. Reábrelo para enviar a Papelera.`);return}return previousDeleteInvoiceMonthLock.apply(this,arguments)};

const previousBindMonthLock=bind;
bind=function(){previousBindMonthLock();addMonthLockStyles();document.getElementById('closeAccountingMonth')?.addEventListener('click',closeAccountingMonth);document.getElementById('reopenAccountingMonth')?.addEventListener('click',reopenAccountingMonth);blockLockedCandidateLinks();['invSupplier','invTotal','invDate','invNumber','invDocType'].forEach(id=>document.getElementById(id)?.addEventListener('input',()=>setTimeout(blockLockedCandidateLinks,0)))};

addMonthLockStyles();
loadMonthLocks().then(()=>{if(session)renderApp()});
})();
