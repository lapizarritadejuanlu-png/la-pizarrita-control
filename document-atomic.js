(()=>{
saveInvoice=async function(){
  const date=v('invDate'),supplier=v('invSupplier'),number=v('invNumber'),base=inputNum('invBase'),vat=inputNum('invVat'),total=inputNum('invTotal'),docType=['invoice','ticket','delivery_note'].includes(v('invDocType'))?v('invDocType'):'invoice';
  if(!date||!supplier||total===null){toast('Pon al menos fecha, proveedor y total.');return}
  let newPath=null;
  try{
    setBusy(true);
    const file=document.getElementById('invFile')?.files?.[0];let filePath=editingFilePath||null;
    if(file){newPath=await uploadInvoiceFile(file);filePath=newPath}
    const wasEdit=!!editingInvoiceId,existing=wasEdit?invoices.find(x=>x.id===editingInvoiceId):null;
    let documentStatus=existing?.document_status||(docType==='delivery_note'?'pending':'final');
    if(documentStatus!=='linked')documentStatus=docType==='delivery_note'?'pending':'final';
    const replaceItems=!!(itemsLoaded&&saveItems),savePrices=docType!=='delivery_note'&&documentStatus!=='linked';
    const updateExtraction=!!(itemsLoaded||!wasEdit),extractionJson=itemsLoaded?{items:detectedItems,document_type:docType,related_document_numbers:lastDetectedDocumentMeta?.related_document_numbers||[]}:null;
    const result=await api('/rest/v1/rpc/save_document_atomic',{method:'POST',body:{
      p_document_id:editingInvoiceId||null,
      p_invoice_date:date,
      p_supplier:supplier,
      p_invoice_number:number||null,
      p_base_amount:base,
      p_vat_amount:vat,
      p_total:total,
      p_file_path:filePath,
      p_document_type:docType,
      p_document_status:documentStatus,
      p_linked_to_invoice_id:existing?.linked_to_invoice_id||null,
      p_update_extraction:updateExtraction,
      p_extraction_status:itemsLoaded?'reviewed':null,
      p_extraction_json:extractionJson,
      p_replace_items:replaceItems,
      p_save_prices:savePrices,
      p_items:replaceItems?detectedItems:[]
    }});
    const invoiceId=typeof result==='string'?result:(Array.isArray(result)?result[0]:result?.id||editingInvoiceId);
    if(!invoiceId)throw new Error('No se pudo confirmar el documento guardado');
    if(newPath&&editingFilePath&&editingFilePath!==newPath)await deleteStorageFile(editingFilePath).catch(()=>{});
    let linkedCount=0,linkError=false;
    try{if(typeof window.afterDocumentSaved==='function'){const r=await window.afterDocumentSaved({invoiceId,docType,date,supplier,total,wasEdit});linkedCount=Number(r?.linkedCount)||0;linkError=!!r?.linkError}}catch(e){linkError=true;console.error('Document saved hook',e?.message||'unknown')}
    const productCount=replaceItems&&savePrices?detectedItems.filter(x=>x.unit_price!==null&&Number.isFinite(Number(x.unit_price))&&Number(x.unit_price)>0).length:0;
    editingInvoiceId=null;editingFilePath=null;detectedItems=[];itemsLoaded=false;saveItems=true;lastDetectedDocumentMeta=null;window.lastDetectedDocumentMeta=null;selectedMonth=date.slice(0,7);
    const label=docLabel(docType);
    if(linkError)toast(`${label} guardado · revisa la vinculación de documentos`);
    else if(linkedCount)toast(`${label} guardado · ${linkedCount} documento${linkedCount===1?'':'s'} vinculado${linkedCount===1?'':'s'}`);
    else if(replaceItems&&savePrices)toast(`${wasEdit?label+' actualizado':label+' guardado'} · ${productCount} precios a Productos`);
    else if(docType==='delivery_note')toast(wasEdit?'Albarán actualizado · pendiente de factura':'Albarán guardado · pendiente de factura');
    else toast(wasEdit?`${label} actualizado en la nube`:`${label} guardado en la nube`);
    await loadData();
  }catch(e){
    if(newPath&&newPath!==editingFilePath)await deleteStorageFile(newPath).catch(()=>{});
    const msg=String(e?.message||'');
    if(/MONTH_LOCKED/i.test(msg))toast('🔒 Ese mes está cerrado. Reábrelo antes de modificar documentos.');
    else if(/duplicate key|unique constraint|23505/i.test(msg))toast('Ese documento ya está guardado.');
    else if(/DOCUMENT_TRASHED/i.test(msg))toast('Ese documento está en Papelera. Restáuralo antes de modificarlo.');
    else toast('No se pudo guardar: '+msg);
  }finally{setBusy(false)}
};
})();
