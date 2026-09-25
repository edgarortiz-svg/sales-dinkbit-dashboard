/* ================= STATE / PERIODS ================= */
/* period: {kind:'all'} | {kind:'year',year} | {kind:'quarter',year,q} */
const state = {period:{kind:'quarter',year:+LAST_Q.slice(0,4),q:+LAST_Q.slice(-1)}, view:'sales', search:'', bu:'', src:'', stage:'', cmp:{a:null,b:null,norm:false}};
const P=()=>state.period;
function periodRows(p=P()){ if(p.kind==='all') return R; if(p.kind==='year') return R.filter(r=>r.year===p.year); return R.filter(r=>r.quarter===`${p.year}-Q${p.q}`)}
function prevPeriod(p=P()){ if(p.kind==='all') return null; if(p.kind==='year'){ return YEARS.includes(p.year-1)?{kind:'year',year:p.year-1}:null } let y=p.year,q=p.q-1; if(q<1){q=4;y--} return Q_HAS.has(`${y}-Q${q}`)?{kind:'quarter',year:y,q}:null}
function periodLabel(p=P()){ if(p.kind==='all') return `Histórico ${YEARS[0]}–${YEARS[YEARS.length-1]}`; if(p.kind==='year') return `Año ${p.year}`; return `Q${p.q} ${p.year}`}
function periodKey(p=P()){ return p.kind==='all'?'all':p.kind==='year'?String(p.year):`${p.year}-Q${p.q}`}
function pipeRows(){ return D.filter(d=>(!state.bu||d.bu===state.bu)&&(!state.src||d.src===state.src)) }
