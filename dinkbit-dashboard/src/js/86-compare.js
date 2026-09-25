/* ================= COMPARAR PERIODOS (solo Reporte de ventas) ================= */
/* A = periodo base (negro, "periodo anterior" en la paleta) · B = periodo comparado (Neon Blue) */
/* Mapeo SOLO para mostrar en "Comparar periodos" con el interruptor activado — nunca toca
   sales-history.json ni ninguna vista fuera de esta pantalla. Son exactamente los pares que el
   propio equipo de dinkbit documentó (el Excel cambió de nombres a lo largo de los años):
   Desarrollo → Web & App Development · Diseño → Design · Contacto → Direct Contact ·
   Existente → Active Client · Estrategia Digital → Marketing Strategy · Sitio Web → Website ·
   Shopify → Online Store. Cualquier otra categoría (Branding, Consultoría, Plataforma,
   Desarrollo Flexible, Network, Kometia…) se queda tal cual: no se adivinan equivalencias que
   dinkbit no ha confirmado.*/
const NORM_MAP={
  area:{'Desarrollo':'Web & App Development','Diseño':'Design'},
  origen:{'Contacto':'Direct Contact','Existente':'Active Client'},
  proyecto:{'Estrategia Digital':'Marketing Strategy','Sitio Web':'Website','Shopify':'Online Store'},
};
const normKey=(key,val)=>state.cmp.norm?(NORM_MAP[key]?.[val]||val):val;
function cmpOptions(){
  const o=[{k:'all',label:`Histórico ${YEARS[0]}–${YEARS[YEARS.length-1]}`,g:'Histórico'}];
  [...YEARS].reverse().forEach(y=>o.push({k:String(y),label:`Año ${y}`,g:'Años'}));
  [...Q_ALL].reverse().filter(q=>Q_HAS.has(q)).forEach(q=>o.push({k:q,label:qLabel(q),g:'Trimestres'}));
  return o;
}
const keyToPeriod=k=>k==='all'?{kind:'all'}:k.includes('-Q')?{kind:'quarter',year:+k.split('-Q')[0],q:+k.split('-Q')[1]}:{kind:'year',year:+k};
const cmpValid=k=>k&&cmpOptions().some(o=>o.k===k);
function ensureCmp(){
  const c=state.cmp;
  if(!cmpValid(c.b)) c.b=LAST_Q;
  if(!cmpValid(c.a)){
    const [y,q]=c.b.includes('-Q')?c.b.split('-Q').map(Number):[null,null];
    const yoy=y?`${y-1}-Q${q}`:null;
    c.a = yoy&&Q_HAS.has(yoy)?yoy : (()=>{ const pp=c.b.includes('-Q')?prevPeriod(keyToPeriod(c.b)):null; return pp?periodKey(pp):(Q_ALL.filter(x=>Q_HAS.has(x)&&x!==c.b)[0]||'all') })();
  }
}
const dPct=(a,b)=>(b==null||!isFinite(b)||b===0||a==null||!isFinite(a))?'—':`${a>=b?'+':''}${((a-b)/Math.abs(b)*100).toFixed(1)}%`;
const dPts=(a,b)=>(a==null||b==null||!isFinite(a)||!isFinite(b))?'—':`${a>=b?'+':''}${((a-b)*100).toFixed(1)} pts`;
const dCls=(a,b)=>(a==null||b==null||!isFinite(a)||!isFinite(b))?'':a>=b?'pos':'neg';

