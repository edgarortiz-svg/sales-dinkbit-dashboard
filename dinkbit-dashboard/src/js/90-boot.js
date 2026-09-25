/* ================= BOOT ================= */
document.getElementById('fCut').textContent=qLabel(LAST_Q); document.getElementById('fN').textContent=R.length;
const snapStr=new Date(PIPE.meta.snapshot_date+'T12:00:00').toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'});
document.getElementById('fSnap').textContent=snapStr; document.getElementById('fD').textContent=D.length; document.getElementById('nDeals').textContent=D.length;
if(!applyHash()){ buildNav(); show('sales'); renderSalesView(); renderPipeline() } else renderPipeline(); syncHash(false); _lastW=document.querySelector('.main').clientWidth; _ro.observe(document.querySelector('.main'));
setTimeout(()=>charts.forEach(c=>c.resize()),60);
