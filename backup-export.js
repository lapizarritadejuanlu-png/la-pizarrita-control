(()=>{
function addBackupStyles(){if(document.getElementById('backupExportStyle'))return;const s=document.createElement('style');s.id='backupExportStyle';s.textContent=`.backup-card{border-color:#384b43}.backup-title{font-size:1rem;font-weight:900}.backup-help{font-size:.79rem;color:var(--muted);line-height:1.45;margin-top:6px}.backup-btn{width:100%;margin-top:11px}.backup-meta{font-size:.7rem;color:#8db5a4;margin-top:7px}`;document.head.appendChild(s)}
function backupView(){return `<div class="section-title">Copia de seguridad</div><div class="card backup-card"><div class="backup-title">💾 Exportar todos los datos</div><div class="backup-help">Descarga una copia JSON de documentos, líneas, precios, movimientos, gastos programados, personal, historial y cierres mensuales. Los archivos PDF/fotos permanecen en la nube y la copia conserva sus referencias. Si falta una tabla, la exportación se cancela: nunca se genera una copia aparentemente completa con datos omitidos.</div><button type="button" id="exportFullBackup" class="secondary backup-btn">⬇ Descargar copia de seguridad</button><div class="backup-meta">Formato abierto JSON · incluye huella SHA-256 del contenido exportado.</div></div>`}
async function fetchBackupTable(label,path){const x=await api(path);if(!Array.isArray(x))throw new Error(`Respuesta no válida al leer ${label}`);return x}
async function sha256Text(text){if(!globalThis.crypto?.subtle)return null;const bytes=new TextEncoder().encode(text),hash=await crypto.subtle.digest('SHA-256',bytes);return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('')}
async function exportFullBackup(){
  try{
    setBusy(true);
    const [docs,items,prices,mv,rules,runs,workers,audit,locks,closeHistory]=await Promise.all([
      fetchBackupTable('documentos','/rest/v1/invoices?select=*&order=invoice_date.asc,created_at.asc'),
      fetchBackupTable('líneas de documentos','/rest/v1/invoice_items?select=*&order=created_at.asc'),
      fetchBackupTable('precios','/rest/v1/products?select=*&order=price_date.asc,created_at.asc'),
      fetchBackupTable('movimientos','/rest/v1/moves?select=*&order=move_date.asc,created_at.asc'),
      fetchBackupTable('gastos programados','/rest/v1/expense_rules?select=*&order=start_date.asc,created_at.asc'),
      fetchBackupTable('meses de personal','/rest/v1/payroll_runs?select=*&order=period_start.asc'),
      fetchBackupTable('trabajadores','/rest/v1/payroll_items?select=*&order=created_at.asc'),
      fetchBackupTable('historial de documentos','/rest/v1/document_audit?select=*&order=created_at.asc'),
      fetchBackupTable('cierres activos','/rest/v1/accounting_month_locks?select=*&order=month.asc'),
      fetchBackupTable('historial de cierres','/rest/v1/accounting_month_close_history?select=*&order=created_at.asc')
    ]);
    const payload={format:'la-pizarrita-control-backup',version:2,exported_at:new Date().toISOString(),project:'La Pizarrita Control',files_embedded:false,counts:{documents:docs.length,invoice_items:items.length,products:prices.length,moves:mv.length,expense_rules:rules.length,payroll_runs:runs.length,payroll_items:workers.length,document_audit:audit.length,active_month_locks:locks.length,month_close_history:closeHistory.length},data:{invoices:docs,invoice_items:items,products:prices,moves:mv,expense_rules:rules,payroll_runs:runs,payroll_items:workers,document_audit:audit,accounting_month_locks:locks,accounting_month_close_history:closeHistory}};
    const canonical=JSON.stringify(payload),hash=await sha256Text(canonical),backup={...payload,integrity:{algorithm:hash?'SHA-256':'unavailable',payload_sha256:hash}};
    const text=JSON.stringify(backup,null,2),blob=new Blob([text],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`la-pizarrita-backup-${localDate()}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);toast(`Copia completa · ${docs.length} documentos · ${mv.length} movimientos`);
  }catch(e){console.error('Backup failed',e);toast('Copia cancelada: '+(e?.message||'no se pudieron leer todos los datos'))}finally{setBusy(false)}
}
addBackupStyles();
const previousMoreBackup=moreView;
moreView=function(){return previousMoreBackup()+backupView()};
const previousBindBackup=bind;
bind=function(){previousBindBackup();addBackupStyles();document.getElementById('exportFullBackup')?.addEventListener('click',exportFullBackup)};
if(session)renderApp();
})();
