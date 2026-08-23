(()=>{
const manualDocumentLinks=new Set();

function isExplicitReferenceCandidate(input){
  const meta=input?.closest('.doc-candidate')?.querySelector('.doc-candidate-meta')?.textContent||'';
  return meta.includes('referencia encontrada en la factura');
}
function rememberManualLinkChanges(){
  document.querySelectorAll('[data-doc-link]').forEach(input=>{
    if(input.dataset.safeLinkBound==='1')return;
    input.dataset.safeLinkBound='1';
    input.addEventListener('change',e=>{
      if(!e.isTrusted)return;
      if(input.checked)manualDocumentLinks.add(input.value);
      else manualDocumentLinks.delete(input.value);
    });
  });
}
function removeUnsafeAutomaticLinks(){
  rememberManualLinkChanges();
  document.querySelectorAll('[data-doc-link]:checked').forEach(input=>{
    if(isExplicitReferenceCandidate(input)||manualDocumentLinks.has(input.value))return;
    input.checked=false;
    input.dispatchEvent(new Event('change',{bubbles:true}));
  });
}

const previousAfterDocumentRead=window.afterDocumentRead;
window.afterDocumentRead=async function(){
  manualDocumentLinks.clear();
  const r=typeof previousAfterDocumentRead==='function'?await previousAfterDocumentRead.apply(this,arguments):undefined;
  removeUnsafeAutomaticLinks();
  return r;
};
const previousAfterDocumentSaved=window.afterDocumentSaved;
window.afterDocumentSaved=async function(){
  const r=typeof previousAfterDocumentSaved==='function'?await previousAfterDocumentSaved.apply(this,arguments):{linkedCount:0};
  manualDocumentLinks.clear();
  return r;
};

const previousBindLinkSafety=bind;
bind=function(){
  previousBindLinkSafety();
  rememberManualLinkChanges();
  removeUnsafeAutomaticLinks();
  ['invSupplier','invTotal','invDate','invNumber'].forEach(id=>document.getElementById(id)?.addEventListener('input',()=>setTimeout(()=>{rememberManualLinkChanges();removeUnsafeAutomaticLinks()},0)));
  document.getElementById('invDocType')?.addEventListener('change',()=>manualDocumentLinks.clear());
};

if(session)renderApp();
})();
