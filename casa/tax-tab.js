(()=>{
function showTaxes(){
  const main=document.querySelector('main');
  if(!main)return;
  document.querySelectorAll('nav button').forEach(b=>b.style.color='');
  const tab=document.getElementById('taxNav');
  if(tab)tab.style.color='#62e1c7';
  main.innerHTML='<h2>Impuestos</h2><section class="card"></section>';
}
function ensureTaxTab(){
  const nav=document.querySelector('nav');
  if(!nav)return;
  if(!document.getElementById('taxGridStyle')){
    const style=document.createElement('style');
    style.id='taxGridStyle';
    style.textContent='nav{grid-template-columns:repeat(7,1fr)!important}';
    document.head.appendChild(style);
  }
  if(document.getElementById('taxNav'))return;
  const b=document.createElement('button');
  b.id='taxNav';
  b.type='button';
  b.textContent='Impuestos';
  b.addEventListener('click',showTaxes);
  const more=[...nav.querySelectorAll('button')].find(x=>x.textContent.trim()==='Más');
  nav.insertBefore(b,more||null);
}
let queued=false;
const observer=new MutationObserver(()=>{
  if(queued)return;
  queued=true;
  requestAnimationFrame(()=>{queued=false;ensureTaxTab()});
});
observer.observe(document.documentElement,{childList:true,subtree:true});
ensureTaxTab();
})();