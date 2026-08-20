# Review — `actualizar-mapa-tras-normalizacion`

## CRÍTICO (leer primero)

- **Sin secretos nuevos ni tocados.** Diff completo revisado (`git diff apps/api apps/mobile/src apps/mobile/cypress memory/context.md`): sin credenciales, tokens ni claves versionadas. El JWT usado durante la verificación manual con `curl` nunca se escribió a ningún fichero del repo, solo se usó en comandos de shell puntuales.
- **CSP sin cambios** — este cambio no toca ninguna llamada de red del frontend a un host nuevo; sigue siendo `apps/api` quien habla con OSRM, server-to-server, igual que antes.
- **`src/shared/` tocado**: `route-cloud-api.service.ts` (`uploadRoute` cambia de `Promise<void>` a `Promise<UploadedRoutePoint[]>`). Radio de impacto acotado y confirmado: un único llamador real en `src/` (`route-detail-cloud.service.ts:54`) — ya actualizado. Los E2E de Cypress hablan con el endpoint HTTP directamente (`cy.request`), no usan esta función TS, así que no les afecta el cambio de firma.
- **Cambio de firma de interfaz Go (`routes.Store.Upsert`)**: de `(ctx, userID, route) error` a `(ctx, userID, route) ([]Point, error)`. Dos implementaciones/dobles fuera de `internal/routes` (no listados en el proposal original, encontrados por el compilador): `routesharing/accept.go:76` (clonado de ruta al aceptar una invitación) y su doble `fakeRouteStore` en `routesharing/handler_test.go`. Ambos actualizados y con su suite en verde.
- **Dependencias**: ninguna nueva, ni en `apps/api` ni en `apps/mobile`.
- **Reglas del proyecto saltadas**: ninguna. JSDoc en todo símbolo exportado nuevo (`UploadedRoutePoint`, `uploadedPointsToLocal`, etc.). Sin CSS inline (cambio sin superficie de estilos). `route-detail.element.ts` se mantuvo bajo el límite de 400 líneas de `eslint.config.js` extrayendo la síntesis de puntos a `route-detail-cloud.transform.ts` (mismo patrón ya usado por `cloudRouteDetailToLocal`).
- **Bug real de producto corregido, fuera del alcance original del proposal** (ver Hallazgos #1): `internal/mapmatch/client.go` trataba la respuesta legítima "sin carretera cerca" de OSRM (`HTTP 400` + `code: NoSegment`/`NoMatch`) como un fallo de infraestructura. No es una regresión de este cambio — es un bug preexistente de `normalizar-y-exportar-rutas` (ya archivado) que este cambio corrige, con permiso explícito del usuario, por bloquear la verificación significativa de la tarea 5.3 de `tasks.md`.

**Veredicto de seguridad: sin hallazgos.**

## Mapeo Requirement → Scenario → Test

### Capability `normalizacion-gps` (delta MODIFIED)

| Requirement | Scenario | Test(s) | Estado |
|---|---|---|---|
| Normalización automática al sincronizar una ruta | Ruta con puntos GPS ruidosos se normaliza al guardarse (la respuesta incluye los puntos ajustados) | `TestPostgresRouteStore_UpsertReturnsPointsWithMatchedFieldsWhenMatcherSucceeds` (`postgres_store_test.go:348`), `TestUpsertHandler_ResponseIncludesMatchedPointsWhenNormalized` (`handler_test.go:114`) | ✅ + verificación manual real (Calle de Chinchilla, Madrid, vía `/nearest` de OSRM) |
| Normalización automática al sincronizar una ruta | Servicio de normalización no disponible (la respuesta devuelve los puntos originales, sin ninguno marcado como ajustado) | `TestPostgresRouteStore_UpsertReturnsRawPointsWhenMatcherFails` (`postgres_store_test.go:373`), `TestPostgresRouteStore_UpsertReturnsRawPointsWhenNoMatcherConfigured` (`postgres_store_test.go:393`), `TestUpsertHandler_ResponseEchoesRawPointsWithoutNormalization` (`handler_test.go:136`) | ✅ |
| Normalización automática al sincronizar una ruta | Punto GPS demasiado alejado de cualquier carretera (se refleja en la respuesta) | `TestClient_Match_DiscardsAdjustmentFartherThan30Meters` (`client_test.go:122`, sin tocar, sigue verde) + los tres puntos ajustados de la verificación manual real confirmando la respuesta completa | ✅ |

### Capability `route-cloud-sync` (delta MODIFIED)

| Requirement | Scenario | Test(s) | Estado |
|---|---|---|---|
| Subir una ruta local a la cuenta del usuario | Subida correcta | `route-cloud-sync.cy.ts` (sin tocar, sigue verde) | ✅ |
| Subir una ruta local a la cuenta del usuario | La subida actualiza el mapa con los puntos devueltos por el servidor | `route-detail.element.spec.ts:900` (el `route-map` recibe los puntos de la respuesta, no los locales), `route-detail-cloud-upload.spec.ts:52` (`onUploaded` se invoca con los puntos), `route-detail-cloud.service.spec.ts:96` (`uploadRouteToCloud` devuelve los puntos de `uploadRoute`), `route-cloud-api.service.spec.ts:58` (`uploadRoute` resuelve `matched_lat`/`matched_lng` preferido sobre el crudo), `route-detail-cloud.transform.spec.ts:54` (síntesis de `id`/`routeId`), `route-cloud-sync.cy.ts:163` (E2E real: sube vía UI puntos desplazados de una calle real y confirma contra el servidor que `matched_lat` llegó poblado — MapLibre pinta en `<canvas>`, sin nada localizable por DOM, mismo criterio que `expectSyncedField` ya usado en este spec para efectos en segundo plano) | ✅ |

**Cobertura de escenarios de este cambio: 5/5 (100%)**, incluyendo el escenario nuevo. Los escenarios de `route-cloud-sync` no listados en la tabla (sin sesión, sin conexión, re-subida, límite de puntos, listado combinado, aislamiento entre cuentas) no cambian con este delta — verificados sin regresión por la suite completa (Go/Vitest/Cypress) en verde.

## Hallazgos

1. **[gap, encontrado y corregido en este gate — bug real preexistente, fuera del proposal original] OSRM 400 tratado como fallo de servicio en `internal/mapmatch/client.go`.** Descubierto por el usuario probando en dispositivo real (tarea 5.3) con una ruta grabada dentro de un edificio, donde legítimamente no hay ninguna carretera cerca. OSRM responde `HTTP 400` + `{"code":"NoSegment"}`/`{"code":"NoMatch"}` para ese caso (verificado reproduciendo la llamada real contra el `osrm` local) — un resultado *válido* de map-matching según design.md de `normalizar-y-exportar-rutas` (Decisión 7), no un error. `matchChunk()` trataba cualquier status HTTP ≠ 200 como fallo de infraestructura antes de mirar el body, así que nunca llegaba al código ya existente que interpreta `code != "Ok"` como "sin coincidencia" — ese código era papel mojado, solo alcanzable si OSRM respondiera 200 con un código de error, cosa que nunca hace. El test que debería haberlo cubierto (`TestClient_Match_NoMatchForWholeChunkLeavesAllPointsUnadjusted`) usaba un doble HTTP con status 200 implícito, sin reproducir el 400 real de OSRM — lección para dobles de servicios HTTP externos: reproducir también el status code real de los casos "válidos pero no exitosos", no solo el body. **Corregido en este mismo gate/cambio** (`client.go`, `matchChunk` decodifica el body antes de decidir según el status; commit propio), con 3 tests nuevos reproduciendo el status real (`client_test.go:177,192,210`) y verificación manual repitiendo tanto el caso corregido (misma ruta del edificio, ya no aparece `map-matching failed` en logs) como el de no-regresión (Calle de Chinchilla sigue ajustando bien). No queda pendiente.
2. **[calidad, menor] Corrección de redacción en `tasks.md` (tarea 5.4), sin impacto en el código.** La tarea original pedía un Cypress E2E "con backend fake", contradiciendo la convención ya establecida de `route-cloud-sync.cy.ts` (ADR-035, backend real vía `docker compose`, nunca mockeado). Corregido durante la propia implementación (no silenciosamente): el test añadido usa el backend real, y `tasks.md` documenta explícitamente por qué se corrigió la redacción.
3. **[calidad, menor] Verificación de dispositivo (5.3) parcial, aceptada así por el usuario.** El único intento de verificación visual en pantalla usó una ruta grabada dentro de un edificio (sin carretera cercana, por diseño no muestra cambio visible) — ese mismo intento fue lo que destapó el hallazgo #1. Sin una segunda ruta en exterior grabada a mano, el usuario aceptó la verificación de backend equivalente (mismos puntos reales, repetida tras el fix) como suficiente en vez de repetir la prueba visual. Documentado explícitamente en `tasks.md`, no es un gap silencioso.

## Verificación independiente ejecutada en este gate

- `go test ./...` (`apps/api`, contra Postgres real) → **239/239**. `gofmt -l`/`go vet` limpios en los paquetes tocados.
- `npx tsc --noEmit && npx eslint src/ --max-warnings 0 && npx vitest run --coverage` → **1224/1224**, cobertura ≥ 80% (umbral del proyecto, `vitest.config.ts`), sin warnings de ESLint (incluido `max-lines`).
- `npx cypress run` (suite completa, 14 specs, backend real) → **78/78**.
- Verificación manual con `curl` contra el backend real (dos escenarios): puntos desplazados de una calle real de Madrid (Calle de Chinchilla) → `matched_lat`/`matched_lng` poblados en la respuesta; puntos dentro de un edificio (sin carretera cercana) → respuesta 200 sin `matched_*`, sin `map-matching failed` en los logs tras el fix del Hallazgo #1.
- Verificación en dispositivo Android real (`75fe536b`): build debug reconstruido (dos vueltas de la CLI, hash `dist/`↔APK reverificado tras copiar `dist/` a mano), instalado, y confirmado servido en el WebView real vía Chrome DevTools Protocol (no solo `unzip`) — mismo protocolo ya documentado en `memory/context.md`.

## Veredicto

**APPROVED**

Sin hallazgos bloqueantes ni de seguridad. El bug real encontrado (Hallazgo #1) se corrigió en el propio gate, con tests que reproducen el comportamiento real de OSRM y verificación manual de ambos escenarios (con y sin corrección). La verificación de dispositivo quedó parcial por decisión explícita del usuario (Hallazgo #3), no por un gap sin cubrir — la evidencia de backend equivalente es sólida y el propio hallazgo del bug real es, si acaso, una señal de que la verificación fue más exhaustiva de lo habitual, no menos.
