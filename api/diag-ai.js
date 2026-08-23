module.exports = async function handler(req,res){
  const key=process.env.AI_GATEWAY_API_KEY||process.env.VERCEL_OIDC_TOKEN;
  if(!key)return res.status(500).json({ok:false,error:'missing_key'});
  const image='data:image/png;base64,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';
  try{
    const r=await fetch('https://ai-gateway.vercel.sh/v1/responses',{
      method:'POST',
      headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
      body:JSON.stringify({
        model:'alibaba/qwen3.5-flash',
        input:[{type:'message',role:'user',content:[
          {type:'input_text',text:'Lee la imagen y responde SOLO JSON valido: {"supplier":texto,"date":texto,"base":numero,"vat":numero,"total":numero}'},
          {type:'input_image',image_url:image,detail:'high'}
        ]}],
        max_output_tokens:300
      })
    });
    const raw=await r.text();let data={};try{data=JSON.parse(raw)}catch{}
    let text=typeof data.output_text==='string'?data.output_text:'';
    if(!text&&Array.isArray(data.output))for(const item of data.output||[])if(item.type==='message')for(const c of item.content||[])if(typeof c.text==='string')text+=c.text;
    return res.status(200).json({ok:r.ok,status:r.status,text,error:data?.error?.message||data?.message||null});
  }catch(e){return res.status(500).json({ok:false,error:e.message});}
}
