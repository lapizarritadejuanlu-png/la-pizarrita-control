function calculate(){
  balances=Object.fromEntries(PARTIES.map(p=>[p.id,0]));
  for(const x of rows){
    if(x.status!=='active')continue;
    const a=Number(x.amount||0);
    if(x.entry_type==='expense'){
      balances[x.payer_party]=(balances[x.payer_party]||0)+a;
      const ps=Array.isArray(x.participants)?x.participants:[];
      if(ps.length){
        const share=a/ps.length;
        for(const p of ps)if(p in balances)balances[p]-=share;
      }
    }else if(x.entry_type==='settlement'){
      balances[x.payer_party]=(balances[x.payer_party]||0)+a;
      balances[x.receiver_party]=(balances[x.receiver_party]||0)-a;
    }
  }
  for(const k in balances)if(Math.abs(balances[k])<0.005)balances[k]=0;
}

function renderBalances(){
  const v=balances[me.party_id]||0,c=$('myBalance');
  c.classList.remove('good','bad');
  $('bal').textContent=money.format(Math.abs(v));
  if(v===0){$('bal').textContent=money.format(0);$('bsub').textContent='Cuenta al día'}
  else if(v>0){c.classList.add('good');$('bsub').textContent='Te tienen que devolver'}
  else{c.classList.add('bad');$('bsub').textContent='Te corresponde poner'}

  $('partyGrid').innerHTML=PARTIES.map(p=>{
    const v=balances[p.id]||0,cls=v>0?'good':v<0?'bad':'';
    return `<div class="party-card ${cls} ${p.id===me.party_id?'me':''}">
      <div class="party-name">${esc(p.name)}${p.id===me.party_id?' · tú':''}</div>
      <div class="party-amount">${money.format(Math.abs(v))}</div>
      <div class="meta">${v>0?'Debe recibir':v<0?'Debe poner':'Al día'}</div>
    </div>`;
  }).join('');
}

function suggestions(){
  const debtors=PARTIES.map(p=>({id:p.id,v:-(balances[p.id]||0)})).filter(x=>x.v>0.005).sort((a,b)=>b.v-a.v);
  const creditors=PARTIES.map(p=>({id:p.id,v:balances[p.id]||0})).filter(x=>x.v>0.005).sort((a,b)=>b.v-a.v);
  const out=[];let i=0,j=0;
  while(i<debtors.length&&j<creditors.length){
    const a=Math.min(debtors[i].v,creditors[j].v);
    if(a>0.005)out.push({payer:debtors[i].id,receiver:creditors[j].id,amount:a});
    debtors[i].v-=a;creditors[j].v-=a;
    if(debtors[i].v<0.005)i++;
    if(creditors[j].v<0.005)j++;
  }
  return out;
}

function renderSuggestions(){
  const s=suggestions();
  $('settleCard').classList.toggle('hide',!s.length);
  $('settleList').innerHTML=s.map(x=>`<div class="settle">
    <b>${esc(name(x.payer))}</b> paga <b>${money.format(x.amount)}</b> a <b>${esc(name(x.receiver))}</b>
    <button type="button" onclick="prefillSettlement('${x.payer}','${x.receiver}',${x.amount.toFixed(2)})">Registrar</button>
  </div>`).join('');
}

window.prefillSettlement=(p,r,a)=>{
  form('settlement');
  $('payer').value=p;$('receiver').value=r;$('amount').value=Number(a).toFixed(2);
  preview();$('panel').scrollIntoView({behavior:'smooth'});
};

