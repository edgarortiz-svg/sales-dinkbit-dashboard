/* ================= HELPERS ================= */
const sum = a=>a.reduce((s,x)=>s+(x||0),0);
const money = v=>{v=v||0; const a=Math.abs(v); if(a>=1e6) return '$'+(v/1e6).toFixed(a>=1e7?1:2)+'M'; if(a>=1e3) return '$'+Math.round(v/1e3)+'K'; return '$'+Math.round(v)};
const moneyFull = v=>'$'+Math.round(v||0).toLocaleString('es-MX');
const pct = (v,d=1)=>isFinite(v)?(v*100).toFixed(d)+'%':'—';
const delta = (a,b)=>{ if(b==null||!isFinite(b)||b===0||a==null) return ''; const d=(a-b)/Math.abs(b); if(d>3) return `<small class="pos">×${(a/b).toFixed(1)}</small>`; return `<small class="${d>=0?'pos':'neg'}">${d>=0?'+':''}${(d*100).toFixed(1)}%</small>`};
const deltaPts = (a,b)=>{ if(b==null||a==null||!isFinite(a)||!isFinite(b)) return ''; const d=(a-b)*100; return `<small class="${d>=0?'pos':'neg'}">${d>=0?'+':''}${d.toFixed(1)} pts</small>`};
const esc = s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const qLabel = q=>{const [y,n]=q.split('-Q'); return `Q${n} ${y}`};
const stClass = s=>s==='Ganada'?'g':s==='Perdida'?'p':'n';
const stBadge = s=>`<span class="st ${stClass(s)}">${esc(s)}</span>`;
const groupBy=(arr,fn)=>arr.reduce((m,x)=>{const k=fn(x);(m[k]=m[k]||[]).push(x);return m},{});
function stats(rows){
  const g=rows.filter(r=>r.status==='Ganada'), p=rows.filter(r=>r.status==='Perdida'), n=rows.filter(r=>r.status==='Pendiente');
  const won=sum(g.map(r=>r.valor)), lost=sum(p.map(r=>r.valor)), pend=sum(n.map(r=>r.valor)), total=won+lost+pend;
  return {n:rows.length, won, lost, pend, total, nWon:g.length, nLost:p.length, nPend:n.length,
    hitRev: total? won/total : NaN, hitCnt: rows.length? g.length/rows.length : NaN, ticket: g.length? won/g.length : NaN};
}
function spark(vals){ if(vals.length<2) return ''; const w=84,h=30,mx=Math.max(...vals,1),mn=Math.min(...vals,0); const pts=vals.map((v,i)=>[i/(vals.length-1)*w, h-2-((v-mn)/(mx-mn||1))*(h-6)]); const d='M'+pts.map(p=>p[0].toFixed(1)+','+p[1].toFixed(1)).join('L'); return `<svg class="spark" viewBox="0 0 ${w} ${h}"><path class="a" d="${d}L${w},${h}L0,${h}Z"/><path d="${d}"/></svg>`}
function kpiCard(k){ return `<div class="card kpi ${k.hero?'blue':''}"><div class="label">${k.l}</div><div class="v num">${k.v}${k.d||''}</div><div class="sub"><span>${k.sub||''}</span>${k.sp?spark(k.sp):''}</div></div>`}
const sh=(t,sub)=>`<div class="sh"><h2>${t}</h2>${sub?`<p>${sub}</p>`:''}<div class="ln"></div></div>`;
