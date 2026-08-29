module.exports=async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Método no permitido'});
  const auth=req.headers.authorization||'';
  if(!auth.startsWith('Bearer '))return res.status(401).json({error:'Acceso no autorizado'});
  try{
    const u=await fetch('https://mpzemodwiuxqemvfaqvs.supabase.co/auth/v1/user',{headers:{apikey:'sb_publishable_5b0LE9t_UFaHQwsYZ7BvKQ_k_tAmbVc',Authorization:auth}});
    if(!u.ok)return res.status(401).json({error:'Sesión no válida'});
  }catch{return res.status(503).json({error:'No se pudo validar la sesión'})}
  const key=process.env.AI_GATEWAY_API_KEY||process.env.VERCEL_OIDC_TOKEN;
  if(!key)return res.status(503).json({error:'La lectura automática no está disponible ahora mismo.'});
  try{
    const {dataUrl,type='image/jpeg'}=req.body||{};
    if(!dataUrl||typeof dataUrl!=='string')return res.status(400).json({error:'Falta la foto o PDF'});
    if(dataUrl.length>5_500_000)return res.status(413).json({error:'El archivo es demasiado grande'});
    const categories=['Casa','Supermercado','Coche','Familia','Ocio','Restaurantes','Viajes','Salud/Farmacia','Ropa','Suscripciones','Seguros','Gastos personales','Otros'];
    const prompt=`Lee este ticket, recibo o factura doméstica de España. Devuelve SOLO JSON válido, sin markdown, con esta forma exacta: {"date":"YYYY-MM-DD o null","concept":"comercio/proveedor","category":"una categoría exacta","amount":numero o null,"items":[{"name":"producto","quantity":numero o null,"unit_price":numero o null,"line_total":numero o null,"vat_rate":numero o null}]}.
Categorías permitidas: ${categories.join(', ')}.
REGLAS CRÍTICAS PARA LOS PRODUCTOS:
1. Extrae únicamente las líneas reales de compra del cuerpo del ticket, antes del TOTAL.
2. En muchos supermercados españoles cada línea termina con DOS cifras bajo columnas tipo IMPORTE y %IVA. Ejemplo: «AMANIDA ... 1,75 4,00» significa PRECIO/IMPORTE DEL PRODUCTO = 1,75 € y TIPO DE IVA = 4%; NUNCA significa que el producto cueste 4,00 €. Otro ejemplo: «BOSSE ... 0,12 21,00» significa IMPORTE = 0,12 € e IVA = 21%.
3. Si el último número de una línea es 4, 10 o 21 (o 4.00/10.00/21.00) y hay otra cifra monetaria justo antes, interpreta el último como vat_rate y la cifra anterior como line_total.
4. vat_rate solo puede ser un porcentaje fiscal. NO lo pongas jamás como line_total ni unit_price.
5. IGNORA POR COMPLETO el bloque fiscal/resumen inferior con BASE, IVA, CUOTA, TIPO, % IVA, IMPUESTO, TOTAL IMPUESTOS, PAGO, TARJETA, EFECTIVO, CAMBIO o REDONDEO.
6. line_total debe ser el importe monetario pagado por ESA línea. Si quantity=1 y solo hay un importe, line_total es ese importe. unit_price déjalo null salvo que el ticket muestre claramente un precio unitario distinto.
7. Si hay cantidad x precio, quantity es la cantidad, unit_price es el precio unitario y line_total es el total de esa línea.
8. amount es el TOTAL FINAL PAGADO del ticket, nunca la base imponible ni el IVA.
9. COMPROBACIÓN OBLIGATORIA: la suma de line_total de todos los productos debe coincidir aproximadamente con amount. Si no coincide, vuelve a revisar las columnas y NO uses porcentajes de IVA como precios.
10. No inventes cifras. Si una cifra no se lee con claridad, usa null.
11. concept debe ser el comercio/proveedor. Usa la fecha del documento. Si no estás seguro de la categoría usa Otros.`;
    let raw='';
    if(type==='application/pdf'||dataUrl.startsWith('data:application/pdf')){
      const {generateText}=await import('ai');
      const comma=dataUrl.indexOf(',');if(comma<0)return res.status(400).json({error:'PDF no válido'});
      const pdf=Buffer.from(dataUrl.slice(comma+1),'base64');
      const r=await generateText({model:'google/gemini-2.5-flash-lite',messages:[{role:'user',content:[{type:'text',text:prompt},{type:'file',mediaType:'application/pdf',data:pdf,filename:'ticket.pdf'}]}],maxOutputTokens:1800,abortSignal:AbortSignal.timeout(55000)});
      raw=r.text||'';
    }else{
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),55000);
      try{
        const r=await fetch('https://ai-gateway.vercel.sh/v1/responses',{method:'POST',signal:controller.signal,headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model:'google/gemini-2.5-flash-lite',input:[{type:'message',role:'user',content:[{type:'input_text',text:prompt},{type:'input_image',image_url:dataUrl,detail:'high'}]}],max_output_tokens:1800})});
        const text=await r.text();let d={};try{d=JSON.parse(text)}catch{}
        if(!r.ok)return res.status(502).json({error:'No se pudo leer el ticket ahora mismo.'});
        if(typeof d.output_text==='string')raw=d.output_text;
        if(!raw&&Array.isArray(d.output))for(const item of d.output)if(item.type==='message'&&Array.isArray(item.content))for(const c of item.content)if(typeof c.text==='string')raw+=c.text;
      }finally{clearTimeout(timer)}
    }
    const m=String(raw).match(/\{[\s\S]*\}/);if(!m)return res.status(502).json({error:'No se han podido identificar los datos del ticket.'});
    let x;try{x=JSON.parse(m[0])}catch{return res.status(502).json({error:'No se han podido interpretar los datos del ticket.'})}
    const num=v=>{if(v===null||v===undefined||v==='')return null;const n=Number(String(v).replace(',','.'));return Number.isFinite(n)?n:null};
    const round=n=>Math.round((Number(n)||0)*100)/100;
    const n=num(x.amount),date=/^\d{4}-\d{2}-\d{2}$/.test(String(x.date||''))?x.date:null,category=categories.includes(x.category)?x.category:'Otros';
    const bad=/^(base|iva|cuota|impuesto|tipo|%?\s*iva|total(?:\s+impuestos)?|pago|tarjeta|efectivo|cambio|redondeo|subtotal)$/i;
    let items=Array.isArray(x.items)?x.items.slice(0,60).map(i=>({name:String(i?.name||'').trim().slice(0,140),quantity:num(i?.quantity),unit_price:num(i?.unit_price),line_total:num(i?.line_total),vat_rate:num(i?.vat_rate)})).filter(i=>i.name&&!bad.test(i.name)):[];

    // Salvaguarda para tickets con columnas «Importe | %IVA». Si el modelo puso
    // 4/10/21 como precio y la cifra monetaria real quedó en unit_price, lo corregimos.
    const vatValues=new Set([4,10,21]);
    const suspicious=items.filter(i=>i.line_total!=null&&vatValues.has(round(i.line_total))&&i.unit_price!=null);
    if(items.length&&suspicious.length>=Math.ceil(items.length*0.6)){
      const candidate=items.reduce((s,i)=>s+(i.unit_price!=null?Number(i.unit_price):0),0);
      if(n!=null&&Math.abs(candidate-n)<=0.12){
        items=items.map(i=>{
          if(i.line_total!=null&&vatValues.has(round(i.line_total))&&i.unit_price!=null){
            return {...i,vat_rate:i.vat_rate??i.line_total,line_total:i.unit_price,unit_price:null};
          }
          return i;
        });
      }
    }

    // Nunca devolvemos una lista de precios claramente incoherente con el total del ticket.
    const known=items.filter(i=>i.line_total!=null);
    const itemSum=round(known.reduce((s,i)=>s+Number(i.line_total||0),0));
    const complete=known.length===items.length&&items.length>0;
    if(n!=null&&complete&&Math.abs(itemSum-n)>0.20){
      items=items.map(i=>({...i,line_total:null,unit_price:null}));
    }

    return res.status(200).json({expense:{date,concept:String(x.concept||'').trim().slice(0,120)||null,category,amount:n,items}});
  }catch(e){console.error('home-expense-ai',e?.name||'',e?.message||'');return res.status(502).json({error:'La IA ha tardado demasiado o no pudo leer el ticket. Inténtalo otra vez.'})}
};