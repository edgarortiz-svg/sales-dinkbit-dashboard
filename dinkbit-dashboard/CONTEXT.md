# dinkbit · Sales & New Business Dashboard — Contexto para Claude

Este documento es la referencia completa de la plataforma. Sirve para que Claude entienda qué es,
cómo está construida y cómo se actualiza, y como base para los dos skills que Edgar va a construir:

1. **Actualizar el Reporte de ventas** cuando Edgar comparte el Excel `SALES - dinkbit.xlsx`.
2. **Actualizar el Snapshot del pipeline** leyendo los deals de Attio vía MCP.

Ambos skills terminan igual: Claude deja `public/index.html` listo y es **Edgar quien hace el
`git push`** (o lo conecta a su propio skill de publicación) — Claude nunca publica por su cuenta.

---

## 1. Qué es la plataforma

Un dashboard de una sola página (HTML autocontenido, sin CDN) con **dos fuentes de
datos que nunca se mezclan**, publicado en Vercel desde este repo (`vercel.json` →
`outputDirectory: public`). La única pieza de servidor es `proxy.mjs`, un Routing Middleware
de Vercel que protege todo el sitio con usuario/contraseña antes de servir `public/index.html`
(ver §6, "Login con usuario/contraseña").

| Bloque del menú | Fuente | Archivo(s) de datos | Actualización |
|---|---|---|---|
| **Reporte de ventas** — un ítem por periodo: Histórico, cada año, cada trimestre | `SALES - dinkbit.xlsx` (Edgar lo comparte en el chat) | `data/sales-history.json` | Skill 1 |
| **Pipeline · Snapshot** + historial + tendencia | Attio CRM | `data/pipeline-snapshot.json`, `data/pipeline-history.json` | Skill 2 (MCP de Attio) |

Regla de oro: **ninguna vista combina datos del Excel con datos de Attio.** Son reportes
distintos con taxonomías distintas.

### 1.1 Estructura del repo

```
src/index.html, src/styles.css, src/js/NN-*.js   interfaz, modular (NN = orden de ensamblado)
brand/                    tokens.css, logo, fuente Inter (para el build)
vendor/echarts.min.js     ECharts incrustado (build "common", sin mapas ni CDN)
data/sales-history.json          Reporte de ventas vigente
data/pipeline-snapshot.json      Snapshot vigente del pipeline (el último del historial)
data/pipeline-history.json       Historial de TODOS los snapshots — nunca se reemplaza, se agrega
data/config.json                 Supuestos que no salen de ninguna fuente (hoy solo snapshot_stale_days)
data/last-sales-update.md        Reporte de la última carga del Excel (para pegar en el chat)
data/last-pipeline-update.md     Reporte de la última actualización de Attio
tools/update_sales.py            Excel → sales-history.json
tools/update_pipeline.py         snapshot Attio → pipeline-snapshot.json + historial
tools/build.py                   ensambla public/index.html (determinista)
tools/validate.py                checklist automático antes de publicar (ver §5)
tools/common.py                  utilidades compartidas (incluye override DASH_DATA_DIR para pruebas)
tests/                           pruebas automáticas — python3 -m unittest discover -s tests
public/index.html                ENTREGABLE — lo publica Vercel. Nunca se edita a mano.
proxy.mjs                        Routing Middleware de Vercel — login con usuario/contraseña (ver §6)
vercel.json                      outputDirectory: public + cabeceras noindex/nosniff + proxy.entrypoint
.gitignore                       excluye el .xlsx (trae COMISIONES) y basura de build/pruebas
```

### 1.2 Flujo de actualización (idéntico para ambas skills)

```
1. Regenerar el JSON correspondiente:
     python3 tools/update_sales.py "SALES - dinkbit.xlsx"      (o)
     python3 tools/update_pipeline.py nuevo-snapshot.json
2. python3 tools/build.py         → produce public/index.html
3. python3 tools/validate.py      → checklist completo (§5); sale con código 1 si algo falla
4. Edgar publica (git push) reemplazando la versión anterior
```

`tools/build.py` no requiere red: todo lo que necesita está en `brand/` y `vendor/`.

---

## 2. Reporte de ventas (Excel)

### 2.1 Estructura del Excel `SALES - dinkbit.xlsx`

