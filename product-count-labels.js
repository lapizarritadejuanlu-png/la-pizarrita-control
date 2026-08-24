(()=>{
function qtyFromMeta(text=''){
  const m=String(text).trim().match(/^(-?\d+(?:[.,]\d+)?)/);
  if(!m)return null;
  const n=Number(m[1].replace(',','.'));
  return Number.isFinite(n)?n:null;
}
function plural(n,sing,plur){return `${n} ${Math.abs(n-1)<1e-9?sing:plur}`}
function clarifyCounts(root=document){
  root.querySelectorAll?.('.ai-items-preview .ai-items-title').forEach(el=>{
    const m=el.textContent.match(/(\d+)\s+productos?\s+detectados?/i);
    if(m){const n=Number(m[1]);el.textContent=`🧾 ${plural(n,'referencia detectada','referencias detectadas')}`}
  });
  root.querySelectorAll?.('.invoice-items-detail').forEach(box=>{
    const rows=[...box.querySelectorAll('.saved-item')];
    if(!rows.length)return;
    const refs=rows.length;
    let units=0,known=0;
    rows.forEach(row=>{const q=qtyFromMeta(row.querySelector('.saved-item-meta')?.textContent||'');if(q!==null){units+=q;known++}});
    const title=box.querySelector('.invoice-items-detail-title');
    if(title){
      const unitText=known===refs?` · ${plural(units,'unidad','unidades')}`:'';
      title.textContent=`🧾 ${plural(refs,'referencia','referencias')}${unitText}`;
    }
  });
}
let queued=false;
function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;clarifyCounts()})}
new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
document.addEventListener('click',schedule,true);
clarifyCounts();
})();
