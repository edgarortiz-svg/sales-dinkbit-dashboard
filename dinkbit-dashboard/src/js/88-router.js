/* ================= URL (estado compartible) + IMPRESIÓN ================= */
/* #/ventas/2026-Q2?area=..&origen=..&proyecto=..&status=..&q=..
   #/ventas/2026 · #/ventas/historico
   #/comparar?a=2025-Q2&b=2026-Q2
   #/pipeline?bu=..&src=..&stage=..                                        */
function currentHash(){
  const q=new URLSearchParams();
  if(state.view==='sales'){
    const k=periodKey(); const path='#/ventas/'+(k==='all'?'historico':k);
    const g=id=>document.getElementById(id)?.value||'';
    [['area','fArea'],['origen','fOrigen'],['proyecto','fProy'],['status','fStatus']].forEach(([n,id])=>{ if(g(id)) q.set(n,g(id)) });
    if(state.search) q.set('q',state.search);
    return path+(q.toString()?'?'+q:'');
  }
  if(state.view==='cmp'){ q.set('a',state.cmp.a); q.set('b',state.cmp.b); if(state.cmp.norm) q.set('norm','1'); return '#/comparar?'+q }
  if(state.bu) q.set('bu',state.bu); if(state.src) q.set('src',state.src);
  const st=document.getElementById('fStage')?.value; if(st&&st!=='3. In Progress') q.set('stage',st);
  return '#/pipeline'+(q.toString()?'?'+q:'');
}
let _hashLock=false;
function syncHash(push){
  if(_hashLock) return; const h=currentHash(); if(location.hash===h) return;
  try{ history[push?'pushState':'replaceState'](null,'',h) }catch(e){ /* file:// o iframes: se ignora */ }
}
function applyHash(){
  const raw=location.hash.replace(/^#\/?/,''); if(!raw) return false;
  const [path,qs='']=raw.split('?'); const q=new URLSearchParams(qs); const seg=path.split('/');
  _hashLock=true;
  try{
    if(seg[0]==='ventas'){
      let k=decodeURIComponent(seg[1]||''); if(k==='historico'||!k) k='all';
      if(k!=='all'&&!(k.includes('-Q')?Q_HAS.has(k):YEARS.includes(+k))) k=LAST_Q;
      window._pf={area:q.get('area'),origen:q.get('origen'),proyecto:q.get('proyecto'),status:q.get('status')};
      goSales(k,false);
      if(q.get('q')){ state.search=q.get('q').toLowerCase(); document.getElementById('q').value=q.get('q'); propPage=1; renderProps() }
    } else if(seg[0]==='comparar'){ state.cmp={a:q.get('a'),b:q.get('b'),norm:q.get('norm')==='1'}; goCmp(false) }
    else if(seg[0]==='pipeline'){
      state.bu=D.some(d=>d.bu===q.get('bu'))?q.get('bu'):''; state.src=D.some(d=>d.src===q.get('src'))?q.get('src'):'';
      goPipe(false);
      const st=q.get('stage'); if(st&&STAGES.includes(st)){ document.getElementById('fStage').value=st; renderPipeline() }
    } else return false;
  } finally { _hashLock=false }
  return true;
}
window.addEventListener('popstate',()=>{ applyHash() });
// filtros del pipeline → URL
['selBU','selSrc','fStage'].forEach(id=>document.getElementById(id).addEventListener('change',()=>syncHash(false)));

/* ---------- impresión / PDF ---------- */
/* Al imprimir, cada gráfica se congela como imagen (los <canvas> se pierden al fragmentar páginas) */
function chartsToImages(){ document.querySelectorAll('.ch').forEach(el=>{ const c=echarts.getInstanceByDom(el); if(!c||!el.clientWidth) return;
  const im=new Image(); im.className='printimg'; im.src=c.getDataURL({pixelRatio:2,backgroundColor:'#fff'}); im.style.cssText=`width:${el.clientWidth}px;height:${el.clientHeight}px;display:block`; el.appendChild(im); el.classList.add('as-img') }) }
function clearChartImages(){ document.querySelectorAll('.printimg').forEach(i=>i.remove()); document.querySelectorAll('.as-img').forEach(e=>e.classList.remove('as-img')) }
function setPrintMode(on){ if(document.body.classList.contains('print-mode')===on) return; clearChartImages(); document.body.classList.toggle('print-mode',on); relayout(true); if(on) chartsToImages() }
/* 'afterprint' puede llegar antes de que el motor de impresión termine de pintar todas las páginas
   (pasa con la exportación a PDF sin diálogo interactivo): se espera un momento antes de revertir,
   y si llega un nuevo 'beforeprint' mientras tanto, se cancela la reversión pendiente. */
let _printRevert=null;
window.addEventListener('beforeprint',()=>{ if(_printRevert){ clearTimeout(_printRevert); _printRevert=null } setPrintMode(true) });
window.addEventListener('afterprint',()=>{ _printRevert=setTimeout(()=>{ setPrintMode(false); _printRevert=null },2000) });
document.getElementById('printBtn').onclick=()=>window.print();
