const U='https://joeanjzphpgowynmmbuv.supabase.co';
const K='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpvZWFuanpwaHBnb3d5bm1tYnV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5NDU3MzYsImV4cCI6MjEwNDUyMTczNn0.GrIjFTesp4H5x2svhSUQbpUXHgS2tcCGhOSvM8uidLw';
const db=supabase.createClient(U,K,{auth:{persistSession:false,autoRefreshToken:false}});
const $=id=>document.getElementById(id);
const money=new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'});
const PARTIES=[
  {id:'capicua',name:'Capicúa'},
  {id:'pizarrita',name:'La Pizarrita'},
  {id:'raco',name:'Racó de la Plaça'},
  {id:'calenric',name:'Calenric'},
  {id:'tempo_divino',name:'Tempo Divino'}
];
let token=localStorage.getItem('g5_v2_token')||'';
let me=null,rows=[],balances={};

const name=id=>PARTIES.find(x=>x.id===id)?.name||id||'';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function toast(msg){$('toast').textContent=msg;$('toast').classList.remove('hide');clearTimeout(toast.t);toast.t=setTimeout(()=>$('toast').classList.add('hide'),3500)}
function today(){const d=new Date();d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,10)}
function setBusy(v){document.body.classList.toggle('loading',!!v)}
function partyOptions(selected=''){return PARTIES.map(p=>`<option value="${p.id}" ${p.id===selected?'selected':''}>${p.name}</option>`).join('')}
function participantChecks(selected=PARTIES.map(p=>p.id)){return PARTIES.map(p=>`<label class="check"><input type="checkbox" value="${p.id}" ${selected.includes(p.id)?'checked':''}>${p.name}</label>`).join('')}
function checkedParticipants(){return [...$('participants').querySelectorAll('input:checked')].map(x=>x.value)}
function tabs(sign){$('tLogin').classList.toggle('on',!sign);$('tSign').classList.toggle('on',sign);$('fLogin').classList.toggle('hide',sign);$('fSign').classList.toggle('hide',!sign)}
function showOnly(which){$('auth').classList.toggle('hide',which!=='auth');$('app').classList.toggle('hide',which!=='app')}
function saveToken(t){token=t||'';if(token)localStorage.setItem('g5_v2_token',token);else localStorage.removeItem('g5_v2_token')}
async function call(fn,args){const{data,error}=await db.rpc(fn,args);if(error)throw error;return data}

$('lb').innerHTML=partyOptions('pizarrita');
$('sb').innerHTML=partyOptions('pizarrita');
$('tLogin').onclick=()=>tabs(false);
$('tSign').onclick=()=>tabs(true);

$('fLogin').onsubmit=async e=>{
  e.preventDefault();setBusy(true);
  try{
    const data=await call('g5_login_v2',{p_party:$('lb').value,p_password:$('lp').value});
    saveToken(data.token);me={party_id:data.party_id,display_name:data.display_name};
    await openApp();
  }catch(err){toast(err.message||'No se pudo entrar.')}
  finally{setBusy(false)}
};

$('fSign').onsubmit=async e=>{
  e.preventDefault();setBusy(true);
  try{
    const data=await call('g5_register_v2',{
      p_party:$('sb').value,
      p_code:$('sc').value.trim().toUpperCase(),
      p_display_name:$('sn').value.trim(),
      p_password:$('sp').value
    });
    saveToken(data.token);me={party_id:data.party_id,display_name:data.display_name};
    toast('Acceso creado.');
    await openApp();
  }catch(err){toast(err.message||'No se pudo crear el acceso.')}
  finally{setBusy(false)}
};

$('out').onclick=()=>{saveToken('');me=null;rows=[];location.reload()};

async function verifySession(){
  if(!token)return false;
  try{
    const data=await call('g5_me_v2',{p_token:token});
    me=data;
    return true;
  }catch{
    saveToken('');
    return false;
  }
}

async function load(){
  const data=await call('g5_entries_list_v2',{p_token:token});
  rows=Array.isArray(data)?data:[];
  calculate();
  renderBalances();
  render();
  renderSuggestions();
}

async function openApp(){
  if(!me&&!(await verifySession())){showOnly('auth');return}
  $('who').textContent=(me.display_name||'Usuario')+' · '+name(me.party_id);
  showOnly('app');
  await load();
}

async function boot(){
  if(await verifySession())await openApp();
  else showOnly('auth');
}
boot();