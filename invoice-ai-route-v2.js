(()=>{
  if(window.__pizarritaAiV2Fetch)return;
  window.__pizarritaAiV2Fetch=true;
  const nativeFetch=window.fetch.bind(window);
  window.fetch=function(input,init){
    if(typeof input==='string'&&input==='/api/invoice-ai') input='/api/invoice-ai-v3';
    else if(input instanceof Request){
      try{
        const u=new URL(input.url,location.href);
        if(u.pathname==='/api/invoice-ai') input=new Request('/api/invoice-ai-v3',input);
      }catch{}
    }
    return nativeFetch(input,init);
  };
})();
