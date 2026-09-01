(()=>{
async function optimizeInvoiceUploadFile(file){
  if(!file||!String(file.type||'').startsWith('image/'))return file;
  try{
    const bmp=await createImageBitmap(file);
    const maxSide=2000;
    const scale=Math.min(1,maxSide/Math.max(bmp.width,bmp.height));
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(bmp.width*scale));
    canvas.height=Math.max(1,Math.round(bmp.height*scale));
    const ctx=canvas.getContext('2d');
    ctx.drawImage(bmp,0,0,canvas.width,canvas.height);
    if(typeof bmp.close==='function')bmp.close();
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.82));
    if(!blob)return file;
    const originalSize=Number(file.size)||0;
    if(originalSize&&blob.size>=originalSize*0.98)return file;
    const base=(file.name||'factura').replace(/\.[^.]+$/,'').replace(/[^a-zA-Z0-9._-]+/g,'_');
    return new File([blob],`${base}.jpg`,{type:'image/jpeg',lastModified:Date.now()});
  }catch(e){
    console.warn('Invoice upload optimization',e?.message||'unknown');
    return file;
  }
}

async function uploadWithTimeout(url,options,timeoutMs=45000){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{return await fetch(url,{...options,signal:controller.signal})}
  finally{clearTimeout(timer)}
}

uploadInvoiceFile=async function(file){
  if(!file)return null;
  let uploadFile=file;
  if(String(file.type||'').startsWith('image/')){
    if((Number(file.size)||0)>1500000)toast('Optimizando foto para subirla más rápido…');
    uploadFile=await optimizeInvoiceUploadFile(file);
  }
  const safe=(uploadFile.name||'factura').replace(/[^a-zA-Z0-9._-]+/g,'_');
  const path=`${session.user.id}/${Date.now()}-${safe}`;
  const url=`${SB_URL}/storage/v1/object/invoice-files/${path.split('/').map(encodeURIComponent).join('/')}`;
  const makeHeaders=()=>({apikey:SB_KEY,Authorization:`Bearer ${session.access_token}`,'Content-Type':uploadFile.type||'application/octet-stream','x-upsert':'false'});
  const attempt=async()=>uploadWithTimeout(url,{method:'POST',headers:makeHeaders(),body:uploadFile},45000);
  let res;
  try{res=await attempt()}catch(e){
    if(e?.name==='AbortError')throw new Error('La subida ha tardado demasiado. He reducido la foto, pero la conexión no ha respondido a tiempo.');
    throw new Error('No se pudo conectar con la nube durante la subida.');
  }
  if(res.status===401&&session?.refresh_token&&await refreshSession()){
    try{res=await attempt()}catch(e){
      if(e?.name==='AbortError')throw new Error('La subida ha tardado demasiado tras renovar la sesión.');
      throw e;
    }
  }
  if(!res.ok){let d={};try{d=await res.json()}catch{}throw new Error(d.message||d.error||`No se pudo subir el archivo (${res.status})`)}
  return path;
};
})();
