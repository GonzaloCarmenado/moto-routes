# Review — `normalizar-y-exportar-rutas`

## CRÍTICO (leer primero)

- **Sin secretos nuevos.** `MAPMATCH_OSRM_URL` es una URL de servicio interno de Docker (`http://osrm:5000`), no una credencial — confirmado en `infra/docker/.env.example`/`.env.prod.example` (vacía en prod, a rellenar). Diff completo revisado antes de este archivado: sin claves, tokens ni IPs personales versionadas (la IP de LAN usada para probar en el móvil se revirtió del CSP/`tauri.conf.json` antes de commitear).
- **CSP sin cambios** — `connect-src` sigue igual que antes de este cambio; ninguna llamada nueva del frontend sale directamente a OSRM (solo `apps/api` lo hace, server-to-server).
- **`src/shared/` tocado**: `capabilities-allowlist.spec.ts` (nuevo permiso `dialog:allow-save`, guard test actualizado a propósito), `route-cloud-api.service.ts` (nueva función `exportRouteGPX`, no toca las existentes), `action-icons.ts` (icono nuevo, sin tocar los existentes). Radio de impacto acotado: nada de esto cambia comportamiento ya existente.
- **Dependencias nuevas**: `@tauri-apps/plugin-dialog` (npm + crate Rust) — justificada en [[ADR-052]] (`memory/decisions.md`), no había alternativa sin plugin que funcionara en el WebView de Android real (verificado). Sin dependencias nuevas en `apps/api` (Go) ni cambios a `apps/mobile` fuera de lo descrito.
- **Reglas del proyecto saltadas**: ninguna. `data-cy` presente en el botón de exportar y en las opciones del menú de formato (vía `confirmDialog`, ya con su propio patrón `confirm-dialog-action-<id>`). JSDoc en todo símbolo exportado nuevo. Sin CSS inline.

**Veredicto de seguridad: sin hallazgos.**

## Mapeo Requirement → Scenario → Test

### Capability `normalizacion-gps`

| Requirement | Scenario | Test(s) | Estado |
|---|---|---|---|
| Normalización automática al sincronizar | Ruta con puntos ruidosos se normaliza al guardarse | `TestPostgresRouteStore_UpsertFillsMatchedColumnsWhenMatcherSucceeds` (`internal/routes/postgres_store_test.go:304`), `TestClient_Match_SingleChunkReturnsAdjustedPointsInOrder` (`internal/mapmatch/client_test.go:66`) | ✅ + verificación manual en dispositivo real (`memory/context.md`, sesión 2026-08-19) |
| Normalización automática al sincronizar | Servicio de normalización no disponible | `TestPostgresRouteStore_UpsertSucceedsWithRawPointsWhenMatcherFails` (`postgres_store_test.go:324`), `TestClient_Match_ReturnsErrorOnServerFailure`/`ReturnsErrorOnTimeout` (`client_test.go:171,182`) | ✅ + verificación manual con `osrm` parado de verdad en dispositivo real |
| Normalización automática al sincronizar | Punto GPS demasiado alejado de cualquier carretera | `TestClient_Match_DiscardsAdjustmentFartherThan30Meters`, `TestClient_Match_NoMatchForWholeChunkLeavesAllPointsUnadjusted`, `TestClient_Match_NullTracepointLeavesThatPointUnadjusted` (`client_test.go:122,140,154`) | ✅ + confirmado en dispositivo real (ruta estática, 3/15 puntos normalizados, resto correctamente sin forzar) |
| Conservación de los puntos GPS originales | Los puntos originales siguen disponibles tras normalizar | `TestPostgresRouteStore_UpsertFillsMatchedColumnsWhenMatcherSucceeds` (`postgres_store_test.go:304`, aserción añadida en el propio gate de revisión — ver Hallazgos) | ✅ |
| Puntos normalizados no afectan a las paradas | Una parada conserva su posición original | `TestPostgresRouteStore_UpsertNormalizationDoesNotAlterStops` (`postgres_store_test.go:340`) | ✅ |

### Capability `exportacion-gpx`

| Requirement | Scenario | Test(s) | Estado |
|---|---|---|---|
| Exportación de una ruta a GPX | Exportación de una ruta normalizada | `TestGPXExportHandler_UsesMatchedPointsWhenNormalized` (`internal/routes/handler_test.go:238`) | ✅ |
| Exportación de una ruta a GPX | Exportación de una ruta sin normalizar | `TestGPXExportHandler_FallsBackToRawPointsWhenNotNormalized` (`handler_test.go:269`) | ✅ |
| Exportación de una ruta a GPX | Intento de exportar una ruta ajena o inexistente | `TestGPXExportHandler_ReturnsNotFoundForMissingOrOtherUsersRoute` (`handler_test.go:297`) | ✅ |
| Exportación de una ruta a GPX | Ruta sin puntos GPS | `TestGPXExportHandler_ReturnsBadRequestForRouteWithoutPoints` (`handler_test.go:312`) | ✅ |
| El GPX exportado incluye las paradas | Exportación de una ruta con paradas | `TestGPXExportHandler_IncludesStopsAsWaypoints` (`handler_test.go:328`) | ✅ |
| Formato GPX válido | El fichero exportado es un GPX válido | `TestGPXExportHandler_ProducesWellFormedGPX11Document` (`handler_test.go:358`) | ✅ |
| Acción de exportar desde el detalle de ruta | El usuario exporta una ruta desde el detalle | `route-detail-export.spec.ts` (9 tests, menú de formato + rama Tauri con `plugin-dialog`/`plugin-fs` + rama navegador con Web Share/`<a download>`), `cypress/e2e/routes/route-gpx-export.cy.ts` (E2E contra backend real) | ✅ + **verificación manual en dispositivo Android real** (selector nativo "Guardar como", fichero guardado donde el usuario elige) |
| Acción de exportar desde el detalle de ruta | Fallo de red al exportar | `route-detail-export.spec.ts` — "si falla la exportación, muestra un toast de error..." | ✅ |

