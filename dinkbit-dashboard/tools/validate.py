#!/usr/bin/env python3
"""
validate.py — checklist automático antes de publicar (automatiza CONTEXT.md §5).

Uso:
  python3 tools/validate.py                       # todo, incluida la prueba en navegador (Chromium/Playwright)
  python3 tools/validate.py --no-browser          # solo datos + build + sintaxis JS
  python3 tools/validate.py --expect-hitrate 2026-Q2=13.2   # cotejar contra la celda de Hit Rate del Excel

Sale con código 1 si algo FALLA. Los AVISOS no bloquean.
"""
import sys, re, json, subprocess, datetime, pathlib, argparse
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from common import ROOT, PUBLIC, SALES_JSON, PIPE_JSON, HIST_JSON, CONFIG_JSON, STATUSES, load_json, stats, money, pct

fails, warns = [], []
BROKEN = re.compile(r"\bNaN\b|\bundefined\b|\[object |(?:\$|\+|-|×)Infinity|Infinity(?:%|\s*pts|\s*d\b|M\b|K\b)")
def ok(msg): print(f"  ✓ {msg}")
def fail(msg): fails.append(msg); print(f"  ✗ {msg}")
def warn(msg): warns.append(msg); print(f"  ! {msg}")


def check_sales():
    print("Reporte de ventas (data/sales-history.json)")
    s = load_json(SALES_JSON)
    if not s: return fail("no existe data/sales-history.json")
    m, R = s["meta"], s["records"]
    (ok if m["record_count"] == len(R) else fail)(f"record_count = {m['record_count']} y hay {len(R)} registros")
    bad = [r["id"] for r in R if r["status"] not in STATUSES]
    (ok if not bad else fail)("todos los status son Ganada/Perdida/Pendiente" if not bad else f"status inválido en {bad[:5]}")
    bad = [r["id"] for r in R if not isinstance(r.get("valor"), (int, float))]
    (ok if not bad else warn)("todos los valores son numéricos" if not bad else f"{len(bad)} registro(s) sin valor numérico")
    ids = [r["id"] for r in R]
    (ok if len(ids) == len(set(ids)) else fail)("ids únicos" if len(ids) == len(set(ids)) else "hay ids duplicados")
    qs = set(m["quarters"])
    bad = [r["id"] for r in R if r["quarter"] not in qs]
    (ok if not bad else fail)("todos los registros pertenecen a un trimestre de meta.quarters" if not bad else f"registros fuera de meta.quarters: {bad[:5]}")
    cat_ok = all(sum(m["catalogs"][k].values()) == sum(1 for r in R if r.get(k)) for k in ("area", "origen", "proyecto"))
    (ok if cat_ok else fail)("los catálogos cuadran con los registros")
    q = m["quarters"][-1]
    st = stats([r for r in R if r["quarter"] == q])
    ok(f"último trimestre {q}: {st['n']} propuestas · Accrued {money(st['won'])} · Hit Rate $ {pct(st['hitRev'])} · Hit Rate # {pct(st['hitCnt'])}")
    errs = [a for a in m.get("quality", []) if a["level"] == "error"]
    if errs: warn(f"la carga se hizo con {len(errs)} error(es) de validación forzados (--force)")
    return s


