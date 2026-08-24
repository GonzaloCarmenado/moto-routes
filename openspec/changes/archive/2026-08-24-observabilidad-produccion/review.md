# Revisión independiente — `observabilidad-produccion`

## CRÍTICO (leer primero)

- **Seguridad**: sin secretos reales en el diff (verificado con `git diff` + grep dirigido sobre `apps/api`, `infra/docker/docker-compose.prod.yml`, `infra/docker/.env*.example`, `scripts/collect-sysmetrics.sh` — solo nombres de variable, mensajes de error y valores de prueba etiquetados como tales). `infra/docker/.env` (real, gitignorado) recibió los dos valores nuevos con el mismo patrón `local-dev-*-not-for-prod` ya usado para `AUTH_TOKEN_SECRET`; no está trackeado (`git ls-files` vacío) y nunca llega al commit.
- **Sin criptografía manual de las categorías prohibidas**: no hay hashing de contraseñas, firma/verificación de JWT ni tokens de un solo uso nuevos en este cambio. El único código criptográfico nuevo es la verificación HMAC-SHA256 del webhook de Resend (`internal/email/webhook.go`), con `crypto/hmac`+`crypto/sha256` de la librería estándar — no una implementación propia de la primitiva. Justificado en `design.md` Decisión 4 (mismo criterio que `internal/email/resend.go`, ya existente: "sin SDK, superficie mínima").
- **`ADMIN_STATUS_TOKEN` comparado en tiempo constante** (`crypto/subtle.ConstantTimeCompare`, `internal/adminstatus/handler.go`), no con `==`.
- **No hay endpoint nuevo de autenticación** (login/registro/reset) en este cambio, así que el criterio de rate limiting/no-enumeración de cuentas de `apps/api` no aplica aquí — el único endpoint nuevo protegido por secreto (`/admin/status`) no expone existencia de cuentas, y el webhook (`/api/webhooks/resend`) no es un endpoint de autenticación.
- **Sin cambios en `apps/mobile`** (ni `src/shared/`, ni ningún dominio) — cambio 100% backend (`apps/api`), sin radio de impacto sobre el frontend.
- **Sin dependencias nuevas**: `go.mod`/`go.sum` sin diff. El único paquete "nuevo" usado es `github.com/go-chi/chi/v5/middleware`, subpaquete del módulo `go-chi/chi/v5` ya presente.
- **Regla fundamental (código↔artefactos)**: se detectó una contradicción real entre `design.md` (versión inicial) y la spec ya validada `alertas-fallos-email` sobre qué hacer ante una firma de webhook inválida — corregida durante `apply` alineando `design.md` a la spec (ver hallazgo "desviación" más abajo). Sin desalineación pendiente al cerrar esta revisión.

## Cobertura de Requirements/Scenarios

### `registro-errores-api`

| Requirement / Scenario | Test | Estado |
|---|---|---|
| Captura de eventos — Fallo interno no controlado | `internal/httpmw/recover_test.go::TestRecover_PanicRecordsErrorEvent`, `TestRecover_UnhandledPanicReturns500WithoutInternalDetails` | ✅ |
| Captura de eventos — Respuesta de error del servidor | `internal/httpmw/capture_test.go::TestCaptureErrors_ServerErrorRecordsEvent` | ✅ |
| Captura de eventos — Aviso de funcionalidad degradada | `cmd/api/main_test.go::TestBuildNotifier_WithoutServiceAccountJSON_RecordsWarning` | ✅ |
| Cobertura uniforme — Endpoint nuevo sin manejo propio | `internal/httpmw/coverage_test.go::TestGlobalMiddleware_CoversEndpointsWithNoOwnErrorHandling` | ✅ |
| Cobertura uniforme — Todos los endpoints existentes cubiertos al desplegar | Verificado por **inspección de código**, no por test automatizado: `cmd/api/main.go` registra `router.Use(httpmw.Recover(...))` y `router.Use(httpmw.CaptureErrors(...))` antes de cualquier `router.Get/Post/...`, así que cualquier ruta registrada después queda cubierta por construcción — no es una propiedad testeable en el sentido tradicional (afirma sobre rutas futuras). | ⚠️ Verificación manual, ver "Cobertura" abajo |
| Tamaño máximo — Escritura por debajo del límite | `internal/opslog/logger_test.go::TestLogger_BelowMaxSize_KeepsAllEvents` | ✅ |
| Tamaño máximo — Escritura al alcanzar el límite | `TestLogger_AboveMaxSize_DropsOldestFirst` | ✅ |
| Tamaño máximo — Ráfaga no agota el disco | `TestLogger_BurstOfEvents_FileNeverExceedsMaxSize` | ✅ |
| Consulta — Sin eventos todavía | `internal/adminstatus/handler_test.go::TestHandler_ValidToken_NoEvents_ReturnsEmptyList` | ✅ |
| Consulta — Acceso sin autorización | `TestHandler_MissingToken_Returns401WithoutData`, `TestHandler_WrongToken_Returns401WithoutData` | ✅ |
| Consulta — Eventos tras reinicio | `internal/opslog/logger_test.go::TestLogger_EventsSurviveReopen` | ✅ |
| Consulta — Volumen alto de eventos | `internal/opslog/logger_test.go::TestLogger_RecentRespectsLimit` (mecanismo genérico) | ⚠️ Ver "Cobertura" abajo |

