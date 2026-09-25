#!/usr/bin/env python3
"""
update_sales.py — Excel "SALES - dinkbit.xlsx" → data/sales-history.json

Uso:
  python3 tools/update_sales.py "SALES - dinkbit.xlsx"            # escribe data/sales-history.json
  python3 tools/update_sales.py "SALES - dinkbit.xlsx" --dry-run  # solo reporta, no escribe
  python3 tools/update_sales.py "SALES - dinkbit.xlsx" --force    # escribe aunque haya errores

Qué hace (y qué NO):
  · Lee solo las hojas "Qn | AAAA". Localiza las columnas por el NOMBRE del encabezado
    (Fecha, Nombre, Origen, Area, Proyecto, Valor, Status), no por posición fija.
  · La taxonomía (Área, Origen, Proyecto) se conserva TAL CUAL. Solo avisa de variantes/typos.
  · No lee nada del bloque COMISIONES.
  · Valida cada hoja contra el "Total" del resumen "Propuestas | General" del propio Excel.
  · Compara contra el JSON anterior y escribe un reporte de cambios (data/last-sales-update.md).

Códigos de salida: 0 ok · 2 error fatal (archivo/hoja ilegible) · 3 errores de validación (no se escribe sin --force)
"""
import sys, re, json, datetime, hashlib, pathlib, argparse, difflib
from collections import defaultdict, Counter

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from common import (DATA, SALES_JSON, STATUSES, load_json, save_json, norm, sha_short,
                    money, pct, stats, record_key)

Q_RE = re.compile(r"^Q([1-4])\s*\|\s*(\d{4})\s*$")
HEADERS = {"fecha": "fecha", "nombre": "nombre", "origen": "origen", "area": "area",
           "proyecto": "proyecto", "valor": "valor", "status": "status"}
TOOL_VERSION = 2


def clean(s):
    if s is None:
        return None
    if isinstance(s, str):
        s = s.strip()
        return s if s else None
    return s


def parse_fecha(v, q, y):
    """(year, month, ok). ok=False si no se pudo leer y se usó el primer mes del trimestre."""
    if isinstance(v, (datetime.datetime, datetime.date)):
        return v.year, v.month, True
    if isinstance(v, (int, float)):
        m = re.match(r"^(\d{1,2})\.(\d{4})", repr(v))
        if m:
            return int(m.group(2)), int(m.group(1)), True
    if isinstance(v, str):
        m = re.match(r"^\s*(\d{1,2})\s*[./-]\s*(\d{4})\s*$", v)
        if m:
            return int(m.group(2)), int(m.group(1)), True
        m = re.match(r"^\s*(\d{4})\s*[./-]\s*(\d{1,2})\s*$", v)
        if m:
            return int(m.group(1)), int(m.group(2)), True
    return y, (q - 1) * 3 + 1, False


class Fatal(Exception):
    pass


def find_layout(rows, sheet):
    """Ubica la fila de encabezados y el índice de cada columna por nombre."""
    for i, r in enumerate(rows[:80]):
        cells = [norm(c) for c in r]
        if "fecha" in cells and "nombre" in cells:
            c0 = cells.index("fecha")
            cols = {}
            for j in range(c0, min(len(cells), c0 + 10)):
                k = HEADERS.get(cells[j])
                if k and k not in cols:
                    cols[k] = j
            missing = [k for k in HEADERS.values() if k not in cols]
            if missing:
                raise Fatal(f"[{sheet}] encabezado del listado incompleto; faltan columnas: {', '.join(missing)}")
            return i, cols
    raise Fatal(f"[{sheet}] no se encontró el encabezado del listado (Fecha | Nombre | … | Status)")


def find_total(rows, hdr_idx, right_of):
    """'Total' del bloque 'Propuestas | General' (o el primer 'Total' numérico a la derecha del listado)."""
    start = 0
    for i, r in enumerate(rows[:80]):
        if any(norm(c) == "propuestasgeneral" for c in r):
            start = i
            break
    for pass_start in (start, 0):
        for r in rows[pass_start:pass_start + 45]:
            for j in range(right_of, len(r) - 1):
                if norm(r[j]) == "total" and isinstance(r[j + 1], (int, float)) and not isinstance(r[j + 1], bool):
                    return int(r[j + 1])
    return None


