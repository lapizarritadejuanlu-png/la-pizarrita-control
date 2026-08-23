(()=>{
function addEquivalentStyles(){
  if(document.getElementById('productEquivalentStyle'))return;
  const s=document.createElement('style');s.id='productEquivalentStyle';s.textContent=`
  .price-equivalent{font-size:.74rem;color:var(--mint);font-weight:850;margin-top:5px;line-height:1.25}
  `;document.head.appendChild(s);
}
function ntext(s=''){return String(s).trim().toLowerCase().replace(/\s+/g,' ')}
function packEquivalent(name,price,unit){
  const p=Number(price);if(!Number.isFinite(p)||p<=0)return null;
  const u=ntext(unit);
  if(u==='kg')return{value:p,label:'kg'};
  if(u==='l'||u==='litro')return{value:p,label:'l'};
  const text=String(name||'').toUpperCase().replace(/,/g,'.').replace(/\s+/g,'');
  let m=text.match(/(\d+(?:\.\d+)?)\s*[X*]\s*(\d+(?:\.\d+)?)(KG|KGS|G|GR|GRS|L|LT|LTS|ML)\b/);
  if(!m)return null;
  const packs=Number(m[1]),size=Number(m[2]);if(!Number.isFinite(packs)||!Number.isFinite(size)||packs<=0||size<=0)return null;
  const kind=m[3];let total=null,label=null;
  if(['KG','KGS'].includes(kind)){total=packs*size;label='kg'}
  else if(['G','GR','GRS'].includes(kind)){total=packs*size/1000;label='kg'}
  else if(['L','LT','LTS'].includes(kind)){total=packs*size;label='l'}
  else if(kind==='ML'){total=packs*size/1000;label='l'}
  if(!total||total<=0)return null;
  return{value:p/total,label};
}
function groupedProducts(){
  const map=new Map();
  for(const p of Array.isArray(products)?products:[]){const key=`${ntext(p.name)}|${ntext(p.unit)}`;if(!map.has(key))map.set(key,[]);map.get(key).push(p)}
  return [...map.values()].map(rows=>{rows.sort((a,b)=>String(b.price_date||'').localeCompare(String(a.price_date||''))||String(b.created_at||'').localeCompare(String(a.created_at||'')));return rows[0]}).sort((a,b)=>String(a?.name||'').localeCompare(String(b?.name||''),'es',{sensitivity:'base'}));
}
function decorateEquivalents(){
  if(route!=='products')return;
  const cards=[...document.querySelectorAll('.product-smart-row')],latest=groupedProducts();
  cards.forEach((card,i)=>{
    card.querySelector('.price-equivalent')?.remove();
    const p=latest[i];if(!p)return;
    const eq=packEquivalent(p.name,p.price,p.unit);if(!eq)return;
    const side=card.querySelector('.price-side');if(!side)return;
    const el=document.createElement('div');el.className='price-equivalent';el.textContent=`≈ ${new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR',minimumFractionDigits:2,maximumFractionDigits:2}).format(eq.value)} / ${eq.label}`;side.appendChild(el);
  });
}
addEquivalentStyles();
const oldBind=bind;
bind=function(){oldBind();addEquivalentStyles();decorateEquivalents()};
if(session)renderApp();
})();
