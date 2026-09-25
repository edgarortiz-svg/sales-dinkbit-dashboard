# Mapeo de campos Attio → pipeline-snapshot.json

Confirmado con Edgar el 2026-09-25. Objeto de Attio: `deals`.

| Campo del dashboard | `api_slug` en Attio | Notas |
|---|---|---|
| `name` | `name` | tal cual |
| `company` | `associated_company` | viene como referencia `{object_id, record_id}` a `companies` — resolver a nombre con `get-records-by-ids` |
| `stage` | `stage` | status; normalizar tal cual viene (`"1. Lead"` … `"6. Lost"`) |
| `bu` | `business_unit` | select (multiselect en Attio, pero un solo valor por deal visto hasta ahora); valores: Web & App Development, Marketing, UX / UI Design, Design |
| `src` | `lead_source` | select |
| `sol` | `solution_6` | select |
| `val` | `value` | Attio lo devuelve como texto formateado (`"MX$500,400.00"`) — parsear a número; vacío → 0 |
| `created` | `created_at` | Attio lo devuelve como texto (`"Wednesday, 2026-04-08 19:24:05"`) — tomar solo la fecha, convertir a ISO `YYYY-MM-DD` |
| `id` | `record_id` (UUID nativo del deal, no el atributo de texto "Record ID") | para generar `key` estable entre snapshots |
| Filtro de vigencia (no es campo del dashboard) | `pipeline_status` | valores: `Active` / `Closed`. **Solo entran los deals `Active`.** |

## Decisión — etapa "7. On Hold"

Attio tiene una séptima etapa, `7. On Hold`, que **no existe** en `meta.stages` del dashboard
(que solo tiene 6: Lead, Proposal, In Progress, Due Diligence, Won, Lost).

**Decisión de Edgar (2026-09-25): los deals en `On Hold` nunca se contemplan.** Se descartan
igual que un deal no-Active, sin importar su `pipeline_status` — no se convierten, no se cuentan
en el snapshot, y no aparecen en ninguna categoría del resumen del Paso 5 (salvo, opcionalmente,
como referencia de cuántos se dejaron fuera).

## Decisión — carpeta local de versiones archivadas (Paso 0)

Edgar confirmó (2026-09-25) que Claude trabaja **directo desde `data/` en el repo (git)**, sin
comparar contra ninguna carpeta local archivada. El Paso 0 del skill (comparar contra la última
versión archivada localmente) se omite en este entorno.
