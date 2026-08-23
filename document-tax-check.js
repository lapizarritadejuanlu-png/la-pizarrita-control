(()=>{
function dtcNum(v){if(v===null||v===undefined||v==='')return null;const n=Number(String(v).replace(',','.'));return Number.isFinite(n)?n:null}
function dtcType(x){return x?.document_type||'invoice'}
function dtcIssue(x){
  if(!x||dtcType(x)!=='invoice'||x.document_status==='linked'||x.deleted_at)return null;
  const base=dtcNum(x.base_amount),vat=dtcNum(x.vat_amount),total=dtcNum(x.total);if(base===null||vat===null||total===null)return null;
  const diff=Math.abs((base+vat)-total),tol=Math.max(.05,Math.abs(total)*.002);
  return diff>tol?{base,vat,total,diff}:null;
}
function dtcFormIssue(){
  if((document.getElementById('invDocType')?.value||'invoice')!=='invoice')return null;
  const base=dtcNum(document.getElementById('invBase')?.value),vat=dtcNum(document.getElementById('invVat')?.value),total=dtcNum(document.getElementById('invTotal')?.value);if(base===null||vat===null||total===null)return null;
  const diff=Math.abs((base+vat)-total),tol=Math.max(.05,Math.abs(total)*.002);return diff>tol?{base,vat,total,diff}:null;
}
function dtcStyles(){if(document.getElementById('documentTaxCheckStyle'))return;const s=document.createElement('style');s.id='documentTaxCheckStyle';s.textContent=`.doc-tax-warning{display:inline-flex;margin-top:6px;border:1px solid #6b5631;border-radius:999px;padding:3px 7px;font-size:.68rem;font-weight:900;color:#e5c374;background:#211b10}.form-tax-warning{margin-top:10px;padding:10px 12px;border:1px solid #6b5631;border-radius:11px;background:#211b10;color:#e5c374;font-size:.76rem;line-height:1.4}`;document.head.appendChild(s)}
function dtcDecorateRows(){
  const rows=[...document.querySelectorAll('.invoice-list .invoice-row')],all=Array.isArray(invoices)?invoices:[];let changed=false;
  rows.forEach((row,i)=>{const x=all[i];if(!x)return;row.querySelector('.doc-tax-warning')?.remove();const issue=dtcIssue(x);if(!issue)return;row.dataset.needsReview='1';row.dataset.taxWarning='1';const host=row.querySelector('.row-meta')?.parentElement;if(host){const el=document.createElement('div');el.className='doc-tax-warning';el.textContent=`⚠ Base + IVA difiere ${euro(issue.diff)}`;host.appendChild(el);changed=true}});
  if(changed&&typeof applyInvoiceFilters==='function')applyInvoiceFilters();
}
function dtcRenderForm(){
  document.getElementById('formTaxWarning')?.remove();const issue=dtcFormIssue();if(!issue)return;
  const hint=document.getElementById('aiHint')||document.getElementById('invTotal')?.closest('.field');if(!hint)return;const box=document.createElement('div');box.id='formTaxWarning';box.className='form-tax-warning';box.innerHTML=`⚠ Comprueba el total: base ${euro(issue.base)} + IVA ${euro(issue.vat)} = ${euro(issue.base+issue.vat)}, pero el total es ${euro(issue.total)}. Diferencia ${euro(issue.diff)}. Puedes guardar si la factura incluye otros conceptos o ajustes.`;hint.insertAdjacentElement('afterend',box);
}
function dtcBindInputs(){['invBase','invVat','invTotal','invDocType'].forEach(id=>document.getElementById(id)?.addEventListener('input',dtcRenderForm));document.getElementById('invDocType')?.addEventListener('change',dtcRenderForm)}
const dtcPreviousBind=bind;
bind=function(){dtcPreviousBind();dtcStyles();dtcDecorateRows();dtcRenderForm();dtcBindInputs()};
const dtcPreviousRead=readInvoiceAI;
readInvoiceAI=async function(){const r=await dtcPreviousRead.apply(this,arguments);dtcRenderForm();return r};
dtcStyles();if(session)renderApp();
})();
