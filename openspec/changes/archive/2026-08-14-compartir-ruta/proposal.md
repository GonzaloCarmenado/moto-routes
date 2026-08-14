## Why

Ahora mismo cada cuenta solo ve sus propias rutas (locales o subidas a la nube) — no existe ninguna forma de que un usuario le pase una ruta grabada a otro usuario de la app (p. ej. un compañero de viaje que no la grabó él mismo). La única alternativa hoy sería exportar/reenviar datos a mano, fuera de la app. Se aborda como spec separada de `favoritos-rutas` (decidido con el usuario en esa sesión): compartir = invitación directa entre cuentas registradas, con clonado completo al aceptar — nunca un enlace público ni acceso compartido en vivo a la misma ruta.

## What Changes

- Nueva capability `compartir-rutas`: un usuario con sesión activa invita a otra cuenta registrada (identificada por email) a recibir una copia de una ruta suya ya sincronizada con la nube. El destinatario ve sus invitaciones pendientes y puede aceptarlas (clona la ruta completa — metadatos, puntos, paradas y fotos — como una ruta nueva e independiente en su propia cuenta, sin vínculo posterior con el original) o rechazarlas. El emisor ve el estado de las invitaciones que ha enviado (pendiente/aceptada/rechazada/revocada) y puede revocar una que siga pendiente.
- Solo se puede compartir una ruta que ya esté sincronizada con la cuenta del emisor (el clonado ocurre enteramente en el servidor) — una ruta puramente local no muestra la acción de compartir, mismo criterio que "Subir a la nube".
- La invitación nunca revela si el email introducido corresponde a una cuenta registrada (mismo criterio anti-enumeración ya establecido en `password-reset`): la respuesta de "invitar" es siempre genérica, y solo se crea una invitación real si el email coincide con una cuenta verificada.
- Backend: tabla nueva de invitaciones, endpoints para crear/listar/aceptar/rechazar/revocar, y la lógica de clonado (ruta + puntos + paradas + fotos, incluyendo copia de los blobs cifrados con la clave de cifrado ya existente — sin cifrado nuevo).
- Frontend: nueva pantalla de invitaciones (enviadas y recibidas) y una acción "Compartir" en el detalle de una ruta sincronizada.

## Capabilities

### New Capabilities
- `compartir-rutas`: invitar a otra cuenta a recibir una copia de una ruta propia ya sincronizada, gestión del ciclo de vida de la invitación (pendiente/aceptada/rechazada/revocada) y clonado completo (metadatos, puntos, paradas, fotos) al aceptar.

### Modified Capabilities
(ninguna — la ruta clonada aparece en el listado del destinatario a través del mecanismo ya existente de `route-cloud-sync` para "ruta exclusiva de la nube", sin cambiar ningún requirement de esa capability)

## Impact

- **Backend** (`apps/api`): paquete nuevo `internal/routesharing` (o similar) con el `Store` de invitaciones; migración nueva en `internal/migrate/migrations/`; reutiliza `auth.UserStore.FindUserByEmail` (`apps/api/internal/auth/user.go`) y el patrón de respuesta genérica + rate limiting por email ya establecido en `apps/api/internal/auth/request_password_reset.go`; reutiliza `photos.BlobStore`/`photos.PhotoStore` y la clave de cifrado única ya existente (`apps/api/internal/photos/encryption.go`) para clonar blobs sin descifrar/recifrar (la clave es la misma para toda la instalación, no por usuario).
- **Frontend** (`apps/mobile`): nueva sección de invitaciones (posiblemente bajo `src/routes/` o `src/profile/`, a decidir en design.md), nuevo servicio HTTP en `src/shared/http/`, nueva acción en `src/routes/detail/route-detail.element.ts` (mismo patrón que el icono de sincronización ya existente).
- **Sin cambios** en `apps/mobile/src-tauri` (Rust) — el clonado es enteramente responsabilidad del backend, el cliente solo ve la ruta clonada como cualquier otra "ruta exclusiva de la nube" ya soportada.
