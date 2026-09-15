(()=>{
  if(window.__grossMercatCompat)return;
  window.__grossMercatCompat=true;

  const num=v=>{const n=Number(String(v??'').replace(',','.'));return Number.isFinite(n)?n:null};
  const text=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[ΑА]/g,'A').replace(/[αа]/g,'a').toLowerCase().replace(/[×*]/g,'x').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
  const supplierKey=s=>text(s).replace(/\s+/g,'');
  const isGross=s=>{const k=supplierKey(s);return k.includes('transgourmet')||k.includes('grossmercat')||k.includes('grosmercat')||k.includes('gmcash')||k.includes('grosmercado')};
  const canonicalSupplier=s=>isGross(s)?'Transgourmet Iberica S.A.U.':String(s||'').trim();
  const unit=u=>{const k=text(u).replace(/\s+/g,'');const m={packs:'pack',pk:'pack',cajas:'caja',cj:'caja',uds:'unidad',ud:'unidad',u:'unidad',unidades:'unidad'};return m[k]||k};
  const tokens=s=>new Set(text(s).split(' ').filter(Boolean));
  const similarity=(a,b)=>{const A=tokens(a),B=tokens(b);if(!A.size||!B.size)return 0;let c=0;for(const t of A)if(B.has(t))c++;return c/Math.max(A.size,B.size)};
  const closePrice=(a,b,limit=.35)=>{a=Number(a);b=Number(b);if(!Number.isFinite(a)||!Number.isFinite(b)||a<=0||b<=0)return false;return Math.abs(a-b)/Math.max(a,b)<=limit};

  function historical(name,price,currentUnit){
    const rows=(Array.isArray(window.products)?window.products:[]).filter(p=>isGross(p?.supplier)&&Number(p?.price)>0);
    const nk=text(name),cu=unit(currentUnit);
    const candidates=rows.map(p=>{
      const pk=text(p.name),sim=similarity(name,p.name),exact=nk===pk,sameUnit=cu&&unit(p.unit)===cu,priceOk=price>0&&closePrice(price,Number(p.price),.35);
      const valid=(exact||sim>=.9)&&(sameUnit||priceOk);
      return valid?{p,exact,sim,sameUnit}:null;
    }).filter(Boolean);
    candidates.sort((a,b)=>Number(b.exact)-Number(a.exact)||Number(b.sameUnit)-Number(a.sameUnit)||b.sim-a.sim||String(b.p.price_date||'').localeCompare(String(a.p.price_date||''))||String(b.p.created_at||'').localeCompare(String(a.p.created_at||'')));
    return candidates[0]?.p||null;
  }

  // Gross Mercat/Transgourmet: si la IA reconoce bien cantidad y total de linea
  // pero deja el precio unitario vacio o incoherente, el coste neto es total/cantidad.
  const previousFetch=window.fetch.bind(window);
  window.fetch=async function(input,init){
    const url=typeof input==='string'?input:(input?.url||'');
    const isInvoiceAi=/\/api\/invoice-ai(?:-v\d+)?(?:\?|$)/.test(url);
    const res=await previousFetch(input,init);
    if(!isInvoiceAi||!res.ok)return res;
    try{
      const data=await res.clone().json(),inv=data?.invoice;
      if(!inv||!isGross(inv.supplier)||!Array.isArray(inv.items))return res;
      inv.supplier=canonicalSupplier(inv.supplier);
      inv.items=inv.items.map(raw=>{
        const x={...raw},q=num(x.quantity),lt=num(x.line_total),up=num(x.unit_price);
        if(q!==null&&q>0&&lt!==null&&lt>=0){
          const derived=lt/q,tol=Math.max(.03,Math.abs(lt)*.01);
          if(up===null||Math.abs(q*up-lt)>tol)x.unit_price=Number(derived.toFixed(6));
        }
        return x;
      });
      return new Response(JSON.stringify(data),{status:res.status,statusText:res.statusText,headers:{'Content-Type':'application/json'}});
    }catch{return res}
  };

  function lineData(row){
    const name=row.querySelector('.ai-item-name')?.textContent?.trim()||'';
    const meta=row.querySelector('.ai-item-meta')?.textContent||'';
    const totalText=row.querySelector('.ai-item-total')?.textContent||'';
    const pm=meta.match(/(-?\d[\d.,]*)\s*€\s*\/\s*([^·]+)/);
    let price=pm?num(pm[1]):null,currentUnit=pm?unit(pm[2]):'';
    if(price===null){
      const qm=meta.match(/(?:^|·\s*)(-?\d[\d.,]*)\s+([^·]+?)(?=\s*·|$)/);
      const q=qm?num(qm[1]):null;
      if(qm&&!currentUnit)currentUnit=unit(qm[2]);
      const lt=num(totalText.replace(/[^0-9,.-]/g,''));
      if(q!==null&&q>0&&lt!==null)price=lt/q;
    }
    return{name,price,currentUnit};
  }
  function fmt(n){return Number(n).toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:4})+' €'}
  function decorateGrossHistory(){
    const supplier=document.getElementById('invSupplier')?.value||'';
    if(!isGross(supplier))return;
    const preview=document.getElementById('aiItemsPreview');if(!preview||preview.style.display==='none')return;
    let up=0,down=0,same=0,fresh=0,promo=0;
    preview.querySelectorAll('.ai-item').forEach(row=>{
      const line=lineData(row),el=row.querySelector('.ai-price-change');if(!el)return;
      if(line.price===0){el.className='ai-price-change same';el.textContent='🎁 Bonificación/promoción · 0,00 € · no se guarda como precio';promo++;return}
      if(!(line.price>0)){fresh++;return}
      const prev=historical(line.name,line.price,line.currentUnit);
      if(!prev){fresh++;return}
      const before=Number(prev.price),pct=((line.price-before)/before)*100,abs=Math.abs(pct),date=prev.price_date?` · ${typeof fmtDate==='function'?fmtDate(prev.price_date):prev.price_date}`:'';
      if(abs<.5){el.className='ai-price-change same';el.textContent=`= Sin cambio relevante · antes ${fmt(before)}${date} · ${prev.supplier}`;same++}
      else if(pct>0){el.className='ai-price-change up';el.textContent=`▲ +${abs.toLocaleString('es-ES',{minimumFractionDigits:1,maximumFractionDigits:1})}% · antes ${fmt(before)}${date} · ${prev.supplier}`;up++}
      else{el.className='ai-price-change down';el.textContent=`▼ -${abs.toLocaleString('es-ES',{minimumFractionDigits:1,maximumFractionDigits:1})}% · antes ${fmt(before)}${date} · ${prev.supplier}`;down++}
    });
    const summary=preview.querySelector('.ai-price-summary');
    if(summary)summary.innerHTML=`Comparación con historial: <strong>${up} subida${up===1?'':'s'}</strong> · <strong>${down} bajada${down===1?'':'s'}</strong> · ${same} sin cambio · ${fresh} nueva${fresh===1?'':'s'} referencia${fresh===1?'':'s'}${promo?` · ${promo} bonificación${promo===1?'':'es'}`:''}.`;
  }
  function schedule(){setTimeout(decorateGrossHistory,40);setTimeout(decorateGrossHistory,220)}

  const previousRead=window.readInvoiceAI;
  if(typeof previousRead==='function')window.readInvoiceAI=async function(){const r=await previousRead.apply(this,arguments);schedule();return r};
  const previousBind=window.bind;
  if(typeof previousBind==='function')window.bind=function(){previousBind();schedule();document.getElementById('invSupplier')?.addEventListener('input',schedule)};

  // Antes de guardar Productos, reutiliza el nombre/unidad historicos cuando es
  // claramente el mismo articulo del mismo proveedor y el precio es compatible.
  const previousApi=window.api;
  if(typeof previousApi==='function')window.api=async function(path,options={}){
    const method=String(options?.method||'GET').toUpperCase();
    if(path==='/rest/v1/products'&&method==='POST'&&Array.isArray(options?.body)){
      const body=options.body.map(raw=>{
        const r={...raw};
        if(!isGross(r.supplier)||!(Number(r.price)>0))return r;
        r.supplier=canonicalSupplier(r.supplier);
        const prev=historical(r.name,Number(r.price),r.unit);
        if(prev){r.name=prev.name;r.unit=prev.unit||r.unit}
        return r;
      });
      options={...options,body};
    }
    return previousApi(path,options);
  };
})();
