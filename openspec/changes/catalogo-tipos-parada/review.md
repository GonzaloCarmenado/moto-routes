# Review: catalogo-tipos-parada

Verificación independiente: código releído completo (Go y TypeScript), suite completa re-ejecutada de cero en este mismo turno (no se acepta el resumen de la implementación como prueba) — `go build`/`go vet`/`go test ./... -v -cover` con Postgres real, `govulncheck`, `tsc`, ESLint, Vitest con cobertura, y la suite Cypress completa (incluida contra `apps/api` real, sin mocks). Tres gaps reales encontrados durante la propia implementación/verificación de este cambio (no en esta revisión), ya corregidos y documentados en `tasks.md`/[[ADR-035]] — resumidos aquí por trazabilidad.

## CRÍTICO — leer primero

- **Seguridad de secretos y hosts**: `git diff master..feature/catalogo-tipos-parada` revisado completo buscando IPs/credenciales — limpio (solo comentarios de documentación mencionando "Tailscale" en abstracto, sin ningún valor real; un email/contraseña de fixture de test `rider@example.com`/`"hash"`, no un secreto). `apps/mobile/.env.local` y `apps/mobile/src-tauri/tauri.conf.prod.local.json` (usados para la verificación en dispositivo real con la IP LAN del desarrollador) confirmados fuera de git (`git ls-files` no los lista) y borrados al terminar la prueba — `index.html`/`tauri.conf.json` revertidos a su CSP versionado (`localhost:8080` únicamente) antes de commitear.
- **Gap real encontrado durante la propia verificación E2E de este cambio (grupo 8), corregido en el momento**: `apps/api` no enviaba cabeceras CORS — el navegador bloqueaba en silencio el `fetch` cross-origin del catálogo desde `apps/mobile`, y `refreshStopTypesCache` (best-effort) lo confundía con un fallo de red normal, sin ningún error visible. Corregido con `internal/httpmw/cors.go::PublicCORS` (`Access-Control-Allow-Origin: *`), aplicado **solo** a la ruta pública `GET /api/stop-types` — no a ningún endpoint autenticado, donde un wildcard nunca debe combinarse con credenciales. Re-verificado en esta revisión: `curl -H "Origin: ..."` → cabecera presente; `TestPublicCORS_SetsWildcardAllowOrigin` en verde.
- **Gap de UX real encontrado en verificación en dispositivo Android real, corregido en el momento**: un botón "Marcar parada" dedicado confundía al usuario (esperaba que fuera el mismo botón que ya pausa la grabación). Consolidado sobre "Pausar" (`handlePauseResume`): pulsar Pausar pausa la grabación **y** abre el modal de tipo; cancelar el modal no revierte la pausa (son independientes); Reanudar nunca reabre el modal. La spec (`cockpit-manual-stops`) exige "un control explícito", sin especificar cuál — el cambio de control no es una desviación de spec, solo de una decisión de implementación tomada y corregida dentro del mismo `apply`.
- **Gap real encontrado al preguntar el usuario si la release de GitHub Actions apuntaría al servidor real, corregido en el momento**: `ci.yml::build-and-release` no tenía ningún mecanismo para ello — habría publicado un APK que solo sabe hablar con `localhost` (inútil en un móvil real), y nadie lo había notado porque hasta este cambio `apps/mobile` nunca llamaba a `apps/api`. Corregido con un nuevo step que exige el secret `MOBILE_PROD_API_BASE_URL` (falla el job explícitamente si falta, en vez de publicar un release roto en silencio), inyecta `VITE_API_BASE_URL` y parchea con `sed` el CSP de `index.html`/`tauri.conf.json` en el runner efímero (nunca escrito de vuelta al repo). Incluye además el hallazgo de que `--config` de Tauri **no** reescribe el CSP del `index.html` empaquetado en Android — el mecanismo que ADR-035 daba por resuelto en el punto 1 no funcionaba para este target; corregido y documentado (ADR-035 puntos 7-8). El step de verificación de la release ("bundles the freshly built frontend") se amplió para comprobar también que el CSP empaquetado contiene el host real — sin verificación de runner real todavía (pendiente de la primera release de prueba con el secret ya configurado por el usuario).
- **Dependencias nuevas**: ninguna en `apps/api` (Go) ni en `apps/mobile` (TS/Rust) — el modal de tipo reutiliza el mismo `fetchJson` genérico ya existente para la API externa de perfil, y el mapa/timeline no añaden ninguna librería de iconos (emoji del propio catálogo, decisión de ADR-035 punto 2).
- **Reglas del proyecto saltadas**: ninguna sin justificar. TDD real en todo el flujo (rojo confirmado antes de cada implementación en Go y TS). `data-cy` presente en todos los elementos interactivos nuevos (`gps-request-btn` ya existente reutilizado, `stop-type-dialog-*`, `route-map-stop-marker`). Tokens de diseño únicamente en el CSS nuevo (`.route-map-marker--stop`, hitbox `--hitbox-min` en la hitarea del mapa).

