(()=>{
function addDashboardStyles(){
  if(document.getElementById('dashboardToolsStyle'))return;
  const s=document.createElement('style');s.id='dashboardToolsStyle';s.textContent=`
  .intel-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px}.intel-box{border:1px solid var(--line);border-radius:14px;padding:14px;background:#141512}.intel-label{font-size:.76rem;color:var(--muted);text-transform:uppercase;letter-spacing:.035em}.intel-value{font-size:1.2rem;font-weight:900;margin-top:4px}.intel-sub{font-size:.76rem;color:var(--muted);margin-top:4px;line-height:1.3}.intel-note{font-size:.84rem;color:#b9b5ad;line-height:1.4;margin:12px 0 0}.intel-list{display:flex;flex-direction:column;gap:8px;margin-top:12px}.intel-row{display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-top:1px solid #2d2f29}.intel-row:first-child{border-top:0}.intel-name{font-size:.86rem;font-weight:800}.intel-amount{font-size:.86rem;font-weight:900;white-space:nowrap}.intel-alerts{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.intel-pill{border:1px solid #3b3d36;border-radius:999px;padding:7px 10px;font-size:.78rem;font-weight:800}.intel-up{color:#ff9a91}.intel-down{color:#7bd79a}.intel-neutral{color:#d9b86e}
  .pending-doc-card{border-color:#54482b;background:linear-gradient(145deg,#1c1a13,#121310)}.pending-doc-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.pending-doc-title{font-size:1rem;font-weight:900}.pending-doc-count{font-size:1.45rem;font-weight:950;color:#e6c77e}.pending-doc-meta{font-size:.8rem;color:var(--muted);line-height:1.45;margin-top:8px}.pending-doc-btn{margin-top:12px;width:100%}.pending-doc-list{display:flex;flex-direction:column;gap:8px;margin-top:13px}.pending-doc-row{border-top:1px solid #3a3527;padding-top:10px}.pending-doc-row:first-child{border-top:0;padding-top:0}.pending-doc-row-head{display:flex;justify-content:space-between;gap:10px}.pending-doc-name{font-size:.84rem;font-weight:900}.pending-doc-amount{font-size:.82rem;font-weight:900;white-space:nowrap}.pending-doc-row-meta{font-size:.72rem;color:var(--muted);margin-top:3px}.pending-doc-actions{display:flex;gap:7px;margin-top:7px;flex-wrap:wrap}.pending-doc-actions button{padding:7px 9px!important;font-size:.72rem!important}.pending-age-old{color:#ff9a91;font-weight:900}.pending-age-mid{color:#e6c77e;font-weight:900}
  .review-doc-card{border-color:#5d4930}.review-doc-btn{width:100%;margin-top:10px}
  @media(max-width:390px){.intel-grid{grid-template-columns:1fr}}
  `;document.head.appendChild(s);
}
function monthShift(m,delta){const [y,mo]=m.split('-').map(Number);const d=new Date(y,mo-1+delta,2);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`}
function countableDocument(x){return typeof window.isAccountingDocument==='function'?window.isAccountingDocument(x):((x?.document_type||'invoice')!=='delivery_note'&&x?.document_status!=='linked')}
function monthInvoices(m){return (Array.isArray(invoices)?invoices:[]).filter(x=>(x.invoice_date||'').slice(0,7)===m&&countableDocument(x))}
function nsum(rows,key){return rows.reduce((a,x)=>a+(Number(x[key])||0),0)}
function priceAlertCounts(){
  const map=new Map();for(const p of Array.isArray(products)?products:[]){const k=`${String(p.name||'').trim().toLowerCase()}|${String(p.unit||'').trim().toLowerCase()}`;if(!map.has(k))map.set(k,[]);map.get(k).push(p)}
  let up=0,down=0,same=0;
  for(const rows of map.values()){rows.sort((a,b)=>String(b.price_date||'').localeCompare(String(a.price_date||''))||String(b.created_at||'').localeCompare(String(a.created_at||'')));if(rows.length<2)continue;const a=Number(rows[0].price),b=Number(rows[1].price);if(!Number.isFinite(a)||!Number.isFinite(b))continue;if(a>b+.000001)up++;else if(a<b-.000001)down++;else same++}
  return{up,down,same};
}
function pendingDeliveryNotes(){return (Array.isArray(invoices)?invoices:[]).filter(x=>x.document_type==='delivery_note'&&x.document_status!=='linked').sort((a,b)=>String(a.invoice_date||'').localeCompare(String(b.invoice_date||'')))}
function dateAgeDays(date){if(!date)return null;const a=new Date(`${date}T12:00:00`),b=new Date(`${localDate()}T12:00:00`);const n=Math.floor((b-a)/86400000);return Number.isFinite(n)?Math.max(0,n):null}
function ageLabel(age){if(age===null)return'';const cls=age>=30?'pending-age-old':age>=15?'pending-age-mid':'';return `<span class="${cls}">${age} día${age===1?'':'s'}</span>`}
function pendingDeliveryControl(){
  const rows=pendingDeliveryNotes();if(!rows.length)return'';
  const oldest=rows[0],age=dateAgeDays(oldest.invoice_date),amount=nsum(rows,'total'),visible=rows.slice(0,5);
  const list=visible.map(x=>{const a=dateAgeDays(x.invoice_date);return `<div class="pending-doc-row"><div class="pending-doc-row-head"><div><div class="pending-doc-name">${esc(x.supplier||'Sin proveedor')}</div><div class="pending-doc-row-meta">${fmtDate(x.invoice_date)} · ${esc(x.invoice_number||'Sin nº')} · pendiente ${ageLabel(a)}</div></div><div class="pending-doc-amount">${euro(x.total)}</div></div><div class="pending-doc-actions">${x.file_path?`<button type="button" class="secondary" data-pending-file="${esc(x.file_path)}">📎 Ver archivo</button>`:''}<button type="button" class="secondary" data-pending-edit="${esc(x.id)}">✏️ Abrir albarán</button></div></div>`}).join('');
  return `<div class="card pending-doc-card"><div class="pending-doc-head"><div><div class="pending-doc-title">📦 Albaranes esperando factura</div><div class="pending-doc-meta">No cuentan como compra definitiva hasta que llegue su factura.</div></div><div class="pending-doc-count">${rows.length}</div></div><div class="pending-doc-meta">Más antiguo: ${fmtDate(oldest.invoice_date)}${age!==null?` · hace ${age} día${age===1?'':'s'}`:''}<br>Importe indicado en albaranes: <strong>${euro(amount)}</strong></div><div class="pending-doc-list">${list}</div>${rows.length>5?`<div class="pending-doc-meta">+ ${rows.length-5} albarán${rows.length-5===1?'':'es'} más</div>`:''}<button type="button" id="openPendingDocuments" class="secondary pending-doc-btn">Ver todos los albaranes pendientes</button></div>`;
}
function documentsToReview(){return (Array.isArray(invoices)?invoices:[]).filter(x=>typeof window.documentNeedsReview==='function'&&window.documentNeedsReview(x))}
function reviewDocumentControl(){const rows=documentsToReview();if(!rows.length)return'';return `<div class="card review-doc-card"><div class="pending-doc-head"><div><div class="pending-doc-title">⚠ Documentos para revisar</div><div class="pending-doc-meta">Hay datos incompletos o albaranes demasiado antiguos. No bloquean el trabajo.</div></div><div class="pending-doc-count">${rows.length}</div></div><button type="button" id="openReviewDocuments" class="secondary review-doc-btn">Abrir revisión</button></div>`}
function monthlyIntelligence(){
  const inv=monthInvoices(selectedMonth),prevMonth=monthShift(selectedMonth,-1),prev=monthInvoices(prevMonth),formal=inv.filter(x=>(x.document_type||'invoice')==='invoice');
  const gross=inv.filter(x=>(Number(x.total)||0)>0).reduce((a,x)=>a+Number(x.total||0),0),credits=inv.filter(x=>(Number(x.total)||0)<0).reduce((a,x)=>a+Number(x.total||0),0),net=gross+credits;
  const base=nsum(formal,'base_amount'),vat=nsum(formal,'vat_amount'),prevNet=nsum(prev,'total');
  let comparison='Sin datos suficientes para comparar con el mes anterior.';
  if(inv.length&&prev.length&&Math.abs(prevNet)>.009){const pct=((net-prevNet)/Math.abs(prevNet))*100;const sign=pct>0?'+':'';comparison=`Compras netas: ${sign}${pct.toLocaleString('es-ES',{maximumFractionDigits:1})}% frente a ${monthLabel(prevMonth)}.`}
  const prov=new Map();for(const x of inv){const name=(x.supplier||'Sin proveedor').trim();prov.set(name,(prov.get(name)||0)+(Number(x.total)||0))}
  const top=[...prov.entries()].sort((a,b)=>Math.abs(b[1])-Math.abs(a[1])).slice(0,3);
  const alerts=priceAlertCounts(),tickets=inv.filter(x=>x.document_type==='ticket').length,pending=pendingDeliveryNotes().length;
  return `<div class="section-title">Control del mes</div><div class="card"><div class="intel-grid"><div class="intel-box"><div class="intel-label">Compras contabilizadas</div><div class="intel-value">${inv.length}</div><div class="intel-sub">${esc(monthLabel(selectedMonth))}${tickets?` · ${tickets} ticket${tickets===1?'':'s'}`:''}</div></div><div class="intel-box"><div class="intel-label">Compras netas</div><div class="intel-value">${euro(net)}</div><div class="intel-sub">Bruto ${euro(gross)}${credits?` · Abonos ${euro(credits)}`:''}</div></div><div class="intel-box"><div class="intel-label">Base facturas oficiales</div><div class="intel-value">${euro(base)}</div></div><div class="intel-box"><div class="intel-label">IVA facturas oficiales</div><div class="intel-value">${euro(vat)}</div></div></div><p class="intel-note">${esc(comparison)}${pending?` · Hay ${pending} albarán${pending===1?'':'es'} pendiente${pending===1?'':'s'} de factura.`:''}</p>${top.length?`<div class="intel-list">${top.map(([name,total])=>`<div class="intel-row"><span class="intel-name">${esc(name)}</span><span class="intel-amount">${euro(total)}</span></div>`).join('')}</div>`:'<p class="intel-note">Todavía no hay compras registradas en este mes.</p>'}<div class="intel-alerts"><span class="intel-pill intel-up">▲ ${alerts.up} subidas de precio</span><span class="intel-pill intel-down">▼ ${alerts.down} bajadas</span><span class="intel-pill intel-neutral">=${alerts.same} sin cambio</span></div></div>${reviewDocumentControl()}${pendingDeliveryControl()}`;
}
function openDocumentFilter(kind){route='invoices';renderApp();scrollTo(0,0);const filter=document.getElementById('documentTypeFilter');if(filter){filter.value=kind;filter.dispatchEvent(new Event('change',{bubbles:true}))}}
addDashboardStyles();
const previousDashboard=dashboard;
dashboard=function(){return previousDashboard()+monthlyIntelligence()};
const previousBindDashboardTools=bind;
bind=function(){
  previousBindDashboardTools();
  document.getElementById('openPendingDocuments')?.addEventListener('click',()=>openDocumentFilter('pending'));
  document.getElementById('openReviewDocuments')?.addEventListener('click',()=>openDocumentFilter('review'));
  document.querySelectorAll('[data-pending-file]').forEach(b=>b.addEventListener('click',()=>openInvoiceFile(b.dataset.pendingFile)));
  document.querySelectorAll('[data-pending-edit]').forEach(b=>b.addEventListener('click',()=>startEditInvoice(b.dataset.pendingEdit)));
};
if(session)renderApp();
})();
