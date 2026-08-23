(()=>{
function aesCounts(x){return typeof window.isAccountingDocument==='function'?window.isAccountingDocument(x):((x?.document_type||'invoice')!=='delivery_note'&&x?.document_status!=='linked')}
function aesCell(v){const s=String(v??'');return /[;"\n\r]/.test(s)?`"${s.replace(/"/g,'""')}"`:s}
function aesMoney(v){if(v===null||v===undefined||v==='')return'';const n=Number(v);return Number.isFinite(n)?n.toFixed(2).replace('.',','):''}
function aesType(x){return (x?.document_type||'invoice')==='ticket'?'Ticket':'Factura'}
function aesDownload(){
  const rows=(Array.isArray(invoices)?invoices:[]).filter(x=>!x.deleted_at&&aesCounts(x)).sort((a,b)=>String(b.invoice_date||'').localeCompare(String(a.invoice_date||'')));
  if(!rows.length){toast('No hay compras contabilizadas para exportar.');return}
  const lines=[['Fecha','Tipo','Proveedor','Nº documento','Base','IVA','Total'],...rows.map(x=>[x.invoice_date||'',aesType(x),x.supplier||'',x.invoice_number||'',aesMoney(x.base_amount),aesMoney(x.vat_amount),aesMoney(x.total)])].map(r=>r.map(aesCell).join(';'));
  const blob=new Blob(['\ufeff'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`compras-contabilizadas-la-pizarrita-${localDate()}.csv`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);toast(`${rows.length} compra${rows.length===1?'':'s'} contabilizada${rows.length===1?'':'s'} exportada${rows.length===1?'':'s'}`)
}
function aesDecorate(){const b=document.getElementById('exportInvoices');if(b){b.textContent='⬇️ Exportar compras contabilizadas';b.title='Excluye albaranes pendientes y documentos sustituidos'}}
document.addEventListener('click',e=>{const b=e.target?.closest?.('#exportInvoices');if(!b)return;e.preventDefault();e.stopImmediatePropagation();aesDownload()},true);
const prevBindAES=bind;bind=function(){prevBindAES();aesDecorate()};if(session)renderApp();
})();
