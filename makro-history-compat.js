(()=>{
  if(window.__makroHistoryCompat)return;
  window.__makroHistoryCompat=true;

  const text=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[×*]/g,'x').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
  const isMakro=s=>text(s).includes('makro');
  const unit=u=>{const k=text(u).replace(/\s+/g,'');const m={bt:'botella',bot:'botella',botellas:'botella',bl:'bolsa',bolsas:'bolsa',tr:'tarro',fr:'frasco',cj:'caja',cajas:'caja',uds:'unidad',ud:'unidad',u:'unidad',packs:'pack',pk:'pack'};return m[k]||k||'sin especificar'};
  const tokens=s=>new Set(text(s).split(' ').filter(Boolean));
  const similarity=(a,b)=>{const A=tokens(a),B=tokens(b);if(!A.size||!B.size)return 0;let c=0;for(const t of A)if(B.has(t))c++;return c/Math.max(A.size,B.size)};
  const closePrice=(a,b,limit=.45)=>{a=Number(a);b=Number(b);if(!Number.isFinite(a)||!Number.isFinite(b)||a<=0||b<=0)return false;return Math.abs(a-b)/Math.max(a,b)<=limit};
  const measureSig=s=>{
    const out=[];const t=String(s||'').toLowerCase().replace(/,/g,'.');
    const re=/(\d+(?:\.\d+)?)\s*(kg|kgs|g|gr|grs|l|lt|lts|ml|cl)\b/g;let m;
    while((m=re.exec(t)))out.push(`${Number(m[1])}${m[2].replace(/kgs?/,'kg').replace(/grs?/,'g').replace(/lts?/,'l').replace(/^lt$/,'l')}`);
    return [...new Set(out)].sort().join('|');
  };
  const measuresCompatible=(a,b)=>{const A=measureSig(a),B=measureSig(b);return !A||!B||A===B};
  const rows=()=>Array.isArray(products)?products:[];

  function historical(name,price,currentUnit){
    const nk=text(name),cu=unit(currentUnit);
    const candidates=rows().filter(p=>isMakro(p?.supplier)&&Number(p?.price)>0).map(p=>{
      const exact=nk===text(p.name),sim=similarity(name,p.name),sameUnit=cu===unit(p.unit),priceOk=closePrice(price,Number(p.price));
      const valid=exact||(sim>=.78&&measuresCompatible(name,p.name)&&(sameUnit||priceOk||!(Number(price)>0)));
      return valid?{p,exact,sim,sameUnit,priceOk}:null;
    }).filter(Boolean);
    candidates.sort((a,b)=>Number(b.exact)-Number(a.exact)||Number(b.sameUnit)-Number(a.sameUnit)||Number(b.priceOk)-Number(a.priceOk)||b.sim-a.sim||String(b.p.price_date||'').localeCompare(String(a.p.price_date||''))||String(b.p.created_at||'').localeCompare(String(a.p.created_at||'')));
    return candidates[0]||null;
  }

  function integerReconcile(total,prevPrice){
    total=Number(total);prevPrice=Number(prevPrice);if(!(total>0&&prevPrice>0))return null;
    const raw=total/prevPrice,n=Math.round(raw);if(n<1||n>100)return null;
    const unitPrice=total/n,rel=Math.abs(unitPrice-prevPrice)/prevPrice;
    return rel<=.06?{quantity:n,unitPrice,rel}:null;
  }
  function repairDetectedMakro(){
    if(!isMakro(document.getElementById('invSupplier')?.value||''))return false;
    if(!Array.isArray(detectedItems)||!detectedItems.length)return false;
    let changed=false;
    detectedItems.forEach(item=>{
      const hit=historical(item.description,item.unit_price,item.unit);if(!hit)return;
      const prev=hit.p,before=Number(prev.price),now=Number(item.unit_price),total=Number(item.line_total);
      const rec=integerReconcile(total,before);
      const currentUnit=unit(item.unit),prevUnit=unit(prev.unit);
      const suspiciousPrice=Number.isFinite(now)&&now>0&&Number.isFinite(before)&&before>0&&(now/before>1.8||before/now>1.8);
      if(rec&&(hit.exact||hit.sim>=.9)&&(!Number.isFinite(now)||now<=0||currentUnit!==prevUnit||suspiciousPrice)){
        item.quantity=rec.quantity;item.unit=prev.unit||item.unit;item.unit_price=rec.unitPrice;changed=true;
      }else if((hit.exact||hit.sim>=.92)&&(!item.unit||currentUnit==='sin especificar')){
        item.unit=prev.unit||item.unit;changed=true;
      }
      if(hit.exact||hit.sim>=.92){
        if(item.description!==prev.name){item.description=prev.name;changed=true}
      }
    });
    return changed;
  }

  function lineData(row,index){
    const raw=Array.isArray(detectedItems)?detectedItems[index]:null;
    if(raw){
      const p=Number(raw.unit_price),t=Number(raw.line_total),q=Number(raw.quantity);
      return{name:String(raw.description||'').trim(),price:Number.isFinite(p)?p:null,unit:unit(raw.unit||''),total:Number.isFinite(t)?t:null,quantity:Number.isFinite(q)?q:null};
    }
    const name=row.querySelector('.ai-item-name')?.textContent?.trim()||'';
    const meta=row.querySelector('.ai-item-meta')?.textContent||'';
    const m=meta.match(/(-?\d[\d.,]*)\s*€\s*\/\s*([^·]+)/);
    const price=m?Number(String(m[1]).replace(/\./g,'').replace(',','.')):null;
    const totalText=row.querySelector('.ai-item-total')?.textContent||'';
    const total=Number(String(totalText).replace(/[^0-9,.-]/g,'').replace(',','.'));
    return{name,price,unit:m?unit(m[2]):'',total:Number.isFinite(total)?total:null,quantity:null};
  }
  const money=n=>Number(n).toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:4})+' €';
  const nearMultiple=(a,b)=>{a=Number(a);b=Number(b);if(!(a>0&&b>0))return false;const r=Math.max(a,b)/Math.min(a,b),n=Math.round(r);return r>=1.8&&n>=2&&n<=100&&Math.abs(r-n)/n<=.035};
  function decorateMakroHistory(){
    if(!isMakro(document.getElementById('invSupplier')?.value||''))return;
    const preview=document.getElementById('aiItemsPreview');if(!preview||preview.style.display==='none')return;
    let up=0,down=0,same=0,fresh=0,review=0,promo=0;
    preview.querySelectorAll('.ai-item').forEach((row,index)=>{
      const line=lineData(row,index),el=row.querySelector('.ai-price-change');if(!el)return;
      if(line.price===0){el.className='ai-price-change same';el.textContent='🎁 Bonificación/promoción · 0,00 € · no se guarda como precio';promo++;return}
      const hit=historical(line.name,line.price,line.unit);
      if(!hit){fresh++;return}
      const prev=hit.p,before=Number(prev.price),sameUnit=!line.unit||line.unit===unit(prev.unit),priceOk=closePrice(line.price,before),date=prev.price_date?` · ${typeof fmtDate==='function'?fmtDate(prev.price_date):prev.price_date}`:'';
      if(!(line.price>0)){
        el.className='ai-price-change review';el.textContent=`⚠ Referencia conocida · falta precio comparable · antes ${money(before)} / ${prev.unit||'unidad'}${date}`;review++;return;
      }
      if(!sameUnit){el.className='ai-price-change review';el.textContent=`⚠ Referencia conocida · revisar unidad/precio · antes ${money(before)} / ${prev.unit||'unidad'}${date}`;review++;return}
      if(nearMultiple(line.price,before)){
        el.className='ai-price-change review';el.textContent=`⚠ Referencia conocida · posible confusión cantidad/precio · antes ${money(before)}${date}`;review++;return;
      }
      const pct=((line.price-before)/before)*100,abs=Math.abs(pct);
      if(abs<.5){el.className='ai-price-change same';el.textContent=`= Sin cambio relevante · antes ${money(before)}${date} · Makro`;same++}
      else if(pct>0){el.className='ai-price-change up';el.textContent=`▲ +${abs.toLocaleString('es-ES',{minimumFractionDigits:1,maximumFractionDigits:1})}% · antes ${money(before)}${date} · Makro`;up++}
      else{el.className='ai-price-change down';el.textContent=`▼ -${abs.toLocaleString('es-ES',{minimumFractionDigits:1,maximumFractionDigits:1})}% · antes ${money(before)}${date} · Makro`;down++}
    });
    const summary=preview.querySelector('.ai-price-summary');
    if(summary)summary.innerHTML=`Comparación con historial: <strong>${up} subida${up===1?'':'s'}</strong> · <strong>${down} bajada${down===1?'':'s'}</strong> · ${same} sin cambio · ${fresh} nueva${fresh===1?'':'s'} referencia${fresh===1?'':'s'}${review?` · <strong>⚠ ${review} conocida${review===1?'':'s'} por revisar</strong>`:''}${promo?` · ${promo} bonificación${promo===1?'':'es'}`:''}.`;
  }
  function schedule(){setTimeout(decorateMakroHistory,50);setTimeout(decorateMakroHistory,260)}

  const previousRead=readInvoiceAI;
  readInvoiceAI=async function(){const r=await previousRead.apply(this,arguments);const el=document.getElementById('invSupplier');if(el&&isMakro(el.value))el.value='Makro';if(repairDetectedMakro())renderItems();schedule();return r};
  const previousBind=bind;
  bind=function(){previousBind();schedule();document.getElementById('invSupplier')?.addEventListener('input',schedule)};

  const previousApi=api;
  api=async function(path,options={}){
    const method=String(options?.method||'GET').toUpperCase();
    if(path==='/rest/v1/products'&&method==='POST'&&Array.isArray(options?.body)){
      const body=options.body.map(raw=>{
        const r={...raw};if(!isMakro(r.supplier)||!(Number(r.price)>0))return r;
        r.supplier='Makro';
        const hit=historical(r.name,Number(r.price),r.unit);
        if(hit&&(hit.exact||hit.sim>=.92)){r.name=hit.p.name;r.unit=hit.p.unit||r.unit}
        return r;
      });
      options={...options,body};
    }
    if(path==='/rest/v1/rpc/save_document_atomic'&&method==='POST'&&options?.body&&isMakro(options.body.p_supplier)){
      const body={...options.body,p_supplier:'Makro'};
      if(Array.isArray(body.p_items))body.p_items=body.p_items.map(raw=>{
        const r={...raw},hit=historical(r.description,r.unit_price,r.unit);
        if(hit&&(hit.exact||hit.sim>=.92)){r.description=hit.p.name;r.unit=hit.p.unit||r.unit}
        return r;
      });
      options={...options,body};
    }
    return previousApi(path,options);
  };
})();