## Trazabilidad Requirement → Scenario → Test

### `stop-types-catalog` (ADDED)
| Requirement | Scenario | Test | Estado |
|---|---|---|---|
| El catálogo es de lectura pública | Se obtiene sin token | `internal/stoptypes/handler_test.go::TestHandler_ReturnsCatalogWithoutRequiringAuth` + `TestPublicCORS_SetsWildcardAllowOrigin` (CORS real) | ✅ |
| El catálogo es de lectura pública | Cada tipo incluye id, texto e icono | Mismo test (`TestHandler_ReturnsCatalogWithoutRequiringAuth`, verifica `Key`/`Label`/`Icon`) | ✅ |
| El catálogo es de lectura pública | Catálogo vacío no falla | `internal/stoptypes/handler_test.go::TestHandler_EmptyCatalogReturns200WithEmptyList` | ✅ |
| La app cachea el catálogo localmente | Modal usa caché sin conexión | `shared/models/stop-types-cache.repository.spec.ts` (suite de contrato, Memory+Sqlite) + `cockpit-stop-type-dialog.element.spec.ts::mounts the dialog... with one option per category` | ✅ |
| La app cachea el catálogo localmente | Sin caché y sin conexión, el modal lo indica sin bloquear | `cockpit-stop-type-dialog.element.spec.ts::shows an empty-state message and no options when the catalog is empty` | ✅ |
| La app actualiza la caché con conexión | Arranca con conexión, refresca | `stop-types.service.spec.ts::updates the cache when the API request succeeds` + verificación E2E real (`cockpit-mark-stop.cy.ts`, backend real sin mocks) | ✅ |
| La app actualiza la caché con conexión | Refresco falla sin afectar la caché | `stop-types.service.spec.ts::leaves the existing cache untouched when the API request fails` + `...resolves without throwing when there is no cache and the API request fails` | ✅ |

### `cockpit-manual-stops` (ADDED)
| Requirement | Scenario | Test | Estado |
|---|---|---|---|
| Control explícito abre el modal de tipo | Pulsar el control abre el modal | `cockpit.element.spec.ts::pausing opens the stop-type modal with the cached catalog` | ✅ |
| Una parada manual se persiste con el tipo elegido | Elegir un tipo persiste la parada | `cockpit.element.spec.ts::registers the manual stop and shows a confirmation toast...` + `cockpit.service.spec.ts` (round-trip real vía `MemoryRouteRepository.getStopsByRouteId`) + E2E `cockpit-mark-stop.cy.ts` (backend real, timeline tras guardar) | ✅ |
| Una parada manual se persiste con el tipo elegido | Cerrar sin elegir no persiste nada | `cockpit.element.spec.ts::does not register any manual stop when the dialog is cancelled` + E2E `cockpit-mark-stop.cy.ts::cancelling the stop-type dialog still pauses...but persists no stop` | ✅ |
| Las paradas automáticas no generan parada manual | Detección GPS no abre modal ni persiste | `cockpit.service.spec.ts::does not persist any stop when no manual stop was marked (auto-detected stop)` | ✅ |
| (Regresión propia de la consolidación Pausar) | Reanudar nunca reabre el modal | `cockpit.element.spec.ts::resuming does not reopen the stop-type modal` | ✅ |
| (Regresión propia de la consolidación Pausar) | La pausa ocurre siempre, aunque se cancele el modal | `cockpit.element.spec.ts::pauses the recording regardless of what happens with the modal` | ✅ |