**Cobertura de escenarios: 13/13 (100%).** Verificación manual explícita (no solo test automatizado) en 3 escenarios de comportamiento en dispositivo real, marcada así arriba.

## Hallazgos

1. **[cobertura] Aserción faltante sobre "puntos originales sin sobrescribir"** — `internal/routes/postgres_store_test.go`. El test que cubre la normalización con éxito solo comprobaba `matched_lat`/`matched_lng`, no que `lat`/`lng` originales seguían intactos tras el `UPDATE`. El comportamiento ya era correcto (`normalizePoints` en `postgres_store.go` solo actualiza las columnas `matched_*`), pero el Requirement "Conservación de los puntos GPS originales" no tenía una aserción explícita. **Corregido durante este mismo gate** (commit `test: confirma que normalizar una ruta no sobrescribe el punto GPS original`), no queda pendiente.
2. **[desviación, documentada] Mecanismo de guardado en Android distinto al propuesto en `design.md`.** El diseño original preveía Web Share API sin plugin nuevo; verificado en dispositivo real que no funciona en el WebView de Tauri (ni tampoco el fallback de `<a download>`). Sustituido por `@tauri-apps/plugin-dialog`, con [[ADR-052]] documentando la desviación y las alternativas descartadas. No es un gap — es un cambio de mecanismo real, encontrado y corregido antes de cerrar el cambio, correctamente registrado.
3. **[desviación, documentada] Timeout de `mapmatch.Client` no estaba wireado en producción.** `design.md` (Riesgos) ya anticipaba la necesidad de un timeout corto, pero el wiring real en `cmd/api/main.go` no lo fijaba — encontrado verificando el fallback con `osrm` parado en dispositivo real (la petición colgaba hasta el timeout de 8 s del cliente móvil). Corregido con `http.Client{Timeout: 5s}`; anotado en [[ADR-051]] (Consecuencias). No es un gap del código de producción actual (ya corregido), es una nota de qué se encontró y cómo.
4. **[calidad, menor] Rediseño de UI no anticipado en `proposal.md`/`design.md`.** La fila de acciones de `route-detail` pasó a ser solo iconos (sin etiqueta) y "Exportar" ahora abre un menú de formato — cambios pedidos explícitamente por el usuario durante la implementación, fuera del alcance original pero de bajo riesgo (reutiliza `confirmDialog` ya existente, sin componentes nuevos) y con tests propios actualizados (`route-detail-header.spec.ts`, `route-detail-export.spec.ts`). No bloquea: es una mejora de UX consentida explícitamente, no una desviación silenciosa.
5. **Pendiente real, fuera del alcance de este cambio**: procesar el extracto OSM en el servidor de producción (`infra/docker/osrm/prepare-osm-data.sh`) — documentado en `infra/docker/osrm/README.md` y en `memory/context.md` como próximo hito, no bloquea el archivado (el servicio ya degrada correctamente a best-effort sin él).

## Verificación independiente ejecutada en este gate

- `go build ./... && go vet ./... && go test ./...` → **231/231** (`apps/api`), `govulncheck ./...` → sin vulnerabilidades explotables.
- `npx tsc --noEmit && npx eslint src/ --max-warnings 0 && npx vitest run` → **1219/1219**, cobertura ~97% (statements/functions/branches todos > 90%, umbral del proyecto 80%).
- `npx cypress run` (suite completa, 14 specs) → **77/77**.
- `cargo test && cargo clippy -- -D warnings && cargo fmt --check` → limpio (Rust no tocado salvo registro de `tauri-plugin-dialog` en `lib.rs`).
- Verificación manual en dispositivo Android real (`75fe536b`): sincronización con normalización real contra OSRM, exportación con el selector nativo, fallback con `osrm` parado.

## Veredicto

**APPROVED**

Sin hallazgos bloqueantes. El único gap real de cobertura encontrado durante este gate se corrigió en el propio gate, antes de este veredicto. Las dos desviaciones respecto a `design.md` (mecanismo de guardado en Android, timeout del cliente OSRM) están documentadas con su propia ADR y no representan comportamiento sin verificar — al contrario, surgieron precisamente de una verificación en dispositivo real más exhaustiva de lo habitual.
