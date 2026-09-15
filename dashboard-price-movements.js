(()=>{
function dpmText(value=''){
  return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[×*]/g,'x').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
}
function dpmSupplier(value=''){
  const s=dpmText(value);
  if(s.includes('assolim')||s.includes('asolim'))return'assolim foodservices';
  if(s.includes('maheso'))return'maheso gedesco';
  if(s.includes('transgourmet'))return'transgourmet iberica';
  return s;
}
function dpmName(value=''){
  return dpmText(value).replace(/^\d{3,7}\s+/,'').trim();
}
function dpmUnit(value=''){
  if(typeof window.canonicalProductUnit==='function')return window.canonicalProductUnit(value);
  const s=dpmText(value).replace(/\s+/g,'');
  const m={kgs:'kg',kilo:'kg',kilos:'kg',ud:'unidad',uds:'unidad',u:'unidad',unidades:'unidad',cajas:'caja',paquetes:'paquete',bandejas:'bandeja',botellas:'botella'};
  return m[s]||s||'sin especificar';
}
function dpmCutoff(month){return `${month}-31`}
function dpmMovements(){
  const month=String(selectedMonth||'').slice(0,7);if(!month)return{up:[],down:[]};
  const cutoff=dpmCutoff(month),groups=new Map();
  for(const p of Array.isArray(products)?products:[]){
    const date=String(p?.price_date||'');if(!date||date>cutoff)continue;
    const price=Number(p?.price);if(!Number.isFinite(price)||price<=0)continue;
    const key=`${dpmSupplier(p?.supplier)}|${dpmName(p?.name)}|${dpmUnit(p?.unit)}`;
    if(!groups.has(key))groups.set(key,[]);groups.get(key).push(p);
  }
  const up=[],down=[];
  for(const rows of groups.values()){
    rows.sort((a,b)=>String(b.price_date||'').localeCompare(String(a.price_date||''))||String(b.created_at||'').localeCompare(String(a.created_at||'')));
    if(rows.length<2)continue;
    const now=rows[0],prev=rows[1];
    if(String(now.price_date||'').slice(0,7)!==month)continue;
    const current=Number(now.price),before=Number(prev.price);if(!(before>0&&current>0))continue;
    const pct=((current-before)/before)*100;if(Math.abs(pct)<0.05)continue;
    const row={now,prev,current,before,pct};(pct>0?up:down).push(row);
  }
  const sorter=(a,b)=>String(b.now.price_date||'').localeCompare(String(a.now.price_date||''))||Math.abs(b.pct)-Math.abs(a.pct);
  up.sort(sorter);down.sort(sorter);return{up,down};
}
function dpmPrice(n){return Number(n).toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:3})+' €'}
function dpmRow(x,kind){
  const pct=Math.abs(x.pct).toLocaleString('es-ES',{minimumFractionDigits:1,maximumFractionDigits:1});
  return `<div class="dpm-row"><div class="dpm-main"><div class="dpm-name">${esc(x.now.name||'Producto')}</div><div class="dpm-meta">${esc(x.now.supplier||'Sin proveedor')} · ${fmtDate(x.now.price_date)} · ${esc(dpmUnit(x.now.unit))}</div></div><div class="dpm-side ${kind}"><div class="dpm-pct">${kind==='up'?'▲ +':'▼ -'}${pct}%</div><div class="dpm-prices">${dpmPrice(x.before)} → ${dpmPrice(x.current)}</div></div></div>`;
}
function dpmColumn(title,rows,kind){
  const shown=rows.slice(0,6);
  return `<div class="dpm-col ${kind}"><div class="dpm-col-head"><span>${title}</span><strong>${rows.length}</strong></div>${shown.length?shown.map(x=>dpmRow(x,kind)).join(''):`<div class="dpm-empty">Ninguno en ${esc(monthLabel(selectedMonth))}.</div>`}${rows.length>shown.length?`<div class="dpm-more">+ ${rows.length-shown.length} más</div>`:''}</div>`;
}
function dpmPanel(){
  const m=dpmMovements();
  return `<div class="section-title">Cambios de precio</div><div class="card dpm-card"><div class="dpm-intro">Productos que han subido o bajado respecto a su compra anterior del mismo proveedor y en la misma unidad.</div><div class="dpm-grid">${dpmColumn('▲ Han subido',m.up,'up')}${dpmColumn('▼ Han bajado',m.down,'down')}</div><button type="button" id="dpmOpenProducts" class="secondary dpm-button">Ver productos</button></div>`;
}
function dpmStyles(){
  if(document.getElementById('dashboardPriceMovementsStyle'))return;
  const s=document.createElement('style');s.id='dashboardPriceMovementsStyle';s.textContent=`
  .dpm-card{padding:14px}.dpm-intro{font-size:.78rem;color:var(--muted);line-height:1.4;margin-bottom:11px}.dpm-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.dpm-col{border:1px solid var(--line);border-radius:14px;padding:11px;background:#131410}.dpm-col.up{border-color:#55322f}.dpm-col.down{border-color:#2d5139}.dpm-col-head{display:flex;justify-content:space-between;gap:10px;font-size:.86rem;font-weight:950;margin-bottom:4px}.dpm-col.up .dpm-col-head{color:#ff9a91}.dpm-col.down .dpm-col-head{color:#7bd79a}.dpm-row{display:flex;justify-content:space-between;gap:10px;padding:10px 0;border-top:1px solid #2d2f29}.dpm-main{min-width:0}.dpm-name{font-size:.78rem;font-weight:900;line-height:1.25}.dpm-meta{font-size:.67rem;color:var(--muted);margin-top:3px;line-height:1.3}.dpm-side{text-align:right;white-space:nowrap}.dpm-pct{font-size:.75rem;font-weight:950}.dpm-side.up .dpm-pct{color:#ff9a91}.dpm-side.down .dpm-pct{color:#7bd79a}.dpm-prices{font-size:.68rem;color:#c3bfb6;margin-top:3px}.dpm-empty,.dpm-more{font-size:.72rem;color:var(--muted);padding:10px 0}.dpm-button{width:100%;margin-top:11px}@media(max-width:640px){.dpm-grid{grid-template-columns:1fr}.dpm-row{align-items:flex-start}}
  `;document.head.appendChild(s);
}
dpmStyles();
const dpmPreviousDashboard=dashboard;
dashboard=function(){return dpmPreviousDashboard()+dpmPanel()};
const dpmPreviousBind=bind;
bind=function(){
  dpmPreviousBind();
  document.getElementById('dpmOpenProducts')?.addEventListener('click',()=>{route='products';renderApp();scrollTo(0,0)});
};
if(session)renderApp();
})();
