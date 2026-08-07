## Why

Hoy toda ruta grabada vive solo en el SQLite local del dispositivo (`src/shared/repositories/sqlite-route.repository.ts`) — se pierde si se desinstala la app o se cambia de móvil. `apps/api` ya tiene autenticación de usuarios real (`user-auth`, `mobile-auth-screens`) pero ninguna cuenta guarda nada todavía: el login no sirve hoy para más que ver el propio email. Añadir persistencia de rutas en el servidor, ligada a la cuenta, es el primer uso real de tener sesión.

## What Changes

- Nuevo modelo de datos de rutas en `apps/api`/Postgres: tabla de rutas (metadatos), puntos GPS y paradas — mismos campos que ya persiste `sqlite-route.repository.ts`, sin fotos (fuera de alcance de este cambio).
- Nuevos endpoints autenticados (`RequireAuth`, mismo middleware que `/api/auth/me`): subir/actualizar una ruta propia, listar las rutas propias (resumen) y obtener el detalle completo (puntos+paradas) de una ruta propia.
- El listado de rutas (`route-list.element.ts`) pasa a mostrar, en una sola lista, las rutas locales de este dispositivo y las que además existen en la nube — una ruta subida se muestra **una sola vez**, con un icono que indica su estado ("solo local" / "sincronizada"), nunca duplicada. Una ruta que solo existe en la nube (no está en este dispositivo) también aparece, con su propio icono.
- El detalle de ruta (`route-detail`) gana una acción "Subir a la nube", visible solo si hay sesión activa y la ruta es local. Subir una ruta ya subida antes actualiza la copia existente (upsert), no crea una duplicada.
- El detalle de una ruta que solo existe en la nube se abre igual que uno local (mismo componente, mapa y timeline), descargando los datos del servidor bajo demanda — no se cachea en SQLite en este cambio (eso sería una feature de descarga/importación aparte, fuera de alcance).
- Sin sesión activa, el listado y el detalle se comportan exactamente igual que hoy (solo rutas locales, sin acción de subir) — mismo criterio de "flujo aislado" ya establecido en `mobile-auth-screens`.

## Capabilities

### New Capabilities
- `route-cloud-sync`: subida de una ruta local a la cuenta del usuario autenticado, listado combinado local+nube con estado visual, y visualización del detalle de una ruta que vive en el servidor.

### Modified Capabilities
(ninguna — el listado/detalle de rutas locales vive en `specs/features/` congelado, no en `openspec/specs/`; el comportamiento nuevo se especifica entero dentro de `route-cloud-sync`)

## Impact

- **`apps/api`**: nuevo dominio `internal/routes/` (siguiendo el patrón ya establecido por `internal/auth/`/`internal/stoptypes/`) — handlers, store Postgres, migración nueva (`000X_create_routes.sql`) con tablas para rutas/puntos/paradas, todas con `user_id` y `RequireAuth`.
- **`apps/mobile`**: `src/shared/http/` gana un cliente para los endpoints de rutas (mismo patrón que `auth-api.service.ts`); `route-list.element.ts`/`route-list.service.ts` y `route-detail` se extienden para combinar origen local+nube; nuevo botón "Subir a la nube" en el detalle, gateado por `ISessionRepository` (ya existente desde `mobile-auth-screens`).
- **CORS**: los endpoints nuevos necesitan `httpmw.PublicCORS` + ruta `OPTIONS` desde el principio (gap real ya encontrado y corregido en `pantallas-auth-mobile` para los endpoints de auth — no repetirlo aquí).
- **Sin fotos**: explícitamente fuera de alcance — la subida de imágenes a un blob store queda para un cambio futuro (ya anticipado en ADR-034).
