(()=>{
function mceMonth(date){return String(date||'').slice(0,7)}
function mceLock(){return (window.accountingMonthLocks||[]).find(x=>mceMonth(x.month)===selectedMonth)||null}
function mceCsv(v){return `"${String(v??'').replace(/"/g,'""')}"`}
function mceMoney(v){const n=Number(v);return Number.isFinite(n)?n.toFixed(2).replace('.',','):''}
function mceDateTime(v){try{return new Intl.DateTimeFormat('es-ES',{dateStyle:'short',timeStyle:'short'}).format(new Date(v))}catch{return String(v||'')}}
function exportMonthClose(){
  const lock=mceLock();if(!lock){toast('Este mes no tiene un cierre activo.');return}
  const s=lock.summary||{},rows=[
    ['Periodo',monthLabel(selectedMonth)],['Cerrado el',mceDateTime(lock.locked_at)],
    ['Documentos del mes',s.document_count??''],['Compras contabilizadas',s.accounting_count??''],['Facturas',s.invoice_count??''],['Tickets',s.ticket_count??''],['Proveedores',s.supplier_count??''],
    ['Compras netas',mceMoney(s.purchases_total??s.net_total)],['Base facturas',mceMoney(s.invoice_base)],['IVA facturas',mceMoney(s.invoice_vat)],
    ['Ingresos',mceMoney(s.sales_total)],['Personal',mceMoney(s.personal_total)],['Otros gastos operativos',mceMoney(s.operating_expense_total)],['Impuestos pagados',mceMoney(s.tax_cash_total)],['Carga mensual de impuestos',mceMoney(s.tax_load_total)],['Inversiones',mceMoney(s.investment_total)],
    ['Resultado estimado',mceMoney(s.result_estimate)],['Salida de caja',mceMoney(s.cash_out_total)]
  ];
  const content='\ufeff'+['Concepto;Valor',...rows.map(r=>r.map(mceCsv).join(';'))].join('\r\n'),blob=new Blob([content],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=`la-pizarrita-cierre-${selectedMonth}.csv`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);toast(`Cierre de ${monthLabel(selectedMonth)} exportado`);
}
function mceDecorate(){
  const card=document.querySelector('.month-lock-card.closed');if(!card||document.getElementById('exportMonthClose'))return;
  const btn=document.createElement('button');btn.type='button';btn.id='exportMonthClose';btn.className='secondary month-lock-btn';btn.textContent='⬇ Exportar cierre para gestor';
  const reopen=document.getElementById('reopenAccountingMonth');if(reopen)reopen.insertAdjacentElement('beforebegin',btn);else card.appendChild(btn);btn.addEventListener('click',exportMonthClose);
}
const mcePreviousBind=bind;
bind=function(){mcePreviousBind();mceDecorate()};
if(session)renderApp();
})();
