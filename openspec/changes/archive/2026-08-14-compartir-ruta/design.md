## Context

Ver `proposal.md` (Why) para la motivación. Contexto técnico ya investigado durante `propose`:

- `routes.Store` (`apps/api/internal/routes/routes.go`) ya expone `GetByIDForUser` (ruta completa: metadatos + puntos + paradas, acotada al propietario) y `Upsert` (inserta o actualiza por ID) — el clonado puede apoyarse en ambos sin tocar su contrato.
- `photos.PhotoStore`/`photos.BlobStore` (`apps/api/internal/photos/`) separan metadatos (Postgres) de bytes cifrados (blob store) por `ObjectKey`. La clave de cifrado AES-256-GCM (`photos/encryption.go`) es **única para toda la instalación**, no por usuario — copiar el ciphertext de un `ObjectKey` a otro nuevo es válido sin descifrar/recifrar.
- `auth.UserStore.FindUserByEmail` (`apps/api/internal/auth/user.go`) ya resuelve un email a una cuenta, con `ErrUserNotFound` como único error de "no existe".
- El patrón anti-enumeración ya existe y es reutilizable tal cual: `RequestPasswordResetHandler` (`apps/api/internal/auth/request_password_reset.go`) siempre responde 200 con un mensaje genérico, y solo actúa internamente si `FindUserByEmail` resuelve la cuenta — mismo criterio que exige el contexto de seguridad del proyecto para "invitar por email".
- `auth.LoginRateLimiter` (`apps/api/internal/auth/ratelimit.go`) es un limitador genérico en memoria, keyed por string, ya usado para reset de contraseña además de login — reutilizable tal cual para limitar invitaciones repetidas.
- El frontend no necesita ningún mecanismo de sincronización nuevo para que el destinatario vea la ruta clonada: `route-cloud-sync` ya soporta el caso "ruta exclusiva de la nube" (nunca guardada localmente, listada y con detalle descargable bajo demanda) — la ruta clonada aparece ahí sin cambios en ese mecanismo.
- La navegación actual solo tiene dos pestañas, Rutas y Perfil (ADR-046) — no se añade una tercera; la entrada a "Invitaciones" vive como icono en la cabecera de `route-list`, mismo patrón que el filtro "Solo favoritas" (`favoritos-rutas`).

## Goals / Non-Goals

**Goals:**
- Reutilizar el mecanismo anti-enumeración, el rate limiter y el patrón de acceso a rutas/fotos ya existentes, sin duplicar ninguno.
- El clonado es una copia congelada e independiente en el momento de aceptar — sin sincronización posterior con el original.

**Non-Goals:**
- Ninguna notificación por email ni push cuando llega una invitación — el destinatario la ve la próxima vez que abra la pantalla de invitaciones dentro de la app (v1). Server-side no hay integración de email nueva.
- Ninguna expiración automática de una invitación pendiente — solo se cierra por acción explícita (aceptar/rechazar/revocar).
- Compartir con varios destinatarios en una sola acción — una invitación es a una única cuenta; para varios destinatarios se repite la acción.
- Reenviar/editar una invitación ya enviada — solo revocar y, si se quiere, volver a compartir.

## Decisions

### D1: Tabla nueva `route_shares`, sin tocar el esquema de `routes`
Migración `0008_create_route_shares.sql`: `id UUID PRIMARY KEY`, `route_id` (FK a la ruta origen), `from_user_id`, `to_user_id BIGINT NOT NULL REFERENCES users(id)` (se resuelve el email a un id **en el momento de crear la invitación**, nunca se guarda el email en la tabla — al listar invitaciones enviadas se hace `JOIN users` para mostrar el email actual de la cuenta destinataria), `status TEXT NOT NULL DEFAULT 'pending'` (`pending`/`accepted`/`declined`/`revoked`), `created_at`, `updated_at`. Sin tabla de auditoría aparte — el propio estado y sus timestamps son suficientes para este alcance.

### D2: Crear invitación — reutiliza el patrón anti-enumeración de `request_password_reset.go` tal cual
El handler responde siempre el mismo mensaje genérico (`"si la cuenta existe, se ha enviado la invitación"` o similar), independientemente de si el email resuelve a una cuenta. Solo si `FindUserByEmail` la resuelve **y** la ruta pertenece al emisor **y** está sincronizada **y** el email no es el del propio emisor, se inserta la fila `pending`. Mismo criterio que password-reset: cualquier fallo interno (ruta no encontrada, no sincronizada, email propio) resulta en la misma respuesta genérica — nunca se distingue en el cuerpo de la respuesta, solo en si la fila llega a crearse.
**Excepción explícita**: el caso "email propio" sí se comunica al usuario en la UI *antes* de enviar la petición (validación de cliente, comparando contra el email de la sesión activa) — no es una fuga de información porque el usuario ya conoce su propio email; evita una vuelta de red innecesaria para un error 100% predecible en cliente.

