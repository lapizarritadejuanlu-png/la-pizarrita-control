(()=>{
const SB_URL='https://mpzemodwiuxqemvfaqvs.supabase.co';
const SB_KEY='sb_publishable_5b0LE9t_UFaHQwsYZ7BvKQ_k_tAmbVc';
const LIVE_KEY='casa-familia-session-live';
const KEYS=['casa-familia-session-v2','casa-familia-session-v1','pizarrita-cloud-session-v3',`sb-mpzemodwiuxqemvfaqvs-auth-token`];
const nativeFetch=window.fetch.bind(window);
let live=readLive();
let refreshing=null;
function parse(v){try{return JSON.parse(v||'null')}catch{return null}}
function asSession(v){for(const x of [v,v?.session,v?.currentSession,v?.data?.session,v?.data])if(x?.access_token&&x?.refresh_token)return x;return null}
function readLive(){const direct=asSession(parse(localStorage.getItem(LIVE_KEY)));if(direct)return direct;for(const k of KEYS){const s=asSession(parse(localStorage.getItem(k)));if(s)return s}return null}
function expMs(token){try{const p=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));return Number(p.exp||0)*1000}catch{return 0}}
function persist(s){if(!s?.access_token)return;live=s;localStorage.setItem(LIVE_KEY,JSON.stringify(s));localStorage.setItem('casa-familia-session-v2',JSON.stringify(s))}
async function refreshSession(){if(refreshing)return refreshing;const s=live||readLive();if(!s?.refresh_token)return false;refreshing=(async()=>{try{const r=await nativeFetch(`${SB_URL}/auth/v1/token?grant_type=refresh_token`,{method:'POST',headers:{apikey:SB_KEY,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:s.refresh_token})});if(!r.ok)return false;const d=await r.json();persist(d);return true}catch{return false}finally{refreshing=null}})();return refreshing}
async function ensureFresh(){live=live||readLive();if(!live?.access_token)return false;if(expMs(live.access_token)-Date.now()<120000)return await refreshSession();return true}
window.fetch=async function(input,init={}){
  const url=typeof input==='string'?input:input?.url||'';
  const isToken=url.includes('/auth/v1/token');
  const isLogout=url.includes('/auth/v1/logout');
  const needsAuth=url.includes('/api/home-expense-ai')||url.startsWith(SB_URL+'/rest/v1/')||url.startsWith(SB_URL+'/storage/v1/')||url.startsWith(SB_URL+'/auth/v1/user')||isLogout;
  if(needsAuth&&!isToken){await ensureFresh();if(live?.access_token){const h=new Headers(init.headers||(input instanceof Request?input.headers:undefined));h.set('Authorization',`Bearer ${live.access_token}`);init={...init,headers:h}}}
  let r=await nativeFetch(input,init);
  if(needsAuth&&r.status===401&&!isToken&&await refreshSession()){const h=new Headers(init.headers||(input instanceof Request?input.headers:undefined));h.set('Authorization',`Bearer ${live.access_token}`);r=await nativeFetch(input,{...init,headers:h})}
  if(isToken&&r.ok){try{const d=await r.clone().json();if(d?.access_token&&d?.refresh_token)persist(d)}catch{}}
  if(isLogout&&r.ok){live=null;localStorage.removeItem(LIVE_KEY)}
  return r;
};
})();