(()=>{
const EXTRA=['Alquiler','Hipoteca','Luz','Agua','Gas','Internet/Teléfono','Comunidad'];
let pendingCategory='';
const openProducts=()=>document.querySelectorAll('details.products').forEach(d=>{d.open=true});
function enhanceCategories(){
  document.querySelectorAll('select#cat,select#rCat').forEach(s=>{
    const current=s.value;
    const existing=new Set([...s.options].map(o=>o.value));
    const ref=[...s.options].find(o=>o.value==='Supermercado')||null;
    for(const name of EXTRA){
      if(existing.has(name))continue;
      const o=document.createElement('option');
      o.value=name;o.textContent=name;
      s.insertBefore(o,ref);
    }
    if(pendingCategory&&EXTRA.includes(pendingCategory)&&s.id==='cat'){
      s.value=pendingCategory;
      pendingCategory='';
    }else if([...s.options].some(o=>o.value===current))s.value=current;
  });
}
function run(){openProducts();enhanceCategories()}
document.addEventListener('click',e=>{
  const b=e.target.closest?.('[data-edit]');
  if(!b)return;
  const small=b.closest('.row')?.querySelector('small');
  const cat=(small?.textContent||'').split('·')[0].trim();
  if(EXTRA.includes(cat))pendingCategory=cat;
},true);
const observer=new MutationObserver(run);
observer.observe(document.documentElement,{childList:true,subtree:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run);else run();
})();