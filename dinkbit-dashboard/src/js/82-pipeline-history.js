/* ================= PIPELINE · HISTORIAL DE SNAPSHOTS ================= */
/* Todo lo de esta sección sale de pipeline-history.json (Attio). Nunca mezcla datos del Excel. */
const HIST = JSON.parse(document.getElementById('hist').textContent);
const CFG  = JSON.parse(document.getElementById('cfg').textContent);
const HS   = HIST.snaps;                       // ordenados por fecha ascendente
const H_INFO = HIST.info;                      // key → [name, company, created, bu, src]
const H_SRC = k=>{ const s=(H_INFO[k]?.[4]||'').trim(); return SRC_ALIAS[s]||s };
const isOpenIdx = i=>i<4, WON_I=4, LOST_I=5;
const dayMs = 864e5;
const dOf = s=>new Date(s+'T12:00:00');
const daysBetween = (a,b)=>Math.round((dOf(b)-dOf(a))/dayMs);
const passF = k=>(!state.bu||H_INFO[k]?.[3]===state.bu)&&(!state.src||H_SRC(k)===state.src);
const median = a=>{ if(!a.length) return null; const s=[...a].sort((x,y)=>x-y), m=Math.floor(s.length/2); return s.length%2?s[m]:(s[m-1]+s[m])/2 };
const stName = i=>STAGES[i].replace(/^\d\. /,'').replace(' 🎉','');

/* Cambios entre los dos últimos snapshots (respeta los filtros BU / Fuente) */
function pipeChanges(){
  if(HS.length<2) return null;
  const prev=HS[HS.length-2], cur=HS[HS.length-1];
  const pm=new Map(prev.d.filter(x=>passF(x[0])).map(x=>[x[0],x])), cm=new Map(cur.d.filter(x=>passF(x[0])).map(x=>[x[0],x]));
  const nuevos=[], perdidos=[], moved=[], monto=[];
  cm.forEach((c,k)=>{ const p=pm.get(k); if(!p) nuevos.push({k,c}); else { if(p[1]!==c[1]) moved.push({k,p,c}); if(p[2]!==c[2]) monto.push({k,p,c}) } });
  pm.forEach((p,k)=>{ if(!cm.has(k)) perdidos.push({k,p}) });
  return {prev:prev.date,cur:cur.date,nuevos,desaparecidos:perdidos,moved,monto,
    avances:moved.filter(m=>m.c[1]<=3&&m.c[1]>m.p[1]), retrocesos:moved.filter(m=>m.c[1]<m.p[1]),
    ganados:moved.filter(m=>m.c[1]===WON_I), perdidas:moved.filter(m=>m.c[1]===LOST_I)};
}

/* Desde cuándo está cada deal en su etapa actual (según snapshots). censored = ya estaba así en el primer snapshot */
function stageSince(key){
  const last=HS[HS.length-1]; const row=last.d.find(x=>x[0]===key); if(!row) return null;
  let idx=HS.length-1;
  while(idx>0){ const r=HS[idx-1].d.find(x=>x[0]===key); if(r&&r[1]===row[1]) idx--; else break }
  // la entrada real ocurrió entre el snapshot anterior y el primero en que se ve: se toma el punto medio
  const gap=idx>0?daysBetween(HS[idx-1].date,HS[idx].date):0;
  return {since:HS[idx].date, cens:idx===0, days:daysBetween(HS[idx].date,last.date)+gap/2};
}
function stageDaysCell(d){
  if(HS.length<2||!d.key) return '—';
  const s=stageSince(d.key); if(!s) return '—';
  return s.cens?`≥ ${Math.round(s.days)}`:`~${Math.round(s.days)}`;
}

/* Ciclo de venta observado: creación → primer snapshot en que aparece Won/Lost (solo deals que cambiaron dentro del historial) */
function cycleTimes(){
  const out={won:[],lost:[]};
  const first=new Map();
  HS.forEach((s,si)=>s.d.forEach(([k,st])=>{ if(!first.has(k)) first.set(k,{si,st}) }));
  const last=HS[HS.length-1];
  last.d.forEach(([k,st])=>{
    if(st!==WON_I&&st!==LOST_I) return; if(!passF(k)) return;
    const f=first.get(k); if(f.si===0&&(f.st===WON_I||f.st===LOST_I)) return;  // ya venía cerrado: no observamos el cierre
    const si=HS.findIndex(s=>s.d.some(x=>x[0]===k&&x[1]===st)); const cd=HS[si].date;
    out[st===WON_I?'won':'lost'].push(daysBetween(H_INFO[k][2],cd));
  });
  return out;
}

