(()=>{
function addDashboardResultColorStyles(){
  if(document.getElementById('dashboardResultColorStyle'))return;
  const s=document.createElement('style');
  s.id='dashboardResultColorStyle';
  s.textContent=`
  .big-result.result-negative{color:#ff9a91!important}
  .big-result.result-positive{color:#57d487!important}
  .big-result.result-neutral{color:var(--text)!important}
  `;
  document.head.appendChild(s);
}
function dashboardResultNumber(text=''){
  let s=String(text).trim().replace(/\s/g,'').replace(/€/g,'');
  if(s.includes(',')&&s.includes('.'))s=s.replace(/\./g,'').replace(',','.');
  else if(s.includes(','))s=s.replace(',','.');
  const n=Number(s.replace(/[^0-9.-]/g,''));
  return Number.isFinite(n)?n:null;
}
function decorateDashboardResult(){
  addDashboardResultColorStyles();
  const el=document.querySelector('.big-result');if(!el)return;
  const n=dashboardResultNumber(el.textContent);
  el.classList.remove('result-negative','result-positive','result-neutral');
  el.classList.add(n===null||Math.abs(n)<0.005?'result-neutral':n<0?'result-negative':'result-positive');
}
const previousBindDashboardResultColor=bind;
bind=function(){previousBindDashboardResultColor();decorateDashboardResult()};
addDashboardResultColorStyles();
if(session)renderApp();
})();
