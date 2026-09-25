/* ================= SIDEBAR ================= */
const ICO_ALL='<svg viewBox="0 0 24 24"><path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/></svg>', ICO_Y='<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>', CHEV='<svg class="chev" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>';
function buildNav(){
  const nav=document.getElementById('navSales'); const cur=state.view==='sales'?periodKey():'__none__';
  let h=`<button class="nav ${cur==='all'?'on':''}" data-p="all">${ICO_ALL}Histórico<span class="badge">${R.length}</span></button>`;
  [...YEARS].reverse().forEach(y=>{
    const ys=R.filter(r=>r.year===y).length; const open=P().kind!=='all'&&P().year===y;
    h+=`<button class="nav yr ${cur===String(y)?'on':''} ${open?'open':''}" data-p="${y}">${ICO_Y}${y}<span class="badge">${ys}</span>${CHEV}</button><div class="subs ${open?'open':''}" data-y="${y}">`;
    [1,2,3,4].forEach(q=>{const k=`${y}-Q${q}`; if(!Q_ALL.includes(k)) return; if(!Q_HAS.has(k)){h+=`<button class="nav sub gap" disabled>Q${q} ${y}<span class="badge">sin reporte</span></button>`; return} const n=R.filter(r=>r.quarter===k).length; h+=`<button class="nav sub ${cur===k?'on':''}" data-p="${k}">Q${q} ${y}<span class="badge">${n}</span></button>`});
    h+=`</div>`;
  });
  const ICO_CMP='<svg viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>';
  h+=`<div class="navsep" style="margin:8px 0"></div><button class="nav ${state.view==='cmp'?'on':''}" data-p="cmp">${ICO_CMP}Comparar periodos</button>`;
  nav.innerHTML=`<div class="label">Reporte de ventas</div><div class="src">Fuente · SALES - dinkbit.xlsx</div>`+h;
}
/* --- navegación: cada acción actualiza la vista y la URL (ver 88-router.js) --- */
function goSales(k,push=true){
  if(k==='all') state.period={kind:'all'}; else if(k.includes('-Q')){const [y,q]=k.split('-Q'); state.period={kind:'quarter',year:+y,q:+q}} else state.period={kind:'year',year:+k};
  state.view='sales'; state.search=''; document.getElementById('q').value=''; show('sales'); renderSalesView(); syncHash(push)}
function goCmp(push=true){ state.view='cmp'; ensureCmp(); show('cmp'); renderCompare(); syncHash(push)}
function goPipe(push=true){ state.view='pipe'; show('pipe'); renderPipeline(); syncHash(push)}
document.getElementById('navSales').onclick=e=>{const b=e.target.closest('button[data-p]'); if(!b) return; const k=b.dataset.p; if(k==='cmp') goCmp(); else goSales(k)};
document.querySelector('[data-p="pipe"]').onclick=()=>goPipe();
function show(v){ document.querySelectorAll('.view').forEach(s=>s.classList.toggle('on',s.id==='v-'+v));
  document.querySelector('[data-p="pipe"]').classList.toggle('on',v==='pipe'); buildNav();
  if(v==='pipe') document.querySelectorAll('#navSales .nav').forEach(n=>n.classList.remove('on'));
  document.getElementById('crumbG').textContent=v==='sales'?'Reporte de ventas':v==='cmp'?'Reporte de ventas':'Pipeline · Attio';
  document.getElementById('crumb').textContent=v==='sales'?periodLabel():v==='cmp'?'Comparar periodos':`Snapshot ${PIPE.meta.snapshot_date}`;
  document.getElementById('fgPipe').style.display=v==='pipe'?'flex':'none';
  window.scrollTo(0,0); setTimeout(()=>charts.forEach(c=>c.resize()),30)}
document.getElementById('q').oninput=e=>{state.search=e.target.value.trim().toLowerCase(); if(state.view!=='sales'){state.view='sales';show('sales');renderSalesView()} propPage=1; renderProps(); syncHash(false); const el=document.getElementById('secProps'); if(el&&state.search) el.scrollIntoView({block:'start'})};
