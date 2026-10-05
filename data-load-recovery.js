(()=>{
  if(window.__coreDataRecovery)return;
  window.__coreDataRecovery=true;
  let flight=null;

  async function recoverCoreData({silent=true}={}){
    if(flight)return flight;
    if(!session?.access_token)return false;
    flight=(async()=>{
      const beforeInv=Array.isArray(invoices)?invoices.length:0;
      try{
        const [ri,rp,rm]=await Promise.allSettled([
          api('/rest/v1/invoices?select=*&order=invoice_date.desc'),
          api('/rest/v1/products?select=*&order=price_date.desc'),
          api('/rest/v1/moves?select=*&order=move_date.desc')
        ]);
        let changed=false;
        if(ri.status==='fulfilled'&&Array.isArray(ri.value)){
          const active=ri.value.filter(x=>!x?.deleted_at);
          if(active.length||!beforeInv){invoices=active;changed=true}
        }
        if(rp.status==='fulfilled'&&Array.isArray(rp.value)){products=rp.value;changed=true}
        if(rm.status==='fulfilled'&&Array.isArray(rm.value)){moves=rm.value;changed=true}
        if(changed&&session)renderApp();
        if(!silent&&beforeInv===0&&Array.isArray(invoices)&&invoices.length){
          toast('Historial recuperado de la nube');
        }
        return changed;
      }catch(e){
        console.warn('Core data recovery',e?.message||'unknown');
        return false;
      }finally{flight=null}
    })();
    return flight;
  }

  const previousLoadData=loadData;
  loadData=async function(){
    const result=await previousLoadData.apply(this,arguments);
    // Si una petición secundaria falla, el Promise.all antiguo podía dejar
    // la pantalla en 0 aunque las facturas siguieran en Supabase.
    if(session&&(!Array.isArray(invoices)||invoices.length===0)){
      await recoverCoreData({silent:false});
    }
    return result;
  };

  // Recuperación adicional para sesiones que se renuevan mientras arranca la app.
  const check=()=>{if(session&&Array.isArray(invoices)&&invoices.length===0)recoverCoreData({silent:false})};
  setTimeout(check,700);
  setTimeout(check,1800);
  setTimeout(check,4000);
  window.recoverPizarritaData=()=>recoverCoreData({silent:false});
})();