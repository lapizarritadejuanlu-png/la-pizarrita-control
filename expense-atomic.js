(()=>{
let expenseAtomicBusy=false;
function expenseAtomicNum(value){const n=Number(String(value??'').trim().replace(',','.'));return Number.isFinite(n)?n:null}
async function saveExpenseAtomicFromForm(){
  if(expenseAtomicBusy)return;
  const category=v('expenseCategory'),date=v('expenseDate'),concept=v('expenseConcept'),amount=expenseAtomicNum(v('expenseAmount')),kind=v('expenseKind'),recurrence=v('expenseRecurrence'),owner=v('expenseOwner')||null;let period=v('expensePeriod')||null;
  if(!date||!concept||amount===null||amount<=0){toast('Completa fecha, concepto e importe.');return}
  if(kind==='tax'&&!period&&typeof quarterLabel==='function')period=quarterLabel(date);
  const file=document.getElementById('expenseFile')?.files?.[0]||null;let filePath=null;
  try{
    expenseAtomicBusy=true;setBusy(true);
    if(file)filePath=await uploadExpenseFile(file);
    await api('/rest/v1/rpc/save_expense_atomic',{method:'POST',body:{
      p_category:category||'otros',p_move_date:date,p_concept:concept,p_amount:amount,
      p_expense_kind:kind||'operating',p_recurrence:recurrence||'oneoff',
      p_owner_label:owner,p_period_label:period,p_file_path:filePath
    }});
    selectedMonth=date.slice(0,7);
    toast(recurrence==='oneoff'?'Gasto guardado':'Gasto guardado y programado');
    await loadData();
  }catch(e){
    if(filePath)await deleteStorageFile(filePath).catch(()=>{});
    const m=String(e?.message||'error');
    if(/MONTH_LOCKED/i.test(m))toast('🔒 Ese mes está cerrado. Reábrelo antes de guardar el gasto.');
    else toast('No se pudo guardar: '+m);
  }finally{expenseAtomicBusy=false;setBusy(false)}
}
document.addEventListener('click',e=>{
  const b=e.target?.closest?.('#saveExpense');if(!b)return;
  e.preventDefault();e.stopImmediatePropagation();saveExpenseAtomicFromForm();
},true);
})();
