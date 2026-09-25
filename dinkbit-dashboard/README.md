# dinkbit · Sales & New Business Dashboard

Dashboard de una sola página (HTML autocontenido, sin backend, sin dependencias externas)
publicado en Vercel desde este repo. Dos fuentes de datos que **nunca se mezclan**:

| Sección | Fuente | Datos | Cómo se actualiza |
|---|---|---|---|
| Reporte de ventas (Histórico, cada año, cada trimestre) | `SALES - dinkbit.xlsx` | `data/sales-history.json` | Compartes el Excel en el chat → Claude corre `tools/update_sales.py` |
| Pipeline · Snapshot + historial | Attio CRM (vía MCP) | `data/pipeline-snapshot.json` + `data/pipeline-history.json` | Pides el pull en el chat → Claude lee Attio y corre `tools/update_pipeline.py` |

El **build** (`tools/build.py`) ensambla todo en `public/index.html`, que es lo único que
Vercel publica (`vercel.json` → `outputDirectory: public`). **Nunca se edita `public/index.html`
a mano** ni se versiona el Excel (trae la sección COMISIONES — ver `.gitignore`).

## Flujo de trabajo (todo por chat con Claude)

Este repo está pensado para que tú controles el ritmo: tú compartes los datos nuevos en la
conversación, Claude corre las herramientas y te entrega la versión lista para que **tú hagas
el `git push`** (o lo conectes a un skill propio que automatice ese último paso).

**1. Actualizar el Reporte de ventas** — subes `SALES - dinkbit.xlsx` (el archivo completo, no
solo el trimestre nuevo) y pides "actualiza el dashboard con este Excel". Claude corre:
```
python3 tools/update_sales.py "SALES - dinkbit.xlsx"
```
Lee **todas** las hojas `Qn | AAAA`, localiza las columnas por el nombre del encabezado (no por
posición fija), valida cada hoja contra el "Total" de su propio resumen, y dejará **por escrito**
en `data/last-sales-update.md` qué cambió: trimestres nuevos, propuestas agregadas/eliminadas/
modificadas, y cualquier aviso (status inválido, fila sin nombre, trimestre que desapareció del
Excel, etc.). Si hay errores de validación, **no escribe nada** salvo que se use `--force`.

**Skill instalable:** `skills/dinkbit-pipeline-update/SKILL.md` (y su versión empaquetada `.skill`, si la conservaste aparte) hace exactamente el paso 2 de abajo de punta a punta — traer, convertir, regenerar y reportar — sin que actualices cada parte a mano.

**2. Actualizar el Snapshot del pipeline** — pides "actualiza el snapshot del pipeline desde
Attio". Claude lee los deals vía MCP (todas las etapas, incluidos Won y Lost) y arma un JSON con
el esquema de `tools/update_pipeline.py` (ver su docstring), luego corre:
```
python3 tools/update_pipeline.py nuevo-snapshot.json
```
Esto **agrega** el snapshot al historial (`data/pipeline-history.json`) en vez de reemplazarlo —
el historial es lo que alimenta "Cambios vs. snapshot anterior", "Pipeline ponderado" y
"Tendencia y velocidad". Si Attio trae una etapa que no está en `meta.stages`, el script se
detiene y pide confirmación antes de tocar nada (agregar una etapa nueva cambia qué cuenta como
pipe activo/Won/Lost).

**3. Ensamblar y validar** — con los JSON al día:
```
python3 tools/build.py        # → public/index.html
python3 tools/validate.py     # checklist completo (ver CONTEXT.md §5)
```
`validate.py` revisa los datos, que el build esté al día, la sintaxis del JS, que no haya
recursos externos, y (en Chromium headless) que las vistas rendericen sin `NaN`/`undefined`, que
el ruteo por URL funcione y que la exportación a PDF salga bien. Sale con código 1 si algo falla.

**4. Publicar** — tú corres `git add -A && git commit && git push` (o tu skill de publicación).
Vercel reconstruye con `tools/build.py` y sirve `public/`.

## Qué NO cambia entre versiones del dashboard

