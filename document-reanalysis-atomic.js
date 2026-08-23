(()=>{
function draNum(v){if(v===null||v===undefined||v==='')return null;const n=Number(String(v).replace(',','.'));return Number.isFinite(n)?n:null}
function draItems(raw){return (Array.isArray(raw)?raw:[]).slice(0,100).map(x=>({description:String(x?.description||'').trim().slice(0,300),quantity:draNum(x?.quantity),unit:x?.unit?String(x.unit).trim().slice(0,40):null,unit_price:draNum(x?.unit_price),line_total:draNum(x?.line_total)})).filter(x=>x.description)}
function draDataUrl(blob){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result||''));r.onerror=()=>reject(new Error('No se pudo preparar el archivo'));r.readAsDataURL(blob)})}
async function draStoredBlob(path){const enc=path.split('/').map(encodeURIComponent).join('/');const getFile=()=>fetch(`${SB_URL}/storage/v1/object/authenticated/invoice-files/${enc}`,{headers:{apikey:SB_KEY,Authorization:`Bearer ${session.access_token}`}});let res=await getFile();if(res.status===401&&await refreshSession())res=await getFile();if(!res.ok)throw new Error('No se pudo leer el archivo guardado.');return res.blob()}
async function draAnalyze(button){
  const id=button?.dataset?.analyzeSaved,inv=(Array.isArray(invoices)?invoices:[]).find(x=>x.id===id),box=button?.closest?.('.invoice-items-detail');
  if(!id||!inv?.file_path){toast('Este documento no tiene archivo guardado.');return}
  try{
    setBusy(true);if(box)box.innerHTML='<div class="invoice-items-detail-title">🤖 Analizando el archivo guardado…</div><div class="invoice-items-empty">La IA está leyendo las líneas de producto.</div>';
    const blob=await draStoredBlob(inv.file_path),dataUrl=await draDataUrl(blob);if(dataUrl.length>5_500_000)throw new Error('El archivo es demasiado grande para analizarlo con IA.');
    const res=await fetch('/api/invoice-ai',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({dataUrl,name:(inv.file_path.split('/').pop()||'documento'),type:blob.type||'application/pdf'})});
    const data=await res.json();if(!res.ok)throw new Error(data.error||'No se pudo analizar el documento');
    const items=draItems(data?.invoice?.items),detectedType=data?.invoice?.document_type||inv.document_type||'invoice',related=Array.isArray(data?.invoice?.related_document_numbers)?data.invoice.related_document_numbers:[];
    const out=await api('/rest/v1/rpc/reanalyze_document_atomic',{method:'POST',body:{p_document_id:id,p_items:items,p_detected_document_type:detectedType,p_related_document_numbers:related}});
    const prices=Number(out?.prices)||0,storedType=out?.document_type||inv.document_type||'invoice';
    const suffix=storedType==='delivery_note'||inv.document_status==='linked'?'sin precios definitivos':`${prices} precios guardados`;
    toast(items.length?`IA terminada · ${items.length} productos · ${suffix}`:'IA terminada · no encontró líneas claras');
    await loadData();
  }catch(e){
    const msg=String(e?.message||'No se pudo analizar el documento');
    if(box)box.innerHTML=`<div class="invoice-items-detail-title">🧾 Productos de este documento</div><div class="invoice-items-empty">${esc(msg)}</div><button type="button" class="secondary reanalyze-btn" data-analyze-saved="${esc(id)}">🤖 Intentar de nuevo</button>`;
    if(/MONTH_LOCKED/i.test(msg))toast('🔒 Ese mes está cerrado. Reábrelo antes de reanalizar.');else if(/DOCUMENT_NOT_FOUND/i.test(msg))toast('El documento ya no está disponible.');else toast(msg);
  }finally{setBusy(false)}
}
document.addEventListener('click',e=>{const b=e.target?.closest?.('[data-analyze-saved]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();draAnalyze(b)},true);
})();
