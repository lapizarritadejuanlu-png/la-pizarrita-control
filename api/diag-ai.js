module.exports = async function handler(req,res){
  return res.status(200).json({
    has_ai_gateway_key: !!process.env.AI_GATEWAY_API_KEY,
    has_vercel_oidc_token: !!process.env.VERCEL_OIDC_TOKEN,
    vercel_env: process.env.VERCEL_ENV || null,
    node_env: process.env.NODE_ENV || null
  });
}