Estas decisiones de producto siguen firmes — ver CONTEXT.md §6 para el detalle:
sin Comisiones, taxonomía del Excel tal cual (sin normalizar), Excel y Attio nunca se mezclan,
huecos de trimestre visibles y nunca rellenados, sin "Top 10 deals" en el pipeline.

## Qué es nuevo en esta versión (respecto al HTML monolítico original)

- **`src/` modular** en vez de un solo `template.html`: `index.html` + `styles.css` +
  `js/NN-nombre.js` (el prefijo numérico es el orden de ensamblado).
- **ECharts incrustado** en `vendor/echarts.min.js` (build `common`, sin mapas ni módulos que no
  se usan) — cero peticiones externas, cero CDN.
- **Historial del pipeline** (`data/pipeline-history.json`): cada actualización se agrega, no
  reemplaza. Sin esto no hay "qué cambió" ni tendencia.
- **`data/config.json`**: supuestos editables del dashboard que no salen de ninguna fuente (hoy
  solo la probabilidad de cierre por etapa del Pipeline ponderado). Estos valores son un
  **placeholder puesto por Claude, pendiente de que dinkbit los confirme o corrija** — no
  representan un dato histórico ni una fórmula del Excel.
- **Estado de los datos**: avisos visibles en cada vista (Excel desactualizado, huecos de
  trimestre, snapshot viejo, deals sin monto, variantes de escritura unificadas, años sin
  Pendientes que no son comparables entre sí, etc.), calculados en el navegador contra la fecha
  de hoy — no hace falta reconstruir para que aparezca el aviso de "snapshot de hace 15 días".
  El mismo cálculo también decide qué avisos mostrar en "Comparar periodos".
- **Comparar periodos**: un periodo A (base) contra un periodo B, cualquier combinación de
  trimestre/año/histórico, con sus propios avisos de comparabilidad.
- **URL con estado**: cada vista, filtro y periodo queda en el hash
  (`#/ventas/2026-Q2?status=Ganada`, `#/comparar?a=2025-Q2&b=2026-Q2`,
  `#/pipeline?bu=Marketing`) — se puede compartir un enlace exacto.
- **Imprimir / PDF**: botón que arma una versión A4 horizontal, sin barra lateral ni filtros,
  con las gráficas fijadas como imagen (evita que la exportación a PDF las corte en blanco a
  mitad de página — ver el comentario en `src/js/50-chartbase.js` si vuelve a pasar).
- **`tools/validate.py`** automatiza el checklist antes de publicar.
- **`tests/`**: pruebas del parser del Excel (encabezados movidos, hojas sin encabezado, status
  inválido, ids estables aunque cambien las filas, trimestre que desaparece del Excel), del
  updater del pipeline (cambios de etapa, historial, ids de Attio) y de que el cálculo de
  Hit Rate en JavaScript coincide exactamente con la réplica en Python.

## Archivos

```
src/index.html, src/styles.css, src/js/*.js   interfaz (se ensamblan con tools/build.py)
brand/                                         tokens.css, logo, fuente Inter (para el build)
vendor/echarts.min.js                          ECharts incrustado (sin CDN)
data/sales-history.json                        Reporte de ventas vigente
data/pipeline-snapshot.json                    Snapshot vigente del pipeline
data/pipeline-history.json                     Historial de TODOS los snapshots
data/config.json                               Supuestos editables (probabilidad por etapa, etc.)
data/last-sales-update.md                      Reporte de la última carga del Excel
data/last-pipeline-update.md                   Reporte de la última actualización de Attio
tools/update_sales.py                          Excel → sales-history.json
tools/update_pipeline.py                       snapshot Attio → pipeline-snapshot.json + historial
tools/build.py                                 ensambla public/index.html
tools/validate.py                              checklist automático antes de publicar
tools/common.py                                utilidades compartidas
tests/                                         pruebas automáticas (python3 -m unittest discover -s tests)
public/index.html                              ENTREGABLE — lo publica Vercel
vercel.json                                    outputDirectory: public + cabeceras noindex
```

Ver `CONTEXT.md` para el detalle completo: esquemas exactos, definiciones (Hit Rate, Accrued,
etc.), cómo leer el Excel hoja por hoja, y el checklist de validación.
