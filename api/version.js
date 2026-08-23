export default function handler(req,res){
  res.setHeader('Cache-Control','no-store, max-age=0');
  res.status(200).json({
    app:'La Pizarrita Control',
    commit:process.env.VERCEL_GIT_COMMIT_SHA||null,
    branch:process.env.VERCEL_GIT_COMMIT_REF||null,
    environment:process.env.VERCEL_ENV||null,
    deployment:process.env.VERCEL_URL||null
  });
}
