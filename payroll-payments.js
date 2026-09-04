(()=>{
let payments=[],runs=[],ready=false,paymentBusy=false;
const monthOf=date=>String(date||'').slice(0,7);
function isPayrollCost(x){return !!x.payroll_run_id||/payroll_run:/.test(x.notes||'')||/^Nóminas gestor \d{4}-\d{2}$/.test(x.concept||'')}
window.personnelCashForMonth=function(month){
  if(!ready)return null;
  const other=(Array.isArray(moves)?moves:[]).filter(x=>x.move_type==='personal'&&monthOf(x.move_date)===month&&!isPayrollCost(x)).reduce((sum,x)=>sum+(Number(x.amount)||0),0);
  return other+payments.filter(x=>monthOf(x.paid_on)===month).reduce((sum,x)=>sum+(Number(x.amount)||0),0);
};
async function loadPayments(){
  ready=false;
  try{const [p,r]=await Promise.all([api('/rest/v1/payroll_payments?select=*&order=paid_on.desc'),api('/rest/v1/payroll_runs?select=id,period_start,period_end,net_total,cost_total&order=period_start.desc')]);payments=p||[];runs=r||[];ready=true}
  catch(e){payments=[];runs=[];console.warn('No se pudieron cargar los pagos de nóminas');}
}
function paymentForm(){
  if(!ready)return '<div class="card"><p>No se pudieron cargar los pagos de nóminas. Actualiza la página para reintentar.</p></div>';
  return `<div class="section-title">Pagos de nóminas</div><div class="card"><p class="personnel-note">El coste corresponde al mes trabajado. Aquí anotas el neto realmente pagado a los trabajadores y el día que salió el dinero. Seguridad Social e IRPF se registran por separado.</p>${runs.length?`<div class="form-grid"><div class="field"><label>Mes de la nómina</label><select id="payRun">${runs.map(r=>`<option value="${esc(r.id)}">${esc(monthLabel(monthOf(r.period_start)))}</option>`).join('')}</select></div><div class="field"><label>Fecha del pago</label><input id="payDate" type="date" value="${localDate()}"></div><div class="field"><label>Neto pagado (€)</label><input id="payAmount" type="number" step="0.01" min="0.01" inputmode="decimal"></div></div><p id="paySuggestion" class="personnel-note"></p><button id="savePayrollPayment" type="button" class="primary wide">Guardar pago de nóminas</button>`:'<p>Sube primero el resumen de nóminas del gestor.</p>'}<div id="payHistory">${payments.length?payments.map(p=>{const run=runs.find(r=>r.id===p.payroll_run_id);return `<div class="row"><div><div class="row-title">Nóminas de ${esc(run?monthLabel(monthOf(run.period_start)):'mes no disponible')}</div><div class="row-meta">Pagado el ${fmtDate(p.paid_on)}</div><button class="secondary" type="button" data-remove-payment="${esc(p.id)}">Eliminar pago incorrecto</button></div><strong>${euro(p.amount)}</strong></div>`}).join(''):'<p class="personnel-note">Todavía no hay pagos de nóminas registrados.</p>'}</div></div>`;
}
function suggestPayment(){
  const run=runs.find(r=>r.id===v('payRun'));if(!run)return;
  const paid=payments.filter(p=>p.payroll_run_id===run.id).reduce((sum,p)=>sum+Number(p.amount),0);
  const input=document.getElementById('payAmount'),help=document.getElementById('paySuggestion');
  if(input)input.value=run.net_total==null?'':Math.max(0,Number(run.net_total)-paid).toFixed(2);
  if(help)help.textContent=`Neto del resumen: ${run.net_total==null?'sin identificar':euro(run.net_total)}. Pagos registrados: ${euro(paid)}. Comprueba el importe y la fecha antes de guardar.`;
}
async function savePayment(){
  if(paymentBusy)return;
  const run=runs.find(r=>r.id===v('payRun')),date=v('payDate'),amount=Number(v('payAmount').replace(',','.'));
  if(!ready||!run||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(amount)||amount<=0){toast('Revisa el mes, la fecha y el importe pagado.');return}
  if(window.isAccountingMonthLocked?.(monthOf(date))){toast('El mes del pago está cerrado. Reábrelo antes de guardar.');return}
  try{paymentBusy=true;setBusy(true);const saved=await api('/rest/v1/payroll_payments',{method:'POST',headers:{Prefer:'return=representation'},body:{user_id:session.user.id,payroll_run_id:run.id,paid_on:date,amount}});if(!saved?.length)throw Error('No se ha confirmado el pago');selectedMonth=monthOf(date);toast('Pago registrado. El coste sigue en el mes de la nómina.');await loadData()}
  catch(e){toast(/23505|duplicate/i.test(e.message||'')?'Ese pago ya está registrado.':'No se pudo guardar: '+e.message)}finally{paymentBusy=false;setBusy(false)}
}
async function removePayment(id){
  if(paymentBusy||!confirm('¿Eliminar este pago incorrecto? La nómina y su coste se conservarán.'))return;
  try{paymentBusy=true;setBusy(true);await api('/rest/v1/payroll_payments?id=eq.'+encodeURIComponent(id),{method:'DELETE'});await loadData();toast('Pago eliminado')}
  catch(e){toast('No se pudo eliminar: '+e.message)}finally{paymentBusy=false;setBusy(false)}
}
const previousMore=moreView;
moreView=function(){return paymentForm()+previousMore()};
const previousBind=bind;
bind=function(){previousBind();if(route==='more'){suggestPayment();document.getElementById('payRun')?.addEventListener('change',suggestPayment);document.getElementById('savePayrollPayment')?.addEventListener('click',savePayment);document.querySelectorAll('[data-remove-payment]').forEach(b=>b.addEventListener('click',()=>removePayment(b.dataset.removePayment)))}};
const previousLoad=loadData;
loadData=async function(){await loadPayments();return previousLoad.apply(this,arguments)};
if(session)loadData();
})();
