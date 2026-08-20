# 07 · Firebase y notificaciones push

El único servicio de Firebase usado es **Firebase Cloud Messaging (FCM)** para notificaciones push.
No se usan Firebase Auth, Firestore, Realtime Database ni Analytics.

## Qué se envía y qué NO

- El payload de la notificación es **opaco**: solo `type` (tipo de evento) + IDs mínimos necesarios.
- **Nunca** se envía nombre de ruta, email del emisor ni ningún dato personal en el payload (spec
  `openspec/specs/notificaciones-push/spec.md`).
- El texto mostrado al usuario lo construye el propio dispositivo (`FcmService.kt`), no viaja por FCM.

## Lado backend (Go)

- `internal/notifications/fcm.go` envía contra la **API HTTP v1 de FCM**
  (`POST https://fcm.googleapis.com/v1/projects/{project_id}/messages:send`), **sin SDK de Firebase
  Admin**: un único POST JSON autenticado por token OAuth2.
- Autenticación: `golang.org/x/oauth2/google` a partir del **JSON de la cuenta de servicio** de
  Firebase, con scope único `https://www.googleapis.com/auth/firebase.messaging` (solo enviar, sin
  leer/escribir otros recursos). **Nunca firma de JWT hecha a mano**.
- El `project_id` se obtiene del propio JSON de la cuenta de servicio (sin variable aparte).
- Si FCM responde 404 (token inválido/no registrado), se **borra** el token del store para no
  reintentar en vano.
- `buildNotifier` (en `main.go`): si `FCM_SERVICE_ACCOUNT_JSON` no está configurada o falla el parseo,
  se usa un `NoopNotifier` y las notificaciones quedan **desactivadas** (no bloquea el arranque).
- Tokens de dispositivo persistidos en la tabla `device_tokens` (token único, `platform`, `user_id`),
  registrados vía `POST /api/device-tokens`.
- El primer (y único) tipo de evento implementado es `route_share_invite` (invitación a compartir
  ruta).

## Lado móvil (Android)

- `firebase-bom 34.9.0` + `firebase-messaging`; plugin de Gradle `com.google.gms.google-services`.
- `FcmService.kt` (`FirebaseMessagingService`):
  - `onNewToken`: guarda el token nuevo como **pendiente** en `SharedPreferences` (Kotlin no tiene
    acceso a la sesión del usuario, que vive en SQLite gestionada por JS) — se re-registra en el
    próximo arranque/login.
  - `onMessageReceived`: construye el texto real (genérico) de la notificación.
- `NotificationsPlugin.kt`: expone comandos `getToken`, `getPendingTapScreen`/`clearPendingTapScreen`,
  `getPendingTokenRefresh`/`clearPendingTokenRefresh`.
- `MainActivity.kt`: gestiona el tap con la app cerrada (cold start), guardando la pantalla pendiente
  en `SharedPreferences`.
- Puente Rust (`notifications.rs`) → comandos Tauri (`get_notification_token`, etc.) → wrappers TS
  (`device-token.service.ts`, `notification-tap.service.ts`).

## Flujo end-to-end (compartir ruta)

1. Usuario A comparte una ruta con B → `POST /api/route-shares`.
2. El backend crea la invitación y dispara `notifier.Send(...)` con `type=route_share_invite` + IDs.
3. FCM entrega el push al dispositivo de B.
4. `FcmService.kt` muestra la notificación; al tocarla, `notification-tap.service.ts` traduce el
   evento a una acción (abrir la vista "Invitaciones").

## google-services.json (configuración del proyecto Firebase)

- Fichero **no versionado** (`apps/mobile/src-tauri/gen/android/app/google-services.json`, en
  `.gitignore`). No es un secreto según Google, pero el repo es público y no aporta nada versionarlo.
- Cada desarrollador usa su copia local; **CI lo inyecta desde el secret
  `GOOGLE_SERVICES_JSON_BASE64`** (contenido en base64) antes de compilar el APK.

## Variables de entorno relacionadas

| Variable | Dónde | Obligatoria |
|----------|-------|-------------|
| `FCM_SERVICE_ACCOUNT_JSON` | Backend (`.env` / `.env.prod`) | No (opcional → push desactivado) |
| `GOOGLE_SERVICES_JSON_BASE64` | GitHub Secret (CI) | Sí para build de APK release |
