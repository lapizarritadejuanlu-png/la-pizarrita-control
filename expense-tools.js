(()=>{
let expenseRules=[];

const EXPENSE_CATEGORIES=[
  ['luz','⚡ Luz'],['agua','💧 Agua'],['gas','🔥 Gas'],['telefono_internet','📶 Teléfono / Internet'],
  ['autonomo_juanlu','👤 Autónomo Juanlu'],['autonomo_yoli','👤 Autónomo Yoli'],['gestoria','📚 Gestoría'],
  ['seguros','🛡️ Seguros'],['seguridad_social','👥 Seguridad Social'],['impuestos_modulos','🏛️ Impuestos / Módulos'],
  ['reparaciones','🔧 Reparaciones / Mantenimiento'],['inversiones','🏗️ Inversión / Mejora'],['bancos','🏦 Bancos / Comisiones'],
  ['licencias_tasas','📋 Licencias / Tasas'],['limpieza','🧹 Limpieza'],['alquiler_hipoteca','🏠 Alquiler / Hipoteca'],['otros','🧾 Otros']
];
const EXPENSE_LABELS=Object.fromEntries(EXPENSE_CATEGORIES);

function addExpenseStyles(){
  if(document.getElementById('expenseToolsStyle'))return;
  const s=document.createElement('style');s.id='expenseToolsStyle';s.textContent=`
  .expense-note{color:var(--muted);font-size:.84rem;line-height:1.45;margin:0 0 14px}.expense-kind-note{font-size:.75rem;color:#b4b0a7;margin-top:6px;line-height:1.35}
  .expense-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px 16px}.expense-grid .full{grid-column:1/-1}
  .expense-summary-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-bottom:12px}.expense-summary-box{border:1px solid var(--line);border-radius:13px;padding:11px;background:#121310}.expense-summary-box span{display:block;color:var(--muted);font-size:.72rem}.expense-summary-box strong{display:block;font-size:1rem;margin-top:3px}
  .expense-category-list{display:flex;flex-direction:column;gap:7px;margin-top:9px}.expense-cat-row{display:flex;justify-content:space-between;gap:10px;padding:8px 0;border-top:1px solid #2c2e29;font-size:.83rem}.expense-cat-row:first-child{border-top:0}.expense-cat-row strong{white-space:nowrap}
  .expense-entry{border:1px solid var(--line);border-radius:14px;background:#151613;padding:13px 14px;margin-top:9px}.expense-entry-top{display:flex;justify-content:space-between;gap:12px}.expense-entry-name{font-weight:850;font-size:.87rem}.expense-entry-meta{font-size:.75rem;color:var(--muted);margin-top:4px;line-height:1.4}.expense-entry-amount{font-weight:950;white-space:nowrap}.expense-entry-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}.expense-entry-actions button{padding:7px 9px;font-size:.73rem}
  .expense-tag{display:inline-block;border:1px solid #3b3d36;border-radius:999px;padding:3px 7px;margin:5px 4px 0 0;font-size:.68rem;font-weight:850}.expense-operating{color:#a9e0c8}.expense-tax{color:#e5c374}.expense-investment{color:#9ab9ff}
  .rule-list{display:flex;flex-direction:column;gap:8px}.rule-row{border:1px solid var(--line);border-radius:13px;background:#141512;padding:12px}.rule-top{display:flex;justify-content:space-between;gap:12px}.rule-name{font-size:.84rem;font-weight:850}.rule-meta{font-size:.74rem;color:var(--muted);margin-top:4px}.rule-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}.rule-actions button{padding:6px 9px;font-size:.72rem}.rule-off{opacity:.55}
  .dash-expense-breakdown{margin-top:12px;padding-top:10px;border-top:1px solid #2e302b}.cash-note{font-size:.78rem;color:var(--muted);margin:10px 0 0;line-height:1.4}.dash-tax-sub{font-size:.7rem;color:var(--muted);margin-top:2px}
  @media(max-width:390px){.expense-grid{grid-template-columns:1fr}.expense-grid .full{grid-column:auto}.expense-summary-grid{grid-template-columns:1fr 1fr}}
  `;document.head.appendChild(s);
}
function expenseLabel(category){return EXPENSE_LABELS[category]||category||'🧾 Otros'}
function expenseKind(x){return x?.expense_kind||'operating'}
function kindLabel(k){return k==='investment'?'Inversión':k==='tax'?'Impuesto':'Operativo'}
function cadenceLabel(c){return c==='monthly'?'Mensual':c==='quarterly'?'Trimestral':c==='annual'?'Anual':'Puntual'}
function autoKindForCategory(c){return c==='inversiones'?'investment':c==='impuestos_modulos'?'tax':'operating'}
function quarterLabel(date){if(!date)return'';const [y,m]=date.split('-').map(Number);return `T${Math.floor((m-1)/3)+1} ${y}`}
function expNum(v){const s=String(v??'').trim().replace(',','.');const n=Number(s);return Number.isFinite(n)?n:null}
function monthIndex(m){const [y,mo]=String(m||'').split('-').map(Number);return Number.isFinite(y)&&Number.isFinite(mo)?y*12+mo-1:null}
function monthDistance(from,to){const a=monthIndex(from),b=monthIndex(to);return a===null||b===null?null:b-a}
function taxMonthlyLoadForMonth(month){
  let total=0;
  for(const x of Array.isArray(moves)?moves:[]){
    if(x.move_type!=='gasto'||expenseKind(x)!=='tax'||!x.move_date)continue;
    const paidMonth=x.move_date.slice(0,7),d=monthDistance(paidMonth,month);if(d===null||d<0)continue;
    const a=Number(x.amount)||0,c=x.recurrence||'oneoff';
    if(c==='quarterly'&&d<3)total+=a/3;
    else if(c==='annual'&&d<12)total+=a/12;
    else if((c==='monthly'||c==='oneoff')&&d===0)total+=a;
  }
  return total;
}
function monthExpenseRows(){return (Array.isArray(moves)?moves:[]).filter(x=>x.move_type==='gasto'&&(x.move_date||'').slice(0,7)===selectedMonth)}
function expenseTotals(rows=monthExpenseRows(),month=selectedMonth){
  let operating=0,taxCash=0,investment=0;
  for(const x of rows){const a=Number(x.amount)||0,k=expenseKind(x);if(k==='investment')investment+=a;else if(k==='tax')taxCash+=a;else operating+=a}
  const taxLoad=taxMonthlyLoadForMonth(month);
  return{operating,taxCash,taxLoad,investment,cash:operating+taxCash+investment};
}
function expenseCategorySummary(rows=monthExpenseRows()){
  const m=new Map();for(const x of rows){const c=x.category||'otros';m.set(c,(m.get(c)||0)+(Number(x.amount)||0))}
  return [...m.entries()].sort((a,b)=>Math.abs(b[1])-Math.abs(a[1]));
}
function categoryOptions(selected='luz'){return EXPENSE_CATEGORIES.map(([v,l])=>`<option value="${esc(v)}" ${selected===v?'selected':''}>${esc(l)}</option>`).join('')}
function recurringRulesHtml(){
  if(!expenseRules.length)return '<div class="empty">No hay gastos fijos programados.</div>';
  return `<div class="rule-list">${expenseRules.map(r=>`<div class="rule-row ${r.active?'':'rule-off'}"><div class="rule-top"><div><div class="rule-name">${esc(r.concept)}</div><div class="rule-meta">${esc(expenseLabel(r.category))} · ${cadenceLabel(r.cadence)} · desde ${fmtDate(r.start_date)}${r.owner_label?` · ${esc(r.owner_label)}`:''}</div></div><strong>${euro(r.amount)}</strong></div><div class="rule-actions"><button type="button" class="secondary" data-rule-toggle="${esc(r.id)}" data-rule-active="${r.active?'1':'0'}">${r.active?'⏸ Pausar':'▶ Reactivar'}</button><button type="button" class="secondary danger" data-rule-delete="${esc(r.id)}">🗑 Quitar programación</button></div></div>`).join('')}</div>`
}
function expensesForMonthHtml(){
  const rows=monthExpenseRows(),t=expenseTotals(rows,selectedMonth),cats=expenseCategorySummary(rows);
  const list=rows.length?rows.sort((a,b)=>String(b.move_date||'').localeCompare(String(a.move_date||''))).map(x=>`<div class="expense-entry"><div class="expense-entry-top"><div><div class="expense-entry-name">${esc(x.concept)}</div><div class="expense-entry-meta">${fmtDate(x.move_date)} · ${esc(expenseLabel(x.category||'otros'))}${x.owner_label?` · ${esc(x.owner_label)}`:''}${x.period_label?` · ${esc(x.period_label)}`:''}</div><span class="expense-tag expense-${expenseKind(x)}">${kindLabel(expenseKind(x))}</span>${x.recurrence&&x.recurrence!=='oneoff'?`<span class="expense-tag">${cadenceLabel(x.recurrence)}</span>`:''}</div><div class="expense-entry-amount">${euro(x.amount)}</div></div><div class="expense-entry-actions">${x.file_path?`<button type="button" class="secondary" data-expense-file="${esc(x.file_path)}">📎 Ver justificante</button>`:''}<button type="button" class="secondary danger" data-expense-delete="${esc(x.id)}">🗑 Borrar</button></div></div>`).join(''):'<div class="empty">No hay gastos registrados en este mes.</div>';
  const catsHtml=cats.length?`<div class="expense-category-list">${cats.map(([c,a])=>`<div class="expense-cat-row"><span>${esc(expenseLabel(c))}</span><strong>${euro(a)}</strong></div>`).join('')}</div>`:'';
  return `<div class="card"><div class="expense-summary-grid"><div class="expense-summary-box"><span>Gasto operativo</span><strong>${euro(t.operating)}</strong></div><div class="expense-summary-box"><span>Impuestos pagados</span><strong>${euro(t.taxCash)}</strong></div><div class="expense-summary-box"><span>Inversiones</span><strong>${euro(t.investment)}</strong></div><div class="expense-summary-box"><span>Salida de caja</span><strong>${euro(t.cash)}</strong></div></div>${t.taxCash!==t.taxLoad?`<p class="expense-note">Carga mensual estimada de impuestos: <strong>${euro(t.taxLoad)}</strong>. El pago real del mes sigue siendo ${euro(t.taxCash)}.</p>`:''}${catsHtml}</div>${list}`
}
function expenseManager(){return `<div class="section-title">Gastos del negocio</div><div class="card"><p class="expense-note">Registra aquí luz, agua, autónomos, módulos, reparaciones e inversiones. Las inversiones se separan del resultado operativo y los pagos trimestrales se reparten como carga mensual.</p><div class="expense-grid"><div class="field"><label>Categoría</label><select id="expenseCategory">${categoryOptions()}</select></div><div class="field"><label>Fecha</label><input id="expenseDate" type="date" value="${localDate()}"></div><div class="field full"><label>Concepto</label><input id="expenseConcept" placeholder="Ej. Factura luz agosto"></div><div class="field"><label>Importe</label><input id="expenseAmount" type="number" inputmode="decimal" step="0.01"></div><div class="field"><label>Tipo de gasto</label><select id="expenseKind"><option value="operating">Gasto operativo</option><option value="tax">Impuesto</option><option value="investment">Inversión / mejora</option></select><div class="expense-kind-note">Las inversiones no restan del resultado operativo; sí cuentan como salida de caja.</div></div><div class="field"><label>Persona / titular (opcional)</label><input id="expenseOwner" placeholder="Juanlu, Yoli…"></div><div class="field"><label>Frecuencia</label><select id="expenseRecurrence"><option value="oneoff">Puntual</option><option value="monthly">Mensual fija</option><option value="quarterly">Trimestral</option><option value="annual">Anual</option></select></div><div class="field"><label>Periodo (opcional)</label><input id="expensePeriod" placeholder="Ej. T3 2026"></div><div class="field full"><label>Justificante (opcional)</label><input id="expenseFile" type="file" accept="image/*,application/pdf"></div></div><button id="saveExpense" type="button" class="primary wide">Guardar gasto</button></div><div class="section-title">${esc(monthLabel(selectedMonth))}</div>${expensesForMonthHtml()}<div class="section-title">Gastos fijos programados</div><div class="card">${recurringRulesHtml()}</div>`}

const previousMoreExpenses=moreView;
moreView=function(){
  let html=previousMoreExpenses();
  const marker='<div class="section-title">Ingresos / gastos</div>';
  if(html.includes(marker))html=html.replace(marker,expenseManager()+'<div class="section-title">Ingresos / ajustes manuales</div>');
  else html+=expenseManager();
  return html;
};

async function uploadExpenseFile(file){
  if(!file)return null;const safe=(file.name||'gasto').replace(/[^a-zA-Z0-9._-]+/g,'_');const path=`${session.user.id}/expenses/${Date.now()}-${safe}`;
  const res=await fetch(`${SB_URL}/storage/v1/object/invoice-files/${path.split('/').map(encodeURIComponent).join('/')}`,{method:'POST',headers:{apikey:SB_KEY,Authorization:`Bearer ${session.access_token}`,'Content-Type':file.type||'application/octet-stream','x-upsert':'false'},body:file});
  if(!res.ok){let d={};try{d=await res.json()}catch{}throw new Error(d.message||d.error||'No se pudo subir el justificante')}return path;
}
async function saveExpense(){
  const category=v('expenseCategory'),date=v('expenseDate'),concept=v('expenseConcept'),amount=expNum(v('expenseAmount')),kind=v('expenseKind'),recurrence=v('expenseRecurrence'),owner=v('expenseOwner')||null;let period=v('expensePeriod')||null;
  if(!date||!concept||amount===null||amount<=0){toast('Completa fecha, concepto e importe.');return}
  if(kind==='tax'&&!period)period=quarterLabel(date);
  const file=document.getElementById('expenseFile')?.files?.[0]||null;let filePath=null,ruleId=null;
  try{
    setBusy(true);if(file)filePath=await uploadExpenseFile(file);
    if(recurrence!=='oneoff'){
      const made=await api('/rest/v1/expense_rules',{method:'POST',headers:{Prefer:'return=representation'},body:{user_id:session.user.id,category,concept,amount,expense_kind:kind,owner_label:owner,cadence:recurrence,start_date:date,active:true}});ruleId=Array.isArray(made)?made[0]?.id:made?.id;if(!ruleId)throw new Error('No se pudo confirmar la programación del gasto');
    }
    await api('/rest/v1/moves',{method:'POST',headers:{Prefer:'return=minimal'},body:{user_id:session.user.id,move_type:'gasto',move_date:date,concept,amount,notes:ruleId?'Gasto recurrente programado':'Gasto registrado',category,expense_kind:kind,recurrence,owner_label:owner,period_label:period,file_path:filePath,recurring_rule_id:ruleId}});
    selectedMonth=date.slice(0,7);toast(recurrence==='oneoff'?'Gasto guardado':'Gasto guardado y programado');await loadData();
  }catch(e){if(ruleId)await api(`/rest/v1/expense_rules?id=eq.${encodeURIComponent(ruleId)}`,{method:'DELETE'}).catch(()=>{});if(filePath)await deleteStorageFile(filePath).catch(()=>{});toast('No se pudo guardar: '+(e.message||'error'))}finally{setBusy(false)}
}
async function deleteExpense(id){const x=moves.find(m=>m.id===id);if(!x||!confirm(`¿Borrar ${x.concept} por ${euro(x.amount)}?`))return;try{setBusy(true);await api(`/rest/v1/moves?id=eq.${encodeURIComponent(id)}`,{method:'DELETE'});if(x.file_path)await deleteStorageFile(x.file_path).catch(()=>{});toast('Gasto borrado');await loadData()}catch(e){toast('No se pudo borrar: '+e.message)}finally{setBusy(false)}}
async function toggleExpenseRule(id,active){try{setBusy(true);await api(`/rest/v1/expense_rules?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:{active:!active,updated_at:new Date().toISOString()}});toast(active?'Gasto recurrente pausado':'Gasto recurrente reactivado');await loadData()}catch(e){toast('No se pudo cambiar: '+e.message)}finally{setBusy(false)}}
async function deleteExpenseRule(id){const r=expenseRules.find(x=>x.id===id);if(!r||!confirm(`¿Quitar la programación de ${r.concept}? Los gastos ya guardados se conservarán.`))return;try{setBusy(true);await api(`/rest/v1/expense_rules?id=eq.${encodeURIComponent(id)}`,{method:'DELETE'});toast('Programación eliminada');await loadData()}catch(e){toast('No se pudo eliminar: '+e.message)}finally{setBusy(false)}}

function addMonthsSafe(dateStr,months){const [y,m,d]=dateStr.split('-').map(Number),base=new Date(y,m-1+months,1),last=new Date(base.getFullYear(),base.getMonth()+1,0).getDate();return `${base.getFullYear()}-${String(base.getMonth()+1).padStart(2,'0')}-${String(Math.min(d,last)).padStart(2,'0')}`}
async function ensureRecurringExpenses(){
  if(!session||!expenseRules.length)return 0;const today=localDate(),existing=new Set((moves||[]).filter(x=>x.recurring_rule_id).map(x=>`${x.recurring_rule_id}|${x.move_date}`)),rows=[];
  for(const r of expenseRules.filter(x=>x.active)){
    const step=r.cadence==='monthly'?1:r.cadence==='quarterly'?3:12;let due=r.start_date,guard=0;
    while(due<=today&&guard++<60){const key=`${r.id}|${due}`;if(!existing.has(key)){rows.push({user_id:session.user.id,move_type:'gasto',move_date:due,concept:r.concept,amount:Number(r.amount)||0,notes:'Generado automáticamente desde gasto recurrente',category:r.category,expense_kind:r.expense_kind,recurrence:r.cadence,owner_label:r.owner_label||null,period_label:r.expense_kind==='tax'?quarterLabel(due):null,file_path:null,recurring_rule_id:r.id});existing.add(key)}due=addMonthsSafe(r.start_date,step*guard)}
  }
  if(rows.length)await api('/rest/v1/moves',{method:'POST',headers:{Prefer:'return=minimal'},body:rows});return rows.length;
}

function expenseMonthOptions(){const set=new Set([localDate().slice(0,7),selectedMonth]);for(const x of invoices)if(x.invoice_date)set.add(x.invoice_date.slice(0,7));for(const x of products)if(x.price_date)set.add(x.price_date.slice(0,7));for(const x of moves)if(x.move_date)set.add(x.move_date.slice(0,7));const d=new Date();for(let i=0;i<18;i++){const x=new Date(d.getFullYear(),d.getMonth()-i,2);set.add(`${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}`)}return [...set].sort().reverse()}
function enhancedDashboard(){
  const inv=monthRows(invoices,'invoice_date'),mv=monthRows(moves,'move_date'),sales=mv.filter(x=>x.move_type==='ingreso').reduce((a,x)=>a+Number(x.amount||0),0),purchases=inv.reduce((a,x)=>a+Number(x.total||0),0),personal=mv.filter(x=>x.move_type==='personal').reduce((a,x)=>a+Number(x.amount||0),0),expenses=mv.filter(x=>x.move_type==='gasto'),t=expenseTotals(expenses,selectedMonth),result=sales-purchases-personal-t.operating-t.taxLoad,cashOut=purchases+personal+t.cash;
  const opts=expenseMonthOptions().map(m=>`<option value="${esc(m)}" ${m===selectedMonth?'selected':''}>${esc(monthLabel(m))}</option>`).join(''),recent=invoices.slice(0,5),cats=expenseCategorySummary(expenses).slice(0,6);
  return `<div class="card dashboard-card"><div class="dash-label">RESULTADO OPERATIVO ESTIMADO · ${esc(selectedMonth)}</div><div class="big-result">${euro(result)}</div><select id="monthPicker" class="month-select">${opts}</select><div class="metrics"><div class="metric"><span>💵 Ventas</span><strong>${euro(sales)}</strong></div><div class="metric"><span>🛒 Compras</span><strong>${euro(purchases)}</strong></div><div class="metric"><span>👥 Personal</span><strong>${euro(personal)}</strong></div><div class="metric"><span>🧾 Gasto operativo</span><strong>${euro(t.operating)}</strong></div><div class="metric"><span>🏛️ Impuestos (carga)</span><strong>${euro(t.taxLoad)}</strong><div class="dash-tax-sub">Pagado: ${euro(t.taxCash)}</div></div><div class="metric"><span>🏗️ Inversiones</span><strong>${euro(t.investment)}</strong></div></div><p class="cash-note">Salida de caja estimada del mes: <strong>${euro(cashOut)}</strong>. Las inversiones cuentan en caja, pero no reducen el resultado operativo.</p>${cats.length?`<div class="dash-expense-breakdown">${cats.map(([c,a])=>`<div class="expense-cat-row"><span>${esc(expenseLabel(c))}</span><strong>${euro(a)}</strong></div>`).join('')}</div>`:''}</div><div class="section-title">Últimas facturas</div>${recent.length?`<div class="list">${recent.map(x=>invoiceRow(x,false)).join('')}</div>`:'<div class="empty">Todavía no hay facturas.</div>'}`
}
dashboard=enhancedDashboard;

const originalLoadDataExpenses=loadData;
loadData=async function(){
  await originalLoadDataExpenses.apply(this,arguments);
  try{expenseRules=await api('/rest/v1/expense_rules?select=*&order=active.desc,start_date.desc')||[];const made=await ensureRecurringExpenses();if(made)await originalLoadDataExpenses.apply(this,arguments);if(route==='more'||route==='dashboard')renderApp()}catch(e){console.error('Expense rules error',e?.message||'unknown')}
};

const previousBindExpenses=bind;
bind=function(){
  previousBindExpenses();addExpenseStyles();
  const cat=document.getElementById('expenseCategory');cat?.addEventListener('change',()=>{const c=cat.value,k=document.getElementById('expenseKind'),owner=document.getElementById('expenseOwner'),concept=document.getElementById('expenseConcept'),period=document.getElementById('expensePeriod');if(k)k.value=autoKindForCategory(c);if(owner&&!owner.value){if(c==='autonomo_juanlu')owner.value='Juanlu';else if(c==='autonomo_yoli')owner.value='Yoli'}if(concept&&!concept.value)concept.value=expenseLabel(c).replace(/^\S+\s/,'');if(c==='impuestos_modulos'&&period&&!period.value)period.value=quarterLabel(v('expenseDate'))});
  document.getElementById('expenseKind')?.addEventListener('change',e=>{const p=document.getElementById('expensePeriod');if(e.target.value==='tax'&&p&&!p.value)p.value=quarterLabel(v('expenseDate'))});
  document.getElementById('expenseDate')?.addEventListener('change',e=>{const k=v('expenseKind'),p=document.getElementById('expensePeriod');if(k==='tax'&&p&&!p.value)p.value=quarterLabel(e.target.value)});
  document.getElementById('saveExpense')?.addEventListener('click',saveExpense);
  document.querySelectorAll('[data-expense-delete]').forEach(b=>b.addEventListener('click',()=>deleteExpense(b.dataset.expenseDelete)));
  document.querySelectorAll('[data-expense-file]').forEach(b=>b.addEventListener('click',()=>openInvoiceFile(b.dataset.expenseFile)));
  document.querySelectorAll('[data-rule-toggle]').forEach(b=>b.addEventListener('click',()=>toggleExpenseRule(b.dataset.ruleToggle,b.dataset.ruleActive==='1')));
  document.querySelectorAll('[data-rule-delete]').forEach(b=>b.addEventListener('click',()=>deleteExpenseRule(b.dataset.ruleDelete)));
  const oldType=document.getElementById('movType');if(oldType){oldType.querySelector('option[value="gasto"]')?.remove();}
};

addExpenseStyles();
if(session)renderApp();
})();