### `metricas-recursos-servidor`

| Requirement / Scenario | Test | Estado |
|---|---|---|
| Memoria — Instantánea disponible | `internal/adminstatus/handler_test.go::TestHandler_MetricsSnapshotAvailable_IncludesMemoryAndDisk`, `internal/sysmetrics/snapshot_test.go::TestReadSnapshot_FilePresent_ReturnsSnapshot` | ✅ |
| Memoria — Instantánea no disponible | `TestHandler_NoMetricsSnapshotYet_OmitsMemoryAndDisk`, `TestReadSnapshot_FileMissing_ReturnsNotAvailable` | ✅ |
| Disco — Instantánea disponible / no disponible | Mismos tests que memoria (fixture combinada) | ✅ |
| Umbral — Disco por encima | `internal/sysmetrics/monitor_test.go::TestMonitor_DiskAboveThreshold_RecordsWarning` (añadido durante esta revisión, ver "Gap cerrado" abajo) | ✅ |
| Umbral — Memoria por encima | `TestMonitor_MemoryAboveThreshold_RecordsWarning` | ✅ |
| Umbral — Recurso por debajo tras haber estado por encima | `TestMonitor_SustainedAboveThreshold_DoesNotRepeatWarning` + `TestMonitor_CrossesAgainAfterRecovering_RecordsWarningAgain` | ✅ |

### `alertas-fallos-email`

| Requirement / Scenario | Test | Estado |
|---|---|---|
| Recepción — Rebote con firma válida | `internal/email/webhook_test.go::TestWebhookHandler_ValidSignature_BouncedEvent_RecordsDeliveryFailure` | ✅ |
| Recepción — Fallo/retraso con firma válida (+ queja) | `TestWebhookHandler_ValidSignature_OtherFailureTypes_RecordDeliveryFailure` (subtests `delivery_delayed`/`failed`/`complained`) | ✅ |
| Recepción — Firma inválida o ausente | `TestWebhookHandler_InvalidSignature_RejectsWithoutRecording`, `TestWebhookHandler_MissingSignatureHeaders_RejectsWithoutRecording` | ✅ |
| Recepción — Evento no relacionado con fallo | `TestWebhookHandler_NonFailureEvent_AcceptedButNotRecorded` | ✅ |
| Consulta — Sin fallos registrados | Cubierto por el mismo mecanismo genérico que `registro-errores-api` (`TestHandler_ValidToken_NoEvents_ReturnsEmptyList`) — un fallo de entrega es un `Event` más en el mismo registro | ✅ |
| Consulta — Fallos visibles junto al resto de eventos | `internal/adminstatus/integration_test.go::TestAdminEndpoint_ShowsHTTPErrorsAndEmailDeliveryFailuresTogether` | ✅ |

