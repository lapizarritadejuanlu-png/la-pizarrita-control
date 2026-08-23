(()=>{
let installPrompt=null;
function standalone(){return window.matchMedia?.('(display-mode: standalone)').matches||window.navigator.standalone===true}
function setupHead(){
  if(!document.querySelector('link[rel="manifest"]')){const l=document.createElement('link');l.rel='manifest';l.href='/manifest.webmanifest';document.head.appendChild(l)}
  const metas=[['apple-mobile-web-app-capable','yes'],['apple-mobile-web-app-status-bar-style','black-translucent'],['apple-mobile-web-app-title','La Pizarrita']];
  for(const [name,content] of metas){if(!document.querySelector(`meta[name="${name}"]`)){const m=document.createElement('meta');m.name=name;m.content=content;document.head.appendChild(m)}}
  if(!document.querySelector('link[rel="icon"]')){const i=document.createElement('link');i.rel='icon';i.href='/app-icon.svg';i.type='image/svg+xml';document.head.appendChild(i)}
  if(!document.querySelector('link[rel="apple-touch-icon"]')){const i=document.createElement('link');i.rel='apple-touch-icon';i.href='/app-icon.svg';document.head.appendChild(i)}
}
function addPwaStyles(){
  if(document.getElementById('pwaStyle'))return;
  const s=document.createElement('style');s.id='pwaStyle';s.textContent=`.install-card{border-color:#465e50}.install-title{font-weight:900;font-size:1.05rem;margin-bottom:6px}.install-text{color:var(--muted);font-size:.86rem;line-height:1.4;margin:0 0 12px}.install-btn{width:100%}.installed-pill{display:inline-flex;align-items:center;gap:7px;border:1px solid #365b43;border-radius:999px;padding:8px 11px;color:#7bd79a;font-size:.82rem;font-weight:900}`;document.head.appendChild(s);
}
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e});
window.addEventListener('appinstalled',()=>{installPrompt=null;toast?.('La Pizarrita instalada');if(session)renderApp()});
setupHead();addPwaStyles();
if('serviceWorker' in navigator)navigator.serviceWorker.register('/service-worker.js').catch(()=>{});

const oldMoreView=moreView;
moreView=function(){
  const base=oldMoreView();
  const installed=standalone();
  return base+`<div class="section-title">Aplicación</div><div class="card install-card"><div class="install-title">📱 La Pizarrita en tu móvil</div>${installed?`<p class="install-text">La estás usando ya como aplicación independiente.</p><span class="installed-pill">✓ Ya instalada</span>`:`<p class="install-text">Añádela a la pantalla de inicio para abrirla como una aplicación independiente, sin tener que buscarla en el navegador.</p><button id="installPizarrita" class="primary install-btn">Instalar aplicación</button>`}</div>`;
};
const oldBind=bind;
bind=function(){
  oldBind();
  document.getElementById('installPizarrita')?.addEventListener('click',async()=>{
    if(installPrompt){installPrompt.prompt();const choice=await installPrompt.userChoice;installPrompt=null;if(choice?.outcome==='accepted')toast('Instalando La Pizarrita…');return}
    toast('En Chrome: menú ⋮ → Añadir a pantalla de inicio');
  });
};
if(session)renderApp();
})();
