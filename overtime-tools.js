(()=>{
let overtimeWorkers=[],overtimeRows=[];

function addOvertimeStyles(){
  if(document.getElementById('overtimeToolsStyle'))return;
  const s=document.createElement('style');s.id='overtimeToolsStyle';s.textContent=`
  .ot-note{color:var(--muted);font-size:.82rem;line-height:1.45;margin:0 0 12px}.ot-legal{margin-top:10px;padding:10px 12px;border:1px solid #5a4d2f;border-radius:12px;background:#1d190f;color:#dbc887;font-size:.75rem;line-height:1.4}
  .ot-quick{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 18px}.ot-quick-copy{min-width:0}.ot-quick-title{font-weight:900}.ot-quick-meta{color:var(--muted);font-size:.76rem;margin-top:3px}.ot-quick button{padding:10px 12px;font-size:.8rem;white-space:nowrap}
  .ot-form{display:grid;grid-template-columns:1fr 1fr;gap:12px 16px}.ot-form .full{grid-column:1/-1}.ot-total{border:1px solid #3c4438;border-radius:14px;background:#10140f;padding:12px 14px}.ot-total span{display:block;color:var(--muted);font-size:.72rem}.ot-total strong{display:block;font-size:1.25rem;margin-top:2px;color:var(--mint)}
  .ot-summary-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-bottom:12px}.ot-summary{border:1px solid #30332d;border-radius:13px;background:#121310;padding:11px}.ot-summary span{display:block;color:var(--muted);font-size:.7rem}.ot-summary strong{font-size:1rem}
  .ot-worker-row,.ot-entry{border:1px solid var(--line);border-radius:14px;background:#151613;padding:12px 13px;margin-top:9px}.ot-worker-top,.ot-entry-top{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.ot-name{font-weight:900}.ot-meta{font-size:.74rem;color:var(--muted);margin-top:4px;line-height:1.4}.ot-value{font-weight:950;white-space:nowrap}.ot-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:9px}.ot-actions button{padding:7px 9px;font-size:.72rem}.ot-worker-rate{display:flex;gap:8px;align-items:center;margin-top:8px}.ot-worker-rate input{min-height:42px;padding:8px 10px}.ot-worker-rate button{padding:8px 10px;font-size:.72rem;white-space:nowrap}.ot-off{opacity:.55}.ot-person-row{display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-top:1px solid #2d2f2a}.ot-person-row:first-child{border-top:0}.ot-person-name{font-weight:850}.ot-person-meta{font-size:.72rem;color:var(--muted);margin-top:2px}
  .ot-month{margin-bottom:12px}.ot-empty{color:var(--muted);font-size:.82rem;line-height:1.4}
  @media(max-width:390px){.ot-form{grid-template-columns:1fr}.ot-form .full{grid-column:auto}.ot-quick{align-items:stretch;flex-direction:column}.ot-quick button{width:100%}}
  `;document.head.appendChild(s);
}
function otNum(v){const n=Number(String(v??'').trim().replace(',','.'));return Number.isFinite(n)?n:null}
function otWorker(id){return overtimeWorkers.find(x=>x.id===id)||null}
function otMonthRows(month=selectedMonth){return overtimeRows.filter(x=>String(x.work_date||'').slice(0,7)===month)}
function otMonthTotals(month=selectedMonth){const rows=otMonthRows(month);return{hours:rows.reduce((a,x)=>a+(Number(x.hours)||0),0),amount:rows.reduce((a,x)=>a+(Number(x.amount)||0),0),count:rows.length}}
function otMoney(n){return euro(Number(n)||0)}
function otHours(n){const x=Number(n)||0;return `${new Intl.NumberFormat('es-ES',{maximumFractionDigits:2}).format(x)} h`}
function activeWorkerOptions(){const active=overtimeWorkers.filter(x=>x.active);return active.map(w=>`<option value="${esc(w.id)}">${esc(w.name)}${w.default_hourly_rate!==null&&w.default_hourly_rate!==undefined?` · ${otMoney(w.default_hourly_rate)}/h`:''}</option>`).join('')}
function overtimeQuickCard(){const t=otMonthTotals(selectedMonth);return `<div class="card ot-quick"><div class="ot-quick-copy"><div class="ot-quick-title">⏱ Horas extra</div><div class="ot-quick-meta">${esc(monthLabel(selectedMonth))}: ${otHours(t.hours)} · ${otMoney(t.amount)} pagados</div></div><button type="button" id="overtimeQuick" class="secondary">Registrar ahora</button></div>`}
function workerManagerHtml(){
  const rows=overtimeWorkers.length?overtimeWorkers.map(w=>`<div class="ot-worker-row ${w.active?'':'ot-off'}"><div class="ot-worker-top"><div><div class="ot-name">${esc(w.name)}</div><div class="ot-meta">${w.active?'Activo':'Inactivo'}${w.default_hourly_rate!==null&&w.default_hourly_rate!==undefined?` · tarifa habitual ${otMoney(w.default_hourly_rate)}/h`:' · sin tarifa habitual'}</div></div><button type="button" class="secondary" data-ot-toggle-worker="${esc(w.id)}" data-ot-active="${w.active?'1':'0'}">${w.active?'Pausar':'Reactivar'}</button></div><div class="ot-worker-rate"><input type="number" inputmode="decimal" step="0.01" min="0" data-ot-rate="${esc(w.id)}" value="${w.default_hourly_rate??''}" placeholder="€/hora habitual"><button type="button" class="secondary" data-ot-save-rate="${esc(w.id)}">Guardar tarifa</button></div></div>`).join(''):'<div class="ot-empty">Todavía no hay trabajadores. Añade los nombres una sola vez y luego solo tendrás que elegirlos cada noche.</div>';
  return `<div class="card"><h3 class="account-title">👥 Trabajadores</h3><p class="ot-note">Guarda aquí el nombre y, si quieres, la tarifa habitual de las horas extra. La tarifa se puede cambiar cualquier día sin alterar el histórico.</p><div class="ot-form"><div class="field"><label>Nombre</label><input id="otNewWorkerName" autocomplete="off" placeholder="Ej. trabajador"></div><div class="field"><label>€/hora habitual (opcional)</label><input id="otNewWorkerRate" type="number" inputmode="decimal" step="0.01" min="0" placeholder="Ej. 10"></div></div><button type="button" id="otAddWorker" class="secondary wide">＋ Añadir trabajador</button>${rows}</div>`
}
function overtimeEntryFormHtml(){
  const active=overtimeWorkers.filter(x=>x.active),disabled=!active.length?'disabled':'';
  return `<div class="card"><h3 class="account-title">💶 Registrar horas extra pagadas</h3><p class="ot-note">Cada registro queda asociado al trabajador y al día. Se suma automáticamente a <strong>Personal</strong> y al total mensual de ese trabajador.</p><div class="ot-form"><div class="field"><label>Trabajador</label><select id="otWorker" ${disabled}><option value="">${active.length?'Selecciona…':'Añade primero un trabajador'}</option>${activeWorkerOptions()}</select></div><div class="field"><label>Fecha</label><input id="otDate" type="date" value="${localDate()}" ${disabled}></div><div class="field"><label>Horas extra</label><input id="otHours" type="number" inputmode="decimal" step="0.25" min="0.25" max="24" placeholder="Ej. 1,5" ${disabled}></div><div class="field"><label>€/hora</label><input id="otRate" type="number" inputmode="decimal" step="0.01" min="0" placeholder="Ej. 10" ${disabled}></div><div class="field full"><label>Nota (opcional)</label><input id="otNote" autocomplete="off" placeholder="Ej. cierre, evento, sustitución…" ${disabled}></div><div class="full ot-total"><span>Importe a pagar en efectivo</span><strong id="otCalculatedTotal">0,00 €</strong></div></div><button type="button" id="otSave" class="primary wide" ${disabled}>Guardar pago de horas extra</button><div class="ot-legal">Control interno: pagar en efectivo no elimina las obligaciones laborales o de cotización. Conviene trasladar estos datos a la gestoría para que las horas y pagos se regularicen correctamente.</div></div>`
}
function overtimeSummaryHtml(){
  const rows=otMonthRows(selectedMonth),tot=otMonthTotals(selectedMonth),by=new Map();
  for(const x of rows){const w=otWorker(x.worker_id),name=w?.name||'Trabajador';if(!by.has(x.worker_id))by.set(x.worker_id,{name,hours:0,amount:0,count:0});const a=by.get(x.worker_id);a.hours+=Number(x.hours)||0;a.amount+=Number(x.amount)||0;a.count++}
  const people=[...by.values()].sort((a,b)=>b.amount-a.amount);
  const peopleHtml=people.length?people.map(p=>`<div class="ot-person-row"><div><div class="ot-person-name">${esc(p.name)}</div><div class="ot-person-meta">${otHours(p.hours)} · ${p.count} día${p.count===1?'':'s'}</div></div><strong>${otMoney(p.amount)}</strong></div>`).join(''):'<div class="ot-empty">No hay horas extra registradas en este mes.</div>';
  const entries=rows.length?rows.map(x=>{const w=otWorker(x.worker_id);return `<div class="ot-entry"><div class="ot-entry-top"><div><div class="ot-name">${esc(w?.name||'Trabajador')}</div><div class="ot-meta">${fmtDate(x.work_date)} · ${otHours(x.hours)} × ${otMoney(x.hourly_rate)}/h · efectivo${x.note?` · ${esc(x.note)}`:''}</div></div><div class="ot-value">${otMoney(x.amount)}</div></div><div class="ot-actions"><button type="button" class="secondary danger" data-ot-delete="${esc(x.id)}" data-ot-move="${esc(x.move_id)}">🗑 Borrar</button></div></div>`}).join(''):'';
  return `<div class="card"><div class="field ot-month"><label>Mes a consultar</label><input id="otMonth" type="month" value="${esc(selectedMonth)}"></div><div class="ot-summary-grid"><div class="ot-summary"><span>Horas extra</span><strong>${otHours(tot.hours)}</strong></div><div class="ot-summary"><span>Pagado en efectivo</span><strong>${otMoney(tot.amount)}</strong></div></div><h3 class="account-title">Resumen por trabajador</h3>${peopleHtml}</div>${entries?`<div class="section-title">Detalle de horas extra</div>${entries}`:''}`
}
function overtimeSection(){return `<div id="overtimeSection" class="section-title">Horas extra</div>${overtimeEntryFormHtml()}${overtimeSummaryHtml()}<div class="section-title">Configurar trabajadores</div>${workerManagerHtml()}`}

async function loadOvertimeData(){
  if(!session){overtimeWorkers=[];overtimeRows=[];return}
  try{
    const [w,r]=await Promise.all([
      api('/rest/v1/staff_workers?select=*&order=active.desc,name.asc'),
      api('/rest/v1/staff_overtime?select=*&order=work_date.desc,created_at.desc&limit=1500')
    ]);
    overtimeWorkers=Array.isArray(w)?w:[];overtimeRows=Array.isArray(r)?r:[];
  }catch(e){console.error('Overtime data',e?.message||'unknown');overtimeWorkers=[];overtimeRows=[]}
}
async function addOvertimeWorker(){
  const name=String(document.getElementById('otNewWorkerName')?.value||'').trim(),rate=otNum(document.getElementById('otNewWorkerRate')?.value);
  if(!name){toast('Escribe el nombre del trabajador.');return}
  if(rate!==null&&rate<0){toast('La tarifa no puede ser negativa.');return}
  try{setBusy(true);await api('/rest/v1/staff_workers',{method:'POST',headers:{Prefer:'return=minimal'},body:{user_id:session.user.id,name,default_hourly_rate:rate,active:true}});toast(`${name} añadido`);await loadOvertimeData();renderApp();setTimeout(()=>document.getElementById('overtimeSection')?.scrollIntoView({behavior:'smooth',block:'start'}),50)}catch(e){toast(/duplicate|unique/i.test(String(e.message||''))?'Ese trabajador ya existe.':'No se pudo añadir: '+(e.message||'error'))}finally{setBusy(false)}
}
async function saveWorkerRate(id){
  const input=document.querySelector(`[data-ot-rate="${CSS.escape(id)}"]`),rate=otNum(input?.value);
  if(rate===null||rate<0){toast('Introduce una tarifa válida.');return}
  try{setBusy(true);await api(`/rest/v1/staff_workers?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:{default_hourly_rate:rate,updated_at:new Date().toISOString()}});toast('Tarifa actualizada');await loadOvertimeData();renderApp()}catch(e){toast('No se pudo guardar la tarifa: '+(e.message||'error'))}finally{setBusy(false)}
}
async function toggleWorker(id,active){
  try{setBusy(true);await api(`/rest/v1/staff_workers?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:{active:!active,updated_at:new Date().toISOString()}});toast(active?'Trabajador pausado':'Trabajador reactivado');await loadOvertimeData();renderApp()}catch(e){toast('No se pudo cambiar: '+(e.message||'error'))}finally{setBusy(false)}
}
function fillWorkerRate(){const w=otWorker(document.getElementById('otWorker')?.value),rate=document.getElementById('otRate');if(rate&&w?.default_hourly_rate!==null&&w?.default_hourly_rate!==undefined)rate.value=Number(w.default_hourly_rate);recalcOvertimeTotal()}
function recalcOvertimeTotal(){const h=otNum(document.getElementById('otHours')?.value),r=otNum(document.getElementById('otRate')?.value),el=document.getElementById('otCalculatedTotal');if(el)el.textContent=otMoney((h&&r!==null)?h*r:0)}
async function saveOvertime(){
  const workerId=document.getElementById('otWorker')?.value,date=document.getElementById('otDate')?.value,hours=otNum(document.getElementById('otHours')?.value),rate=otNum(document.getElementById('otRate')?.value),note=String(document.getElementById('otNote')?.value||'').trim()||null,w=otWorker(workerId);
  if(!w||!w.active){toast('Selecciona un trabajador activo.');return}
  if(!date){toast('Selecciona la fecha.');return}
  if(typeof window.isAccountingMonthLocked==='function'&&window.isAccountingMonthLocked(String(date).slice(0,7))){toast(`🔒 ${monthLabel(String(date).slice(0,7))} está cerrado. Reábrelo antes de guardar.`);return}
  if(hours===null||hours<=0||hours>24){toast('Introduce las horas extra.');return}
  if(rate===null||rate<0){toast('Introduce el precio por hora.');return}
  const amount=Math.round(hours*rate*100)/100;if(amount<=0){toast('El importe debe ser mayor que cero.');return}
  let moveId=null;
  try{
    setBusy(true);
    const move=await api('/rest/v1/moves',{method:'POST',headers:{Prefer:'return=representation'},body:{user_id:session.user.id,move_type:'personal',move_date:date,concept:`Horas extra · ${w.name}`,amount,notes:`${hours} h × ${rate.toFixed(2)} €/h · pagado en efectivo${note?` · ${note}`:''}`,category:'horas_extra',owner_label:w.name}});moveId=Array.isArray(move)?move[0]?.id:move?.id;if(!moveId)throw new Error('No se pudo confirmar el pago');
    await api('/rest/v1/staff_overtime',{method:'POST',headers:{Prefer:'return=minimal'},body:{user_id:session.user.id,worker_id:w.id,move_id:moveId,work_date:date,hours,hourly_rate:rate,amount,payment_method:'cash',paid:true,note}});
    if(w.default_hourly_rate===null||w.default_hourly_rate===undefined)await api(`/rest/v1/staff_workers?id=eq.${encodeURIComponent(w.id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:{default_hourly_rate:rate,updated_at:new Date().toISOString()}}).catch(()=>{});
    selectedMonth=String(date).slice(0,7);toast(`${w.name}: ${otHours(hours)} · ${otMoney(amount)} pagados`);await loadData();route='more';renderApp();setTimeout(()=>document.getElementById('overtimeSection')?.scrollIntoView({behavior:'smooth',block:'start'}),50)
  }catch(e){if(moveId)await api(`/rest/v1/moves?id=eq.${encodeURIComponent(moveId)}`,{method:'DELETE'}).catch(()=>{});toast('No se pudo guardar: '+(e.message||'error'))}finally{setBusy(false)}
}
async function deleteOvertime(id,moveId){
  const x=overtimeRows.find(r=>r.id===id),w=x?otWorker(x.worker_id):null;if(!x)return;
  const m=String(x.work_date||'').slice(0,7);if(typeof window.isAccountingMonthLocked==='function'&&window.isAccountingMonthLocked(m)){toast(`🔒 ${monthLabel(m)} está cerrado. Reábrelo antes de borrar.`);return}
  if(!confirm(`¿Borrar ${otHours(x.hours)} de ${w?.name||'este trabajador'} por ${otMoney(x.amount)}?`))return;
  try{setBusy(true);await api(`/rest/v1/moves?id=eq.${encodeURIComponent(moveId||x.move_id)}`,{method:'DELETE'});toast('Horas extra borradas');await loadData();route='more';renderApp()}catch(e){toast('No se pudo borrar: '+(e.message||'error'))}finally{setBusy(false)}
}

const previousMoreOvertime=moreView;
moreView=function(){return previousMoreOvertime()+overtimeSection()};
const previousDashboardOvertime=dashboard;
dashboard=function(){return previousDashboardOvertime()+overtimeQuickCard()};
const previousLoadDataOvertime=loadData;
loadData=async function(){const r=await previousLoadDataOvertime.apply(this,arguments);await loadOvertimeData();if(session)renderApp();return r};
const previousBindOvertime=bind;
bind=function(){
  previousBindOvertime();addOvertimeStyles();
  document.getElementById('overtimeQuick')?.addEventListener('click',()=>{route='more';renderApp();setTimeout(()=>document.getElementById('overtimeSection')?.scrollIntoView({behavior:'smooth',block:'start'}),40)});
  document.getElementById('otAddWorker')?.addEventListener('click',addOvertimeWorker);
  document.querySelectorAll('[data-ot-save-rate]').forEach(b=>b.addEventListener('click',()=>saveWorkerRate(b.dataset.otSaveRate)));
  document.querySelectorAll('[data-ot-toggle-worker]').forEach(b=>b.addEventListener('click',()=>toggleWorker(b.dataset.otToggleWorker,b.dataset.otActive==='1')));
  document.getElementById('otWorker')?.addEventListener('change',fillWorkerRate);
  document.getElementById('otHours')?.addEventListener('input',recalcOvertimeTotal);
  document.getElementById('otRate')?.addEventListener('input',recalcOvertimeTotal);
  document.getElementById('otSave')?.addEventListener('click',saveOvertime);
  document.getElementById('otMonth')?.addEventListener('change',e=>{if(e.target.value){selectedMonth=e.target.value;renderApp();setTimeout(()=>document.getElementById('overtimeSection')?.scrollIntoView({behavior:'smooth',block:'start'}),30)}});
  document.querySelectorAll('[data-ot-delete]').forEach(b=>b.addEventListener('click',()=>deleteOvertime(b.dataset.otDelete,b.dataset.otMove)));
};

addOvertimeStyles();
loadOvertimeData().then(()=>{if(session)renderApp()});
})();
