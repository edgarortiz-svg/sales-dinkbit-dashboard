#!/usr/bin/env python3
"""
update_pipeline.py — carga un snapshot del pipeline (leído de Attio) y lo suma al historial.

Entrada: un JSON que arma quien lea Attio (Claude vía MCP), con UNO de estos formatos:
  A) {"meta": {"snapshot_date": "2026-09-21", ...}, "deals": [ ... ]}
  B) [ {deal}, {deal}, ... ]  + la opción --date AAAA-MM-DD

Cada deal:  name, company (o null), stage, bu, src, sol, val (MXN, 0 si vacío), created (AAAA-MM-DD)
            id (RECOMENDADO: el record_id de Attio; permite seguir un deal aunque le cambien el nombre)

Uso:
  python3 tools/update_pipeline.py nuevo-snapshot.json [--date AAAA-MM-DD] [--dry-run] [--force]

Efectos:
  · data/pipeline-snapshot.json   → el snapshot vigente (se reemplaza completo)
  · data/pipeline-history.json    → historial de TODOS los snapshots (se agrega; misma fecha = se reemplaza)
  · data/last-pipeline-update.md  → resumen y diferencias vs. el snapshot anterior

Códigos de salida: 0 ok · 2 error fatal · 3 errores de validación (no se escribe sin --force)
"""
import sys, re, json, datetime, pathlib, argparse
from collections import Counter, defaultdict

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from common import (DATA, PIPE_JSON, HIST_JSON, DEFAULT_STAGES, load_json, save_deals_json, norm, money, pct)

REQ = ("name", "stage", "created")
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def stage_map(stages):
    """Acepta la etapa con o sin prefijo numérico/emoji y la lleva al texto exacto de meta.stages."""
    m = {}
    for s in stages:
        m[norm(s)] = s
        m[norm(re.sub(r"^\d+\.\s*", "", s))] = s
        m[norm(re.sub(r"^\d+\.\s*", "", s).replace("🎉", ""))] = s
    return m


def deal_key(d, used):
    base = d.get("id") or f"{norm(d.get('company'))}|{norm(d.get('name'))}"
    k, i = base, 1
    while k in used:
        i += 1
        k = f"{base}#{i}"
    used.add(k)
    return k


def validate(raw_deals, stages, sdate):
    alerts, out, used = [], [], set()
    smap = stage_map(stages)
    for i, d in enumerate(raw_deals):
        lbl = f"deal #{i+1} '{d.get('name')}'"
        miss = [f for f in REQ if d.get(f) in (None, "")]
        if miss:
            alerts.append(dict(level="error", msg=f"{lbl}: faltan campos {', '.join(miss)}."))
            continue
        st = smap.get(norm(d["stage"]))
        if st is None:
            alerts.append(dict(level="error", code="etapa_desconocida",
                               msg=f"{lbl}: etapa '{d['stage']}' no existe en meta.stages. DETENTE y pregunta al usuario cómo tratarla."))
            continue
        if st != d["stage"]:
            alerts.append(dict(level="info", msg=f"{lbl}: etapa '{d['stage']}' normalizada a '{st}'."))
        try:
            val = float(d.get("val") or 0)
        except (TypeError, ValueError):
            alerts.append(dict(level="error", msg=f"{lbl}: val '{d.get('val')}' no es numérico."))
            continue
        if val < 0:
            alerts.append(dict(level="error", msg=f"{lbl}: val negativo ({val})."))
            continue
        created = str(d["created"])[:10]
        if not DATE_RE.match(created):
            alerts.append(dict(level="error", msg=f"{lbl}: created '{d['created']}' no es AAAA-MM-DD."))
            continue
        if created > sdate:
            alerts.append(dict(level="warn", msg=f"{lbl}: created {created} es posterior a la fecha del snapshot {sdate}."))
        nd = {"name": d["name"], "company": d.get("company") or None, "stage": st,
              "bu": d.get("bu") or "Sin BU", "src": (d.get("src") or "Sin fuente").strip(),
              "sol": d.get("sol") or "—", "val": int(val) if val == int(val) else val, "created": created}
        if d.get("id"):
            nd["id"] = d["id"]
        nd["key"] = deal_key(d, used)
        if not d.get("company"):
            alerts.append(dict(level="info", msg=f"{lbl}: sin empresa asociada."))
        out.append(nd)
    return out, alerts


