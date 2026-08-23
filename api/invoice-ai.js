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
    error:'AI Gateway no configurado'
  });

  try{
    const {dataUrl,name='factura',type='image/jpeg'}=req.body||{};

    if(!dataUrl||typeof dataUrl!=='string')
      return res.status(400).json({error:'Falta el archivo'});

    if(dataUrl.length>5_500_000)
      return res.status(413).json({error:'El archivo es demasiado grande'});

    const prompt=`Lee esta factura de proveedor para un negocio en España y devuelve SOLO JSON válido, sin markdown ni explicaciones, con exactamente estos campos: {"date":"YYYY-MM-DD o null","supplier":"texto o null","invoice_number":"texto o null","base_amount":numero o null,"vat_amount":numero o null,"total":numero o null}.

Reglas estrictas:
1) date debe ser la FECHA DE EMISIÓN de la factura. No uses fecha de vencimiento, periodo de facturación, fecha de lectura ni fecha de consumo.
2) invoice_number debe ser el NÚMERO DE FACTURA. No uses número de contrato, cliente, referencia bancaria, identificación o contador.
3) base_amount es la BASE IMPONIBLE REAL sobre la que se calcula el IVA. Si hay varias bases con distintos tipos de IVA, suma las bases imponibles. NO calcules base_amount como total menos IVA. NO incluyas cánones, tasas, tributos, residuos u otros conceptos no sujetos/exentos de IVA salvo que la propia factura indique claramente que forman parte de una base imponible.
4) Si la factura no muestra explícitamente la base pero muestra un único tipo de IVA y su cuota, puedes deducir la base como cuota_IVA / tipo_IVA únicamente si el cálculo es claro y coherente. Ejemplo: IVA 5,22 € al 10% implica base 52,20 € aproximadamente; usa el importe exacto de la línea gravada si aparece.
5) vat_amount es la suma de todas las cuotas de IVA. No incluyas otros impuestos o tasas.
6) total es el TOTAL FINAL A PAGAR de la factura.
7) Usa punto decimal en números. No inventes datos. Si un dato no se puede determinar con seguridad, devuelve null.`;

    const content=[{type:'input_text',text:prompt}];

    if(type==='application/pdf'||dataUrl.startsWith('data:application/pdf')){
      content.push({
        type:'input_file',
        filename:name,
        file_data:dataUrl
      });
    }else{
      content.push({
        type:'input_image',
        image_url:dataUrl,
        detail:'high'
      });
    }

    const r=await fetch('https://ai-gateway.vercel.sh/v1/responses',{
      method:'POST',
      headers:{
        Authorization:`Bearer ${key}`,
        'Content-Type':'application/json'
      },
      body:JSON.stringify({
        model:'alibaba/qwen3.5-flash',
        input:[{
          type:'message',
          role:'user',
          content
        }],
        max_output_tokens:1200
      })
    });

    const raw=await r.text();
    let data;
    try{data=JSON.parse(raw)}catch{data={}}

    if(!r.ok)
      return res.status(502).json({
        error:data?.error?.message||data?.message||'Error de AI Gateway'
      });

    let text='';

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

    const match=text.match(/\{[\s\S]*\}/);

    if(!match)
      return res.status(502).json({
        error:'La IA no devolvió datos estructurados'
      });

    let inv;

    try{
      inv=JSON.parse(match[0]);
    }catch{
      return res.status(502).json({
        error:'No se pudo interpretar la respuesta de la IA'
      });
    }

    const n=v=>
      v===null||v===undefined||v===''?
      null:Number(String(v).replace(',','.'));

    const normalizeDate=v=>{
      if(!v) return null;
      const s=String(v).trim();
      if(/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
      let m=s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
      if(m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
      return null;
    };

    const clean={
      date:normalizeDate(inv.date),
      supplier:inv.supplier||null,
      invoice_number:inv.invoice_number||null,
      base_amount:n(inv.base_amount),
      vat_amount:n(inv.vat_amount),
      total:n(inv.total)
    };

    return res.status(200).json({invoice:clean});

  }catch(e){
    return res.status(500).json({
      error:e.message||'Error interno'
    });
  }
}
