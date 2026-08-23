(()=>{
let documentFilterType='all';

function addDocumentUiStyles(){
  if(document.getElementById('documentUiStyle'))return;
  const s=document.createElement('style');
  s.id='documentUiStyle';
  s.textContent=`
  .invoice-tools-grid.document-tools-grid{grid-template-columns:1.2fr .8fr .8fr}
  @media(max-width:540px){.invoice-tools-grid.document-tools-grid{grid-template-columns:1fr 1fr}.invoice-tools-grid.document-tools-grid #invoiceSearch{grid-column:1/-1}}
  @media(max-width:390px){.invoice-tools-grid.document-tools-grid{grid-template-columns:1fr}.invoice-tools-grid.document-tools-grid #invoiceSearch{grid-column:auto}}
  `;
  document.head.appendChild(s);
}
function docUiType(x){return x?.document_type||'invoice'}
function docUiStatus(x){return x?.document_status||(docUiType(x)==='delivery_note'?'pending':'final')}
function prepareDocumentRows(){
  const rows=[...document.querySelectorAll('.invoice-list .invoice-row')];
  rows.forEach((row,i)=>{const x=(Array.isArray(invoices)?invoices:[])[i];if(!x)return;row.dataset.docType=docUiType(x);row.dataset.docStatus=docUiStatus(x)});
  return rows;
}
function typeMatches(row){
  if(documentFilterType==='all')return true;
  const t=row.dataset.docType||'invoice',s=row.dataset.docStatus||'final';
  if(documentFilterType==='pending')return s==='pending';
  if(documentFilterType==='linked')return s==='linked';
  return t===documentFilterType;
}
function applyDocumentFilters(){
  const rows=prepareDocumentRows();if(!rows.length)return;
  const q=String(invoiceFilterText||'').trim().toLowerCase();let count=0,total=0;
  for(const row of rows){const text=(row.dataset.search||'').toLowerCase(),month=row.dataset.month||'';const show=(!q||text.includes(q))&&(invoiceFilterMonth==='all'||month===invoiceFilterMonth)&&typeMatches(row);row.style.display=show?'flex':'none';if(show){count++;total+=Number(row.dataset.total||0)}}
  const countEl=document.getElementById('invoiceCount'),totalEl=document.getElementById('invoiceVisibleTotal'),emptyEl=document.getElementById('invoiceNoResults');
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
  const search=document.getElementById('invoiceSearch');if(search)search.placeholder='Buscar proveedor o nº documento';
  const grid=document.querySelector('.invoice-tools-grid');
  if(grid){grid.classList.add('document-tools-grid');let sel=document.getElementById('documentTypeFilter');if(!sel){sel=document.createElement('select');sel.id='documentTypeFilter';sel.innerHTML='<option value="all">Todos los documentos</option><option value="invoice">📄 Facturas</option><option value="ticket">🧾 Tickets</option><option value="delivery_note">📦 Albaranes</option><option value="pending">⏳ Pendientes</option><option value="linked">✓ Sustituidos / facturados</option>';grid.appendChild(sel)}sel.value=documentFilterType;sel.addEventListener('change',e=>{documentFilterType=e.target.value;applyDocumentFilters()})}
  applyDocumentFilters();
}

applyInvoiceFilters=applyDocumentFilters;
const previousBindDocumentUi=bind;
bind=function(){previousBindDocumentUi();addDocumentUiStyles();injectDocumentUi()};

addDocumentUiStyles();
if(session)renderApp();
})();
