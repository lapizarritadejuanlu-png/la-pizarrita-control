module.exports = async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Método no permitido'});

  const auth=req.headers.authorization||'';
  if(!auth.startsWith('Bearer ')) return res.status(401).json({error:'Acceso no autorizado'});

  try{
    const u=await fetch('https://mpzemodwiuxqemvfaqvs.supabase.co/auth/v1/user',{
      headers:{apikey:'sb_publishable_5b0LE9t_UFaHQwsYZ7BvKQ_k_tAmbVc',Authorization:auth}
    });
    if(!u.ok) return res.status(401).json({error:'Sesión no válida'});
  }catch{
    return res.status(503).json({error:'No se pudo validar la sesión'});
  }

  const key=process.env.AI_GATEWAY_API_KEY||process.env.VERCEL_OIDC_TOKEN;
  if(!key) return res.status(503).json({code:'AI_NOT_CONFIGURED',error:'La lectura automática no está disponible ahora mismo.'});

  try{
    const {dataUrl,name='documento',type='image/jpeg'}=req.body||{};
    if(!dataUrl||typeof dataUrl!=='string') return res.status(400).json({error:'Falta el archivo'});
    if(dataUrl.length>5_500_000) return res.status(413).json({error:'El archivo es demasiado grande'});

    const prompt=`Lee este documento de compra de un negocio de hostelería en España y devuelve SOLO JSON válido, sin markdown ni explicaciones.
Estructura exacta:
{"document_type":"invoice|ticket|delivery_note","date":"YYYY-MM-DD o null","supplier":"texto o null","invoice_number":"texto o null","base_amount":numero o null,"vat_amount":numero o null,"total":numero o null,"related_document_numbers":["texto"],"items":[{"description":"texto","box_count":numero o null,"quantity":numero o null,"unit":"texto o null","unit_price":numero o null,"line_total":numero o null}]}.

Reglas:
1) Clasifica invoice si es factura oficial, ticket si es ticket/factura simplificada y delivery_note si es albarán/nota de entrega.
2) date es fecha de emisión; invoice_number es el número principal del documento.
3) base_amount es la base imponible real; vat_amount solo IVA; total es el total final impreso.
4) Incluye solo líneas reales de productos/servicios. No metas subtotal, IVA, total, pagos ni textos administrativos.
5) Si hay columnas CAJAS y CANTIDAD, NO las confundas: box_count sale de CAJAS y quantity sale de CANTIDAD.
6) La cifra y la letra de CANTIDAD tienen prioridad absoluta sobre números del nombre o embalaje. Ejemplos: 6,00 U => quantity=6 unit=unidad; 4,00 K => quantity=4 unit=kg; 5,00 P => quantity=5 unit=paquete.
7) No deduzcas quantity de textos como 6b x 800g, 4b x 1kg o 20pz.
8) Normaliza unidades a kg, g, l, ml, unidad, caja, bandeja, paquete o botella.
9) line_total es el neto final de la línea antes de IVA y después de promociones/descuentos.
10) unit_price debe ser el coste unitario neto realmente pagado. Si hay PRECIO BASE y PROMOCIÓN, no uses el precio base sin descuento.
11) Relee visualmente cada cifra antes de responder. Distingue especialmente 6 de 8, 60,31 de 65,31 y 254,63 de 254,83.
12) Si has capturado todas las líneas de una factura, la suma de line_total debe coincidir con base_amount salvo que el documento muestre otro concepto explícito.
13) Si no hay cargos adicionales explícitos, total debe ser coherente con base_amount + vat_amount.
14) Si un dato no se ve con claridad, usa null; no inventes.
15) Usa punto decimal en números.`;

    const n=v=>{
      if(v===null||v===undefined||v==='') return null;
      const x=Number(String(v).replace(',','.'));
      return Number.isFinite(x)?x:null;
    };
    const round2=v=>Number(Number(v).toFixed(2));
    const parseJson=text=>{
      const m=String(text||'').match(/\{[\s\S]*\}/);
      if(!m) return null;
      try{return JSON.parse(m[0])}catch{return null}
    };
    const normalizeDate=v=>{
      if(!v) return null;
      const s=String(v).trim();
      if(/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
      const m=s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
      return m?`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`:null;
    };
    const normalizeUnit=v=>{
      if(v===null||v===undefined||v==='') return null;
      const raw=String(v).trim().toLowerCase().replace(/\./g,'').replace(/\s+/g,'');
      const map={c:'caja',cj:'caja',caj:'caja',caja:'caja',cajas:'caja',u:'unidad',ud:'unidad',uds:'unidad',un:'unidad',unidad:'unidad',unidades:'unidad',kg:'kg',kgs:'kg',kilo:'kg',kilos:'kg',k:'kg',g:'g',gr:'g',grs:'g',gramo:'g',gramos:'g',l:'l',lt:'l',lts:'l',litro:'l',litros:'l',ml:'ml',b:'bandeja',bdj:'bandeja',bandeja:'bandeja',bandejas:'bandeja',p:'paquete',paq:'paquete',paquete:'paquete',paquetes:'paquete',bot:'botella',botella:'botella',botellas:'botella'};
      return (map[raw]||String(v).trim().toLowerCase()).slice(0,40);
    };
    const correctUnitFromPackaging=(description,boxCount,quantity,unit)=>{
      const normalized=normalizeUnit(unit);
      if(quantity===null||quantity===undefined||quantity<0) return normalized;
      if(normalized!=='unidad'&&normalized!==null) return normalized;
      const d=String(description||'').toLowerCase().replace(/,/g,'.');
      const boxes=boxCount!==null&&boxCount!==undefined&&boxCount>0?boxCount:1;
      const close=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=Math.max(.01,Math.abs(b)*.01);
      const kg=d.match(/(\d+(?:\.\d+)?)\s*(?:b|bolsa|bolsas|bandeja|bandejas|paq|paquete|paquetes)\s*x\s*(\d+(?:\.\d+)?)\s*kg\b/i);
      if(kg&&close(quantity,Number(kg[1])*Number(kg[2])*boxes)) return 'kg';
      const g=d.match(/(\d+(?:\.\d+)?)\s*(?:b|bolsa|bolsas|bandeja|bandejas|paq|paquete|paquetes)\s*x\s*(\d+(?:\.\d+)?)\s*g\b/i);
      if(g&&close(quantity,(Number(g[1])*Number(g[2])*boxes)/1000)) return 'kg';
      return normalized;
    };

    let rawText='';
    const isPdf=type==='application/pdf'||dataUrl.startsWith('data:application/pdf');
    if(isPdf){
      try{
        const {generateText}=await import('ai');
        const comma=dataUrl.indexOf(',');
        if(comma<0) return res.status(400).json({error:'PDF no válido'});
        const pdf=Buffer.from(dataUrl.slice(comma+1),'base64');
        const result=await generateText({
          model:'google/gemini-2.5-flash-lite',
          messages:[{role:'user',content:[{type:'text',text:prompt},{type:'file',mediaType:'application/pdf',data:pdf,filename:name||'documento.pdf'}]}],
          maxOutputTokens:4200,
          abortSignal:AbortSignal.timeout(135000)
        });
        rawText=result.text||'';
      }catch(e){
        console.error('PDF AI v2',e?.name||'unknown',e?.message||'unknown');
        return res.status(502).json({code:'AI_SERVICE_ERROR',error:'La IA ha tardado demasiado o no pudo leer el PDF. Inténtalo otra vez.'});
      }
    }else{
      const controller=new AbortController();
      const timer=setTimeout(()=>controller.abort(),135000);
      try{
        const r=await fetch('https://ai-gateway.vercel.sh/v1/responses',{
          method:'POST',signal:controller.signal,
          headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
          body:JSON.stringify({model:'alibaba/qwen3.5-flash',input:[{type:'message',role:'user',content:[{type:'input_text',text:prompt},{type:'input_image',image_url:dataUrl,detail:'high'}]}],max_output_tokens:4200})
        });
        const text=await r.text();
        let data={};try{data=JSON.parse(text)}catch{}
        if(!r.ok) return res.status(502).json({code:'AI_SERVICE_ERROR',error:'No se pudo leer el documento ahora mismo. Inténtalo otra vez.'});
        if(typeof data.output_text==='string') rawText=data.output_text;
        if(!rawText&&Array.isArray(data.output)) for(const item of data.output) if(item.type==='message'&&Array.isArray(item.content)) for(const c of item.content) if(typeof c.text==='string') rawText+=c.text;
      }catch(e){
        console.error('Image AI v2',e?.name||'unknown',e?.message||'unknown');
        return res.status(502).json({code:'AI_SERVICE_ERROR',error:'La IA ha tardado demasiado o no pudo leer la imagen. Inténtalo otra vez.'});
      }finally{clearTimeout(timer)}
    }

    const inv=parseJson(rawText);
    if(!inv) return res.status(502).json({error:'No se han podido identificar los datos del documento.'});

    const rawItems=Array.isArray(inv.items)?inv.items.slice(0,100).map(x=>({
      description:String(x?.description||'').trim().slice(0,300),
      box_count:n(x?.box_count),quantity:n(x?.quantity),unit:normalizeUnit(x?.unit),unit_price:n(x?.unit_price),line_total:n(x?.line_total)
    })).filter(x=>x.description):[];

    let base=n(inv.base_amount),vat=n(inv.vat_amount),total=n(inv.total);

    // Si una sola cifra de línea está mal leída, usa la aritmética de la propia factura para localizarla.
    if(base!==null&&rawItems.length&&rawItems.every(x=>x.line_total!==null)){
      const sum=rawItems.reduce((a,x)=>a+x.line_total,0);
      const currentGap=Math.abs(sum-base);
      if(currentGap>.05){
        let best=null;
        rawItems.forEach((x,i)=>{
          if(x.quantity===null||x.unit_price===null||x.quantity===0) return;
          const candidate=round2(x.quantity*x.unit_price);
          const newSum=sum-x.line_total+candidate;
          const gap=Math.abs(newSum-base);
          if(gap<=.05&&(!best||gap<best.gap)) best={i,candidate,gap};
        });
        if(best){
          console.log('Invoice AI v2 reconciled one line total',best.i);
          rawItems[best.i].line_total=best.candidate;
        }
      }
    }

    // Corrige cantidades OCR absurdas cuando precio impreso y total de línea apuntan claramente a otra cantidad.
    rawItems.forEach(x=>{
      if(x.quantity===null||x.unit_price===null||x.line_total===null||x.unit_price===0) return;
      const predicted=x.quantity*x.unit_price;
      const mismatch=Math.abs(predicted-x.line_total)/Math.max(.01,Math.abs(x.line_total));
      if(mismatch<.18) return; // descuentos/promociones normales no deben cambiar la cantidad
      const derived=x.line_total/x.unit_price;
      const nearest=Math.round(derived);
      if(nearest>0&&Math.abs(derived-nearest)<=.08&&Math.abs(nearest-x.quantity)>=1){
        console.log('Invoice AI v2 corrected suspicious quantity',x.quantity,'->',nearest);
        x.quantity=nearest;
      }
    });

    // En errores OCR de pocos céntimos en el total, base+IVA es una comprobación segura.
    if(base!==null&&vat!==null&&total!==null){
      const expected=round2(base+vat);
      const diff=Math.abs(total-expected);
      if(diff>.001&&diff<=.50) total=expected;
    }

    const items=rawItems.map(x=>{
      const unit=correctUnitFromPackaging(x.description,x.box_count,x.quantity,x.unit);
      let unitPrice=x.unit_price;
      if(x.quantity!==null&&x.quantity!==0&&x.line_total!==null){
        const effective=x.line_total/x.quantity;
        if(Number.isFinite(effective)) unitPrice=Number(effective.toFixed(6));
      }
      return{description:x.description,box_count:x.box_count,quantity:x.quantity,unit,unit_price:unitPrice,line_total:x.line_total};
    });

    const documentType=['invoice','ticket','delivery_note'].includes(inv.document_type)?inv.document_type:'invoice';
    const related=Array.isArray(inv.related_document_numbers)?inv.related_document_numbers.map(x=>String(x||'').trim().slice(0,100)).filter(Boolean).slice(0,30):[];

    return res.status(200).json({invoice:{document_type:documentType,date:normalizeDate(inv.date),supplier:inv.supplier||null,invoice_number:inv.invoice_number||null,base_amount:base,vat_amount:vat,total,related_document_numbers:related,items}});
  }catch(e){
    console.error('Invoice AI v2 internal',e?.message||'unknown');
    return res.status(500).json({code:'AI_INTERNAL_ERROR',error:'No se pudo procesar el documento. Inténtalo otra vez.'});
  }
};
