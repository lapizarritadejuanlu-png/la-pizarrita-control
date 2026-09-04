(()=>{
let documentFilterType='all';

function addDocumentUiStyles(){
  if(document.getElementById('documentUiStyle'))return;
  const s=document.createElement('style');
  s.id='documentUiStyle';
  s.textContent=`
  .invoice-tools-grid.document-tools-grid{grid-template-columns:1.2fr .8fr .8fr}
  .doc-review-flag{display:inline-flex;align-items:center;margin-top:6px;border:1px solid #6b5631;border-radius:999px;padding:3px 7px;font-size:.68rem;font-weight:900;color:#e5c374;background:#211b10}
  @media(max-width:540px){.invoice-tools-grid.document-tools-grid{grid-template-columns:1fr 1fr}.invoice-tools-grid.document-tools-grid #invoiceSearch{grid-column:1/-1}}
  @media(max-width:390px){.invoice-tools-grid.document-tools-grid{grid-template-columns:1fr}.invoice-tools-grid.document-tools-grid #invoiceSearch{grid-column:auto}}
  `;
  document.head.appendChild(s);
}
function docUiType(x){return x?.document_type||'invoice'}
function docUiStatus(x){return x?.document_status||(docUiType(x)==='delivery_note'?'pending':'final')}
function reviewAgeDays(date){if(!date)return 0;const a=new Date(`${date}T12:00:00`),b=new Date(`${localDate()}T12:00:00`),n=Math.floor((b-a)/86400000);return Number.isFinite(n)?Math.max(0,n):0}
function documentReviewReason(x){
  if(!x||docUiStatus(x)==='linked')return'';
  const t=docUiType(x);
  if(t==='invoice'){
    const noNumber=!String(x.invoice_number||'').trim(),noTax=x.base_amount===null&&x.vat_amount===null;
    if(noNumber&&noTax)return'Factura sin nº y sin desglose de base/IVA';
    if(noNumber)return'Factura sin nº';
    if(noTax)return'Factura sin desglose de base/IVA';
  }
  if(t==='delivery_note'&&docUiStatus(x)==='pending'){
    const age=reviewAgeDays(x.invoice_date);if(age>=30)return`Albarán pendiente hace ${age} días`;
  }
  return'';
}
window.documentNeedsReview=x=>!!documentReviewReason(x);
window.documentReviewReason=documentReviewReason;
function prepareDocumentRows(){
  const rows=[...document.querySelectorAll('.invoice-list .invoice-row')];
  rows.forEach((row,i)=>{
    const x=(Array.isArray(invoices)?invoices:[])[i];if(!x)return;
    row.dataset.search=[x.supplier,x.invoice_number,x.concept,x.notes,x.category,docUiType(x)==='ticket'?'Ticket':docUiType(x)==='delivery_note'?'Albarán':'Factura'].filter(Boolean).join(' ');
    const reason=documentReviewReason(x);row.dataset.docType=docUiType(x);row.dataset.docStatus=docUiStatus(x);row.dataset.needsReview=reason?'1':'0';
    row.querySelector('.doc-review-flag')?.remove();
    if(reason){const holder=row.querySelector('.row-meta')?.parentElement;if(holder){const flag=document.createElement('div');flag.className='doc-review-flag';flag.textContent=`⚠ ${reason}`;holder.appendChild(flag)}}
  });
  return rows;
}
function typeMatches(row){
  if(documentFilterType==='all')return true;
  const t=row.dataset.docType||'invoice',s=row.dataset.docStatus||'final';
  if(documentFilterType==='pending')return s==='pending';
  if(documentFilterType==='linked')return s==='linked';
  if(documentFilterType==='review')return row.dataset.needsReview==='1';
  return t===documentFilterType;
}
function searchText(value){return String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[_/]+/g,' ').replace(/\s+/g,' ').trim()}
function matchesSearch(text,query){const haystack=searchText(text);return searchText(query).split(' ').filter(Boolean).every(word=>haystack.includes(word))}
function expenseSearchRows(){return (Array.isArray(moves)?moves:[]).filter(x=>x.move_type==='gasto'&&!x.deleted_at)}
function renderExpenseSearch(){
  const holder=document.getElementById('expenseSearchResults');if(!holder)return;
  const rows=expenseSearchRows().filter(x=>(invoiceFilterMonth==='all'||String(x.move_date||'').slice(0,7)===invoiceFilterMonth)&&matchesSearch([x.concept,x.notes,x.category,x.supplier,x.owner_label,x.period_label,x.expense_kind].join(' '),invoiceFilterText));
  holder.hidden=!['all','expense'].includes(documentFilterType);
  holder.innerHTML=`<div class="section-title">Gastos registrados a mano</div><p class="hint">${rows.length} gasto${rows.length===1?'':'s'} · ${euro(rows.reduce((sum,x)=>sum+(Number(x.amount)||0),0))}</p>${rows.length?rows.map(x=>`<div class="row"><div><div class="row-title">${esc(x.concept||'Gasto')}</div><div class="row-meta">${fmtDate(x.move_date)} · ${esc(String(x.category||'Otros').replace(/_/g,' '))}</div>${x.notes?`<div class="row-meta">${esc(x.notes)}</div>`:''}${x.file_path?`<button type="button" class="secondary" data-search-expense-file="${esc(x.file_path)}">📎 Ver justificante</button>`:''}</div><div class="row-amount">${euro(x.amount)}</div></div>`).join(''):'<div class="empty">No hay gastos manuales con ese filtro.</div>'}`;
  holder.querySelectorAll('[data-search-expense-file]').forEach(b=>b.addEventListener('click',()=>openInvoiceFile(b.dataset.searchExpenseFile)));
}
const previousInvoicesSearchView=invoicesView;
invoicesView=function(){
  let html=previousInvoicesSearchView();
  if(!html.includes('id="invoiceSearch"'))html+=`<div class="card invoice-tools"><div class="invoice-tools-grid"><input id="invoiceSearch" type="search" value="${esc(invoiceFilterText)}"><select id="invoiceMonth">${invoiceMonthOptions()}</select></div><div class="invoice-summary"><span id="invoiceCount"></span><strong id="invoiceVisibleTotal"></strong></div></div><div class="list invoice-list"></div><div id="invoiceNoResults" class="empty"></div>`;
  return html+'<div id="expenseSearchResults"></div>';
};
function applyDocumentFilters(){
  const rows=prepareDocumentRows();
  const q=invoiceFilterText;let count=0,total=0;
  for(const row of rows){const text=(row.dataset.search||'').toLowerCase(),month=row.dataset.month||'';const show=matchesSearch(text,q)&&(invoiceFilterMonth==='all'||month===invoiceFilterMonth)&&typeMatches(row);row.style.display=show?'flex':'none';if(show){count++;total+=Number(row.dataset.total||0)}}
  const countEl=document.getElementById('invoiceCount'),totalEl=document.getElementById('invoiceVisibleTotal'),emptyEl=document.getElementById('invoiceNoResults');
  renderExpenseSearch();
  if(countEl)countEl.textContent=`${count} documento${count===1?'':'s'}`;
  if(totalEl)totalEl.textContent=`Contabilizado: ${euro(total)}`;
  if(emptyEl){emptyEl.textContent='No hay documentos con ese filtro.';emptyEl.style.display=count?'none':'block'}
}
function renameDashboardDocuments(){
  if(route!=='dashboard')return;
  document.querySelectorAll('#main .section-title').forEach(el=>{if(el.textContent.trim()==='Últimas facturas')el.textContent='Últimos documentos'});
  document.querySelectorAll('#main .empty').forEach(el=>{if(el.textContent.trim()==='Todavía no hay facturas.')el.textContent='Todavía no hay documentos.'});
}
function injectDocumentUi(){
  const nav=document.querySelector('[data-route="invoices"]');if(nav)nav.textContent='Documentos';
  renameDashboardDocuments();
  if(route!=='invoices')return;
  const title=document.querySelector('#main > h2');if(title)title.textContent='Documentos';
  const search=document.getElementById('invoiceSearch');if(search)search.placeholder='Buscar: luz, agua, hipoteca…';
  const grid=document.querySelector('.invoice-tools-grid');
  if(grid){grid.classList.add('document-tools-grid');let sel=document.getElementById('documentTypeFilter');if(!sel){sel=document.createElement('select');sel.id='documentTypeFilter';sel.innerHTML='<option value="all">Documentos y gastos</option><option value="expense">Gastos manuales</option><option value="invoice">📄 Facturas</option><option value="ticket">🧾 Tickets</option><option value="delivery_note">📦 Albaranes</option><option value="pending">⏳ Pendientes</option><option value="review">⚠ Revisar</option><option value="linked">✓ Sustituidos / facturados</option>';grid.appendChild(sel)}sel.value=documentFilterType;sel.addEventListener('change',e=>{documentFilterType=e.target.value;applyDocumentFilters()})}
  const month=document.getElementById('invoiceMonth');
  if(month){const months=[...new Set([...invoices.map(x=>String(x.invoice_date||'').slice(0,7)),...expenseSearchRows().map(x=>String(x.move_date||'').slice(0,7))].filter(Boolean))].sort().reverse();month.innerHTML='<option value="all">Todos los meses</option>'+months.map(m=>`<option value="${esc(m)}">${esc(monthLabel(m))}</option>`).join('');month.value=invoiceFilterMonth;}
  applyDocumentFilters();
}

applyInvoiceFilters=applyDocumentFilters;
const previousBindDocumentUi=bind;
bind=function(){previousBindDocumentUi();addDocumentUiStyles();injectDocumentUi()};

addDocumentUiStyles();
if(session)renderApp();
})();
