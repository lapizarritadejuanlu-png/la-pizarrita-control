(()=>{
  if(window.__pizarritaAiV2Fetch)return;
  window.__pizarritaAiV2Fetch=true;
  const nativeFetch=window.fetch.bind(window);

  const normText=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[×*]/g,'x').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
  const normUnit=s=>{
    const u=normText(s).replace(/\s+/g,'');
    const map={u:'unidad',ud:'unidad',uds:'unidad',unidad:'unidad',unidades:'unidad',c:'caja',cj:'caja',caja:'caja',cajas:'caja',pack:'pack',packs:'pack',pk:'pack',k:'kg',kg:'kg',kgs:'kg',g:'g',gr:'g',grs:'g',l:'l',lt:'l',lts:'l',ml:'ml',p:'paquete',paq:'paquete',paquete:'paquete',b:'bandeja',bandeja:'bandeja',bot:'botella',botella:'botella'};
    return map[u]||u||'sin especificar';
  };
  const supplierKey=s=>{
    const x=normText(s).replace(/\b(s\s*a\s*u|s\s*a|s\s*l|slu|sl|sa|sau)\b/g,' ').replace(/\s+/g,' ').trim();
    if(/jacorba/.test(x))return'jacorba';
    if(/assolim|lassolim|asolim/.test(x))return'assolim foodservices';
    if(/transgourmet|gross mercat|gm cash/.test(x))return'transgourmet';
    if(/maheso|gedesco/.test(x))return'maheso';
    return x;
  };
  const historyRows=()=>{
    try{
      if(typeof products!=='undefined'&&Array.isArray(products))return products;
      if(Array.isArray(window.products))return window.products;
    }catch{}
    return[];
  };
  const packageWeightKg=name=>{
    const s=String(name||'').toUpperCase().replace(/,/g,'.');
    const patterns=[
      /(\d+(?:\.\d+)?)\s*(?:BL|BLS|BOLSAS?|B|UDS?|UNIDADES?|PAQ|PAQS|PAQUETES?)?\s*[X*×]\s*(\d+(?:\.\d+)?)\s*(KG|KGS|G|GR|GRS)\b/,
      /\((\d+(?:\.\d+)?)\s*(?:BL|BLS|BOLSAS?)\s*[X*×]\s*(\d+(?:\.\d+)?)\s*(KG|KGS|G|GR|GRS)\)/
    ];
    for(const re of patterns){
      const m=s.match(re);if(!m)continue;
      const a=Number(m[1]),b=Number(m[2]),u=String(m[3]).toUpperCase();
      if(!Number.isFinite(a)||!Number.isFinite(b)||a<=0||b<=0)continue;
      return a*(u.startsWith('G')?b/1000:b);
    }
    return null;
  };
  const reconcilePackageMeasures=item=>{
    const q=Number(item.quantity),lt=Number(item.line_total),up=Number(item.unit_price),unit=normUnit(item.unit);
    if(!Number.isFinite(q)||q<=0||!Number.isFinite(lt)||lt<=0||!['caja','pack','paquete'].includes(unit))return item;
    const kg=packageWeightKg(item.description);
    if(Number.isFinite(kg)&&kg>0){
      const boxes=q/kg,rounded=Math.round(boxes);
      if(rounded>=1&&rounded<=100&&Math.abs(boxes-rounded)<=Math.max(.04,rounded*.04)){
        item.quantity=rounded;
        item.unit=unit;
        item.unit_price=Number((lt/rounded).toFixed(6));
        return item;
      }
    }
    if(Number.isFinite(up)&&up>0&&Math.abs(q-Math.round(q))>0.05){
      const rounded=Math.round(q);
      if(rounded>=1&&Math.abs(q-rounded)<=0.02){
        item.quantity=rounded;
        item.unit_price=Number((lt/rounded).toFixed(6));
      }
    }
    return item;
  };
  const reconcileKnownReferences=data=>{
    try{
      const inv=data&&data.invoice;
      if(!inv||!Array.isArray(inv.items)||!inv.items.length)return data;
      const history=historyRows();
      const sk=supplierKey(inv.supplier);
      inv.items=inv.items.map(raw=>{
        const item=reconcilePackageMeasures({...raw});
        const nk=normText(item.description);
        if(!nk||!history.length)return item;
        const matches=history.filter(p=>p&&normText(p.name)===nk&&supplierKey(p.supplier)===sk&&Number(p.price)>0);
        if(!matches.length)return item;
        matches.sort((a,b)=>String(b.price_date||'').localeCompare(String(a.price_date||''))||String(b.created_at||'').localeCompare(String(a.created_at||'')));
        const prev=matches[0],oldUnit=normUnit(prev.unit),newUnit=normUnit(item.unit);
        const oldPrice=Number(prev.price),newPrice=Number(item.unit_price),lineTotal=Number(item.line_total);
        if(['caja','pack','paquete'].includes(oldUnit)&&Number.isFinite(lineTotal)&&lineTotal>0&&Number.isFinite(oldPrice)&&oldPrice>0){
          const estimated=lineTotal/oldPrice,boxes=Math.round(estimated);
          if(boxes>=1&&boxes<=100&&Math.abs(estimated-boxes)<=Math.max(.12,boxes*.08)){
            item.quantity=boxes;
            item.unit=prev.unit;
            item.unit_price=Number((lineTotal/boxes).toFixed(6));
            return item;
          }
        }
        if(oldUnit&&oldUnit!=='sin especificar'&&newUnit!==oldUnit&&Number.isFinite(oldPrice)&&oldPrice>0&&Number.isFinite(newPrice)&&newPrice>0){
          const ratio=newPrice/oldPrice;
          if(ratio>=0.5&&ratio<=1.5)item.unit=prev.unit;
        }
        return item;
      });
    }catch(e){console.warn('History unit reconcile',e?.message||e)}
    return data;
  };

  window.fetch=async function(input,init){
    let aiCall=false;
    if(typeof input==='string'&&input==='/api/invoice-ai'){
      input='/api/invoice-ai-v5';aiCall=true;
    }else if(input instanceof Request){
      try{
        const u=new URL(input.url,location.href);
        if(u.pathname==='/api/invoice-ai'){
          input=new Request('/api/invoice-ai-v5',input);aiCall=true;
        }else if(u.pathname==='/api/invoice-ai-v5')aiCall=true;
      }catch{}
    }else if(typeof input==='string'){
      try{if(new URL(input,location.href).pathname==='/api/invoice-ai-v5')aiCall=true}catch{}
    }
    const response=await nativeFetch(input,init);
    if(!aiCall||!response.ok)return response;
    try{
      const data=await response.clone().json();
      reconcileKnownReferences(data);
      const headers=new Headers(response.headers);headers.set('content-type','application/json');
      return new Response(JSON.stringify(data),{status:response.status,statusText:response.statusText,headers});
    }catch{return response}
  };
})();
