(()=>{
let sessionRefreshFlight=null;

async function stableRefreshSession(){
  if(sessionRefreshFlight)return sessionRefreshFlight;
  sessionRefreshFlight=(async()=>{
    const refreshToken=session?.refresh_token;
    if(!refreshToken)return false;
    try{
      const res=await fetch(`${SB_URL}/auth/v1/token?grant_type=refresh_token`,{
        method:'POST',
        headers:{apikey:SB_KEY,'Content-Type':'application/json'},
        body:JSON.stringify({refresh_token:refreshToken})
      });
      if(!res.ok)return false;
      const next=await res.json();
      if(!next?.access_token||!next?.refresh_token)return false;
      if(!next.user&&session?.user)next.user=session.user;
      saveSession(next);
      return true;
    }catch{return false}
  })();
  try{return await sessionRefreshFlight}finally{sessionRefreshFlight=null}
}

refreshSession=stableRefreshSession;

api=async function(path,{method='GET',body,headers={}}={}){
  let authRetry=false;
  for(;;){
    const tokenUsed=session?.access_token||null;
    const h={apikey:SB_KEY,...headers};
    if(tokenUsed)h.Authorization=`Bearer ${tokenUsed}`;
    if(body!==undefined&&!(body instanceof Blob)&&!(body instanceof File)&&!h['Content-Type'])h['Content-Type']='application/json';
    const payload=body===undefined?undefined:(h['Content-Type']==='application/json'?JSON.stringify(body):body);
    const res=await fetch(SB_URL+path,{method,headers:h,body:payload});
    const authFailure=res.status===401||(res.status===403&&path.startsWith('/auth/v1/user'));
    if(authFailure&&!authRetry&&session?.refresh_token&&!path.startsWith('/auth/v1/token')){
      authRetry=true;
      if(session?.access_token&&session.access_token!==tokenUsed)continue;
      if(await stableRefreshSession())continue;
    }
    const text=await res.text();let data=null;try{data=text?JSON.parse(text):null}catch{data=text}
    if(!res.ok){const msg=data?.msg||data?.message||data?.error_description||data?.error||`Error ${res.status}`;throw new Error(msg)}
    return data;
  }
};
})();