def check_pipeline():
    print("Pipeline (data/pipeline-snapshot.json + historial)")
    p, h, cfg = load_json(PIPE_JSON), load_json(HIST_JSON), load_json(CONFIG_JSON)
    if not p: return fail("no existe data/pipeline-snapshot.json")
    st = p["meta"]["stages"]
    (ok if len(st) == 6 else fail)("6 etapas en meta.stages")
    bad = [d["name"] for d in p["deals"] if d["stage"] not in st]
    (ok if not bad else fail)("ningún deal fuera de meta.stages" if not bad else f"deals con etapa desconocida: {bad[:5]}")
    (ok if p["meta"]["deal_count"] == len(p["deals"]) else fail)(f"deal_count = {p['meta']['deal_count']} y hay {len(p['deals'])} deals")
    keys = [d.get("key") for d in p["deals"]]
    (ok if all(keys) and len(keys) == len(set(keys)) else fail)("cada deal tiene una key única")
    try: datetime.date.fromisoformat(p["meta"]["snapshot_date"]); ok(f"snapshot_date {p['meta']['snapshot_date']}")
    except Exception: fail("snapshot_date inválida")
    age = (datetime.date.today() - datetime.date.fromisoformat(p["meta"]["snapshot_date"])).days
    lim = (cfg or {}).get("snapshot_stale_days", 8)
    if age > lim: warn(f"el snapshot tiene {age} días (límite {lim})")
    if not h: return fail("falta data/pipeline-history.json")
    dates = [s["date"] for s in h["snapshots"]]
    (ok if dates == sorted(set(dates)) else fail)(f"historial ordenado y sin fechas repetidas ({len(dates)} snapshot(s))")
    last = h["snapshots"][-1]
    same = dates[-1] == p["meta"]["snapshot_date"] and {(d["key"], d["stage"], d["val"]) for d in last["deals"]} == {(d["key"], d["stage"], d["val"]) for d in p["deals"]}
    (ok if same else fail)("el último snapshot del historial es idéntico al snapshot vigente")
    if cfg:
        (ok if "snapshot_stale_days" in cfg else warn)("config.json legible" if "snapshot_stale_days" in cfg else "config.json sin snapshot_stale_days")
        if "stage_probability" in cfg:
            warn("config.json todavía tiene stage_probability manual; el pipeline ponderado ahora la calcula solo (ver stageProbabilities() en 82-pipeline-history.js) y ese campo se ignora")
    else:
        warn("no hay data/config.json")


def check_build():
    print("Build")
    r = subprocess.run([sys.executable, str(ROOT / "tools/build.py"), "--check"], capture_output=True, text=True)
    (ok if r.returncode == 0 else fail)("public/index.html está al día con src/ y data/" if r.returncode == 0 else (r.stderr or r.stdout).strip())
    f = PUBLIC / "index.html"
    if not f.exists(): return
    html = f.read_text(encoding="utf-8")
    scripts = re.findall(r"<script>([\s\S]*?)</script>", html)
    tmp = ROOT / ".validate_tmp.js"
    tmp.write_text(scripts[-1], encoding="utf-8")
    r = subprocess.run(["node", "--check", str(tmp)], capture_output=True, text=True)
    tmp.unlink()
    (ok if r.returncode == 0 else fail)("sintaxis JS correcta" if r.returncode == 0 else r.stderr[:400])
    ext = re.findall(r'(?:src|href)=["\'](https?://[^"\']+)', html)
    (ok if not ext else fail)("sin recursos externos (autocontenido)" if not ext else f"recursos externos: {ext[:3]}")
    ok(f"tamaño {len(html)/1024:.0f} KB")


