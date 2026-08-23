## Why

Hoy, elegir a otra persona en la app es un campo de texto libre sin ninguna ayuda visual: enviar una solicitud de amistad exige escribir el username exacto de memoria (`friends-view.element.ts`), y compartir una ruta exige escribir el email exacto de la otra cuenta (`route-share-dialog.element.ts`) — dos formularios distintos, dos formas de identificar a alguien, sin ninguna confirmación visual (nombre, foto) de a quién se está seleccionando hasta después de confirmar. Un componente único de autocomplete con foto reduce el error de escritura y da la misma confianza visual en ambos sitios.

## What Changes

- Nuevo componente compartido `<friend-selector>` (`src/shared/`): autocomplete que busca cuentas por username parcial mientras se escribe, mostrando username + avatar (icono placeholder como fallback si no tiene avatar subido) por cada resultado.
- Nuevo endpoint `GET /api/users/search?q=` — búsqueda de cuentas por username parcial, abierta a cualquier usuario autenticado sobre cualquier username registrado (no restringida a amigos existentes), con rate limiting propio y resultados acotados; nunca expone el email en la respuesta.
- Nuevo endpoint `GET /api/users/{username}/avatar` — hoy solo se puede descargar el avatar de la propia cuenta autenticada (`GET /api/auth/avatar`); hace falta poder ver el de otra cuenta para pintarlo en los resultados de búsqueda.
- El formulario de enviar solicitud de amistad (`friends-view.element.ts`) sustituye su input de texto exacto por `<friend-selector>`.
- **BREAKING** (interno, sin usuarios afectados fuera de esta app): el diálogo de invitar a compartir ruta (`route-share-dialog.element.ts`) sustituye su input de email por `<friend-selector>` — compartir-rutas pasa de identificar al destinatario por email a identificarlo por username, igual que amigos. `POST /api/route-shares` cambia su campo `email` por `username`.

## Capabilities

### New Capabilities
- `selector-amigos`: el componente `<friend-selector>` y los dos endpoints nuevos de búsqueda de usuarios y avatar ajeno.

### Modified Capabilities
- `amigos`: el requirement "Enviar una solicitud de amistad por nombre de usuario" pasa de un input de texto exacto a seleccionar de una lista de resultados de búsqueda — el username final enviado sigue siendo exacto (lo que ya seleccionó el usuario), el comportamiento de creación de la solicitud no cambia.
- `compartir-rutas`: el requirement "Invitar a otra cuenta por email a recibir una copia de la ruta" cambia de identificar al destinatario por email a identificarlo por username — mismo criterio anti-enumeración, mismo límite de invitaciones repetidas, ahora sobre username en vez de email.

## Impact

- **Backend** (`apps/api/`): paquete nuevo `internal/userdirectory` (o similar) para el endpoint de búsqueda, calcado del patrón de rate limiting ya usado en `internal/friends`/`internal/auth`; `internal/avatar/handler.go` gana un handler nuevo para avatar ajeno, reutilizando el mismo `BlobStore` cifrado; `internal/routesharing/handler.go` cambia `email`→`username` en la petición de invitación y en la resolución del destinatario (`FindUserByEmail`→`FindUserByUsername`, ya existe desde `nombre-usuario`).
- **Frontend** (`apps/mobile/src/`): `shared/friend-selector/` (componente nuevo), `shared/http/user-search-api.service.ts` (nuevo, llamada al endpoint de búsqueda), `friends/friends-view.element.ts` (adopta el selector), `routes/detail/route-share-dialog.element.ts` (adopta el selector, cambia de email a username), `shared/http/route-sharing-api.service.ts` (cambia el payload de invitación).
- **Specs**: `openspec/specs/amigos/spec.md` y `openspec/specs/compartir-rutas/spec.md` ganan/modifican requirements; nuevo `openspec/specs/selector-amigos/spec.md`.
- **Sin cambio**: el resto de `route-cloud-sync`/`user-auth` no se toca; la aceptación/rechazo/clonado de invitaciones de ruta ya identifican todo por el `id` de la invitación, no por email, así que no se ven afectados por el cambio de campo en la creación.