function renderCompare(){
  ensureCmp();
  document.querySelectorAll('#v-cmp .ch').forEach(el=>{const c=echarts.getInstanceByDom(el); if(c){c.dispose(); const i=charts.indexOf(c); if(i>=0) charts.splice(i,1)}});
  const {a:ka,b:kb}=state.cmp, pa=keyToPeriod(ka), pb=keyToPeriod(kb), ra=periodRows(pa), rb=periodRows(pb), sa=stats(ra), sb=stats(rb);
  const la=periodLabel(pa), lb=periodLabel(pb), opts=cmpOptions();
  const sel=(id,cur)=>`<select id="${id}">${['Histórico','Años','Trimestres'].map(g=>`<optgroup label="${g}">${opts.filter(o=>o.g===g).map(o=>`<option value="${o.k}" ${o.k===cur?'selected':''}>${esc(o.label)}</option>`).join('')}</optgroup>`).join('')}</select>`;
  const alerts=[];
  if(pa.kind!==pb.kind) alerts.push({level:'warn',msg:`Estás comparando periodos de distinta duración (<b>${la}</b> vs <b>${lb}</b>). Los montos y conteos absolutos no son comparables; lee mejor los Hit Rate y el ticket.`});
  if(ka===kb) alerts.push({level:'info',msg:'Los dos periodos son el mismo.'});
  const inYears=k=>{ const p=keyToPeriod(k); return p.kind==='all'?YEARS:[p.year] };
  const noP=YEARS.filter(y=>{const r=R.filter(x=>x.year===y); return r.length&&!r.some(x=>x.status==='Pendiente')});
  const hasP=YEARS.some(y=>R.some(x=>x.year===y&&x.status==='Pendiente'));
  const tch=[...new Set([...inYears(ka),...inYears(kb)])].filter(y=>noP.includes(y));
  if(hasP&&tch.length) alerts.push({level:'info',msg:`${tch.join(' y ')} no registra${tch.length>1?'n':''} propuestas <b>Pendientes</b> en el Excel: su Hit Rate no es directamente comparable con el de los años que sí las registran.`});
  if(!state.cmp.norm) alerts.push({level:'info',msg:'La taxonomía del Excel no está normalizada: si una categoría cambió de nombre entre los periodos (p. ej. Desarrollo → Web & App Development) aparece como categorías distintas. Activa "Vista normalizada" para unir los 7 pares que dinkbit documentó.'});
  else alerts.push({level:'info',msg:'Vista normalizada activa: Desarrollo→Web & App Development, Diseño→Design, Contacto→Direct Contact, Existente→Active Client, Estrategia Digital→Marketing Strategy, Sitio Web→Website, Shopify→Online Store. Solo cambia lo que ves aquí; sales-history.json no se toca.'});

  const kp=(l,v,s,hero)=>({l,v,sub:s,hero});
  const kpis=[
    {l:`Accrued · ${lb}`,v:money(sb.won),d:` <small class="${dCls(sb.won,sa.won)}">${dPct(sb.won,sa.won)}</small>`,sub:`A · ${la}: ${money(sa.won)}`,hero:true},
    {l:'Propuestas emitidas',v:String(sb.n),d:` <small class="${dCls(sb.n,sa.n)}">${dPct(sb.n,sa.n)}</small>`,sub:`A: ${sa.n}`},
    {l:'Hit Rate · revenue',v:pct(sb.hitRev),d:` <small class="${dCls(sb.hitRev,sa.hitRev)}">${dPts(sb.hitRev,sa.hitRev)}</small>`,sub:`A: ${pct(sa.hitRev)}`},
    {l:'Hit Rate · propuestas',v:pct(sb.hitCnt),d:` <small class="${dCls(sb.hitCnt,sa.hitCnt)}">${dPts(sb.hitCnt,sa.hitCnt)}</small>`,sub:`A: ${pct(sa.hitCnt)}`},
  ];
  const metric=(nm,f,fmt,pts)=>`<tr><td><b>${nm}</b></td><td class="r num">${fmt(f(sa))}</td><td class="r num"><b>${fmt(f(sb))}</b></td><td class="r num ${dCls(f(sb),f(sa))}">${pts?dPts(f(sb),f(sa)):dPct(f(sb),f(sa))}</td></tr>`;
  const fm=v=>v==null||!isFinite(v)?'—':money(v), fn=v=>v==null?'—':String(v), fp=v=>pct(v);
  const table=`<table><thead><tr><th>Indicador</th><th class="r">A · ${esc(la)}</th><th class="r">B · ${esc(lb)}</th><th class="r">Δ B vs A</th></tr></thead><tbody>
    ${metric('Propuestas emitidas',s=>s.n,fn)}${metric('Ganadas',s=>s.nWon,fn)}${metric('Perdidas',s=>s.nLost,fn)}${metric('Pendientes',s=>s.nPend,fn)}
    ${metric('Total emitido',s=>s.total,fm)}${metric('Accrued',s=>s.won,fm)}${metric('Lost',s=>s.lost,fm)}${metric('Pending',s=>s.pend,fm)}
    ${metric('Ticket promedio',s=>s.ticket,fm)}${metric('Hit Rate · revenue',s=>s.hitRev,fp,true)}${metric('Hit Rate · propuestas',s=>s.hitCnt,fp,true)}</tbody></table>`;

  const blocks=[['area','Área','Propuestas | Área',9],['origen','Origen de contacto','Propuestas | Origen de Contacto',9],['proyecto','Tipo de proyecto','Propuestas | Tipo de Proyecto',9]];
  const cat=(key,lim)=>{ const A=groupBy(ra,r=>normKey(key,r[key]||'Sin dato')), B=groupBy(rb,r=>normKey(key,r[key]||'Sin dato')); const ks=[...new Set([...Object.keys(A),...Object.keys(B)])];
    return ks.map(k=>({k,a:stats(A[k]||[]),b:stats(B[k]||[])})).sort((x,y)=>(y.a.won+y.b.won)-(x.a.won+x.b.won)||(y.a.n+y.b.n)-(x.a.n+x.b.n)).slice(0,lim) };
  const cards=blocks.map(([key,ttl,sub,lim])=>{ const items=cat(key,lim); const id='chCmp_'+key;
    const rowsHtml=items.map(x=>`<tr><td><b>${esc(x.k)}</b></td><td class="r num">${x.a.n}</td><td class="r num">${x.b.n}</td><td class="r num">${money(x.a.won)}</td><td class="r num"><b>${money(x.b.won)}</b></td><td class="r num ${dCls(x.b.won,x.a.won)}">${dPct(x.b.won,x.a.won)}</td><td class="r num">${pct(x.a.hitRev,0)}</td><td class="r num blue"><b>${pct(x.b.hitRev,0)}</b></td></tr>`).join('');
    return {key,items,id,html:`<div class="card sec tall"><div class="chead"><div><h3>${ttl}</h3><p>Accrued por categoría · las ${items.length} con más revenue entre los dos periodos</p></div><div class="legend"><span><i style="background:var(--ch-2)"></i>A · ${esc(la)}</span><span><i style="background:var(--ch-1)"></i>B · ${esc(lb)}</span></div></div>
      <div class="ch sm" id="${id}"></div>
      <div style="overflow:auto;margin-top:12px"><table class="mini"><thead><tr><th>${ttl}</th><th class="r">Prop. A</th><th class="r">Prop. B</th><th class="r">Accrued A</th><th class="r">Accrued B</th><th class="r">Δ Accrued</th><th class="r">HR $ A</th><th class="r">HR $ B</th></tr></thead><tbody>${rowsHtml}</tbody></table></div></div>`} });

  document.getElementById('v-cmp').innerHTML=`
    <div class="hero"><div><div class="date">Reporte de ventas · comparación</div><h1>Comparar <span>periodos</span></h1><p>Pon dos periodos lado a lado (trimestre, año o histórico). <b>A</b> es la base y <b>B</b> el periodo que comparas; los deltas son <b>B contra A</b>.</p></div></div>
    <div class="card" style="display:flex;gap:16px;flex-wrap:wrap;align-items:flex-end">
      <div class="dd"><label>Periodo A · base</label>${sel('cmpA',ka)}</div>
      <button class="btn noprint" id="cmpSwap" title="Intercambiar A y B">⇄ Intercambiar</button>
      <div class="dd"><label>Periodo B · comparado</label>${sel('cmpB',kb)}</div>
      <label style="display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:var(--db-gray-400);cursor:pointer;margin-left:12px"><input type="checkbox" id="cmpNorm" ${state.cmp.norm?'checked':''}> Vista normalizada</label>
      <span class="muted" style="font-size:12px;margin-left:auto">${sa.n} vs. ${sb.n} propuestas</span></div>
    <div id="alertsCmp"></div>
    <div class="grid g4" style="margin-top:16px">${kpis.map(kpiCard).join('')}</div>
    <div class="card sec"><div class="chead"><div><h3>Indicadores lado a lado</h3><p>${esc(la)} (A) contra ${esc(lb)} (B) · MXN sin IVA</p></div></div><div style="overflow:auto">${table}</div></div>
    ${cards.map(c=>c.html).join('')}`;
  renderAlerts('alertsCmp',alerts);
  document.getElementById('cmpA').onchange=e=>{state.cmp.a=e.target.value; renderCompare(); syncHash(false)};
  document.getElementById('cmpB').onchange=e=>{state.cmp.b=e.target.value; renderCompare(); syncHash(false)};
  document.getElementById('cmpSwap').onclick=()=>{const t=state.cmp.a; state.cmp.a=state.cmp.b; state.cmp.b=t; renderCompare(); syncHash(false)};
  document.getElementById('cmpNorm').onchange=e=>{state.cmp.norm=e.target.checked; renderCompare(); syncHash(false)};
  cards.forEach(c=>{ const it=c.items;
    chart(c.id,{tooltip:{...tip,formatter:ps=>{const x=it[ps[0].dataIndex]; return `<b>${esc(x.k)}</b><br>A · ${esc(la)}: ${moneyFull(x.a.won)} (${x.a.nWon} ganadas de ${x.a.n})<br>B · ${esc(lb)}: ${moneyFull(x.b.won)} (${x.b.nWon} ganadas de ${x.b.n})`}},
      grid:{left:8,right:8,top:16,bottom:4,containLabel:true},
      xAxis:{type:'category',data:it.map(x=>x.k),...axisBase,axisLabel:{color:C.black,fontSize:11,interval:0,formatter:v=>v.length>16?v.slice(0,15)+'…':v}},yAxis:{...yMoney},
      series:[{name:'A · '+la,type:'bar',barMaxWidth:26,data:it.map(x=>x.a.won),itemStyle:{color:S.dark}},{name:'B · '+lb,type:'bar',barMaxWidth:26,data:it.map(x=>x.b.won),itemStyle:{color:S.won}}]}) });
  setTimeout(()=>charts.forEach(c=>c.resize()),30);
}