**Cobertura**: 20/22 escenarios con test automatizado dedicado, 2 con verificación estructural/por mecanismo genérico (ninguno bloqueante, detallado arriba). 0 escenarios de verificación manual en dispositivo (cambio 100% backend, no aplica).

**Gap cerrado durante esta revisión**: el cruce de umbral de **disco en solitario** solo estaba cubierto combinado con memoria (`TestMonitor_BothResourcesAboveThreshold_RecordsTwoWarnings`), nunca aislado — añadido `TestMonitor_DiskAboveThreshold_RecordsWarning` antes de aprobar.

## Verificación independiente ejecutada

- `go build ./...`, `go vet ./...`: limpios.
- `go test ./...` re-ejecutado de cero (no aceptado el resumen de la sesión de implementación): **280/280** en 23 paquetes, incluidos los 9 nuevos/tocados esta sesión (`opslog` 8, `httpmw` +7 nuevos sobre los 6 ya existentes, `adminstatus` 7, `sysmetrics` 11 tras el fix de cobertura, `email` +5 nuevos, `config` +12 nuevos, `cmd/api` 1 nuevo).
- `gofmt -l` limpio en todo fichero creado esta sesión. Los ficheros preexistentes que aparecen en `gofmt -l` (incluido `cmd/api/main.go`, editado) son CRLF heredado de `core.autocrlf=true` en Git de Windows — confirmado preexistente en ficheros nunca tocados por este cambio (p. ej. `internal/auth/login.go`), ajeno a CI (Linux).
- `openspec validate --all --strict`: 29/29.

## Hallazgos

### Desviación
- **`design.md` contradecía la spec ya validada sobre el rechazo de firma inválida en el webhook** — el borrador inicial de `design.md` (Riesgo, sección 43-48 original) proponía registrar un warning ante una firma inválida; la spec `alertas-fallos-email` (escenario "Firma inválida o ausente") decía explícitamente "sin registrar ningún evento". Detectado durante `apply`, antes de escribir el código — corregido `design.md` para alinearlo a la spec (no se reescribe una spec ya validada sin motivo nuevo), documentando que la mitigación real es operativa (evento de prueba real desde el panel de Resend al configurar el secreto). El código implementado sigue la spec, no la versión descartada de `design.md`.

### Cobertura (no bloqueante)
- "Todos los endpoints existentes quedan cubiertos al desplegar este cambio" se verifica por inspección de `cmd/api/main.go` (orden de `router.Use`), no por un test automatizado — es una propiedad estructural sobre "cualquier ruta futura", difícil de expresar como test sin volverse tautológico. Aceptado como verificación manual explícita, no disfrazado de automatizable.
- "Volumen alto de eventos" (límite de 200 en el endpoint admin) se apoya en el mecanismo genérico de `Logger.Recent(limit)` (sí testeado) sin un test que registre >200 eventos reales contra el handler completo — coste/beneficio bajo (el propio límite es una constante trivial, `defaultEventLimit = 200`, cableada una vez).

### Calidad
- Sin hallazgos. Separación de paquetes por responsabilidad (`opslog` registra, `sysmetrics` lee/vigila, `adminstatus` agrega y sirve, `email` verifica y parsea) sigue el mismo patrón por dominio ya usado en el resto de `apps/api`.

### Gap
- Ninguno — las 3 capabilities nuevas de la spec están completamente implementadas.

## Veredicto

**APPROVED**

Sin hallazgos de seguridad, sin gaps de implementación, un hallazgo de "desviación" ya corregido durante esta misma revisión (spec y `design.md` realineados), y un gap de cobertura cerrado en el momento (test de disco añadido). Los dos escenarios con verificación estructural en vez de test dedicado son aceptables por su naturaleza (propiedad de "todo endpoint futuro" y una constante trivial), no encubren comportamiento sin probar.

**Pendiente de cierre** (no bloqueante para archivar, ver `tasks.md` §7): la configuración manual en el servidor real (cron del script de métricas, endpoint del webhook en el panel de Resend, secretos reales en `.env.prod`) y la verificación end-to-end contra producción — ambas requieren que este cambio esté desplegado, lo que a su vez requiere el PR y el tag de versión posteriores a este archivado.
