(()=>{
  if(window.__mahesoAiFix)return;
  window.__mahesoAiFix=true;
  const previousFetch=window.fetch.bind(window);
  const n=v=>{const x=Number(String(v??'').replace(',','.'));return Number.isFinite(x)?x:null};
  const key=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const round3=x=>Math.round((x+Number.EPSILON)*1000)/1000;

  function fixMahesoPayload(data){
    const inv=data?.invoice;
    if(!inv||!key(inv.supplier).includes('maheso')||!Array.isArray(inv.items))return data;

    inv.items=inv.items.map(raw=>{
      const item={...raw};
      const desc=key(item.description);
      const lt=n(item.line_total);
      let qty=n(item.quantity);
      let boxes=n(item.box_count);
      let unit=key(item.unit).trim();

      // Maheso suele describir cajas como "6b x 0,5kg", "4b x 1kg", etc.
      // Si la IA ha tomado el número de cajas como kilos, convertimos a kilos reales.
      const pack=desc.match(/\b(\d+(?:[.,]\d+)?)\s*b\s*x\s*(\d+(?:[.,]\d+)?)\s*kg\b/i);
      if(pack&&lt!==null&&lt>=0){
        const bags=n(pack[1]),kgPerBag=n(pack[2]);
        const kgPerBox=(bags||0)*(kgPerBag||0);
        if(kgPerBox>0){
          let detectedBoxes=boxes;
          if(detectedBoxes===null&&qty!==null&&qty>0){
            if(['caja','cajas','pack','unidad','unidades'].includes(unit))detectedBoxes=qty;
            else if(unit==='kg'&&qty<kgPerBox-0.0001)detectedBoxes=qty;
          }
          if(detectedBoxes!==null&&detectedBoxes>0){
            const totalKg=detectedBoxes*kgPerBox;
            if(qty===null||unit!=='kg'||Math.abs(qty-totalKg)>.001){
              item.box_count=detectedBoxes;
              item.quantity=round3(totalKg);
              item.unit='kg';
              item.unit_price=totalKg>0?round3(lt/totalKg):item.unit_price;
              qty=totalKg; unit='kg'; boxes=detectedBoxes;
            }
          }
        }
      }

      // SKU 11341 / REJOS ... P6: el P6 corresponde al formato de 6 kg.
      // A veces la IA lee "1 paquete" y toma el total de la línea como precio unitario.
      if(desc.includes('rejos de pota')&&/\bp6\b/.test(desc)&&lt!==null&&lt>0){
        qty=n(item.quantity); unit=key(item.unit).trim(); boxes=n(item.box_count);
        if(qty===1&&['paquete','pack','caja','unidad','kg'].includes(unit)){
          item.box_count=boxes??1;
          item.quantity=6;
          item.unit='kg';
          item.unit_price=round3(lt/6);
        }else if(qty===6&&['paquete','pack'].includes(unit)){
          item.quantity=6;
          item.unit='kg';
          item.unit_price=round3(lt/6);
        }
      }
      return item;
    });
    return data;
  }

  window.fetch=async function(input,init){
    const url=typeof input==='string'?input:(input?.url||'');
    const isInvoiceAi=/\/api\/invoice-ai(?:-v\d+)?(?:\?|$)/.test(url);
    const res=await previousFetch(input,init);
    if(!isInvoiceAi||!res.ok)return res;
    try{
      const data=await res.clone().json();
      const fixed=fixMahesoPayload(data);
      return new Response(JSON.stringify(fixed),{status:res.status,statusText:res.statusText,headers:{'Content-Type':'application/json'}});
    }catch{return res}
  };
})();
