(()=>{
  const s=document.createElement('style');
  s.id='mobilePolishStyle';
  s.textContent=`
  .topbar{background:#0b0c0b!important}
  .intel-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:9px!important}
  .intel-box{padding:12px!important;min-width:0}
  .intel-value{font-size:1.08rem!important;line-height:1.15}
  .intel-sub{font-size:.72rem!important}
  @media(max-width:390px){
    .intel-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}
    .intel-box{padding:11px!important}
    .intel-label{font-size:.7rem!important}
    .intel-value{font-size:1.03rem!important}
    .section-title{font-size:1.52rem!important;margin:24px 0 14px!important}
    .intel-note{font-size:.8rem!important}
    .intel-pill{font-size:.72rem!important;padding:6px 8px!important}
  }
  `;
  document.head.appendChild(s);
})();