/* Serie por snapshot */
function trendSeries(){
  return HS.map(s=>{ const r=s.d.filter(x=>passF(x[0]));
    const open=r.filter(x=>isOpenIdx(x[1])), won=r.filter(x=>x[1]===WON_I), lost=r.filter(x=>x[1]===LOST_I);
    return {date:s.date,openV:sum(open.map(x=>x[2])),openN:open.length,wonV:sum(won.map(x=>x[2])),wonN:won.length,lostN:lost.length};
  });
}

const fmtD = s=>dOf(s).toLocaleDateString('es-MX',{day:'2-digit',month:'short'}).replace('.','');
const dname = k=>{const i=H_INFO[k]||['—',null]; return `${esc(i[1]||'—')} · ${esc(i[0])}`};

function renderPipeExtras(ctx){
  renderPipeChanges(); renderPipeWeighted(ctx); renderPipeTrend();
  renderAlerts('alertsPipe', pipeAlerts(ctx));
}

function renderPipeChanges(){
  const el=document.getElementById('secChanges'); const c=pipeChanges();
  if(!c){ el.innerHTML=`<div class="chead"><div><h3>Cambios vs. snapshot anterior</h3><p>Deals nuevos, avances de etapa, cierres y desaparecidos entre snapshots</p></div></div><div class="empty">Solo hay un snapshot en el historial (${HS[0].date}). Con la próxima actualización verás aquí qué cambió.</div>`; return }
  const cards=[['Nuevos',c.nuevos.length,`${money(sum(c.nuevos.map(x=>x.c[2])))} en valor`],['Avanzaron de etapa',c.avances.length,`${c.retrocesos.length} retrocedieron`],
    ['Ganados',c.ganados.length,`${money(sum(c.ganados.map(x=>x.c[2])))} · ${c.perdidas.length} perdidos (${money(sum(c.perdidas.map(x=>x.c[2])))})`],['Desaparecidos',c.desaparecidos.length,'Ya no están en Attio']];
  const it=[];
  const push=(b,ic,tag,t,p)=>it.push({b,ic,tag,t,p});
  c.ganados.forEach(m=>push(true,IC.flag,'Ganado',dname(m.k),`${stName(m.p[1])} → Won · ${money(m.c[2])}`));
  c.perdidas.forEach(m=>push(false,IC.clock,'Perdido',dname(m.k),`${stName(m.p[1])} → Lost · ${money(m.c[2])}`));
  c.avances.forEach(m=>push(false,IC.up,'Avanza',dname(m.k),`${stName(m.p[1])} → ${stName(m.c[1])} · ${money(m.c[2])}`));
  c.nuevos.forEach(m=>push(false,IC.tag,'Nuevo',dname(m.k),`Entra en ${stName(m.c[1])} · ${m.c[2]?money(m.c[2]):'sin monto'}`));
  c.retrocesos.filter(m=>m.c[1]!==LOST_I).forEach(m=>push(false,IC.clock,'Retrocede',dname(m.k),`${stName(m.p[1])} → ${stName(m.c[1])}`));
  c.desaparecidos.forEach(m=>push(false,IC.clock,'Desaparece',dname(m.k),`Estaba en ${stName(m.p[1])} · ${money(m.p[2])} — ¿eliminado o archivado?`));
  c.monto.forEach(m=>push(false,IC.tag,'Monto',dname(m.k),`${money(m.p[2])} → ${money(m.c[2])}`));
  el.innerHTML=`<div class="chead"><div><h3>Cambios vs. snapshot anterior</h3><p>${fmtD(c.prev)} → ${fmtD(c.cur)} · ${daysBetween(c.prev,c.cur)} días entre snapshots${state.bu||state.src?' · con los filtros activos':''}</p></div></div>
    <div class="segs">${cards.map((x,i)=>`<div class="segc ${i===0?'top':''}"><div class="label"><i></i>${x[0]}</div><div class="v num">${x[1]}</div><div class="hr"><span>${x[2]}</span></div></div>`).join('')}</div>
    <div class="items2" style="margin-top:14px">${it.slice(0,12).map(x=>`<div class="item"><div class="ic ${x.b?'b':''}">${x.ic}</div><div><h4>${x.t}</h4><p>${x.p}</p></div><div><span class="tag ${x.b?'b':''}">${x.tag}</span></div></div>`).join('')||'<div class="empty">Sin movimientos entre los dos snapshots.</div>'}</div>
    ${it.length>12?`<p class="note">…y ${it.length-12} movimientos más (el reporte completo queda en data/last-pipeline-update.md).</p>`:''}`;
}

