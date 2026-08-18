## Context

Precedentes reales ya en el repo, confirmados antes de diseñar (no asumidos):

- **Puente nativo Kotlin↔Rust ya existe y funciona**: `RecordingServicePlugin.kt` (Tauri plugin Android, comandos `start`/`stop`/`pause`/`resume`) + `RecordingService.kt` (`android.app.Service`, notificación con `NotificationCompat.Builder`, `PendingIntent` a `MainActivity`) + `recording_service.rs` (`register_android_plugin`, `tauri::ipc::Channel<serde_json::Value>` para reenviar datos nativo→JS como evento Tauri). Este cambio replica exactamente ese patrón para FCM, no inventa uno nuevo.
- **`POST_NOTIFICATIONS` ya está declarado** en `AndroidManifest.xml` (añadido para la notificación persistente de grabación) — no hace falta tocar el manifiesto para el permiso en sí, solo añadir el `<service>` de FCM.
- **Patrón de envío externo con interfaz + fake**: `internal/email` (Resend) — `ResendSender` usa `net/http` puro sin SDK ("la superficie usada es un único POST JSON con un header"), `FakeSender` para tests de comportamiento sin red real. `internal/notifications` sigue el mismo molde.
- **Hook point real confirmado**: `routesharing.tryCreateInvitation()` (`handler.go:61`) ya resuelve `toUser.ID` antes de `shareStore.Create(...)` — el punto exacto donde enganchar el envío, sin tener que resolver el destinatario de nuevo.
- **`@tauri-apps/plugin-notification` (oficial) no puede recibir push remoto** — confirmado por investigación (búsqueda web, sesión de exploración previa): solo notificaciones locales. Sí expone `isPermissionGranted()`/`requestPermission()`, que son la misma API de sistema (`POST_NOTIFICATIONS`) independientemente de si la notificación la origina el propio JS o el código nativo de FCM — reutilizable solo para eso, no para enviar ni recibir.

Ver `proposal.md` para el porqué (FCM como único mecanismo de despertar real en Android, evaluado frente a UnifiedPush y foreground service propio) y el alcance genérico decidido con el usuario.

## Goals / Non-Goals

**Goals:**

- Que una invitación de ruta compartida llegue como notificación del sistema con la app en cualquier estado (foreground, background, cerrada), sin depender de que el usuario abra la app.
- Mecanismo de registro de token y envío genérico por tipo de evento (`route_share_invite` es el primero, no el único futuro) — sin sobre-diseñar un sistema de plantillas o colas que no tiene todavía un segundo caso de uso real.
- Que el payload que ve Firebase sea opaco (un tipo + IDs, nunca el nombre de la ruta ni el email del emisor en texto plano) — "data message", no "notification message".
- Tocar la app lo mínimo posible si Firebase falla o el usuario no da permiso: todo lo que ya funciona (badge in-app) sigue funcionando exactamente igual.

**Non-Goals:**

- iOS — fuera de alcance, mismo criterio que [[ADR-018]] ("Target Android como prioridad"); el código Kotlin/Gradle de este cambio es Android-only por construcción.
- Cola de reintentos o backoff para envíos fallidos — decidido con el usuario: best-effort, sin infraestructura nueva para un volumen todavía bajo.
- Historial de notificaciones enviadas/recibidas, centro de notificaciones in-app — no pedido, no hay caso de uso todavía.
- Cualquier tipo de evento más allá de `route_share_invite` — el mecanismo queda genérico, pero no se inventan tipos sin un caso de uso real detrás.
- Silenciar/configurar notificaciones por tipo desde ajustes de la app — no pedido, candidato a spec futura si hace falta cuando existan más tipos.

## Decisions

### 1. FCM como transporte, backend propio como dueño de la lógica — merece ADR

Firebase Cloud Messaging es el único mecanismo real de Android para despertar una app en segundo plano/cerrada — no hay alternativa de sistema operativo. El backend Go/Postgres sigue decidiendo quién, cuándo y con qué contenido se notifica (igual que hoy con todo lo demás); Firebase solo transporta un "data message" opaco (`{"type": "route_share_invite", "invitation_id": "..."}`), nunca el nombre de la ruta ni el email en texto plano — el propio `FcmService.kt` construye el texto real de la notificación, sin que Firebase lo vea ni lo guarde.

