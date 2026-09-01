(()=>{
function goProviders(){
  if(typeof route!=='undefined')route='providers';
  if(typeof renderApp==='function')renderApp();
  window.scrollTo(0,0);
}
function ensureProviderTab(){
  const nav=document.querySelector('.bottom-nav');
  if(!nav)return;
  let btn=nav.querySelector('[data-route="providers"]');
  if(btn){
    btn.textContent='Proveedores';
    return;
  }
  btn=document.createElement('button');
  btn.type='button';
  btn.className='nav';
  btn.dataset.route='providers';
  btn.textContent='Proveedores';
  btn.addEventListener('click',goProviders);
  const more=nav.querySelector('[data-route="more"]');
  if(more)nav.insertBefore(btn,more);else nav.appendChild(btn);
  nav.style.gridTemplateColumns='repeat(5,1fr)';
}
let queued=false;
const observer=new MutationObserver(()=>{
  if(queued)return;
  queued=true;
  requestAnimationFrame(()=>{queued=false;ensureProviderTab()});
});
observer.observe(document.documentElement,{childList:true,subtree:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensureProviderTab,{once:true});
ensureProviderTab();
})();