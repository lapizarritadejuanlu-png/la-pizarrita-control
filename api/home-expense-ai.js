module.exports=async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Método no permitido'});
  const auth=req.headers.authorization||'';
  if(!auth.startsWith('Bearer '))return res.status(401).json({error:'Acceso no autorizado'});
  try{const u=await fetch('https://mpzemodwiuxqemvfaqvs.supabase.co/auth/v1/user',{headers:{apikey:'sb_publishable_5b0LE9t_UFaHQwsYZ7BvKQ_k_tAmbVc',Authorization:auth}});if(!u.ok)return res.status(401).json({error:'Sesión no válida'})}catch{return res.status(503).json({error:'No se pudo validar la sesión'})}
  const key=process.env.AI_GATEWAY_API_KEY||process.env.VERCEL_OIDC_TOKEN;
  if(!key)return res.status(503).json({error:'La lectura automática no está disponible ahora mismo.'});
  try{
    const {dataUrl,type='image/jpeg'}=req.body||{};
    if(!dataUrl||typeof dataUrl!=='string')return res.status(400).json({error:'Falta la foto o PDF'});
    if(dataUrl.length>5_500_000)return res.status(413).json({error:'El archivo es demasiado grande'});
    const categories=['Casa','Supermercado','Coche','Familia','Ocio','Restaurantes','Viajes','Salud/Farmacia','Ropa','Suscripciones','Seguros','Gastos personales','Otros'];
    const prompt=`Lee este ticket, recibo o factura de gasto doméstico en España. Devuelve SOLO JSON válido, sin markdown: {"date":"YYYY-MM-DD o null","concept":"texto breve","category":"una categoría exacta","amount":numero o null}.\nCategorías permitidas: ${categories.join(', ')}.\nReglas: amount es el TOTAL FINAL PAGADO, no la base imponible; concept debe ser el comercio/proveedor o un concepto útil y corto; usa la fecha del documento; si no estás seguro de la categoría usa Otros; no inventes cifras.`;
    let raw='';
    if(type==='application/pdf'||dataUrl.startsWith('data:application/pdf')){
      const {generateText}=await import('ai');const comma=dataUrl.indexOf(',');if(comma<0)return res.status(400).json({error:'PDF no válido'});const pdf=Buffer.from(dataUrl.slice(comma+1),'base64');const r=await generateText({model:'google/gemini-2.5-flash-lite',messages:[{role:'user',content:[{type:'text',text:prompt},{type:'file',mediaType:'application/pdf',data:pdf,filename:'ticket.pdf'}]}],maxOutputTokens:700,abortSignal:AbortSignal.timeout(75000)});raw=r.text||'';
    }else{
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),75000);try{const r=await fetch('https://ai-gateway.vercel.sh/v1/responses',{method:'POST',signal:controller.signal,headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model:'alibaba/qwen3.5-flash',input:[{type:'message',role:'user',content:[{type:'input_text',text:prompt},{type:'input_image',image_url:dataUrl,detail:'high'}]}],max_output_tokens:700})});const text=await r.text();let d={};try{d=JSON.parse(text)}catch{}if(!r.ok)return res.status(502).json({error:'No se pudo leer el ticket ahora mismo.'});if(typeof d.output_text==='string')raw=d.output_text;if(!raw&&Array.isArray(d.output))for(const item of d.output)if(item.type==='message'&&Array.isArray(item.content))for(const c of item.content)if(typeof c.text==='string')raw+=c.text}finally{clearTimeout(timer)}
    }
    const m=String(raw).match(/\{[\s\S]*\}/);if(!m)return res.status(502).json({error:'No se han podido identificar los datos del ticket.'});let x;try{x=JSON.parse(m[0])}catch{return res.status(502).json({error:'No se han podido interpretar los datos del ticket.'})}
    const n=Number(String(x.amount??'').replace(',','.'));const date=/^\d{4}-\d{2}-\d{2}$/.test(String(x.date||''))?x.date:null;const category=categories.includes(x.category)?x.category:'Otros';
    return res.status(200).json({expense:{date,concept:String(x.concept||'').trim().slice(0,120)||null,category,amount:Number.isFinite(n)?n:null}})
  }catch(e){console.error('home-expense-ai',e?.name||'',e?.message||'');return res.status(502).json({error:'La IA ha tardado demasiado o no pudo leer el ticket. Inténtalo otra vez.'})}
};