### `route-stop-types-display` (ADDED)
| Requirement | Scenario | Test | Estado |
|---|---|---|---|
| El timeline solo muestra paradas con tipo | Parada tipada aparece con icono | `route-timeline.transform.spec.ts::AC-6.1: una parada real con categoría resuelta aparece...` + `route-detail-timeline.spec.ts::AC-6.1/6.3` + E2E `cockpit-mark-stop.cy.ts` (icono real `🏔️` en el timeline tras guardar) | ✅ |
| El timeline solo muestra paradas con tipo | Ruta sin paradas tipadas no muestra delimitador | `route-timeline.transform.spec.ts::AC-6.4` + `route-detail-timeline.spec.ts::AC-6.4` + E2E regresión | ✅ |
| El mapa distingue cada tipo con su icono | Un marcador por parada tipada | `route-map-stops.spec.ts::AC-7.1` + `route-map.element.spec.ts::AC-7.1` (integración con MapLibre mockeado) | ✅ |
| El mapa distingue cada tipo con su icono | Paradas de distinto tipo, iconos distintos | `route-map-stops.spec.ts::AC-7.2` + `route-map.element.spec.ts::AC-7.2` | ✅ |
| El mapa distingue cada tipo con su icono | Ruta sin paradas tipadas sin marcador | `route-map-stops.spec.ts::AC-7.3` (×2, null y categoría no resuelta) + `route-map.element.spec.ts::AC-7.3` | ✅ |

**Cobertura de escenarios: 16/16 con test automatizado, más verificación E2E real (backend Docker real, sin mocks) y verificación manual real en dispositivo Android (Realme, confirmado por el usuario) para el flujo completo grabar→pausar→elegir tipo→guardar→ver en timeline/mapa. 0 escenarios sin evidencia.**

## Verificación independiente ejecutada en esta revisión

- **Go** (`apps/api`): `go build ./...`, `go vet ./...` limpios. `gofmt -l .` solo señala `internal/httpmw/recover.go`/`recover_test.go` — ruido de CRLF preexistente ya documentado (Windows `core.autocrlf`), no de este cambio (los ficheros nuevos de este cambio no aparecen en la lista). `go test ./... -v -cover` con Postgres real (Docker): **todos los paquetes en verde**, incluida integración real contra Postgres (`stoptypes`, `migrate`, `auth`) aislada por schema vía `internal/dbtest`. Cobertura: `httpmw` 100%, `config` 100%, `auth` 82.7%, `secretscan` 88.9%, `migrate` 75.6%, `stoptypes` 68.0%, `ping` 71.4%, `cmd`/`dbtest` 0% (wiring puro/helper de test, sin lógica propia — mismo criterio ya aceptado en la revisión de `migrar-api-golang`). `govulncheck ./...`: 0 vulnerabilidades alcanzables.
- **TypeScript** (`apps/mobile`): `tsc --noEmit` limpio. `eslint src/ --max-warnings 0` limpio. `vitest run --coverage`: **814/814 tests, 266/266 suites**. Cobertura global: statements 96.22%, branches 91.40%, functions 95.40% (umbral del proyecto: 80%).
- **Cypress E2E, suite completa (41/41)**, incluida contra `apps/api` real vía Docker Compose (sin mocks): `cockpit.cy.ts` (8, incluye el toggle Pausar↔Reanudar con el modal de tipo interpuesto), `cockpit-mark-stop.cy.ts` (2, backend real: marcar parada real → verla en timeline con icono; cancelar no persiste), `fotos.cy.ts` (9), `perfil.cy.ts` (9), `route-detail.cy.ts` (6), `timeline.cy.ts` (3), `route-list.cy.ts` (4).
- **Verificación manual en dispositivo Android real** (Realme `75fe536b`): build vía `pnpm tauri android build --target aarch64 --debug` (nunca `cargo build` manual), `unzip -p ... assets/index.html` para confirmar hash de JS y CSP antes de cada instalación (gotcha de frontend desactualizado reproducido 3/3 veces esta sesión, siempre corregido con el fix manual de assets + `gradlew assembleArm64Debug` documentado en `memory/context.md`). Flujo completo grabar→pausar→elegir tipo→guardar→ver en timeline y mapa: **confirmado por el usuario, funciona**.
- `openspec validate catalogo-tipos-parada --strict`: válido, sin avisos.
- `gh secret list`: `MOBILE_PROD_API_BASE_URL` configurado por el usuario tras esta revisión de CI — pendiente de una release de prueba real (tag `v*`) para verificar en un runner de GitHub Actions de verdad, mismo criterio que ya advertía la revisión de `ci-cd-pipeline` sobre los límites de la verificación estructural/local.

