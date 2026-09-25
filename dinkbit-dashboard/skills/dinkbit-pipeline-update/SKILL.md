---
name: dinkbit-pipeline-update
description: Actualiza el Snapshot del Pipeline del dashboard de Sales & New Business de dinkbit trayendo todos los deals actuales desde Attio CRM vía MCP, regenerando el dashboard publicable y reportando exactamente qué cambió (nuevos, avances de etapa, cerrados, desaparecidos, sin monto). Úsalo siempre que Edgar pida actualizar, refrescar o sincronizar el pipeline o el snapshot de Attio, traer los deals más recientes del CRM, o publicar una nueva versión del dashboard de ventas de dinkbit — incluso si no menciona la palabra "skill" o "Attio" explícitamente y solo dice algo como "jala lo último del CRM" o "actualiza el pipeline".
compatibility: Repo del dashboard dinkbit-dashboard como directorio de trabajo (necesita su CONTEXT.md y su carpeta tools/); Python 3; conector MCP de Attio con acceso de lectura al pipeline; una carpeta local (elegida por Edgar) donde archivar cada versión generada.
---

# Actualizar el Pipeline de dinkbit desde Attio

Este skill le encarga a Claude, de punta a punta, mantener al día la sección de Pipeline del
dashboard de Sales & New Business de dinkbit: traer los deals de Attio, convertirlos, regenerar
el dashboard, y contarle a Edgar qué cambió — sin que él tenga que pedir cada paso por separado.

## Primero: este skill vive dentro de un repo concreto

Antes de tocar nada, confirma que el directorio de trabajo actual es el repo del dashboard: debe
tener un `CONTEXT.md` en la raíz y una carpeta `tools/`. Si no los encuentras, detente y
pregúntale a Edgar dónde está el repo — no adivines una ubicación.

Lee `CONTEXT.md` completo antes de seguir. Ahí están, ya escritas y ya acordadas con Edgar: el
esquema exacto del pipeline (qué campos tiene un deal, qué son `meta.stages`, qué cuenta como pipe
activo/Won/Lost), las decisiones de producto que no se reabren sin que él lo pida, y el checklist
de validación antes de publicar. Este skill no repite esa información — la usa.

## Paso 0 — Partir de la última versión archivada, no de lo que haya en el repo a ciegas

Edgar lleva un archivo local de cada versión que este skill genera: una carpeta con una
subcarpeta por actualización, nombrada con la fecha, para poder identificarlas de un vistazo sin
tener que abrir nada. Este archivo es la referencia de "cuál fue la última versión real" — más
fácil de confiar para Edgar que preguntarle sobre el estado de git.

### La primera vez: pregunta dónde vive esa carpeta, y recuérdalo

Si no sabes dónde está esa carpeta local (revisa si ya lo tienes guardado de una vez anterior —
por ejemplo junto con el mapeo de campos del Paso 1), pregúntaselo a Edgar directamente. Una vez
que te la confirme, guarda la ruta en el repo (puede ir en el mismo archivo donde guardas el
mapeo de campos, o en uno aparte — tú decides) para no volver a preguntarla.

### En cada actualización

1. Dentro de esa carpeta local, busca las subcarpetas nombradas con fecha en formato
   `AAAA-MM-DD` y toma la más reciente por orden cronológico — esa es "la última versión
   generada". Si la carpeta está vacía, es la primera vez que corres esto: dilo y sigue de
   corrido, no hay nada que verificar todavía.
2. Compara los datos del pipeline que tiene esa subcarpeta más reciente contra lo que hay ahora
   mismo en `data/` dentro del repo. Si coinciden, sigue de corrido con el Paso 1: confirmaste que
   partes de la última versión real.
3. Si **no coinciden** — el repo tiene algo distinto a lo último archivado —, detente. No decidas
   tú cuál de las dos es la buena: dile a Edgar exactamente qué diferencia encontraste y espera su
   respuesta antes de seguir. Esto puede pasar si alguien tocó el repo por fuera de este skill, o
   si se perdió una actualización anterior.

### Al terminar, después de que la validación del Paso 4 haya pasado

Cuando ya regeneraste el dashboard y pasó la validación del Paso 4, copia la versión nueva —los
datos del pipeline y el `public/index.html` resultante— a una subcarpeta nueva dentro de esa
carpeta local, nombrada con la fecha de hoy (`AAAA-MM-DD`). Si ya existe una carpeta con la fecha
de hoy porque corriste esto más de una vez en el mismo día, agrégale un sufijo (`-2`, `-3`…) para
no sobreescribir la anterior; sigue usando la de fecha más reciente (con su sufijo, si lo tiene)
como "la última" la próxima vez que alguien pregunte.

Este archivo local es del skill, no de git: no reemplaza el `git push` que Edgar hace para
publicar — es, aparte, la manera más simple para que él identifique y compare versiones sin tener
que tocar git para nada.