- Una hoja por trimestre con nombre exacto **`Qn | AAAA`** (ej. `Q2 | 2026`; a veces con espacio
  final). Solo estas hojas son fuente de verdad.
- Otras hojas que se **ignoran**: `Intérvalos`, `Template - Reporte - Qs`, `Template - Reporte -
  Anual`, `Y | AAAA` (resúmenes anuales; sirven solo para validar), `Contratos`, `Pendientes`,
  `Pipeline`, `Cierre …`, `2022 - Q3 | Reporte`.
- En cada hoja Q, el listado de propuestas ("Propuestas | Listado Completo") empieza en la fila
  cuyo encabezado es `Fecha | Nombre | Origen | Area | Proyecto | Valor | Status`.
  **`tools/update_sales.py` ubica estas columnas por el NOMBRE del encabezado, no por posición
  fija** — así que un corrimiento de columna o fila no rompe la carga (antes sí lo hacía).
- A la derecha viven los bloques de resumen: **Propuestas | General**, **Propuestas | Área**,
  **Propuestas | Tipo de Proyecto**, **Propuestas | Origen de Contacto** y **COMISIONES**. El
  dashboard replica los cuatro primeros a partir del listado; **COMISIONES se ignora por decisión
  del usuario** (no debe aparecer nada de comisiones, y el Excel ni se versiona en git por esto).
- Validación clave: en el bloque "Propuestas | General" la celda `Total` debe coincidir con el
  número de filas leídas del listado. El parser lo comprueba y lo marca `<-- DIFIERE` si no
  cuadra — y **no escribe nada** si hay errores de validación, salvo que se use `--force`.

### 2.2 Campos y taxonomía

| Columna | Campo JSON | Notas |
|---|---|---|
| Fecha | `fecha`, `year`, `month` | Formato texto `M.AAAA` o `MM.AAAA`; a veces datetime. Si no se puede leer, se usa el primer mes del trimestre y se avisa |
| Nombre | `nombre` | Cliente / cuenta, tal cual |
| Origen | `origen` | Tal cual |
| Area | `area` | Tal cual |
| Proyecto | `proyecto` | Tal cual |
| Valor | `valor` | MXN sin IVA, número |
| Status | `status` | Exactamente `Ganada`, `Perdida` o `Pendiente` |

**La taxonomía se conserva EXACTAMENTE como está en el Excel en `sales-history.json` y en el
Reporte de ventas.** El Excel cambió de nombres a lo largo de los años: `Desarrollo` →
`Web & App Development`, `Diseño` → `Design`, `Contacto` → `Direct Contact`, `Existente` →
`Active Client`, `Estrategia Digital` → `Marketing Strategy`, `Sitio Web` → `Website`, `Shopify`
→ `Online Store`. En el Reporte de ventas aparecen como categorías distintas y así debe seguir.

**Excepción — Comparar periodos (17-sep-2026):** ahí hay un interruptor opcional "Vista
normalizada" (apagado por defecto) que agrupa exactamente esos 7 pares al mostrar los desgloses
por categoría. Es **solo de despliegue**: no toca `sales-history.json`, no aplica a ninguna otra
vista, y no inventa equivalencias que dinkbit no documentó (`Branding`, `Consultoría`,
`Plataforma`, `Desarrollo Flexible`, etc. se quedan tal cual aunque parezcan relacionadas). El
mapeo vive en `NORM_MAP` dentro de `src/js/86-compare.js`; si dinkbit confirma una equivalencia
nueva, se agrega ahí.

### 2.3 Esquema de `sales-history.json`

```json
{
  "meta": {
    "source": "SALES - dinkbit.xlsx",
    "source_sha256_12": "a1b2c3d4e5f6",
    "generated": "2026-09-24T13:18:00",
    "tool_version": 2,
    "currency": "MXN",
    "quarters": ["2021-Q4", "...", "2026-Q2"],
    "missing_quarters": ["2025-Q4"],
    "record_count": 742,
    "taxonomy_policy": "as-is (sin normalizar)",
    "hit_rate_definition": { "revenue": "Accrued / (Pending + Lost + Accrued)", "count": "Ganadas / Total propuestas" },
    "catalogs": { "area": {...}, "origen": {...}, "proyecto": {...}, "status": {...} },
    "quality": [ { "level": "warn", "code": "fecha_ilegible", "sheet": "Q2 | 2026 ", "msg": "..." } ]
  },
  "records": [
    { "id": "2026-Q2-a1b2c3d4", "quarter": "2026-Q2", "year": 2026, "q": 2, "month": 6, "fecha": "6.2026",
      "nombre": "Healthical", "origen": "Active Client", "area": "Design", "proyecto": "Marketing Strategy",
      "valor": 211410, "status": "Pendiente" }
  ]
}
```

