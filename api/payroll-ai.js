module.exports = async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Método no permitido'});

  const auth=req.headers.authorization||'';
  if(!auth.startsWith('Bearer ')) return res.status(401).json({error:'Acceso no autorizado'});

  try{
    const userCheck=await fetch('https://mpzemodwiuxqemvfaqvs.supabase.co/auth/v1/user',{
      headers:{apikey:'sb_publishable_5b0LE9t_UFaHQwsYZ7BvKQ_k_tAmbVc',Authorization:auth}
    });
    if(!userCheck.ok) return res.status(401).json({error:'Sesión no válida'});
  }catch{
    return res.status(503).json({error:'No se pudo validar la sesión'});
  }

  const key=process.env.AI_GATEWAY_API_KEY||process.env.VERCEL_OIDC_TOKEN;
  if(!key) return res.status(503).json({code:'AI_NOT_CONFIGURED',error:'La lectura automática no está disponible ahora mismo.'});

  try{
    const {dataUrl,name='nominas.pdf',type='application/pdf'}=req.body||{};
    if(!dataUrl||typeof dataUrl!=='string') return res.status(400).json({error:'Falta el archivo'});
    if(dataUrl.length>7_000_000) return res.status(413).json({error:'El archivo es demasiado grande'});

    const prompt=`Lee este RESUMEN DE NÓMINA de una empresa española y devuelve SOLO JSON válido, sin markdown ni explicaciones, con exactamente esta estructura:
{"period_start":"YYYY-MM-DD o null","period_end":"YYYY-MM-DD o null","listed_at":"YYYY-MM-DD o null","worker_count":numero o null,"gross_total":numero o null,"net_total":numero o null,"rlc_total":numero o null,"cost_total":numero o null,"workers":[{"code":"texto o null","name":"texto","base_cc":numero o null,"base_irpf":numero o null,"gross_total":numero o null,"ss_worker":numero o null,"irpf":numero o null,"net_total":numero o null,"rlc":numero o null,"bonus_fc":numero o null,"cost_total":numero o null}]}.

Reglas estrictas:
1) period_start y period_end deben salir del periodo de nómina, por ejemplo de textos tipo “PAGA TOTAL DEL 01/07/2026 AL 31/07/2026”. No uses la fecha de listado como periodo.
2) listed_at es la “Fecha Listado” si aparece.
3) worker_count es el TOTAL TRABAJADORES EMPRESA si aparece; si no, puede ser el número de filas de trabajadores identificadas con claridad.
4) workers debe contener una fila por trabajador real. No metas filas de TOTAL EMPRESA ni TOTAL TRABAJADORES como trabajadores.
5) Conserva el código de trabajador si aparece y el nombre tal como figura, limpiando solo espacios duplicados.
6) cost_total de cada trabajador debe ser el importe de la columna final “COST TOTAL”. Es el dato prioritario. NO lo recalcules sumando bruto + RLC porque puede haber bonificaciones, regularizaciones o importes negativos.
7) net_total es el importe de “TOTAL NET”. gross_total es “TOTAL BRUT” o equivalente. rlc es la columna RLC. bonus_fc corresponde a BONIF.F.C. si existe.
8) ss_worker corresponde a SS TREB./Seguridad Social trabajador si aparece. irpf corresponde a IRPF si aparece.
9) Conserva los signos negativos exactamente cuando el documento los muestre en SS, IRPF, RLC, bonificaciones u otros importes.
10) En los totales generales usa los importes de la fila/resumen TOTAL EMPRESA cuando estén claramente impresos. cost_total general es el coste total de empresa del mes.
11) No inventes ni redistribuyas columnas si la lectura no es clara: usa null. Es preferible null a una cifra dudosa.
12) Usa punto decimal en los números y sin símbolos de euro ni separadores de miles.
13) Si una columna no puede asignarse con seguridad, deja null aunque haya otros números en la fila.`;

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
          messages:[{role:'user',content:[{type:'text',text:prompt},{type:'file',mediaType:'application/pdf',data:pdf,filename:name||'nominas.pdf'}]}],
          maxOutputTokens:5000
        });
        text=result.text||'';
      }catch(e){
        console.error('Payroll PDF AI error',e?.name||'unknown',e?.message||'unknown');
        return res.status(502).json({code:'AI_SERVICE_ERROR',error:'No se pudo leer el resumen de nóminas ahora mismo. Inténtalo de nuevo.'});
      }
    }else{
      const r=await fetch('https://ai-gateway.vercel.sh/v1/responses',{
        method:'POST',
        headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
        body:JSON.stringify({model:'alibaba/qwen3.5-flash',input:[{type:'message',role:'user',content:[{type:'input_text',text:prompt},{type:'input_image',image_url:dataUrl,detail:'high'}]}],max_output_tokens:5000})
      });
      const raw=await r.text();let data={};try{data=JSON.parse(raw)}catch{}
      if(!r.ok){console.error('Payroll AI Gateway error',r.status,data?.error?.type||'unknown');return res.status(502).json({code:'AI_SERVICE_ERROR',error:'No se pudo leer el resumen de nóminas ahora mismo. Inténtalo de nuevo.'})}
      if(typeof data.output_text==='string')text=data.output_text;
      if(!text&&Array.isArray(data.output))for(const item of data.output)if(item.type==='message'&&Array.isArray(item.content))for(const c of item.content)if(typeof c.text==='string')text+=c.text;
    }

    const match=text.match(/\{[\s\S]*\}/);
    if(!match) return res.status(502).json({error:'No se han podido identificar los datos del resumen de nóminas.'});

    let raw;try{raw=JSON.parse(match[0])}catch{return res.status(502).json({error:'No se han podido identificar los datos del resumen de nóminas.'})}

    const n=v=>{if(v===null||v===undefined||v==='')return null;let s=String(v).trim().replace(/\s/g,'');if(s.includes(',')&&s.includes('.'))s=s.replace(/\./g,'').replace(',','.');else if(s.includes(','))s=s.replace(',','.');const x=Number(s);return Number.isFinite(x)?x:null};
    const date=v=>{if(!v)return null;const s=String(v).trim();if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;const m=s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);return m?`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`:null};
    const workers=(Array.isArray(raw.workers)?raw.workers:[]).slice(0,200).map(w=>({
      code:w?.code?String(w.code).trim().slice(0,40):null,
      name:String(w?.name||'').replace(/\s+/g,' ').trim().slice(0,180),
      base_cc:n(w?.base_cc),
      base_irpf:n(w?.base_irpf),
      gross_total:n(w?.gross_total),
      ss_worker:n(w?.ss_worker),
      irpf:n(w?.irpf),
      net_total:n(w?.net_total),
      rlc:n(w?.rlc),
      bonus_fc:n(w?.bonus_fc),
      cost_total:n(w?.cost_total)
    })).filter(w=>w.name&&w.cost_total!==null);

    const clean={
      period_start:date(raw.period_start),
      period_end:date(raw.period_end),
      listed_at:date(raw.listed_at),
      worker_count:n(raw.worker_count),
      gross_total:n(raw.gross_total),
      net_total:n(raw.net_total),
      rlc_total:n(raw.rlc_total),
      cost_total:n(raw.cost_total),
      workers
    };

    if(clean.worker_count===null)clean.worker_count=workers.length;
    if(clean.cost_total===null&&workers.length)clean.cost_total=workers.reduce((a,w)=>a+(Number(w.cost_total)||0),0);
    return res.status(200).json({payroll:clean});
  }catch(e){
    console.error('Payroll AI internal error',e?.message||'unknown');
    return res.status(500).json({code:'AI_INTERNAL_ERROR',error:'No se pudo procesar el resumen de nóminas. Inténtalo de nuevo.'});
  }
};
