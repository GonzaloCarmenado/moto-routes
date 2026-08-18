# Revisión independiente — notificaciones-push-fcm

Revisión completa antes de archivar: mapeo Requirement → Scenario → test, relectura de la implementación completa (backend, frontend, Kotlin/Rust nativo), y re-ejecución de la suite completa desde cero (incluido `go test ./...`, que el pre-commit hook no cubre).

## CRÍTICO — leer primero

- **Seguridad**: sin criptografía hecha a mano (`golang.org/x/oauth2/google` para el flujo de cuenta de servicio de Firebase, mismo tier de confianza que `golang.org/x/crypto` ya usado — ver ADR-050 y design.md Decisión 3). Sin secreto real en ningún commit (verificado con `git show` sobre los tres commits de esta rama buscando `BEGIN PRIVATE`/`private_key`/el valor de `FCM_SERVICE_ACCOUNT_JSON` — solo aparece el placeholder vacío en `.env.example`/`.env.prod.example`). `POST /api/device-tokens` no es un endpoint de autenticación (exige `auth.RequireAuth`, no revela existencia de cuentas) — sin rate limiting dedicado, mismo criterio ya aplicado a otros endpoints de datos autenticados (`/api/achievements`, `/api/route-shares/received`). `<service android:name=".FcmService" android:exported="false">` — no invocable por otras apps.
- **Cambios en `src/shared/`**: `device-token.service.ts` y `notification-tap.service.ts` son nuevos (no modifican comportamiento existente). `app.element.ts` (composition root, excluido de cobertura por convención ya establecida) gana wiring nuevo: listener de tap + consulta de pantalla/token pendientes al arrancar — sin tocar el resto de su lógica de inicialización.
- **Dependencias core nuevas**: `golang.org/x/oauth2 v0.36.0` (backend, directa), `@tauri-apps/plugin-notification ^2.3.3` + crate Rust `tauri-plugin-notification = "2"` (frontend/nativo), `com.google.gms.google-services` + `firebase-messaging` (Gradle — primera dependencia nativa Android fuera de Tauri/Google Play Services).
- **Reglas del proyecto saltadas**: ninguna sin justificar. La rama llevaba **cero commits** desde que se abrió (dos sesiones completas de trabajo solo en el árbol de trabajo) — no es una regla de código saltada, pero sí un riesgo de proceso real, ya registrado en `memory/metrics/events.jsonl` (categoría `other`) antes de este cierre, tal como pide la guía de archivado.

## Mapeo Requirement → Scenario → Test

### `notificaciones-push` (4 requirements, 11 scenarios)

1. **Registrar el token de notificaciones al iniciar sesión**
   - Login con éxito solicita el permiso si no concedido → `device-token.service.spec.ts::"sin permiso concedido, lo solicita y registra el token si se concede"` + verificado en dispositivo real (`dumpsys package` `POST_NOTIFICATIONS: granted=false → true` tras login)
   - Permiso concedido registra el token → `device-token.service.spec.ts::"con permiso ya concedido, registra el token sin volver a pedirlo"` + `device_tokens` con fila real confirmada por `psql`
   - Permiso denegado no bloquea el resto de la app → `device-token.service.spec.ts::"si el usuario deniega el permiso, no registra nada ni lanza"`
   - Sin sesión activa, la app no solicita el permiso → garantía estructural (`registerDeviceTokenAfterLogin` tiene un único punto de invocación en todo el frontend, `auth-login-dialog.element.ts` tras un login exitoso — confirmado por grep; no hay ninguna otra vía de ejecución), sin escenario de test dedicado porque no existe código que pudiera violarlo
2. **Enviar push al crear una invitación de ruta compartida**
   - Destinatario con token registrado recibe push → `TestCreateInvitationHandler_EligibleRouteAndVerifiedAccountCreatesInvitation` (backend) + verificación manual real (invitación real vía `POST /api/route-shares`, push recibido en `75fe536b` con la app en los tres estados)
   - Destinatario sin token no rompe la invitación → `TestFCMNotifier_NoTokensIsNotAnError` (a nivel `FCMNotifier`, que es donde vive la lógica real: "sin ningún token registrado no es un error")
   - Fallo en el envío no afecta la invitación ya creada → `TestCreateInvitationHandler_NotifierFailureDoesNotUndoTheInvitation`
3. **El contenido de la notificación no revela datos a Firebase**
   - Payload opaco → `TestCreateInvitationHandler_EligibleRouteAndVerifiedAccountCreatesInvitation` (asserts `sent.Data["route_name"] == "" && sent.Data["from_email"] == ""`) + `TestFCMNotifier_SendsAnOpaquePayloadToEachRegisteredToken`
4. **Tocar la notificación abre la app directamente en Invitaciones**
   - Con la app cerrada del todo → **verificación manual** (marcada así en la propia spec, no automatizable sin Google Play Services): confirmada en dispositivo real tras el fix de `MainActivity.onCreate()` (cold start) — antes de este cierre no funcionaba, dos bugs reales encontrados y corregidos en la propia verificación (ver design.md Decisión 5 y ADR-050)
   - Con la app en segundo plano → **verificación manual**: confirmada vía `onNewIntent()`, ya funcionaba desde la implementación original de este mismo cambio

