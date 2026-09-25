/* ================= DATA ================= */
const SALES = JSON.parse(document.getElementById('sales').textContent);
const PIPE  = JSON.parse(document.getElementById('pipe').textContent);
const R = SALES.records;
/* Alias de fuentes de Attio escritas de más de una forma (solo pipeline; la taxonomía del Excel no se toca) */
const SRC_ALIAS = {'Linked In':'LinkedIn','Linkedin':'LinkedIn','linkedin':'LinkedIn'};
const D = PIPE.deals.map(d=>({...d, src: SRC_ALIAS[(d.src||'').trim()] || (d.src||'').trim()}));
const STAGES = PIPE.meta.stages;
const OPEN = STAGES.slice(0,4), WON = STAGES[4], LOST = STAGES[5];

const C = {blue:'#1a61ff',black:'#101820',gray:'#c3c3c3',soft:'#7aa0ff',tint:'#1a61ff14',txt:'#5c6670',grid:'#ececec',off:'#f6f6f6'};
/* Paleta de series (solo gráficas): rampa tonal del Neon Blue + negro como línea de contraste */
const STAGE_COL=['#101820','#101820','#101820','#101820','#1a61ff','#f04134'];
const S = {won:'#1a61ff',lost:'#f04134',pend:'#c3c3c3',dark:'#101820',soft:'#7aa0ff',pale:'#e3ebff',line:'#101820',tint:'#1a61ff14'};
const MES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
const MESL = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const Q_ALL = (()=>{const qs=SALES.meta.quarters; const [y0,q0]=qs[0].split('-Q').map(Number), [y1,q1]=qs[qs.length-1].split('-Q').map(Number); const a=[]; let y=y0,q=q0; while(y<y1||(y===y1&&q<=q1)){a.push(`${y}-Q${q}`); if(++q>4){q=1;y++}} return a})();
const Q_HAS = new Set(SALES.meta.quarters);
const YEARS = [...new Set(Q_ALL.map(q=>+q.slice(0,4)))];
const LAST_Q = SALES.meta.quarters[SALES.meta.quarters.length-1];
