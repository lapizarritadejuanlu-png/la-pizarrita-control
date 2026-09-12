(()=>{
function psText(s=''){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim()}
function psUnit(u=''){return typeof window.canonicalProductUnit==='function'?window.canonicalProductUnit(u):psText(u)||'sin especificar'}

// Cinturón de seguridad: si la IA asigna el mismo nombre a dos líneas con
// unidades distintas dentro del mismo documento, guardamos las líneas en el
// documento pero NO las convertimos automáticamente en precios de Productos.
const psPreviousApi=api;
api=async function(path,options={}){
  const method=String(options?.method||'GET').toUpperCase();
  if(path==='/rest/v1/products'&&method==='POST'&&Array.isArray(options?.body)){
    const rows=options.body,unitsByName=new Map();
    for(const r of rows){const k=psText(r?.name);if(!k)continue;if(!unitsByName.has(k))unitsByName.set(k,new Set());unitsByName.get(k).add(psUnit(r?.unit))}
    const ambiguous=new Set([...unitsByName.entries()].filter(([,units])=>units.size>1).map(([name])=>name));
    if(ambiguous.size){
      const clean=rows.filter(r=>!ambiguous.has(psText(r?.name))),removed=rows.length-clean.length;
      if(removed)toast(`⚠ ${removed} precio${removed===1?'':'s'} dudoso${removed===1?'':'s'} no se ha${removed===1?'':'n'} añadido a Productos. Revisa las líneas del documento.`);
      if(!clean.length)return[];
      options={...options,body:clean};
    }
  }
  return psPreviousApi(path,options);
};

function psGroups(){
  const map=new Map();
  for(const p of Array.isArray(products)?products:[]){const key=`${psText(p.name)}|${psUnit(p.unit)}`;if(!map.has(key))map.set(key,[]);map.get(key).push(p)}
  const nameSourceUnits=new Map();
  for(const p of Array.isArray(products)?products:[]){if(!p?.source_invoice_id)continue;const k=`${psText(p.name)}|${p.source_invoice_id}`;if(!nameSourceUnits.has(k))nameSourceUnits.set(k,new Set());nameSourceUnits.get(k).add(psUnit(p.unit))}
  return [...map.values()].map(rows=>{
    rows.sort((a,b)=>String(b.price_date||'').localeCompare(String(a.price_date||''))||String(b.created_at||'').localeCompare(String(a.created_at||''))||String(b.id||'').localeCompare(String(a.id||'')));
    const latest=rows[0],prev=rows[1]||null,now=Number(latest?.price),before=Number(prev?.price);
    let pct=null,trend='new';
    if(prev&&Number.isFinite(now)&&Number.isFinite(before)&&Math.abs(before)>.000001){pct=((now-before)/Math.abs(before))*100;trend=pct>.001?'up':pct<-.001?'down':'same'}else if(prev)trend='same';
    const mixedUnits=rows.some(p=>p?.source_invoice_id&&(nameSourceUnits.get(`${psText(p.name)}|${p.source_invoice_id}`)?.size||0)>1);
    const noReliableOrder=!!(prev&&latest?.source_invoice_id&&latest.source_invoice_id===prev?.source_invoice_id&&String(latest.price_date||'')===String(prev.price_date||'')&&Number.isFinite(now)&&Number.isFinite(before)&&Math.abs(now-before)>.000001);
    return{rows,latest,prev,pct,trend,review:mixedUnits||noReliableOrder};
  }).sort((a,b)=>String(a.latest?.name||'').localeCompare(String(b.latest?.name||''),'es',{sensitivity:'base'}));
}
function psInvoice(id){return (Array.isArray(invoices)?invoices:[]).find(x=>x.id===id)||null}
function psButton(label,id){const inv=psInvoice(id);if(!inv?.file_path)return'';return `<button type="button" class="secondary product-source-file" data-product-source="${esc(id)}">${label}</button>`}
function decorateProductCards(){
  if(route!=='products')return;
  const groups=psGroups(),cards=[...document.querySelectorAll('.product-smart-row')],select=document.getElementById('productTrend');
  if(select&&!select.querySelector('option[value="review"]')){const o=document.createElement('option');o.value='review';o.textContent='⚠ Revisar datos';select.appendChild(o)}
  cards.forEach((card,i)=>{
    const g=groups[i];if(!g)return;
    card.querySelector('.product-source-actions')?.remove();card.querySelector('.product-review-warning')?.remove();
    if(g.review){
      card.dataset.trend='review';
      const t=card.querySelector('.price-trend');if(t){t.textContent='⚠ Revisar';t.className='price-trend trend-new'}
      const w=document.createElement('div');w.className='product-review-warning';w.textContent='⚠ No uso estos datos como subida/bajada hasta comprobar el documento: hay unidades distintas o dos precios sin un orden de fecha fiable.';card.querySelector('.price-main')?.appendChild(w)
    }
    const ids=[g.latest?.source_invoice_id,g.prev?.source_invoice_id].filter(Boolean),same=ids.length===2&&ids[0]===ids[1];let html='';
    if(ids[0])html+=psButton(same?'📄 Ver factura (ambos precios)':'📄 Ver factura actual',ids[0]);
    if(ids[1]&&!same)html+=psButton('📄 Ver factura anterior',ids[1]);
    if(html){const box=document.createElement('div');box.className='product-source-actions';box.innerHTML=html;card.querySelector('.price-main')?.appendChild(box)}
    if(same&&g.prev){const prev=card.querySelector('.price-prev');if(prev&&!prev.textContent.includes('misma factura'))prev.append(' · misma factura')}
  });
  document.querySelectorAll('[data-product-source]').forEach(b=>b.addEventListener('click',()=>{const inv=psInvoice(b.dataset.productSource);if(inv?.file_path)openInvoiceFile(inv.file_path)}));
}
function safeCounts(){const out={up:0,down:0,same:0,review:0};for(const g of psGroups()){if(g.review){out.review++;continue}if(g.trend==='up')out.up++;else if(g.trend==='down')out.down++;else if(g.trend==='same')out.same++}return out}
function decorateDashboardPriceAlerts(){
  if(route!=='dashboard')return;
  const c=safeCounts(),up=document.querySelector('.intel-pill.intel-up'),down=document.querySelector('.intel-pill.intel-down'),neutral=document.querySelector('.intel-pill.intel-neutral');
  if(up){up.textContent=`▲ ${c.up} subida${c.up===1?'':'s'} de precio`;up.dataset.openTrend='up';up.setAttribute('role','button');up.tabIndex=0}
  if(down){down.textContent=`▼ ${c.down} bajada${c.down===1?'':'s'}`;down.dataset.openTrend='down';down.setAttribute('role','button');down.tabIndex=0}
  if(neutral){neutral.textContent=`=${c.same} sin cambio`;neutral.dataset.openTrend='same';neutral.setAttribute('role','button');neutral.tabIndex=0}
  const host=neutral?.parentElement||up?.parentElement;
  if(host&&c.review&&!host.querySelector('.intel-review-products')){const x=document.createElement('span');x.className='intel-pill intel-neutral intel-review-products';x.dataset.openTrend='review';x.setAttribute('role','button');x.tabIndex=0;x.textContent=`⚠ ${c.review} por revisar`;host.appendChild(x)}
  document.querySelectorAll('[data-open-trend]').forEach(el=>{const open=()=>{const trend=el.dataset.openTrend;route='products';renderApp();setTimeout(()=>{const s=document.getElementById('productTrend');if(s){s.value=trend;s.dispatchEvent(new Event('change',{bubbles:true}))}scrollTo(0,0)},30)};el.addEventListener('click',open);el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open()}})})
}
function addStyles(){if(document.getElementById('productPriceSafetyStyle'))return;const s=document.createElement('style');s.id='productPriceSafetyStyle';s.textContent=`.product-source-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}.product-source-actions button{padding:7px 9px;font-size:.72rem}.product-review-warning{margin-top:8px;padding:8px 9px;border:1px solid #6a5730;border-radius:10px;background:#211b10;color:#e7c77b;font-size:.73rem;line-height:1.35;font-weight:800}.intel-pill[data-open-trend]{cursor:pointer}`;document.head.appendChild(s)}
const oldBind=bind;bind=function(){oldBind();addStyles();decorateProductCards();decorateDashboardPriceAlerts()};
window.safeProductTrendGroups=psGroups;window.safeProductTrendCounts=safeCounts;addStyles();if(session)renderApp();
})();