## Hallazgos por categoría

- **Gap**: ninguno nuevo encontrado en esta revisión — los tres gaps reales del cambio (CORS, consolidación Pausar, release de CI) ya estaban encontrados, corregidos y documentados por la propia sesión de implementación antes de esta revisión independiente.
- **Desviación**: ninguna respecto a las specs. La consolidación del control de "marcar parada" sobre "Pausar" no desvía de `cockpit-manual-stops` (exige "un control explícito", no uno dedicado) — documentada como decisión, no como incumplimiento.
- **Calidad**: código Go idiomático (`PostgresRepository.List` con manejo de error completo incluido `rows.Err()`); TypeScript sigue los patrones ya establecidos del dominio (`buildStopDelimiters`/`addStopMarkers` mismo criterio de descarte que las paradas sin categoría resuelta, sin duplicar lógica entre timeline y mapa).
- **Cobertura**: `stoptypes` (Go) al 68% es el paquete más bajo del cambio — coherente con `ping` (71.4%, ya aceptado en la revisión anterior): sin un umbral Go decidido en ninguna ADR/spec, informativo, no bloqueante. Cobertura TS global 96%+, muy por encima del umbral del 80%.
- **Convenciones de frontend**: `data-cy` único en todo control nuevo, tokens de diseño sin hardcodear en el CSS nuevo del marcador de mapa, hitbox `--hitbox-min` respetada en la hitarea del mapa (mismo patrón que fotos/cluster).
- **CI/Release**: único punto sin verificación de extremo a extremo en un entorno real (el secret se configuró después de escribir el workflow) — ver CRÍTICO. No bloqueante para este veredicto porque el mecanismo replica exactamente el patrón ya usado y probado por `apps/mobile`/`apps/api` en `migrar-api-golang`/`ci-cd-pipeline` (fallo explícito si falta un secret, en vez de degradar en silencio).

## Veredicto

**APPROVED WITH MINOR ISSUES**

Un solo issue menor, no bloqueante: el nuevo step de CI que inyecta el host real de producción (`MOBILE_PROD_API_BASE_URL`) no se ha ejecutado todavía en un runner real de GitHub Actions — el secret se configuró en esta misma sesión, después de escribir el workflow. Se recomienda una release de prueba (tag `v*`, borrable después, mismo patrón ya usado en `ci-cd-pipeline`) antes de confiar en que la próxima release real funcione a la primera.

Todo lo demás — los tres gaps reales encontrados durante la propia implementación/verificación (CORS, consolidación de UX en Pausar, mecanismo de CI para el host de producción) — se corrigió en el momento, con verificación real (backend Docker real, dispositivo Android real, re-ejecución completa de la suite), antes de este veredicto.
