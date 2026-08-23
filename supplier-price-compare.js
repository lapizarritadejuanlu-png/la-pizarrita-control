(()=>{
function spcStyles(){if(document.getElementById('supplierPriceCompareStyle'))return;const s=document.createElement('style');s.id='supplierPriceCompareStyle';s.textContent=`.spc-card{border-color:#31483e;background:linear-gradient(145deg,#141b17,#11130f)}.spc-title{font-size:1rem;font-weight:950}.spc-help{font-size:.73rem;color:var(--muted);line-height:1.4;margin-top:4px}.spc-list{margin-top:10px}.spc-row{padding:10px 0;border-top:1px solid #29372f}.spc-row:first-child{border-top:0;padding-top:0}.spc-head{display:flex;justify-content:space-between;gap:10px}.spc-name{font-size:.83rem;font-weight:900}.spc-save{font-size:.8rem;font-weight:950;color:#7bd79a;white-space:nowrap}.spc-meta{font-size:.7rem;color:var(--muted);line-height:1.45;margin-top:3px}.spc-open{padding:6px 8px!important;font-size:.68rem!important;margin-top:6px}`;document.head.appendChild(s)}
function spcNorm(s=''){return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim()}
function spcRows(){
  const productGroups=new Map();
  for(const p of Array.isArray(products)?products:[]){
    const price=Number(p.price);if(!p?.name||!Number.isFinite(price)||price<=0)continue;
    const key=`${spcNorm(p.name)}|${spcNorm(p.unit)}`,supplier=spcNorm(p.supplier)||'sin proveedor';
    if(!productGroups.has(key))productGroups.set(key,new Map());const bySupplier=productGroups.get(key),old=bySupplier.get(supplier);
    if(!old||String(p.price_date||'')>String(old.price_date||'')||(p.price_date===old.price_date&&String(p.created_at||'')>String(old.created_at||'')))bySupplier.set(supplier,p);
  }
  const out=[];
  for(const bySupplier of productGroups.values()){
    const refs=[...bySupplier.values()];if(refs.length<2)continue;refs.sort((a,b)=>Number(a.price)-Number(b.price));const cheap=refs[0],expensive=refs[refs.length-1],cheapPrice=Number(cheap.price),expPrice=Number(expensive.price);if(expPrice<=cheapPrice)continue;
    const saving=expPrice-cheapPrice,pct=expPrice?saving/expPrice*100:0;if(pct<1)continue;out.push({name:cheap.name,unit:cheap.unit||'unidad',cheap,expensive,saving,pct,suppliers:refs.length});
  }
  return out.sort((a,b)=>b.pct-a.pct);
}
function spcOpen(name){route='products';renderApp();scrollTo(0,0);setTimeout(()=>{const q=document.getElementById('productSearch');if(!q)return;q.value=name||'';q.dispatchEvent(new Event('input',{bubbles:true}));q.focus()},0)}
function spcCard(){const all=spcRows(),rows=all.slice(0,5);if(!rows.length)return'';return `<div class="section-title">Comparar proveedores</div><div class="card spc-card"><div class="spc-title">💡 Oportunidades de compra</div><div class="spc-help">Comparo la última referencia disponible del mismo producto y unidad entre proveedores distintos.</div><div class="spc-list">${rows.map(x=>`<div class="spc-row"><div class="spc-head"><div class="spc-name">${esc(x.name)}</div><div class="spc-save">-${x.pct.toLocaleString('es-ES',{maximumFractionDigits:1})}%</div></div><div class="spc-meta">Más barato: <strong>${esc(x.cheap.supplier||'Sin proveedor')} · ${euro(x.cheap.price)}</strong> / ${esc(x.unit)} · ${fmtDate(x.cheap.price_date)}<br>Más caro: ${esc(x.expensive.supplier||'Sin proveedor')} · ${euro(x.expensive.price)} / ${esc(x.unit)} · ${fmtDate(x.expensive.price_date)} · ${x.suppliers} proveedores comparados</div><button type="button" class="secondary spc-open" data-spc-product="${esc(x.name)}">Ver historial</button></div>`).join('')}</div></div>`}
spcStyles();const prevDashboardSPC=dashboard;dashboard=function(){const html=prevDashboardSPC(),marker='<div class="section-title">Control del mes</div>';return html.includes(marker)?html.replace(marker,spcCard()+marker):html+spcCard()};const prevBindSPC=bind;bind=function(){prevBindSPC();spcStyles();document.querySelectorAll('[data-spc-product]').forEach(b=>b.addEventListener('click',()=>spcOpen(b.dataset.spcProduct)))};if(session)renderApp();
})();