## Cómo trabajar: actúa, y pregunta solo cuando la ambigüedad es real

Salvo las excepciones marcadas explícitamente más abajo (un desacuerdo entre el repo y la carpeta
local de versiones en el Paso 0, el mapeo de campos la primera vez, y una etapa de Attio que el
dashboard no reconoce), corre los cuatro pasos de corrido sin pedir permiso en cada uno: traer,
convertir, regenerar, contar. Que un deal no tenga monto, que uno haya desaparecido, o que la
mayoría de los deals sigan igual que la vez pasada — eso no es ambigüedad, es justo lo que hay que
reportar al final. Pregunta solo cuando dos lecturas razonables de los datos (o del estado de las
versiones) llevarían a un resultado distinto, no para confirmar cosas que ya puedes decidir tú con
lo que tienes.

## Paso 1 — Traer todos los deals de Attio (solo lectura)

Usa las herramientas del conector de Attio (si no están cargadas, búscalas primero) para listar
**todos** los deals del pipeline: las seis etapas, incluidas Won y Lost. Si el listado viene
paginado, sigue pidiendo páginas hasta agotarlas — nunca te quedes con una muestra ni asumas que
los primeros N resultados son el total.

### El primer filtro, antes que cualquier otro: Pipeline Status = Active

No todo lo que existe en Attio entra al snapshot. Antes de mirar etapa, valor o cualquier otro
campo, revisa el atributo **Pipeline Status** de cada deal: **solo entran al snapshot los deals
que tengan la etiqueta "Active"**. Un deal que exista en Attio pero no tenga esa etiqueta (porque
está archivado, descartado, duplicado, o cualquier otro estado que no sea Active) se descarta por
completo desde este primer filtro — no se convierte, no se cuenta como parte del pipeline, y no
aparece en ninguna de las categorías del resumen del Paso 5 salvo, opcionalmente, como referencia
de cuántos se dejaron fuera (ver la nota en el Paso 5).

Este filtro es anterior e independiente al de la etapa (`stage`): un deal puede estar Active y en
cualquiera de las seis etapas, incluidas Won o Lost. Lo que decide si un deal participa del
snapshot es exclusivamente su Pipeline Status, no su etapa.

Este flujo es de **solo lectura en Attio**: en ningún momento crees, edites, muevas de etapa ni
borres nada allá, así el objetivo final sea corregir
algo que veas mal — eso se lo dices a Edgar, no lo arreglas tú en el CRM.

### La primera vez en este repo: explora el esquema y propone el mapeo

Busca si ya existe `data/attio-field-mapping.md` (o el archivo que hayas creado la vez anterior
con este mismo propósito — el nombre no importa, lo que importa es que exista). Si no existe:

1. Usa las herramientas de Attio para listar los atributos del objeto de deals y entender qué
   campos hay disponibles.
2. Propónle a Edgar, explícitamente, un mapeo de esos campos hacia lo que el dashboard necesita
   por deal: nombre, empresa asociada, etapa, unidad de negocio, fuente del deal, solución/
   servicio, valor en MXN, fecha de creación, y el identificador del registro en Attio (para poder
   seguir al mismo deal entre una actualización y la siguiente aunque le cambien el nombre). Incluye
   también, como parte del mismo mapeo, cuál es el atributo de Pipeline Status y confirma que el
   valor que marca a un deal como vigente sigue siendo "Active" — esto no es un campo más del
   dashboard, es el filtro del Paso 1, así que consérvalo identificado junto con el resto.
3. Espera su confirmación antes de usarlo — esta sí es una ambigüedad real: tú no puedes adivinar
   con certeza qué campo de Attio corresponde a "unidad de negocio" si el nombre no es obvio, y
   una etapa mal mapeada cambia números reales del negocio.
4. Una vez confirmado, guárdalo en un archivo dentro del repo (`data/attio-field-mapping.md` es un
   buen lugar) para no tener que volver a preguntar. En las siguientes actualizaciones, revisa de
   pasada que el mapeo guardado siga cuadrando con lo que devuelve Attio hoy; si ves un campo
   nuevo o algo que ya no encaja, ahí sí vuelves a preguntar.

## Paso 2 — Convertir al formato que el dashboard ya entiende

Con el mapeo (nuevo o el que ya tenías guardado), arma el pipeline de deals en el esquema que
`CONTEXT.md` documenta, y pásaselo a la herramienta que el repo ya tiene en `tools/` para esto
(revisa su docstring: ya sabe normalizar el nombre de la etapa al texto exacto de `meta.stages`,
generar la clave con la que se sigue cada deal entre snapshots, y sumar este snapshot al historial
completo en vez de reemplazarlo — ese historial es lo que permite calcular tendencia y
probabilidad de cierre reales, así que nunca se pierde).

