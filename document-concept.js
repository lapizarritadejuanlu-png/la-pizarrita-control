(()=>{
function addDocumentConceptStyles(){
  if(document.getElementById('documentConceptStyle'))return;
  const s=document.createElement('style');s.id='documentConceptStyle';s.textContent=`
  .doc-concept-help{font-size:.76rem;color:var(--muted);line-height:1.4;margin-top:6px}
  .doc-manual-help{margin-top:8px;padding:9px 11px;border:1px solid #4b4634;border-radius:11px;background:#19170f;color:#d8c083;font-size:.75rem;line-height:1.4}
  .doc-concept-line{font-size:.78rem;color:#d8c083;margin-top:5px;line-height:1.3}
  .doc-no-proof{color:#f2bb73;border-color:#624b2b}
  `;document.head.appendChild(s);
}
function currentDocumentConcept(){return document.getElementById('invNotes')?.value?.trim()||''}
function currentDocumentHasFile(){return !!(document.getElementById('invFile')?.files?.[0]||editingFilePath)}
function injectDocumentConceptField(){
  if(route!=='invoices')return;
  const number=document.getElementById('invNumber'),grid=number?.closest('.form-grid');if(!number||!grid)return;
  let field=document.getElementById('invNotes')?.closest('.field');
  if(!field){
    const existing=editingInvoiceId?(Array.isArray(invoices)?invoices:[]).find(x=>x.id===editingInvoiceId):null;
    field=document.createElement('div');field.className='field full';field.id='invNotesField';
    field.innerHTML=`<label id="invNotesLabel">Qué compraste / concepto</label><input id="invNotes" autocomplete="off" maxlength="300" value="${esc(existing?.notes||'')}"><div id="invNotesHelp" class="doc-concept-help"></div><div id="invManualHelp" class="doc-manual-help" style="display:none"></div>`;
    number.closest('.field')?.insertAdjacentElement('afterend',field);
  }
  updateDocumentConceptUI();
}
function updateDocumentConceptUI(){
  const field=document.getElementById('invNotesField'),label=document.getElementById('invNotesLabel'),input=document.getElementById('invNotes'),help=document.getElementById('invNotesHelp'),manual=document.getElementById('invManualHelp');if(!field||!input)return;
  const t=document.getElementById('invDocType')?.value||'invoice';
  if(t==='ticket'){
    label.textContent='Qué compraste / concepto';
    input.placeholder='Ej.: Panera, menaje, bolsas, producto de limpieza…';
    help.textContent='Escríbelo tú si el ticket no identifica bien la compra.';
    manual.style.display='block';
    manual.textContent='¿No te dieron ticket? Para el control interno puedes registrarlo igualmente: indica proveedor, concepto y total y deja Foto/PDF vacío. Quedará señalado como compra sin justificante adjunto.';
  }else{
    label.textContent='Concepto / nota (opcional)';
    input.placeholder=t==='delivery_note'?'Ej.: pedido de cocina / reposición':'Ej.: menaje, reparación, compra puntual…';
    help.textContent='Úsalo cuando quieras dejar claro qué se compró o para añadir una nota al documento.';
    manual.style.display='none';
  }
}

const previousApiDocumentConcept=api;
api=async function(path,options={}){
  const method=String(options?.method||'GET').toUpperCase(),body=options?.body;
  if((method==='POST'||method==='PATCH')&&String(path).startsWith('/rest/v1/invoices')&&body&&typeof body==='object'&&!Array.isArray(body)&&Object.prototype.hasOwnProperty.call(body,'invoice_date')&&Object.prototype.hasOwnProperty.call(body,'supplier')&&Object.prototype.hasOwnProperty.call(body,'total')){
    options={...options,body:{...body,notes:currentDocumentConcept()||null}};
  }
  return previousApiDocumentConcept(path,options);
};

const previousSaveInvoiceDocumentConcept=saveInvoice;
saveInvoice=async function(){
  const t=document.getElementById('invDocType')?.value||'invoice';
  if(t==='ticket'&&!currentDocumentHasFile()&&!currentDocumentConcept()){
    toast('Si no hay ticket, escribe qué compraste en “Qué compraste / concepto”.');
    document.getElementById('invNotes')?.focus();
    return;
  }
  return previousSaveInvoiceDocumentConcept.apply(this,arguments);
};

const previousInvoiceRowDocumentConcept=invoiceRow;
invoiceRow=function(x,actions=false){
  try{
    const t=typeof documentType==='function'?documentType(x):(x?.document_type||'invoice');
    const counted=typeof isAccountingDocument==='function'?isAccountingDocument(x):(t!=='delivery_note'&&x?.document_status!=='linked');
    const buttons=`<div class="invoice-actions">${x.file_path?`<button type="button" class="secondary invoice-file" data-file-path="${esc(x.file_path)}">📎 Ver archivo</button>`:''}${actions?`<button type="button" class="secondary invoice-edit" data-invoice-id="${esc(x.id)}">✏️ Editar</button><button type="button" class="secondary danger invoice-delete" data-invoice-id="${esc(x.id)}">🗑 Borrar</button>`:''}</div>`;
    const typeLabel=t==='ticket'?'Ticket':t==='delivery_note'?'Albarán':'Factura';
    const badge=typeof documentBadge==='function'?documentBadge(x):'';
    const noProof=t==='ticket'&&!x.file_path?'<span class="doc-badge doc-no-proof">⚠ Sin justificante adjunto</span>':'';
    const concept=x.notes?`<div class="doc-concept-line">📝 ${esc(x.notes)}</div>`:'';
    const search=`${x.supplier||''} ${x.invoice_number||''} ${x.notes||''} ${typeLabel}`.toLowerCase();
    return `<div class="row invoice-row" data-search="${esc(search)}" data-month="${esc((x.invoice_date||'').slice(0,7))}" data-total="${counted?Number(x.total)||0:0}"><div><div class="row-title">${esc(x.supplier)}</div><div class="row-meta">${fmtDate(x.invoice_date)} · ${esc(x.invoice_number||'Sin nº')}</div>${badge}${noProof}${concept}${counted?'':'<div class="doc-not-counted">No suma como compra mientras esté pendiente o sustituido.</div>'}${buttons}</div><div class="row-amount">${euro(x.total)}</div></div>`;
  }catch(e){return previousInvoiceRowDocumentConcept(x,actions)}
};

const previousBindDocumentConcept=bind;
bind=function(){
  previousBindDocumentConcept();addDocumentConceptStyles();injectDocumentConceptField();
  document.getElementById('invDocType')?.addEventListener('change',updateDocumentConceptUI);
};

addDocumentConceptStyles();
if(session)renderApp();
})();
