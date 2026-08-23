(()=>{
let accountingMonthLocks=[];

function addMonthLockStyles(){
  if(document.getElementById('monthLockStyle'))return;
  const s=document.createElement('style');s.id='monthLockStyle';s.textContent=`
  .month-lock-card{border-color:#3c4b40}.month-lock-card.closed{border-color:#315b3e;background:linear-gradient(145deg,#132019,#11130f)}.month-lock-card.blocked{border-color:#63542f}.month-lock-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.month-lock-title{font-size:1rem;font-weight:900}.month-lock-state{font-size:.75rem;font-weight:950;border:1px solid #3d4039;border-radius:999px;padding:5px 8px;white-space:nowrap}.month-lock-card.closed .month-lock-state{color:#7bd79a;border-color:#315b3e}.month-lock-help{font-size:.79rem;color:var(--muted);line-height:1.45;margin-top:7px}.month-lock-warning{font-size:.78rem;color:#e5c374;line-height:1.4;margin-top:8px}.month-lock-btn{width:100%;margin-top:11px}.doc-month-lock{font-size:.7rem;color:#7bd79a;font-weight:900;margin-top:6px}
  `;document.head.appendChild(s);
}
function monthStart(m){return `${m}-01`}
function lockMonthKey(date){return String(date||'').slice(0,7)}
function isMonthLocked(m){return accountingMonthLocks.some(x=>String(x.month||'').slice(0,7)===m)}
window.isAccountingMonthLocked=isMonthLocked;
function documentMonthLocked(x){return !!x&&isMonthLocked(lockMonthKey(x.invoice_date))}
function closeBlockers(m){
  const docs=(Array.isArray(invoices)?invoices:[]).filter(x=>lockMonthKey(x.invoice_date)===m&&!x.deleted_at);
  const pending=docs.filter(x=>(x.document_type||'invoice')==='delivery_note'&&x.document_status!=='linked');
  const review=docs.filter(x=>typeof window.documentNeedsReview==='function'&&window.documentNeedsReview(x));
  return{pending,review};
}
async function loadMonthLocks(){
  try{const rows=await api('/rest/v1/accounting_month_locks?select=month,locked_at&order=month.desc');accountingMonthLocks=Array.isArray(rows)?rows:[];window.accountingMonthLocks=accountingMonthLocks}catch(e){console.warn('Month locks',e?.message||'unknown');accountingMonthLocks=[]}
}
function monthLockCard(){
  const m=selectedMonth,locked=isMonthLocked(m),b=closeBlockers(m),blocked=!locked&&(b.pending.length||b.review.length),future=m>localDate().slice(0,7);
  const cls=locked?' closed':blocked?' blocked':'';
  if(locked)return `<div class="section-title">Cierre mensual</div><div class="card month-lock-card closed"><div class="month-lock-head"><div class="month-lock-title">🔒 ${esc(monthLabel(m))}</div><div class="month-lock-state">CERRADO</div></div><div class="month-lock-help">Los documentos de este mes están protegidos contra altas, correcciones, vinculaciones, Papelera y borrado accidental.</div><button type="button" id="reopenAccountingMonth" class="secondary month-lock-btn">🔓 Reabrir mes</button></div>`;
  const warnings=[];if(b.pending.length)warnings.push(`${b.pending.length} albarán${b.pending.length===1?'':'es'} pendiente${b.pending.length===1?'':'s'}`);if(b.review.length)warnings.push(`${b.review.length} documento${b.review.length===1?'':'s'} por revisar`);if(future)warnings.push('es un mes futuro');
  return `<div class="section-title">Cierre mensual</div><div class="card month-lock-card${cls}"><div class="month-lock-head"><div class="month-lock-title">🔓 ${esc(monthLabel(m))}</div><div class="month-lock-state">ABIERTO</div></div><div class="month-lock-help">Cuando hayas revisado el mes o enviado sus datos al gestor, puedes cerrarlo para evitar cambios accidentales.</div>${warnings.length?`<div class="month-lock-warning">⚠ No se puede cerrar todavía: ${esc(warnings.join(' · '))}.</div>`:''}<button type="button" id="closeAccountingMonth" class="secondary month-lock-btn" ${warnings.length?'disabled':''}>🔒 Cerrar mes</button></div>`;
}
async function closeAccountingMonth(){
  const m=selectedMonth,b=closeBlockers(m);if(b.pending.length||b.review.length||m>localDate().slice(0,7)){toast('Este mes todavía no se puede cerrar.');return}
  if(!confirm(`¿Cerrar ${monthLabel(m)}?\n\nMientras esté cerrado no se podrán crear, editar, vincular ni borrar documentos de ese mes.`))return;
  try{setBusy(true);await api('/rest/v1/accounting_month_locks',{method:'POST',headers:{Prefer:'return=minimal'},body:{user_id:session.user.id,month:monthStart(m)}});await loadMonthLocks();toast(`${monthLabel(m)} cerrado`);renderApp()}catch(e){toast('No se pudo cerrar el mes: '+(e?.message||'error'))}finally{setBusy(false)}
}
async function reopenAccountingMonth(){
  const m=selectedMonth;if(!confirm(`¿Reabrir ${monthLabel(m)}?\n\nVolverás a poder modificar sus documentos.`))return;
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
