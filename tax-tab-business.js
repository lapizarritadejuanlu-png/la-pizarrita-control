(()=>{
function showTaxes(){
  const main=document.getElementById('main');
  if(!main)return;
  document.querySelectorAll('.bottom-nav .nav').forEach(b=>b.classList.remove('active'));
  const tab=document.getElementById('businessTaxNav');
  if(tab)tab.classList.add('active');
  main.innerHTML='<h2>Impuestos</h2><div class="card"></div>';
  window.scrollTo(0,0);
}
function ensureTaxTab(){
  const nav=document.querySelector('.bottom-nav');
  if(!nav)return;
  if(!document.getElementById('businessTaxGridStyle')){
    const style=document.createElement('style');
    style.id='businessTaxGridStyle';
    style.textContent='.bottom-nav{grid-template-columns:repeat(6,1fr)!important}@media(max-width:390px){.bottom-nav .nav{font-size:.69rem!important}}';
    document.head.appendChild(style);
  }
  if(document.getElementById('businessTaxNav'))return;
  const button=document.createElement('button');
  button.id='businessTaxNav';
  button.type='button';
  button.className='nav';
  button.textContent='Impuestos';
  button.addEventListener('click',showTaxes);
  const more=[...nav.querySelectorAll('.nav')].find(b=>b.textContent.trim()==='Más');
  nav.insertBefore(button,more||null);
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
