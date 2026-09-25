/* ================= PIPELINE (ATTIO) ================= */
const selBU=document.getElementById('selBU'), selSrc=document.getElementById('selSrc');
function renderPipeSelectors(){ const bus=[...new Set(D.map(d=>d.bu))], srcs=[...new Set(D.map(d=>d.src))].sort();
  selBU.innerHTML=`<option value="">Todas</option>`+bus.map(b=>`<option ${b===state.bu?'selected':''}>${esc(b)}</option>`).join('');
  selSrc.innerHTML=`<option value="">Todas</option>`+srcs.map(b=>`<option ${b===state.src?'selected':''}>${esc(b)}</option>`).join('') }
selBU.onchange=()=>{state.bu=selBU.value; renderPipeline()}; selSrc.onchange=()=>{state.src=selSrc.value; renderPipeline()};
function renderPipeline(){
  renderPipeSelectors();
  const snap=new Date(PIPE.meta.snapshot_date+'T12:00:00'); const ds=snap.toLocaleDateString('es-MX',{day:'2-digit',month:'long',year:'numeric'});
  const filt=(state.bu?` · ${state.bu}`:'')+(state.src?` · ${state.src}`:'');
  document.getElementById('ppDate').textContent=`Snapshot · ${ds}${filt}`;
  const DD=pipeRows();
  const open=DD.filter(d=>OPEN.includes(d.stage)), won=DD.filter(d=>d.stage===WON), lost=DD.filter(d=>d.stage===LOST);
  const oV=sum(open.map(d=>d.val)), wV=sum(won.map(d=>d.val)), lV=sum(lost.map(d=>d.val)), conv=won.length/(won.length+lost.length||1), convV=wV/(wV+lV||1);
  const late=DD.filter(d=>['3. In Progress','4. Due Diligence'].includes(d.stage));
  document.getElementById('ppLede').innerHTML=`<b>${DD.length} deals</b> en el CRM por ${money(oV+wV+lV)}. <b>${open.length}</b> siguen activos (${money(oV)}), de los cuales <b>${late.length}</b> ya están en In Progress o Due Diligence por ${money(sum(late.map(d=>d.val)))}. Conversion rate <b>${pct(conv)}</b> por cantidad y <b>${pct(convV)}</b> por valor sobre ${won.length+lost.length} deals decididos.`;
  document.getElementById('ppKpis').innerHTML=[
    {l:'Pipe activo',v:money(oV),sub:`${open.length} deals en Lead → Due Diligence`,hero:true},
    {l:'Won',v:money(wV),sub:`${won.length} deals · ticket ${money(wV/(won.length||1))}`},
    {l:'Conversion rate',v:pct(conv),sub:`${won.length} won · ${lost.length} lost · por valor ${pct(convV)}`},
    {l:'Etapa avanzada',v:money(sum(late.map(d=>d.val))),sub:`${late.length} deals en In Progress + Due Diligence`},
  ].map(kpiCard).join('');
  const byS=STAGES.map(st=>{const x=DD.filter(d=>d.stage===st); return {st,n:x.length,v:sum(x.map(d=>d.val))}});
  const fLabel=x=>x.st.replace(/^\d\. /,'').replace(' 🎉','');
  document.getElementById('lgFunnel').innerHTML=`<span><i style="background:${S.dark};border-radius:3px"></i>Etapas activas (Lead → Due Diligence)</span><span><i style="background:${S.won};border-radius:3px"></i>Won</span><span style="margin-left:8px;padding-left:12px;border-left:1px solid #e6e6e6"><i style="background:${S.lost};border-radius:3px"></i>Lost (aparte)</span>`;
  const totV=sum(byS.map(x=>x.v))||1;
  {const act=byS.slice(0,5), el=document.getElementById('chFunnel'); const n=act.length;
   const totN=sum(act.map(x=>x.n))||1;
   const W=Math.max(320,el.clientWidth||900), H=200, colW=W/n, maxN=Math.max(...act.map(x=>x.n),1), minH=14, r=14;
   let svg=`<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Embudo del pipeline">`;
   for(let i=0;i<n;i++){ svg+=`<line x1="${Math.round(i*colW)+.5}" y1="0" x2="${Math.round(i*colW)+.5}" y2="${H}" stroke="#ececec"/>` }
   act.forEach((x,i)=>{ const h=Math.max(minH,Math.round(x.n/maxN*(H-10))); const x0=i*colW+(i?2:0), x1=(i+1)*colW-2, y=H-h; const rr=Math.min(r,h);
     const d=`M${x0},${H} L${x0},${y+rr} Q${x0},${y} ${x0+rr},${y} L${x1},${y} L${x1},${H} Z`;
     svg+=`<path class="fseg" data-st="${esc(x.st)}" d="${d}" fill="${STAGE_COL[i]}"${fStage.value===x.st?' stroke="#1a61ff" stroke-width="3"':''}/>`;
     if(h>=40) svg+=`<text x="${x0+12}" y="${y+26}" font-family="Inter" font-size="14" font-weight="800" fill="#fff" pointer-events="none">${x.n}</text><text x="${x0+12}" y="${y+42}" font-family="Inter" font-size="10.5" font-weight="600" fill="rgba(255,255,255,.8)" pointer-events="none">${money(x.v)}</text>`;
     else svg+=`<text x="${x0+12}" y="${y-8}" font-family="Inter" font-size="13" font-weight="800" fill="#101820" pointer-events="none">${x.n}</text>`;
   });
   svg+='</svg>';
   el.innerHTML=`<div class="fhead" style="grid-template-columns:repeat(${n},1fr)">${act.map((x,i)=>`<div>${i+1}- ${esc(fLabel(x))}</div>`).join('')}</div><div class="fun">${svg}</div>
     <div class="flabels" style="grid-template-columns:repeat(${n},1fr);margin-top:12px">${act.map((x,i)=>`<div><div class="n"><i style="background:${STAGE_COL[i]}"></i>${x.n} <span class="muted" style="font-weight:500">deals</span></div><div class="m"><b style="color:var(--db-black-6)">${money(x.v)}</b> · ${pct(x.n/totN,0)} de los deals activos + won</div></div>`).join('')}</div>`;
   el.querySelectorAll('.fseg').forEach(el2=>el2.onclick=()=>{document.getElementById('fStage').value=el2.dataset.st; renderPipeline(); document.getElementById('secStage').scrollIntoView({behavior:'smooth',block:'start'})});
   const L=byS[5]; document.getElementById('lostBox').innerHTML=`<div class="label" style="color:var(--ch-lost)">Lost · fuera del embudo</div><div class="v num">${money(L.v)}</div><div class="m"><b>${L.n} deals</b> perdidos · ${pct(L.v/totV,0)} del valor del CRM</div><div class="divider" style="margin:14px 0 10px"></div><div class="stat"><span class="muted">Conversion rate</span><b class="num">${pct(conv)}</b></div><div class="stat"><span class="muted">Won ÷ (Won + Lost) · valor</span><b class="num">${pct(convV)}</b></div><div class="m" style="margin-top:8px">Clic para ver los deals perdidos</div>`;
   document.getElementById('lostBox').onclick=()=>{document.getElementById('fStage').value=LOST; renderPipeline(); document.getElementById('secStage').scrollIntoView({behavior:'smooth',block:'start'})};
  }
  const mx=Math.max(...byS.map(x=>x.v),1);
  document.getElementById('ppStages').innerHTML=byS.map((x,i)=>`<div class="stage" style="cursor:pointer" data-st="${esc(x.st)}"><div class="r"><b><i class="dot" style="background:${STAGE_COL[i]};margin-right:8px"></i>${esc(fLabel(x))}</b><span class="num">${x.n} deals · ${money(x.v)} · ${pct(x.v/totV,0)}</span></div><div class="bar" style="height:10px"><i style="width:${Math.max(1.5,x.v/mx*100)}%;background:${STAGE_COL[i]}"></i></div></div>`).join('')+`<div class="muted" style="font-size:12px;margin-top:6px">Conversión por etapa relativa al total del CRM (${money(totV)})</div>`;
  const rel=[...open,...won]; const rv=sum(rel.map(d=>d.val))||1;
  const bu=Object.entries(groupBy(rel,d=>d.bu)).map(([k,x])=>({k,n:x.length,v:sum(x.map(d=>d.val))})).sort((a,b)=>b.v-a.v);
  document.getElementById('ppBU').innerHTML=bu.map((x,i)=>`<div class="stage ${i===0?'won':''}"><div class="r"><b>${esc(x.k)}</b><span class="num">${x.n} deals · ${money(x.v)} · ${pct(x.v/rv,0)}</span></div><div class="bar"><i style="width:${x.v/(bu[0].v||1)*100}%"></i></div></div>`).join('')||'<div class="empty">Sin deals</div>';
  const src=Object.entries(groupBy(DD,d=>d.src)).map(([k,x])=>({k,n:x.length,w:x.filter(d=>d.stage===WON).length,v:sum(x.map(d=>d.val))})).sort((a,b)=>b.n-a.n);
  document.getElementById('ppSrc').innerHTML=src.map(x=>`<div class="stat"><span>${esc(x.k)} <span class="muted" style="font-size:11px">· ${x.w} won</span></span><b class="num">${x.n} <span class="muted" style="font-weight:400">· ${money(x.v)}</span></b></div>`).join('')||'<div class="empty">Sin deals</div>';
  {const sw=src.map(x=>sum(DD.filter(d=>d.src===x.k&&d.stage===WON).map(d=>d.val))), sa=src.map(x=>sum(DD.filter(d=>d.src===x.k&&OPEN.includes(d.stage)).map(d=>d.val))), sl=src.map(x=>sum(DD.filter(d=>d.src===x.k&&d.stage===LOST).map(d=>d.val)));
  chart('chSrc',{tooltip:{...tip,formatter:ps=>{const i=ps[0].dataIndex, x=src[i]; return `<b>${esc(x.k)}</b><br>${x.n} deals · ${x.w} won<br>Won ${moneyFull(sw[i])}<br>Activos ${moneyFull(sa[i])}<br>Lost ${moneyFull(sl[i])}`}},grid:{left:4,right:12,top:4,bottom:4,containLabel:true},
    xAxis:{type:'value',splitNumber:4,...axisBase,axisLabel:{color:C.txt,fontSize:10,formatter:v=>money(v)}},yAxis:{type:'category',inverse:true,data:src.map(x=>`${x.k}  (${x.n})`),...axisBase,splitLine:{show:false},axisLabel:{color:C.black,fontSize:11,fontWeight:500}},
    series:[{name:'Won',type:'bar',stack:'s',data:sw,itemStyle:{color:S.won},barMaxWidth:16},{name:'Activos',type:'bar',stack:'s',data:sa,itemStyle:{color:S.dark}},{name:'Lost',type:'bar',stack:'s',data:sl,itemStyle:{color:S.lost}}]})}
  const age=d=>Math.round((snap-new Date(d.created+'T12:00:00'))/864e5);
  const buckets=[['< 30 días',0,30],['30–60',30,60],['60–90',60,90],['90–180',90,180],['> 180',180,1e9]].map(([k,a,b])=>{const x=open.filter(d=>age(d)>=a&&age(d)<b); return {k,n:x.length,v:sum(x.map(d=>d.val))}});
  chart('chAge',{tooltip:{...tip,formatter:ps=>{const x=buckets[ps[0].dataIndex]; return `<b>${x.k}</b><br>${x.n} deals · ${moneyFull(x.v)}`}},grid:{left:8,right:8,top:24,bottom:4,containLabel:true},xAxis:{type:'category',data:buckets.map(b=>b.k),...axisBase,splitLine:{show:false}},yAxis:yMoney,
    series:[{type:'bar',barMaxWidth:44,data:buckets.map((b,i)=>({value:b.v,itemStyle:{color:i>=3?S.dark:S.won}})),label:{show:true,position:'top',color:C.txt,fontSize:11,formatter:x=>buckets[x.dataIndex].n+' deals'}}]});
  const ins=[]; const old=open.filter(d=>age(d)>90);
  if(late.length) ins.push({b:true,ic:IC.flag,tag:'Cierre',t:`${late.length} deals por ${money(sum(late.map(d=>d.val)))} están a un paso de decisión`,p:`In Progress + Due Diligence concentran ${pct(sum(late.map(d=>d.val))/(oV||1),0)} del pipe activo.`});
  if(old.length){const o=[...old].sort((a,b)=>a.created.localeCompare(b.created))[0]; ins.push({ic:IC.clock,tag:'Antigüedad',t:`${old.length} deals activos llevan más de 90 días en el pipe`,p:`${money(sum(old.map(d=>d.val)))} en riesgo de enfriarse. El más antiguo: ${esc(o.company||o.name)} (${o.created}).`})}
  if(bu[0]) ins.push({ic:IC.up,tag:'BU',t:`${bu[0].k} concentra ${pct(bu[0].v/rv,0)} del pipe activo + won`,p:`${bu[0].n} deals por ${money(bu[0].v)}.`});
  const bs=src.filter(x=>x.n>=3).sort((a,b)=>(b.w/b.n)-(a.w/a.n))[0]; if(bs) ins.push({ic:IC.users,tag:'Fuente',t:`${bs.k} es la fuente que más convierte (${pct(bs.w/bs.n,0)})`,p:`${bs.w} won de ${bs.n} deals.`});
  const zero=open.filter(d=>!d.val); if(zero.length) ins.push({ic:IC.tag,tag:'Dato',t:`${zero.length} deals activos sin valor capturado en Attio`,p:`No suman al pipe activo hasta que se les asigne monto.`});
  document.getElementById('ppInsights').innerHTML=ins.map(x=>`<div class="item"><div class="ic ${x.b?'b':''}">${x.ic}</div><div><h4>${x.t}</h4><p>${x.p}</p></div><div><span class="tag ${x.b?'b':''}">${x.tag}</span></div></div>`).join('')||'<div class="empty">Sin hallazgos para este filtro</div>';
  {const el=document.getElementById('fStage'); const cur=el.value||'3. In Progress'; el.innerHTML=STAGES.map(st=>{const n=DD.filter(d=>d.stage===st).length; return `<option value="${esc(st)}" ${st===cur?'selected':''}>${esc(st.replace(' 🎉',''))} · ${n}</option>`}).join('')}
  const stSel=fStage.value; const rows=DD.filter(d=>d.stage===stSel).sort((a,b)=>b.val-a.val); const stN=rows.length, stV=sum(rows.map(d=>d.val));
  document.getElementById('stageTitle').textContent=stSel.replace(/^\d\. /,'').replace(' 🎉',''); document.querySelector('#stagePill span').textContent=`${stN} deals · ${money(stV)} · ${pct(stV/((oV+wV+lV)||1),0)} del total`;
  document.getElementById('tblDeals').innerHTML=`<thead><tr><th>Deal</th><th>Empresa</th><th>Etapa</th><th>BU</th><th>Solución</th><th>Fuente</th><th class="r">Creado</th><th class="r">Días</th><th class="r" title="Días en la etapa actual, estimados con el historial de snapshots">En etapa</th><th class="r">Valor MXN</th></tr></thead><tbody>${rows.map(d=>`<tr><td><b>${esc(d.name)}</b></td><td>${esc(d.company||'—')}</td><td><span class="st ${d.stage===WON?'g':d.stage===LOST?'l':'n'}">${esc(d.stage.replace(/^\d\. /,'').replace(' 🎉',''))}</span></td><td>${esc(d.bu)}</td><td>${esc(d.sol)}</td><td>${esc(d.src)}</td><td class="r num muted">${d.created}</td><td class="r num">${age(d)}</td><td class="r num muted">${stageDaysCell(d)}</td><td class="r num"><b>${d.val?moneyFull(d.val):'<span class="tag">sin monto</span>'}</b></td></tr>`).join('')||'<tr><td colspan="10" class="empty">Sin deals en esta etapa</td></tr>'}<tr class="tot"><td colspan="9">Total · ${rows.length} deals</td><td class="r num">${moneyFull(sum(rows.map(d=>d.val)))}</td></tr></tbody>`;
  renderPipeExtras({DD,open,won,lost,snap,oV,wV,lV});
}
document.getElementById('fStage').onchange=renderPipeline;
document.getElementById('ppStages').onclick=e=>{const st=e.target.closest('.stage[data-st]'); if(!st) return; document.getElementById('fStage').value=st.dataset.st; renderPipeline(); document.getElementById('secStage').scrollIntoView({behavior:'smooth',block:'start'})};
