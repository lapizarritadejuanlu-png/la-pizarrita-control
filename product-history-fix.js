(()=>{
function canonicalProductUnit(unit=''){
  const u=String(unit||'').trim().toLowerCase().replace(/\./g,'');
  const map={k:'kg',kgs:'kg',kilogramo:'kg',kilogramos:'kg',gr:'g',grs:'g',gramo:'g',gramos:'g',lt:'l',lts:'l',litro:'l',litros:'l',ud:'unidad',uds:'unidad',u:'unidad',unidades:'unidad',cajas:'caja',bandejas:'bandeja',paquetes:'paquete',botellas:'botella'};
  return map[u]||u||'sin especificar';
}
window.canonicalProductUnit=canonicalProductUnit;

// IMPORTANTE: no se modifica la unidad guardada de ningún producto.
// La unidad forma parte de la identidad del precio. Un precio por kg nunca
// debe convertirse en precio por unidad (ni al revés) para poder compararlo.
// Esta versión sustituye el antiguo comportamiento que homogeneizaba todas
// las unidades de un mismo nombre y podía crear falsas subidas o bajadas.
})();