### D3: Rate limiting — nueva instancia de `auth.LoginRateLimiter`
Misma clase ya existente, una instancia nueva dedicada a invitaciones (keyed por email destino), inyectada igual que `RateLimitedRequestPasswordResetHandler` ya hace. Sin límite nuevo por diseñar: mismos valores por defecto que el limitador de reset de contraseña, ajustables si en producción se ven insuficientes.

### D4: Clonado — nuevo paquete `internal/routesharing`, ejecutado síncronamente al aceptar
Al aceptar: (1) `routes.Store.GetByIDForUser` trae la ruta completa del emisor; (2) se genera un `route_id` nuevo (UUID) y se inserta como ruta nueva del destinatario reutilizando el mismo `Upsert` ya existente (mismo statement que usa la subida normal desde el cliente, sin querying SQL nuevo); (3) `photos.PhotoStore.ListByRoute` trae los metadatos de fotos del origen; para cada una, `BlobStore.Get(oldObjectKey)` + `BlobStore.Put(newObjectKey, mismosBytes)` (sin descifrar, ver Context) + `PhotoStore.Create` con el `route_id` nuevo. Todo dentro de la misma petición HTTP de "aceptar" — ver Riesgos para el límite de tamaño de este trabajo.
**Alternativa descartada**: clonar de forma asíncrona (cola/job) — se descarta por ahora porque `MaxPhotosPerRoute` (100) y `MaxPhotoSizeBytes` (15MB) ya acotan el peor caso a un trabajo razonable dentro de una petición HTTP; revisar si en el futuro el límite cambia.

### D5: `isFavorite` no se hereda; el resto de metadatos sí
La copia nace con `is_favorite = false` en la cuenta del destinatario (es un marcado personal, no parte del contenido de la ruta) — el resto de campos (nombre, notas, duración, distancia, velocidad media, estado) se copian tal cual, igual que el resto del contenido.

### D6: Autorización de aceptar/rechazar/revocar — mismo criterio "no encontrado" que rutas/fotos
Aceptar/rechazar exige que la invitación exista, esté `pending` y su `to_user_id` sea el usuario autenticado; revocar exige lo mismo con `from_user_id`. Cualquier otro caso (no existe, pertenece a otra cuenta, ya no está pendiente) devuelve el mismo error genérico — mismo patrón ya usado en `routes`/`photos` (`ErrRouteOwnedByAnotherUser`), nunca se distingue "no existe" de "pertenece a otro".

### D7: Frontend — dominio nuevo `src/routes/sharing/`
Nueva pantalla con dos pestañas internas ("Recibidas"/"Enviadas"), alcanzable desde un icono nuevo en la cabecera de `route-list` (mismo nivel que el filtro de favoritas). Acción "Compartir" nueva en `route-detail` (visible solo si `_isSynced`, mismo gating que el icono de subida), reutiliza el patrón de diálogo ya existente (`shared/feedback/confirm-dialog` o un diálogo dedicado, a decidir en `apply` si el existente no encaja) para pedir el email del destinatario.

## Risks / Trade-offs

- [Riesgo] Clonar fotos síncronamente dentro de la petición de "aceptar" podría ser lento en el peor caso (100 fotos × 15MB) → Mitigación: límites ya existentes acotan el trabajo; sin cambios de límite en este cambio. Si se demuestra insuficiente en producción, mover a un job asíncrono es un cambio futuro aislado (no rompe el contrato observable: aceptar seguiría siendo una acción única desde la UI).
- [Riesgo] Revelar la existencia de una invitación ajena a través de aceptar/rechazar/revocar → Mitigación: D6, mismo resultado "no encontrado" en todos los casos.
- [Riesgo] Nueva tabla con dos FKs a `users` (`from_user_id`/`to_user_id`) — ninguna cascada de borrado especial definida → Mitigación: fuera de alcance de este cambio (no existe hoy borrado de cuenta en la app); documentado aquí para cuando se aborde esa feature.
- [Riesgo] `src/routes/sharing/` es un dominio nuevo pero no toca `src/shared/` salvo un servicio HTTP nuevo → Sin radio de impacto sobre otros dominios existentes.

## Migration Plan

Migración aditiva `0008_create_route_shares.sql` — tabla nueva, no toca ninguna existente. Sin rollback especial: revertir el PR basta.
