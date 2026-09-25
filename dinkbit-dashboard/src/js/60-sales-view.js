/* ================= SALES PERIOD VIEW ================= */
function renderSalesView(){
  disposeSalesCharts();
  const p=P(), rows=periodRows(), pp=prevPeriod(), prev=pp?periodRows(pp):null, s=stats(rows), ps=prev?stats(prev):null, pl=pp?`vs. ${periodLabel(pp)}`:'';
  const isQ=p.kind==='quarter', isY=p.kind==='year', isAll=p.kind==='all';
  const title = isAll?`Histórico <span>${YEARS[0]} → ${YEARS[YEARS.length-1]}</span>` : isY?`Reporte <span>${p.year}</span>` : `Reporte <span>Q${p.q} ${p.year}</span>`;
  const sub = isAll?`${SALES.meta.quarters.length} trimestres reportados` : isY?`${Q_ALL.filter(q=>q.startsWith(p.year+'-')&&Q_HAS.has(q)).map(qLabel).join(' · ')}` : `${MESL[(p.q-1)*3]} – ${MESL[(p.q-1)*3+2]} ${p.year}`;
  const v=document.getElementById('v-sales');
  v.innerHTML=`
    <div class="hero"><div><div class="date">Reporte de ventas · ${sub}</div><h1>${title}</h1><p id="lede"></p></div><div class="actions"><span class="pill"><i></i>${periodLabel()}</span><button class="btn" id="csvBtn">Exportar propuestas</button></div></div>
    <div id="alertsSales"></div><div class="grid g4" id="kpis"></div><p class="note" style="margin-top:8px">Delta y "vs." comparan contra el periodo inmediato anterior · la línea pequeña (sparkline) muestra la tendencia de los últimos 8 trimestres hasta el periodo.</p>
    <div class="grid g21 sec">
      <div class="card"><div class="chead"><div><h3 id="chRevTitle"></h3><p id="chRevSub"></p></div><div class="legend"><span><i style="background:var(--ch-1)"></i>Accrued</span><span><i style="background:var(--ch-lost)"></i>Lost</span><span><i style="background:var(--ch-3)"></i>Pending</span>${isQ?'':'<span><i class="line" style="background:var(--ch-line)"></i># Propuestas</span>'}</div></div>
        <div class="revwrap"><div class="revside"><div class="label">Accrued · ${periodLabel()}</div><div class="big blue num">${money(s.won)}</div><div class="muted" style="font-size:12px;margin-top:6px">ticket promedio ${money(s.ticket)}</div><div style="margin-top:18px">${[['Total emitido',money(s.total)],['Accrued',money(s.won)],['Lost',money(s.lost)],['Pending',money(s.pend)]].map(([a,b])=>`<div class="stat"><span class="muted">${a}</span><b class="num">${b}</b></div>`).join('')}</div></div><div class="ch revch" id="chRev"></div></div>
        <p class="gap" id="gapNote" style="margin-top:10px;display:none"></p>
        <div class="label" style="margin-top:20px">Propuestas | Área</div><div class="segs" id="ovSegs"></div></div>
      <div class="card"><div class="chead"><div><h3>Propuestas | General</h3><p>${periodLabel()} · ${s.n} propuestas · status, área y origen de contacto</p></div><div class="legend"><span><i style="background:var(--ch-1)"></i>Ganadas</span><span><i style="background:var(--ch-lost)"></i>Perdidas</span><span><i style="background:var(--ch-3)"></i>Pendientes</span></div></div><div class="cols c-gen"><div><div class="ch xs" id="chStatus" style="height:200px"></div></div><div id="ovGen"></div><div id="ovGenA"></div><div id="ovGenO"></div></div><div class="hr2" id="ovHR" style="grid-template-columns:1fr 1fr;margin-top:20px"></div><p class="note">Hit Rate $ = Accrued ÷ (Pending + Lost + Accrued), fórmula del reporte. Hit Rate # = Ganadas ÷ Total de propuestas.</p></div>
    </div>
    ${isQ?'':`
    ${sh('Evolución <span>del periodo</span>', isAll?'Dos lecturas de Hit Rate, mix por área y ticket promedio, año por año':'Trimestre a trimestre dentro del año')}
    <div class="grid g2">
      <div class="card"><div class="chead"><div><h3>Hit Rate · dos lecturas</h3><p>Revenue (Accrued ÷ Total emitido) vs. cantidad (Ganadas ÷ Total propuestas)</p></div><div class="legend"><span><i style="background:var(--ch-1)"></i>Hit Rate $</span><span><i style="background:var(--ch-2)"></i>Hit Rate #</span></div></div><div class="ch sm" id="chHit"></div></div>
      <div class="card"><div class="chead"><div><h3>Ticket promedio ganado</h3><p>Accrued ÷ propuestas ganadas</p></div><div class="legend"><span><i style="background:var(--ch-1)"></i>Periodo más reciente</span><span><i style="background:var(--ch-2)"></i>Periodos anteriores</span></div></div><div class="ch sm" id="chTicket"></div></div>
    </div>
    <div class="grid g2 sec">
      <div class="card"><div class="chead"><div><h3>Mix de revenue ganado por área</h3><p>Participación de cada área en el Accrued · taxonomía tal cual del reporte</p></div></div><div class="ch sm" id="chMix"></div><div class="legend below" id="lgMix"></div></div>
      <div class="card"><div class="chead"><div><h3>Comparativo ${isAll?'anual':'trimestral'}</h3><p>Variación contra el periodo anterior</p></div></div><div style="overflow:auto"><table id="tblCmp" class="mini"></table></div></div>
    </div>`}
    ${sh('Desglose por <span>categoría</span>','Los tres bloques del reporte con conteos, revenue y ambas lecturas de Hit Rate')}
    <div class="card"><div class="chead"><div><h3>Propuestas | Área</h3></div><div class="legend"><span><i style="background:var(--ch-1)"></i>Accrued</span><span><i style="background:var(--ch-lost)"></i>Lost</span><span><i style="background:var(--ch-3)"></i>Pending</span></div></div><div class="ch xs" id="chArea" style="height:150px"></div><div style="overflow:auto;margin-top:12px" id="tbArea"></div></div>
    <div class="card sec"><div class="chead"><div><h3>Propuestas | Tipo de Proyecto</h3><p>Top 10 por valor emitido en la gráfica · tabla completa</p></div><div class="legend"><span><i style="background:var(--ch-1)"></i>Accrued</span><span><i style="background:var(--ch-lost)"></i>Lost</span><span><i style="background:var(--ch-3)"></i>Pending</span></div></div><div class="ch" id="chProy" style="height:300px"></div><div style="overflow:auto;margin-top:12px" id="tbProy"></div></div>
    <div class="card sec"><div class="chead"><div><h3>Propuestas | Origen de Contacto</h3><p>Top 10 por valor emitido en la gráfica · tabla completa</p></div><div class="legend"><span><i style="background:var(--ch-1)"></i>Accrued</span><span><i style="background:var(--ch-lost)"></i>Lost</span><span><i style="background:var(--ch-3)"></i>Pending</span></div></div><div class="ch" id="chOrigen" style="height:280px"></div><div style="overflow:auto;margin-top:12px" id="tbOrigen"></div></div>
    <div class="grid g2 sec">
      <div class="card"><div class="chead"><div><h3>Matriz Origen × Área</h3><p>Cada celda: Accrued del cruce · (Hit Rate $ del cruce) · fila y columna Total al final</p></div></div><div style="overflow:auto"><table id="tblMatrix" class="mini"></table></div></div>
      <div class="card"><div class="chead"><div><h3>Rangos de ticket</h3><p>Propuestas por rango de valor y qué tan bien cierra cada rango</p></div><div class="legend"><span><i style="background:var(--ch-3)"></i># Propuestas (barras)</span><span><i class="line" style="background:var(--ch-1)"></i>Hit Rate $ (línea)</span><span><i class="dash"></i>Hit Rate # (línea punteada)</span></div></div><div class="cols c-32"><div class="ch sm" id="chRange" style="height:240px"></div><div id="tbRange"></div></div></div>
    </div>
    ${sh('Cuentas <span>y hallazgos</span>')}
    <div class="grid g21">
      <div class="card tall"><div class="chead"><div><h3>Top 15 cuentas por Accrued</h3></div></div><div style="overflow:auto"><table id="tblTop"></table></div></div>
      <div class="card"><div class="chead"><div><h3>Concentración</h3><p>Qué parte del Accrued explican las cuentas top</p></div></div><div id="conc" class="cols c-4"></div><div class="legend below"><span><i style="background:var(--ch-1)"></i>Participación de las cuentas top en el Accrued del periodo</span></div></div>
      <div class="card"><div class="chead"><div><h3>Cuentas recurrentes</h3><p>Dos o más propuestas ganadas</p></div></div><div id="recur" class="cols c-2 tight"></div></div>
    </div>
    <div class="card sec"><div class="chead"><div><h3>Hallazgos · ${periodLabel()}</h3><p>Generados a partir del reporte de ventas</p></div></div><div id="ovInsights" class="items2"></div></div>
    ${sh('Listado de <span>propuestas</span>','Filtra, ordena y exporta')}
    <div class="card" id="secProps"><div class="filters"><select id="fArea"></select><select id="fOrigen"></select><select id="fProy"></select><select id="fStatus"></select></div><div style="overflow:auto"><table id="tblProps"></table></div><div class="tfoot"><span id="tfInfo"></span><div class="pg" id="tfPg"></div></div></div>`;

  document.getElementById('lede').innerHTML=`En <b>${periodLabel()}</b> se emitieron <b>${s.n} propuestas</b> por ${money(s.total)}. Se ganaron <b>${s.nWon}</b> por <b>${money(s.won)}</b>: Hit Rate de <b>${pct(s.hitRev)}</b> en revenue y <b>${pct(s.hitCnt)}</b> en cantidad de propuestas. ${money(s.pend)} siguen pendientes.`;
  // KPIs con sparkline de contexto (últimos 8 trimestres hasta el periodo)
  const qIdx = isAll? Q_ALL.length-1 : Q_ALL.indexOf(`${p.year}-Q${isY?4:p.q}`);
  const qWin = Q_ALL.slice(Math.max(0,qIdx-7), qIdx+1); const qs=qWin.map(q=>stats(R.filter(r=>r.quarter===q)));
  const pls=pp?`<br><span style="opacity:.75">${pl}</span>`:'';
  document.getElementById('kpis').innerHTML=[
    {l:'Accrued · revenue ganado',v:money(s.won),d:ps?delta(s.won,ps.won):'',sub:`${s.nWon} propuestas ganadas${pls}`,sp:qs.map(x=>x.won),hero:true},
    {l:'Propuestas emitidas',v:s.n,d:ps?delta(s.n,ps.n):'',sub:`${money(s.total)} en valor emitido${pls}`,sp:qs.map(x=>x.n)},
    {l:'Hit Rate · revenue',v:pct(s.hitRev),d:ps?deltaPts(s.hitRev,ps.hitRev):'',sub:`Accrued ÷ total emitido${pls}`,sp:qs.map(x=>isFinite(x.hitRev)?x.hitRev:0)},
    {l:'Hit Rate · propuestas',v:pct(s.hitCnt),d:ps?deltaPts(s.hitCnt,ps.hitCnt):'',sub:`${s.nWon} ganadas de ${s.n}${pls}`,sp:qs.map(x=>isFinite(x.hitCnt)?x.hitCnt:0)},
  ].map(kpiCard).join('');

  // Revenue chart
  if(isQ){
    const mm=[0,1,2].map(i=>(p.q-1)*3+i+1); const ms=mm.map(m=>({k:MESL[m-1],...stats(rows.filter(r=>r.month===m))}));
    document.getElementById('chRevTitle').textContent='Revenue por mes del trimestre'; document.getElementById('chRevSub').textContent='Accrued · Lost · Pending — según la fecha de cada propuesta, MXN sin IVA';
    chart('chRev',{tooltip:catTip(ms),grid:{left:8,right:8,top:20,bottom:8,containLabel:true},xAxis:{type:'category',data:ms.map(x=>x.k),...axisBase,splitLine:{show:false}},yAxis:yMoney,series:stackedBars(ms).map(sr=>({...sr,barMaxWidth:70}))});
  } else {
    const qList = isAll? Q_ALL : Q_ALL.filter(q=>q.startsWith(p.year+'-'));
    const qst=qList.map(q=>({q,has:Q_HAS.has(q),...stats(R.filter(r=>r.quarter===q))}));
    document.getElementById('chRevTitle').textContent='Revenue por trimestre'; document.getElementById('chRevSub').textContent='Accrued · Lost · Pending · la línea marca el número de propuestas emitidas';
    chart('chRev',{tooltip:catTip(qst),grid:{left:8,right:8,top:24,bottom:8,containLabel:true},
      xAxis:{type:'category',data:qst.map(x=>qLabel(x.q)),...axisBase,splitLine:{show:false},axisLabel:{color:C.txt,fontSize:11,interval:0,rotate:qst.length>10?40:0}},
      yAxis:[yMoney,{type:'value',...axisBase,splitLine:{show:false},axisLabel:{color:C.txt,fontSize:11}}],
      series:[...stackedBars(qst.map(x=>x.has?x:{won:null,lost:null,pend:null})),{name:'# Propuestas',type:'line',yAxisIndex:1,data:qst.map(x=>x.has?x.n:null),itemStyle:{color:S.line},lineStyle:{color:S.line,width:2},symbolSize:6},
        {type:'bar',stack:'v',data:qst.map(x=>x.has?null:1),itemStyle:{color:'transparent'},markPoint:{symbol:'rect',symbolSize:[78,20],itemStyle:{color:C.off,borderColor:C.gray},label:{color:C.txt,fontSize:10,fontWeight:600},data:qst.filter(x=>!x.has).map(x=>({coord:[qLabel(x.q),2.2e6],value:'SIN REPORTE'}))}}]});
    const miss=qList.filter(q=>!Q_HAS.has(q)); if(miss.length){const g=document.getElementById('gapNote'); g.style.display='block'; g.textContent=`Sin reporte en el Excel: ${miss.map(qLabel).join(', ')}. El hueco se muestra vacío.`}
  }
  // Área segs
  const segs=Object.entries(groupBy(rows,r=>r.area||'Sin área')).map(([a,rs])=>({a,...stats(rs)})).sort((x,y)=>y.won-x.won); const maxW=Math.max(...segs.map(x=>x.won),1);
  document.getElementById('ovSegs').innerHTML=segs.map((x,i)=>{const pv=ps?stats(prev.filter(r=>(r.area||'Sin área')===x.a)):null; return `<div class="segc ${i===0?'top':''}"><div class="label"><i></i>${esc(x.a)}</div><div class="v num">${money(x.won)}${pv?delta(x.won,pv.won):''}</div><div class="hr"><span>HR $ <b>${pct(x.hitRev,0)}</b></span><span>HR # <b>${pct(x.hitCnt,0)}</b></span><span>${x.nWon}/${x.n}</span></div><div class="bar"><i style="width:${x.won/maxW*100}%"></i></div></div>`}).join('');
  // General
  chart('chStatus',{tooltip:{trigger:'item',backgroundColor:C.black,borderWidth:0,textStyle:{color:'#fff',fontSize:12},formatter:x=>`<b>${x.name}</b><br>${x.value} propuestas · ${x.percent}%`},
    series:[{type:'pie',radius:['62%','86%'],center:['50%','50%'],label:{show:false},itemStyle:{borderColor:'#fff',borderWidth:2},data:[{name:'Ganadas',value:s.nWon,itemStyle:{color:S.won}},{name:'Perdidas',value:s.nLost,itemStyle:{color:S.lost}},{name:'Pendientes',value:s.nPend,itemStyle:{color:S.pend}}]}],
    graphic:[{type:'text',left:'center',top:'40%',style:{text:String(s.n),fontSize:26,fontWeight:800,fill:C.black,fontFamily:'Inter'}},{type:'text',left:'center',top:'58%',style:{text:'PROPUESTAS',fontSize:10,fontWeight:600,fill:C.txt,fontFamily:'Inter'}}]});
  const byA=Object.entries(groupBy(rows,r=>r.area||'Sin área')).sort((a,b)=>b[1].length-a[1].length), byO=Object.entries(groupBy(rows,r=>r.origen||'Sin dato')).sort((a,b)=>b[1].length-a[1].length);
  document.getElementById('ovGen').innerHTML=`<div class="label" style="margin-bottom:4px">Propuestas | Status</div><div class="stat"><span><span class="dot" style="background:${S.won}"></span>Ganadas</span><b class="num">${s.nWon} <span class="muted" style="font-weight:400">· ${money(s.won)}</span></b></div><div class="stat"><span><span class="dot" style="background:${S.lost}"></span>Perdidas</span><b class="num">${s.nLost} <span class="muted" style="font-weight:400">· ${money(s.lost)}</span></b></div><div class="stat"><span><span class="dot" style="background:${S.pend}"></span>Pendientes</span><b class="num">${s.nPend} <span class="muted" style="font-weight:400">· ${money(s.pend)}</span></b></div><div class="stat"><span><b>Total</b></span><b class="num">${s.n} <span class="muted" style="font-weight:400">· ${money(s.total)}</span></b></div>`;
  document.getElementById('ovGenA').innerHTML=`<div class="label" style="margin-bottom:4px">Propuestas | Área</div>${byA.map(([k,v])=>`<div class="stat"><span>${esc(k)}</span><b class="num">${v.length} <span class="muted" style="font-weight:400">· ${pct(v.length/(s.n||1),0)}</span></b></div>`).join('')}`;
  document.getElementById('ovGenO').innerHTML=`<div class="label" style="margin-bottom:4px">Propuestas | Origen</div>${byO.slice(0,7).map(([k,v])=>`<div class="stat"><span>${esc(k)}</span><b class="num">${v.length} <span class="muted" style="font-weight:400">· ${pct(v.length/(s.n||1),0)}</span></b></div>`).join('')}${byO.length>7?`<div class="stat"><span class="muted">Otros (${byO.length-7})</span><b class="num">${sum(byO.slice(7).map(x=>x[1].length))}</b></div>`:''}`;
  document.getElementById('ovHR').innerHTML=`<div><div class="label">Hit Rate $</div><div class="v num">${pct(s.hitRev)}</div><div class="muted" style="font-size:11px">${money(s.won)} de ${money(s.total)}</div></div><div><div class="label">Hit Rate #</div><div class="v num">${pct(s.hitCnt)}</div><div class="muted" style="font-size:11px">${s.nWon} de ${s.n} propuestas</div></div>`;

  // Evolución (año / histórico)
  if(!isQ){
    const items = isAll? YEARS.map(y=>({k:String(y),...stats(R.filter(r=>r.year===y)),nQ:Q_ALL.filter(q=>q.startsWith(y+'-')&&Q_HAS.has(q)).length}))
                       : Q_ALL.filter(q=>q.startsWith(p.year+'-')&&Q_HAS.has(q)).map(q=>({k:qLabel(q),...stats(R.filter(r=>r.quarter===q))}));
    chart('chHit',{tooltip:{...tip,valueFormatter:v=>pct(v)},grid:{left:8,right:8,top:28,bottom:8,containLabel:true},xAxis:{type:'category',data:items.map(x=>x.k),...axisBase,splitLine:{show:false}},yAxis:yPct,
      series:[{name:'Hit Rate $',type:'bar',data:items.map(x=>+x.hitRev.toFixed(4)),itemStyle:{color:S.won},barMaxWidth:28,label:{show:true,position:'top',color:S.won,fontSize:11,fontWeight:600,formatter:x=>pct(x.value,0)}},{name:'Hit Rate #',type:'bar',data:items.map(x=>+x.hitCnt.toFixed(4)),itemStyle:{color:S.dark},barMaxWidth:28,label:{show:true,position:'top',color:S.dark,fontSize:11,fontWeight:600,formatter:x=>pct(x.value,0)}}]});
    chart('chTicket',{tooltip:{...tip,valueFormatter:v=>moneyFull(v)},grid:{left:8,right:8,top:24,bottom:8,containLabel:true},xAxis:{type:'category',data:items.map(x=>x.k),...axisBase,splitLine:{show:false}},yAxis:yMoney,
      series:[{type:'bar',data:items.map((x,i)=>({value:Math.round(x.ticket||0),itemStyle:{color:i===items.length-1?S.won:S.dark}})),barMaxWidth:40,label:{show:true,position:'top',color:C.txt,fontSize:11,formatter:x=>money(x.value)}}]});
    const areas=Object.keys(SALES.meta.catalogs.area).filter(a=>rows.some(r=>r.area===a)); const pal=[S.won,S.dark,S.pend,S.soft,S.lost,S.pale];
    const rowsOf=x=>isAll?R.filter(r=>r.year===+x.k):R.filter(r=>qLabel(r.quarter)===x.k);
    chart('chMix',{tooltip:{...tip,formatter:ps=>`<b>${ps[0].axisValue}</b><br>`+ps.filter(x=>x.value).map(x=>`${x.marker}${x.seriesName}: ${pct(x.value,0)}`).join('<br>')},grid:{left:8,right:8,top:12,bottom:8,containLabel:true},
      xAxis:{type:'category',data:items.map(x=>x.k),...axisBase,splitLine:{show:false}},yAxis:{...yPct},
      series:areas.map((a,i)=>({name:a,type:'bar',stack:'m',barMaxWidth:40,itemStyle:{color:pal[i%pal.length]},data:items.map(x=>{const rs=rowsOf(x); const w=stats(rs.filter(r=>r.area===a)).won; return x.won? +(w/x.won).toFixed(4):0})}))});
    document.getElementById('lgMix').innerHTML=areas.map((a,i)=>`<span><i style="background:${pal[i%pal.length]}"></i>${esc(a)}</span>`).join('')+'<span class="muted">· cada barra suma 100% del Accrued del periodo</span>';
    document.getElementById('tblCmp').innerHTML=`<thead><tr><th>${isAll?'Año':'Trimestre'}</th><th class="r">Emitidas</th><th class="r">Valor emitido</th><th class="r">Ganadas</th><th class="r">Accrued</th><th class="r">Δ</th><th class="r">HR $</th><th class="r">HR #</th><th class="r">Ticket</th><th class="r">Pending</th></tr></thead><tbody>${items.map((x,i)=>{const pv=items[i-1]; return `<tr><td><b>${x.k}</b>${x.nQ!=null&&x.nQ<4?` <span class="muted">(${x.nQ}/4)</span>`:''}</td><td class="r num">${x.n}</td><td class="r num">${money(x.total)}</td><td class="r num">${x.nWon}</td><td class="r num"><b>${money(x.won)}</b></td><td class="r num">${pv?delta(x.won,pv.won):'—'}</td><td class="r num">${pct(x.hitRev)}</td><td class="r num">${pct(x.hitCnt)}</td><td class="r num">${money(x.ticket)}</td><td class="r num">${money(x.pend)}</td></tr>`}).join('')}<tr class="tot"><td>Total</td><td class="r num">${s.n}</td><td class="r num">${money(s.total)}</td><td class="r num">${s.nWon}</td><td class="r num">${money(s.won)}</td><td></td><td class="r num">${pct(s.hitRev)}</td><td class="r num">${pct(s.hitCnt)}</td><td class="r num">${money(s.ticket)}</td><td class="r num">${money(s.pend)}</td></tr></tbody>`;
  }

  // Desglose
  const a=catStats(rows,'area'), o=catStats(rows,'origen'), pr=catStats(rows,'proyecto');
  hbar('chArea',a); hbar('chOrigen',o.slice(0,10)); hbar('chProy',pr.slice(0,10));
  document.getElementById('tbArea').innerHTML=blockTable(a,rows); document.getElementById('tbOrigen').innerHTML=blockTable(o,rows); document.getElementById('tbProy').innerHTML=blockTable(pr,rows);
  const areas=a.map(x=>x.k), origs=o.map(x=>x.k);
  document.getElementById('tblMatrix').innerHTML=`<thead><tr><th>Origen ↓ · Área →</th>${areas.map(x=>`<th class="r">${esc(x)}</th>`).join('')}<th class="r">Total</th></tr></thead><tbody>${origs.map(og=>{const rs=rows.filter(r=>(r.origen||'Sin dato')===og); const t=stats(rs); return `<tr><td><b>${esc(og)}</b></td>${areas.map(ar=>{const st=stats(rs.filter(r=>(r.area||'Sin dato')===ar)); return `<td class="r num">${st.n?`${money(st.won)} <span class="muted">(${pct(st.hitRev,0)})</span>`:'<span class="muted">—</span>'}</td>`}).join('')}<td class="r num"><b>${money(t.won)}</b> <span class="muted">(${pct(t.hitRev,0)})</span></td></tr>`}).join('')}<tr class="tot"><td>Total</td>${areas.map(ar=>{const st=stats(rows.filter(r=>(r.area||'Sin dato')===ar)); return `<td class="r num">${money(st.won)} <span class="muted">(${pct(st.hitRev,0)})</span></td>`}).join('')}<td class="r num">${money(s.won)}</td></tr></tbody>`;
  const B=[['< $50K',0,5e4],['$50K–100K',5e4,1e5],['$100K–250K',1e5,2.5e5],['$250K–500K',2.5e5,5e5],['> $500K',5e5,1e12]].map(([k,lo,hi])=>({k,...stats(rows.filter(r=>(r.valor||0)>=lo&&(r.valor||0)<hi))}));
  chart('chRange',{tooltip:catTip(B),grid:{left:8,right:8,top:28,bottom:8,containLabel:true},xAxis:{type:'category',data:B.map(b=>b.k),...axisBase,splitLine:{show:false}},yAxis:[{type:'value',...axisBase,axisLabel:{color:C.txt,fontSize:11}},{...yPct,splitLine:{show:false}}],
    series:[{name:'Propuestas',type:'bar',data:B.map(b=>b.n),itemStyle:{color:S.pend},barMaxWidth:40,label:{show:true,position:'top',color:C.txt,fontSize:11}},{name:'Hit Rate $',type:'line',yAxisIndex:1,data:B.map(b=>isFinite(b.hitRev)?+b.hitRev.toFixed(4):null),itemStyle:{color:S.won},lineStyle:{width:2.5,color:S.won},symbolSize:7},{name:'Hit Rate #',type:'line',yAxisIndex:1,data:B.map(b=>isFinite(b.hitCnt)?+b.hitCnt.toFixed(4):null),itemStyle:{color:S.dark},lineStyle:{width:1.5,type:'dashed',color:S.dark},symbolSize:5}]});
  document.getElementById('tbRange').innerHTML=`<table class="mini" style="margin-top:6px"><thead><tr><th>Rango</th><th class="r">#</th><th class="r">Accrued</th><th class="r">HR $</th><th class="r">HR #</th></tr></thead><tbody>${B.map(b=>`<tr><td>${b.k}</td><td class="r num">${b.n}</td><td class="r num">${money(b.won)}</td><td class="r num blue"><b>${pct(b.hitRev,0)}</b></td><td class="r num">${pct(b.hitCnt,0)}</td></tr>`).join('')}</tbody></table>`;

  // Cuentas
  const acc=Object.entries(groupBy(rows,r=>r.nombre.trim())).map(([k,rs])=>({k,...stats(rs),areas:[...new Set(rs.map(r=>r.area).filter(Boolean))],first:rs.map(r=>r.quarter).sort()[0],last:rs.map(r=>r.quarter).sort().slice(-1)[0]}));
  const tw=s.won||1; const won=[...acc].filter(x=>x.won>0).sort((x,y)=>y.won-x.won); const top=won.slice(0,15);
  document.getElementById('tblTop').innerHTML=`<thead><tr><th>#</th><th>Cuenta</th><th>Áreas</th><th class="r">Prop.</th><th class="r">Ganadas</th><th class="r">Accrued</th><th class="r">% total</th><th class="r">HR $</th>${isQ?'':'<th>Periodo</th>'}</tr></thead><tbody>${top.map((x,i)=>`<tr><td class="rank">${String(i+1).padStart(2,'0')}</td><td><b>${esc(x.k)}</b></td><td class="muted" style="font-size:12px">${x.areas.map(esc).join(', ')}</td><td class="r num">${x.n}</td><td class="r num">${x.nWon}</td><td class="r num"><b>${money(x.won)}</b></td><td class="r num">${pct(x.won/tw,1)}</td><td class="r num">${pct(x.hitRev,0)}</td>${isQ?'':`<td class="muted num" style="font-size:12px">${qLabel(x.first)}${x.first!==x.last?' → '+qLabel(x.last):''}</td>`}</tr>`).join('')||'<tr><td colspan="9" class="empty">Sin propuestas ganadas en el periodo</td></tr>'}</tbody>`;
  const cc=n=>won.length?sum(won.slice(0,n).map(x=>x.won))/tw:0;
  document.getElementById('conc').innerHTML=[['Top 1',cc(1)],['Top 3',cc(3)],['Top 5',cc(5)],['Top 10',cc(10)]].map(([l,v])=>`<div><div class="label">${l}</div><div class="num" style="font-size:28px;font-weight:800;letter-spacing:-.02em;margin:6px 0 8px">${pct(v,0)}</div><div class="stage won" style="margin:0"><div class="bar" style="height:6px"><i style="width:${v*100}%"></i></div></div><div class="muted" style="font-size:11px;margin-top:6px">del Accrued del periodo</div></div>`).join('')+`<div class="muted" style="font-size:12px;grid-column:1/-1">${won.length} cuentas con al menos una ganada · ${acc.length} cuentas cotizadas</div>`;
  const rec=acc.filter(x=>x.nWon>=2).sort((x,y)=>y.nWon-x.nWon||y.won-x.won).slice(0,20);
  document.getElementById('recur').innerHTML=rec.length?rec.map(x=>`<div class="stat"><span><b>${esc(x.k)}</b><br><span class="muted" style="font-size:11px">${x.nWon} ganadas de ${x.n} · ${x.areas.map(esc).join(', ')}</span></span><b class="num">${money(x.won)}</b></div>`).join(''):'<div class="empty">Sin cuentas recurrentes en el periodo</div>';
  document.getElementById('ovInsights').innerHTML=salesInsights(rows,prev,s,ps,pl).map(x=>`<div class="item"><div class="ic ${x.b?'b':''}">${x.ic}</div><div><h4>${x.t}</h4><p>${x.p}</p></div><div><span class="tag ${x.b?'b':''}">${x.tag}</span></div></div>`).join('');

  // Propuestas
  ['fArea','fOrigen','fProy','fStatus'].forEach(id=>document.getElementById(id).onchange=()=>{propPage=1;renderProps();syncHash(false)});
  document.getElementById('tblProps').onclick=e=>{const th=e.target.closest('th.sort'); if(!th) return; if(propSort.k===th.dataset.k) propSort.dir*=-1; else propSort={k:th.dataset.k,dir:th.dataset.k==='valor'?-1:1}; renderProps()};
  document.getElementById('tfPg').onclick=e=>{const b=e.target.closest('button'); if(!b) return; propPage=+b.dataset.p; renderProps()};
  document.getElementById('csvBtn').onclick=csv;
  renderAlerts('alertsSales', salesAlerts());
  propPage=1; renderProps();
  setTimeout(()=>charts.forEach(c=>c.resize()),30);
}
function salesInsights(rows,prev,s,ps,pl){
  const out=[];
  const byA=Object.entries(groupBy(rows,r=>r.area||'—')).map(([a,rs])=>({a,...stats(rs)})).sort((x,y)=>y.won-x.won);
  if(byA[0]&&s.won) out.push({b:true,ic:IC.up,tag:'Área',t:`${byA[0].a} concentra ${pct(byA[0].won/s.won,0)} del Accrued`,p:`${money(byA[0].won)} en ${byA[0].nWon} ganadas · Hit Rate $ ${pct(byA[0].hitRev,0)} · Hit Rate # ${pct(byA[0].hitCnt,0)}`});
  if(isFinite(s.hitRev)&&isFinite(s.hitCnt)){ const gap=s.hitRev-s.hitCnt, avgT=s.total/(s.n||1); out.push({ic:IC.pie,tag:'Hit rate',
    t:Math.abs(gap)<0.03?`Las dos lecturas de Hit Rate coinciden (${pct(s.hitRev,0)} vs ${pct(s.hitCnt,0)})`:gap<0?`Se gana más en cantidad que en valor: ${pct(s.hitCnt,0)} de propuestas vs ${pct(s.hitRev,0)} del revenue`:`Se gana más en valor que en cantidad: ${pct(s.hitRev,0)} del revenue vs ${pct(s.hitCnt,0)} de propuestas`,
    p:gap<-0.03?`Las ganadas son de ticket menor al promedio emitido (${money(s.ticket)} vs ${money(avgT)}).`:gap>0.03?`Las ganadas son de ticket mayor al promedio emitido (${money(s.ticket)} vs ${money(avgT)}).`:`Ticket ganado ${money(s.ticket)} · ticket promedio emitido ${money(avgT)}.`})}
  if(ps&&isFinite(ps.hitRev)&&isFinite(s.hitRev)) out.push({ic:IC.flag,tag:'Tendencia',t:`Hit Rate $ ${s.hitRev>=ps.hitRev?'sube':'baja'} ${Math.abs((s.hitRev-ps.hitRev)*100).toFixed(1)} pts ${pl}`,p:`${pct(s.hitRev)} ahora contra ${pct(ps.hitRev)}. Hit Rate # pasó de ${pct(ps.hitCnt)} a ${pct(s.hitCnt)}.`});
  const byO=Object.entries(groupBy(rows,r=>r.origen||'—')).map(([a,rs])=>({a,...stats(rs)})).filter(x=>x.n>=3).sort((x,y)=>y.hitRev-x.hitRev);
  if(byO[0]) out.push({ic:IC.users,tag:'Origen',t:`${byO[0].a} es el origen con mejor Hit Rate $ (${pct(byO[0].hitRev,0)})`,p:`${byO[0].n} propuestas, ${byO[0].nWon} ganadas por ${money(byO[0].won)}.${byO.length>1?` ${byO[byO.length-1].a} cierra la lista con ${pct(byO[byO.length-1].hitRev,0)}.`:''}`});
  const byP=Object.entries(groupBy(rows,r=>r.proyecto||'—')).map(([a,rs])=>({a,...stats(rs)})).sort((x,y)=>y.n-x.n);
  if(byP[0]) out.push({ic:IC.tag,tag:'Proyecto',t:`${byP[0].a} es el tipo de proyecto más cotizado (${byP[0].n})`,p:`${money(byP[0].total)} emitidos · ${money(byP[0].won)} ganados · Hit Rate $ ${pct(byP[0].hitRev,0)}.`});
  if(s.nPend){const big=[...rows].filter(r=>r.status==='Pendiente').sort((x,y)=>(y.valor||0)-(x.valor||0))[0]; out.push({ic:IC.clock,tag:'Pendiente',t:`${money(s.pend)} pendiente de decisión en ${s.nPend} propuestas`,p:`La mayor: ${esc(big.nombre)} · ${esc(big.proyecto||'')} por ${moneyFull(big.valor)}.`})}
  return out.slice(0,6);
}
function catStats(rows,key,limit){ return Object.entries(groupBy(rows,r=>r[key]||'Sin dato')).map(([k,rs])=>({k,...stats(rs)})).sort((a,b)=>b.total-a.total).slice(0,limit||99)}
function hbar(id,items){ chart(id,{tooltip:catTip(items),grid:{left:4,right:12,top:4,bottom:4,containLabel:true},xAxis:{type:'value',splitNumber:5,...axisBase,axisLabel:{color:C.txt,fontSize:10,formatter:v=>money(v)}},yAxis:{type:'category',inverse:true,data:items.map(i=>i.k),...axisBase,splitLine:{show:false},axisLabel:{color:C.black,fontSize:11,fontWeight:500,width:Math.max(90,Math.min(200,Math.round((document.getElementById(id)?.clientWidth||900)*0.22))),overflow:'truncate'}},series:stackedBars(items,true)}) }
function blockTable(items,rows){ const t=stats(rows); const row=(x,cls='')=>`<tr class="${cls}"><td><b>${esc(x.k)}</b></td><td class="r num">${x.nWon}</td><td class="r num">${x.nLost}</td><td class="r num">${x.nPend}</td><td class="r num">${x.n}</td><td class="r num">${money(x.pend)}</td><td class="r num">${money(x.lost)}</td><td class="r num"><b>${money(x.won)}</b></td><td class="r num">${money(x.total)}</td><td class="r num blue"><b>${pct(x.hitRev)}</b></td><td class="r num">${pct(x.hitCnt)}</td></tr>`;
  return `<table class="mini"><thead><tr><th rowspan="2" style="vertical-align:bottom">Categoría</th><th colspan="4" class="grp">Propuestas</th><th colspan="4" class="grp">Revenue</th><th colspan="2" class="grp">Hit Rate</th></tr><tr><th class="r">Ganadas</th><th class="r">Perdidas</th><th class="r">Pend.</th><th class="r">Total</th><th class="r">Pending</th><th class="r">Lost</th><th class="r">Accrued</th><th class="r">Total</th><th class="r">$</th><th class="r">#</th></tr></thead><tbody>${items.map(x=>row(x)).join('')}${row({k:'Total',...t},'tot')}</tbody></table>`}
