(()=>{
function addDocumentExportStyles(){
  if(document.getElementById('documentExportStyle'))return;
  const s=document.createElement('style');s.id='documentExportStyle';s.textContent=`
  .document-export-btn{width:100%;margin-top:10px;padding:10px 12px!important;font-size:.82rem!important}
  `;document.head.appendChild(s);
}
function exportType(x){const t=x?.document_type||'invoice';return t==='ticket'?'Ticket':t==='delivery_note'?'Albarán':'Factura'}
function exportStatus(x){const s=x?.document_status||((x?.document_type||'invoice')==='delivery_note'?'pending':'final');return s==='linked'?'Sustituido / facturado':s==='pending'?'Pendiente':'Final'}
function csvValue(v){const s=String(v??'');return `"${s.replace(/"/g,'""')}"`}
function csvMoney(v){if(v===null||v===undefined||v==='')return'';const n=Number(v);return Number.isFinite(n)?n.toFixed(2).replace('.',','):''}
function visibleDocumentsForExport(){
  const rows=[...document.querySelectorAll('.invoice-list .invoice-row')],all=Array.isArray(invoices)?invoices:[];
  return rows.map((row,i)=>({row,x:all[i]})).filter(({row,x})=>x&&row.style.display!=='none').map(({x})=>x);
}
function exportDocumentsCsv(){
  const docs=visibleDocumentsForExport();if(!docs.length){toast('No hay documentos visibles para exportar.');return}
  const header=['Fecha','Tipo','Estado','Contabiliza','Proveedor','Nº documento','Base','IVA','Total'];
  const lines=[header.map(csvValue).join(';')];
  for(const x of docs){
    const counts=typeof window.isAccountingDocument==='function'?window.isAccountingDocument(x):((x.document_type||'invoice')!=='delivery_note'&&x.document_status!=='linked');
    lines.push([
      x.invoice_date||'',exportType(x),exportStatus(x),counts?'Sí':'No',x.supplier||'',x.invoice_number||'',csvMoney(x.base_amount),csvMoney(x.vat_amount),csvMoney(x.total)
    ].map(csvValue).join(';'));
  }
  const blob=new Blob(['\ufeff'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=`la-pizarrita-documentos-${localDate()}.csv`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
  toast(`${docs.length} documento${docs.length===1?'':'s'} exportado${docs.length===1?'':'s'} a CSV`);
}
function injectDocumentExport(){
  if(route!=='invoices')return;addDocumentExportStyles();
  const tools=document.querySelector('.invoice-tools');if(!tools||document.getElementById('exportDocumentsCsv'))return;
  const b=document.createElement('button');b.type='button';b.id='exportDocumentsCsv';b.className='secondary document-export-btn';b.textContent='⬇ Exportar esta vista a CSV / Excel';tools.appendChild(b);b.addEventListener('click',exportDocumentsCsv);
}
const previousBindDocumentExport=bind;
bind=function(){previousBindDocumentExport();injectDocumentExport()};
addDocumentExportStyles();
if(session)renderApp();
})();