function render(){
  const q=$('search').value.trim().toLowerCase(),m=$('month').value;
  const filtered=rows.filter(x=>(!m||String(x.occurred_on||'').startsWith(m))&&(!q||[
    x.item,x.supplier,x.notes,name(x.payer_party),name(x.receiver_party)
  ].filter(Boolean).join(' ').toLowerCase().includes(q)));
  $('empty').classList.toggle('hide',filtered.length>0);
  $('list').innerHTML=filtered.map(x=>{
    const isPay=x.entry_type==='settlement';
    const title=isPay?`${name(x.payer_party)} pagó a ${name(x.receiver_party)}`:(x.item||x.supplier||'Compra');
    const meta=isPay
      ?`${fmtDate(x.occurred_on)} · ajuste entre negocios`
      :`${fmtDate(x.occurred_on)}${x.supplier?' · '+esc(x.supplier):''} · pagó ${esc(name(x.payer_party))} · reparto: ${esc((x.participants||[]).map(name).join(', '))}`;
    return `<article class="row ${x.status==='void'?'void':''}">
      <div class="rtop"><div>
        <span class="tag">${isPay?'Pago':'Compra'}${x.status==='void'?' · anulado':''}</span>
        <b style="display:block;margin-top:5px">${esc(title)}</b>
        <div class="meta">${meta}</div>
      </div><div class="amt">${money.format(Number(x.amount||0))}</div></div>
      ${x.notes?`<div class="meta" style="margin-top:8px">${esc(x.notes)}</div>`:''}
      <div>
        ${x.has_file?`<button type="button" onclick="invoiceOpen('${x.id}')">Ver factura</button>`:''}
        ${x.status==='active'?`<button type="button" onclick="editRow('${x.id}')">Editar</button><button type="button" onclick="voidRow('${x.id}')">Anular</button>`:''}
      </div>
    </article>`;
  }).join('');
}

function fmtDate(s){
  if(!s)return '';
  const [y,m,d]=String(s).split('-');
  return `${d}/${m}/${y}`;
}

function bindParticipantChecks(){
  $('participants').querySelectorAll('input').forEach(x=>x.onchange=preview);
}

function form(type,row=null){
  $('panel').classList.remove('hide');
  $('eid').value=row?.id||'';
  $('etype').value=type;
  $('ptitle').textContent=row?'Editar movimiento':type==='settlement'?'Registrar pago':'Nueva compra';
  $('date').value=row?.occurred_on||today();
  $('payer').innerHTML=partyOptions(row?.payer_party||me.party_id);
  $('receiver').innerHTML=partyOptions(row?.receiver_party||PARTIES.find(p=>p.id!==(row?.payer_party||me.party_id))?.id);
  $('amount').value=row?.amount||'';
  $('supplier').value=row?.supplier||'';
  $('item').value=row?.item||'';
  $('notes').value=row?.notes||'';
  $('invoice').value='';
  const expense=type==='expense';
  $('receiverLab').classList.toggle('hide',expense);
  $('supLab').classList.toggle('hide',!expense);
  $('itemLab').classList.toggle('hide',!expense);
  $('participantsLab').classList.toggle('hide',!expense);
  $('fileLab').classList.toggle('hide',!expense);
  $('participants').innerHTML=participantChecks(row?.participants||PARTIES.map(p=>p.id));
  bindParticipantChecks();
  $('payer').onchange=preview;$('receiver').onchange=preview;$('amount').oninput=preview;
  preview();
}

function preview(){
  const type=$('etype').value,p=$('payer').value,a=Number($('amount').value||0);
  if(type==='settlement'){
    const r=$('receiver').value;
    $('prev').textContent=p===r?'El pagador y quien recibe no pueden ser el mismo negocio.':`${name(p)} paga ${a?money.format(a):'el importe indicado'} a ${name(r)}. Este pago ajusta los saldos.`;
    return;
  }
  const ps=checkedParticipants();
  if(!ps.length){$('prev').textContent='Marca al menos un negocio para repartir el gasto.';return}
  const share=a/ps.length;
  $('prev').textContent=`${name(p)} adelanta ${a?money.format(a):'el importe'}. Se reparte entre ${ps.length} negocio${ps.length===1?'':'s'}${a?': '+money.format(share)+' por cada uno':''}.`;
}

$('buy').onclick=()=>form('expense');
$('pay').onclick=()=>form('settlement');
$('close').onclick=()=>$('panel').classList.add('hide');
$('search').oninput=render;
$('month').onchange=render;
$('refresh').onclick=async()=>{setBusy(true);try{await load();toast('Actualizado.')}catch(e){toast(e.message)}finally{setBusy(false)}};

window.editRow=id=>{
  const r=rows.find(x=>x.id===id);
  if(r)form(r.entry_type,r);
};

