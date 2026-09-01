(()=>{
function showTaxes(){
  const main=document.querySelector('main');
  if(!main)return;
  document.querySelectorAll('nav button').forEach(b=>b.style.color='');
  const tab=document.getElementById('taxNav');
  if(tab)tab.style.color='#62e1c7';
  main.innerHTML='<h2>Impuestos</h2><section class="card"></section>';
  window.scrollTo(0,0);
}
function ensureTaxTab(){
  const nav=document.querySelector('nav');
  if(!nav)return false;
  if(!document.getElementById('taxGridStyle')){
    const style=document.createElement('style');
    style.id='taxGridStyle';
    style.textContent='nav{grid-template-columns:repeat(7,1fr)!important}nav #taxNav{display:block!important;visibility:visible!important;opacity:1!important}@media(max-width:390px){nav button{font-size:.68rem!important}}';
    document.head.appendChild(style);
  }
  let b=document.getElementById('taxNav');
  if(!b){
    b=document.createElement('button');
    b.id='taxNav';
    b.type='button';
    b.textContent='Impuestos';
    b.addEventListener('click',showTaxes);
  }
  const more=[...nav.querySelectorAll('button')].find(x=>x.textContent.trim()==='Más');
  if(b.parentElement!==nav || (more&&b.nextElementSibling!==more))nav.insertBefore(b,more||null);
  return true;
}
let queued=false;
const observer=new MutationObserver(()=>{
  if(queued)return;
  queued=true;
  requestAnimationFrame(()=>{queued=false;ensureTaxTab()});
});
observer.observe(document.documentElement,{childList:true,subtree:true});
let attempts=0;
const timer=setInterval(()=>{ensureTaxTab();attempts++;if(attempts>=120)clearInterval(timer)},250);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensureTaxTab,{once:true});
ensureTaxTab();
})();
