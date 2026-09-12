(()=>{
let pcQuery='';
function pcText(s=''){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim()}
function pcUnit(u=''){const x=pcText(u);const m={litro:'l',litros:'l',lt:'l',lts:'l',kgs:'kg',kilo:'kg',kilos:'kg',unidad:'unidad',unidades:'unidad',ud:'unidad',uds:'unidad',caja:'pack',cajas:'pack',pack:'pack',packs:'pack',paquete:'pack',paquetes:'pack',retractil:'pack',bandeja:'pack',bandejas:'pack',botella:'botella',botellas:'botella',lata:'lata',latas:'lata',llauna:'lata',llaunes:'lata'};return m[x]||x||'sin especificar'}
function pcIdentity(name=''){
  let s=pcText(name);if(!s)return'';
  if(/\baquarius\b/.test(s))return /\bnaranja\b|\btaronja\b/.test(s)?'aquarius naranja':'aquarius limon';
  if(/\b(coca cola|cocacola)\b/.test(s)){if(/\bzero\s+zero\b/.test(s))return'coca cola zero zero';if(/\bzero\b/.test(s))return'coca cola zero';if(/\blight\b/.test(s))return'coca cola light';return'coca cola'}
  if(/\bfanta\b/.test(s)){if(/\blimon\b|\bllimo\b/.test(s))return'fanta limon';if(/\bnaranja\b|\btaronja\b|\btaron\b/.test(s))return'fanta naranja'}
  if(/\bnestea\b/.test(s)&&(/\blimon\b|\bllimo\b/.test(s)))return'nestea limon';
  s=s.replace(/\b\d+(?:[.,]\d+)?\s*(?:kg|kgs|g|gr|grs|l|lt|lts|ml|cl)\b/g,' ').replace(/\b\d+\s*[x*]\s*\d+(?:[.,]\d+)?\s*(?:kg|kgs|g|gr|grs|l|lt|lts|ml|cl)\b/g,' ').replace(/\b(?:retractil|pack|packs|caja|cajas|paquete|paquetes|lata|latas|llauna|llaunes|botella|botellas|pet|pets|bandeja|bandejas|contiene|contenido|unidades|unidad|uds|ud|de|del|con)\b/g,' ').replace(/\b\d+\b/g,' ').replace(/\s+/g,' ').trim();
  return s;
}
function pcDisplay(id,rows){if(id==='aquarius limon')return'AQUARIUS LIMÓN 33 CL';if(id==='aquarius naranja')return'AQUARIUS NARANJA';if(id.startsWith('coca cola')||id.startsWith('fanta ')||id.startsWith('nestea '))return id.toUpperCase();const names=(rows||[]).map(x=>String(x?.name||'')).filter(Boolean).sort((a,b)=>a.length-b.length);return names[0]||id.toUpperCase()}
function pcInvoice(id){return (Array.isArray(invoices)?invoices:[]).find(x=>x.id===id)||null}
function pcItems(inv){return Array.isArray(inv?.extraction_json?.items)?inv.extraction_json.items:[]}
function pcFindItem(p){const inv=pcInvoice(p?.source_invoice_id);if(!inv)return null;const exact=pcItems(inv).find(x=>pcText(x?.description)===pcText(p?.name));if(exact)return exact;const id=pcIdentity(p?.name);return pcItems(inv).find(x=>pcIdentity(x?.description)===id)||null}
function pcPackageFromText(text=''){const s=pcText(text),m=s.match(/(?:retractil|pack|caja|contiene|contenido)\s*(?:de|con)?\s*(\d{1,3})\s*(latas?|llaunas?|botellas?|unidades?|uds?|pets?)/i);if(!m)return null;const n=Number(m[1]);if(!Number.isFinite(n)||n<2)return null;const raw=pcText(m[2]);let unit='unidad';if(raw.startsWith('lat')||raw.startsWith('llaun'))unit='lata';else if(raw.startsWith('bot')||raw.startsWith('pet'))unit='botella';return{units:n,unit}}
function pcSize(text=''){const m=pcText(text).match(/\b(\d+(?:[.,]\d+)?)\s*(ml|cl|l|g|kg)\b/i);if(!m)return null;return{value:Number(String(m[1]).replace(',','.')),unit:pcText(m[2])}}
function pcComparable(p){
  const price=Number(p?.price);if(!Number.isFinite(price)||price<=0)return null;const unit=pcUnit(p?.unit),item=pcFindItem(p),name=String(p?.name||'');
  if(unit==='kg'||unit==='l')return{product:p,basis:price,key:unit,label:unit,packUnits:null,packUnit:null};
  if(['unidad','botella','lata'].includes(unit)){const sz=pcSize(name)||pcSize(item?.description||''),sk=sz?`${sz.value}${sz.unit}`:'';return{product:p,basis:price,key:`each:${unit}:${sk}`,label:unit,packUnits:1,packUnit:unit}}
  if(unit==='pack'){
    const embedded=pcPackageFromText(name)||pcPackageFromText(item?.description||'');const packUnits=Number(item?.package_units)||embedded?.units||null;const packUnit=pcUnit(item?.package_unit||embedded?.unit||(/\b(?:lata|llauna)s?\b/i.test(name)?'lata':/\bbotellas?\b/i.test(name)?'botella':''));const sz=item?.content_size&&item?.content_size_unit?{value:Number(item.content_size),unit:pcText(item.content_size_unit)}:(pcSize(name)||pcSize(item?.description||''));if(!packUnits||!packUnit)return null;const sk=sz&&Number.isFinite(sz.value)?`${sz.value}${sz.unit}`:'';return{product:p,basis:price/packUnits,key:`each:${packUnit}:${sk}`,label:packUnit,packUnits,packUnit}
  }
  return null;
}
function pcGroups(){
  const ids=new Map();for(const p of Array.isArray(products)?products:[]){const id=pcIdentity(p?.name);if(!id)continue;if(!ids.has(id))ids.set(id,[]);ids.get(id).push(p)}
  const out=[];
  for(const [id,rows] of ids){
    const providers=new Map();for(const p of rows){const k=pcText(p?.supplier);if(!k)continue;if(!providers.has(k))providers.set(k,[]);providers.get(k).push(p)}if(providers.size<2)continue;
    const candidates=[];for(const arr of providers.values()){arr.sort((a,b)=>String(b.price_date||'').localeCompare(String(a.price_date||''))||String(b.created_at||'').localeCompare(String(a.created_at||'')));for(const p of arr){const c=pcComparable(p);if(c){candidates.push(c);break}}}
    const byKey=new Map();for(const c of candidates){if(!byKey.has(c.key))byKey.set(c.key,[]);byKey.get(c.key).push(c)}
    for(const vals of byKey.values()){if(new Set(vals.map(c=>pcText(c.product?.supplier))).size<2)continue;vals.sort((a,b)=>a.basis-b.basis);out.push({id,display:pcDisplay(id,rows),rows:vals,winner:vals[0]})}
  }
  return out.sort((a,b)=>a.display.localeCompare(b.display,'es',{sensitivity:'base'}));
}
function pcMoney(n,d=2){return Number(n).toLocaleString('es-ES',{minimumFractionDigits:d,maximumFractionDigits:d})+' €'}
function pcRow(c){const p=c.product;if(c.packUnits&&c.packUnits>1)return `${pcMoney(p.price)} / ${pcText(p.unit)==='caja'?'caja':'pack'} de ${c.packUnits} · ${pcMoney(c.basis,3)} / ${c.label}`;return `${pcMoney(p.price,3)} / ${c.label}`}
function pcSavings(g){const a=g.rows[0],b=g.rows[g.rows.length-1];if(!a||!b||b.basis<=a.basis)return'';const pct=((b.basis-a.basis)/b.basis)*100;if(a.packUnits&&b.packUnits&&a.packUnits===b.packUnits){const diff=Number(b.product.price)-Number(a.product.price);return `Ahorro: ${pcMoney(diff)} por ${a.packUnits} ${a.packUnit}${a.packUnits===1?'':'s'} · ${pct.toLocaleString('es-ES',{minimumFractionDigits:1,maximumFractionDigits:1})}%`}return `Ahorro: ${pcMoney(b.basis-a.basis,3)} / ${a.label} · ${pct.toLocaleString('es-ES',{minimumFractionDigits:1,maximumFractionDigits:1})}%`}
function pcButton(c){const inv=pcInvoice(c.product?.source_invoice_id);return inv?.file_path?`<button type="button" class="pc-source" data-pc-source="${esc(inv.id)}">📄</button>`:''}
function pcCard(g){const rows=g.rows.map((c,i)=>`<div class="pc-provider-row ${i===0?'pc-cheapest':''}"><div><div class="pc-provider-name">${i===0?'✅ ':''}${esc(c.product.supplier||'Sin proveedor')}</div><div class="pc-provider-meta">${fmtDate(c.product.price_date)} · ${esc(pcRow(c))}</div></div><div class="pc-provider-side">${i===0?'<span class="pc-best">MÁS BARATO</span>':''}${pcButton(c)}</div></div>`).join('');return `<div class="pc-card" data-pc-card="${esc(pcText(g.display+' '+g.rows.map(x=>x.product.supplier).join(' ')))}"><div class="pc-title">${esc(g.display)}</div><div class="pc-winner">Mejor precio: <strong>${esc(g.winner.product.supplier||'')}</strong></div>${rows}<div class="pc-saving">${esc(pcSavings(g))}</div></div>`}
function pcPanel(){const groups=pcGroups(),cards=groups.length?groups.map(pcCard).join(''):'<div class="empty">Todavía no hay productos comprados a dos proveedores con el mismo formato.</div>';return `<div id="providerComparePanel" class="card pc-panel"><div class="pc-head">💰 Comparar proveedores</div><div class="pc-sub">Te digo automáticamente dónde compras más barato.</div><input id="providerCompareSearch" type="search" placeholder="Buscar: Aquarius, Coca-Cola, aceite…" value="${esc(pcQuery)}"><div id="providerCompareResults">${cards}</div><div class="hint pc-hint">Solo comparo formatos equivalentes. Si falta el tamaño real de caja o pack, no marco ganador.</div></div>`}
function pcStyles(){if(document.getElementById('providerCompareStyleV2'))return;const s=document.createElement('style');s.id='providerCompareStyleV2';s.textContent=`.pc-panel{margin-top:12px;padding:14px}.pc-head{font-weight:950;font-size:1rem}.pc-sub{font-size:.78rem;color:var(--muted);margin:3px 0 10px}.pc-panel input{width:100%;box-sizing:border-box}.pc-card{border:1px solid var(--line);border-radius:15px;background:#131410;padding:14px;margin-top:10px}.pc-title{font-weight:950}.pc-winner{font-size:.8rem;color:var(--mint);margin-top:4px}.pc-provider-row{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;padding:10px 0;border-top:1px solid #2b2c28}.pc-provider-row:first-of-type{margin-top:8px}.pc-provider-name{font-weight:850;font-size:.86rem}.pc-provider-meta{font-size:.75rem;color:var(--muted);margin-top:3px;line-height:1.35}.pc-provider-side{display:flex;align-items:center;gap:7px}.pc-best{font-size:.63rem;font-weight:950;color:#7bd79a;border:1px solid #315d42;border-radius:999px;padding:4px 7px;white-space:nowrap}.pc-source{border:1px solid #464841;background:#171816;color:var(--text);border-radius:9px;padding:5px 7px}.pc-saving{font-size:.76rem;font-weight:850;color:#d9b86e;margin-top:9px}.pc-hint{margin-top:10px}`;document.head.appendChild(s)}
function pcBind(){const q=document.getElementById('providerCompareSearch');if(q)q.addEventListener('input',e=>{pcQuery=e.target.value;const term=pcText(pcQuery);document.querySelectorAll('[data-pc-card]').forEach(x=>x.style.display=!term||(x.dataset.pcCard||'').includes(term)?'block':'none')});document.querySelectorAll('[data-pc-source]').forEach(b=>b.addEventListener('click',()=>{const inv=pcInvoice(b.dataset.pcSource);if(inv?.file_path)openInvoiceFile(inv.file_path)}))}
pcStyles();
const oldProductsView=productsView;productsView=function(){let html=oldProductsView.apply(this,arguments);if(typeof html!=='string'||html.includes('providerComparePanel'))return html;return html.replace('<h2>Productos</h2>',`<h2>Productos</h2>${pcPanel()}`)};
const oldBind=bind;bind=function(){oldBind();pcStyles();pcBind()};
window.productProviderComparisons=pcGroups;
if(session)renderApp();
})();