window.voidRow=async id=>{
  if(!confirm('¿Anular este movimiento? Quedará visible como anulado.'))return;
  setBusy(true);
  try{
    await call('g5_void_entry_v2',{p_token:token,p_id:id});
    toast('Movimiento anulado.');
    await load();
  }catch(e){toast(e.message||'No se pudo anular.')}
  finally{setBusy(false)}
};

function fileToBase64(file){
  return new Promise((resolve,reject)=>{
    const r=new FileReader();
    r.onload=()=>resolve(String(r.result).split(',')[1]||'');
    r.onerror=reject;
    r.readAsDataURL(file);
  });
}

async function prepareFile(file){
  if(!file)return null;
  if(file.type.startsWith('image/')){
    try{
      const bmp=await createImageBitmap(file);
      const max=1800,scale=Math.min(1,max/Math.max(bmp.width,bmp.height));
      const canvas=document.createElement('canvas');
      canvas.width=Math.round(bmp.width*scale);canvas.height=Math.round(bmp.height*scale);
      canvas.getContext('2d').drawImage(bmp,0,0,canvas.width,canvas.height);
      const data=canvas.toDataURL('image/jpeg',0.82);
      const base64=data.split(',')[1]||'';
      if(base64.length>8_000_000)throw new Error('La foto es demasiado grande.');
      return {name:(file.name||'factura.jpg').replace(/\.[^.]+$/,'.jpg'),mime:'image/jpeg',base64};
    }catch(e){
      const base64=await fileToBase64(file);
      if(base64.length>8_000_000)throw new Error('La foto es demasiado grande.');
      return {name:file.name||'factura',mime:file.type||'image/jpeg',base64};
    }
  }
  if(file.size>5_800_000)throw new Error('El PDF es demasiado grande. Máximo aproximado: 5 MB.');
  return {name:file.name||'factura.pdf',mime:file.type||'application/pdf',base64:await fileToBase64(file)};
}

$('entry').onsubmit=async e=>{
  e.preventDefault();setBusy(true);
  try{
    const type=$('etype').value,payer=$('payer').value,amount=Number($('amount').value);
    if(!amount||amount<=0)throw new Error('Indica un importe válido.');
    let receiver=null,participants=null;
    if(type==='expense'){
      participants=checkedParticipants();
      if(!participants.length)throw new Error('Marca al menos un negocio.');
    }else{
      receiver=$('receiver').value;
      if(receiver===payer)throw new Error('El pagador y quien recibe no pueden ser el mismo.');
    }

    const saved=await call('g5_save_entry_v2',{
      p_token:token,
      p_id:$('eid').value||null,
      p_entry_type:type,
      p_occurred_on:$('date').value,
      p_payer_party:payer,
      p_receiver_party:receiver,
      p_participants:participants,
      p_amount:amount,
      p_supplier:type==='expense'?$('supplier').value.trim():null,
      p_item:type==='expense'?$('item').value.trim():null,
      p_notes:$('notes').value.trim()||null
    });

    const file=$('invoice').files?.[0];
    if(type==='expense'&&file){
      const f=await prepareFile(file);
      await call('g5_store_file_v2',{
        p_token:token,p_entry_id:saved.id,p_file_name:f.name,p_mime_type:f.mime,p_data_base64:f.base64
      });
    }

    $('panel').classList.add('hide');
    toast($('eid').value?'Movimiento actualizado.':'Movimiento guardado.');
    await load();
  }catch(err){toast(err.message||'No se pudo guardar.')}
  finally{setBusy(false)}
};

window.invoiceOpen=async id=>{
  const win=window.open('about:blank','_blank');
  try{
    const f=await call('g5_get_file_v2',{p_token:token,p_entry_id:id});
    if(!f)throw new Error('No hay factura guardada.');
    const bin=atob(f.data_base64),bytes=new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
    const url=URL.createObjectURL(new Blob([bytes],{type:f.mime_type||'application/octet-stream'}));
    if(win)win.location.href=url;else location.href=url;
    setTimeout(()=>URL.revokeObjectURL(url),120000);
  }catch(e){
    if(win)win.close();
    toast(e.message||'No se pudo abrir la factura.');
  }
};