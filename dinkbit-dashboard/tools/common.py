"""common.py — rutas y utilidades compartidas por las herramientas del dashboard."""
import json, os, pathlib, re, unicodedata, hashlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = pathlib.Path(os.environ.get("DASH_DATA_DIR") or ROOT / "data")   # DASH_DATA_DIR solo para pruebas
SRC = ROOT / "src"
BRAND = ROOT / "brand"
VENDOR = ROOT / "vendor"
PUBLIC = ROOT / "public"

SALES_JSON = DATA / "sales-history.json"
PIPE_JSON = DATA / "pipeline-snapshot.json"
HIST_JSON = DATA / "pipeline-history.json"
CONFIG_JSON = DATA / "config.json"

STATUSES = ("Ganada", "Perdida", "Pendiente")
DEFAULT_STAGES = ["1. Lead", "2. Proposal", "3. In Progress", "4. Due Diligence", "5. Won 🎉", "6. Lost"]


def load_json(path, default=None):
    p = pathlib.Path(path)
    if not p.exists():
        return default
    return json.loads(p.read_text(encoding="utf-8"))


def save_json(path, obj, indent=1):
    pathlib.Path(path).write_text(json.dumps(obj, ensure_ascii=False, indent=indent) + "\n", encoding="utf-8")


def norm(s):
    """minúsculas, sin acentos ni signos: para comparar encabezados y detectar variantes."""
    if s is None:
        return ""
    s = unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "", s.lower())


def sha_short(*parts, n=8):
    return hashlib.sha1("|".join(str(p) for p in parts).encode("utf-8")).hexdigest()[:n]


def money(v):
    v = v or 0
    a = abs(v)
    if a >= 1e6:
        return f"${v/1e6:.2f}M"
    if a >= 1e3:
        return f"${round(v/1e3)}K"
    return f"${round(v)}"


def pct(v, d=1):
    return "—" if v is None else f"{v*100:.{d}f}%"


def stats(rows):
    """Réplica exacta de stats() del front (definiciones alineadas al Excel)."""
    g = [r for r in rows if r["status"] == "Ganada"]
    p = [r for r in rows if r["status"] == "Perdida"]
    n = [r for r in rows if r["status"] == "Pendiente"]
    s = lambda a: sum((r.get("valor") or 0) for r in a)
    won, lost, pend = s(g), s(p), s(n)
    total = won + lost + pend
    return {
        "n": len(rows), "won": won, "lost": lost, "pend": pend, "total": total,
        "nWon": len(g), "nLost": len(p), "nPend": len(n),
        "hitRev": (won / total) if total else None,
        "hitCnt": (len(g) / len(rows)) if rows else None,
        "ticket": (won / len(g)) if g else None,
    }


def record_key(r):
    """Clave de negocio estable de una propuesta (no depende de valor/status/origen/área)."""
    return (r.get("quarter"), r.get("month"), norm(r.get("nombre")), norm(r.get("proyecto")))


def save_deals_json(path, obj):
    """JSON legible y con diffs limpios en git: un deal por línea (snapshot o historial)."""
    dumps = lambda x: json.dumps(x, ensure_ascii=False, separators=(", ", ": "))
    def deals_block(deals, ind):
        pad = " " * ind
        return "[\n" + ",\n".join(pad + " " + dumps(d) for d in deals) + "\n" + pad + "]"
    if "snapshots" in obj:
        parts = []
        for s in obj["snapshots"]:
            parts.append('  {"date": %s, "deals": %s}' % (dumps(s["date"]), deals_block(s["deals"], 2).replace("\n  ", "\n    ")))
        text = '{"snapshots": [\n' + ",\n".join(parts) + "\n]}\n"
    else:
        text = '{\n "meta": %s,\n "deals": %s\n}\n' % (dumps(obj["meta"]), deals_block(obj["deals"], 1))
    json.loads(text)  # sanity check
    pathlib.Path(path).write_text(text, encoding="utf-8")
