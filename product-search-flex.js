(()=>{
function productSearchNorm(value=''){
  return String(value)
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()
    .split(/\s+/).filter(Boolean).map(word=>{
      if(word.length>5&&word.endsWith('es')&&!/[aeiou]es$/.test(word))return word.slice(0,-2);
      if(word.length>4&&word.endsWith('s'))return word.slice(0,-1);
      return word;
    }).join(' ');
}
function applyFlexibleProductSearch(){
  const search=document.getElementById('productSearch');
  const rows=[...document.querySelectorAll('.product-smart-row')];
  if(!search||!rows.length)return;
  const q=productSearchNorm(search.value),trend=document.getElementById('productTrend')?.value||'all';
  let count=0,records=0;
  for(const row of rows){
    const haystack=productSearchNorm(row.dataset.search||'');
    const show=(!q||haystack.includes(q))&&(trend==='all'||row.dataset.trend===trend);
    row.style.display=show?'flex':'none';
    if(show){
      count++;
      const m=row.querySelector('.price-meta')?.textContent?.match(/·\s(\d+)\sregistro/);
      if(m)records+=Number(m[1])||0;
    }
  }
  const countEl=document.getElementById('productVisibleCount'),recordsEl=document.getElementById('productRecordCount'),empty=document.getElementById('productNoResults');
  if(countEl)countEl.textContent=`${count} producto${count===1?'':'s'}`;
  if(recordsEl)recordsEl.textContent=`${records} precio${records===1?'':'s'} guardado${records===1?'':'s'}`;
  if(empty)empty.style.display=count?'none':'block';
}
const previousBindFlexibleProductSearch=bind;
bind=function(){
  previousBindFlexibleProductSearch();
  document.getElementById('productSearch')?.addEventListener('input',applyFlexibleProductSearch);
  document.getElementById('productTrend')?.addEventListener('change',applyFlexibleProductSearch);
  applyFlexibleProductSearch();
};
if(session)renderApp();
})();
