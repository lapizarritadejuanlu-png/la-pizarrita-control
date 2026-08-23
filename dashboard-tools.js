(()=>{
function addDashboardStyles(){
  if(document.getElementById('dashboardToolsStyle'))return;
  const s=document.createElement('style');s.id='dashboardToolsStyle';s.textContent=`
  .intel-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px}.intel-box{border:1px solid var(--line);border-radius:14px;padding:14px;background:#141512}.intel-label{font-size:.76rem;color:var(--muted);text-transform:uppercase;letter-spacing:.035em}.intel-value{font-size:1.2rem;font-weight:900;margin-top:4px}.intel-sub{font-size:.76rem;color:var(--muted);margin-top:4px;line-height:1.3}.intel-note{font-size:.84rem;color:#b9b5ad;line-height:1.4;margin:12px 0 0}.intel-list{display:flex;flex-direction:column;gap:8px;margin-top:12px}.intel-row{display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-top:1px solid #2d2f29}.intel-row:first-child{border-top:0}.intel-name{font-size:.86rem;font-weight:800}.intel-amount{font-size:.86rem;font-weight:900;white-space:nowrap}.intel-alerts{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.intel-pill{border:1px solid #3b3d36;border-radius:999px;padding:7px 10px;font-size:.78rem;font-weight:800}.intel-up{color:#ff9a91}.intel-down{color:#7bd79a}.intel-neutral{color:#d9b86e}
  @media(max-width:390px){.intel-grid{grid-template-columns:1fr}}
  `;document.head.appendChild(s);
}
function monthShift(m,delta){const [y,mo]=m.split('-').map(Number);const d=new Date(y,mo-1+delta,2);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`}
function monthInvoices(m){return (Array.isArray(invoices)?invoices:[]).filter(x=>(x.invoice_date||'').slice(0,7)===m)}
function nsum(rows,key){return rows.reduce((a,x)=>a+(Number(x[key])||0),0)}
function priceAlertCounts(){
  const map=new Map();for(const p of Array.isArray(products)?products:[]){const k=`${String(p.name||'').trim().toLowerCase()}|${String(p.unit||'').trim().toLowerCase()}`;if(!map.has(k))map.set(k,[]);map.get(k).push(p)}
  let up=0,down=0,same=0;
  for(const rows of map.values()){rows.sort((a,b)=>String(b.price_date||'').localeCompare(String(a.price_date||''))||String(b.created_at||'').localeCompare(String(a.created_at||'')));if(rows.length<2)continue;const a=Number(rows[0].price),b=Number(rows[1].price);if(!Number.isFinite(a)||!Number.isFinite(b))continue;if(a>b+.000001)up++;else if(a<b-.000001)down++;else same++}
  return{up,down,same};
}
function monthlyIntelligence(){
  const inv=monthInvoices(selectedMonth),prevMonth=monthShift(selectedMonth,-1),prev=monthInvoices(prevMonth);
  const gross=inv.filter(x=>(Number(x.total)||0)>0).reduce((a,x)=>a+Number(x.total||0),0),credits=inv.filter(x=>(Number(x.total)||0)<0).reduce((a,x)=>a+Number(x.total||0),0),net=gross+credits;
  const base=nsum(inv,'base_amount'),vat=nsum(inv,'vat_amount'),prevNet=nsum(prev,'total');
  let comparison='Sin datos suficientes para comparar con el mes anterior.';
  if(inv.length&&prev.length&&Math.abs(prevNet)>.009){const pct=((net-prevNet)/Math.abs(prevNet))*100;const sign=pct>0?'+':'';comparison=`Compras netas: ${sign}${pct.toLocaleString('es-ES',{maximumFractionDigits:1})}% frente a ${monthLabel(prevMonth)}.`}
  const prov=new Map();for(const x of inv){const name=(x.supplier||'Sin proveedor').trim();prov.set(name,(prov.get(name)||0)+(Number(x.total)||0))}
  const top=[...prov.entries()].sort((a,b)=>Math.abs(b[1])-Math.abs(a[1])).slice(0,3);
  const alerts=priceAlertCounts();
  return `<div class="section-title">Control del mes</div><div class="card"><div class="intel-grid"><div class="intel-box"><div class="intel-label">Facturas</div><div class="intel-value">${inv.length}</div><div class="intel-sub">${esc(monthLabel(selectedMonth))}</div></div><div class="intel-box"><div class="intel-label">Compras netas</div><div class="intel-value">${euro(net)}</div><div class="intel-sub">Bruto ${euro(gross)}${credits?` · Abonos ${euro(credits)}`:''}</div></div><div class="intel-box"><div class="intel-label">Base imponible</div><div class="intel-value">${euro(base)}</div></div><div class="intel-box"><div class="intel-label">IVA facturas</div><div class="intel-value">${euro(vat)}</div></div></div><p class="intel-note">${esc(comparison)}</p>${top.length?`<div class="intel-list">${top.map(([name,total])=>`<div class="intel-row"><span class="intel-name">${esc(name)}</span><span class="intel-amount">${euro(total)}</span></div>`).join('')}</div>`:'<p class="intel-note">Todavía no hay compras registradas en este mes.</p>'}<div class="intel-alerts"><span class="intel-pill intel-up">▲ ${alerts.up} subidas de precio</span><span class="intel-pill intel-down">▼ ${alerts.down} bajadas</span><span class="intel-pill intel-neutral">=${alerts.same} sin cambio</span></div></div>`;
}
addDashboardStyles();
const previousDashboard=dashboard;
dashboard=function(){return previousDashboard()+monthlyIntelligence()};
if(session)renderApp();
})();
