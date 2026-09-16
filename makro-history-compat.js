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
      const valid=exact||(sim>=.78&&measuresCompatible(name,p.name)&&(sameUnit||priceOk));
      return valid?{p,exact,sim,sameUnit,priceOk}:null;
    }).filter(Boolean);
    candidates.sort((a,b)=>Number(b.exact)-Number(a.exact)||Number(b.sameUnit)-Number(a.sameUnit)||Number(b.priceOk)-Number(a.priceOk)||b.sim-a.sim||String(b.p.price_date||'').localeCompare(String(a.p.price_date||''))||String(b.p.created_at||'').localeCompare(String(a.p.created_at||'')));
    return candidates[0]||null;
  }

  function lineData(row){
    const name=row.querySelector('.ai-item-name')?.textContent?.trim()||'';
    const meta=row.querySelector('.ai-item-meta')?.textContent||'';
    const m=meta.match(/(-?\d[\d.,]*)\s*€\s*\/\s*([^·]+)/);
    const price=m?Number(String(m[1]).replace(/\./g,'').replace(',','.')):null;
    return{name,price,unit:m?unit(m[2]):''};
  }
  const money=n=>Number(n).toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:4})+' €';
  function decorateMakroHistory(){
    if(!isMakro(document.getElementById('invSupplier')?.value||''))return;
    const preview=document.getElementById('aiItemsPreview');if(!preview||preview.style.display==='none')return;
    let up=0,down=0,same=0,fresh=0,review=0,promo=0;
    preview.querySelectorAll('.ai-item').forEach(row=>{
      const line=lineData(row),el=row.querySelector('.ai-price-change');if(!el)return;
      if(line.price===0){el.className='ai-price-change same';el.textContent='🎁 Bonificación/promoción · 0,00 € · no se guarda como precio';promo++;return}
      if(!(line.price>0)){fresh++;return}
      const hit=historical(line.name,line.price,line.unit);
      if(!hit){fresh++;return}
      const prev=hit.p,before=Number(prev.price),sameUnit=line.unit===unit(prev.unit),priceOk=closePrice(line.price,before);
      const date=prev.price_date?` · ${typeof fmtDate==='function'?fmtDate(prev.price_date):prev.price_date}`:'';
      if(!sameUnit&&!priceOk){el.className='ai-price-change review';el.textContent=`⚠ Referencia conocida · revisar unidad/precio · antes ${money(before)} / ${prev.unit||'unidad'}${date}`;review++;return}
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
  readInvoiceAI=async function(){const r=await previousRead.apply(this,arguments);const el=document.getElementById('invSupplier');if(el&&isMakro(el.value))el.value='Makro';schedule();return r};
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
        if(hit&&closePrice(Number(r.price),Number(hit.p.price))){r.name=hit.p.name;r.unit=hit.p.unit||r.unit}
        return r;
      });
      options={...options,body};
    }
    return previousApi(path,options);
  };
})();