module.exports = async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Método no permitido'});

  const auth=req.headers.authorization||'';
  if(!auth.startsWith('Bearer ')) return res.status(401).json({error:'Acceso no autorizado'});

  try{
    const userCheck=await fetch('https://mpzemodwiuxqemvfaqvs.supabase.co/auth/v1/user',{
      headers:{
        apikey:'sb_publishable_5b0LE9t_UFaHQwsYZ7BvKQ_k_tAmbVc',
        Authorization:auth
      }
    });
    if(!userCheck.ok) return res.status(401).json({error:'Sesión no válida'});
  }catch{
    return res.status(503).json({error:'No se pudo validar la sesión'});
  }

  const key=process.env.AI_GATEWAY_API_KEY||process.env.VERCEL_OIDC_TOKEN;
  if(!key) return res.status(503).json({
    code:'AI_NOT_CONFIGURED',
    error:'La lectura automática no está disponible ahora mismo.'
  });

  try{
    const {dataUrl,name='documento',type='image/jpeg'}=req.body||{};
    if(!dataUrl||typeof dataUrl!=='string') return res.status(400).json({error:'Falta el archivo'});
    if(dataUrl.length>5_500_000) return res.status(413).json({error:'El archivo es demasiado grande'});

    const prompt=`Lee este documento de compra de un negocio de hostelería en España. ANTES de extraer importes, clasifícalo correctamente. Devuelve SOLO JSON válido, sin markdown ni explicaciones, con exactamente esta estructura:
{"document_type":"invoice|ticket|delivery_note","date":"YYYY-MM-DD o null","supplier":"texto o null","invoice_number":"texto o null","base_amount":numero o null,"vat_amount":numero o null,"total":numero o null,"related_document_numbers":["texto"],"items":[{"description":"texto","box_count":numero o null,"quantity":numero o null,"unit":"texto o null","unit_price":numero o null,"line_total":numero o null}]}.

CLASIFICACIÓN OBLIGATORIA:
0) document_type debe ser exactamente uno de estos valores:
- invoice: factura oficial, factura rectificativa, abono o documento claramente identificado como FACTURA y con formato fiscal de factura.
- ticket: ticket de caja, recibo de comercio, justificante POS o FACTURA SIMPLIFICADA/ticket que no tenga el formato de una factura completa de proveedor. Aunque aparezca el texto "factura simplificada", clasifícalo como ticket.
- delivery_note: albarán, nota de entrega, vale de entrega o documento de mercancía entregada que NO sea la factura oficial. Si aparece claramente ALBARÁN/ALBARAN/NOTA DE ENTREGA como documento principal y no FACTURA como documento principal, usa delivery_note.
No asumas invoice por defecto. Si hay duda entre invoice y delivery_note, da prioridad a lo que el propio documento diga en su título o cabecera.

Reglas estrictas para la cabecera:
1) date debe ser la FECHA DE EMISIÓN del documento. No uses fecha de vencimiento, periodo de facturación, fecha de lectura ni fecha de consumo.
2) invoice_number debe ser el número principal del documento: número de factura si es invoice, número de ticket si es ticket y número de albarán si es delivery_note. No uses número de contrato, cliente, referencia bancaria, identificación o contador.
3) related_document_numbers contiene SOLO números de albaranes, tickets o documentos previos que una FACTURA mencione explícitamente como origen o referencia. No incluyas el propio invoice_number. Si no hay referencias claras, devuelve [].
4) base_amount es la BASE IMPONIBLE REAL sobre la que se calcula el IVA. Si hay varias bases con distintos tipos de IVA, suma las bases imponibles. NO calcules base_amount como total menos IVA. NO incluyas cánones, tasas, tributos, residuos u otros conceptos no sujetos/exentos de IVA salvo que el propio documento indique claramente que forman parte de una base imponible.
5) Si el documento no muestra explícitamente la base pero muestra un único tipo de IVA y su cuota, puedes deducir la base como cuota_IVA / tipo_IVA únicamente si el cálculo es claro y coherente. En tickets o albaranes, si la base no está clara, devuelve null.
6) vat_amount es la suma de todas las cuotas de IVA que aparezcan claramente. No incluyas otros impuestos o tasas. En tickets o albaranes sin desglose claro, devuelve null.
7) total es el TOTAL FINAL del documento. En un albarán puede ser el total del albarán si aparece, aunque luego no se contabilizará como factura definitiva.

Reglas estrictas para items:
8) Incluye únicamente líneas reales de productos o servicios comprados/abonados. NO incluyas subtotal, base imponible, IVA, recargo, total, forma de pago, descuentos globales, vencimientos ni textos administrativos como productos.
9) description debe conservar un nombre útil del producto tal como aparece, limpiando solo códigos internos que no aporten información.
10) Si hay una columna separada CAJAS/CJ/C, extrae ese número en box_count. Si además hay CANTIDAD, PESO o unidades, NO confundas ambas: box_count es cajas y quantity es la cantidad/peso/unidades de esa segunda columna.
11) quantity es la cantidad real de la columna CANTIDAD/PESO/UD/KG/L. La letra o unidad impresa JUNTO a esa cantidad tiene prioridad sobre cualquier texto de embalaje que aparezca en description. Si solo existe una cantidad y claramente está expresada en cajas, usa quantity con unit="caja" y box_count=null para no duplicar.
12) unit debe ser corta y normalizada. Usa preferentemente: kg, g, l, ml, unidad, caja, bandeja, paquete, botella. Convierte C/CJ a caja, UD/U a unidad, K a kg, GR a g y LT a l. Ejemplo obligatorio: si la fila muestra CAJAS=1 y CANTIDAD=4,00 K, devuelve box_count=1, quantity=4, unit="kg", aunque la descripción diga "4b x 1kg".
13) MUY IMPORTANTE: unit_price debe representar el COSTE UNITARIO NETO EFECTIVAMENTE PAGADO antes de IVA, DESPUÉS de promociones, descuentos, bonificaciones o rebajas aplicadas a esa línea. Si el documento muestra una columna PRECIO BASE y otra PROMOCIÓN/DESCUENTO, NO uses el precio base sin descuento como unit_price. Usa el precio efectivo final.
14) Cuando quantity y line_total estén claros, calcula unit_price = line_total / quantity. Esta regla tiene prioridad sobre un precio base impreso si existe descuento/promoción. Conserva hasta 6 decimales y no redondees a 2 decimales.
15) line_total es el importe NETO FINAL de esa línea antes de IVA, después de descuentos/promociones de línea. Mantén importes negativos en abonos/devoluciones.
16) Si una línea está poco clara, devuelve null en sus campos dudosos en vez de inventar.
17) No inventes datos. Usa punto decimal en números. Si no hay líneas identificables, devuelve items:[].`;

    const isPdf=type==='application/pdf'||dataUrl.startsWith('data:application/pdf');
    let text='';

    if(isPdf){
      const {generateText}=await import('ai');
      const comma=dataUrl.indexOf(',');
      if(comma<0) return res.status(400).json({error:'PDF no válido'});
      const pdf=Buffer.from(dataUrl.slice(comma+1),'base64');
      if(!pdf.length) return res.status(400).json({error:'PDF vacío'});
      try{
        const result=await generateText({
          model:'google/gemini-2.5-flash-lite',
          messages:[{role:'user',content:[
            {type:'text',text:prompt},
            {type:'file',mediaType:'application/pdf',data:pdf,filename:name||'documento.pdf'}
          ]}],
          maxOutputTokens:4200
        });
        text=result.text||'';
      }catch(e){
        console.error('PDF AI error',e?.name||'unknown',e?.message||'unknown');
        return res.status(502).json({code:'AI_SERVICE_ERROR',error:'No se pudo leer el PDF ahora mismo. Inténtalo de nuevo.'});
      }
    }else{
      const content=[
        {type:'input_text',text:prompt},
        {type:'input_image',image_url:dataUrl,detail:'high'}
      ];
      const r=await fetch('https://ai-gateway.vercel.sh/v1/responses',{
        method:'POST',
        headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
        body:JSON.stringify({
          model:'alibaba/qwen3.5-flash',
          input:[{type:'message',role:'user',content}],
          max_output_tokens:4200
        })
      });
      const raw=await r.text();
      let data;
      try{data=JSON.parse(raw)}catch{data={}}
      if(!r.ok){
        console.error('AI Gateway error',r.status,data?.error?.type||data?.type||'unknown');
        return res.status(502).json({code:'AI_SERVICE_ERROR',error:'No se pudo leer el documento ahora mismo. Inténtalo de nuevo.'});
      }
      if(typeof data.output_text==='string') text=data.output_text;
      if(!text&&Array.isArray(data.output)){
        for(const item of data.output){
          if(item.type==='message'&&Array.isArray(item.content)){
            for(const c of item.content) if(typeof c.text==='string') text+=c.text;
          }
        }
      }
    }

    const match=text.match(/\{[\s\S]*\}/);
    if(!match) return res.status(502).json({error:'No se han podido identificar los datos del documento.'});

    let inv;
    try{inv=JSON.parse(match[0])}
    catch{return res.status(502).json({error:'No se han podido identificar los datos del documento.'})}

    const n=v=>{
      if(v===null||v===undefined||v==='') return null;
      const x=Number(String(v).replace(',','.'));
      return Number.isFinite(x)?x:null;
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
      const map={
        c:'caja',cj:'caja',caj:'caja',caja:'caja',cajas:'caja',
        u:'unidad',ud:'unidad',uds:'unidad',un:'unidad',unidad:'unidad',unidades:'unidad',
        kg:'kg',kgs:'kg',kilo:'kg',kilos:'kg',k:'kg',
        g:'g',gr:'g',grs:'g',gramo:'g',gramos:'g',
        l:'l',lt:'l',lts:'l',litro:'l',litros:'l',ml:'ml',
        b:'bandeja',bdj:'bandeja',bandeja:'bandeja',bandejas:'bandeja',
        p:'paquete',paq:'paquete',paquete:'paquete',paquetes:'paquete',
        bot:'botella',botella:'botella',botellas:'botella'
      };
      return (map[raw]||String(v).trim().toLowerCase()).slice(0,40);
    };

    const correctUnitFromPackaging=(description,boxCount,quantity,unit)=>{
      const normalized=normalizeUnit(unit);
      if(quantity===null||quantity===undefined||quantity<0) return normalized;
      if(normalized!=='unidad'&&normalized!==null) return normalized;

      const d=String(description||'').toLowerCase().replace(/,/g,'.');
      const boxes=boxCount!==null&&boxCount!==undefined&&boxCount>0?boxCount:1;
      const close=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=Math.max(0.01,Math.abs(b)*0.01);

      const kgPack=d.match(/(\d+(?:\.\d+)?)\s*(?:b|bolsa|bolsas|bandeja|bandejas|paq|paquete|paquetes)\s*x\s*(\d+(?:\.\d+)?)\s*kg\b/i);
      if(kgPack){
        const packs=Number(kgPack[1]);
        const kgEach=Number(kgPack[2]);
        if(close(quantity,packs*kgEach*boxes)) return 'kg';
      }

      const gPack=d.match(/(\d+(?:\.\d+)?)\s*(?:b|bolsa|bolsas|bandeja|bandejas|paq|paquete|paquetes)\s*x\s*(\d+(?:\.\d+)?)\s*g\b/i);
      if(gPack){
        const packs=Number(gPack[1]);
        const gramsEach=Number(gPack[2]);
        if(close(quantity,(packs*gramsEach*boxes)/1000)) return 'kg';
      }

      return normalized;
    };

    const items=Array.isArray(inv.items)?inv.items.slice(0,100).map(x=>{
      const description=String(x?.description||'').trim().slice(0,300);
      const boxCount=n(x?.box_count);
      const quantity=n(x?.quantity);
      const lineTotal=n(x?.line_total);
      let unitPrice=n(x?.unit_price);
      if(quantity!==null&&quantity!==0&&lineTotal!==null){
        const effective=lineTotal/quantity;
        if(Number.isFinite(effective)) unitPrice=Number(effective.toFixed(6));
      }
      return{
        description,
        box_count:boxCount,
        quantity,
        unit:correctUnitFromPackaging(description,boxCount,quantity,x?.unit),
        unit_price:unitPrice,
        line_total:lineTotal
      };
    }).filter(x=>x.description):[];

    const documentType=['invoice','ticket','delivery_note'].includes(inv.document_type)?inv.document_type:'invoice';
    const relatedDocumentNumbers=Array.isArray(inv.related_document_numbers)?inv.related_document_numbers.map(x=>String(x||'').trim().slice(0,100)).filter(Boolean).slice(0,30):[];

    return res.status(200).json({invoice:{
      document_type:documentType,
      date:normalizeDate(inv.date),
      supplier:inv.supplier||null,
      invoice_number:inv.invoice_number||null,
      base_amount:n(inv.base_amount),
      vat_amount:n(inv.vat_amount),
      total:n(inv.total),
      related_document_numbers:relatedDocumentNumbers,
      items
    }});
  }catch(e){
    console.error('Invoice AI internal error',e?.message||'unknown');
    return res.status(500).json({code:'AI_INTERNAL_ERROR',error:'No se pudo procesar el documento. Inténtalo de nuevo.'});
  }
}
