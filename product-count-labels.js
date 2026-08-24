(()=>{
function plural(n,sing,plur){return `${n} ${Math.abs(n-1)<1e-9?sing:plur}`}
function clarifyCounts(root=document){
  root.querySelectorAll?.('.ai-items-preview .ai-items-title').forEach(el=>{
    const m=el.textContent.match(/(\d+)\s+productos?\s+detectados?/i);
    if(m){const n=Number(m[1]);el.textContent=`🧾 ${plural(n,'referencia detectada','referencias detectadas')}`}
  });
  root.querySelectorAll?.('.invoice-items-detail').forEach(box=>{
    const rows=[...box.querySelectorAll('.saved-item')];
    if(!rows.length)return;
    const title=box.querySelector('.invoice-items-detail-title');
    if(title)title.textContent=`🧾 ${plural(rows.length,'referencia','referencias')}`;
  });
}
let queued=false;
function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;clarifyCounts()})}
new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
document.addEventListener('click',schedule,true);
clarifyCounts();
})();
