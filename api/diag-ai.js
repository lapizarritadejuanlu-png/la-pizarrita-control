module.exports = async function handler(req,res){
  const key=process.env.AI_GATEWAY_API_KEY||process.env.VERCEL_OIDC_TOKEN;
  if(!key)return res.status(500).json({ok:false,error:'missing_key'});
  const models=['alibaba/qwen3.5-flash','alibaba/qwen3-vl-thinking','google/gemini-2.5-flash','interfaze/interfaze-beta'];
  const results=[];
  for(const model of models){
    try{
      const r=await fetch('https://ai-gateway.vercel.sh/v1/responses',{
        method:'POST',
        headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
        body:JSON.stringify({model,input:'Responde exactamente OK',max_output_tokens:20})
      });
      const raw=await r.text();
      let data={};try{data=JSON.parse(raw)}catch{}
      let text='';
      if(typeof data.output_text==='string')text=data.output_text;
      if(!text&&Array.isArray(data.output))for(const item of data.output||[])if(item.type==='message')for(const c of item.content||[])if(typeof c.text==='string')text+=c.text;
      results.push({model,ok:r.ok,status:r.status,text,error:data?.error?.message||data?.message||null});
      if(r.ok)return res.status(200).json({ok:true,selected:model,results});
    }catch(e){results.push({model,ok:false,status:0,error:e.message});}
  }
  return res.status(200).json({ok:false,results});
}
