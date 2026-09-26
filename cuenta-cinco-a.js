const U='https://joeanjzphpgowynmmbuv.supabase.co';
const K='sb_publishable_J4iTnkr2F_CDpMhVpJv_8A_FWauGZ3P';
const db=supabase.createClient(U,K,{auth:{persistSession:true,autoRefreshToken:true}});
const $=x=>document.getElementById(x);
const money=new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'});
const PARTIES=[
  {id:'capicua',name:'Capicúa'},
  {id:'pizarrita',name:'La Pizarrita'},
  {id:'raco',name:'Racó de la Plaça'},
  {id:'calenric',name:'Calenric'},
  {id:'tempo_divino',name:'Tempo Divino'}
];
let user=null,me=null,rows=[],balances={};
const name=id=>PARTIES.find(x=>x.id===id)?.name||id||'';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function toast(s){$('toast').textContent=s;$('toast').classList.remove('hide');clearTimeout(toast.t);toast.t=setTimeout(()=>$('toast').classList.add('hide'),3500)}
function today(){let d=new Date();d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,10)}
function tabs(sign){$('tLogin').classList.toggle('on',!sign);$('tSign').classList.toggle('on',sign);$('fLogin').classList.toggle('hide',sign);$('fSign').classList.toggle('hide',!sign)}
$('tLogin').onclick=()=>tabs(false);$('tSign').onclick=()=>tabs(true);
function showOnly(which){$('auth').classList.toggle('hide',which!=='auth');$('recovery').classList.toggle('hide',which!=='recovery');$('claim').classList.toggle('hide',which!=='claim');$('app').classList.toggle('hide',which!=='app')}
function partyOptions(selected=''){return PARTIES.map(p=>`<option value="${p.id}" ${p.id===selected?'selected':''}>${p.name}</option>`).join('')}
function participantChecks(selected=PARTIES.map(p=>p.id)){return PARTIES.map(p=>`<label class="check"><input type="checkbox" value="${p.id}" ${selected.includes(p.id)?'checked':''}>${p.name}</label>`).join('')}
function checkedParticipants(){return [...$('participants').querySelectorAll('input:checked')].map(x=>x.value)}
function setBusy(v){document.body.classList.toggle('loading',v)}

$('fLogin').onsubmit=async e=>{e.preventDefault();setBusy(true);try{let{error}=await db.auth.signInWithPassword({email:$('le').value.trim(),password:$('lp').value});if(error)throw error;await boot()}catch(err){toast('No se pudo entrar. Si ya usabas Pizarrita ↔ Tempo, usa aquella contraseña o pulsa “He olvidado mi contraseña”.')}finally{setBusy(false)}};
$('forgot').onclick=async()=>{const email=$('le').value.trim();if(!email){toast('Escribe primero tu email.');return}setBusy(true);try{const{error}=await db.auth.resetPasswordForEmail(email,{redirectTo:location.origin+'/cuenta-cinco/'});if(error)throw error;toast('Te he enviado un correo para cambiar la contraseña. Revisa también Spam.')}catch(err){toast('No se pudo enviar el correo: '+(err.message||'error'))}finally{setBusy(false)}};
$('fRecovery').onsubmit=async e=>{e.preventDefault();const a=$('rp').value,b=$('rp2').value;if(a!==b){toast('Las dos contraseñas no coinciden.');return}setBusy(true);try{const{error}=await db.auth.updateUser({password:a});if(error)throw error;toast('Contraseña cambiada.');await boot()}catch(err){toast('No se pudo cambiar la contraseña: '+(err.message||'error'))}finally{setBusy(false)}};
$('fSign').onsubmit=async e=>{e.preventDefault();setBusy(true);try{
  const display=$('sn').value.trim(),code=$('sc').value.trim().toUpperCase(),email=$('se').value.trim();
  localStorage.setItem('g5_pending_name',display);localStorage.setItem('g5_pending_code',code);
  let{data,error}=await db.auth.signUp({email,password:$('sp').value,options:{data:{display_name:display,group5_invite_code:code}}});
  if(error)throw error;
  if(!data.session){toast('Acceso creado. Confirma el email y después entra.');tabs(false);$('le').value=email}else await boot();
}catch(err){toast('No se pudo crear el acceso: '+(err.message||'revisa los datos y el código.'))}finally{setBusy(false)}};
$('fClaim').onsubmit=async e=>{e.preventDefault();await claimMembership($('cc').value,$('cn').value)};
$('claimOut').onclick=$('out').onclick=async()=>{await db.auth.signOut();localStorage.removeItem('g5_pending_code');localStorage.removeItem('g5_pending_name');location.reload()};

db.auth.onAuthStateChange((event,session)=>{if(event==='PASSWORD_RECOVERY'){user=session?.user||null;showOnly('recovery')}});
async function claimMembership(code,display){setBusy(true);try{const{data,error}=await db.rpc('g5_claim_membership',{p_code:String(code||'').trim().toUpperCase(),p_display_name:String(display||'').trim()});if(error)throw error;localStorage.removeItem('g5_pending_code');localStorage.removeItem('g5_pending_name');toast('Acceso vinculado.');await boot()}catch(err){toast('No se pudo vincular: '+(err.message||'código no válido.'))}finally{setBusy(false)}}
async function member(){let{data,error}=await db.from('g5_members').select('user_id,party_id,display_name').eq('user_id',user.id).maybeSingle();if(error)throw error;if(!data)return null;me=data;$('who').textContent=(me.display_name||'Usuario')+' · '+name(me.party_id);return me}
async function load(){let{data,error}=await db.from('g5_entries').select('*').order('occurred_on',{ascending:false}).order('created_at',{ascending:false}).limit(1000);if(error)throw error;rows=data||[];calculate();renderBalances();render();renderSuggestions()}
function calculate(){balances=Object.fromEntries(PARTIES.map(p=>[p.id,0]));for(const x of rows){if(x.status!=='active')continue;const a=Number(x.amount||0);if(x.entry_type==='expense'){balances[x.payer_party]+=a;const ps=Array.isArray(x.participants)&&x.participants.length?x.participants:[];if(ps.length){const share=a/ps.length;for(const p of ps)if(p in balances)balances[p]-=share}}else if(x.entry_type==='settlement'){balances[x.payer_party]+=a;if(x.receiver_party in balances)balances[x.receiver_party]-=a}}
  for(const k in balances)if(Math.abs(balances[k])<.005)balances[k]=0;
}
