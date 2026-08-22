## Context

`apps/mobile/src/shared/models/profile.types.ts::Profile` tiene hoy `name`/`avatarPath` puramente locales (SQLite del dispositivo, tabla de perfil singleton — ver `apps/mobile/src/shared/repositories/sqlite-*profile*`), sin relación con la cuenta del servidor. Desde `nombre-usuario` (2026-08-22), toda cuenta activa tiene un `username` único y obligatorio (`apps/api/internal/auth/user.go`, `apps/mobile/src/auth/auth-api.service.ts`). El backend ya tiene un mecanismo real de almacenamiento cifrado de imágenes para las fotos de ruta (`apps/api/internal/photos`: `BlobStore` contra MinIO, `Encrypt`/`Decrypt` con una clave de `cfg.PhotoEncryptionKey`, límite `MaxPhotoSizeBytes = 15MB`) que este cambio puede reutilizar en vez de construir uno nuevo desde cero.

## Goals / Non-Goals

**Goals:**
- Un único nombre de cuenta (`username`) mostrado en Perfil, sin un segundo campo de nombre local que mantener sincronizado a mano.
- Un avatar por cuenta, cifrado en reposo, disponible en cualquier dispositivo donde se inicie sesión — reutilizando el mecanismo de almacenamiento ya existente para fotos de ruta.

**Non-Goals:**
- Mostrar el avatar de OTRAS cuentas (p. ej. en una futura lista de amigos) — fuera de alcance, este cambio solo cubre la propia cuenta autenticada viendo su propio avatar.
- Migrar automáticamente el nombre/avatar local ya existente a la cuenta — no hay forma de decidir con seguridad qué avatar local (si alguno) es "el correcto" para subir sin que el usuario lo confirme; se pierde, igual que ya se documentó la pérdida de nombres de cuentas preexistentes en `nombre-usuario`.
- Tocar el vehículo (`vehicleType`/`vehicleMake`/`vehicleModel`) — sigue siendo puramente local.

## Decisions

**Decisión 1 — Arquitectura de almacenamiento del avatar: ver [[ADR-055]].** Resumen: reutiliza el `BlobStore` de MinIO y la clave `PhotoEncryptionKey` ya existentes (sin bucket ni secreto nuevos), clave de objeto determinista `avatars/{userID}` (sustituye, no acumula), sin ninguna migración de Postgres (la existencia se determina intentando leer el objeto), `GET /api/auth/me` no cambia, límite de 5MB (frente a los 15MB de una foto de ruta), sin rate limiting dedicado (no es un endpoint de autenticación). Alternativas descartadas y consecuencias completas en la ADR.

**Decisión 2 — Los campos locales `name`/`avatarPath` de `Profile` se dejan de leer/escribir, pero la columna SQLite no se borra.** Mismo patrón aditivo-only ya establecido en el repositorio local del proyecto (`ensurePreviewPolylineColumn`/`ensureColumn` en `sqlite-route.repository.ts`, nunca `DROP COLUMN`) — ver también [[ADR-055]], Consecuencias. `Profile` (el tipo TypeScript) pierde los campos `name`/`avatarPath`; el repositorio deja de seleccionarlos/escribirlos, sin tocar el `CREATE TABLE`.

**Decisión 3 — El avatar descargado se cachea localmente como un fichero más (mismo mecanismo que `photo-storage.service.ts`), sin tabla propia.** Se descarga en `checkUsernameGate()`/tras un login interactivo (mismos puntos de enganche que ya revisa el username) y se cachea en disco con una ruta fija por cuenta; no hace falta ninguna fila en SQLite para esto — solo la ruta del fichero en memoria mientras dura la sesión de la app, igual que ya se resuelve `avatarUrl` en `profile.service.ts::loadProfile` hoy, pero leyendo del avatar de cuenta en vez de `Profile.avatarPath`.

## Risks / Trade-offs

- **[Riesgo] Pérdida del nombre/avatar local de cuentas ya existentes.** Aceptado (ver Non-Goals) — mismo criterio que la pérdida de nombre en `nombre-usuario`. El usuario puede volver a subir su avatar y el nombre pasa a ser directamente su `username` ya fijado, sin acción adicional.
- **[Riesgo] Un usuario sin avatar configurado en ningún dispositivo ve el mismo estado vacío que hoy** ("Motorista sin nombre" pasa a ser directamente el `username`, que nunca es null para una cuenta con sesión activa — así que ese placeholder concreto desaparece; el avatar vacío sigue mostrando el icono placeholder actual).
- **[shared] `src/shared/services/photo-storage.service.ts` se reutiliza (no se modifica su contrato) para cachear el avatar descargado — sin radio de impacto nuevo sobre otros dominios que ya lo consumen (fotos de ruta, fotos de cockpit).**
