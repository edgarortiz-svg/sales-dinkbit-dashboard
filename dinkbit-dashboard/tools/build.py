#!/usr/bin/env python3
"""
build.py — ensambla public/index.html (un solo HTML autocontenido, sin dependencias externas)
a partir de src/ + brand/ + vendor/ + data/.

Uso:  python3 tools/build.py
El build es determinista: mismas entradas → mismo HTML (no incrusta la hora del build).
Nunca se edita public/index.html a mano.
"""
import sys, re, json, base64, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from common import ROOT, SRC, BRAND, VENDOR, PUBLIC, DATA, SALES_JSON, PIPE_JSON, HIST_JSON, CONFIG_JSON, load_json


def js(obj):
    # JSON seguro dentro de <script type="application/json">
    return (json.dumps(obj, ensure_ascii=False, separators=(",", ":"))
            .replace("</", "<\\/").replace("<!--", "<\\!--").replace("\u2028", "\\u2028").replace("\u2029", "\\u2029"))


def fontface():
    man = json.loads((BRAND / "fonts/manifest.json").read_text(encoding="utf-8"))
    css = []
    for name, fn, rng in man:
        b64 = base64.b64encode((ROOT / fn).read_bytes()).decode()
        css.append(f"@font-face{{font-family:'Inter';font-style:normal;font-weight:300 900;font-display:swap;"
                   f"src:url(data:font/woff2;base64,{b64}) format('woff2');unicode-range:{rng};}}")
    return "\n".join(css)


def compact_history(hist, stages):
    """Historial reducido para el front: por snapshot [key, etapa_idx, valor]; datos fijos del deal aparte."""
    sidx = {s: i for i, s in enumerate(stages)}
    info, snaps = {}, []
    for s in hist["snapshots"]:
        rows = []
        for d in s["deals"]:
            rows.append([d["key"], sidx[d["stage"]], d["val"]])
            info[d["key"]] = [d["name"], d.get("company"), d["created"], d.get("bu"), d.get("src")]
        snaps.append({"date": s["date"], "d": rows})
    return {"stages": stages, "snaps": snaps, "info": info}


def main():
    check = "--check" in sys.argv
    idx = (SRC / "index.html").read_text(encoding="utf-8")
    styles = (SRC / "styles.css").read_text(encoding="utf-8")
    tokens = (BRAND / "tokens.css").read_text(encoding="utf-8")
    wm = (BRAND / "logo-dinkbit-wordmark.svg").read_text(encoding="utf-8")
    wm = re.sub(r"<svg ", '<svg class="wm" aria-label="dinkbit" role="img" ', wm, count=1)
    scripts = "\n".join((p.read_text(encoding="utf-8")) for p in sorted((SRC / "js").glob("*.js")))
    echarts = (VENDOR / "echarts.min.js").read_text(encoding="utf-8")
    sales = load_json(SALES_JSON)
    pipe = load_json(PIPE_JSON)
    hist = load_json(HIST_JSON) or {"snapshots": [{"date": pipe["meta"]["snapshot_date"], "deals": pipe["deals"]}]}
    cfg = load_json(CONFIG_JSON, {})
    for need in ("__STYLES__", "__SCRIPT__", "__ECHARTS__", "__SALES_JSON__", "__PIPE_JSON__", "__HIST_JSON__", "__CONFIG_JSON__", "__WORDMARK__"):
        if need not in idx:
            sys.exit(f"ERROR: falta el marcador {need} en src/index.html")
    if "</script" in echarts.lower():
        sys.exit("ERROR: vendor/echarts.min.js contiene </script")

    out = (idx.replace("/*__STYLES__*/", fontface() + "\n" + tokens + "\n" + styles)
              .replace("<!--__WORDMARK__-->", wm)
              .replace("__SALES_JSON__", js(sales))
              .replace("__PIPE_JSON__", js(pipe))
              .replace("__HIST_JSON__", js(compact_history(hist, pipe["meta"]["stages"])))
              .replace("__CONFIG_JSON__", js(cfg)))
    # scripts al final (evita que patrones tipo __X__ dentro de ECharts/JS se reemplacen por error)
    out = out.replace("/*__ECHARTS__*/", echarts).replace("/*__SCRIPT__*/", scripts)
    if check:  # ¿public/index.html está al día con src/ + data/ ?
        cur = (PUBLIC / "index.html").read_text(encoding="utf-8") if (PUBLIC / "index.html").exists() else ""
        if cur != out:
            sys.exit("public/index.html NO está al día: corre  python3 tools/build.py")
        print("public/index.html está al día")
        return
    PUBLIC.mkdir(exist_ok=True)
    (PUBLIC / "index.html").write_text(out, encoding="utf-8")
    (PUBLIC / "robots.txt").write_text("User-agent: *\nDisallow: /\n", encoding="utf-8")
    print(f"public/index.html → {len(out)/1024:.0f} KB · {sales['meta']['record_count']} propuestas · "
          f"{pipe['meta']['deal_count']} deals · {len(hist['snapshots'])} snapshot(s) en historial")


if __name__ == "__main__":
    main()