def read_workbook(path):
    import openpyxl
    try:
        wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    except Exception as e:
        raise Fatal(f"No se pudo abrir el Excel: {e}")
    records, log, alerts, quarters = [], [], [], []
    for ws in wb.worksheets:
        m = Q_RE.match(ws.title)
        if not m:
            continue
        q, y = int(m.group(1)), int(m.group(2))
        qid = f"{y}-Q{q}"
        if qid in quarters:
            alerts.append(dict(level="error", code="hoja_duplicada", sheet=ws.title,
                               msg=f"Hay dos hojas para {qid}; se usa la primera."))
            continue
        rows = [tuple(r) for r in ws.iter_rows(min_row=1, max_row=500, max_col=40, values_only=True)]
        hdr_idx, cols = find_layout(rows, ws.title)
        quarters.append(qid)
        first_col, last_col = min(cols.values()), max(cols.values())
        n, blank, sin_nombre = 0, 0, []
        seen = Counter()
        for off, r in enumerate(rows[hdr_idx + 1:], start=hdr_idx + 2):
            g = lambda k: clean(r[cols[k]]) if cols[k] < len(r) else None
            fecha, nombre, origen, area, proyecto, valor, status = (g(k) for k in
                ("fecha", "nombre", "origen", "area", "proyecto", "valor", "status"))
            if nombre is None and valor is None and status is None:
                blank += 1
                if blank >= 5:
                    break
                continue
            blank = 0
            if nombre is None:
                sin_nombre.append(off)
                continue
            yy, mm, ok = parse_fecha(fecha, q, y)
            if not ok:
                alerts.append(dict(level="warn", code="fecha_ilegible", sheet=ws.title,
                                   msg=f"[{ws.title}] fila {off} ({nombre}): fecha '{fecha}' ilegible; se asignó el primer mes del trimestre."))
            elif not (yy == y and (q - 1) * 3 + 1 <= mm <= (q - 1) * 3 + 3):
                alerts.append(dict(level="warn", code="fecha_fuera_de_trimestre", sheet=ws.title,
                                   msg=f"[{ws.title}] fila {off} ({nombre}): la fecha {mm}.{yy} cae fuera del trimestre."))
            try:
                val = float(valor) if valor is not None else None
            except (TypeError, ValueError):
                val = None
                alerts.append(dict(level="error", code="valor_no_numerico", sheet=ws.title,
                                   msg=f"[{ws.title}] fila {off} ({nombre}): Valor '{valor}' no es numérico."))
            if valor is None:
                alerts.append(dict(level="warn", code="valor_vacio", sheet=ws.title,
                                   msg=f"[{ws.title}] fila {off} ({nombre}): Valor vacío (cuenta como propuesta, suma $0)."))
            if status not in STATUSES:
                alerts.append(dict(level="error", code="status_invalido", sheet=ws.title,
                                   msg=f"[{ws.title}] fila {off} ({nombre}): Status '{status}' no es Ganada/Perdida/Pendiente."))
            # id estable: no depende de posición, valor, status, origen ni área
            base = (qid, mm, norm(nombre), norm(proyecto))
            seen[base] += 1
            h = sha_short(*base)
            rid = f"{qid}-{h}" + (f"-{seen[base]}" if seen[base] > 1 else "")
            records.append({
                "id": rid, "quarter": qid, "year": y, "q": q, "month": mm,
                "fecha": str(fecha) if fecha is not None else None,
                "nombre": nombre, "origen": origen, "area": area, "proyecto": proyecto,
                "valor": val, "status": status,
            })
            n += 1
        if sin_nombre:
            alerts.append(dict(level="warn", code="fila_sin_nombre", sheet=ws.title,
                               msg=f"[{ws.title}] {len(sin_nombre)} fila(s) con datos pero sin Nombre se omitieron (filas {', '.join(map(str, sin_nombre[:8]))})."))
        total_excel = find_total(rows, hdr_idx, last_col + 1)
        flag = ""
        if total_excel is None:
            alerts.append(dict(level="warn", code="sin_total_resumen", sheet=ws.title,
                               msg=f"[{ws.title}] no se encontró el Total del resumen 'Propuestas | General'; no se pudo validar el conteo."))
        elif total_excel != n:
            flag = "  <-- DIFIERE"
            alerts.append(dict(level="error", code="difiere", sheet=ws.title,
                               msg=f"[{ws.title}] el listado tiene {n} propuestas pero el resumen del Excel dice {total_excel} (suele ser una fila sin Nombre o una celda de resumen desplazada)."))
        log.append(f"[{ws.title.strip()}] {n} propuestas (resumen Excel: {total_excel}){flag}")
    if not quarters:
        raise Fatal("El Excel no tiene ninguna hoja con nombre 'Qn | AAAA'.")
    return records, log, alerts, quarters