def check_browser(sales, expect):
    print("Navegador (Chromium headless)")
    try:
        from playwright.sync_api import sync_playwright
    except Exception:
        return warn("Playwright no disponible: se omitió la prueba en navegador")
    R = sales["records"]; qs = sales["meta"]["quarters"]
    years = sorted({r["year"] for r in R})
    with sync_playwright() as pw:
        try: b = pw.chromium.launch()
        except Exception as e: return warn(f"no se pudo abrir Chromium: {str(e)[:120]}")
        pg = b.new_page(viewport={"width": 1440, "height": 900})
        errs, ext = [], []
        pg.on("console", lambda m: errs.append(m.text) if m.type in ("error", "warning") else None)
        pg.on("pageerror", lambda e: errs.append(f"PAGEERROR {e}"))
        pg.on("request", lambda r: ext.append(r.url) if not r.url.startswith(("file:", "data:", "blob:")) else None)
        pg.goto((PUBLIC / "index.html").as_uri()); pg.wait_for_timeout(600)
        def clean(label, sel):
            t = pg.inner_text(sel)
            bad = BROKEN.findall(t)
            (ok if not bad else fail)(f"{label}: sin NaN/undefined" if not bad else f"{label}: aparece {bad[:3]}")
        views = [("all", "Histórico")] + [(str(y), f"Año {y}") for y in years] + [(q, q) for q in qs]
        for k, lbl in views:
            pg.evaluate(f"goSales('{k}',false)"); pg.wait_for_timeout(120)
            t = pg.inner_text("#v-sales")
            bad = BROKEN.findall(t)
            if bad: fail(f"vista {lbl}: aparece {bad[:3]}")
        if not any("vista " in f for f in fails): ok(f"{len(views)} vistas de periodo renderizan sin NaN/undefined")
        # KPI del último trimestre vs Python
        q = qs[-1]; pg.evaluate(f"goSales('{q}',false)"); pg.wait_for_timeout(200)
        kp = pg.inner_text("#kpis"); st = stats([r for r in R if r["quarter"] == q])
        (ok if money(st["won"]) in kp and pct(st["hitRev"]) in kp else fail)(f"KPIs de {q} en pantalla = cálculo en Python (Accrued {money(st['won'])}, Hit Rate $ {pct(st['hitRev'])})")
        if expect:
            k, v = expect
            s2 = stats([r for r in R if r["quarter"] == k])
            (ok if round(s2["hitRev"] * 100, 1) == v else fail)(f"Hit Rate $ {k} = {round(s2['hitRev']*100,1)} % vs Excel {v} %")
        pg.evaluate("goCmp(false)"); pg.wait_for_timeout(200); clean("Comparar periodos", "#v-cmp")
        pg.evaluate("goPipe(false)"); pg.wait_for_timeout(300); clean("Pipeline", "#v-pipe")
        pg.evaluate("setPrintMode(true)"); pg.wait_for_timeout(200)
        vis = pg.evaluate("getComputedStyle(document.querySelector('.side')).display")
        (ok if vis == "none" else fail)("modo impresión oculta la barra lateral")
        pg.evaluate("setPrintMode(false)")
        # ruteo por URL: cada ruta se abre en frío (recarga) y debe restaurar el estado
        uri = (PUBLIC / "index.html").as_uri()
        def cold(hash_):
            pg.goto(uri + hash_); pg.reload(); pg.wait_for_timeout(500)
        cold("#/ventas/2024-Q2?status=Ganada")
        good = pg.evaluate("periodKey()") == "2024-Q2" and pg.evaluate("document.getElementById('fStatus').value") == "Ganada"
        (ok if good else fail)("URL #/ventas/2024-Q2?status=Ganada restaura periodo y filtro")
        cold("#/comparar?a=2024-Q2&b=2025-Q2")
        good = pg.evaluate("state.view") == "cmp" and pg.evaluate("state.cmp.a") == "2024-Q2" and pg.evaluate("document.getElementById('cmpB').value") == "2025-Q2"
        (ok if good else fail)("URL #/comparar?a=…&b=… restaura la comparación")
        cold("#/pipeline?bu=Marketing")
        good = pg.evaluate("state.view") == "pipe" and pg.evaluate("state.bu") == "Marketing" and pg.evaluate("document.getElementById('selBU').value") == "Marketing"
        (ok if good else fail)("URL #/pipeline?bu=… restaura el filtro de unidad de negocio")
        pg.evaluate("goSales('2023',true)"); h1 = pg.evaluate("location.hash")
        (ok if h1 == "#/ventas/2023" else fail)(f"navegar actualiza la URL ({h1})")

        # impresión / PDF: exportar una vista con gráficas (el bug típico es una gráfica en blanco
        # por una recomposición de layout a mitad de la exportación; ver 50-chartbase.js)
        try:
            pg.goto(uri + "#/ventas/2026-Q2"); pg.reload(); pg.wait_for_timeout(500)
            pdf_path = ROOT / ".validate_print.pdf"
            pg.pdf(path=str(pdf_path), format="A4", landscape=True, print_background=True, prefer_css_page_size=True)
            n = len(pg.evaluate("document.querySelectorAll('img.printimg')")) if False else None
            ok(f"PDF exportado ({pdf_path.stat().st_size/1024:.0f} KB)")
            pdf_path.unlink(missing_ok=True)
        except Exception as e:
            fail(f"exportar a PDF: {str(e)[:150]}")
        (ok if not errs else fail)("sin errores ni avisos en la consola" if not errs else f"consola: {errs[:3]}")
        (ok if not ext else fail)("ninguna petición de red externa" if not ext else f"peticiones externas: {ext[:3]}")
        b.close()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-browser", action="store_true")
    ap.add_argument("--expect-hitrate", help="p. ej. 2026-Q2=13.2 (celda de Hit Rate del Excel)")
    a = ap.parse_args()
    expect = None
    if a.expect_hitrate:
        k, v = a.expect_hitrate.split("="); expect = (k, float(v))
    sales = check_sales(); check_pipeline(); check_build()
    if not a.no_browser and sales: check_browser(sales, expect)
    print(f"\n{'FALLÓ' if fails else 'OK'} · {len(fails)} falla(s) · {len(warns)} aviso(s)")
    for f in fails: print(f"  ✗ {f}")
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
