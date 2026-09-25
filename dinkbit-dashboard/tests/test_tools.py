"""Pruebas de las herramientas. Correr:  python3 -m unittest discover -s tests -v
No tocan data/: cada prueba trabaja en un directorio temporal (DASH_DATA_DIR)."""
import json, os, pathlib, random, re, shutil, subprocess, sys, tempfile, unittest

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tests"))
from make_fixture import build  # noqa: E402


def run(script, *args, data_dir):
    env = dict(os.environ, DASH_DATA_DIR=str(data_dir))
    return subprocess.run([sys.executable, str(ROOT / "tools" / script), *map(str, args)],
                          capture_output=True, text=True, env=env)


class Base(unittest.TestCase):
    def setUp(self):
        self.tmp = pathlib.Path(tempfile.mkdtemp())
        self.data = self.tmp / "data"
        self.data.mkdir()

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def xlsx(self, variant="ok", name="a.xlsx"):
        p = self.tmp / name
        build(p, variant)
        return p

    def sales(self):
        return json.loads((self.data / "sales-history.json").read_text(encoding="utf-8"))


class SalesParser(Base):
    def test_ok_and_taxonomy_as_is(self):
        r = run("update_sales.py", self.xlsx(), data_dir=self.data)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        d = self.sales()
        self.assertEqual(d["meta"]["record_count"], 8)
        self.assertEqual(d["meta"]["quarters"], ["2026-Q1", "2026-Q2"])
        self.assertIn("Desarrollo", d["meta"]["catalogs"]["area"])              # sin normalizar
        self.assertIn("Web & App Development", d["meta"]["catalogs"]["area"])
        months = {(x["nombre"], x["month"]) for x in d["records"]}
        self.assertIn(("Cliente Dos", 2), months)   # datetime
        self.assertIn(("Cliente Tres", 2), months)  # float 2.2026
        self.assertIn(("Cliente Cuatro", 3), months)  # '03.2026'

    def test_commissions_never_read(self):
        run("update_sales.py", self.xlsx(), data_dir=self.data)
        blob = (self.data / "sales-history.json").read_text(encoding="utf-8")
        self.assertNotIn("Comisionista", blob)
        self.assertNotIn("99999", blob)

    def test_layout_shift_is_handled(self):
        r = run("update_sales.py", self.xlsx("shifted"), data_dir=self.data)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertEqual(self.sales()["meta"]["record_count"], 8)

    def test_ids_stable_when_rows_reordered_and_values_edited(self):
        run("update_sales.py", self.xlsx(), data_dir=self.data)
        ids1 = {x["id"] for x in self.sales()["records"]}
        self.assertEqual(len(ids1), 8)  # el duplicado legítimo recibe sufijo, no colisiona
        # editar status/valor no cambia el id; el reporte lo detecta como modificación
        import openpyxl
        p = self.tmp / "b.xlsx"; build(p)
        wb = openpyxl.load_workbook(p); ws = wb["Q2 | 2026 "]
        ws.cell(10, 8, 250000); ws.cell(10, 9, "Ganada")   # Cliente Uno Q2: Pendiente→Ganada
        wb.save(p)
        r = run("update_sales.py", p, data_dir=self.data)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        ids2 = {x["id"] for x in self.sales()["records"]}
        self.assertEqual(ids1, ids2)
        rep = (self.data / "last-sales-update.md").read_text(encoding="utf-8")
        self.assertIn("status: Pendiente → Ganada", rep)
        self.assertIn("modificadas: 1", rep)

    def test_difiere_blocks_write_unless_forced(self):
        r = run("update_sales.py", self.xlsx("difiere"), data_dir=self.data)
        self.assertEqual(r.returncode, 3)
        self.assertFalse((self.data / "sales-history.json").exists())
        self.assertIn("DIFIERE", r.stdout)
        r = run("update_sales.py", self.tmp / "a.xlsx", "--force", data_dir=self.data)
        self.assertEqual(r.returncode, 0)  # --force escribe aunque haya errores
        self.assertTrue((self.data / "sales-history.json").exists())

    def test_invalid_status_is_error(self):
        r = run("update_sales.py", self.xlsx("badstatus"), data_dir=self.data)
        self.assertEqual(r.returncode, 3)
        self.assertIn("Ganado", r.stdout)

    def test_missing_header_is_fatal(self):
        r = run("update_sales.py", self.xlsx("nohdr"), data_dir=self.data)
        self.assertEqual(r.returncode, 2)
        self.assertIn("encabezado", r.stderr)

    def test_vanished_quarter_is_flagged(self):
        run("update_sales.py", self.xlsx(), data_dir=self.data)
        import openpyxl
        p = self.tmp / "c.xlsx"; build(p)
        wb = openpyxl.load_workbook(p); del wb["Q1 | 2026"]; wb.save(p)
        r = run("update_sales.py", p, "--dry-run", data_dir=self.data)
        self.assertEqual(r.returncode, 3)
        self.assertIn("ya no trae hojas", r.stdout)


