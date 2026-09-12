(()=>{
let providerCompareOpen=false,providerCompareQuery='';

function pcText(s=''){
  return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
}
function pcUnit(u=''){
  const x=pcText(u);
  const map={litro:'l',litros:'l',lt:'l',lts:'l',kgs:'kg',kilo:'kg',kilos:'kg',unidad:'unidad',unidades:'unidad',ud:'unidad',uds:'unidad',caja:'pack',cajas:'pack',pack:'pack',packs:'pack',paquete:'pack',paquetes:'pack',retractil:'pack',bandeja:'pack',bandejas:'pack',botella:'botella',botellas:'botella',lata:'lata',latas:'lata',llauna:'lata',llaunes:'lata'};
  return map[x]||x||'sin especificar';
}
function pcIdentity(name=''){
  let s=pcText(name);
  if(!s)return'';
  if(/\baquarius\b/.test(s))return /\bnaranja\b|\btaronja\b/.test(s)?'aquarius naranja':'aquarius limon';
  if(/\b(coca cola|cocacola)\b/.test(s)){
    if(/\bzero\s+zero\b/.test(s))return'coca cola zero zero';
    if(/\bzero\b/.test(s))return'coca cola zero';
    if(/\blight\b/.test(s))return'coca cola light';
    return'coca cola';
  }
  if(/\bfanta\b/.test(s)){
    if(/\blimon\b|\bllimo\b/.test(s))return'fanta limon';
    if(/\bnaranja\b|\btaronja\b|\btaron\b/.test(s))return'fanta naranja';
  }
  if(/\bnestea\b/.test(s)){
    if(/\blimon\b|\bllimo\b/.test(s))return'nestea limon';
  }
  s=s.replace(/\b\d+(?:[.,]\d+)?\s*(?:kg|kgs|g|gr|grs|l|lt|lts|ml|cl)\b/g,' ')
     .replace(/\b\d+\s*[x*]\s*\d+(?:[.,]\d+)?\s*(?:kg|kgs|g|gr|grs|l|lt|lts|ml|cl)\b/g,' ')
     .replace(/\b(?:retractil|pack|packs|caja|cajas|paquete|paquetes|lata|latas|llauna|llaunes|botella|botellas|pet|pets|bandeja|bandejas|contiene|contenido|unidades|unidad|uds|ud|de|del|con)\b/g,' ')
     .replace(/\b\d+\b/g,' ').replace(/\s+/g,' ').trim();
  return s;
}
function pcDisplayName(identity,rows){
  if(identity==='aquarius limon')return'AQUARIUS LIMÓN 33 CL';
  if(identity==='aquarius naranja')return'AQUARIUS NARANJA';
  if(identity.startsWith('coca cola'))return identity.toUpperCase();
  if(identity.startsWith('fanta '))return identity.toUpperCase();
  if(identity.startsWith('nestea '))return identity.toUpperCase();
  const names=(rows||[]).map(x=>String(x?.name||'')).filter(Boolean).sort((a,b)=>a.length-b.length);
  return names[0]||identity.toUpperCase();
}
function pcInvoice(id){return (Array.isArray(invoices)?invoices:[]).find(x=>x.id===id)||null}
function pcItems(inv){const a=inv?.extraction_json?.items;return Array.isArray(a)?a:[]}
function pcFindItem(p){
  const inv=pcInvoice(p?.source_invoice_id);if(!inv)return null;
  const exact=pcItems(inv).find(x=>pcText(x?.description)===pcText(p?.name));if(exact)return exact;
  const id=pcIdentity(p?.name);return pcItems(inv).find(x=>pcIdentity(x?.description)===id)||null;
}
function pcPackageFromText(text=''){
  const s=pcText(text);
  const m=s.match(/(?:retractil|pack|caja|contiene|contenido)\s*(?:de|con)?\s*(\d{1,3})\s*(latas?|llaunas?|botellas?|unidades?|uds?|pets?)/i);
  if(!m)return null;
  const n=Number(m[1]);if(!Number.isFinite(n)||n<2)return null;
  const raw=pcText(m[2]);let unit='unidad';if(raw.startsWith('lat')||raw.startsWith('llaun'))unit='lata';else if(raw.startsWith('bot')||raw.startsWith('pet'))unit='botella';
  return{units:n,unit};
}
function pcSizeFromText(text=''){
  const s=pcText(text);const m=s.match(/\b(\d+(?:[.,]\d+)?)\s*(ml|cl|l|g|kg)\b/i);if(!m)return null;
  return{value:Number(String(m[1]).replace(',','.')),unit:pcText(m[2])};
}
function pcComparable(p){
  const price=Number(p?.price);if(!Number.isFinite(price)||price<=0)return null;
  const unit=pcUnit(p?.unit),item=pcFindItem(p),name=String(p?.name||'');
  if(unit==='kg'||unit==='l')return{product:p,basis:price,basisKey:unit,basisLabel:unit,packageUnits:null,packageUnit:null,size:null};
  if(['unidad','botella','lata'].includes(unit)){
    const size=pcSizeFromText(name)||pcSizeFromText(item?.description||'');
    const sizeKey=size?`${size.value}${size.unit}`:'';
    return{product:p,basis:price,basisKey:`each:${unit}:${sizeKey}`,basisLabel:unit,packageUnits:1,packageUnit:unit,size};
  }
  if(unit==='pack'){
    const embedded=pcPackageFromText(name)||pcPackageFromText(item?.description||'');
    const packageUnits=Number(item?.package_units)||embedded?.units||null;
    const packageUnit=pcUnit(item?.package_unit||embedded?.unit||(/\b(?:lata|llauna)s?\b/i.test(name)?'lata':/\bbotellas?\b/i.test(name)?'botella':''));
    const size=item?.content_size&&item?.content_size_unit?{value:Number(item.content_size),unit:pcText(item.content_size_unit)}:(pcSizeFromText(name)||pcSizeFromText(item?.description||''));
    if(!packageUnits||packageUnits<1||!packageUnit)return null;
    const sizeKey=size&&Number.isFinite(size.value)?`${size.value}${size.unit}`:'';
    return{product:p,basis:price/packageUnits,basisKey:`each:${packageUnit}:${sizeKey}`,basisLabel:packageUnit,packageUnits,packageUnit,size};
  }
  return null;
}
function pcSupplierKey(s=''){return pcText(s)}
function pcGroups(){
  const byIdentity=new Map();
  for(const p of Array.isArray(products)?products:[]){const id=pcIdentity(p?.name);if(!id)continue;if(!byIdentity.has(id))byIdentity.set(id,[]);byIdentity.get(id).push(p)}
  const result=[];
  for(const [identity,rows] of byIdentity){
    const bySupplier=new Map();
    for(const p of rows){const k=pcSupplierKey(p?.supplier);if(!k)continue;if(!bySupplier.has(k))bySupplier.set(k,[]);bySupplier.get(k).push(p)}
    if(bySupplier.size<2)continue;
    const candidates=[];
    for(const supplierRows of bySupplier.values()){
      supplierRows.sort((a,b)=>String(b.price_date||'').localeCompare(String(a.price_date||''))||String(b.created_at||'').localeCompare(String(a.created_at||'')));
      let chosen=null;for(const p of supplierRows){const c=pcComparable(p);if(c){chosen=c;break}}
      if(chosen)candidates.push(chosen);
    }
    const basisMap=new Map();for(const c of candidates){if(!basisMap.has(c.basisKey))basisMap.set(c.basisKey,[]);basisMap.get(c.basisKey).push(c)}
    for(const comparable of basisMap.values()){
      const suppliers=new Set(comparable.map(c=>pcSupplierKey(c.product.supplier)));if(suppliers.size<2)continue;
      comparable.sort((a,b)=>a.basis-b.basis);
      result.push({identity,rows,comparable,winner:comparable[0],display:pcDisplayName(identity,rows)});
    }
  }
  return result.sort((a,b)=>a.display.localeCompare(b.display,'es',{sensitivity:'base'}));
}
function pcMoney(n,d=2){return Number(n).toLocaleString('es-ES',{minimumFractionDigits:d,maximumFractionDigits:d})+' €'}
function pcRowText(c){
  const p=c.product;
  if(c.packageUnits&&c.packageUnits>1)return `${pcMoney(p.price)} / ${pcUnit(p.unit)==='pack'?(pcText(p.unit)==='caja'?'caja':'pack'):'pack'} de ${c.packageUnits} · ${pcMoney(c.basis,3)} / ${c.basisLabel}`;
  return `${pcMoney(p.price,3)} / ${c.basisLabel}`;
}
function pcSavings(group){
  const a=group.comparable[0],b=group.comparable[group.comparable.length-1];if(!a||!b||b.basis<=a.basis)return'';
  const pct=((b.basis-a.basis)/b.basis)*100;
  if(a.packageUnits&&b.packageUnits&&a.packageUnits===b.packageUnits){const diff=Number(b.product.price)-Number(a.product.price);return `Ahorro frente al más caro: ${pcMoney(diff)} por ${a.packageUnits} ${a.packageUnit}${a.packageUnits===1?'':'s'} · ${pct.toLocaleString('es-ES',{minimumFractionDigits:1,maximumFractionDigits:1})}%`;}
  return `Ahorro frente al más caro: ${pcMoney(b.basis-a.basis,3)} / ${a.basisLabel} · ${pct.toLocaleString('es-ES',{minimumFractionDigits:1,maximumFractionDigits:1})}%`;
}
function pcSourceButton(c){const inv=pcInvoice(c.product?.source_invoice_id);if(!inv?.file_path)return'';return `<button type="button" class="pc-source" data-pc-source="${esc(inv.id)}">📄</button>`}
function pcCard(g){
  const rows=g.comparable.map((c,i)=>`<div class="pc-provider-row ${i===0?'pc-cheapest':''}"><div><div class="pc-provider-name">${i===0?'✅ ':''}${esc(c.product.supplier||'Sin proveedor')}</div><div class="pc-provider-meta">${fmtDate(c.product.price_date)} · ${esc(pcRowText(c))}</div></div><div class="pc-provider-side">${i===0?'<span class="pc-best">MÁS BARATO</span>':''}${pcSourceButton(c)}</div></div>`).join('');
  return `<div class="pc-card" data-pc-search="${esc(pcText(g.display+' '+g.comparable.map(x=>x.product.supplier).join(' ')))}"><div class="pc-title">${esc(g.display)}</div><div class="pc-winner">Mejor precio: <strong>${esc(g.winner.product.supplier||'')}</strong></div>${rows}<div class="pc-saving">${esc(pcSavings(g))}</div></div>`;
}
function pcRenderResults(){
  const host=document.getElementById('providerCompareResults');if(!host)return;
  const q=pcText(providerCompareQuery),groups=pcGroups().filter(g=>!q||pcText(g.display+' '+g.comparable.map(x=>x.product.supplier).join(' ')).includes(q));
  host.innerHTML=groups.length?groups.map(pcCard).join(''):'<div class="empty">Todavía no hay dos proveedores comparables para ese producto.</div>';
  const count=document.getElementById('providerCompareCount');if(count)count.textContent=`${groups.length} producto${groups.length===1?'':'s'} comparable${groups.length===1?'':'s'}`;
  document.querySelectorAll('[data-pc-source]').forEach(b=>b.addEventListener('click',()=>{const inv=pcInvoice(b.dataset.pcSource);if(inv?.file_path)openInvoiceFile(inv.file_path)}));
}
function pcDecorate(){
  if(route!=='products')return;
  const tools=document.querySelector('.product-tools');if(!tools||document.getElementById('providerComparePanel'))return;
  const groups=pcGroups();
  const wrap=document.createElement('div');wrap.id='providerComparePanel';wrap.className='card pc-panel';wrap.innerHTML=`<button type="button" id="providerCompareToggle" class="primary wide">💰 Comparar proveedores${groups.length?` · ${groups.length}`:''}</button><div id="providerCompareBody" style="display:${providerCompareOpen?'block':'none'}"><div class="pc-search-row"><input id="providerCompareSearch" type="search" placeholder="Buscar: Aquarius, Coca-Cola, aceite…" value="${esc(providerCompareQuery)}"><span id="providerCompareCount"></span></div><div id="providerCompareResults"></div><div class="hint pc-hint">Solo comparo precios cuando el producto y el formato son equivalentes. Si falta el tamaño de la caja o del pack, no declaro un ganador.</div></div>`;
  tools.insertAdjacentElement('afterend',wrap);
  document.getElementById('providerCompareToggle')?.addEventListener('click',()=>{providerCompareOpen=!providerCompareOpen;const body=document.getElementById('providerCompareBody');if(body){body.style.display=providerCompareOpen?'block':'none';if(providerCompareOpen){pcRenderResults();setTimeout(()=>body.scrollIntoView({behavior:'smooth',block:'start'}),20)}}});
  document.getElementById('providerCompareSearch')?.addEventListener('input',e=>{providerCompareQuery=e.target.value;pcRenderResults()});
  if(providerCompareOpen)pcRenderResults();
}
function pcStyles(){if(document.getElementById('providerCompareStyle'))return;const s=document.createElement('style');s.id='providerCompareStyle';s.textContent=`.pc-panel{margin-top:12px;padding:14px}.pc-search-row{display:flex;gap:10px;align-items:center;margin:12px 0}.pc-search-row input{flex:1}.pc-search-row span{font-size:.75rem;color:var(--muted);white-space:nowrap}.pc-card{border:1px solid var(--line);border-radius:15px;background:#131410;padding:14px;margin-top:10px}.pc-title{font-weight:950;font-size:.98rem}.pc-winner{font-size:.8rem;color:var(--mint);margin-top:4px}.pc-provider-row{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:10px 0;border-top:1px solid #2b2c28}.pc-provider-row:first-of-type{margin-top:8px}.pc-cheapest{background:rgba(92,190,149,.06)}.pc-provider-name{font-weight:850;font-size:.86rem}.pc-provider-meta{font-size:.75rem;color:var(--muted);margin-top:3px;line-height:1.35}.pc-provider-side{display:flex;align-items:center;gap:7px}.pc-best{font-size:.63rem;font-weight:950;color:#7bd79a;border:1px solid #315d42;border-radius:999px;padding:4px 7px;white-space:nowrap}.pc-source{border:1px solid #464841;background:#171816;color:var(--text);border-radius:9px;padding:5px 7px}.pc-saving{font-size:.76rem;font-weight:850;color:#d9b86e;margin-top:9px}.pc-hint{margin-top:10px}@media(max-width:540px){.pc-search-row{align-items:stretch;flex-direction:column}.pc-search-row span{white-space:normal}.pc-provider-row{align-items:flex-start}.pc-provider-side{flex-direction:column;align-items:flex-end}}`;document.head.appendChild(s)}
const pcOldBind=bind;bind=function(){pcOldBind();pcStyles();pcDecorate()};
window.productProviderComparisons=pcGroups;pcStyles();if(session)renderApp();
})();
