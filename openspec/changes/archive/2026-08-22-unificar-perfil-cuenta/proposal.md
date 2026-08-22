## Why

Desde `nombre-usuario` (2026-08-22), toda cuenta tiene un `username` único y obligatorio en el servidor. El "Nombre" que Perfil sigue mostrando (`Profile.name` en `apps/mobile/src/shared/models/profile.types.ts`) es un campo completamente distinto, puramente local (SQLite del dispositivo), sin relación con la cuenta ni con `username` — dos identidades separadas para lo mismo, una de ellas (la local) ya redundante. El avatar (`Profile.avatarPath`) tiene el mismo problema: vive solo en el dispositivo, así que iniciar sesión en un dispositivo nuevo (o tras reinstalar la app) no recupera ni el nombre ni la foto de perfil que el usuario ya había configurado.

## What Changes

- **BREAKING**: se elimina el campo local `Profile.name` y su edición (`profile-edit-dialog.element.ts`, sección "nombre" del modal "Editar perfil"). El nombre mostrado en Perfil pasa a ser el `username` de la cuenta — la única fuente de verdad, ya obligatoria para toda cuenta.
- El avatar deja de guardarse solo en SQLite local: se sube al servidor asociado a la cuenta (cifrado en reposo y servido solo vía API autenticada, mismo criterio ya establecido por `route-photo-storage` para las fotos de ruta).
- Al iniciar sesión (arranque en frío o login interactivo), la app descarga el avatar de la cuenta y lo muestra junto al `username`, sin depender de que ese dispositivo lo haya subido antes.
- Sin sesión activa, Perfil no puede mostrar nombre ni avatar de cuenta (no hay username sin cuenta) — coherente con el propio bloqueo de `username-gate` (`nombre-usuario`), que ya impide usar la app sin username fijado.
- El vehículo (`vehicleType`/`vehicleMake`/`vehicleModel`) NO cambia: sigue siendo puramente local, sin relación con la cuenta — fuera de alcance de este cambio.

## Capabilities

### New Capabilities

- `identidad-cuenta`: subida, almacenamiento cifrado y descarga del avatar de la cuenta autenticada (backend, mismo patrón que `route-photo-storage`); en el cliente móvil, Perfil muestra `username` + avatar de cuenta como identidad, eliminando el campo de nombre local.

### Modified Capabilities

Ninguna. `user-auth` no cambia: `GET /api/auth/me` no necesita exponer si hay avatar — el cliente simplemente intenta descargarlo (nuevo endpoint de `identidad-cuenta`) y trata un 404 como "sin avatar", mismo criterio que ya usa `route-photo-storage` (sin ningún flag "tienePhotos" en la ruta, se listan/descargan aparte).

## Impact

- **Backend (`apps/api`)**: paquete nuevo (o extensión de `internal/auth`) para subir/servir el avatar — probablemente una migración nueva (columna o tabla `avatar`), cifrado en reposo (mismo mecanismo que `apps/api/internal/photos`), y una ruta nueva bajo `/api/auth/avatar` o similar. `meResponse` (`apps/api/internal/auth/me.go`) no cambia — el cliente descubre si hay avatar intentando descargarlo, no vía `/me`.
- **Frontend (`apps/mobile`)**:
  - `src/shared/models/profile.types.ts` — `Profile.name`/`avatarPath` se eliminan o se resignifican (a decidir en design.md si el vehículo sigue viviendo en la misma tabla/repositorio).
  - `src/profile/profile.service.ts`, `profile.transform.ts` (`sanitizeProfileName`), `profile-header.ts`, `profile-edit-dialog.element.ts`, `profile.element.ts` — dejan de leer/escribir el nombre local; la sección de avatar del modal "Editar perfil" pasa a subir el archivo al servidor en vez de a SQLite.
  - `src/auth/auth-section.service.ts`/`auth-section.ts` (ya expone `username`) y `src/app/app.element.ts` (`checkUsernameGate`) son los puntos naturales para disparar la descarga del avatar al iniciar sesión.
  - `src/shared/services/photo-storage.service.ts` — posible reutilización parcial (guardado/lectura de archivos locales) para cachear el avatar descargado.
- **Migración de datos existentes**: los usuarios que ya tenían un nombre/avatar local los pierden (no hay forma de asociarlos a la cuenta automáticamente sin que el usuario los vuelva a subir) — a documentar explícitamente en design.md como riesgo aceptado, igual que `nombre-usuario` documentó la pérdida del username para cuentas preexistentes.
