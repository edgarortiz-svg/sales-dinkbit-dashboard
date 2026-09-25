/* ================= PROPUESTAS ================= */
let propPage=1, propSort={k:'quarter',dir:-1}; const PAGE=40;
function fillSelect(id,label,vals){ const el=document.getElementById(id); if(!el) return; const cur=el.value; el.innerHTML=`<option value="">${label}: todos</option>`+vals.map(v=>`<option ${v===cur?'selected':''}>${esc(v)}</option>`).join('') }
function renderProps(){
  if(!document.getElementById('tblProps')) return;
  const base=periodRows();
  const cats=k=>Object.keys(SALES.meta.catalogs[k]).filter(v=>base.some(r=>r[k]===v));
  fillSelect('fArea','Área',cats('area')); fillSelect('fOrigen','Origen',cats('origen')); fillSelect('fProy','Proyecto',cats('proyecto')); fillSelect('fStatus','Status',cats('status'));
  if(window._pf){ const m={area:'fArea',origen:'fOrigen',proyecto:'fProy',status:'fStatus'}; Object.entries(m).forEach(([k,id])=>{ if(window._pf[k]) document.getElementById(id).value=window._pf[k] }); window._pf=null }
  const f={area:fArea.value,origen:fOrigen.value,proyecto:fProy.value,status:fStatus.value};
  let rows=base.filter(r=>(!f.area||r.area===f.area)&&(!f.origen||r.origen===f.origen)&&(!f.proyecto||r.proyecto===f.proyecto)&&(!f.status||r.status===f.status)&&(!state.search||(r.nombre+' '+(r.proyecto||'')+' '+(r.area||'')).toLowerCase().includes(state.search)));
  rows=[...rows].sort((a,b)=>{const k=propSort.k; let x=a[k],y=b[k]; if(k==='quarter'){x=a.quarter+String(a.month).padStart(2,'0');y=b.quarter+String(b.month).padStart(2,'0')} if(x==null) return 1; if(y==null) return -1; return (x>y?1:x<y?-1:0)*propSort.dir});
  const s=stats(rows); const pages=Math.max(1,Math.ceil(rows.length/PAGE)); propPage=Math.min(propPage,pages);
  const cols=[['quarter','Periodo'],['nombre','Nombre'],['origen','Origen'],['area','Área'],['proyecto','Proyecto'],['valor','Valor MXN','r'],['status','Status']];
  document.getElementById('tblProps').innerHTML=`<thead><tr>${cols.map(c=>`<th class="sort ${c[2]||''} ${propSort.k===c[0]?'on':''}" data-k="${c[0]}">${c[1]} ${propSort.k===c[0]?(propSort.dir>0?'↑':'↓'):''}</th>`).join('')}</tr></thead><tbody>${rows.slice((propPage-1)*PAGE,propPage*PAGE).map(r=>`<tr><td class="num muted" style="font-size:12px">${qLabel(r.quarter)} · ${MES[(r.month||1)-1]}</td><td><b>${esc(r.nombre)}</b></td><td>${esc(r.origen||'—')}</td><td>${esc(r.area||'—')}</td><td>${esc(r.proyecto||'—')}</td><td class="r num">${r.valor!=null?moneyFull(r.valor):'—'}</td><td>${stBadge(r.status)}</td></tr>`).join('')||`<tr><td colspan="7" class="empty">Sin propuestas con esos filtros</td></tr>`}</tbody>`;
  document.getElementById('tfInfo').innerHTML=`<b>${rows.length}</b> propuestas · ${money(s.total)} emitido · <span class="blue">${money(s.won)} Accrued</span> · HR $ ${pct(s.hitRev)} · HR # ${pct(s.hitCnt)}`;
  document.getElementById('tfPg').innerHTML=Array.from({length:pages},(_,i)=>i+1).filter(x=>Math.abs(x-propPage)<=3||x===1||x===pages).map(x=>`<button class="${x===propPage?'on':''}" data-p="${x}">${x}</button>`).join('');
  window._propRows=rows;
}
function csv(){ const rows=window._propRows||periodRows(); const h=['Periodo','Mes','Nombre','Origen','Area','Proyecto','Valor','Status']; const body=rows.map(r=>[r.quarter,r.month,r.nombre,r.origen,r.area,r.proyecto,r.valor,r.status].map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')); const blob=new Blob(['﻿'+[h.join(','),...body].join('\n')],{type:'text/csv;charset=utf-8'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`propuestas-dinkbit-${periodLabel().replace(/\s/g,'-')}.csv`; a.click()}
