(()=>{
let dailySales=[];

function dsAddStyles(){
  if(document.getElementById('dailySalesStyle'))return;
  const s=document.createElement('style');s.id='dailySalesStyle';s.textContent=`
  .sales-quick{border-color:#5a4b2b;background:linear-gradient(145deg,#1d1a12,#12130f)}.sales-quick-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.sales-quick-title{font-size:1.02rem;font-weight:950}.sales-quick-today{font-size:1.35rem;font-weight:950;color:var(--accent);white-space:nowrap}.sales-quick-meta{font-size:.75rem;color:var(--muted);margin-top:3px}.sales-quick-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}.sales-quick-box{border:1px solid #463d26;border-radius:12px;padding:10px;background:#17140d}.sales-quick-box span{display:block;font-size:.67rem;color:var(--muted);text-transform:uppercase}.sales-quick-box strong{display:block;margin-top:3px;font-size:.93rem}
  .sales-form{display:grid;grid-template-columns:1fr 1fr;gap:12px 16px}.sales-form .full{grid-column:1/-1}.sales-total{border:1px solid #564829;border-radius:14px;background:#17140d;padding:12px 14px}.sales-total span{display:block;color:var(--muted);font-size:.72rem}.sales-total strong{display:block;font-size:1.35rem;margin-top:2px;color:var(--accent)}.sales-existing{display:none;margin-top:10px;padding:9px 11px;border:1px solid #3d5b47;border-radius:11px;background:#111d15;color:#8fd1a5;font-size:.76rem;font-weight:800}.sales-existing.show{display:block}
  .sales-periods{display:grid;grid-template-columns:1fr 1fr;gap:9px}.sales-period{border:1px solid #30332d;border-radius:13px;background:#121310;padding:12px}.sales-period span{display:block;color:var(--muted);font-size:.69rem;text-transform:uppercase}.sales-period strong{display:block;font-size:1.08rem;margin-top:3px}.sales-period small{display:block;color:#aaa69f;font-size:.69rem;margin-top:4px;line-height:1.35}.sales-month-total{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:11px 0 4px}.sales-month-stat{border:1px solid #30332d;border-radius:11px;background:#11120f;padding:9px}.sales-month-stat span{display:block;color:var(--muted);font-size:.64rem;text-transform:uppercase}.sales-month-stat strong{display:block;margin-top:3px;font-size:.87rem}
  .sales-entry{border:1px solid var(--line);border-radius:14px;background:#151613;padding:13px 14px;margin-top:9px}.sales-entry-top{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.sales-entry-date{font-weight:900}.sales-entry-meta{font-size:.74rem;color:var(--muted);margin-top:4px;line-height:1.4}.sales-entry-total{font-weight:950;white-space:nowrap}.sales-entry-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:9px}.sales-entry-actions button{padding:7px 10px;font-size:.72rem}.sales-note{font-size:.77rem;color:var(--muted);line-height:1.45;margin:0 0 12px}.sales-empty{color:var(--muted);font-size:.82rem;line-height:1.4}
  @media(max-width:390px){.sales-form{grid-template-columns:1fr}.sales-form .full{grid-column:auto}.sales-month-total{grid-template-columns:1fr 1fr 1fr}.sales-quick-head{gap:8px}.sales-quick-today{font-size:1.15rem}}
  `;document.head.appendChild(s)
}
function dsNum(v){const n=Number(String(v??'').trim().replace(',','.'));return Number.isFinite(n)?n:null}
function dsDateObj(s){const [y,m,d]=String(s||'').split('-').map(Number);return new Date(y,m-1,d,12,0,0)}
function dsDateKey(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function dsWeekStart(today){const d=dsDateObj(today),offset=(d.getDay()+6)%7;d.setDate(d.getDate()-offset);return dsDateKey(d)}
function dsTotals(rows){return rows.reduce((a,x)=>{a.cash+=Number(x.cash_amount)||0;a.card+=Number(x.card_amount)||0;a.total+=Number(x.total_amount)||0;return a},{cash:0,card:0,total:0})}
function dsRange(start,end){return dailySales.filter(x=>String(x.sale_date)>=start&&String(x.sale_date)<=end)}
function dsMonthRows(month=selectedMonth){return dailySales.filter(x=>String(x.sale_date||'').slice(0,7)===month)}
function dsPeriodData(){
  const today=localDate(),weekStart=dsWeekStart(today),monthStart=`${today.slice(0,7)}-01`,yearStart=`${today.slice(0,4)}-01-01`;
  return{today:dsTotals(dsRange(today,today)),week:dsTotals(dsRange(weekStart,today)),month:dsTotals(dsRange(monthStart,today)),year:dsTotals(dsRange(yearStart,today)),todayKey:today}
}
function dsPeriodBox(label,t){return `<div class="sales-period"><span>${esc(label)}</span><strong>${euro(t.total)}</strong><small>💶 ${euro(t.cash)} · 💳 ${euro(t.card)}</small></div>`}
function salesQuickCard(){
  const p=dsPeriodData();
  return `<div class="section-title">Facturación</div><div class="card sales-quick"><div class="sales-quick-head"><div><div class="sales-quick-title">💰 Caja diaria</div><div class="sales-quick-meta">Efectivo + Visa / tarjeta</div></div><div><div class="sales-quick-meta">Hoy</div><div class="sales-quick-today">${euro(p.today.total)}</div></div></div><div class="sales-quick-grid"><div class="sales-quick-box"><span>Esta semana</span><strong>${euro(p.week.total)}</strong></div><div class="sales-quick-box"><span>Este mes</span><strong>${euro(p.month.total)}</strong></div><div class="sales-quick-box"><span>Este año</span><strong>${euro(p.year.total)}</strong></div><div class="sales-quick-box"><span>Hoy: efectivo / tarjeta</span><strong>${euro(p.today.cash)} / ${euro(p.today.card)}</strong></div></div><button type="button" id="salesQuickOpen" class="primary wide">Registrar facturación</button></div>`
}
function salesFormHtml(){
  return `<div class="card"><h3 class="account-title">💶 Facturación diaria de caja</h3><p class="sales-note">Al terminar el día introduce lo cobrado en efectivo y lo cobrado con Visa / tarjeta. Si eliges una fecha ya guardada, la app la carga para que puedas corregirla sin duplicarla.</p><div class="sales-form"><div class="field"><label>Fecha</label><input id="salesDate" type="date" value="${localDate()}" max="${localDate()}"></div><div class="field"><label>Efectivo</label><input id="salesCash" type="number" inputmode="decimal" step="0.01" min="0" placeholder="0,00"></div><div class="field"><label>Visa / tarjeta</label><input id="salesCard" type="number" inputmode="decimal" step="0.01" min="0" placeholder="0,00"></div><div class="field"><label>Total del día</label><div class="sales-total"><span>Efectivo + tarjeta</span><strong id="salesCalculatedTotal">0,00 €</strong></div></div><div class="field full"><label>Nota (opcional)</label><input id="salesNote" autocomplete="off" placeholder="Ej. evento, lluvia, partido…"></div></div><div id="salesExisting" class="sales-existing">✓ Este día ya está guardado. Al pulsar guardar actualizarás sus cifras.</div><button type="button" id="salesSave" class="primary wide">Guardar facturación del día</button></div>`
}
function salesSummaryHtml(){
  const p=dsPeriodData(),rows=dsMonthRows(selectedMonth).slice().sort((a,b)=>String(b.sale_date).localeCompare(String(a.sale_date))),mt=dsTotals(rows);
  const list=rows.length?rows.map(x=>`<div class="sales-entry"><div class="sales-entry-top"><div><div class="sales-entry-date">${fmtDate(x.sale_date)}</div><div class="sales-entry-meta">💶 Efectivo ${euro(x.cash_amount)} · 💳 Tarjeta ${euro(x.card_amount)}${x.note?` · ${esc(x.note)}`:''}</div></div><div class="sales-entry-total">${euro(x.total_amount)}</div></div><div class="sales-entry-actions"><button type="button" class="secondary" data-sales-edit="${esc(x.sale_date)}">✏️ Editar</button><button type="button" class="secondary danger" data-sales-delete="${esc(x.id)}">🗑 Borrar</button></div></div>`).join(''):'<div class="sales-empty">Todavía no hay facturación guardada en este mes.</div>';
  return `<div class="card"><h3 class="account-title">📊 Facturación acumulada</h3><div class="sales-periods">${dsPeriodBox('Hoy',p.today)}${dsPeriodBox('Esta semana',p.week)}${dsPeriodBox('Este mes',p.month)}${dsPeriodBox('Este año',p.year)}</div></div><div class="card"><div class="field"><label>Mes a consultar</label><input id="salesMonth" type="month" value="${esc(selectedMonth)}"></div><div class="sales-month-total"><div class="sales-month-stat"><span>Total</span><strong>${euro(mt.total)}</strong></div><div class="sales-month-stat"><span>Efectivo</span><strong>${euro(mt.cash)}</strong></div><div class="sales-month-stat"><span>Tarjeta</span><strong>${euro(mt.card)}</strong></div></div></div><div class="section-title">Facturación por día</div>${list}`
}
function salesSection(){return `<div id="salesSection" class="section-title">Facturación</div>${salesFormHtml()}${salesSummaryHtml()}`}

async function loadDailySales(){
  if(!session){dailySales=[];return}
  try{const r=await api('/rest/v1/daily_sales?select=*&order=sale_date.desc&limit=1500');dailySales=Array.isArray(r)?r:[]}catch(e){console.error('Daily sales',e?.message||'unknown');dailySales=[]}
}
function dsRecalc(){const c=dsNum(document.getElementById('salesCash')?.value),v=dsNum(document.getElementById('salesCard')?.value),el=document.getElementById('salesCalculatedTotal');if(el)el.textContent=euro(Math.max(0,c||0)+Math.max(0,v||0))}
function dsLoadDate(date){
  const row=dailySales.find(x=>x.sale_date===date),cash=document.getElementById('salesCash'),card=document.getElementById('salesCard'),note=document.getElementById('salesNote'),flag=document.getElementById('salesExisting'),btn=document.getElementById('salesSave');
  if(row){if(cash)cash.value=Number(row.cash_amount)||0;if(card)card.value=Number(row.card_amount)||0;if(note)note.value=row.note||'';flag?.classList.add('show');if(btn)btn.textContent='Actualizar facturación del día'}
  else{if(cash)cash.value='';if(card)card.value='';if(note)note.value='';flag?.classList.remove('show');if(btn)btn.textContent='Guardar facturación del día'}
  dsRecalc()
}
async function dsSave(){
  const date=document.getElementById('salesDate')?.value,cash=dsNum(document.getElementById('salesCash')?.value),card=dsNum(document.getElementById('salesCard')?.value),note=String(document.getElementById('salesNote')?.value||'').trim()||null;
  if(!date){toast('Selecciona la fecha.');return}
  if(date>localDate()){toast('No puedes registrar una fecha futura.');return}
  if(typeof window.isAccountingMonthLocked==='function'&&window.isAccountingMonthLocked(date.slice(0,7))){toast(`🔒 ${monthLabel(date.slice(0,7))} está cerrado. Reábrelo antes de guardar.`);return}
  if(cash===null||cash<0||card===null||card<0){toast('Revisa los importes de efectivo y tarjeta.');return}
  const total=(cash||0)+(card||0);if(total<=0){toast('El total del día debe ser mayor que cero.');return}
  try{
    setBusy(true);
    await api('/rest/v1/rpc/upsert_daily_sale',{method:'POST',body:{p_sale_date:date,p_cash_amount:cash||0,p_card_amount:card||0,p_note:note}});
    selectedMonth=date.slice(0,7);toast(`Facturación guardada · ${euro(total)}`);await loadData();route='more';renderApp();setTimeout(()=>document.getElementById('salesSection')?.scrollIntoView({behavior:'smooth',block:'start'}),50)
  }catch(e){const m=String(e?.message||'');toast(/MONTH_LOCKED/i.test(m)?'🔒 Ese mes está cerrado. Reábrelo antes de guardar.':'No se pudo guardar: '+(m||'error'))}finally{setBusy(false)}
}
async function dsDelete(id){
  const row=dailySales.find(x=>x.id===id);if(!row)return;
  const m=String(row.sale_date).slice(0,7);if(typeof window.isAccountingMonthLocked==='function'&&window.isAccountingMonthLocked(m)){toast(`🔒 ${monthLabel(m)} está cerrado. Reábrelo antes de borrar.`);return}
  if(!confirm(`¿Borrar la facturación del ${fmtDate(row.sale_date)} por ${euro(row.total_amount)}?`))return;
  try{setBusy(true);await api('/rest/v1/rpc/delete_daily_sale',{method:'POST',body:{p_id:id}});toast('Facturación del día borrada');await loadData();route='more';renderApp();setTimeout(()=>document.getElementById('salesSection')?.scrollIntoView({behavior:'smooth',block:'start'}),40)}catch(e){const m=String(e?.message||'');toast(/MONTH_LOCKED/i.test(m)?'🔒 Ese mes está cerrado. Reábrelo antes de borrar.':'No se pudo borrar: '+(m||'error'))}finally{setBusy(false)}
}
function dsEdit(date){route='more';renderApp();setTimeout(()=>{document.getElementById('salesSection')?.scrollIntoView({behavior:'smooth',block:'start'});const d=document.getElementById('salesDate');if(d){d.value=date;dsLoadDate(date);setTimeout(()=>document.getElementById('salesCash')?.focus(),250)}},40)}

const previousMoreSales=moreView;
moreView=function(){return previousMoreSales()+salesSection()};
const previousDashboardSales=dashboard;
dashboard=function(){const html=previousDashboardSales();const marker='<div class="section-title">Control del mes</div>';return html.includes(marker)?html.replace(marker,salesQuickCard()+marker):html+salesQuickCard()};
const previousLoadDataSales=loadData;
loadData=async function(){const r=await previousLoadDataSales.apply(this,arguments);await loadDailySales();if(session)renderApp();return r};
const previousBindSales=bind;
bind=function(){
  previousBindSales();dsAddStyles();
  document.getElementById('salesQuickOpen')?.addEventListener('click',()=>{route='more';renderApp();setTimeout(()=>document.getElementById('salesSection')?.scrollIntoView({behavior:'smooth',block:'start'}),40)});
  document.getElementById('salesCash')?.addEventListener('input',dsRecalc);document.getElementById('salesCard')?.addEventListener('input',dsRecalc);
  document.getElementById('salesDate')?.addEventListener('change',e=>dsLoadDate(e.target.value));document.getElementById('salesSave')?.addEventListener('click',dsSave);
  document.getElementById('salesMonth')?.addEventListener('change',e=>{if(e.target.value){selectedMonth=e.target.value;renderApp();setTimeout(()=>document.getElementById('salesSection')?.scrollIntoView({behavior:'smooth',block:'start'}),30)}});
  document.querySelectorAll('[data-sales-edit]').forEach(b=>b.addEventListener('click',()=>dsEdit(b.dataset.salesEdit)));
  document.querySelectorAll('[data-sales-delete]').forEach(b=>b.addEventListener('click',()=>dsDelete(b.dataset.salesDelete)));
  const d=document.getElementById('salesDate');if(d)dsLoadDate(d.value)
};

dsAddStyles();loadDailySales().then(()=>{if(session)renderApp()});
})();
