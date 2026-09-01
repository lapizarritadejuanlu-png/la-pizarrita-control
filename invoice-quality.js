(()=>{
let qualityAdjusting=false;

function addQualityStyles(){
  if(document.getElementById('invoiceQualityStyle'))return;
  const s=document.createElement('style');
  s.id='invoiceQualityStyle';
  s.textContent=`
  .invoice-quality{margin-top:10px;padding:11px 12px;border-radius:12px;font-size:.79rem;line-height:1.4;font-weight:750}
  .invoice-quality.ok{border:1px solid #365b45;background:#122019;color:#8ed4a6}
  .invoice-quality.warn{border:1px solid #6b5631;background:#211b10;color:#e5c374}
  .invoice-quality.neutral{border:1px solid #3b3d37;background:#151613;color:#aaa69e}
  .quality-override{margin-top:9px;width:100%;padding:9px 10px!important}
  `;
  document.head.appendChild(s);
}
function qnum(raw){
  if(raw===null||raw===undefined)return null;
  let s=String(raw).trim();if(!s)return null;
  s=s.replace(/[^0-9,.-]/g,'');
  if(s.includes(',')&&s.includes('.'))s=s.replace(/\./g,'').replace(',','.');
  else if(s.includes(','))s=s.replace(',','.');
  const n=Number(s);return Number.isFinite(n)?n:null;
}
function qualityState(){
  const preview=document.getElementById('aiItemsPreview');
  if(!preview||preview.style.display==='none')return null;
  const docType=document.getElementById('invDocType')?.value||'invoice';
  const base=qnum(document.getElementById('invBase')?.value);
  const total=qnum(document.getElementById('invTotal')?.value);
  const vals=[...preview.querySelectorAll('.ai-item-total')].map(x=>qnum(x.textContent)).filter(x=>x!==null);
  const toggle=document.getElementById('toggleDetectedItems');
  const savingProducts=toggle?toggle.textContent.trim().startsWith('No guardar'):true;
  const override=preview.dataset.qualityOverride==='1';
  if(!vals.length)return{preview,docType,target:null,targetLabel:null,vals,sum:null,diff:null,ok:null,savingProducts,override};

  const sum=vals.reduce((a,b)=>a+b,0);
  const candidates=[];
  if(docType==='delivery_note'){
    if(total!==null)candidates.push({value:total,label:'total'});
    else if(base!==null)candidates.push({value:base,label:'base'});
  }else{
    if(base!==null)candidates.push({value:base,label:'base'});
    if(total!==null)candidates.push({value:total,label:'total'});
  }
  if(!candidates.length)return{preview,docType,target:null,targetLabel:null,vals,sum,diff:null,ok:null,savingProducts,override};

  const preferredLabel=(docType==='ticket'||docType==='delivery_note')?'total':'base';
  candidates.sort((a,b)=>{
    const da=Math.abs(sum-a.value),db=Math.abs(sum-b.value);
    if(Math.abs(da-db)>0.000001)return da-db;
    if(a.label===preferredLabel&&b.label!==preferredLabel)return-1;
    if(b.label===preferredLabel&&a.label!==preferredLabel)return 1;
    return 0;
  });
  const target=candidates[0].value,targetLabel=candidates[0].label;
  const diff=Math.abs(sum-target),tol=Math.max(.05,Math.abs(target)*.01);
  return{preview,docType,target,targetLabel,vals,sum,diff,ok:diff<=tol,tol,savingProducts,override};
}
function renderQuality(){
  addQualityStyles();
  const st=qualityState();if(!st)return;
  st.preview.querySelector('.invoice-quality')?.remove();
  const box=document.createElement('div');box.className='invoice-quality';
  const label=st.targetLabel==='total'?'total':'base';
  if(st.docType==='delivery_note'){
    box.classList.add(st.ok===true?'ok':'neutral');
    if(st.ok===null)box.textContent='ℹ️ Albarán: se guardarán las líneas como referencia, pero no pasarán a Productos como precio definitivo hasta que llegue la factura.';
    else if(st.ok)box.textContent=`✓ Albarán: las líneas cuadran con el ${label} (${euro(st.sum)}). Se guardarán como referencia pendiente de factura.`;
    else box.textContent=`ℹ️ Albarán: las líneas suman ${euro(st.sum)} y el ${label} indica ${euro(st.target)}. Puedes guardarlo: quedará pendiente de factura y estos precios no serán definitivos.`;
  }
  else if(st.ok===null){box.classList.add('neutral');box.textContent='ℹ️ No se puede comprobar el cuadre porque falta el importe de referencia o el total de las líneas.'}
  else if(st.ok){box.classList.add('ok');box.textContent=`✓ Productos cuadran con el ${label}: ${euro(st.sum)}`}
  else if(!st.savingProducts){box.classList.add('neutral');box.textContent=`ℹ️ Productos: ${euro(st.sum)} · ${label[0].toUpperCase()+label.slice(1)}: ${euro(st.target)}. Has elegido no guardar los productos.`}
  else if(st.override){box.classList.add('warn');box.innerHTML=`⚠ Diferencia aceptada manualmente · Productos ${euro(st.sum)} · ${label[0].toUpperCase()+label.slice(1)} ${euro(st.target)} · Diferencia ${euro(st.diff)}.`}
  else{
    box.classList.add('warn');
    box.innerHTML=`⚠ Revisar antes de guardar: los productos suman <strong>${euro(st.sum)}</strong> y el ${label} es <strong>${euro(st.target)}</strong>. Diferencia: <strong>${euro(st.diff)}</strong>.<button type="button" class="secondary quality-override">Guardar precios igualmente</button>`;
    box.querySelector('.quality-override')?.addEventListener('click',()=>{st.preview.dataset.qualityOverride='1';renderQuality();toast('Diferencia aceptada. Revisa los importes antes de guardar.')});
  }
  st.preview.appendChild(box);
}
function scheduleQuality(){if(qualityAdjusting)return;qualityAdjusting=true;setTimeout(()=>{qualityAdjusting=false;renderQuality()},0)}

addQualityStyles();
const previousReadInvoiceAI=readInvoiceAI;
readInvoiceAI=async function(){
  const result=await previousReadInvoiceAI.apply(this,arguments);
  const p=document.getElementById('aiItemsPreview');if(p)delete p.dataset.qualityOverride;
  scheduleQuality();return result;
};
const previousSaveInvoiceQuality=saveInvoice;
saveInvoice=async function(){
  const st=qualityState();
  if(st&&st.docType!=='delivery_note'&&st.ok===false&&st.savingProducts&&!st.override){
    renderQuality();
    st.preview.scrollIntoView({behavior:'smooth',block:'center'});
    toast('Revisa el cuadre de productos antes de guardar.');
    return;
  }
  return previousSaveInvoiceQuality.apply(this,arguments);
};
const previousBindQuality=bind;
bind=function(){
  previousBindQuality();addQualityStyles();scheduleQuality();
  document.getElementById('invBase')?.addEventListener('input',scheduleQuality);
  document.getElementById('invTotal')?.addEventListener('input',scheduleQuality);
  document.getElementById('invDocType')?.addEventListener('change',scheduleQuality);
  document.getElementById('aiItemsPreview')?.addEventListener('click',e=>{if(e.target.closest('[data-remove-item]')||e.target.closest('#toggleDetectedItems'))scheduleQuality()});
};
if(session)renderApp();
})();