**Sin gaps bloqueantes.** Los dos huecos reales de esta feature (VIEW_SHARING nunca redisparado en el tap, cold start sin manejar en `onCreate`) se encontraron y cerraron durante la propia verificación de esta sesión, antes de este cierre — ver `tasks.md` 6.4.1/6.4.2 para el detalle completo con las rutas exactas.

## Verificación end-to-end re-ejecutada desde cero

- `go test ./...` (apps/api, ejecutado directamente — el pre-commit hook no lo cubre): **151/151**, 16 paquetes
- `govulncheck ./...` (apps/api): 0 vulnerabilidades que afecten código propio
- `tsc --noEmit`, `eslint src/ --max-warnings 0`: limpios
- `vitest run` (apps/mobile): **1199/1199**
- `cargo fmt --check`, `cargo clippy -- -D warnings`, `cargo test` (apps/mobile/src-tauri): limpios (vía pre-commit, dos veces)
- Cypress completo (`pnpm test:e2e`, backend real en Docker): **75/75**, dos veces (dos commits)
- **Verificación manual en dispositivo Android real** (`75fe536b`), en dos sesiones: permiso del sistema pedido y concedido, token FCM registrado y persistido en `device_tokens`, push real recibido con la app en los tres estados (foreground/background/cerrada) tras enviar una invitación real, tap navegando correctamente a Invitaciones con los datos ya cargados en los tres estados, rotación de token simulada con un `pending_token_refresh` real ya presente en `SharedPreferences` (confirmado re-registrado y limpiado tras reiniciar la app, sin esperar a una rotación real de Firebase).

## Hallazgos

Todos encontrados y cerrados durante esta misma sesión de verificación, antes de este cierre — ninguno queda abierto.

- **gap**: `tauri-plugin-notification` (crate Rust) nunca se había añadido a `Cargo.toml`/`lib.rs`/`capabilities/default.json` — el permiso de notificaciones jamás se pedía, fallando en silencio (best-effort `try/catch`). Cerrado.
- **gap**: `docker-compose.yml` local nunca reenviaba `FCM_SERVICE_ACCOUNT_JSON` al contenedor `api`. Cerrado.
- **desviación**: `app.element.ts` llamaba a `this.onViewSharing()` (método privado) en vez de `dispatchAppEvent(APP_EVENTS.VIEW_SHARING)` para el wiring del tap — el propio código de la tarea 6.4 afirmaba "mismo efecto, menos indirección", afirmación falsa (`route-sharing.element.ts` depende del evento real para refrescar sus datos). Cerrado.
- **gap**: `MainActivity.onCreate()` no manejaba el cold start del tap (solo `onNewIntent()`) — gap del propio `design.md` Decisión 5, que asumía la app ya en marcha. Cerrado con el mismo patrón "pendiente + consulta" ya usado para el token.
- **gap**: `getPendingTokenRefresh`/`clearPendingTokenRefresh` (Kotlin) escritos pero nunca conectados a Rust/JS — Decisión 6 de `design.md` quedaba a medias. Cerrado.
- **other (proceso, no código)**: la rama completa llevaba dos sesiones sin ningún commit. Cerrado con tres commits al final de esta sesión; evento registrado en `memory/metrics/events.jsonl`.

Sin hallazgos de calidad, cobertura ni convenciones de frontend pendientes: estructura por dominio respetada (`shared/services/device-token.service.ts`, `shared/services/notification-tap.service.ts`, `shared/tauri/commands.ts`), cada `.service.ts` nuevo con su `.spec.ts`, sin CSS ni elementos interactivos nuevos que requieran `data-cy`.

## Alineación con decisiones previas

Ninguna decisión de este cambio contradice una ADR existente. Confirma y concreta [[ADR-034]] ("notificaciones en tiempo real tipo SignalR" ya anticipado sin bloquear la vía). Reutiliza patrones ya establecidos: `RecordingServicePlugin.kt`/`RecordingService.kt`/`recording_service.rs` (puente nativo Kotlin↔Rust↔JS), `internal/email` (interfaz + implementación real + fake, sin SDK pesado). La Decisión 1 de `design.md` (FCM como transporte, backend propio como dueño de la lógica) sí alcanza el umbral de ADR — registrada como **ADR-050**, con las consecuencias reales de la verificación (los tres bugs encontrados) incluidas.

## Veredicto

**APPROVED.** Los 4 requirements y sus 11 escenarios de `notificaciones-push` están cubiertos por test real donde es automatizable, y por verificación manual explícita y documentada donde la propia spec ya la marca como tal (recepción de push real, tap en los tres estados de la app — ninguno automatizable sin Google Play Services). La suite completa está en verde de extremo a extremo (Go, Rust, TypeScript, Cypress, dispositivo real) y no quedan huecos de cobertura ni gaps de implementación sin cerrar.
