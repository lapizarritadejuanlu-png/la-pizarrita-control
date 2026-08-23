(()=>{
function addLineCheckStyles(){
  if(document.getElementById('invoiceLineCheckStyle'))return;
  const s=document.createElement('style');s.id='invoiceLineCheckStyle';s.textContent=`
  .ai-line-check{margin-top:7px;font-size:.74rem;line-height:1.35;font-weight:850;color:#ffb0a8}
  .ai-line-bad{border-color:#6b3935!important;background:#1b1211!important}
  .ai-line-summary{margin-top:10px;padding:10px 12px;border:1px solid #6b3935;border-radius:11px;background:#211311;color:#ffb0a8;font-size:.78rem;line-height:1.4;font-weight:800}
  `;document.head.appendChild(s);
}
function lineNum(raw){
  if(raw===null||raw===undefined)return null;
  let s=String(raw).trim().replace(/[^0-9,.-]/g,'');if(!s)return null;
  if(s.includes(',')&&s.includes('.'))s=s.replace(/\./g,'').replace(',','.');else if(s.includes(','))s=s.replace(',','.');
  const n=Number(s);return Number.isFinite(n)?n:null;
}
function inspectLine(card){
  const meta=card.querySelector('.ai-item-meta')?.textContent||'',total=lineNum(card.querySelector('.ai-item-total')?.textContent);
  const qtyMatch=meta.match(/^\s*(-?\d+(?:[.,]\d+)?)\s+[^·]+(?:·|$)/),priceMatch=meta.match(/·\s*(-?\d+(?:[.,]\d+)?)\s*€\s*\//);
  const qty=qtyMatch?lineNum(qtyMatch[1]):null,unitPrice=priceMatch?lineNum(priceMatch[1]):null;
  if(qty===null||unitPrice===null||total===null)return null;
  const expected=qty*unitPrice,diff=Math.abs(expected-total),tol=Math.max(.05,Math.abs(total)*.015);
  if(diff<=tol)return null;
  return{card,qty,unitPrice,total,expected,diff};
}
function lineProblems(){return [...document.querySelectorAll('#aiItemsPreview .ai-item')].map(inspectLine).filter(Boolean)}
function savingDetectedProducts(){const b=document.getElementById('toggleDetectedItems');return b?b.textContent.trim().startsWith('No guardar'):true}
function renderLineChecks(){
  addLineCheckStyles();const preview=document.getElementById('aiItemsPreview');if(!preview)return;
  preview.querySelectorAll('.ai-line-check').forEach(x=>x.remove());preview.querySelectorAll('.ai-item').forEach(x=>x.classList.remove('ai-line-bad'));preview.querySelector('.ai-line-summary')?.remove();
  const problems=lineProblems();
  for(const p of problems){p.card.classList.add('ai-line-bad');const el=document.createElement('div');el.className='ai-line-check';el.textContent=`⚠ Revisar: ${p.qty.toLocaleString('es-ES')} × ${euro(p.unitPrice)} = ${euro(p.expected)}, pero la línea suma ${euro(p.total)}.`;p.card.querySelector('.ai-item-main')?.appendChild(el)}
  if(problems.length&&savingDetectedProducts()){
    const box=document.createElement('div');box.className='ai-line-summary';box.textContent=`⚠ ${problems.length} línea${problems.length===1?'':'s'} con cantidad/precio incoherente${problems.length===1?'':'s'}. Corrígela, quítala o elige “No guardar productos” antes de guardar la factura.`;preview.appendChild(box);
  }
}
function scheduleLineChecks(){setTimeout(renderLineChecks,0)}
addLineCheckStyles();
const previousReadInvoiceAILineCheck=readInvoiceAI;
readInvoiceAI=async function(){const r=await previousReadInvoiceAILineCheck.apply(this,arguments);scheduleLineChecks();return r};
const previousSaveInvoiceLineCheck=saveInvoice;
saveInvoice=async function(){
  renderLineChecks();const problems=lineProblems();
  if(problems.length&&savingDetectedProducts()){
    problems[0].card.scrollIntoView({behavior:'smooth',block:'center'});toast('Hay líneas cuyo precio no cuadra con su cantidad. Revísalas antes de guardar productos.');return;
  }
  return previousSaveInvoiceLineCheck.apply(this,arguments);
};
const previousBindLineCheck=bind;
bind=function(){previousBindLineCheck();scheduleLineChecks();document.getElementById('aiItemsPreview')?.addEventListener('click',e=>{if(e.target.closest('[data-remove-item]')||e.target.closest('#toggleDetectedItems'))scheduleLineChecks()})};
if(session)renderApp();
})();
