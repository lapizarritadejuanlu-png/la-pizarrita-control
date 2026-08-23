(()=>{
let payrollDraft=null,payrollDraftFile=null,payrollRunsCache=[],openPayrollRunId=null;

function addPersonnelStyles(){
  if(document.getElementById('personnelToolsStyle'))return;
  const s=document.createElement('style');s.id='personnelToolsStyle';s.textContent=`
  .personnel-note{color:var(--muted);font-size:.86rem;line-height:1.45;margin:0 0 12px}
  .payroll-filebox{display:flex;gap:10px;align-items:center}.payroll-filebox input{min-width:0}
  .payroll-preview{margin-top:14px}.payroll-preview:empty{display:none}
  .payroll-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:12px}.payroll-title{font-weight:900}.payroll-cost{font-size:1.15rem;font-weight:950;color:var(--mint);white-space:nowrap}
  .payroll-metrics{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:10px 0 12px}.payroll-metric{padding:10px;border:1px solid #30322d;border-radius:11px;background:#11120f}.payroll-metric span{display:block;color:var(--muted);font-size:.72rem}.payroll-metric strong{font-size:.93rem}
  .payroll-worker{display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-top:1px solid #2c2e29}.payroll-worker-name{font-size:.84rem;font-weight:850}.payroll-worker-meta{font-size:.73rem;color:var(--muted);margin-top:3px}.payroll-worker-cost{text-align:right;font-size:.82rem;font-weight:900;white-space:nowrap}
  .payroll-check{margin-top:10px;padding:10px 12px;border-radius:11px;font-size:.78rem;font-weight:800}.payroll-check.ok{border:1px solid #365b45;background:#122019;color:#8ed4a6}.payroll-check.warn{border:1px solid #6b5631;background:#211b10;color:#e5c374}
  .payroll-history{display:flex;flex-direction:column;gap:10px}.payroll-run{border:1px solid var(--line);border-radius:15px;background:#151613;padding:14px 16px}.payroll-run-top{display:flex;justify-content:space-between;gap:12px}.payroll-run-title{font-weight:900}.payroll-run-meta{font-size:.78rem;color:var(--muted);margin-top:4px}.payroll-run-cost{font-weight:950;white-space:nowrap}.payroll-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:9px}.payroll-actions button{padding:7px 10px;font-size:.76rem}
  .payroll-detail{margin-top:10px;padding-top:4px;border-top:1px solid #2c2e29}.payroll-empty{color:var(--muted);font-size:.84rem;line-height:1.4}
  @media(max-width:390px){.payroll-head,.payroll-run-top{gap:8px}.payroll-cost{font-size:1rem}.payroll-metrics{grid-template-columns:1fr 1fr}.payroll-filebox{display:block}.payroll-filebox button{width:100%;margin-top:10px}}
  `;document.head.appendChild(s);
}
function payrollNum(v){const n=Number(v);return Number.isFinite(n)?n:null}
function payrollDataUrl(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result||''));r.onerror=()=>reject(new Error('No se pudo preparar el PDF'));r.readAsDataURL(file)})}
function payrollMonthLabel(start){return start?monthLabel(String(start).slice(0,7)):'Mes sin identificar'}
function payrollSection(){return `<div class="section-title">Personal</div><div class="card"><h3 class="account-title">👥 Nóminas del gestor</h3><p class="personnel-note">Sube el resumen mensual de nóminas. La IA leerá cada trabajador y el coste total de empresa. Nada se guarda hasta que pulses Guardar.</p><div class="payroll-filebox"><input id="payrollFile" type="file" accept="application/pdf,image/*"><button id="payrollRead" type="button" class="secondary">🤖 Leer nóminas con IA</button></div><div id="payrollPreview" class="payroll-preview"></div></div><div class="section-title">Historial de personal</div><div id="payrollHistory"><div class="payroll-empty">Cargando meses guardados…</div></div>`}

const previousMorePersonnel=moreView;
moreView=function(){return previousMorePersonnel()+payrollSection()};

