(()=>{
const VALUE='proveedores';
const LABEL='📦 Proveedores';

function labelProviderText(){
  document.querySelectorAll('.expense-entry-meta,.expense-cat-row span').forEach(el=>{
    if(!el?.textContent)return;
    if(el.textContent.includes('proveedores'))el.textContent=el.textContent.replace(/proveedores/g,LABEL);
  });
}

function ensureProviderCategory(){
  document.querySelectorAll('select#expenseCategory').forEach(select=>{
    let option=[...select.options].find(o=>o.value===VALUE);
    if(!option){
      option=document.createElement('option');
      option.value=VALUE;
      option.textContent=LABEL;
      select.insertBefore(option,select.firstChild);
    }
    if(!select.dataset.providerDefaulted){
      select.value=VALUE;
      select.dataset.providerDefaulted='1';
    }
  });
  labelProviderText();
}

let queued=false;
const observer=new MutationObserver(()=>{
  if(queued)return;
  queued=true;
  requestAnimationFrame(()=>{queued=false;ensureProviderCategory()});
});
observer.observe(document.documentElement,{childList:true,subtree:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensureProviderCategory,{once:true});
ensureProviderCategory();
})();
