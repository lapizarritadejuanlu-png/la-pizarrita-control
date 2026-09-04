(()=>{
let monthLockBusinessGuardInstalled=false;

function mlbMonth(date){return String(date||'').slice(0,7)}
function mlbLocked(month){return !!month&&typeof window.isAccountingMonthLocked==='function'&&window.isAccountingMonthLocked(month)}
function mlbExpenseKind(x){return x?.expense_kind||'operating'}
function mlbMonthDistance(from,to){const a=String(from||'').split('-').map(Number),b=String(to||'').split('-').map(Number);if(a.length<2||b.length<2||!a[0]||!a[1]||!b[0]||!b[1])return null;return (b[0]*12+b[1])-(a[0]*12+a[1])}
function mlbTaxLoad(month){
  let total=0;
  for(const x of Array.isArray(moves)?moves:[]){
    if(x.move_type!=='gasto'||mlbExpenseKind(x)!=='tax'||!x.move_date)continue;
    const paid=mlbMonth(x.move_date),d=mlbMonthDistance(paid,month);if(d===null||d<0)continue;
    const a=Number(x.amount)||0,c=x.recurrence||'oneoff';
    if(c==='quarterly'&&d<3)total+=a/3;
    else if(c==='annual'&&d<12)total+=a/12;
    else if((c==='monthly'||c==='oneoff')&&d===0)total+=a;
  }
  return total;
}
function mlbBusinessSnapshot(month){
  const mv=(Array.isArray(moves)?moves:[]).filter(x=>mlbMonth(x.move_date)===month);
  const sum=(rows)=>rows.reduce((a,x)=>a+(Number(x.amount)||0),0);
  const sales=sum(mv.filter(x=>x.move_type==='ingreso'));
  const personal=sum(mv.filter(x=>x.move_type==='personal'));
  const expenses=mv.filter(x=>x.move_type==='gasto');
  const operating=sum(expenses.filter(x=>mlbExpenseKind(x)==='operating'));
  const taxCash=sum(expenses.filter(x=>mlbExpenseKind(x)==='tax'));
  const investment=sum(expenses.filter(x=>mlbExpenseKind(x)==='investment'));
  const taxLoad=mlbTaxLoad(month);
  const docs=(Array.isArray(invoices)?invoices:[]).filter(x=>mlbMonth(x.invoice_date)===month&&!x.deleted_at);
  const accounting=docs.filter(x=>typeof window.isAccountingDocument==='function'?window.isAccountingDocument(x):((x.document_type||'invoice')!=='delivery_note'&&x.document_status!=='linked'));
  const purchases=accounting.reduce((a,x)=>a+(Number(x.total)||0),0);
  const personalCash=window.personnelCashForMonth?.(month);
  if(personalCash===null||personalCash===undefined)throw new Error('No se han cargado los pagos de nóminas. Actualiza antes de cerrar el mes.');
  return {
    personnel_cash_total:personalCash,
    sales_total:sales,
    purchases_total:purchases,
    personal_total:personal,
    operating_expense_total:operating,
    tax_cash_total:taxCash,
    tax_load_total:taxLoad,
    investment_total:investment,
    result_estimate:sales-purchases-personal-operating-taxLoad,
    cash_out_total:purchases+personalCash+operating+taxCash+investment
  };
}
function mlbFriendlyLockedError(){return new Error('🔒 Ese mes está cerrado. Reábrelo antes de modificar datos.')}

const mlbPreviousApi=api;
api=async function(path,options={}){
  const method=String(options?.method||'GET').toUpperCase();
  let opts=options;
  if(path==='/rest/v1/accounting_month_locks'&&method==='POST'&&options?.body?.month){
    const month=mlbMonth(options.body.month),extra=mlbBusinessSnapshot(month);
    opts={...options,body:{...options.body,summary:{...(options.body.summary||{}),...extra}}};
  }
  if(path==='/rest/v1/moves'&&method==='POST'&&Array.isArray(options?.body)){
    const filtered=options.body.filter(x=>!mlbLocked(mlbMonth(x?.move_date)));
    if(!filtered.length)return null;
    opts={...options,body:filtered};
  }
  if(path.startsWith('/rest/v1/moves')&&(method==='POST'||method==='PATCH'||method==='DELETE')){
    if(method==='POST'&&!Array.isArray(opts?.body)&&mlbLocked(mlbMonth(opts?.body?.move_date)))throw mlbFriendlyLockedError();
  }
  if(path.startsWith('/rest/v1/payroll_runs')&&(method==='POST'||method==='PATCH'||method==='DELETE')){
    const b=opts?.body;if(b&&typeof b==='object'&&!Array.isArray(b)){
      const start=mlbMonth(b.period_start),end=mlbMonth(b.period_end);
      if(mlbLocked(start)||mlbLocked(end))throw mlbFriendlyLockedError();
    }
  }
  return mlbPreviousApi(path,opts);
};

if(typeof saveMove==='function'){
  const mlbPreviousSaveMove=saveMove;
  saveMove=async function(){const m=mlbMonth(v('movDate'));if(mlbLocked(m)){toast(`🔒 ${monthLabel(m)} está cerrado. Reábrelo antes de guardar el movimiento.`);return}return mlbPreviousSaveMove.apply(this,arguments)};
}

function mlbGuardClick(e){
  const saveExpenseButton=e.target?.closest?.('#saveExpense');
  if(saveExpenseButton){const m=mlbMonth(document.getElementById('expenseDate')?.value);if(mlbLocked(m)){e.preventDefault();e.stopImmediatePropagation();toast(`🔒 ${monthLabel(m)} está cerrado. Reábrelo antes de guardar el gasto.`);return}}
  const delExpense=e.target?.closest?.('[data-expense-delete]');
  if(delExpense){const x=(Array.isArray(moves)?moves:[]).find(i=>i.id===delExpense.dataset.expenseDelete),m=mlbMonth(x?.move_date);if(mlbLocked(m)){e.preventDefault();e.stopImmediatePropagation();toast(`🔒 ${monthLabel(m)} está cerrado. Reábrelo antes de borrar el gasto.`);return}}
}
function mlbInstallGuard(){if(monthLockBusinessGuardInstalled)return;document.addEventListener('click',mlbGuardClick,true);monthLockBusinessGuardInstalled=true}

function mlbClosedSummary(){
  const lock=(window.accountingMonthLocks||[]).find(x=>mlbMonth(x.month)===selectedMonth),s=lock?.summary||{};
  if(!lock||s.sales_total===undefined)return'';
  return `<div class="month-business-summary"><div class="month-business-title">📊 Foto completa del negocio</div><div class="month-business-grid"><div><span>Ingresos</span><strong>${euro(s.sales_total)}</strong></div><div><span>Compras</span><strong>${euro(s.purchases_total)}</strong></div><div><span>Personal</span><strong>${euro(s.personal_total)}</strong></div><div><span>Otros gastos</span><strong>${euro(s.operating_expense_total)}</strong></div><div><span>Impuestos (carga)</span><strong>${euro(s.tax_load_total)}</strong></div><div><span>Inversiones</span><strong>${euro(s.investment_total)}</strong></div><div class="month-business-result"><span>Resultado estimado</span><strong>${euro(s.result_estimate)}</strong></div><div><span>Salida de caja</span><strong>${euro(s.cash_out_total)}</strong></div></div><div class="month-business-note">Personal ya está incluido una sola vez mediante el movimiento generado por el resumen de nóminas.</div></div>`;
}
function mlbStyles(){
  if(document.getElementById('monthLockBusinessStyle'))return;
  const st=document.createElement('style');st.id='monthLockBusinessStyle';st.textContent=`.month-business-summary{margin-top:12px;padding-top:12px;border-top:1px solid #2d4434}.month-business-title{font-size:.8rem;font-weight:900;color:#a9e0c8}.month-business-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:8px}.month-business-grid>div{border:1px solid #2c3d31;border-radius:10px;padding:9px;background:#101712}.month-business-grid span{display:block;font-size:.65rem;color:var(--muted);text-transform:uppercase}.month-business-grid strong{display:block;margin-top:3px;font-size:.86rem}.month-business-result strong{color:#7bd79a}.month-business-note{font-size:.68rem;color:var(--muted);line-height:1.4;margin-top:8px}.month-locked-control{opacity:.55}@media(max-width:390px){.month-business-grid{grid-template-columns:1fr}}`;document.head.appendChild(st);
}
function mlbDecorate(){
  mlbStyles();mlbInstallGuard();
  const closed=document.querySelector('.month-lock-card.closed');if(closed&&!closed.querySelector('.month-business-summary'))closed.querySelector('.month-lock-btn')?.insertAdjacentHTML('beforebegin',mlbClosedSummary());
  document.querySelectorAll('[data-expense-delete]').forEach(b=>{const x=(Array.isArray(moves)?moves:[]).find(i=>i.id===b.dataset.expenseDelete);if(mlbLocked(mlbMonth(x?.move_date))){b.disabled=true;b.classList.add('month-locked-control')}});
  const date=document.getElementById('expenseDate'),save=document.getElementById('saveExpense');if(date&&save&&mlbLocked(mlbMonth(date.value))){save.classList.add('month-locked-control')}
}
const mlbPreviousBind=bind;
bind=function(){mlbPreviousBind();mlbDecorate()};
mlbStyles();mlbInstallGuard();if(session)renderApp();
})();