function renderPayrollPreview(){
  const el=document.getElementById('payrollPreview');if(!el)return;
  if(!payrollDraft){el.innerHTML='';return}
  const p=payrollDraft,workers=Array.isArray(p.workers)?p.workers:[],sum=workers.reduce((a,w)=>a+(Number(w.cost_total)||0),0),total=Number(p.cost_total)||0,diff=Math.abs(sum-total),ok=workers.length>0&&diff<=Math.max(.05,Math.abs(total)*.005);
  const rows=workers.map(w=>`<div class="payroll-worker"><div><div class="payroll-worker-name">${esc(w.name||'Sin nombre')}</div><div class="payroll-worker-meta">${w.code?`#${esc(w.code)} · `:''}Neto ${w.net_total!==null&&w.net_total!==undefined?euro(w.net_total):'—'}${w.rlc!==null&&w.rlc!==undefined?` · RLC ${euro(w.rlc)}`:''}</div></div><div class="payroll-worker-cost">${euro(w.cost_total)}</div></div>`).join('');
  el.innerHTML=`<div class="payroll-head"><div><div class="payroll-title">${esc(payrollMonthLabel(p.period_start))}</div><div class="row-meta">${p.period_start?fmtDate(p.period_start):''}${p.period_end?` → ${fmtDate(p.period_end)}`:''} · ${workers.length} trabajador${workers.length===1?'':'es'}</div></div><div class="payroll-cost">${euro(total)}</div></div><div class="payroll-metrics"><div class="payroll-metric"><span>Bruto</span><strong>${p.gross_total!==null&&p.gross_total!==undefined?euro(p.gross_total):'—'}</strong></div><div class="payroll-metric"><span>Neto</span><strong>${p.net_total!==null&&p.net_total!==undefined?euro(p.net_total):'—'}</strong></div><div class="payroll-metric"><span>RLC</span><strong>${p.rlc_total!==null&&p.rlc_total!==undefined?euro(p.rlc_total):'—'}</strong></div><div class="payroll-metric"><span>Coste empresa</span><strong>${euro(total)}</strong></div></div>${rows}<div class="payroll-check ${ok?'ok':'warn'}">${ok?`✓ Los costes de los trabajadores cuadran: ${euro(sum)}`:`⚠ Trabajadores ${euro(sum)} · Total empresa ${euro(total)} · Diferencia ${euro(diff)}. Revísalo antes de guardar.`}</div><button id="payrollSave" type="button" class="primary wide">Guardar personal del mes</button>`;
  document.getElementById('payrollSave')?.addEventListener('click',savePayroll);
}
async function readPayrollAI(){
  const file=document.getElementById('payrollFile')?.files?.[0];if(!file){toast('Selecciona el PDF de nóminas.');return}
  try{
    setBusy(true);payrollDraft=null;payrollDraftFile=null;const out=document.getElementById('payrollPreview');if(out)out.innerHTML='<div class="payroll-empty">🤖 Leyendo el resumen del gestor…</div>';
    const dataUrl=await payrollDataUrl(file);if(dataUrl.length>7_000_000)throw new Error('El archivo es demasiado grande para leerlo con IA.');
    const res=await fetch('/api/payroll-ai',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({dataUrl,name:file.name,type:file.type||'application/pdf'})});
    const data=await res.json();if(!res.ok)throw new Error(data.error||'No se pudo leer el resumen de nóminas');
    const p=data.payroll||{};if(!p.period_start||!p.period_end||payrollNum(p.cost_total)===null)throw new Error('La IA no ha podido identificar con seguridad el periodo y el coste total.');
    payrollDraft={...p,workers:Array.isArray(p.workers)?p.workers:[]};payrollDraftFile=file;renderPayrollPreview();toast(`Nóminas leídas · ${payrollDraft.workers.length} trabajadores`);
  }catch(e){payrollDraft=null;payrollDraftFile=null;const out=document.getElementById('payrollPreview');if(out)out.innerHTML=`<div class="payroll-check warn">${esc(e.message||'No se pudo leer el archivo.')}</div>`;toast(e.message||'No se pudo leer el archivo')}finally{setBusy(false)}
}
async function uploadPayrollFile(file){
  const safe=(file.name||'nominas.pdf').replace(/[^a-zA-Z0-9._-]+/g,'_');const path=`${session.user.id}/payroll/${Date.now()}-${safe}`;
  const res=await fetch(`${SB_URL}/storage/v1/object/invoice-files/${path.split('/').map(encodeURIComponent).join('/')}`,{method:'POST',headers:{apikey:SB_KEY,Authorization:`Bearer ${session.access_token}`,'Content-Type':file.type||'application/pdf','x-upsert':'false'},body:file});
  if(!res.ok){let d={};try{d=await res.json()}catch{}throw new Error(d.message||d.error||'No se pudo subir el PDF de nóminas')}return path;
}
async function syncPayrollMove(runId,p){
  const month=String(p.period_start).slice(0,7),concept=`Nóminas gestor ${month}`,date=p.period_start,amount=Number(p.cost_total)||0,notes=`Generado desde resumen de nóminas · ${p.worker_count||p.workers?.length||0} trabajadores · payroll_run:${runId}`;
  const existing=await api(`/rest/v1/moves?move_type=eq.personal&concept=eq.${encodeURIComponent(concept)}&select=*&order=created_at.asc`);
  if(Array.isArray(existing)&&existing.length){
    await api(`/rest/v1/moves?id=eq.${encodeURIComponent(existing[0].id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:{move_date:date,amount,notes}});
    for(const dup of existing.slice(1))await api(`/rest/v1/moves?id=eq.${encodeURIComponent(dup.id)}`,{method:'DELETE'}).catch(()=>{});
  }else await api('/rest/v1/moves',{method:'POST',headers:{Prefer:'return=minimal'},body:{user_id:session.user.id,move_type:'personal',move_date:date,concept,amount,notes}});
}
async function savePayroll(){
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
    const body={user_id:session.user.id,period_start:p.period_start,period_end:p.period_end,listed_at:p.listed_at||null,worker_count:p.worker_count||workers.length,gross_total:payrollNum(p.gross_total),net_total:payrollNum(p.net_total),rlc_total:payrollNum(p.rlc_total),cost_total:total,file_path:newPath,extraction_status:'reviewed',extraction_json:{workers},updated_at:new Date().toISOString()};
    let runId;
    if(old){
      const updated=await api(`/rest/v1/payroll_runs?id=eq.${encodeURIComponent(old.id)}`,{method:'PATCH',headers:{Prefer:'return=representation'},body});runId=Array.isArray(updated)?updated[0]?.id:updated?.id||old.id;
      await api(`/rest/v1/payroll_items?payroll_run_id=eq.${encodeURIComponent(old.id)}`,{method:'DELETE'});
      if(old.file_path&&old.file_path!==newPath)await deleteStorageFile(old.file_path).catch(()=>{});
    }else{
      const created=await api('/rest/v1/payroll_runs',{method:'POST',headers:{Prefer:'return=representation'},body});runId=Array.isArray(created)?created[0]?.id:created?.id;
    }
    if(!runId)throw new Error('No se pudo confirmar el mes de personal guardado');
    const itemRows=workers.map(w=>({user_id:session.user.id,payroll_run_id:runId,worker_code:w.code||null,worker_name:w.name,base_cc:payrollNum(w.base_cc),base_irpf:payrollNum(w.base_irpf),gross_total:payrollNum(w.gross_total),ss_worker:payrollNum(w.ss_worker),irpf:payrollNum(w.irpf),net_total:payrollNum(w.net_total),rlc:payrollNum(w.rlc),bonus_fc:payrollNum(w.bonus_fc),cost_total:Number(w.cost_total),raw_data:w}));
    await api('/rest/v1/payroll_items',{method:'POST',headers:{Prefer:'return=minimal'},body:itemRows});
    await syncPayrollMove(runId,p);
    payrollDraft=null;payrollDraftFile=null;selectedMonth=String(p.period_start).slice(0,7);toast(`Personal guardado · ${euro(total)}`);await loadData();
  }catch(e){if(newPath)await deleteStorageFile(newPath).catch(()=>{});toast('No se pudo guardar personal: '+(e.message||'error'))}finally{setBusy(false)}
}
async function loadPayrollHistory(){
  const box=document.getElementById('payrollHistory');if(!box)return;
  try{
    const runs=await api('/rest/v1/payroll_runs?select=*&order=period_start.desc&limit=24');payrollRunsCache=Array.isArray(runs)?runs:[];
    if(!payrollRunsCache.length){box.innerHTML='<div class="payroll-empty">Todavía no hay meses de personal guardados.</div>';return}
    box.innerHTML=`<div class="payroll-history">${payrollRunsCache.map(r=>`<div class="payroll-run" data-payroll-run="${esc(r.id)}"><div class="payroll-run-top"><div><div class="payroll-run-title">${esc(payrollMonthLabel(r.period_start))}</div><div class="payroll-run-meta">${r.worker_count||0} trabajador${Number(r.worker_count)===1?'':'es'} · Neto ${r.net_total!==null&&r.net_total!==undefined?euro(r.net_total):'—'} · RLC ${r.rlc_total!==null&&r.rlc_total!==undefined?euro(r.rlc_total):'—'}</div></div><div class="payroll-run-cost">${euro(r.cost_total)}</div></div><div class="payroll-actions"><button type="button" class="secondary payroll-workers" data-payroll-workers="${esc(r.id)}">👥 Ver trabajadores</button>${r.file_path?`<button type="button" class="secondary payroll-pdf" data-payroll-file="${esc(r.file_path)}">📎 Ver PDF</button>`:''}</div></div>`).join('')}</div>`;
    box.querySelectorAll('[data-payroll-workers]').forEach(b=>b.addEventListener('click',()=>togglePayrollWorkers(b.dataset.payrollWorkers,b)));
    box.querySelectorAll('[data-payroll-file]').forEach(b=>b.addEventListener('click',()=>openInvoiceFile(b.dataset.payrollFile)));
  }catch(e){box.innerHTML=`<div class="payroll-empty">No se pudo cargar el historial: ${esc(e.message||'error')}</div>`}
}
async function togglePayrollWorkers(id,button){
  const run=button.closest('.payroll-run');if(!run)return;const old=run.querySelector('.payroll-detail');if(old){old.remove();openPayrollRunId=null;return}
  document.querySelectorAll('.payroll-detail').forEach(x=>x.remove());openPayrollRunId=id;const detail=document.createElement('div');detail.className='payroll-detail';detail.innerHTML='<div class="payroll-empty">Cargando trabajadores…</div>';run.appendChild(detail);
  try{
    const rows=await api(`/rest/v1/payroll_items?payroll_run_id=eq.${encodeURIComponent(id)}&select=*&order=worker_name.asc`);if(openPayrollRunId!==id)return;const items=Array.isArray(rows)?rows:[];
    detail.innerHTML=items.length?items.map(w=>`<div class="payroll-worker"><div><div class="payroll-worker-name">${esc(w.worker_name)}</div><div class="payroll-worker-meta">${w.worker_code?`#${esc(w.worker_code)} · `:''}Neto ${w.net_total!==null&&w.net_total!==undefined?euro(w.net_total):'—'}${w.rlc!==null&&w.rlc!==undefined?` · RLC ${euro(w.rlc)}`:''}</div></div><div class="payroll-worker-cost">${euro(w.cost_total)}</div></div>`).join(''):'<div class="payroll-empty">No hay trabajadores guardados para este mes.</div>';
  }catch(e){detail.innerHTML=`<div class="payroll-empty">No se pudieron cargar los trabajadores: ${esc(e.message||'error')}</div>`}
}

const previousBindPersonnel=bind;
bind=function(){
  previousBindPersonnel();addPersonnelStyles();
  document.getElementById('payrollRead')?.addEventListener('click',readPayrollAI);
  document.getElementById('payrollFile')?.addEventListener('change',()=>{payrollDraft=null;payrollDraftFile=null;renderPayrollPreview()});
  if(route==='more')loadPayrollHistory();
};
addPersonnelStyles();
if(session)renderApp();
})();
