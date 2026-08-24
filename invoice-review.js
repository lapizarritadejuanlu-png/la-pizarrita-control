(()=>{
let openInvoiceItemsId=null;

function addInvoiceReviewStyles(){
  if(document.getElementById('invoiceReviewStyle'))return;
  const s=document.createElement('style');
  s.id='invoiceReviewStyle';
  s.textContent=`
  .invoice-ai-badge{display:inline-flex;align-items:center;margin-top:7px;border:1px solid #3b5145;border-radius:999px;padding:4px 8px;font-size:.7rem;font-weight:900;color:#8ed4a6;background:#132019}
  .invoice-items-detail{margin:-2px 0 10px;padding:14px;border:1px solid #34362f;border-radius:14px;background:#11120f}
  .invoice-items-detail-head{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:8px}.invoice-items-detail-title{font-weight:900;font-size:.9rem}.invoice-items-detail-summary{font-size:.76rem;color:var(--muted);white-space:nowrap}
  .saved-item{display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-top:1px solid #2a2c27}.saved-item:first-of-type{border-top:0}.saved-item-main{min-width:0}.saved-item-name{font-size:.84rem;font-weight:800}.saved-item-meta{font-size:.74rem;color:var(--muted);margin-top:3px}.saved-item-total{font-size:.82rem;font-weight:900;white-space:nowrap}
  .invoice-items-empty{font-size:.82rem;color:var(--muted);line-height:1.4}.reanalyze-btn{width:100%;margin-top:12px;padding:11px 12px!important}
  `;
  document.head.appendChild(s);
}
function detailPrice(n){const x=Number(n);if(!Number.isFinite(x))return'';return x.toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:4})+' €'}
function detailBoxes(n){const x=Number(n);if(!Number.isFinite(x))return'';return `${x} ${Math.abs(x-1)<1e-9?'caja':'cajas'}`}
function itemMeta(x){const a=[];if(x.box_count!==null&&x.box_count!==undefined)a.push(detailBoxes(x.box_count));if(x.quantity!==null&&x.quantity!==undefined)a.push(`${x.quantity}${x.unit?' '+esc(x.unit):''}`);if(x.unit_price!==null&&x.unit_price!==undefined)a.push(`${detailPrice(x.unit_price)} / ${esc(x.unit||'unidad')}`);return a.join(' · ')}
function findInvoiceRow(button){return button?.closest('.invoice-row')||null}
function reviewNum(v){if(v===null||v===undefined||v==='')return null;const n=Number(String(v).replace(',','.'));return Number.isFinite(n)?n:null}
function reviewItems(raw){return(Array.isArray(raw)?raw:[]).slice(0,100).map(x=>({description:String(x?.description||'').trim().slice(0,300),box_count:reviewNum(x?.box_count),quantity:reviewNum(x?.quantity),unit:x?.unit?String(x.unit).trim().slice(0,40):null,unit_price:reviewNum(x?.unit_price),line_total:reviewNum(x?.line_total)})).filter(x=>x.description)}
function blobDataUrl(blob){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result||''));r.onerror=()=>reject(new Error('No se pudo preparar el archivo'));r.readAsDataURL(blob)})}
async function storedInvoiceBlob(path){
  const enc=path.split('/').map(encodeURIComponent).join('/');
  const getFile=()=>fetch(`${SB_URL}/storage/v1/object/authenticated/invoice-files/${enc}`,{headers:{apikey:SB_KEY,Authorization:`Bearer ${session.access_token}`}});
  let res=await getFile();if(res.status===401&&await refreshSession())res=await getFile();if(!res.ok)throw new Error('No se pudo leer el archivo guardado.');return res.blob();
}
async function analyzeStoredInvoice(id,box){
  const inv=invoices.find(x=>x.id===id);if(!inv?.file_path){toast('Este documento no tiene archivo guardado.');return}
  try{
    setBusy(true);box.innerHTML='<div class="invoice-items-detail-title">🤖 Analizando el archivo guardado…</div><div class="invoice-items-empty">La IA está leyendo las líneas de producto. No cierres la app.</div>';
    const blob=await storedInvoiceBlob(inv.file_path),dataUrl=await blobDataUrl(blob);if(dataUrl.length>5_500_000)throw new Error('El archivo es demasiado grande para analizarlo con IA.');
    const res=await fetch('/api/invoice-ai',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({dataUrl,name:(inv.file_path.split('/').pop()||'documento'),type:blob.type||'application/pdf'})});
    const data=await res.json();if(!res.ok)throw new Error(data.error||'No se pudo analizar el documento');
    const items=reviewItems(data?.invoice?.items);
    await api(`/rest/v1/invoice_items?invoice_id=eq.${encodeURIComponent(id)}`,{method:'DELETE'}).catch(()=>{});
    await api(`/rest/v1/products?source_invoice_id=eq.${encodeURIComponent(id)}`,{method:'DELETE'}).catch(()=>{});
    const lines=items.map(x=>({user_id:session.user.id,invoice_id:id,description:x.description,box_count:x.box_count,quantity:x.quantity,unit:x.unit,unit_price:x.unit_price,line_total:x.line_total}));
    if(lines.length)await api('/rest/v1/invoice_items',{method:'POST',headers:{Prefer:'return=minimal'},body:lines});
    const savePrices=(inv.document_type||'invoice')!=='delivery_note'&&inv.document_status!=='linked';
    const prices=savePrices?items.filter(x=>x.unit_price!==null&&Number.isFinite(Number(x.unit_price))&&Number(x.unit_price)>0).map(x=>({user_id:session.user.id,name:x.description,supplier:inv.supplier,price_date:inv.invoice_date,price:Number(x.unit_price),unit:x.unit||'sin especificar',net_cost:null,source_invoice_id:id})):[];
    if(prices.length)await api('/rest/v1/products',{method:'POST',headers:{Prefer:'return=minimal'},body:prices});
    await api(`/rest/v1/invoices?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:{extraction_status:'reviewed',extraction_json:{items}}});
    const suffix=savePrices?`${prices.length} precios guardados`:'sin precios definitivos';
    toast(items.length?`IA terminada · ${items.length} referencias · ${suffix}`:'IA terminada · no encontró líneas claras');
    openInvoiceItemsId=null;await loadData();
  }catch(e){box.innerHTML=`<div class="invoice-items-detail-title">🧾 Productos de este documento</div><div class="invoice-items-empty">${esc(e.message||'No se pudo analizar el archivo.')}</div><button type="button" class="secondary reanalyze-btn" data-analyze-saved="${esc(id)}">🤖 Intentar de nuevo</button>`;box.querySelector('[data-analyze-saved]')?.addEventListener('click',()=>analyzeStoredInvoice(id,box));toast(e.message||'No se pudo analizar')}finally{setBusy(false)}
}
async function toggleSavedItems(id,button){
  const row=findInvoiceRow(button);if(!row)return;
  const next=row.nextElementSibling;
  if(next?.classList?.contains('invoice-items-detail')){next.remove();openInvoiceItemsId=null;return}
  document.querySelectorAll('.invoice-items-detail').forEach(x=>x.remove());
  openInvoiceItemsId=id;
  const box=document.createElement('div');box.className='invoice-items-detail';box.innerHTML='<div class="invoice-items-empty">Cargando productos guardados…</div>';row.insertAdjacentElement('afterend',box);
  try{
    const items=await api(`/rest/v1/invoice_items?invoice_id=eq.${encodeURIComponent(id)}&select=*&order=created_at.asc`);
    if(openInvoiceItemsId!==id)return;
    const rows=Array.isArray(items)?items:[];
    if(!rows.length){const inv=invoices.find(x=>x.id===id);box.innerHTML=`<div class="invoice-items-detail-title">🧾 Productos de este documento</div><div class="invoice-items-empty">No hay líneas de producto guardadas en este documento. El archivo original y los importes de cabecera siguen guardados.</div>${inv?.file_path?`<button type="button" class="primary reanalyze-btn" data-analyze-saved="${esc(id)}">🤖 Analizar productos con IA</button>`:''}`;box.querySelector('[data-analyze-saved]')?.addEventListener('click',()=>analyzeStoredInvoice(id,box));return}
    const sum=rows.reduce((a,x)=>a+(Number(x.line_total)||0),0),withPrice=rows.filter(x=>x.unit_price!==null&&x.unit_price!==undefined).length;
    box.innerHTML=`<div class="invoice-items-detail-head"><div class="invoice-items-detail-title">🧾 ${rows.length} referencia${rows.length===1?'':'s'}</div><div class="invoice-items-detail-summary">${withPrice} con precio · ${euro(sum)}</div></div>${rows.map(x=>`<div class="saved-item"><div class="saved-item-main"><div class="saved-item-name">${esc(x.description||'Sin descripción')}</div>${itemMeta(x)?`<div class="saved-item-meta">${itemMeta(x)}</div>`:''}</div><div class="saved-item-total">${x.line_total!==null&&x.line_total!==undefined?euro(x.line_total):''}</div></div>`).join('')}`;
  }catch(e){box.innerHTML=`<div class="invoice-items-empty">No se pudieron cargar los productos: ${esc(e.message||'error')}</div>`}
}

const previousInvoiceRow=invoiceRow;
invoiceRow=function(x,actions=false){
  let html=previousInvoiceRow(x,actions);
  if(!actions)return html;
  const count=Array.isArray(x?.extraction_json?.items)?x.extraction_json.items.length:null;
  const badge=x?.extraction_status==='reviewed'?`<div class="invoice-ai-badge">✓ IA revisada${count!==null?` · ${count} referencia${count===1?'':'s'}`:''}</div>`:'';
  if(badge)html=html.replace('<div class="invoice-actions">',badge+'<div class="invoice-actions">');
  html=html.replace('<div class="invoice-actions">',`<div class="invoice-actions"><button type="button" class="secondary invoice-products" data-invoice-products="${esc(x.id)}">🧾 Productos</button>`);
  return html;
};

const previousBind=bind;
bind=function(){
  previousBind();addInvoiceReviewStyles();
  document.querySelectorAll('[data-invoice-products]').forEach(b=>b.addEventListener('click',()=>toggleSavedItems(b.dataset.invoiceProducts,b)));
};

addInvoiceReviewStyles();
if(session)renderApp();
})();