def catalog(records, key):
    c = Counter(r[key] for r in records if r[key])
    return dict(sorted(c.items(), key=lambda kv: (-kv[1], kv[0])))


def taxonomy_alerts(cats, prev_cats):
    """Avisos sobre categorías (sin modificar nada)."""
    out = []
    for key, c in cats.items():
        if key == "status":
            continue
        groups = defaultdict(list)
        for v in c:
            groups[norm(v)].append(v)
        for g in groups.values():
            if len(g) > 1:
                out.append(dict(level="warn", code="variantes_de_escritura",
                                msg=f"{key}: '{' / '.join(g)}' parecen la misma categoría escrita distinto (se conservan tal cual)."))
        vals = list(c)
        for v in vals:
            if c[v] > 5:
                continue
            close = [w for w in difflib.get_close_matches(v, vals, n=2, cutoff=0.86) if w != v and c[w] > c[v]]
            if close and norm(close[0]) != norm(v):
                out.append(dict(level="info", code="posible_typo",
                                msg=f"{key}: '{v}' ({c[v]}) se parece a '{close[0]}' ({c[close[0]]}); ¿typo? (se respeta tal cual)."))
        if prev_cats:
            new = [v for v in c if v not in prev_cats.get(key, {})]
            if new:
                out.append(dict(level="info", code="categoria_nueva",
                                msg=f"{key}: categoría(s) nueva(s) respecto a la carga anterior: {', '.join(new)}."))
    return out


def diff_records(old, new):
    ok, nk = {}, {}
    for r in old:
        ok.setdefault(record_key(r), []).append(r)
    for r in new:
        nk.setdefault(record_key(r), []).append(r)
    added, removed, changed = [], [], []
    for k, rs in nk.items():
        prev = ok.get(k, [])
        for i, r in enumerate(rs):
            if i >= len(prev):
                added.append(r)
                continue
            o = prev[i]
            diffs = {f: (o.get(f), r.get(f)) for f in ("status", "valor", "origen", "area") if o.get(f) != r.get(f)}
            if diffs:
                changed.append((r, diffs))
    for k, rs in ok.items():
        extra = len(rs) - len(nk.get(k, []))
        if extra > 0:
            removed.extend(rs[len(rs) - extra:])
    return added, removed, changed