- `quarters` ordenado ascendente; `missing_quarters` = trimestres sin hoja entre el primero y el
  último (hueco "SIN REPORTE" en el menú, deshabilitado; **nunca se rellenan con datos de Attio**).
- **`id` ya no es posicional** (antes era `{trimestre}-{consecutivo}`, así que una fila insertada
  o reordenada en el Excel cambiaba los ids de todas las que venían después). Ahora es un hash
  corto de `(trimestre, mes, nombre normalizado, proyecto normalizado)`, así que **es estable
  aunque se reordenen filas o se edite el valor/status/área/origen** de una propuesta existente
  — lo que permite que el reporte de cambios diga "esta propuesta pasó de Pendiente a Ganada" en
  vez de verla como una fila nueva.
- `quality`: avisos que dejó el parser en esa carga (fecha ilegible, fila sin nombre, trimestre
  que desapareció del Excel, variantes de escritura de una categoría, posibles typos, categorías
  nuevas respecto a la carga anterior). El dashboard los muestra en "Estado de los datos" (§4).
- `catalogs` = conteo por valor tal cual, ordenado desc. El dashboard los usa para los filtros.

### 2.4 Cómo se agrega un periodo nuevo (Skill 1)

El Excel que comparte Edgar **contiene todas las hojas**, no solo la nueva. El procedimiento es
regenerar todo, no hacer un merge incremental:

1. Recibir el archivo (queda en `/mnt/user-data/uploads/`, **no se versiona** — ver `.gitignore`).
2. Ejecutar `python3 tools/update_sales.py "SALES - dinkbit.xlsx"`.
3. Leer la salida: una línea por hoja `[Qn | AAAA] N propuestas (resumen Excel: N)`, más cualquier
   `<-- DIFIERE`. Si hay errores de validación (status inválido, valor no numérico, hoja sin
   encabezado, trimestre que desapareció), el script **no escribe nada** y hay que decidir con
   Edgar si corregir el Excel o forzar con `--force`.
