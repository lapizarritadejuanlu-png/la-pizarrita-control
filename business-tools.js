(()=>{
let productFilterText='',productTrendFilter='all',providerFilterText='';

function addBusinessStyles(){
  if(document.getElementById('businessToolsStyle'))return;
  const s=document.createElement('style');
  s.id='businessToolsStyle';
  s.textContent=`
  .product-tools{padding:16px}.product-tools-grid{display:grid;grid-template-columns:1.35fr .85fr;gap:10px}
  .product-summary{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-top:12px;padding-top:12px;border-top:1px solid var(--line);font-size:.88rem;color:var(--muted)}
  .price-list{display:flex;flex-direction:column;gap:10px}.price-card{display:flex;justify-content:space-between;gap:14px;padding:15px 16px;border:1px solid var(--line);border-radius:15px;background:#151613}
  .price-main{min-width:0;flex:1}.price-name{font-weight:900}.price-meta{font-size:.8rem;color:var(--muted);margin-top:4px;line-height:1.35}.price-prev{font-size:.78rem;color:#b6b1a8;margin-top:5px}
  .price-side{text-align:right;min-width:118px}.price-now{font-weight:900;white-space:nowrap}.price-trend{font-size:.77rem;font-weight:900;margin-top:5px}.trend-up{color:#ff9a91}.trend-down{color:#7bd79a}.trend-same{color:#b9b5ad}.trend-new{color:#d9b86e}
  .provider-tools{padding:16px}.provider-tools-grid{display:grid;grid-template-columns:1.35fr .85fr;gap:10px}.provider-summary{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-top:12px;padding-top:12px;border-top:1px solid var(--line);font-size:.88rem;color:var(--muted)}
  .provider-month{font-weight:900;color:var(--text);white-space:nowrap}.provider-all{font-size:.78rem;color:var(--muted);margin-top:5px}
  .backup-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}.backup-note{color:var(--muted);font-size:.86rem;line-height:1.4;margin:0}
  @media(max-width:540px){.product-tools-grid,.provider-tools-grid,.backup-actions{grid-template-columns:1fr}.price-card{align-items:flex-start}.price-side{min-width:105px}}
  `;
  document.head.appendChild(s);
}
function normText(s=''){return String(s).trim().toLowerCase().replace(/\s+/g,' ')}
function normInvoiceNumber(s=''){return normText(s).replace(/\s+/g,'')}
function productGroups(){
  const map=new Map();
  for(const p of Array.isArray(products)?products:[]){
    const key=`${normText(p.name)}|${normText(p.unit)}`;
    if(!map.has(key))map.set(key,[]);
    map.get(key).push(p);
  }
  return [...map.entries()].map(([key,rows])=>{
    rows.sort((a,b)=>String(b.price_date||'').localeCompare(String(a.price_date||''))||String(b.created_at||'').localeCompare(String(a.created_at||'')));
    const latest=rows[0],prev=rows[1]||null;
    const now=Number(latest?.price||0),before=prev?Number(prev.price||0):null;
    let pct=null,trend='new';
    if(prev&&before!==0){pct=((now-before)/Math.abs(before))*100;trend=pct>0.001?'up':pct<-.001?'down':'same'}
    else if(prev)trend='same';
    return{key,rows,latest,prev,pct,trend};
  }).sort((a,b)=>String(a.latest?.name||'').localeCompare(String(b.latest?.name||''),'es',{sensitivity:'base'}));
}
function trendLabel(g){
  if(g.trend==='new')return 'Primera referencia';
  if(g.trend==='same')return '= Sin cambio';
  const n=Math.abs(g.pct||0).toLocaleString('es-ES',{minimumFractionDigits:1,maximumFractionDigits:1});
  return g.trend==='up'?`▲ +${n}%`:`▼ -${n}%`;
}
function businessProductsView(){
  const groups=productGroups();
  const cards=groups.map(g=>{
    const p=g.latest,prev=g.prev;
    const search=`${p?.name||''} ${p?.supplier||''} ${prev?.supplier||''}`.toLowerCase();
    const prevText=prev?`Antes: ${euro(prev.price)} / ${esc(prev.unit||p.unit||'unidad')} · ${esc(prev.supplier||'')} · ${fmtDate(prev.price_date)}`:'Todavía no hay un precio anterior para comparar.';
    const source=p?.source_invoice_id?' · 📄 factura':'';
    return `<div class="price-card product-smart-row" data-search="${esc(search)}" data-trend="${g.trend}"><div class="price-main"><div class="price-name">${esc(p?.name||'Sin nombre')}</div><div class="price-meta">${esc(p?.supplier||'Sin proveedor')} · ${fmtDate(p?.price_date)} · ${g.rows.length} registro${g.rows.length===1?'':'s'}${source}</div><div class="price-prev">${prevText}</div></div><div class="price-side"><div class="price-now">${euro(p?.price)} / ${esc(p?.unit||'unidad')}</div><div class="price-trend trend-${g.trend}">${trendLabel(g)}</div></div></div>`;
  }).join('');
  return `<h2>Productos</h2><div class="card"><div class="form-grid"><div class="field"><label>Producto</label><input id="prodName"></div><div class="field"><label>Proveedor</label><input id="prodSupplier"></div><div class="field"><label>Fecha</label><input id="prodDate" type="date" value="${localDate()}"></div><div class="field"><label>Precio</label><input id="prodPrice" type="number" inputmode="decimal" step="0.001"></div><div class="field"><label>Unidad</label><select id="prodUnit"><option>kg</option><option>unidad</option><option>caja</option><option>bandeja</option><option>litro</option><option>sin especificar</option></select></div></div><button id="saveProduct" class="primary wide">Guardar precio</button></div>${groups.length?`<div class="card product-tools"><div class="product-tools-grid"><input id="productSearch" type="search" placeholder="Buscar producto o proveedor" value="${esc(productFilterText)}"><select id="productTrend"><option value="all" ${productTrendFilter==='all'?'selected':''}>Todos</option><option value="up" ${productTrendFilter==='up'?'selected':''}>Han subido</option><option value="down" ${productTrendFilter==='down'?'selected':''}>Han bajado</option><option value="same" ${productTrendFilter==='same'?'selected':''}>Sin cambio</option><option value="new" ${productTrendFilter==='new'?'selected':''}>Nuevos</option></select></div><div class="product-summary"><span id="productVisibleCount"></span><strong id="productRecordCount"></strong></div></div><div class="price-list">${cards}</div><div id="productNoResults" class="empty" style="display:none">No hay productos con ese filtro.</div>`:'<div class="empty">Sin precios. Cuando guardes una factura con productos detectados, aparecerán aquí automáticamente.</div>'}`;
}
function applyProductFilters(){
  const rows=[...document.querySelectorAll('.product-smart-row')];
  if(!rows.length)return;
  const q=productFilterText.trim().toLowerCase();let count=0,records=0;
  for(const row of rows){const show=(!q||(row.dataset.search||'').includes(q))&&(productTrendFilter==='all'||row.dataset.trend===productTrendFilter);row.style.display=show?'flex':'none';if(show){count++;const m=row.querySelector('.price-meta')?.textContent?.match(/·\s(\d+)\sregistro/);if(m)records+=Number(m[1])||0}}
  const c=document.getElementById('productVisibleCount'),r=document.getElementById('productRecordCount'),e=document.getElementById('productNoResults');
  if(c)c.textContent=`${count} producto${count===1?'':'s'}`;
  if(r)r.textContent=`${records} precio${records===1?'':'s'} guardado${records===1?'':'s'}`;
  if(e)e.style.display=count?'none':'block';
}

function providerMonthOptions(){
  const set=new Set([selectedMonth,localDate().slice(0,7)]);
  for(const x of invoices)if(x.invoice_date)set.add(x.invoice_date.slice(0,7));
  const d=new Date();for(let i=0;i<18;i++){const x=new Date(d.getFullYear(),d.getMonth()-i,2);set.add(`${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}`)}
  return [...set].sort().reverse().map(m=>`<option value="${esc(m)}" ${m===selectedMonth?'selected':''}>${esc(monthLabel(m))}</option>`).join('');
}
function businessProvidersView(){
  const map=new Map();
  for(const x of invoices){
    const name=(x.supplier||'Sin proveedor').trim()||'Sin proveedor',key=normText(name);
    if(!map.has(key))map.set(key,{name,total:0,monthTotal:0,count:0,monthCount:0,last:''});
    const p=map.get(key),amount=Number(x.total)||0;p.total+=amount;p.count++;
    if((x.invoice_date||'').slice(0,7)===selectedMonth){p.monthTotal+=amount;p.monthCount++}
    if(!p.last||String(x.invoice_date||'')>p.last)p.last=x.invoice_date||'';
  }
  const rows=[...map.values()].sort((a,b)=>Math.abs(b.monthTotal)-Math.abs(a.monthTotal)||Math.abs(b.total)-Math.abs(a.total)||a.name.localeCompare(b.name,'es',{sensitivity:'base'}));
  const cards=rows.map(p=>`<div class="row provider-smart-row" data-search="${esc(p.name.toLowerCase())}" data-month-total="${p.monthTotal}"><div><div class="row-title">${esc(p.name)}</div><div class="row-meta">${p.monthCount} factura${p.monthCount===1?'':'s'} en ${esc(monthLabel(selectedMonth))} · última ${fmtDate(p.last)}</div><div class="provider-all">Acumulado: ${euro(p.total)} · ${p.count} factura${p.count===1?'':'s'}</div></div><div class="provider-month">${euro(p.monthTotal)}</div></div>`).join('');
  return `<h2>Proveedores</h2>${rows.length?`<div class="card provider-tools"><div class="provider-tools-grid"><input id="providerSearch" type="search" placeholder="Buscar proveedor" value="${esc(providerFilterText)}"><select id="providerMonth">${providerMonthOptions()}</select></div><div class="provider-summary"><span id="providerVisibleCount"></span><strong id="providerVisibleTotal"></strong></div></div><div class="list provider-list">${cards}</div><div id="providerNoResults" class="empty" style="display:none">No hay proveedores con ese filtro.</div>`:'<div class="empty">Sin proveedores.</div>'}`;
}
function applyProviderFilters(){
  const rows=[...document.querySelectorAll('.provider-smart-row')];if(!rows.length)return;
  const q=providerFilterText.trim().toLowerCase();let count=0,total=0;
  for(const row of rows){const show=!q||(row.dataset.search||'').includes(q);row.style.display=show?'flex':'none';if(show){count++;total+=Number(row.dataset.monthTotal)||0}}
  const c=document.getElementById('providerVisibleCount'),t=document.getElementById('providerVisibleTotal'),e=document.getElementById('providerNoResults');
  if(c)c.textContent=`${count} proveedor${count===1?'':'es'}`;if(t)t.textContent=`Mes: ${euro(total)}`;if(e)e.style.display=count?'none':'block';
}

function csvCell(v){const s=String(v??'');return /[;"\n\r]/.test(s)?`"${s.replace(/"/g,'""')}"`:s}
function dec(v,d=2){const n=Number(v);return Number.isFinite(n)?n.toFixed(d).replace('.',','):''}
function downloadCsv(filename,headers,rows){
  const body=[headers,...rows].map(row=>row.map(csvCell).join(';')).join('\r\n');
  const blob=new Blob(['\ufeff'+body],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
}
function exportInvoicesCsv(){
  const rows=[...invoices].sort((a,b)=>String(b.invoice_date||'').localeCompare(String(a.invoice_date||''))).map(x=>[x.invoice_date||'',x.supplier||'',x.invoice_number||'',dec(x.base_amount),dec(x.vat_amount),dec(x.total)]);
  downloadCsv(`facturas-la-pizarrita-${localDate()}.csv`,['Fecha','Proveedor','Nº factura','Base imponible','IVA','Total'],rows);toast(`Exportadas ${rows.length} factura${rows.length===1?'':'s'}`);
}
function exportProductsCsv(){
  const byId=new Map(invoices.map(x=>[x.id,x.invoice_number||'']));
  const rows=[...products].sort((a,b)=>String(b.price_date||'').localeCompare(String(a.price_date||''))).map(x=>[x.price_date||'',x.name||'',x.supplier||'',dec(x.price,3),x.unit||'',x.source_invoice_id?byId.get(x.source_invoice_id)||'Sí':'Manual']);
  downloadCsv(`precios-la-pizarrita-${localDate()}.csv`,['Fecha','Producto','Proveedor','Precio','Unidad','Factura origen'],rows);toast(`Exportados ${rows.length} precio${rows.length===1?'':'s'}`);
}

productsView=businessProductsView;
providersView=businessProvidersView;
const previousMoreView=moreView;
moreView=function(){return previousMoreView()+`<div class="section-title">Copia para gestor</div><div class="card"><p class="backup-note">Descarga una copia en CSV de tus facturas o del historial de precios. Se abre directamente con Excel y sirve como respaldo.</p><div class="backup-actions"><button id="exportInvoices" class="secondary">⬇️ Exportar facturas</button><button id="exportProducts" class="secondary">⬇️ Exportar precios</button></div></div>`};

const previousSaveInvoice=saveInvoice;
saveInvoice=async function(){
  if(!editingInvoiceId){
    const supplier=normText(v('invSupplier')),number=normInvoiceNumber(v('invNumber'));
    if(supplier&&number){
      const dup=invoices.find(x=>normText(x.supplier)===supplier&&normInvoiceNumber(x.invoice_number)===number);
      if(dup){toast(`Esa factura ya está guardada · ${fmtDate(dup.invoice_date)} · ${euro(dup.total)}`);return}
    }
  }
  return previousSaveInvoice();
};

const previousBind=bind;
bind=function(){
  previousBind();addBusinessStyles();
  document.getElementById('productSearch')?.addEventListener('input',e=>{productFilterText=e.target.value;applyProductFilters()});
  document.getElementById('productTrend')?.addEventListener('change',e=>{productTrendFilter=e.target.value;applyProductFilters()});
  document.getElementById('providerSearch')?.addEventListener('input',e=>{providerFilterText=e.target.value;applyProviderFilters()});
  document.getElementById('providerMonth')?.addEventListener('change',e=>{selectedMonth=e.target.value;renderApp();scrollTo(0,0)});
  document.getElementById('exportInvoices')?.addEventListener('click',exportInvoicesCsv);
  document.getElementById('exportProducts')?.addEventListener('click',exportProductsCsv);
  applyProductFilters();
  applyProviderFilters();
};

addBusinessStyles();
if(session)renderApp();
})();
