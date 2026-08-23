(()=>{
let selectedDocumentLinks=new Set(),linkSelectionTouched=false;

function addDocumentStyles(){
  if(document.getElementById('documentToolsStyle'))return;
  const s=document.createElement('style');s.id='documentToolsStyle';s.textContent=`
  .doc-type-help{font-size:.76rem;color:var(--muted);line-height:1.35;margin-top:6px}.doc-badge{display:inline-block;border:1px solid #44463e;border-radius:999px;padding:3px 7px;margin-top:5px;font-size:.68rem;font-weight:900}.doc-invoice{color:#a9e0c8}.doc-ticket{color:#e6c77e}.doc-delivery{color:#9ab9ff}.doc-linked{color:#83d7a0}.doc-not-counted{font-size:.7rem;color:#aaa69e;margin-top:4px}
  .doc-link-panel{margin:14px 0 0;padding:13px;border:1px solid #3b3d36;border-radius:13px;background:#121310}.doc-link-title{font-weight:900;font-size:.88rem}.doc-link-help{font-size:.76rem;color:var(--muted);line-height:1.4;margin:5px 0 9px}.doc-candidates{display:flex;flex-direction:column;gap:7px}.doc-candidate{display:grid;grid-template-columns:auto 1fr auto;gap:9px;align-items:center;padding:9px 10px;border:1px solid #30322d;border-radius:11px;background:#151613}.doc-candidate input{width:auto;min-height:auto}.doc-candidate-name{font-size:.8rem;font-weight:850}.doc-candidate-meta{font-size:.71rem;color:var(--muted);margin-top:2px}.doc-candidate-amount{font-size:.79rem;font-weight:900;white-space:nowrap}.doc-clear{font-size:.76rem;color:#8ed4a6;margin-top:8px}
  `;document.head.appendChild(s);
}
function docNorm(s=''){return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim()}
function docNumNorm(s=''){return docNorm(s).replace(/\s+/g,'')}
function documentType(x){return x?.document_type||'invoice'}
function documentTypeLabel(t){return t==='ticket'?'Ticket':t==='delivery_note'?'Albarán':'Factura'}
function isAccountingDocument(x){return documentType(x)!=='delivery_note'&&x?.document_status!=='linked'}
window.isAccountingDocument=isAccountingDocument;
function documentBadge(x){const t=documentType(x),linked=x?.document_status==='linked';if(linked)return '<span class="doc-badge doc-linked">✓ Facturado / sustituido</span>';if(t==='ticket')return '<span class="doc-badge doc-ticket">🧾 Ticket</span>';if(t==='delivery_note')return '<span class="doc-badge doc-delivery">📦 Albarán · pendiente</span>';return '<span class="doc-badge doc-invoice">📄 Factura</span>'}

const oldMonthRowsDocuments=monthRows;
monthRows=function(rows,key){const out=oldMonthRowsDocuments(rows,key);return key==='invoice_date'?out.filter(isAccountingDocument):out};

invoiceRow=function(x,actions=false){const buttons=`<div class="invoice-actions">${x.file_path?`<button type="button" class="secondary invoice-file" data-file-path="${esc(x.file_path)}">📎 Ver archivo</button>`:''}${actions?`<button type="button" class="secondary invoice-edit" data-invoice-id="${esc(x.id)}">✏️ Editar</button><button type="button" class="secondary danger invoice-delete" data-invoice-id="${esc(x.id)}">🗑 Borrar</button>`:''}</div>`;const search=`${x.supplier||''} ${x.invoice_number||''} ${documentTypeLabel(documentType(x))}`.toLowerCase(),counted=isAccountingDocument(x);return `<div class="row invoice-row" data-search="${esc(search)}" data-month="${esc((x.invoice_date||'').slice(0,7))}" data-total="${counted?Number(x.total)||0:0}"><div><div class="row-title">${esc(x.supplier)}</div><div class="row-meta">${fmtDate(x.invoice_date)} · ${esc(x.invoice_number||'Sin nº')}</div>${documentBadge(x)}${counted?'':'<div class="doc-not-counted">No suma como compra mientras esté pendiente o sustituido.</div>'}${buttons}</div><div class="row-amount">${euro(x.total)}</div></div>`};

function documentProvidersView(){
  const map=new Map();
  for(const x of (Array.isArray(invoices)?invoices:[]).filter(isAccountingDocument)){
    const name=(x.supplier||'Sin proveedor').trim()||'Sin proveedor',key=docNorm(name);
    if(!map.has(key))map.set(key,{name,total:0,monthTotal:0,count:0,monthCount:0,last:''});
    const p=map.get(key),amount=Number(x.total)||0;p.total+=amount;p.count++;
    if((x.invoice_date||'').slice(0,7)===selectedMonth){p.monthTotal+=amount;p.monthCount++}
    if(!p.last||String(x.invoice_date||'')>p.last)p.last=x.invoice_date||'';
  }
  const rows=[...map.values()].sort((a,b)=>Math.abs(b.monthTotal)-Math.abs(a.monthTotal)||Math.abs(b.total)-Math.abs(a.total)||a.name.localeCompare(b.name,'es',{sensitivity:'base'}));
  const opts=(()=>{const set=new Set([selectedMonth,localDate().slice(0,7)]);for(const x of invoices)if(x.invoice_date)set.add(x.invoice_date.slice(0,7));const d=new Date();for(let i=0;i<18;i++){const z=new Date(d.getFullYear(),d.getMonth()-i,2);set.add(`${z.getFullYear()}-${String(z.getMonth()+1).padStart(2,'0')}`)}return [...set].sort().reverse().map(m=>`<option value="${esc(m)}" ${m===selectedMonth?'selected':''}>${esc(monthLabel(m))}</option>`).join('')})();
  const cards=rows.map(p=>`<div class="row provider-smart-row" data-search="${esc(p.name.toLowerCase())}" data-month-total="${p.monthTotal}"><div><div class="row-title">${esc(p.name)}</div><div class="row-meta">${p.monthCount} compra${p.monthCount===1?'':'s'} en ${esc(monthLabel(selectedMonth))} · última ${fmtDate(p.last)}</div><div class="provider-all">Acumulado: ${euro(p.total)} · ${p.count} compra${p.count===1?'':'s'}</div></div><div class="provider-month">${euro(p.monthTotal)}</div></div>`).join('');
  return `<h2>Proveedores</h2>${rows.length?`<div class="card provider-tools"><div class="provider-tools-grid"><input id="providerSearch" type="search" placeholder="Buscar proveedor"><select id="providerMonth">${opts}</select></div><div class="provider-summary"><span id="providerVisibleCount"></span><strong id="providerVisibleTotal"></strong></div></div><div class="list provider-list">${cards}</div><div id="providerNoResults" class="empty" style="display:none">No hay proveedores con ese filtro.</div>`:'<div class="empty">Sin proveedores.</div>'}`;
}
providersView=documentProvidersView;

function injectDocumentTypeField(){
  if(route!=='invoices')return;
  const date=document.getElementById('invDate'),grid=date?.closest('.form-grid');if(!date||!grid||document.getElementById('invDocType'))return;
  const existing=editingInvoiceId?invoices.find(x=>x.id===editingInvoiceId):null,current=documentType(existing);
  const field=document.createElement('div');field.className='field';field.innerHTML=`<label>Tipo de documento</label><select id="invDocType"><option value="invoice">📄 Factura</option><option value="ticket">🧾 Ticket / compra</option><option value="delivery_note">📦 Albarán</option></select><div class="doc-type-help">La IA lo detectará automáticamente, pero puedes corregirlo antes de guardar.</div>`;
  date.closest('.field')?.insertAdjacentElement('afterend',field);document.getElementById('invDocType').value=current;
  const numberLabel=document.getElementById('invNumber')?.closest('.field')?.querySelector('label');if(numberLabel)numberLabel.textContent='Nº documento';
  const ai=document.getElementById('aiRead');if(ai)ai.textContent='✨ Leer documento con IA';
  updateDocumentForm();
}
function updateDocumentForm(){
  const t=v('invDocType')||'invoice',save=document.getElementById('saveInvoice'),hint=document.getElementById('aiHint');
  if(save&&!editingInvoiceId)save.textContent=t==='ticket'?'Guardar ticket':t==='delivery_note'?'Guardar albarán':'Guardar factura';
  if(hint){hint.textContent=t==='delivery_note'?'La IA puede leer el albarán, pero no se contabilizará como compra definitiva hasta que llegue la factura.':'La IA rellena los campos para que los revises. Nada se guarda hasta que pulses Guardar.'}
  renderDocumentCandidates();
}
function ensureLinkPanel(){const save=document.getElementById('saveInvoice'),card=save?.parentElement;if(!save||!card)return null;let p=document.getElementById('documentLinkPanel');if(!p){p=document.createElement('div');p.id='documentLinkPanel';p.className='doc-link-panel';save.insertAdjacentElement('beforebegin',p)}return p}
function daysBetween(a,b){if(!a||!b)return 9999;return Math.round((new Date(`${a}T12:00:00`)-new Date(`${b}T12:00:00`))/86400000)}
function rememberCurrentLinks(){document.querySelectorAll('[data-doc-link]').forEach(c=>{if(c.checked)selectedDocumentLinks.add(c.value);else selectedDocumentLinks.delete(c.value)})}
function candidateDocs(){
  const t=v('invDocType')||'invoice';if(t!=='invoice')return[];
  const supplier=docNorm(v('invSupplier')),date=v('invDate'),total=Number(String(v('invTotal')).replace(',','.')),refs=new Set((window.lastDetectedDocumentMeta?.related_document_numbers||[]).map(docNumNorm));
  return (Array.isArray(invoices)?invoices:[]).filter(x=>x.id!==editingInvoiceId&&(documentType(x)==='ticket'||documentType(x)==='delivery_note')&&x.document_status!=='linked').map(x=>{
    const refMatch=!!x.invoice_number&&refs.has(docNumNorm(x.invoice_number)),sameSupplier=!!supplier&&docNorm(x.supplier)===supplier,diff=daysBetween(date,x.invoice_date),amount=Number(x.total)||0,amountMatch=Number.isFinite(total)&&Math.abs(total-amount)<=0.05;
    let score=refMatch?100:0;if(sameSupplier)score+=30;if(amountMatch)score+=35;if(diff>=-7&&diff<=120)score+=Math.max(0,20-Math.floor(Math.max(0,diff)/7));if(documentType(x)==='delivery_note')score+=5;
    return{x,score,refMatch,sameSupplier,amountMatch,diff};
  }).filter(c=>c.refMatch||(c.sameSupplier&&c.diff>=-7&&c.diff<=120)).sort((a,b)=>b.score-a.score).slice(0,10);
}
function renderDocumentCandidates(){
  const panel=ensureLinkPanel();if(!panel)return;rememberCurrentLinks();
  if((v('invDocType')||'invoice')!=='invoice'){panel.style.display='none';panel.innerHTML='';return}
  const candidates=candidateDocs();panel.style.display='block';
  if(!candidates.length){panel.innerHTML='<div class="doc-link-title">🔗 Documentos previos</div><div class="doc-link-help">No veo tickets o albaranes pendientes que parezcan corresponder a esta factura.</div>';return}
  if(!linkSelectionTouched){for(const c of candidates){if(c.refMatch||(c.amountMatch&&c.sameSupplier&&Math.abs(c.diff)<=45))selectedDocumentLinks.add(c.x.id)}}
  panel.innerHTML=`<div class="doc-link-title">🔗 ¿Esta factura sustituye alguno de estos documentos?</div><div class="doc-link-help">Marca los tickets o albaranes que correspondan. Se conservarán archivados, pero dejarán de sumar para evitar duplicados.</div><div class="doc-candidates">${candidates.map(c=>{const x=c.x,checked=selectedDocumentLinks.has(x.id);return `<label class="doc-candidate"><input type="checkbox" data-doc-link value="${esc(x.id)}" ${checked?'checked':''}><div><div class="doc-candidate-name">${documentType(x)==='delivery_note'?'📦 Albarán':'🧾 Ticket'} · ${esc(x.supplier||'')}</div><div class="doc-candidate-meta">${fmtDate(x.invoice_date)} · ${esc(x.invoice_number||'Sin nº')}${c.refMatch?' · referencia encontrada en la factura':''}${c.amountMatch?' · mismo importe':''}</div></div><div class="doc-candidate-amount">${euro(x.total)}</div></label>`}).join('')}</div><div class="doc-clear">✓ Los que marques quedarán como facturados/sustituidos.</div>`;
  panel.querySelectorAll('[data-doc-link]').forEach(c=>c.addEventListener('change',()=>{linkSelectionTouched=true;if(c.checked)selectedDocumentLinks.add(c.value);else selectedDocumentLinks.delete(c.value)}));
}
window.afterDocumentRead=async function(){selectedDocumentLinks.clear();linkSelectionTouched=false;updateDocumentForm();renderDocumentCandidates()};
window.afterDocumentSaved=async function({invoiceId,docType}){
  if(docType!=='invoice')return{linkedCount:0};rememberCurrentLinks();const ids=[...selectedDocumentLinks];let linkedCount=0;
  for(const id of ids){try{await api(`/rest/v1/invoices?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:{document_status:'linked',linked_to_invoice_id:invoiceId}});await api(`/rest/v1/products?source_invoice_id=eq.${encodeURIComponent(id)}`,{method:'DELETE'}).catch(()=>{});linkedCount++}catch(e){console.error('Link prior document',e?.message||'unknown')}}
  selectedDocumentLinks.clear();linkSelectionTouched=false;return{linkedCount};
};

const oldDeleteInvoiceDocuments=deleteInvoice;
deleteInvoice=async function(id){const linked=(Array.isArray(invoices)?invoices:[]).filter(x=>x.linked_to_invoice_id===id);await oldDeleteInvoiceDocuments(id);if(linked.length&&!invoices.some(x=>x.id===id)){for(const x of linked){await api(`/rest/v1/invoices?id=eq.${encodeURIComponent(x.id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:{document_status:documentType(x)==='delivery_note'?'pending':'final',linked_to_invoice_id:null}}).catch(()=>{})}await loadData()}};

const oldBindDocuments=bind;
bind=function(){oldBindDocuments();addDocumentStyles();injectDocumentTypeField();document.getElementById('invDocType')?.addEventListener('change',()=>{selectedDocumentLinks.clear();linkSelectionTouched=false;updateDocumentForm()});['invSupplier','invTotal','invDate','invNumber'].forEach(id=>document.getElementById(id)?.addEventListener('input',()=>renderDocumentCandidates()));document.getElementById('providerMonth')?.addEventListener('change',e=>{selectedMonth=e.target.value;renderApp();scrollTo(0,0)});const providerSearch=document.getElementById('providerSearch');providerSearch?.addEventListener('input',()=>{const q=providerSearch.value.trim().toLowerCase();let count=0,total=0;document.querySelectorAll('.provider-smart-row').forEach(row=>{const show=!q||(row.dataset.search||'').includes(q);row.style.display=show?'flex':'none';if(show){count++;total+=Number(row.dataset.monthTotal)||0}});const c=document.getElementById('providerVisibleCount'),t=document.getElementById('providerVisibleTotal'),e=document.getElementById('providerNoResults');if(c)c.textContent=`${count} proveedor${count===1?'':'es'}`;if(t)t.textContent=`Mes: ${euro(total)}`;if(e)e.style.display=count?'none':'block'})};

addDocumentStyles();
if(session)renderApp();
})();
