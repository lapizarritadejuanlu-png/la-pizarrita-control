(()=>{
let priceAlertTimer=null;

function addPriceAlertStyles(){
  if(document.getElementById('invoicePriceAlertStyle'))return;
  const s=document.createElement('style');
  s.id='invoicePriceAlertStyle';
  s.textContent=`
  .ai-price-change{margin-top:6px;font-size:.75rem;font-weight:900;line-height:1.35}
  .ai-price-change.up{color:#ff9a91}.ai-price-change.down{color:#7bd79a}.ai-price-change.same{color:#b9b5ad}.ai-price-change.new{color:#d9b86e}.ai-price-change.review{color:#e5c374}
  .ai-price-summary{margin:10px 0 0;padding:10px 12px;border:1px solid #3a3c35;border-radius:11px;background:#151613;font-size:.78rem;line-height:1.4;color:#b8b4ac}
  .ai-price-summary strong{color:var(--text)}
  `;
  document.head.appendChild(s);
}
function paText(s=''){
  return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[×*]/g,'x').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
}
function paUnit(s=''){
  const x=paText(s).replace(/\s+/g,'');
  const map={c:'caja',cj:'caja',caj:'caja',caja:'caja',cajas:'caja',u:'unidad',ud:'unidad',uds:'unidad',unidad:'unidad',unidades:'unidad',kg:'kg',kgs:'kg',g:'g',gr:'g',grs:'g',l:'l',lt:'l',lts:'l',litro:'l',litros:'l',ml:'ml',b:'bandeja',bdj:'bandeja',bandeja:'bandeja',p:'paquete',paq:'paquete',paquete:'paquete',bt:'botella',bot:'botella',botella:'botella',botellas:'botella',bl:'bolsa',bolsa:'bolsa',bolsas:'bolsa',fr:'frasco',frasco:'frasco',tr:'tarro',tarro:'tarro',pk:'pack',pack:'pack',packs:'pack'};
  return map[x]||x;
}
function paNum(s){
  let x=String(s||'').trim();if(!x)return null;
  x=x.replace(/[^0-9,.-]/g,'');
  if(x.includes(',')&&x.includes('.'))x=x.replace(/\./g,'').replace(',','.');
  else if(x.includes(','))x=x.replace(',','.');
  const n=Number(x);return Number.isFinite(n)?n:null;
}
function paTokens(s){return new Set(paText(s).split(' ').filter(Boolean))}
function paSimilarity(a,b){
  const A=paTokens(a),B=paTokens(b);if(!A.size||!B.size)return 0;
  let common=0;for(const t of A)if(B.has(t))common++;
  return common/Math.max(A.size,B.size);
}
function currentLineData(row,index){
  const raw=Array.isArray(detectedItems)?detectedItems[index]:null;
  if(raw){
    const price=Number(raw.unit_price),total=Number(raw.line_total),qty=Number(raw.quantity);
    return{name:String(raw.description||'').trim(),price:Number.isFinite(price)?price:null,unit:paUnit(raw.unit||''),total:Number.isFinite(total)?total:null,quantity:Number.isFinite(qty)?qty:null};
  }
  const name=row.querySelector('.ai-item-name')?.textContent?.trim()||'';
  const meta=row.querySelector('.ai-item-meta')?.textContent||'';
  const m=meta.match(/(-?\d[\d.,]*)\s*€\s*\/\s*([^·]+)/);
  return{name,price:m?paNum(m[1]):null,unit:m?paUnit(m[2]):'',total:null,quantity:null};
}
function previousFor(line){
  if(!line.name)return null;
  const supplier=paText(document.getElementById('invSupplier')?.value||'');
  const candidates=(Array.isArray(products)?products:[]).map(p=>{
    if(!p||p.source_invoice_id===editingInvoiceId)return null;
    const price=Number(p.price);if(!Number.isFinite(price)||price<=0)return null;
    const sameSupplier=!supplier||paText(p.supplier||'')===supplier;
    if(!sameSupplier)return null;
    const exact=paText(line.name)===paText(p.name||'');
    const score=paSimilarity(line.name,p.name||'');
    if(!exact&&score<0.72)return null;
    return{...p,__exact:exact,__score:score,__sameUnit:!line.unit||paUnit(p.unit)===line.unit};
  }).filter(Boolean);
  if(!candidates.length)return null;
  candidates.sort((a,b)=>Number(b.__exact)-Number(a.__exact)||Number(b.__sameUnit)-Number(a.__sameUnit)||b.__score-a.__score||String(b.price_date||'').localeCompare(String(a.price_date||''))||String(b.created_at||'').localeCompare(String(a.created_at||'')));
  return candidates[0];
}
function nearIntegerMultiple(a,b){
  a=Number(a);b=Number(b);if(!(a>0&&b>0))return false;
  const r=Math.max(a,b)/Math.min(a,b);if(r<1.8)return false;
  const n=Math.round(r);return n>=2&&n<=100&&Math.abs(r-n)/n<=0.035;
}
function priceChangeText(line,prev){
  if(!prev)return{kind:'new',text:'Nueva referencia · no hay compra anterior reconocida'};
  const before=Number(prev.price),now=Number(line.price),date=prev.price_date?fmtDate(prev.price_date):'',supplier=prev.supplier?` · ${prev.supplier}`:'';
  const knownPrefix=`Referencia conocida${date?` · ${date}`:''}${supplier}`;
  if(!Number.isFinite(now)||now<=0)return{kind:'review',text:`⚠ ${knownPrefix} · falta precio comparable en esta lectura`};
  if(!Number.isFinite(before)||before<=0)return{kind:'review',text:`⚠ ${knownPrefix} · el precio anterior no es comparable`};

  const sameUnit=!line.unit||paUnit(prev.unit)===line.unit;
  if(!sameUnit){
    return{kind:'review',text:`⚠ ${knownPrefix} · revisar unidad/precio · antes ${euro(before)} / ${prev.unit||'unidad'}`};
  }
  if(nearIntegerMultiple(now,before)){
    return{kind:'review',text:`⚠ ${knownPrefix} · posible confusión entre cantidad y precio unitario · antes ${euro(before)}`};
  }

  const pct=((now-before)/before)*100,abs=Math.abs(pct);
  const pctText=abs.toLocaleString('es-ES',{minimumFractionDigits:1,maximumFractionDigits:1});
  const prevText=euro(before);
  const genericUnit=['unidad','sin especificar',''].includes(paUnit(line.unit));
  if(genericUnit&&abs>=20){
    return{kind:'review',text:`⚠ ${knownPrefix} · cambio de ${pctText}% con unidad genérica · antes ${prevText}`};
  }
  if(abs<0.5)return{kind:'same',text:`= Sin cambio relevante · antes ${prevText}${date?` · ${date}`:''}${supplier}`};
  if(pct>0)return{kind:'up',text:`▲ +${pctText}% · antes ${prevText}${date?` · ${date}`:''}${supplier}`};
  return{kind:'down',text:`▼ -${pctText}% · antes ${prevText}${date?` · ${date}`:''}${supplier}`};
}
function decoratePriceAlerts(){
  addPriceAlertStyles();
  const preview=document.getElementById('aiItemsPreview');if(!preview||preview.style.display==='none')return;
  preview.querySelectorAll('.ai-price-change,.ai-price-summary').forEach(x=>x.remove());
  const rows=[...preview.querySelectorAll('.ai-item')];let up=0,down=0,same=0,fresh=0,review=0;
  rows.forEach((row,index)=>{
    const line=currentLineData(row,index),prev=previousFor(line),change=priceChangeText(line,prev);
    if(change.kind==='up')up++;else if(change.kind==='down')down++;else if(change.kind==='same')same++;else if(change.kind==='review')review++;else fresh++;
    const el=document.createElement('div');el.className=`ai-price-change ${change.kind}`;el.textContent=change.text;
    row.querySelector('.ai-item-main')?.appendChild(el);
  });
  if(rows.length){
    const box=document.createElement('div');box.className='ai-price-summary';
    box.innerHTML=`Comparación con historial: <strong>${up} subida${up===1?'':'s'}</strong> · <strong>${down} bajada${down===1?'':'s'}</strong> · ${same} sin cambio · ${fresh} nueva${fresh===1?'':'s'} referencia${fresh===1?'':'s'}${review?` · <strong>⚠ ${review} conocida${review===1?'':'s'} por revisar</strong>`:''}.`;
    const quality=preview.querySelector('.invoice-quality');
    if(quality)quality.insertAdjacentElement('beforebegin',box);else preview.appendChild(box);
  }
}
function schedulePriceAlerts(){clearTimeout(priceAlertTimer);priceAlertTimer=setTimeout(decoratePriceAlerts,0)}

addPriceAlertStyles();
const oldReadInvoiceAIPriceAlerts=readInvoiceAI;
readInvoiceAI=async function(){const r=await oldReadInvoiceAIPriceAlerts.apply(this,arguments);schedulePriceAlerts();return r};
const oldBindPriceAlerts=bind;
bind=function(){
  oldBindPriceAlerts();addPriceAlertStyles();schedulePriceAlerts();
  document.getElementById('invSupplier')?.addEventListener('input',schedulePriceAlerts);
  document.getElementById('aiItemsPreview')?.addEventListener('click',e=>{
    if(e.target.closest('[data-remove-item]')||e.target.closest('#toggleDetectedItems'))schedulePriceAlerts();
  });
};
if(session)renderApp();
})();