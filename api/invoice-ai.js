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

    const prompt=`Lee esta factura de proveedor para un negocio de hostelería en España. Extrae únicamente estos campos y devuelve SOLO JSON válido, sin markdown ni explicaciones: {"date":"YYYY-MM-DD o null","supplier":"texto o null","invoice_number":"texto o null","base_amount":numero o null,"vat_amount":numero o null,"total":numero o null}. Usa punto decimal en números. No inventes datos. Si hay varios tipos de IVA, vat_amount debe ser la suma total de IVA. El total debe ser el total final de la factura.`;

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

    const clean={
      date:inv.date||null,
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
