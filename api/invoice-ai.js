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
    const {dataUrl,name='factura',type='image/jpeg'}=req.body||{};

    if(!dataUrl||typeof dataUrl!=='string')
      return res.status(400).json({error:'Falta el archivo'});

    if(dataUrl.length>5_500_000)
      return res.status(413).json({error:'El archivo es demasiado grande'});

    const prompt=`Lee esta factura de proveedor para un negocio de hostelería en España y devuelve SOLO JSON válido, sin markdown ni explicaciones, con exactamente esta estructura:
{"date":"YYYY-MM-DD o null","supplier":"texto o null","invoice_number":"texto o null","base_amount":numero o null,"vat_amount":numero o null,"total":numero o null,"items":[{"description":"texto","quantity":numero o null,"unit":"texto o null","unit_price":numero o null,"line_total":numero o null}]}.

Reglas estrictas para la cabecera:
1) date debe ser la FECHA DE EMISIÓN de la factura. No uses fecha de vencimiento, periodo de facturación, fecha de lectura ni fecha de consumo.
2) invoice_number debe ser el NÚMERO DE FACTURA. No uses número de contrato, cliente, referencia bancaria, identificación o contador.
3) base_amount es la BASE IMPONIBLE REAL sobre la que se calcula el IVA. Si hay varias bases con distintos tipos de IVA, suma las bases imponibles. NO calcules base_amount como total menos IVA. NO incluyas cánones, tasas, tributos, residuos u otros conceptos no sujetos/exentos de IVA salvo que la propia factura indique claramente que forman parte de una base imponible.
4) Si la factura no muestra explícitamente la base pero muestra un único tipo de IVA y su cuota, puedes deducir la base como cuota_IVA / tipo_IVA únicamente si el cálculo es claro y coherente. Usa el importe exacto de la línea gravada si aparece.
5) vat_amount es la suma de todas las cuotas de IVA. No incluyas otros impuestos o tasas.
6) total es el TOTAL FINAL A PAGAR de la factura.

Reglas estrictas para items:
7) Incluye en items únicamente líneas reales de productos o servicios comprados/abonados. NO incluyas subtotal, base imponible, IVA, recargo, total, forma de pago, descuentos globales, vencimientos ni textos administrativos como si fueran productos.
8) description debe conservar un nombre útil del producto tal como aparece en la factura, limpiando solo códigos internos que no aporten información.
9) quantity es la cantidad facturada. Si aparece peso (kg), litros, cajas, bandejas, unidades, etc., usa el número que representa la cantidad facturada.
10) unit debe ser una unidad corta y útil cuando pueda determinarse: kg, g, l, ml, unidad, caja, bandeja, paquete u otra que figure claramente. Si no se puede determinar, null.
11) unit_price es el precio unitario ANTES de IVA cuando la factura lo indique claramente. No inventes ni dividas line_total entre quantity si existe cualquier duda sobre descuentos, formatos o unidades.
12) line_total es el importe neto de esa línea antes de IVA cuando figure claramente. Mantén importes negativos en abonos/devoluciones.
13) Si una línea está poco clara, es mejor devolver null en sus campos numéricos que inventar.
14) No inventes datos. Usa punto decimal en números. Si no hay líneas identificables, devuelve items:[].`;

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
          messages:[{
            role:'user',
            content:[
              {type:'text',text:prompt},
              {type:'file',mediaType:'application/pdf',data:pdf,filename:name||'factura.pdf'}
            ]
          }],
          maxOutputTokens:3500
        });
        text=result.text||'';
      }catch(e){
        console.error('PDF AI error',e?.name||'unknown',e?.message||'unknown');
        return res.status(502).json({
          code:'AI_SERVICE_ERROR',
          error:'No se pudo leer el PDF ahora mismo. Inténtalo de nuevo.'
        });
      }
    }else{
      const content=[
        {type:'input_text',text:prompt},
        {type:'input_image',image_url:dataUrl,detail:'high'}
      ];

      const r=await fetch('https://ai-gateway.vercel.sh/v1/responses',{
        method:'POST',
        headers:{
          Authorization:`Bearer ${key}`,
          'Content-Type':'application/json'
        },
        body:JSON.stringify({
          model:'alibaba/qwen3.5-flash',
          input:[{type:'message',role:'user',content}],
          max_output_tokens:3500
        })
      });

      const raw=await r.text();
      let data;
      try{data=JSON.parse(raw)}catch{data={}}

      if(!r.ok){
        console.error('AI Gateway error',r.status,data?.error?.type||data?.type||'unknown');
        return res.status(502).json({
          code:'AI_SERVICE_ERROR',
          error:'No se pudo leer la factura ahora mismo. Inténtalo de nuevo.'
        });
      }

      if(typeof data.output_text==='string') text=data.output_text;
      if(!text&&Array.isArray(data.output)){
        for(const item of data.output){
          if(item.type==='message'&&Array.isArray(item.content)){
            for(const c of item.content){
              if(typeof c.text==='string') text+=c.text;
            }
          }
        }
      }
    }

    const match=text.match(/\{[\s\S]*\}/);

    if(!match)
      return res.status(502).json({
        error:'No se han podido identificar los datos de la factura.'
      });

    let inv;

    try{
      inv=JSON.parse(match[0]);
    }catch{
      return res.status(502).json({
        error:'No se han podido identificar los datos de la factura.'
      });
    }

    const n=v=>{
      if(v===null||v===undefined||v==='') return null;
      const x=Number(String(v).replace(',','.'));
      return Number.isFinite(x)?x:null;
    };

    const normalizeDate=v=>{
      if(!v) return null;
      const s=String(v).trim();
      if(/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
      let m=s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
      if(m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
      return null;
    };

    const items=Array.isArray(inv.items)?inv.items.slice(0,100).map(x=>({
      description:String(x?.description||'').trim().slice(0,300),
      quantity:n(x?.quantity),
      unit:x?.unit?String(x.unit).trim().slice(0,40):null,
      unit_price:n(x?.unit_price),
      line_total:n(x?.line_total)
    })).filter(x=>x.description):[];

    const clean={
      date:normalizeDate(inv.date),
      supplier:inv.supplier||null,
      invoice_number:inv.invoice_number||null,
      base_amount:n(inv.base_amount),
      vat_amount:n(inv.vat_amount),
      total:n(inv.total),
      items
    };

    return res.status(200).json({invoice:clean});

  }catch(e){
    console.error('Invoice AI internal error',e?.message||'unknown');
    return res.status(500).json({
      code:'AI_INTERNAL_ERROR',
      error:'No se pudo procesar la factura. Inténtalo de nuevo.'
    });
  }
}
