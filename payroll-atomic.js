(()=>{
const previousSavePayrollAtomic=savePayroll;
savePayroll=async function(){
  const p=payrollDraft,file=payrollDraftFile;if(!p||!file)return;
  const workers=Array.isArray(p.workers)?p.workers:[],sum=workers.reduce((a,w)=>a+(Number(w.cost_total)||0),0),total=Number(p.cost_total)||0,diff=Math.abs(sum-total),tol=Math.max(.05,Math.abs(total)*.005);
  if(!workers.length){toast('No hay trabajadores para guardar.');return}
  if(diff>tol&&!confirm(`Los trabajadores suman ${euro(sum)} y el total empresa es ${euro(total)}. ¿Guardar igualmente?`))return;
  if(workers.some(w=>!w.name||payrollNum(w.cost_total)===null||Number(w.cost_total)<0)){toast('Hay un trabajador con coste no válido. Revísalo.');return}
  let newPath=null;
  try{
    setBusy(true);
    const found=await api(`/rest/v1/payroll_runs?period_start=eq.${encodeURIComponent(p.period_start)}&period_end=eq.${encodeURIComponent(p.period_end)}&select=*`),old=Array.isArray(found)?found[0]:null;
    newPath=await uploadPayrollFile(file);
    await api('/rest/v1/rpc/save_payroll_run_atomic',{method:'POST',body:{
      p_period_start:p.period_start,
      p_period_end:p.period_end,
      p_listed_at:p.listed_at||null,
      p_gross_total:payrollNum(p.gross_total),
      p_net_total:payrollNum(p.net_total),
      p_rlc_total:payrollNum(p.rlc_total),
      p_cost_total:total,
      p_file_path:newPath,
      p_workers:workers
    }});
    if(old?.file_path&&old.file_path!==newPath)await deleteStorageFile(old.file_path).catch(()=>{});
    payrollDraft=null;payrollDraftFile=null;selectedMonth=String(p.period_start).slice(0,7);
    toast(`Personal guardado · ${euro(total)}`);await loadData();
  }catch(e){
    if(newPath)await deleteStorageFile(newPath).catch(()=>{});
    const m=String(e?.message||'error');
    if(/MONTH_LOCKED/i.test(m))toast('🔒 Ese mes está cerrado. Reábrelo para modificar personal.');
    else if(/PAYROLL_NO_WORKERS/i.test(m))toast('No hay trabajadores para guardar.');
    else if(/PAYROLL_INVALID_WORKER/i.test(m))toast('Hay un trabajador con datos no válidos.');
    else toast('No se pudo guardar personal: '+m.replace(/^P\d+:\s*/,''));
  }finally{setBusy(false)}
};
})();
