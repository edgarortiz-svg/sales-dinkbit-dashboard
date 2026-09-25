/* ================= CHART BASE ================= */
const charts=[];
function chart(id,opt){ const el=document.getElementById(id); if(!el) return; let c=echarts.getInstanceByDom(el); if(!c){c=echarts.init(el,null,{renderer:'canvas'}); charts.push(c)} const pm=document.body.classList.contains('print-mode'); c.setOption(Object.assign({textStyle:{fontFamily:'Inter'},animationDuration:pm?0:400,animation:!pm},opt),true); if(pm) c.getZr().flush(); return c}
function disposeSalesCharts(){ document.querySelectorAll('#v-sales .ch').forEach(el=>{const c=echarts.getInstanceByDom(el); if(c){c.dispose(); const i=charts.indexOf(c); if(i>=0) charts.splice(i,1)}}) }
const axisBase={axisLine:{lineStyle:{color:C.grid}},axisTick:{show:false},axisLabel:{color:C.txt,fontSize:11},splitLine:{lineStyle:{color:C.grid}}};
const tip={trigger:'axis',backgroundColor:C.black,borderWidth:0,textStyle:{color:'#fff',fontSize:12},axisPointer:{type:'shadow',shadowStyle:{color:'rgba(16,24,32,.04)'}}};
const yMoney={type:'value',...axisBase,axisLabel:{color:C.txt,fontSize:11,formatter:v=>money(v)}};
const yPct={type:'value',min:0,max:1,...axisBase,axisLabel:{color:C.txt,fontSize:11,formatter:v=>pct(v,0)}};
let _rzT=null, _lastW=0, _lastDpr=window.devicePixelRatio;
function bucket(w){ return w>1500?0:w>1400?1:w>1200?2:w>1000?3:w>900?4:5 }
function relayout(force){
  /* Durante la impresión/exportación a PDF, Chromium cambia el ancho de render a las
     dimensiones de la página, lo que dispara un resize; si no se ignora aquí, se reconstruyen
     las gráficas en pleno proceso de impresión y se pierden las imágenes congeladas (ver 88-router.js). */
  if(!force&&document.body.classList.contains('print-mode')) return;
  const w=document.querySelector('.main').clientWidth;
  const dprChanged=window.devicePixelRatio!==_lastDpr;
  if(force||dprChanged||bucket(w)!==bucket(_lastW)){ _lastDpr=window.devicePixelRatio; _lastW=w;
    // re-crear gráficas para el nuevo ancho/densidad
    document.querySelectorAll('.ch').forEach(el=>{const c=echarts.getInstanceByDom(el); if(c){c.dispose(); const i=charts.indexOf(c); if(i>=0) charts.splice(i,1)}});
    if(state.view==='sales') renderSalesView(); if(state.view==='cmp') renderCompare(); renderPipeline(); return }
  _lastW=w; charts.forEach(c=>c.resize());
}
const _ro=new ResizeObserver(()=>{ clearTimeout(_rzT); _rzT=setTimeout(()=>relayout(false),120) });
window.addEventListener('resize',()=>{ clearTimeout(_rzT); _rzT=setTimeout(()=>relayout(false),120) });
matchMedia('(resolution: 1dppx)').addEventListener?.('change',()=>{ if(!document.body.classList.contains('print-mode')) relayout(true) });
function stackedBars(items,horizontal,dim){ return [['Accrued','won',S.won],['Lost','lost',S.lost],['Pending','pend',S.pend]].map(([nm,k,col])=>({name:nm,type:'bar',stack:'v',data:items.map((i,idx)=>({value:i[k],itemStyle:{color:col,opacity:dim&&!dim(i,idx)?.28:1}})),barMaxWidth:horizontal?18:38})) }
function catTip(items){ return {...tip,formatter:ps=>{const lab=ps[0].axisValue; const x=items.find(i=>i.k===lab||(i.q&&qLabel(i.q)===lab)); if(!x) return ''; if(x.has===false) return `<b>${lab}</b><br>Sin reporte en el Excel`; return `<b>${esc(x.k||qLabel(x.q))}</b><br>${x.n} propuestas · G ${x.nWon} · P ${x.nLost} · Pend ${x.nPend}<br>Accrued ${moneyFull(x.won)}<br>Lost ${moneyFull(x.lost)}<br>Pending ${moneyFull(x.pend)}<br>Hit Rate $ ${pct(x.hitRev)} · Hit Rate # ${pct(x.hitCnt)}`}} }
const IC={up:'<svg viewBox="0 0 24 24"><path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/></svg>',flag:'<svg viewBox="0 0 24 24"><path d="M5 21V4h12l-2 4 2 4H5"/></svg>',pie:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 3v9l6 6"/></svg>',clock:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>',users:'<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-5-6.3"/></svg>',tag:'<svg viewBox="0 0 24 24"><path d="M3 3h9l9 9-9 9-9-9z"/><circle cx="8" cy="8" r="1.5"/></svg>'};