Si aparece una etapa que la herramienta no reconoce, la propia herramienta se va a detener y te va
a pedir que confirmes con Edgar cómo tratarla — esa es la segunda (y última) pausa legítima de
este flujo, porque agregar una etapa nueva cambia qué cuenta como pipe activo, Won o Lost, y esa
es una decisión de negocio.

No inventes nada que Attio no tenga: un deal sin empresa se queda sin empresa, uno sin monto se
queda en cero (nunca lo estimes ni lo completes por tu cuenta). Los nombres — de deals, empresas,
etapas, fuentes — se conservan exactamente como los devuelve Attio: no los traduzcas, no los
abrevies, no les cambies el formato.

## Paso 3 — Regenerar el dashboard, reemplazando el anterior

Usa lo que el repo ya tiene en `tools/` para ensamblar el HTML final a partir de los datos
nuevos. El resultado **reemplaza por completo** al `public/index.html` anterior: es una foto
nueva del pipeline, no un parche sobre la vieja. Nunca edites ese archivo a mano, y nunca, en este
flujo, toques nada del Reporte de Ventas (los datos que vienen del Excel) — las dos fuentes del
dashboard no se mezclan ni de pasada, ni siquiera para "aprovechar y actualizar algo más".

## Paso 4 — Validar antes de entregar

Antes de decir que terminaste, corre lo que el repo ya trae para esto (hay algo en `tools/` hecho
exactamente para este checklist) y confirma que el dashboard reconstruido está al día con los
datos nuevos, que no quedó ningún error de sintaxis ni ninguna referencia externa colada, y que
las cifras que vas a poner en el resumen del Paso 5 cuadran con los datos. Si algo de esto falla,
no entregues nada: dile a Edgar qué falló y por qué, y espera instrucciones antes de forzar la
entrega.

Si todo pasó, archiva esta versión en la carpeta local antes de seguir al resumen — ver "Al
terminar" en el Paso 0.

## Paso 5 — Contar qué cambió, siempre en el mismo formato

Abre el resumen con una línea que confirme el resultado del Paso 0 (de qué fecha era la última
versión archivada de la que partiste, o que era la primera vez y no había ninguna). Después de esa
línea, cierra siempre con el mismo resumen y en el mismo orden, para que una actualización se
pueda comparar con la anterior de un vistazo:

1. **Fecha del snapshot** y cuántos deals entraron al snapshot (Pipeline Status = Active).
   Menciona también, en la misma línea, cuántos había en total en Attio y cuántos se dejaron
   fuera por no tener esa etiqueta — así Edgar nunca se pregunta por qué el conteo del dashboard
   es menor que lo que él ve en el CRM.
2. **Nuevos** — cuántos, y cada uno con nombre · empresa · etapa · valor.
3. **Avanzaron de etapa** — cuántos, y cada uno con etapa anterior → etapa nueva.
4. **Cerrados** — cuántos Ganados y cuántos Perdidos, con su valor.
5. **Desaparecidos** — cuáles ya no aparecen en Attio; dilo como pregunta abierta ("¿se
   archivaron o se eliminaron?"), nunca lo asumas.
6. **Sin monto** — cuántos deals activos no tienen valor capturado en Attio.

Si algún punto no aplica — por ejemplo, es la primera actualización y no hay snapshot anterior
con qué comparar —, dilo explícitamente en esa sección en vez de omitirla, para que el resumen
siempre tenga el mismo esqueleto de seis puntos.

---

## Reglas que no se negocian

- **Solo entran al snapshot los deals con Pipeline Status = Active** en Attio; todo lo demás se
  descarta antes de convertir o contar nada.
- Attio es de **solo lectura**: nunca crees, edites ni borres nada ahí.
- Las dos fuentes del dashboard (Excel de ventas y Attio) **nunca se mezclan**.
- **Nunca se edita `public/index.html` a mano** — siempre se regenera desde los datos.
- **No se inventa nada**: lo que Attio no tiene, se queda vacío o en cero.
- Los **nombres se conservan tal cual** los devuelve Attio.
- Cada actualización es una **foto completa que reemplaza** a la anterior, nunca un parche.
- Lo que `CONTEXT.md` ya decidió se respeta sin reabrir la discusión, salvo que Edgar lo pida.

## Cómo sabe Edgar que quedó bien hecho

Desde su silla, sin abrir el repo, puede verificar cuatro cosas:

1. El resumen abre diciendo de qué versión archivada se partió (o que era la primera vez), y
   luego trae las seis secciones del Paso 5, en el mismo orden que la vez anterior.
2. Los números del resumen (nuevos + avanzaron + cerrados + sin cambio) suman el total de deals
   **Active** que dijiste haber traído en el punto 1 — no el total que hay en Attio contando los
   que no tienen esa etiqueta.
3. Si abre el dashboard, el Snapshot muestra la fecha que le confirmaste y el conteo de deals
   coincide con el del resumen.
4. Nada de lo que ve ahí mezcla cifras del Reporte de Ventas con las del Pipeline: siguen siendo
   dos historias separadas.
