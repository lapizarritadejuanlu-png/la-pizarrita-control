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
Formato: {"document_type":"invoice|ticket|delivery_note","date":"YYYY-MM-DD o null","supplier":"texto o null","invoice_number":"texto o null","base_amount":numero o null,"vat_amount":numero o null,"total":numero o null,"related_document_numbers":["texto"],"items":[{"description":"texto","box_count":numero o null,"quantity":numero o null,"unit":"texto o null","unit_price":numero o null,"line_total":numero o null}]}.
Reglas: identifica factura/ticket/albarán; usa fecha de emisión y número principal; base_amount es base imponible, vat_amount solo IVA y total el total final. Extrae solo líneas reales de productos/servicios. Si existen columnas CAJAS y CANTIDAD, box_count sale de CAJAS y quantity de CANTIDAD. No deduzcas cantidades por textos de embalaje. Normaliza unidades a kg,g,l,ml,unidad,caja,bandeja,paquete,botella. line_total es el neto real de la línea tras descuentos y antes de IVA. unit_price es el coste unitario neto realmente pagado; si hay promociones, no uses el precio base sin descuento. Si algo no se ve claro usa null. No inventes. Usa punto decimal.`;
    let raw='';
    const isPdf=type==='application/pdf'||dataUrl.startsWith('data:application/pdf');
    if(isPdf){
      const {generateText}=await import('ai');
      const comma=dataUrl.indexOf(',');if(comma<0)return res.status(400).json({error:'PDF no válido'});
      const pdf=Buffer.from(dataUrl.slice(comma+1),'base64');
      const r=await generateText({model:'google/gemini-2.5-flash-lite',messages:[{role:'user',content:[{type:'text',text:prompt},{type:'file',mediaType:'application/pdf',data:pdf,filename:name||'documento.pdf'}]}],maxOutputTokens:3200,abortSignal:AbortSignal.timeout(70000)});
      raw=r.text||'';
    }else{
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),70000);
      try{
        const r=await fetch('https://ai-gateway.vercel.sh/v1/responses',{method:'POST',signal:controller.signal,headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model:'google/gemini-2.5-flash-lite',input:[{type:'message',role:'user',content:[{type:'input_text',text:prompt},{type:'input_image',image_url:dataUrl,detail:'high'}]}],max_output_tokens:3200})});
        const text=await r.text();let d={};try{d=JSON.parse(text)}catch{}
        if(!r.ok){console.error('Image AI v3 gateway',r.status,text.slice(0,300));return res.status(502).json({code:'AI_SERVICE_ERROR',error:'No se pudo leer el documento ahora mismo. Inténtalo otra vez.'})}
        if(typeof d.output_text==='string')raw=d.output_text;
        if(!raw&&Array.isArray(d.output))for(const item of d.output)if(item.type==='message'&&Array.isArray(item.content))for(const c of item.content)if(typeof c.text==='string')raw+=c.text;
      }finally{clearTimeout(timer)}
    }
    const m=String(raw).match(/\{[\s\S]*\}/);if(!m)return res.status(502).json({error:'No se han podido identificar los datos del documento.'});
    let x;try{x=JSON.parse(m[0])}catch{return res.status(502).json({error:'No se han podido interpretar los datos del documento.'})}
    const num=v=>{if(v===null||v===undefined||v==='')return null;const n=Number(String(v).replace(',','.'));return Number.isFinite(n)?n:null};
    const normDate=v=>{if(!v)return null;const s=String(v).trim();if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;const z=s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);return z?`${z[3]}-${z[2].padStart(2,'0')}-${z[1].padStart(2,'0')}`:null};
    const normUnit=v=>{if(v===null||v===undefined||v==='')return null;const r=String(v).trim().toLowerCase().replace(/\./g,'');const map={u:'unidad',ud:'unidad',uds:'unidad',unidad:'unidad',unidades:'unidad',c:'caja',cj:'caja',caja:'caja',cajas:'caja',k:'kg',kg:'kg',kgs:'kg',g:'g',gr:'g',l:'l',lt:'l',ml:'ml',b:'bandeja',bandeja:'bandeja',p:'paquete',paq:'paquete',paquete:'paquete',bot:'botella',botella:'botella'};return (map[r]||r).slice(0,40)};
    const items=Array.isArray(x.items)?x.items.slice(0,100).map(i=>{const q=num(i?.quantity),lt=num(i?.line_total);let up=num(i?.unit_price);if(q!==null&&q!==0&&lt!==null){const e=lt/q;if(Number.isFinite(e))up=Number(e.toFixed(6))}return{description:String(i?.description||'').trim().slice(0,300),box_count:num(i?.box_count),quantity:q,unit:normUnit(i?.unit),unit_price:up,line_total:lt}}).filter(i=>i.description):[];
    const documentType=['invoice','ticket','delivery_note'].includes(x.document_type)?x.document_type:'invoice';
    const related=Array.isArray(x.related_document_numbers)?x.related_document_numbers.map(v=>String(v||'').trim().slice(0,100)).filter(Boolean).slice(0,30):[];
    return res.status(200).json({invoice:{document_type:documentType,date:normDate(x.date),supplier:x.supplier||null,invoice_number:x.invoice_number||null,base_amount:num(x.base_amount),vat_amount:num(x.vat_amount),total:num(x.total),related_document_numbers:related,items}});
  }catch(e){console.error('Invoice AI v3',e?.name||'',e?.message||'');return res.status(502).json({code:'AI_SERVICE_ERROR',error:'La IA ha tardado demasiado o no pudo leer la imagen. Inténtalo otra vez.'})}
};