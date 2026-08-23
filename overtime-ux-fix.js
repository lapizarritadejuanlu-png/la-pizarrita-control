(()=>{
function addOvertimeUxStyles(){
  if(document.getElementById('overtimeUxFixStyle'))return;
  const s=document.createElement('style');s.id='overtimeUxFixStyle';s.textContent=`
  .ot-first-help{border:1px solid #526447;background:#121a10;border-radius:14px;padding:13px 14px;margin:0 0 14px;color:#cfe7c5;font-size:.82rem;line-height:1.45}
  .ot-first-help strong{color:#f5f2eb}
  `;document.head.appendChild(s);
}
function improveOvertimeFirstUse(){
  addOvertimeUxStyles();
  const quick=document.getElementById('overtimeQuick');
  if(quick)quick.textContent='Abrir horas extra';
  const section=document.getElementById('overtimeSection');
  if(!section)return;
  const workerSelect=document.getElementById('otWorker');
  const noWorkers=!workerSelect||workerSelect.disabled;
  if(!noWorkers)return;
  const headings=[...document.querySelectorAll('.section-title')];
  const configTitle=headings.find(x=>String(x.textContent||'').trim()==='Configurar trabajadores');
  const configCard=configTitle?.nextElementSibling;
  if(configTitle&&configCard){
    section.after(configTitle,configCard);
    if(!document.getElementById('otFirstHelp')){
      const help=document.createElement('div');help.id='otFirstHelp';help.className='ot-first-help';help.innerHTML='<strong>Primero añade a tus trabajadores.</strong><br>Solo tienes que hacerlo una vez. Después podrás registrar las horas extra de cada noche en segundos.';
      section.after(help);
    }
    setTimeout(()=>document.getElementById('otNewWorkerName')?.focus({preventScroll:true}),80);
  }
}
const previousBindOvertimeUx=bind;
bind=function(){previousBindOvertimeUx();improveOvertimeFirstUse()};
addOvertimeUxStyles();
})();