/* Probabilidad de cierre por etapa — SIEMPRE calculada de los datos, nunca un supuesto manual (Edgar, 24-sep-2026).
   Dos métodos, del más al menos confiable:
   1) OBSERVADA: entre los deals que el historial de snapshots vio pasar por la etapa i y que ya
      tienen desenlace conocido (Won o Lost más adelante), qué fracción terminó Won. Requiere que
      el historial haya "visto" ese tránsito (2+ snapshots con el deal cambiando de etapa).
   2) ESTIMADA (respaldo): con un solo snapshot no hay tránsitos observados todavía, así que se usa
      el embudo del snapshot actual — cuántas oportunidades hay HOY en la etapa i o más adelante,
      Won incluido, y qué fracción de esas son Won. Es un punto de partida razonable, pero asume que
      todo lo Perdido pudo haberse perdido en cualquier etapa por igual (no lo sabemos con un solo
      snapshot); se reemplaza sola por el método observado en cuanto el historial acumula tránsitos. */
function stageProbabilities(){
  const idxOf=st=>STAGES.indexOf(st);
  const observed={}, seenAtStage={};
  HS.forEach(s=>s.d.forEach(([k,st])=>{ if(isOpenIdx(st)){ (seenAtStage[st]=seenAtStage[st]||new Set()).add(k) } }));
  const finalOf=k=>{ for(let i=HS.length-1;i>=0;i--){ const r=HS[i].d.find(x=>x[0]===k); if(r) return r[1] } return null };
  OPEN.forEach((st,i)=>{ const seen=seenAtStage[i]; if(!seen||!seen.size) return;   // seenAtStage está indexado por índice de etapa (0-3), no por nombre
    let won=0,lost=0; seen.forEach(k=>{ const f=finalOf(k); if(f===WON_I) won++; else if(f===LOST_I) lost++ });
    if(won+lost>0) observed[st]={p:won/(won+lost),n:won+lost} });
  const counts=Object.fromEntries(STAGES.map(st=>[st,D.filter(d=>d.stage===st).length]));
  const wonN=counts[STAGES[WON_I]]||0;
  const estimated={};
  OPEN.forEach((st,i)=>{ const denom=wonN+OPEN.slice(i).reduce((a,s2)=>a+(counts[s2]||0),0); estimated[st]=denom>0?{p:wonN/denom,n:denom}:null });
  return OPEN.map(st=>observed[st]?{st,...observed[st],src:'observada'}:estimated[st]?{st,...estimated[st],src:'estimada'}:{st,p:null,n:0,src:'—'});
}

function renderPipeWeighted(ctx){
  const el=document.getElementById('secWeighted'); const probs=stageProbabilities();
  const rows=OPEN.map((st,i)=>{ const x=ctx.DD.filter(d=>d.stage===st); const pr=probs[i]; return {st,n:x.length,v:sum(x.map(d=>d.val)),z:x.filter(d=>!d.val).length,p:pr.p,src:pr.src,obsN:pr.n||0,w:pr.p==null?null:sum(x.map(d=>d.val))*pr.p} });
  const tot={n:sum(rows.map(r=>r.n)),v:sum(rows.map(r=>r.v)),z:sum(rows.map(r=>r.z)),w:sum(rows.map(r=>r.w||0))};
  const anyObs=rows.some(r=>r.src==='observada'), allEst=rows.every(r=>r.src==='estimada');
  el.innerHTML=`<div class="chead"><div><h3>Pipeline ponderado</h3><p>Valor esperado = valor de cada etapa × probabilidad de cierre · calculada de los datos, no es un supuesto manual</p></div><div class="legend"><span class="tag ${anyObs?'b':''}">${anyObs?'Con datos observadas':'Todas estimadas del snapshot'}</span></div></div>
   <div style="overflow:auto"><table class="mini"><thead><tr><th>Etapa</th><th class="r">Deals</th><th class="r">Sin monto</th><th class="r">Valor MXN</th><th class="r">Probabilidad</th><th class="r">Método</th><th class="r">Ponderado</th></tr></thead><tbody>
   ${rows.map(r=>`<tr><td><b>${esc(stName(STAGES.indexOf(r.st)))}</b></td><td class="r num">${r.n}</td><td class="r num">${r.z||'—'}</td><td class="r num">${moneyFull(r.v)}</td><td class="r num">${r.p==null?'—':pct(r.p,0)}</td><td class="r muted" style="font-size:11px">${r.src==='observada'?`observada · ${r.obsN} deals`:r.src==='estimada'?'estimada · embudo':'—'}</td><td class="r num"><b>${r.w==null?'—':moneyFull(r.w)}</b></td></tr>`).join('')}
   <tr class="tot"><td>Total pipe activo</td><td class="r num">${tot.n}</td><td class="r num">${tot.z||'—'}</td><td class="r num">${moneyFull(tot.v)}</td><td class="r num">${tot.v?pct(tot.w/tot.v,0):'—'}</td><td></td><td class="r num blue"><b>${moneyFull(tot.w)}</b></td></tr></tbody></table></div>
   <p class="note"><b>Observada</b>: entre los deals que el historial vio pasar por esa etapa y ya tienen desenlace (Won o Lost), qué fracción ganó. <b>Estimada</b>: con poco historial todavía, se usa el embudo del snapshot actual (Won ÷ oportunidades en esa etapa o después) — asume que lo Perdido pudo perderse en cualquier etapa por igual, así que las primeras etapas quedan sobreestimadas; se corrige sola en cuanto haya más snapshots. ${allEst?`Hoy el historial tiene ${HS.length} snapshot${HS.length>1?'s':''}: todavía no hay tránsitos observados.`:''} ${tot.z?`Hay <b>${tot.z}</b> deals activos sin monto que no suman al valor ni al ponderado hasta que Attio los capture.`:''}</p>`;
}