4. Revisar `data/last-sales-update.md`: trimestres nuevos, propuestas agregadas/eliminadas/
   modificadas respecto a la carga anterior, y el resumen del último trimestre (Accrued, Hit
   Rate $, Hit Rate #, deltas vs. el trimestre anterior).
5. `python3 tools/build.py && python3 tools/validate.py`.
6. Resumen a Edgar: periodo agregado, propuestas, Accrued, Hit Rate $ y Hit Rate # del periodo, y
   deltas vs. el trimestre anterior — y cualquier aviso de calidad que valga la pena que sepa.

Nada en `src/` depende de fechas fijas: años, trimestres, catálogos y huecos se derivan del JSON.

### 2.5 Definiciones que el dashboard calcula (alineadas al Excel)

- **Accrued / Lost / Pending** = suma de `valor` de propuestas Ganadas / Perdidas / Pendientes.
- **Total emitido** = Accrued + Lost + Pending.
- **Hit Rate $** = Accrued ÷ Total emitido — fórmula literal del Excel.
- **Hit Rate #** = Ganadas ÷ Total de propuestas.
- **Ticket promedio** = Accrued ÷ propuestas ganadas.
- Deltas comparan contra el periodo inmediatamente anterior que exista. Si el anterior no tiene
  hoja, no hay delta.
- Sparklines de los KPIs = últimos 8 trimestres hasta el periodo.
- **Comparabilidad entre años:** 2021 y 2022 no tienen ninguna propuesta "Pendiente" en el Excel
  (todo es Ganada o Perdida); desde 2023 sí aparecen. El dashboard avisa cuando un periodo tocado
  cae en esa categoría, porque su Hit Rate no es directamente comparable con los años que sí
  registran Pendientes.

### 2.6 Vista integral por periodo

Sin cambios respecto al diseño original: Encabezado + 4 KPIs → Revenue apilado + Propuestas |
Área → Propuestas | General (dona + Hit Rate) → Evolución del periodo (año/histórico) →
Desglose por categoría (Área, Tipo de Proyecto, Origen de Contacto + Matriz + Rangos de ticket)
→ Cuentas y hallazgos → Listado de propuestas (filtros, orden, paginación, CSV).

**Nuevo:** cada vista abre con un bloque colapsable "Estado de los datos" (ver §4) justo debajo
de los KPIs, con los avisos relevantes a ese periodo.

---

## 3. Pipeline · Snapshot + historial (Attio)

### 3.1 Esquema de `pipeline-snapshot.json` (snapshot vigente)

```json
{
  "meta": { "source": "Attio CRM · Pipeline Weekly", "snapshot_date": "2026-09-14", "currency": "MXN",
            "stages": ["1. Lead", "2. Proposal", "3. In Progress", "4. Due Diligence", "5. Won 🎉", "6. Lost"],
            "deal_count": 77 },
  "deals": [
    { "name": "Diseño de Sitio Web | A.I.", "company": "MBS Textil", "stage": "2. Proposal",
      "bu": "Web&App", "src": "Network", "sol": "Web Design & Development", "val": 15000,
      "created": "2026-05-05", "id": "attio_record_id_si_está_disponible", "key": "mbstextil|disenodesitiowebai" }
  ]
}
```

- **Pipe activo** = etapas 1–4. **Won** = etapa 5. **Lost** = etapa 6 (fuera del embudo).
- `SRC_ALIAS` en `src/js/10-data.js` unifica variantes de escritura de la fuente
  (`"Linked In"` → `"LinkedIn"`). Si Attio devuelve una fuente nueva con dos escrituras, se agrega
  ahí; no se reescribe el JSON.
- `key`: identificador con el que el dashboard sigue a un deal entre snapshots. Se genera del
  `id` de Attio si viene en el JSON de entrada, o si no, de `empresa|nombre` normalizado. **Pasar
  el `id` de Attio en cada deal es lo recomendado** — sin él, si un deal cambia de nombre entre
  una actualización y la siguiente, el dashboard lo verá como "nuevo" + "desaparecido" en vez de
  como el mismo deal que avanzó (`tools/update_pipeline.py` avisa cuando pasa esto).

### 3.2 `pipeline-history.json` — por qué existe

Cada actualización **se agrega** al historial, nunca lo reemplaza (una fecha repetida sí
reemplaza solo esa entrada). Sin este historial no hay manera de saber qué cambió entre una
lectura de Attio y la siguiente, ni de calcular tendencia o probabilidad de cierre real. El
snapshot vigente (`pipeline-snapshot.json`) es siempre el último snapshot del historial.

```json
{ "snapshots": [
    { "date": "2026-09-14", "deals": [ { "...": "mismo esquema que arriba, con key" } ] },
    { "date": "2026-09-21", "deals": [ "..." ] }
] }
```

### 3.3 Cómo se actualiza desde Attio (Skill 2)

1. Con el MCP de Attio, listar **todos** los deals del pipeline (todas las etapas, incluidos Won
   y Lost) con: nombre, empresa asociada, etapa, unidad de negocio, fuente, solución, valor,
   fecha de creación, y **el `id`/`record_id` del deal en Attio** (para el seguimiento por `key`).
2. Armar un JSON con `{"meta": {"snapshot_date": "AAAA-MM-DD"}, "deals": [...]}` (o solo la lista
   de deals + `--date` al llamar el script).
3. `python3 tools/update_pipeline.py nuevo-snapshot.json`. Puntos de cuidado:
   - `stage` se normaliza automáticamente si Attio la devuelve sin el prefijo numérico
     (`"In Progress"` → `"3. In Progress"`). Si aparece una etapa que no está en `meta.stages`,
     el script **se detiene** y dice explícitamente que hay que preguntarle a Edgar cómo tratarla
     (agregarla implica revisar qué cuenta como pipe activo/Won/Lost).
   - `val` en MXN; vacío → `0` (se cuenta pero no suma).
   - `created`: fecha de creación del registro en Attio, ISO `YYYY-MM-DD`.
4. Revisar `data/last-pipeline-update.md`: deals nuevos, que cambiaron de etapa, ganados,
   perdidos, desaparecidos (ya no están en Attio — puede ser que se archivaron), y el resumen
   (pipe activo, Won, Lost, conversion rate).
5. `python3 tools/build.py && python3 tools/validate.py`.
6. Resumen a Edgar: deals totales, pipe activo (deals y $), won, lost, conversion rate por
   cantidad y por valor, y las diferencias vs. el snapshot anterior.

### 3.4 Qué muestra la vista Snapshot

KPIs (Pipe activo héroe · Won · Conversion rate · Etapa avanzada) → **Embudo** (5 etapas activas
hasta Won, altura = deals en la etapa, Lost en recuadro aparte) → **Cambios vs. snapshot
anterior** (nuevo, con el historial: nuevos, avanzaron, ganados, perdidos, desaparecidos) →
**Pipeline ponderado** (nuevo, ver §3.5) → **Deals en [etapa]** (tabla filtrable) → Unidades de
negocio | Fuentes de deals → **Tendencia y velocidad** (nuevo: pipe activo por snapshot, mediana
de días por etapa, ciclo de venta observado para Won y Lost) → Antigüedad del pipe activo →
Hallazgos. Filtros superiores: Unidad de negocio y Fuente (afectan también Cambios/Ponderado/
Tendencia).

### 3.5 Pipeline ponderado — cómo se calcula la probabilidad por etapa (17-sep-2026)

**Decisión de Edgar: la probabilidad de cierre por etapa SIEMPRE se calcula de los datos del
pipeline — nunca es un número que dinkbit o Claude escriben a mano.** `data/config.json` ya no
tiene `stage_probability`; todo vive en `stageProbabilities()` (`src/js/82-pipeline-history.js`),
con dos métodos, del más al menos confiable:

1. **Observada** — entre los deals que el historial vio pasar por la etapa *i* y que ya tienen
   desenlace conocido (Won o Lost en un snapshot posterior), qué fracción terminó Won. Requiere
   que el historial haya visto el tránsito completo (2+ snapshots con ese deal cambiando de
   etapa a un desenlace).
2. **Estimada (respaldo)** — con poco historial (hoy: 1 solo snapshot real, cero tránsitos
   observados) se usa el embudo del snapshot actual: cuántas oportunidades hay HOY en la etapa
   *i* o más adelante (Won incluido), y qué fracción de esas son Won. Es un punto de partida
   razonable, pero **asume que lo Perdido pudo perderse en cualquier etapa por igual** — con un
   solo snapshot no sabemos en qué etapa estaba un deal antes de perderse, así que las etapas
   tempranas quedan sobreestimadas (con los datos de hoy: Lead ~47%, Due Diligence ~81%, cuando
   lo esperable sería que Lead fuera bastante más bajo). El dashboard lo dice explícitamente en
   la nota de esa tarjeta, y cada etapa muestra de qué método salió su número.

Este método se corrige solo (sin tocar código) en cuanto el historial acumule snapshots con
tránsitos completos — no hace falta que Edgar ni Claude ajusten nada a mano.

---

## 4. Estado de los datos (avisos)

Cada vista (Reporte de ventas, Comparar periodos, Pipeline) muestra un bloque colapsable "Estado
de los datos" con avisos calculados **en el navegador contra la fecha de hoy** — no hace falta
reconstruir el dashboard para que aparezca "este snapshot tiene 15 días". Ejemplos: Excel
desactualizado respecto al trimestre en curso, huecos de trimestre en el periodo que se está
viendo, años sin propuestas Pendientes (no comparables), avisos de calidad que dejó el parser del
Excel, snapshot de Attio más viejo que `config.json`→`snapshot_stale_days` (hoy: 8 días), deals
sin monto o sin empresa, variantes de fuente unificadas, y (en Comparar) si los dos periodos son
de duración distinta o si el interruptor de normalización está activo.

---

## 5. Checklist de validación antes de publicar

**Automatizado en `python3 tools/validate.py`** (sale con código 1 si algo falla; usa
`--no-browser` para saltarse la parte de Chromium si no está disponible):

1. `sales-history.json`: `record_count` cuadra, status válidos, ids únicos, todos los registros
   dentro de `meta.quarters`, catálogos cuadrando con los registros.
2. `pipeline-snapshot.json` + `pipeline-history.json`: 6 etapas, ningún deal fuera de
   `meta.stages`, `deal_count` correcto, keys únicas, snapshot no más viejo que
   `snapshot_stale_days`, historial ordenado sin fechas repetidas, y que el último snapshot del
   historial sea idéntico al snapshot vigente.
3. `python3 tools/build.py --check`: que `public/index.html` esté al día con `src/` + `data/`.
4. Sintaxis JS del HTML generado (compilarlo con `node --check`), y que no haya ningún recurso
   externo (`http://`/`https://` en `src=`/`href=`).
5. En Chromium headless: las 25 vistas de periodo (Histórico + años + trimestres) renderizan sin
   `NaN`/`undefined`; los KPIs en pantalla coinciden con el cálculo en Python; Comparar y
   Pipeline sin errores; el modo impresión oculta la barra lateral; las URL con estado
   (`#/ventas/…`, `#/comparar?…`, `#/pipeline?…`) se restauran correctamente al abrirse en frío;
   la exportación a PDF no lanza errores; sin errores de consola; sin peticiones de red externas.
6. **Pruebas automáticas** (`python3 -m unittest discover -s tests`): parser del Excel (encabezado
   movido, hoja sin encabezado, status inválido, ids estables aunque se reordenen filas o se
   editen valores, trimestre que desaparece), updater del pipeline (cambios de etapa, historial,
   ids de Attio), que el cálculo de Hit Rate en JS coincida exactamente con Python, que
   `stageProbabilities()` distinga bien observada/estimada, y que el mapeo de "Vista normalizada"
   sea exactamente el documentado en §2.2.
7. Confirmar a Edgar qué cambió (periodo agregado / fecha de snapshot) con las cifras clave.

---

## 6. Decisiones de producto ya tomadas (no reabrir sin que Edgar lo pida)

- Sin nada de **Comisiones** en el dashboard (ni el Excel se versiona en git, por esto).
- Menú por **periodo**, no por tipo de dato; una vista integral por periodo.
- **Taxonomía del Excel tal cual** en el Reporte de ventas; huecos de trimestre visibles, nunca
  rellenados. La única excepción es el interruptor opcional de "Vista normalizada" dentro de
  **Comparar periodos**, apagado por defecto, con exactamente los 7 pares documentados en §2.2.
- Filtros por **dropdown**, no por botones.
- Excel y Attio **separados**; Lost **fuera** del embudo; sin "Top 10 deals".
- Paleta C (Semáforo de marca) para gráficas; embudo con altura por deals en la etapa.
- Ítem "Histórico" del menú sin rango de años.
- **Probabilidad de cierre por etapa (Pipeline ponderado): siempre calculada de los datos del
  pipeline, nunca un número fijo escrito a mano** (ver §3.5). No reabrir esto para volver a un
  valor manual sin que Edgar lo pida explícitamente.
- **Actualización de datos: siempre por chat.** Edgar comparte el Excel o pide el pull de Attio
  en la conversación; Claude corre las herramientas y deja `public/index.html` listo; **Edgar
  hace el `git push`** (directamente o vía su propio skill de publicación) — Claude no publica.
- **Login con usuario/contraseña (25-sep-2026):** el link del dashboard es público, así que se
  agregó protección con HTTP Basic Auth vía `proxy.mjs` (Routing Middleware de Vercel,
  `vercel.json` → `proxy.entrypoint`). El usuario y la contraseña viven **solo** como variables
  de entorno en el proyecto de Vercel (`DASH_USER`, `DASH_PASS`) — nunca en el repo. Esto es la
  única pieza de "backend" del proyecto: corre en el runtime de Node de Vercel, antes de servir
  `public/index.html`; si las variables de entorno no están configuradas, el middleware bloquea
  el acceso por defecto (fail closed) en vez de dejarlo abierto. Se descartó el Password
  Protection nativo de Vercel por requerir plan Enterprise o el add-on de $150 USD/mes en Pro; y
  se descartó un candado solo en JavaScript del lado del cliente por no ser seguridad real (la
  contraseña quedaría visible en el código fuente).
