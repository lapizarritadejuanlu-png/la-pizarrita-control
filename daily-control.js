(()=>{
function dcAddStyles(){if(document.getElementById('dailyControlStyle'))return;const s=document.createElement('style');s.id='dailyControlStyle';s.textContent=`.daily-card{border-color:#3b4c45;background:linear-gradient(145deg,#161d19,#11130f)}.daily-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.daily-title{font-size:1.02rem;font-weight:950}.daily-date{font-size:.75rem;color:var(--muted);margin-top:3px}.daily-balance{font-size:1.3rem;font-weight:950;color:var(--mint);white-space:nowrap}.daily-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}.daily-box{border:1px solid #304038;border-radius:12px;padding:10px;background:#101612}.daily-box span{display:block;font-size:.67rem;color:var(--muted);text-transform:uppercase}.daily-box strong{display:block;margin-top:3px;font-size:.92rem}.daily-actions{display:grid;grid-template-columns:1fr 1fr 1fr;gap:7px;margin-top:11px}.daily-actions button{padding:9px 7px;font-size:.72rem}.daily-note{font-size:.7rem;color:var(--muted);line-height:1.4;margin-top:8px}@media(max-width:390px){.daily-grid{grid-template-columns:1fr 1fr}.daily-actions{grid-template-columns:1fr}}`;document.head.appendChild(s)}
function dcAccountingDoc(x){return typeof window.isAccountingDocument==='function'?window.isAccountingDocument(x):((x?.document_type||'invoice')!=='delivery_note'&&x?.document_status!=='linked')}
function dcSum(rows,key='amount'){return rows.reduce((a,x)=>a+(Number(x?.[key])||0),0)}
function dcTodayCard(){
  const today=localDate(),docs=(Array.isArray(invoices)?invoices:[]).filter(x=>x.invoice_date===today&&dcAccountingDoc(x)),mv=(Array.isArray(moves)?moves:[]).filter(x=>x.move_date===today);
  const income=dcSum(mv.filter(x=>x.move_type==='ingreso')),purchases=dcSum(docs,'total'),expenses=dcSum(mv.filter(x=>x.move_type==='gasto')),personal=dcSum(mv.filter(x=>x.move_type==='personal')),cash=income-purchases-expenses-personal;
  const pendingToday=(Array.isArray(invoices)?invoices:[]).filter(x=>x.invoice_date===today&&x.document_type==='delivery_note'&&x.document_status!=='linked').length;
  const dateLabel=new Intl.DateTimeFormat('es-ES',{weekday:'long',day:'numeric',month:'long'}).format(new Date(`${today}T12:00:00`));
  return `<div class="section-title">Hoy</div><div class="card daily-card"><div class="daily-head"><div><div class="daily-title">📍 Control diario</div><div class="daily-date">${esc(dateLabel)}</div></div><div><div class="daily-date">Caja orientativa</div><div class="daily-balance">${euro(cash)}</div></div></div><div class="daily-grid"><div class="daily-box"><span>Ingresos</span><strong>${euro(income)}</strong></div><div class="daily-box"><span>Compras</span><strong>${euro(purchases)}</strong></div><div class="daily-box"><span>Otros gastos</span><strong>${euro(expenses)}</strong></div><div class="daily-box"><span>Documentos</span><strong>${docs.length}${pendingToday?` + ${pendingToday} albarán${pendingToday===1?'':'es'}`:''}</strong></div></div><div class="daily-actions"><button type="button" class="secondary" data-daily-action="document">📄 Documento</button><button type="button" class="secondary" data-daily-action="income">💶 Ingreso</button><button type="button" class="secondary" data-daily-action="expense">🧾 Gasto</button></div><div class="daily-note">Caja orientativa = ingresos registrados hoy − compras − otros gastos − personal con fecha de hoy. No sustituye al cierre de caja del TPV.</div></div>`;
}
function dcOpen(action){
  if(action==='document'){route='invoices';renderApp();scrollTo(0,0);setTimeout(()=>document.getElementById('invFile')?.focus(),0);return}
  route='more';renderApp();scrollTo(0,0);
  setTimeout(()=>{
    if(action==='income'){const t=document.getElementById('movType');if(t)t.value='ingreso';document.getElementById('movAmount')?.focus()}
    else if(action==='expense')document.getElementById('expenseAmount')?.focus();
  },0);
}
dcAddStyles();
const previousDashboardDaily=dashboard;
dashboard=function(){const html=previousDashboardDaily();const marker='<div class="section-title">Control del mes</div>';return html.includes(marker)?html.replace(marker,dcTodayCard()+marker):html+dcTodayCard()};
const previousBindDaily=bind;
bind=function(){previousBindDaily();dcAddStyles();document.querySelectorAll('[data-daily-action]').forEach(b=>b.addEventListener('click',()=>dcOpen(b.dataset.dailyAction)))};
if(session)renderApp();
})();
