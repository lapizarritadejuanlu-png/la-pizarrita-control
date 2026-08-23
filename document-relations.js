(()=>{
function addDocumentRelationStyles(){
  if(document.getElementById('documentRelationStyle'))return;
  const s=document.createElement('style');s.id='documentRelationStyle';s.textContent=`
  .doc-relation{margin-top:7px;font-size:.72rem;line-height:1.35;color:#b9b5ad}.doc-relation strong{color:#d9c47c}.doc-relation-target{color:#8ed4a6}
  `;document.head.appendChild(s);
}
function relationType(x){return x?.document_type||'invoice'}
function relationTypeLabel(x){return relationType(x)==='delivery_note'?'albarán':relationType(x)==='ticket'?'ticket':'factura'}
function relationRef(x){return x?.invoice_number?`${relationTypeLabel(x)} ${x.invoice_number}`:`${relationTypeLabel(x)} del ${fmtDate(x?.invoice_date)}`}
function relationHtml(x){
  if(x?.document_status==='linked'&&x?.linked_to_invoice_id){
    const target=(Array.isArray(invoices)?invoices:[]).find(y=>y.id===x.linked_to_invoice_id);
    if(target)return `<div class="doc-relation doc-relation-target">↳ Sustituido por <strong>factura ${esc(target.invoice_number||'sin nº')}</strong> · ${fmtDate(target.invoice_date)}</div>`;
  }
  if(relationType(x)==='invoice'){
    const prior=(Array.isArray(invoices)?invoices:[]).filter(y=>y.linked_to_invoice_id===x.id);
    if(prior.length){const refs=prior.slice(0,3).map(relationRef).join(' · '),more=prior.length>3?` · +${prior.length-3} más`:'';return `<div class="doc-relation">🔗 Sustituye <strong>${prior.length} documento${prior.length===1?'':'s'}</strong>: ${esc(refs)}${more}</div>`}
  }
  return '';
}
const previousInvoiceRowRelations=invoiceRow;
invoiceRow=function(x,actions=false){
  let html=previousInvoiceRowRelations(x,actions),relation=relationHtml(x);if(!relation)return html;
  return html.replace('<div class="invoice-actions">',relation+'<div class="invoice-actions">');
};
addDocumentRelationStyles();
if(session)renderApp();
})();