**Alternativas descartadas** (detalle completo con las tres investigadas en `memory/context.md`, sesión de exploración):
1. **UnifiedPush** — sin dependencia de Google, pero exige que el usuario instale una app "distribuidora" aparte (`ntfy` u otra) — fricción real sin beneficio para el perfil de esta app (uso personal/entre conocidos, no comunidad privacy-focused).
2. **Foreground service propio sin FCM** — ya existe uno para GPS (`RecordingService.kt`), pero solo sobrevive porque `location` es una categoría protegida por Android; un servicio "siempre vivo para notificaciones" no lo es y Doze lo mataría en minutos, exactamente el problema que se quiere resolver.
3. **WebSocket/polling propio (tipo SignalR)** — funciona solo con la app en foreground; en background/cerrada tiene el mismo problema que la opción 2, la conexión muere con el proceso. No es un sustituto de FCM, es una capa distinta (y ya descartada para este caso porque el objetivo explícito es funcionar con la app cerrada).

### 2. Capa genérica de tipo de evento, no acoplada a compartir-rutas

Decidido con el usuario. `device_tokens` (tabla) y el endpoint de registro ya son genéricos por naturaleza (un token no sabe de qué evento se trata). Lo que se generaliza además: `Notifier.Send(ctx, userID, eventType string, data map[string]string)` en el backend, y en Kotlin un `when (data["type"])` en `FcmService.onMessageReceived` que hoy solo tiene un caso (`route_share_invite`) pero no exige rediseño para añadir el segundo. **No** se construye todavía: plantillas de contenido configurables, cola de tipos, ni tabla de preferencias por tipo — eso espera a un segundo caso de uso real (ver Non-Goals).

**Alternativa descartada**: acoplar el envío directamente dentro de `routesharing` (un `SendShareNotification` específico) — descartada por decisión explícita del usuario de dejar la capa reutilizable, pese a ser más simple para este único caso.

### 3. `golang.org/x/oauth2` para el flujo de cuenta de servicio, no un SDK de Firebase completo

FCM HTTP v1 exige un token de acceso OAuth2 derivado de una cuenta de servicio (JSON con clave privada RSA) — a diferencia de Resend (API key estática simple), esto implica firmar un JWT. La norma de seguridad del proyecto prohíbe criptografía/parseo de tokens hecho a mano; `golang.org/x/oauth2/google` (mismo tier de confianza que `golang.org/x/crypto`, ya usado para bcrypt) resuelve exactamente ese flujo sin traer el SDK completo de Firebase Admin (mucha más superficie de la necesaria — solo se necesita enviar mensajes, no gestionar usuarios/Firestore/etc. de Firebase).

**Alternativas descartadas**: (1) SDK oficial `firebase.google.com/go` — descartado, dependencia mucho más pesada que la superficie real usada (un POST autenticado); mismo criterio que ya se aplicó a Resend. (2) Implementar la firma JWT a mano con `crypto/rsa` de la stdlib — descartado, prohibido explícitamente por la norma de seguridad del proyecto (nunca criptografía de tokens hecha a mano).

### 4. `FCM_SERVICE_ACCOUNT_JSON` es una variable de entorno opcional, no obligatoria al arrancar

A diferencia de `RESEND_API_KEY` (`config.Load()` falla si falta, porque el email es parte del flujo obligatorio de verificación de cuenta), las notificaciones push son un extra sobre el badge in-app, que sigue siendo la fuente de verdad. Si `FCM_SERVICE_ACCOUNT_JSON` no está configurada, `internal/notifications` lo trata como "no disponible" (log una vez al arrancar, `Notifier` no-op) — el resto de la app, incluida la propia creación de invitaciones, sigue funcionando exactamente igual.

**Alternativa descartada**: obligatoria como `RESEND_API_KEY` — descartada, el registro de usuarios seguiría siendo posible sin verificación de email si Resend cae (por eso es obligatoria); una invitación de ruta compartida sigue teniendo sentido y valor sin push (el badge ya la muestra), así que forzar el arranque a fallar sería más estricto de lo que el propio caso de uso justifica.

### 5. Tap en la notificación: `MainActivity.onNewIntent()` + evento Tauri, mismo canal que el tap de la notificación de grabación

`RecordingService.kt` ya usa un `PendingIntent` con `Intent.FLAG_ACTIVITY_SINGLE_TOP or FLAG_ACTIVITY_CLEAR_TOP` hacia `MainActivity` — la notificación de FCM añade un extra (`"open_screen" to "sharing"`) al `Intent` de su propio `PendingIntent`. `MainActivity` (que hoy no sobreescribe `onNewIntent`, solo `onCreate`) gana ese método: si el extra está presente, emite un evento Tauri (mismo patrón `tauri::ipc::Channel` que ya reenvía la ubicación GPS) que el JS traduce a `dispatchAppEvent(APP_EVENTS.VIEW_SHARING)` — reutiliza el evento ya existente, sin inventar uno nuevo.