def deal(name, company, stage, val=1000, **kw):
    d = dict(name=name, company=company, stage=stage, bu="Web&App", src="Network", sol="E-commerce", val=val, created="2026-06-01")
    d.update(kw)
    return d


class PipelineUpdater(Base):
    def snap(self, deals, date, name="s.json"):
        p = self.tmp / name
        p.write_text(json.dumps({"meta": {"snapshot_date": date}, "deals": deals}), encoding="utf-8")
        return p

    def hist(self):
        return json.loads((self.data / "pipeline-history.json").read_text(encoding="utf-8"))

    def test_history_diff_and_stage_normalization(self):
        d1 = [deal("A", "X", "2. Proposal"), deal("B", "Y", "3. In Progress"), deal("C", "Z", "1. Lead")]
        r = run("update_pipeline.py", self.snap(d1, "2026-09-14"), data_dir=self.data)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        d2 = [deal("A", "X", "In Progress"),              # sin prefijo → se normaliza
              deal("B", "Y", "5. Won 🎉"),
              deal("N", "W", "1. Lead")]                    # C desaparece, N es nuevo
        r = run("update_pipeline.py", self.snap(d2, "2026-09-21", "s2.json"), data_dir=self.data)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertEqual(len(self.hist()["snapshots"]), 2)
        rep = (self.data / "last-pipeline-update.md").read_text(encoding="utf-8")
        self.assertIn("NUEVO", rep); self.assertIn("GANADO", rep); self.assertIn("DESAPARECIDO", rep); self.assertIn("avanza", rep)
        snap = json.loads((self.data / "pipeline-snapshot.json").read_text(encoding="utf-8"))
        self.assertEqual(snap["meta"]["snapshot_date"], "2026-09-21")
        self.assertIn("3. In Progress", {x["stage"] for x in snap["deals"]})

    def test_same_date_replaces_and_is_idempotent(self):
        p = self.snap([deal("A", "X", "1. Lead")], "2026-09-14")
        run("update_pipeline.py", p, data_dir=self.data)
        run("update_pipeline.py", p, data_dir=self.data)
        self.assertEqual(len(self.hist()["snapshots"]), 1)

    def test_unknown_stage_blocks(self):
        r = run("update_pipeline.py", self.snap([deal("A", "X", "7. Nueva etapa")], "2026-09-14"), data_dir=self.data)
        self.assertEqual(r.returncode, 3)
        self.assertIn("pregunta al usuario", r.stdout)
        self.assertFalse((self.data / "pipeline-history.json").exists())

    def test_ids_take_over_from_name_matching(self):
        run("update_pipeline.py", self.snap([deal("A", "X", "2. Proposal")], "2026-09-14"), data_dir=self.data)
        r = run("update_pipeline.py", self.snap([deal("A renombrado", "X", "3. In Progress", id="rec_1"),], "2026-09-21", "s2.json"), data_dir=self.data)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        # sin id previo: no se puede emparejar un nombre distinto → aparece como nuevo + desaparecido (aviso claro)
        rep = (self.data / "last-pipeline-update.md").read_text(encoding="utf-8")
        self.assertIn("ya trae 'id'", rep)
        r = run("update_pipeline.py", self.snap([deal("A renombrado otra vez", "X", "5. Won 🎉", id="rec_1")], "2026-09-28", "s3.json"), data_dir=self.data)
        rep = (self.data / "last-pipeline-update.md").read_text(encoding="utf-8")
        self.assertIn("GANADO", rep)   # con id se sigue el deal aunque cambie el nombre


class JsParity(unittest.TestCase):
    """stats() del front (JS) debe dar exactamente lo mismo que la réplica en Python, en todos los periodos."""
    def test_stats_js_equals_python(self):
        sys.path.insert(0, str(ROOT / "tools"))
        from common import stats, load_json
        sales = load_json(ROOT / "data" / "sales-history.json")
        helpers = (ROOT / "src" / "js" / "20-helpers.js").read_text(encoding="utf-8")
        script = helpers + """
        const R = JSON.parse(require('fs').readFileSync(process.argv[2],'utf8')).records;
        const keys=[...new Set(R.map(r=>r.quarter))], years=[...new Set(R.map(r=>r.year))];
        const out={};
        keys.forEach(k=>out[k]=stats(R.filter(r=>r.quarter===k))); years.forEach(y=>out[String(y)]=stats(R.filter(r=>r.year===y))); out.all=stats(R);
        console.log(JSON.stringify(out));"""
        f = pathlib.Path(tempfile.mkdtemp()) / "t.js"; f.write_text(script, encoding="utf-8")
        r = subprocess.run(["node", str(f), str(ROOT / "data" / "sales-history.json")], capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stderr)
        js = json.loads(r.stdout)
        recs = sales["records"]
        for k, s in js.items():
            rows = recs if k == "all" else [x for x in recs if x["quarter"] == k] if "-Q" in k else [x for x in recs if str(x["year"]) == k]
            p = stats(rows)
            for f_ in ("n", "won", "lost", "pend", "total", "nWon", "nLost", "nPend"):
                self.assertEqual(round(s[f_]), round(p[f_]), f"{k}.{f_}")
            for f_ in ("hitRev", "hitCnt", "ticket"):
                a, b = s[f_], p[f_]
                if b is None: self.assertIsNone(a)
                else: self.assertAlmostEqual(a, b, places=9, msg=f"{k}.{f_}")


