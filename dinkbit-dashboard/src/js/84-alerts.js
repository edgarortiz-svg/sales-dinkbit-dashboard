/* ================= ESTADO DE LOS DATOS (alertas) ================= */
/* level: 'warn' (amarillo) | 'info' (azul). Se calculan en el navegador con la fecha de HOY,
   así el aviso de "datos viejos" aparece solo aunque nadie vuelva a hacer build. */
const TODAY = new Date();
const daysAgo = iso=>Math.floor((TODAY-dOf(iso))/dayMs);
const qEnd = q=>{ const [y,n]=q.split('-Q').map(Number); return new Date(y,n*3,0,12) };   // último día del trimestre
const curQ = ()=>`${TODAY.getFullYear()}-Q${Math.floor(TODAY.getMonth()/3)+1}`;
const sheetQ = s=>{ const m=/^Q([1-4])\s*\|\s*(\d{4})/.exec(s||''); return m?`${m[2]}-Q${m[1]}`:null };

function renderAlerts(id,list){
  const el=document.getElementById(id); if(!el) return;
  if(!list.length){ el.innerHTML=''; return }
  const warn=list.filter(a=>a.level==='warn'||a.level==='error').length;
  el.innerHTML=`<details class="card alertbox" ${warn?'open':''}><summary><span class="label">Estado de los datos</span><span class="pill ${warn?'':'dark'}" style="margin-left:10px"><i></i>${warn?warn+' aviso'+(warn>1?'s':''):'Sin avisos críticos'}</span><span class="muted" style="font-size:12px;margin-left:10px">${list.length} nota${list.length>1?'s':''}</span></summary>
    <div class="alist">${list.map(a=>`<div class="arow ${a.level==='info'?'i':'w'}"><span class="tag ${a.level==='info'?'b':''}">${a.level==='info'?'Nota':'Aviso'}</span><span>${a.msg}</span></div>`).join('')}</div></details>`;
}

function salesAlerts(){
  const out=[], p=P(), rows=periodRows(), inPeriod=q=>{ if(p.kind==='all') return true; if(p.kind==='year') return q.startsWith(p.year+'-'); return q===`${p.year}-Q${p.q}` };
  // 1) frescura del Excel
  const cq=curQ();
  if(cq>LAST_Q){ const d=Math.floor((TODAY-qEnd(LAST_Q))/dayMs);
    out.push({level:d>45?'warn':'info',msg:`El Excel llega hasta <b>${qLabel(LAST_Q)}</b>; el trimestre en curso (${qLabel(cq)}) todavía no tiene hoja. ${qLabel(LAST_Q)} cerró hace ${d} días.`}) }
  // 2) huecos
  const miss=(SALES.meta.missing_quarters||[]).filter(inPeriod);
  if(miss.length) out.push({level:'info',msg:`Sin hoja en el Excel: <b>${miss.map(qLabel).join(', ')}</b>. Aparece como hueco "SIN REPORTE"; no se rellena con datos de otra fuente.`});
  // 3) comparabilidad: años sin ninguna propuesta Pendiente
  const noPend=YEARS.filter(y=>{ const r=R.filter(x=>x.year===y); return r.length&&!r.some(x=>x.status==='Pendiente') });
  const hasPend=YEARS.some(y=>R.some(x=>x.year===y&&x.status==='Pendiente'));
  const touched=noPend.filter(y=>p.kind==='all'||(p.kind!=='all'&&p.year===y));
  if(hasPend&&touched.length) out.push({level:'info',msg:`En ${noPend.join(' y ')} el Excel no registra propuestas <b>Pendientes</b> (todas figuran como Ganada o Perdida). Su Hit Rate no es directamente comparable con los años que sí las registran.`});
  // 4) avisos del parser (por hoja o globales)
  (SALES.meta.quality||[]).filter(a=>a.code!=='trimestres_sin_hoja').forEach(a=>{ const q=sheetQ(a.sheet); if(q?inPeriod(q):p.kind==='all') out.push({level:a.level==='error'?'warn':a.level,msg:esc(a.msg)}) });
  out.push({level:'info',msg:`Datos cargados el ${new Date(SALES.meta.generated).toLocaleDateString('es-MX',{day:'2-digit',month:'long',year:'numeric'})} desde ${esc(SALES.meta.source)} · ${SALES.meta.record_count} propuestas.`});
  return out;
}

function pipeAlerts(ctx){
  const out=[], age=daysAgo(PIPE.meta.snapshot_date), lim=CFG.snapshot_stale_days||8;
  if(age>lim) out.push({level:'warn',msg:`El snapshot tiene <b>${age} días</b> (${PIPE.meta.snapshot_date}). Con lecturas semanales, ya toca actualizarlo desde Attio.`});
  const zero=ctx.open.filter(d=>!d.val);
  if(zero.length) out.push({level:'info',msg:`<b>${zero.length}</b> deals activos sin monto en Attio: se cuentan pero no suman al pipe ni al ponderado.`});
  const nc=ctx.DD.filter(d=>!d.company).length;
  if(nc) out.push({level:'info',msg:`${nc} deals no tienen empresa asociada en Attio.`});
  const al=PIPE.deals.filter(d=>SRC_ALIAS[(d.src||'').trim()]);
  if(al.length) out.push({level:'info',msg:`Se unificaron variantes de escritura de la fuente en ${al.length} deal(s) (${[...new Set(al.map(d=>d.src.trim()+' → '+SRC_ALIAS[d.src.trim()]))].join(', ')}).`});
  if(HS.length<2) out.push({level:'info',msg:`El historial tiene un solo snapshot: los cambios, la tendencia y los tiempos por etapa aparecerán con la próxima actualización.`});
  else if(HS.length>=2){ const gap=daysBetween(HS[HS.length-2].date,HS[HS.length-1].date); if(gap>14) out.push({level:'info',msg:`Los dos últimos snapshots están separados por ${gap} días; los tiempos por etapa tendrán poca resolución.`}) }
  out.push({level:'info',msg:`Snapshot del ${PIPE.meta.snapshot_date} · ${PIPE.meta.deal_count} deals · ${HS.length} snapshot${HS.length>1?'s':''} en el historial.`});
  return out;
}