def summarize(deals, stages):
    open_st = stages[:4]
    won_st, lost_st = stages[4], stages[5]
    op = [d for d in deals if d["stage"] in open_st]
    wn = [d for d in deals if d["stage"] == won_st]
    ls = [d for d in deals if d["stage"] == lost_st]
    v = lambda a: sum(d["val"] for d in a)
    return {"n": len(deals), "open_n": len(op), "open_v": v(op), "won_n": len(wn), "won_v": v(wn),
            "lost_n": len(ls), "lost_v": v(ls),
            "conv_n": len(wn) / (len(wn) + len(ls)) if (wn or ls) else None,
            "conv_v": v(wn) / (v(wn) + v(ls)) if (v(wn) + v(ls)) else None}


def diff(prev, cur, stages):
    pk = {d["key"]: d for d in prev}
    ck = {d["key"]: d for d in cur}
    idx = {s: i for i, s in enumerate(stages)}
    new = [d for k, d in ck.items() if k not in pk]
    gone = [d for k, d in pk.items() if k not in ck]
    moved, valchg = [], []
    for k, d in ck.items():
        if k in pk:
            o = pk[k]
            if o["stage"] != d["stage"]:
                moved.append((o, d))
            if o["val"] != d["val"]:
                valchg.append((o, d))
    return new, gone, moved, valchg, idx


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("input")
    ap.add_argument("--date")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--force", action="store_true")
    a = ap.parse_args()

    try:
        raw = json.loads(pathlib.Path(a.input).read_text(encoding="utf-8"))
    except Exception as e:
        print(f"ERROR: no se pudo leer {a.input}: {e}", file=sys.stderr)
        return 2
    meta_in = raw.get("meta", {}) if isinstance(raw, dict) else {}
    deals_in = raw.get("deals") if isinstance(raw, dict) else raw
    if not isinstance(deals_in, list) or not deals_in:
        print("ERROR: el JSON no trae una lista 'deals' con contenido.", file=sys.stderr)
        return 2

    cur_snap = load_json(PIPE_JSON)
    stages = (meta_in.get("stages") or (cur_snap or {}).get("meta", {}).get("stages") or DEFAULT_STAGES)
    if len(stages) != 6:
        print("ERROR: meta.stages debe tener 6 etapas (4 activas, Won, Lost).", file=sys.stderr)
        return 2
    sdate = a.date or meta_in.get("snapshot_date") or datetime.date.today().isoformat()
    if not DATE_RE.match(sdate):
        print(f"ERROR: fecha de snapshot inválida '{sdate}'.", file=sys.stderr)
        return 2

    deals, alerts = validate(deals_in, stages, sdate)
    hist = load_json(HIST_JSON)
    if hist is None:  # bootstrap desde el snapshot vigente
        hist = {"snapshots": []}
        if cur_snap:
            old_deals, used = [], set()
            for d in cur_snap["deals"]:
                d = dict(d)
                d["key"] = d.get("key") or deal_key(d, used)
                old_deals.append(d)
            hist["snapshots"].append({"date": cur_snap["meta"]["snapshot_date"], "deals": old_deals})
    snaps = [s for s in hist["snapshots"] if s["date"] != sdate]
    replaced = len(snaps) != len(hist["snapshots"])
    prev = max(snaps, key=lambda s: s["date"]) if snaps else None
    if prev and prev["date"] > sdate:
        alerts.append(dict(level="warn", msg=f"La fecha {sdate} es anterior al último snapshot guardado ({prev['date']}); se inserta en su lugar cronológico."))
    if prev and any(d.get("id") for d in deals) and not any(d.get("id") for d in prev["deals"]):
        alerts.append(dict(level="info", msg="Este snapshot ya trae 'id' de Attio pero el anterior no: los deals se emparejan por empresa+nombre solo en este cambio; desde ahora se seguirán por id."))
        # reemparejar el snapshot anterior por empresa|nombre para no perder el seguimiento
        idmap = {f"{norm(d.get('company'))}|{norm(d.get('name'))}": d["key"] for d in deals if d.get("id")}
        for d in prev["deals"]:
            k = f"{norm(d.get('company'))}|{norm(d.get('name'))}"
            if k in idmap:
                d["key"] = idmap[k]
    if prev is None and not replaced:
        alerts.append(dict(level="info", msg="Primer snapshot del historial."))
    if prev:
        n_prev, n_cur = len(prev["deals"]), len(deals)
        if n_cur < 0.6 * n_prev:
            alerts.append(dict(level="warn", msg=f"El snapshot trae {n_cur} deals y el anterior {n_prev}: ¿se leyeron todos los deals/etapas de Attio?"))
    zero = [d for d in deals if d["stage"] in stages[:4] and not d["val"]]
    if zero:
        alerts.append(dict(level="info", msg=f"{len(zero)} deal(s) activo(s) sin monto en Attio."))

    errors = [x for x in alerts if x["level"] == "error"]
    cs = summarize(deals, stages)
    L = [f"# Última actualización · Snapshot del pipeline", "",
         f"Fecha del snapshot: **{sdate}** · {cs['n']} deals" + (" · (reemplazó un snapshot de la misma fecha)" if replaced else ""), "",
         "## Resumen", "",
         f"- Pipe activo: {cs['open_n']} deals · {money(cs['open_v'])}",
         f"- Won: {cs['won_n']} deals · {money(cs['won_v'])} · Lost: {cs['lost_n']} deals · {money(cs['lost_v'])}",
         f"- Conversion rate: {pct(cs['conv_n'])} por conteo · {pct(cs['conv_v'])} por valor", ""]
    L += [f"## Diferencias vs. snapshot anterior ({prev['date']})" if prev else "## Diferencias", ""]
    if prev:
        ps = summarize(prev["deals"], stages)
        new, gone, moved, valchg, idx = diff(prev["deals"], deals, stages)
        L.append(f"- Pipe activo: {ps['open_n']} → {cs['open_n']} deals · {money(ps['open_v'])} → {money(cs['open_v'])}")
        L.append(f"- Deals nuevos: {len(new)} · cambiaron de etapa: {len(moved)} · desaparecidos: {len(gone)} · cambio de monto: {len(valchg)}")
        for d in new:
            L.append(f"  - NUEVO · {d.get('company') or '—'} · {d['name']} · {d['stage']} · {money(d['val'])}")
        for o, d in moved:
            arrow = ("GANADO" if d["stage"] == stages[4] else "PERDIDO" if d["stage"] == stages[5]
                     else "avanza" if idx[d["stage"]] > idx[o["stage"]] else "retrocede")
            L.append(f"  - {arrow} · {d.get('company') or '—'} · {d['name']}: {o['stage']} → {d['stage']} · {money(d['val'])}")
        for d in gone:
            L.append(f"  - DESAPARECIDO · {d.get('company') or '—'} · {d['name']} (estaba en {d['stage']}, {money(d['val'])}) — ¿eliminado o archivado en Attio?")
        for o, d in valchg:
            L.append(f"  - monto · {d.get('company') or '—'} · {d['name']}: {money(o['val'])} → {money(d['val'])}")
    else:
        L.append("- No hay snapshot anterior contra el cual comparar.")
    L += ["", "## Avisos", ""] + ([f"- **{x['level'].upper()}** · {x['msg']}" for x in alerts] or ["- Sin avisos."]) + [""]
    report = "\n".join(L)
    print(report)

    if a.dry_run:
        print("(dry-run: no se escribió nada)")
        return 3 if errors else 0
    if errors and not a.force:
        print(f"{len(errors)} error(es) de validación. NO se escribió nada. Corrige o usa --force.", file=sys.stderr)
        return 3

    snap_out = {"meta": {"source": meta_in.get("source") or (cur_snap or {}).get("meta", {}).get("source") or "Attio CRM · Pipeline Weekly",
                         "snapshot_date": sdate, "currency": "MXN", "stages": stages, "deal_count": len(deals)},
                "deals": deals}
    snaps.append({"date": sdate, "deals": deals})
    snaps.sort(key=lambda s: s["date"])
    hist_out = {"snapshots": snaps}
    # el JSON vigente es el snapshot más reciente del historial
    latest = snaps[-1]
    if latest["date"] != sdate:
        snap_out = {"meta": {**snap_out["meta"], "snapshot_date": latest["date"], "deal_count": len(latest["deals"])}, "deals": latest["deals"]}
    save_deals_json(PIPE_JSON, snap_out)
    save_deals_json(HIST_JSON, hist_out)
    (DATA / "last-pipeline-update.md").write_text(report, encoding="utf-8")
    print(f"Escrito data/pipeline-snapshot.json, data/pipeline-history.json ({len(snaps)} snapshots) y data/last-pipeline-update.md")
    return 0


if __name__ == "__main__":
    sys.exit(main())
