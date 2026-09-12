module.exports=async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Método no permitido'});
  const auth=req.headers.authorization||'';
  if(!auth.startsWith('Bearer '))return res.status(401).json({error:'Acceso no autorizado'});
  try{
    const u=await fetch('https://mpzemodwiuxqemvfaqvs.supabase.co/auth/v1/user',{headers:{apikey:'sb_publishable_5b0LE9t_UFaHQwsYZ7BvKQ_k_tAmbVc',Authorization:auth}});
    if(!u.ok)return res.status(401).json({error:'Sesión no válida'});
  }catch{return res.status(503).json({error:'No se pudo validar la sesión'})}

  const key=process.env.AI_GATEWAY_API_KEY||process.env.VERCEL_OIDC_TOKEN;
  if(!key)return res.status(503).json({code:'AI_NOT_CONFIGURED',error:'La lectura automática no está disponible ahora mismo.'});

  try{
    const {dataUrl,name='documento',type='image/jpeg'}=req.body||{};
    if(!dataUrl||typeof dataUrl!=='string')return res.status(400).json({error:'Falta el archivo'});
    if(dataUrl.length>5_500_000)return res.status(413).json({error:'El archivo es demasiado grande'});

    const prompt=`Lee este documento de compra de hostelería en España y devuelve SOLO JSON válido, sin markdown.
Formato: {"document_type":"invoice|ticket|delivery_note","date":"YYYY-MM-DD o null","supplier":"texto o null","invoice_number":"texto o null","base_amount":numero o null,"vat_amount":numero o null,"total":numero o null,"related_document_numbers":["texto"],"items":[{"description":"texto","box_count":numero o null,"quantity":numero o null,"unit":"texto o null","gross_unit_price":numero o null,"discount_percent":numero o null,"discount_amount":numero o null,"unit_price":numero o null,"line_total":numero o null}]}.

REGLA CRÍTICA DE LÍNEAS:
- Cada item debe salir de UNA SOLA LÍNEA FÍSICA del documento. Descripción, cantidad, unidad, precio y total deben pertenecer a esa misma línea.
- Nunca arrastres el nombre de la línea anterior o siguiente. Nunca asignes a un producto el precio de otro producto cercano.
- Antes de devolver cada item comprueba que quantity × unit_price sea razonablemente compatible con line_total, admitiendo solo el redondeo normal de céntimos.
- Si no puedes asociar con seguridad descripción y precio de la misma línea, usa null en el precio dudoso antes que inventar o mezclar líneas.
- Si el mismo nombre parece aparecer con kg y unidad en el mismo ticket, vuelve a revisar visualmente las líneas porque puede ser un desplazamiento de lectura.

PACKS, CAJAS Y CONTENIDO DEL EMBALAJE — MUY IMPORTANTE:
- quantity significa EXCLUSIVAMENTE cuántos packs, cajas, botellas, kilos o unidades COMERCIALES se han comprado en esa línea.
- NUNCA uses como quantity el número de unidades que vienen DENTRO del embalaje descrito en el nombre del producto.
- Ejemplo: "AQUARIUS limón 33 cl retráctil de 24 latas". El 24 describe el contenido del retráctil; NO significa que se hayan comprado 24 retráctiles ni 24 litros.
- Ejemplo: "aceite ... contiene 15 unidades". El 15 es el contenido de la caja/pack, no la cantidad comprada.
- Si la línea muestra 4 packs de 24 latas a 9,97 €, devuelve quantity=4, unit="pack", unit_price=9.97 y line_total=39.88.
- Si ves claramente una caja/retráctil/pack pero NO puedes leer cuántos packs se compraron, usa quantity=null y unit_price=null antes que deducirlos a partir del texto del embalaje.
- Para refrescos, cerveza, agua y otros productos en cajas/retráctiles, revisa expresamente que la cantidad comprada no sea el número de latas/botellas que contiene la caja.

Reglas generales: identifica factura/ticket/albarán; usa fecha de emisión y número principal; base_amount es base imponible, vat_amount solo IVA y total el total final. Extrae solo líneas reales de productos/servicios. Si existen columnas CAJAS y CANTIDAD, box_count sale de CAJAS y quantity de CANTIDAD. No deduzcas cantidades por textos de embalaje. Normaliza unidades a kg,g,l,ml,unidad,caja,pack,bandeja,paquete,botella.

DESCUENTOS Y PROMOCIONES — MUY IMPORTANTE:
- El precio que interesa para Productos es SIEMPRE el coste neto realmente pagado antes de IVA, después de descuentos, promociones, bonificaciones o rappels de esa línea.
- Si ves PRECIO BASE, TARIFA, PVP, PRECIO BRUTO o similar, ese dato va en gross_unit_price y NO en unit_price cuando exista descuento.
- Si ves DTO, DCTO, DESCUENTO, BONIF., PROMOCIÓN, %DTO, %DESC o equivalente, lee el porcentaje en discount_percent. Si aparece un importe monetario de descuento de línea, ponlo en discount_amount.
- line_total debe ser el IMPORTE NETO FINAL DE LA LÍNEA antes de IVA y después del descuento.
- Si hay precio bruto + porcentaje: neto unitario = precio bruto × (1 - descuento/100).
- Si hay precio bruto + descuento monetario total: line_total = cantidad × precio bruto - descuento; unit_price = line_total / cantidad.
- Nunca copies como unit_price el precio de tarifa si hay un descuento asociado.
- En proveedores de bebidas revisa especialmente barriles, cajas de cerveza y refrescos, porque suelen mostrar tarifa y descuento en columnas separadas.
- Si no hay descuento y el documento imprime un precio unitario, conserva ESE precio impreso; no lo recalcules a partir del total redondeado de la línea salvo que falte el precio unitario.

Si algo no se ve claro usa null. No inventes. Usa punto decimal.`;

    let raw='';
    const isPdf=type==='application/pdf'||dataUrl.startsWith('data:application/pdf');
    if(isPdf){
      const {generateText}=await import('ai');
      const comma=dataUrl.indexOf(',');if(comma<0)return res.status(400).json({error:'PDF no válido'});
      const pdf=Buffer.from(dataUrl.slice(comma+1),'base64');
      const r=await generateText({model:'google/gemini-2.5-flash-lite',messages:[{role:'user',content:[{type:'text',text:prompt},{type:'file',mediaType:'application/pdf',data:pdf,filename:name||'documento.pdf'}]}],maxOutputTokens:4000,abortSignal:AbortSignal.timeout(70000)});
      raw=r.text||'';
    }else{
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),70000);
      try{
        const r=await fetch('https://ai-gateway.vercel.sh/v1/responses',{method:'POST',signal:controller.signal,headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model:'google/gemini-2.5-flash-lite',input:[{type:'message',role:'user',content:[{type:'input_text',text:prompt},{type:'input_image',image_url:dataUrl,detail:'high'}]}],max_output_tokens:4000})});
        const text=await r.text();let d={};try{d=JSON.parse(text)}catch{}
        if(!r.ok){console.error('Image AI v5 gateway',r.status,text.slice(0,300));return res.status(502).json({code:'AI_SERVICE_ERROR',error:'No se pudo leer el documento ahora mismo. Inténtalo otra vez.'})}
        if(typeof d.output_text==='string')raw=d.output_text;
        if(!raw&&Array.isArray(d.output))for(const item of d.output)if(item.type==='message'&&Array.isArray(item.content))for(const c of item.content)if(typeof c.text==='string')raw+=c.text;
      }finally{clearTimeout(timer)}
    }

    const m=String(raw).match(/\{[\s\S]*\}/);if(!m)return res.status(502).json({error:'No se han podido identificar los datos del documento.'});
    let x;try{x=JSON.parse(m[0])}catch{return res.status(502).json({error:'No se han podido interpretar los datos del documento.'})}

    const num=v=>{if(v===null||v===undefined||v==='')return null;const n=Number(String(v).replace(',','.'));return Number.isFinite(n)?n:null};
    const normDate=v=>{if(!v)return null;const s=String(v).trim();if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;const z=s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);return z?`${z[3]}-${z[2].padStart(2,'0')}-${z[1].padStart(2,'0')}`:null};
    const normUnit=v=>{if(v===null||v===undefined||v==='')return null;const r=String(v).trim().toLowerCase().replace(/\./g,'');const map={u:'unidad',ud:'unidad',uds:'unidad',unidad:'unidad',unidades:'unidad',c:'caja',cj:'caja',caja:'caja',cajas:'caja',pack:'pack',packs:'pack',pk:'pack',k:'kg',kg:'kg',kgs:'kg',g:'g',gr:'g',l:'l',lt:'l',ml:'ml',b:'bandeja',bandeja:'bandeja',p:'paquete',paq:'paquete',paquete:'paquete',bot:'botella',botella:'botella'};return (map[r]||r).slice(0,40)};
    const close=(a,b,tol=.03)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=Math.max(tol,Math.abs(b)*.003);
    const embeddedPackCount=description=>{
      const s=String(description||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
      const patterns=[
        /(?:retractil|pack|caja|estuche|bandeja)\s*(?:de|con)?\s*(\d{1,3})\s*(?:latas?|botellas?|unidades?|uds?\b|piezas?|pz\b|pets?\b)/i,
        /(?:contiene|contenido)\s*(?:de)?\s*(\d{1,3})\s*(?:latas?|botellas?|unidades?|uds?\b|piezas?|pz\b|pets?\b)/i
      ];
      for(const re of patterns){const mm=s.match(re);if(mm){const n=Number(mm[1]);if(Number.isFinite(n)&&n>1)return n}}
      return null;
    };

    const items=Array.isArray(x.items)?x.items.slice(0,100).map(i=>{
      const description=String(i?.description||'').trim().slice(0,300);
      let q=num(i?.quantity),unit=normUnit(i?.unit),gross=num(i?.gross_unit_price),pct=num(i?.discount_percent),disc=num(i?.discount_amount);
      let lt=num(i?.line_total),up=num(i?.unit_price),calculatedNet=null;

      const inside=embeddedPackCount(description);
      const likelyCopiedFromPack=inside!==null&&q!==null&&Math.abs(q-inside)<1e-9;
      if(likelyCopiedFromPack){
        q=null;
        up=null;
        gross=null;
        pct=null;
        disc=null;
        if(!['caja','pack','paquete'].includes(unit))unit='pack';
      }

      if(q!==null&&q!==0&&gross!==null&&gross>=0){
        if(pct!==null&&pct>=0&&pct<100)calculatedNet=q*gross*(1-pct/100);
        else if(disc!==null&&disc>=0)calculatedNet=q*gross-disc;
      }

      if(calculatedNet!==null&&Number.isFinite(calculatedNet)){
        const grossTotal=q*gross;
        if(lt===null||close(lt,grossTotal)||Math.abs(lt-calculatedNet)>Math.max(.05,Math.abs(calculatedNet)*.02))lt=Number(calculatedNet.toFixed(6));
        if(q!==0)up=Number((lt/q).toFixed(6));
      }else if(q!==null&&q!==0&&lt!==null){
        if(up===null){
          const derived=lt/q;if(Number.isFinite(derived))up=Number(derived.toFixed(6));
        }else if(!close(q*up,lt)){
          up=null;
        }
      }

      return{description,box_count:num(i?.box_count),quantity:q,unit,unit_price:up,line_total:lt};
    }).filter(i=>i.description):[];

    const documentType=['invoice','ticket','delivery_note'].includes(x.document_type)?x.document_type:'invoice';
    const related=Array.isArray(x.related_document_numbers)?x.related_document_numbers.map(v=>String(v||'').trim().slice(0,100)).filter(Boolean).slice(0,30):[];
    return res.status(200).json({invoice:{document_type:documentType,date:normDate(x.date),supplier:x.supplier||null,invoice_number:x.invoice_number||null,base_amount:num(x.base_amount),vat_amount:num(x.vat_amount),total:num(x.total),related_document_numbers:related,items}});
  }catch(e){console.error('Invoice AI v5',e?.name||'',e?.message||'');return res.status(502).json({code:'AI_SERVICE_ERROR',error:'La IA ha tardado demasiado o no pudo leer la imagen. Inténtalo otra vez.'})}
};