function renderPipeTrend(){
  const el=document.getElementById('secTrend'); const ser=trendSeries();
  const cyc=cycleTimes(), st=[...Array(4).keys()].map(i=>{ const xs=HS[HS.length-1].d.filter(x=>x[1]===i&&passF(x[0])).map(x=>stageSince(x[0])).filter(s=>s&&!s.cens).map(s=>s.days); return {i,n:xs.length,m:median(xs)} });
  const head=`<div class="chead"><div><h3>Tendencia y velocidad</h3><p>Evolución del pipe activo por snapshot · tiempos observados entre snapshots</p></div><div class="legend"><span><i style="background:var(--ch-2)"></i>Pipe activo</span><span><i class="line" style="background:var(--ch-1)"></i>Won acumulado</span></div></div>`;
  if(HS.length<2){ el.innerHTML=head+`<div class="empty">La tendencia y los tiempos por etapa necesitan al menos 2 snapshots. Hoy hay 1 (${HS[0].date}); aparecerán con la próxima actualización.</div>`; return }
  el.innerHTML=head+`<div class="ch sm" id="chTrend"></div><div class="divider"></div>
   <div class="segs">${st.map(x=>`<div class="segc"><div class="label"><i></i>${esc(stName(x.i))} · mediana en etapa</div><div class="v num">${x.m==null?'—':Math.round(x.m)+' d'}</div><div class="hr"><span>${x.n} deals con entrada observada</span></div></div>`).join('')}
   <div class="segc top"><div class="label"><i></i>Ciclo observado · Won</div><div class="v num">${cyc.won.length?Math.round(median(cyc.won))+' d':'—'}</div><div class="hr"><span>${cyc.won.length} deals · creación → cierre</span></div></div>
   <div class="segc"><div class="label"><i></i>Ciclo observado · Lost</div><div class="v num">${cyc.lost.length?Math.round(median(cyc.lost))+' d':'—'}</div><div class="hr"><span>${cyc.lost.length} deals</span></div></div></div>
   <p class="note">Las fechas de entrada y de cierre tienen la resolución de la frecuencia de los snapshots (p. ej. semanal). Solo cuentan deals cuyo cambio ocurrió dentro del historial; los que ya estaban así en el primer snapshot no se incluyen.</p>`;
  chart('chTrend',{tooltip:{...tip,formatter:ps=>{const x=ser[ps[0].dataIndex]; return `<b>${fmtD(x.date)}</b><br>Pipe activo ${moneyFull(x.openV)} · ${x.openN} deals<br>Won acumulado ${moneyFull(x.wonV)} · ${x.wonN} deals<br>Lost ${x.lostN} deals`}},
    grid:{left:8,right:8,top:16,bottom:4,containLabel:true},xAxis:{type:'category',data:ser.map(x=>fmtD(x.date)),...axisBase},yAxis:{...yMoney},
    series:[{name:'Pipe activo',type:'bar',barMaxWidth:36,data:ser.map(x=>x.openV),itemStyle:{color:S.dark}},{name:'Won acumulado',type:'line',data:ser.map(x=>x.wonV),symbol:'circle',symbolSize:6,lineStyle:{color:S.won,width:2},itemStyle:{color:S.won}}]});
}
