module.exports = async function handler(req,res){
  const key=process.env.AI_GATEWAY_API_KEY||process.env.VERCEL_OIDC_TOKEN;
  if(!key) return res.status(200).json({key:false});
  try{
    const r=await fetch('https://ai-gateway.vercel.sh/v1/responses',{
      method:'POST',
      headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
      body:JSON.stringify({model:'openai/gpt-5.6-sol',input:'Responde solo OK',max_output_tokens:20})
    });
    const raw=await r.text();
    let data={}; try{data=JSON.parse(raw)}catch{}
    return res.status(200).json({key:true,gateway_status:r.status,gateway_ok:r.ok,error:data?.error?.message||data?.message||null});
  }catch(e){
    return res.status(200).json({key:true,gateway_ok:false,error:e.message||'network error'});
  }
}
