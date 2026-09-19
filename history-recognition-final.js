(()=>{
  if(window.__historyRecognitionFinal)return;
  window.__historyRecognitionFinal=true;

  const norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[×*]/g,'x').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
  const supplierKey=s=>{
    const t=norm(s);
    if(t.includes('makro'))return 'makro';
    if(t.includes('transgourmet')||t.includes('gross mercat')||t.includes('gros mercat'))return 'transgourmet';
    if(t.includes('assolim')||t.includes('lassolim')||t.includes('asolim'))return 'assolim';
    if(t.includes('maheso'))return 'maheso';
    return t.replace(/\b(s l u|s l|s a u|s a|sl|slu|sa|sau)\b/g,'').replace(/\s+/g,' ').trim();
  };
  const unitKey=u=>{
    const t=norm(u).replace(/\s+/g,'');
    const m={c:'caja',cj:'caja',caj:'caja',caja:'caja',cajas:'caja',u:'unidad',ud:'unidad',uds:'unidad',unidad:'unidad',unidades:'unidad',kg:'kg',kgs:'kg',g:'g',gr:'g',grs:'g',l:'l',lt:'l',lts:'l',litro:'l',litros:'l',ml:'ml',cl:'cl',bt:'botella',bot:'botella',botella:'botella',botellas:'botella',bl:'bolsa',bolsa:'bolsa',bolsas:'bolsa',fr:'frasco',frasco:'frasco',tr:'tarro',tarro:'tarro',pk:'pack',pack:'pack',packs:'pack',p:'paquete',paq:'paquete',paquete:'paquete',b:'bandeja',bdj:'bandeja',bandeja:'bandeja'};
    return m[t]||t||'sin especificar';
  };
  const stop=new Set(['de','del','la','el','los','las','en','con','para','por','y','o','un','una','the']);
  const tokens=s=>new Set(norm(s).split(' ').filter(x=>x&&x.length>1&&!stop.has(x)));
  const similarity=(a,b)=>{
    const A=tokens(a),B=tokens(b);if(!A.size||!B.size)return 0;
    let c=0;for(const x of A)if(B.has(x))c++;
    return (2*c)/(A.size+B.size);
  };
  const measureSig=s=>{
    const t=String(s||'').toLowerCase().replace(/,/g,'.');
    const out=[];let m;
    const re=/(\d+(?:\.\d+)?)\s*(kg|kgs|g|gr|grs|l|lt|lts|ml|cl)\b/g;
    while((m=re.exec(t))){let u=m[2].replace(/kgs?/,'kg').replace(/grs?/,'g').replace(/lts?/,'l').replace(/^lt$/,'l');out.push(`${Number(m[1])}${u}`)}
    return [...new Set(out)].sort().join('|');
  };
  const compatibleMeasure=(a,b)=>{const A=measureSig(a),B=measureSig(b);return !A||!B||A===B};
  const near=(a,b,limit=.5)=>{a=Number(a);b=Number(b);return a>0&&b>0&&Math.abs(a-b)/Math.max(a,b)<=limit};
  const money=n=>Number(n).toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:4})+' €';

  function currentItems(){return Array.isArray(detectedItems)?detectedItems:[]}
  function history(){return Array.isArray(products)?products:[]}

  function findPrevious(item,supplier){
    const sk=supplierKey(supplier),name=String(item?.description||''),nk=norm(name),price=Number(item?.unit_price),uk=unitKey(item?.unit);
    const currentDate=String(document.getElementById('invDate')?.value||'');
    const candidates=history().map(p=>{
      if(currentDate&&String(p?.price_date||'')>=currentDate)return null;
      if(!p||!(Number(p.price)>0)||supplierKey(p.supplier)!==sk)return null;
      const pn=norm(p.name),exact=nk===pn,sim=similarity(name,p.name||''),contains=(nk&&pn&&(nk.includes(pn)||pn.includes(nk))),measureOk=compatibleMeasure(name,p.name||''),sameUnit=uk===unitKey(p.unit),priceNear=near(price,p.price,.55);
      let valid=exact;
      if(!valid&&measureOk&&sim>=.80)valid=true;
      if(!valid&&measureOk&&contains&&sim>=.68)valid=true;
      if(!valid&&measureOk&&sim>=.72&&(sameUnit||priceNear))valid=true;
      if(!valid)return null;
      const score=(exact?100:0)+(contains?18:0)+(measureOk?12:0)+(sameUnit?8:0)+(priceNear?5:0)+sim*50;
      return{p,score,exact,sim,sameUnit,priceNear};
    }).filter(Boolean);
    candidates.sort((a,b)=>b.score-a.score||String(b.p.price_date||'').localeCompare(String(a.p.price_date||''))||String(b.p.created_at||'').localeCompare(String(a.p.created_at||'')));
    return candidates[0]||null;
  }

  function classify(item,hit){
    const now=Number(item?.unit_price);
    if(!hit){
      if(now===0)return{kind:'same',text:'🎁 Bonificación/promoción · no se usa como precio histórico'};
      return{kind:'new',text:'Nueva referencia · no hay compra anterior reconocida'};
    }
    const prev=hit.p,before=Number(prev.price),date=prev.price_date?(typeof fmtDate==='function'?fmtDate(prev.price_date):prev.price_date):'';
    const known=`Referencia conocida${date?` · ${date}`:''}${prev.supplier?` · ${prev.supplier}`:''}`;
    if(now===0)return{kind:'same',text:`🎁 ${known} · bonificación/promoción`};
    if(!(now>0)||!(before>0))return{kind:'review',text:`⚠ ${known} · revisar precio`};
    const sameUnit=unitKey(item?.unit)===unitKey(prev.unit);
    if(!sameUnit)return{kind:'review',text:`⚠ ${known} · revisar unidad/precio · antes ${money(before)} / ${prev.unit||'unidad'}`};
    const pct=((now-before)/before)*100,abs=Math.abs(pct),pctText=abs.toLocaleString('es-ES',{minimumFractionDigits:1,maximumFractionDigits:1});
    const ratio=Math.max(now,before)/Math.min(now,before),multi=Math.round(ratio);
    if(ratio>=1.8&&multi>=2&&multi<=100&&Math.abs(ratio-multi)/multi<=.035)return{kind:'review',text:`⚠ ${known} · posible confusión cantidad/precio · antes ${money(before)}`};
    if(abs<.5)return{kind:'same',text:`= Sin cambio relevante · antes ${money(before)}${date?` · ${date}`:''}${prev.supplier?` · ${prev.supplier}`:''}`};
    if(pct>0)return{kind:'up',text:`▲ +${pctText}% · antes ${money(before)}${date?` · ${date}`:''}${prev.supplier?` · ${prev.supplier}`:''}`};
    return{kind:'down',text:`▼ -${pctText}% · antes ${money(before)}${date?` · ${date}`:''}${prev.supplier?` · ${prev.supplier}`:''}`};
  }

  function decorate(){
    const preview=document.getElementById('aiItemsPreview');
    if(!preview||preview.style.display==='none')return;
    const supplier=document.getElementById('invSupplier')?.value||'';
    const items=currentItems(),rows=[...preview.querySelectorAll('.ai-item')];
    if(!rows.length)return;
    let up=0,down=0,same=0,fresh=0,review=0;
    rows.forEach((row,i)=>{
      const item=items[i]||{description:row.querySelector('.ai-item-name')?.textContent||'',unit_price:null,unit:''};
      const hit=findPrevious(item,supplier),c=classify(item,hit);
      let el=row.querySelector('.ai-price-change');
      if(!el){el=document.createElement('div');row.querySelector('.ai-item-main')?.appendChild(el)}
      el.className=`ai-price-change ${c.kind}`;el.textContent=c.text;
      if(c.kind==='up')up++;else if(c.kind==='down')down++;else if(c.kind==='same')same++;else if(c.kind==='review')review++;else fresh++;
    });
    let summary=preview.querySelector('.ai-price-summary');
    if(!summary){summary=document.createElement('div');summary.className='ai-price-summary';const quality=preview.querySelector('.invoice-quality');if(quality)quality.insertAdjacentElement('beforebegin',summary);else preview.appendChild(summary)}
    summary.innerHTML=`Comparación con historial: <strong>${up} subida${up===1?'':'s'}</strong> · <strong>${down} bajada${down===1?'':'s'}</strong> · ${same} sin cambio · ${fresh} nueva${fresh===1?'':'s'} referencia${fresh===1?'':'s'}${review?` · <strong>⚠ ${review} conocida${review===1?'':'s'} por revisar</strong>`:''}.`;
  }

  let timer=null;
  const schedule=()=>{clearTimeout(timer);timer=setTimeout(decorate,40);setTimeout(decorate,220);setTimeout(decorate,800);setTimeout(decorate,1600);setTimeout(decorate,3000)};
  const prevRead=readInvoiceAI;
  readInvoiceAI=async function(){const r=await prevRead.apply(this,arguments);schedule();return r};
  const prevRender=renderItems;
  renderItems=function(){const r=prevRender.apply(this,arguments);schedule();return r};
  const prevBind=bind;
  bind=function(){prevBind();schedule();document.getElementById('invSupplier')?.addEventListener('input',schedule)};
  window.refreshPurchaseHistoryRecognition=decorate;
})();