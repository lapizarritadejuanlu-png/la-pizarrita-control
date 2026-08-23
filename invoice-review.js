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
  .invoice-items-empty{font-size:.82rem;color:var(--muted);line-height:1.4}
  `;
  document.head.appendChild(s);
}
function itemMeta(x){const a=[];if(x.quantity!==null&&x.quantity!==undefined)a.push(`${x.quantity}${x.unit?' '+esc(x.unit):''}`);if(x.unit_price!==null&&x.unit_price!==undefined)a.push(`${euro(x.unit_price)} / ${esc(x.unit||'unidad')}`);return a.join(' · ')}
function findInvoiceRow(button){return button?.closest('.invoice-row')||null}
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
    if(!rows.length){box.innerHTML='<div class="invoice-items-detail-title">🧾 Productos de esta factura</div><div class="invoice-items-empty">No hay líneas de producto guardadas en esta factura. El archivo original y los importes de cabecera siguen guardados.</div>';return}
    const sum=rows.reduce((a,x)=>a+(Number(x.line_total)||0),0),withPrice=rows.filter(x=>x.unit_price!==null&&x.unit_price!==undefined).length;
    box.innerHTML=`<div class="invoice-items-detail-head"><div class="invoice-items-detail-title">🧾 ${rows.length} producto${rows.length===1?'':'s'}</div><div class="invoice-items-detail-summary">${withPrice} con precio · ${euro(sum)}</div></div>${rows.map(x=>`<div class="saved-item"><div class="saved-item-main"><div class="saved-item-name">${esc(x.description||'Sin descripción')}</div>${itemMeta(x)?`<div class="saved-item-meta">${itemMeta(x)}</div>`:''}</div><div class="saved-item-total">${x.line_total!==null&&x.line_total!==undefined?euro(x.line_total):''}</div></div>`).join('')}`;
  }catch(e){box.innerHTML=`<div class="invoice-items-empty">No se pudieron cargar los productos: ${esc(e.message||'error')}</div>`}
}

const previousInvoiceRow=invoiceRow;
invoiceRow=function(x,actions=false){
  let html=previousInvoiceRow(x,actions);
  if(!actions)return html;
  const count=Array.isArray(x?.extraction_json?.items)?x.extraction_json.items.length:null;
  const badge=x?.extraction_status==='reviewed'?`<div class="invoice-ai-badge">✓ IA revisada${count!==null?` · ${count} línea${count===1?'':'s'}`:''}</div>`:'';
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