### 6. Registro de token: al iniciar sesión, no al abrir la app

Decidido con el usuario (permiso perezoso). El flujo real: tras un login con éxito, la app (a) comprueba `isPermissionGranted()` del plugin oficial, (b) si no, llama a `requestPermission()`, (c) si se concede (o ya estaba concedido), pide el token FCM actual vía el comando Tauri nuevo y lo registra contra `POST /api/device-tokens`. Si el usuario deniega el permiso, no se reintenta en cada apertura de la app — se puede volver a pedir en un futuro punto de re-engagement (fuera de alcance de este cambio, no hay uno definido todavía).

**Actualización de token** (`onNewToken` de `FirebaseMessagingService`, Firebase puede rotar el token): se guarda en `SharedPreferences` nativas como "pendiente de registrar" — Kotlin no tiene acceso a la sesión (vive en SQLite, gestionada por JS), así que no llama directamente al backend. El siguiente arranque de la app con sesión activa lee ese valor pendiente (comando Tauri) y lo registra igual que un login normal.

Sin ADR adicional para las Decisiones 2-6: ninguna alcanza el umbral de `rules.design` por separado (implementación de un patrón ya elegido en la Decisión 1) — la única decisión que sí lo alcanza es la 1, registrada arriba.

## Risks / Trade-offs

- **Primera dependencia nativa Android fuera de Tauri/Google Play Services** (`com.google.gms.google-services` + `firebase-messaging`) → aumenta la superficie de build de Gradle; mitigado por ser exactamente el mismo ecosistema que ya usa `RecordingService.kt` (Google Play Services), no uno nuevo sin relación.
- **`google-services.json` NO versionado — decisión revisada durante `/opsx:apply`**: el draft original de este documento proponía versionarlo (no es un secreto según Google, es análogo a una clave pública). Al llegar el fichero real durante la implementación, el usuario pidió explícitamente no exponer nada evitable en un repo público; se optó por el criterio más conservador pese a no ser estrictamente necesario: `.gitignore` + inyección en CI desde el secret `GOOGLE_SERVICES_JSON_BASE64` (mismo patrón que `MOBILE_PROD_API_BASE_URL` en `.github/workflows/ci.yml`), y cada desarrollador coloca su propia copia local. Coste real: un paso manual más al clonar el repo para compilar Android — aceptado a cambio de superficie pública mínima.
- **`FCM_SERVICE_ACCOUNT_JSON` es un secreto de alto privilegio** (permite enviar push a cualquier dispositivo registrado en el proyecto Firebase) → mismo nivel de cuidado que `AUTH_TOKEN_SECRET`: solo en `.env*.prod` no versionado / GitHub Secrets, nunca en código ni en un artefacto de este cambio.
- **Sin forma de probar la entrega real de push en CI** (Cypress no puede recibir un push real, Electron headless no tiene Google Play Services) → la verificación de extremo a extremo es necesariamente manual en el dispositivo real (`75fe536b`), igual que ya lo es hoy la grabación GPS en segundo plano. Los tests automatizados cubren: el endpoint de registro de token, el `Notifier` (con `FakeNotifier`), y el hook en `tryCreateInvitation` — no la entrega física del push.
- **Toca `src/shared/`**: nuevo servicio de registro de token, consumido desde el flujo de login existente — radio de impacto acotado a esa integración puntual (no se modifica ningún componente compartido ya existente, solo se añade uno nuevo que otros no consumen todavía).

## Migration Plan

1. **Paso manual del usuario, no delegable**: crear proyecto Firebase (gratis, cuenta Google normal), registrar la app Android (`com.motoroutes.app`), descargar `google-services.json`, generar una clave de cuenta de servicio (JSON) para el envío desde el backend.
2. Migración de esquema: tabla `device_tokens` nueva, sin tocar tablas existentes.
3. `FCM_SERVICE_ACCOUNT_JSON` añadida a `infra/docker/.env.prod` (servidor real) y a los secrets de despliegue — opcional al arrancar (Decisión 4), así que el despliegue no se bloquea si todavía no está configurada.
4. Sin migración de datos existente — mecanismo aditivo puro.
5. Reversión: `git revert`; sin estado persistido fuera de la tabla nueva (se puede dejar vacía/sin usar sin romper nada).