class StageProbabilities(unittest.TestCase):
    """stageProbabilities() (82-pipeline-history.js): observada cuando el historial vio un tránsito
    con desenlace conocido, estimada (embudo) en el resto. Corre el JS real con un historial armado
    a mano, para blindar contra el bug real que hubo aquí: mezclar índice de etapa con nombre de etapa."""
    def test_observed_and_estimated_from_history(self):
        stages = ["1. Lead", "2. Proposal", "3. In Progress", "4. Due Diligence", "5. Won 🎉", "6. Lost"]
        # snapshot 1: A en Proposal(1), B en In Progress(2), C en Due Diligence(3)
        # snapshot 2: A sigue en Proposal, B pasó a Won(4), C pasó a Lost(5)
        hist = {"stages": stages,
                "snaps": [{"date": "2026-01-01", "d": [["a", 1, 100], ["b", 2, 200], ["c", 3, 300]]},
                          {"date": "2026-01-08", "d": [["a", 1, 100], ["b", 4, 200], ["c", 5, 300]]}],
                "info": {"a": ["A", "X", "2026-01-01", "BU", "Src"], "b": ["B", "Y", "2026-01-01", "BU", "Src"],
                         "c": ["C", "Z", "2026-01-01", "BU", "Src"]}}
        pipe = {"meta": {"stages": stages}, "deals": [{"key": "a", "stage": "2. Proposal", "val": 100, "bu": "BU", "src": "Src"},
                                                        {"key": "b", "stage": "5. Won 🎉", "val": 200, "bu": "BU", "src": "Src"},
                                                        {"key": "c", "stage": "6. Lost", "val": 300, "bu": "BU", "src": "Src"}]}
        full = (ROOT / "src/js/82-pipeline-history.js").read_text(encoding="utf-8")
        m = re.search(r"function stageProbabilities\(\)\{.*?\n}", full, re.S)
        self.assertIsNotNone(m, "no se encontró stageProbabilities() en 82-pipeline-history.js")
        script = f"""
        const STAGES={json.dumps(stages, ensure_ascii=False)}, WON=STAGES[4], LOST=STAGES[5];
        const OPEN=STAGES.slice(0,4);
        const D={json.dumps(pipe['deals'], ensure_ascii=False)};
        const HS={json.dumps(hist['snaps'], ensure_ascii=False)};
        const isOpenIdx=i=>i<4, WON_I=4, LOST_I=5;
        {m.group(0)}
        console.log(JSON.stringify(stageProbabilities()));
        """
        f = pathlib.Path(tempfile.mkdtemp()) / "t.js"; f.write_text(script, encoding="utf-8")
        r = subprocess.run(["node", str(f)], capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stderr)
        probs = {p["st"]: p for p in json.loads(r.stdout)}
        self.assertEqual(probs["3. In Progress"]["src"], "observada")
        self.assertEqual(probs["3. In Progress"]["p"], 1.0)   # B: In Progress -> Won
        self.assertEqual(probs["4. Due Diligence"]["src"], "observada")
        self.assertEqual(probs["4. Due Diligence"]["p"], 0.0)  # C: Due Diligence -> Lost
        self.assertEqual(probs["1. Lead"]["src"], "estimada")  # nadie fue visto en Lead
        self.assertEqual(probs["2. Proposal"]["src"], "estimada")  # A sigue abierto: sin desenlace


class NormalizedView(unittest.TestCase):
    """El interruptor 'Vista normalizada' de Comparar periodos usa EXACTAMENTE los 7 pares que
    dinkbit documentó (86-compare.js) y no inventa equivalencias no confirmadas."""
    def test_norm_map_matches_documented_pairs(self):
        full = (ROOT / "src/js/86-compare.js").read_text(encoding="utf-8")
        m = re.search(r"const NORM_MAP=\{(.*?)\};", full, re.S)
        self.assertIsNotNone(m)
        block = "{" + m.group(1) + "}"
        script = f"const NORM_MAP={block}; console.log(JSON.stringify(NORM_MAP));"
        f = pathlib.Path(tempfile.mkdtemp()) / "t.js"; f.write_text(script, encoding="utf-8")
        r = subprocess.run(["node", str(f)], capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stderr)
        norm = json.loads(r.stdout)
        expected = {"area": {"Desarrollo": "Web & App Development", "Diseño": "Design"},
                    "origen": {"Contacto": "Direct Contact", "Existente": "Active Client"},
                    "proyecto": {"Estrategia Digital": "Marketing Strategy", "Sitio Web": "Website", "Shopify": "Online Store"}}
        self.assertEqual(norm, expected)


if __name__ == "__main__":
    unittest.main()
