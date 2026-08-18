## Why

`compartir-rutas` ya avisa dentro de la app (`contador-invitaciones-pendientes`, badge numérico), pero solo si el usuario abre la app y navega al listado — nada llega mientras está en segundo plano o cerrada. Android solo tiene un mecanismo de sistema real para eso: Firebase Cloud Messaging (FCM), investigado a fondo antes de proponer (ver `memory/context.md`, sesión de exploración): un foreground service propio no sobrevive a Doze salvo en categorías protegidas (localización, ya usada por `RecordingService.kt`), y la alternativa sin Google (UnifiedPush) exige que el usuario instale una app "distribuidora" aparte — descartada para el perfil real de esta app. FCM es gratis, sin límite de mensajes, y no exige cuenta de Google Play Developer (esa solo hace falta para publicar en Play Store, que este proyecto no usa).

Esto ya estaba anticipado: [[ADR-034]] eligió Go en parte pensando en "notificaciones en tiempo real tipo SignalR" sin bloquear esa vía — este cambio la concreta, con FCM como transporte (no SignalR ni WebSocket propio, inviable en background/cerrado sin el despertar de sistema que solo da FCM) y el backend propio como dueño de toda la lógica.

Decisión de alcance con el usuario: capa **genérica** de notificaciones desde ahora (tabla de tokens de dispositivo + tipo de evento), no acoplada solo a `compartir-rutas` — el primer y único tipo de evento implementado aquí es `route_share_invite`, pero el mecanismo de registro de token y envío queda listo para futuros tipos sin rediseñarlo.

## What Changes

- Nueva capability `notificaciones-push`: registro del token de dispositivo (FCM), permiso de notificaciones de Android pedido de forma perezosa (al iniciar sesión, no al abrir la app por primera vez), envío best-effort desde el backend al crear una invitación de ruta, y tap en la notificación que abre la app directamente en "Invitaciones".
- Plugin Android nativo nuevo (`NotificationsPlugin.kt` + `FcmService.kt`), mismo patrón que `RecordingServicePlugin.kt`/`RecordingService.kt` ya existentes — un canal Tauri (`tauri::ipc::Channel`) para el tap de la notificación, un comando Tauri para obtener el token actual.
- Backend: paquete nuevo `internal/notifications` (interfaz `Notifier` + implementación FCM vía HTTP v1, sin SDK — mismo criterio que `internal/email` con Resend), tabla `device_tokens`, endpoint `POST /api/device-tokens`, envío disparado desde `routesharing.tryCreateInvitation` tras crear la invitación con éxito.
- **BREAKING**: ninguno — funcionalidad puramente aditiva; sin token registrado o sin permiso concedido, todo sigue funcionando exactamente igual que hoy (el badge in-app sigue siendo la fuente de verdad).

## Capabilities

### New Capabilities
- `notificaciones-push`: registro de dispositivo, permiso de notificaciones, envío push best-effort al crear una invitación de ruta compartida, y navegación directa a "Invitaciones" al tocar la notificación.

### Modified Capabilities
(ninguna — `compartir-rutas` no cambia su contrato observable: la notificación es un efecto adicional de un evento que ya dispara ese mismo cambio de estado, no un requisito nuevo de esa capability)

## Impact

- `apps/mobile/src-tauri/gen/android/app/src/main/java/com/motoroutes/app/` — `NotificationsPlugin.kt` (comando Tauri) + `FcmService.kt` (extiende `FirebaseMessagingService`) nuevos; `MainActivity.kt` gana `onNewIntent()` para el tap; `AndroidManifest.xml` registra el nuevo `<service>` (el permiso `POST_NOTIFICATIONS` ya está declarado, añadido junto al foreground service de grabación).
- `apps/mobile/src-tauri/gen/android/app/build.gradle.kts` — plugin de Gradle `com.google.gms.google-services` + dependencia `firebase-messaging`, primera dependencia nativa Android del proyecto fuera de Tauri/AndroidX/Google Play Services (que ya se usan para el GPS).
- `apps/mobile/src-tauri/gen/android/app/google-services.json` — nuevo, no sensible (identifica el proyecto Firebase, mismo criterio que una clave pública), se versiona.
- `apps/mobile/src-tauri/src/notifications.rs` — plugin Tauri nuevo, mismo patrón que `recording_service.rs`.
- `apps/mobile/src/shared/` — servicio nuevo de registro de token (llamado al iniciar sesión) + wiring del evento de tap a `dispatchAppEvent(APP_EVENTS.VIEW_SHARING)`. Reutiliza `@tauri-apps/plugin-notification` (oficial) solo para `isPermissionGranted()`/`requestPermission()` — no para enviar nada, confirmado que ese plugin no puede recibir push remoto.
- `apps/api/internal/notifications/` — paquete nuevo (interfaz `Notifier`, `FCMNotifier`, `FakeNotifier` para tests — mismo patrón que `internal/email`).
- `apps/api/internal/routesharing/handler.go` — `tryCreateInvitation` dispara el envío tras `shareStore.Create` con éxito.
- `apps/api/internal/migrate/migrations/` — migración nueva, tabla `device_tokens`.
- `apps/api/go.mod` — dependencia nueva `golang.org/x/oauth2` (mismo tier de confianza que `golang.org/x/crypto`, ya usado; necesaria para el flujo de cuenta de servicio de Google sin implementar a mano la firma JWT del token de acceso — prohibido por la norma de seguridad del proyecto).
- Secreto nuevo: `FCM_SERVICE_ACCOUNT_JSON` (contenido del JSON de cuenta de servicio de Firebase) en `infra/docker/.env*.prod` / GitHub Secrets — nunca en código. **Requiere que el usuario cree el proyecto Firebase** (cuenta Google gratuita, sin coste, sin cuenta de Play Developer) y genere esa credencial — no delegable a un agente.