def build_report(out, old, log, alerts, added, removed, changed, prev_quarters):
    recs, quarters = out["records"], out["meta"]["quarters"]
    L = ["# Última actualización · Reporte de ventas", "",
         f"Fuente: `{out['meta']['source']}` · generado {out['meta']['generated']} · {len(recs)} propuestas · {quarters[0]} → {quarters[-1]}", ""]
    L += ["## Hojas leídas", ""] + [f"- {x}" for x in log] + [""]
    new_q = [q for q in quarters if q not in (prev_quarters or [])]
    L += ["## Cambios vs. la carga anterior", ""]
    if old is None:
        L += ["- Primera carga (no había JSON previo)."]
    else:
        L += [f"- Trimestres nuevos: {', '.join(new_q) if new_q else 'ninguno'}",
              f"- Propuestas agregadas: {len(added)} · eliminadas: {len(removed)} · modificadas: {len(changed)}"]
        for r, d in changed:
            bits = ", ".join(f"{f}: {a} → {b}" for f, (a, b) in d.items())
            L.append(f"  - {r['quarter']} · {r['nombre']} ({r.get('proyecto') or '—'}): {bits}")
        for r in removed[:20]:
            L.append(f"  - ELIMINADA {r['quarter']} · {r['nombre']} ({r.get('proyecto') or '—'}) {money(r.get('valor'))} {r['status']}")
        for r in added[:40]:
            L.append(f"  - NUEVA {r['quarter']} · {r['nombre']} ({r.get('proyecto') or '—'}) {money(r.get('valor'))} {r['status']}")
    L.append("")
    last = quarters[-1]
    cur = stats([r for r in recs if r["quarter"] == last])
    L += [f"## Resumen del último trimestre ({last})", "",
          f"- Propuestas: {cur['n']} · Accrued {money(cur['won'])} · Lost {money(cur['lost'])} · Pending {money(cur['pend'])}",
          f"- Hit Rate $ {pct(cur['hitRev'])} · Hit Rate # {pct(cur['hitCnt'])} · Ticket promedio {money(cur['ticket']) if cur['ticket'] else '—'}"]
    y, q = map(int, last.split("-Q"))
    pq = f"{y}-Q{q-1}" if q > 1 else f"{y-1}-Q4"
    if pq in quarters:
        p = stats([r for r in recs if r["quarter"] == pq])
        L.append(f"- vs. {pq}: Accrued {money(p['won'])} → {money(cur['won'])} · Hit Rate $ {pct(p['hitRev'])} → {pct(cur['hitRev'])} · Hit Rate # {pct(p['hitCnt'])} → {pct(cur['hitCnt'])}")
    L.append("")
    L += ["## Avisos de calidad", ""]
    if alerts:
        for a in alerts:
            L.append(f"- **{a['level'].upper()}** · {a['msg']}")
    else:
        L.append("- Sin avisos.")
    L.append("")
    return "\n".join(L)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("xlsx", nargs="?", default="SALES - dinkbit.xlsx")
    ap.add_argument("--out", default=str(SALES_JSON))
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--force", action="store_true")
    a = ap.parse_args()

    src = pathlib.Path(a.xlsx)
    if not src.exists():
        print(f"ERROR: no existe {src}", file=sys.stderr)
        return 2
    try:
        records, log, alerts, quarters = read_workbook(src)
    except Fatal as e:
        print(f"ERROR: {e}", file=sys.stderr)
        return 2

    quarters.sort()
    y0, q0 = map(int, quarters[0].split("-Q"))
    y1, q1 = map(int, quarters[-1].split("-Q"))
    allq, y, q = [], y0, q0
    while (y, q) <= (y1, q1):
        allq.append(f"{y}-Q{q}")
        q += 1
        if q == 5:
            q, y = 1, y + 1
    missing = [x for x in allq if x not in quarters]
    if missing:
        alerts.append(dict(level="info", code="trimestres_sin_hoja",
                           msg=f"Trimestres sin hoja en el Excel (se muestran como hueco 'SIN REPORTE'): {', '.join(missing)}."))

    records.sort(key=lambda r: r["quarter"])  # estable: conserva el orden de filas del Excel dentro de cada trimestre
    cats = {k: catalog(records, k) for k in ("area", "origen", "proyecto", "status")}
    old = load_json(a.out)
    prev_quarters = old["meta"]["quarters"] if old else None
    alerts += taxonomy_alerts(cats, old["meta"].get("catalogs") if old else None)
    if old:
        lost_q = [q for q in prev_quarters if q not in quarters]
        if lost_q:
            alerts.append(dict(level="error", code="trimestres_desaparecidos",
                               msg=f"El Excel ya no trae hojas que estaban en la carga anterior: {', '.join(lost_q)}."))
    added, removed, changed = diff_records(old["records"], records) if old else ([], [], [])

    sha = hashlib.sha256(src.read_bytes()).hexdigest()[:12]
    out = {
        "meta": {
            "source": "SALES - dinkbit.xlsx",
            "source_sha256_12": sha,
            "generated": datetime.datetime.now().isoformat(timespec="seconds"),
            "tool_version": TOOL_VERSION,
            "currency": "MXN",
            "quarters": quarters,
            "missing_quarters": missing,
            "record_count": len(records),
            "taxonomy_policy": "as-is (sin normalizar)",
            "hit_rate_definition": {"revenue": "Accrued / (Pending + Lost + Accrued)  [formula del Excel]",
                                    "count": "Ganadas / Total propuestas"},
            "catalogs": cats,
            "quality": alerts,
        },
        "records": records,
    }
    errors = [x for x in alerts if x["level"] == "error"]
    report = build_report(out, old, log, alerts, added, removed, changed, prev_quarters)
    print("\n".join(log))
    print(f"\nTrimestres: {quarters[0]} → {quarters[-1]} ({len(quarters)} hojas) · faltantes: {missing or 'ninguno'}")
    print(f"Registros: {len(records)}" + (f" · +{len(added)} / -{len(removed)} / ~{len(changed)} vs. carga anterior" if old else ""))
    for x in alerts:
        print(f"  [{x['level'].upper()}] {x['msg']}")
    if a.dry_run:
        print("\n(dry-run: no se escribió nada)")
        return 3 if errors else 0
    if errors and not a.force:
        print(f"\n{len(errors)} error(es) de validación. NO se escribió {a.out}. Revisa con el usuario o usa --force.", file=sys.stderr)
        (DATA / "last-sales-update.md").write_text(report, encoding="utf-8")
        return 3
    save_json(a.out, out)
    (DATA / "last-sales-update.md").write_text(report, encoding="utf-8")
    print(f"\nEscrito {a.out} · reporte en data/last-sales-update.md")
    return 0


if __name__ == "__main__":
    sys.exit(main())
