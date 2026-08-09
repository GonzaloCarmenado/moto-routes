## Why

El backend de fotos de ruta (`almacenamiento-fotos-backend`, ya en `master`: `apps/api/internal/photos/`, cuatro endpoints bajo `/api/routes/{id}/photos`, cifrado AES-256-GCM) no tiene todavía ningún consumidor en `apps/mobile`. La re-subida automática de una ruta sincronizada (`route-cloud-sync`, ADR-040) ya re-sube metadatos/puntos/paradas al añadir o borrar una foto, pero deja la foto en sí fuera — documentado como fuera de alcance en su momento, con dos `// TODO` explícitos en `route-detail.element.ts` (líneas 433 y 508) marcando dónde retomarlo. Con el backend ya verificado en producción, cerrar ese hueco es la pieza que falta para que una cuenta con sesión activa tenga sus fotos disponibles en el servidor, no solo en el dispositivo que las capturó.

## What Changes

- Al añadir una foto (cámara o galería) a una ruta ya sincronizada con la nube, la app sube también el archivo de la foto al backend (`POST /api/routes/{id}/photos`), no solo los metadatos/puntos/paradas de la ruta.
- Al borrar una foto de una ruta ya sincronizada, la app borra también su copia remota (`DELETE /api/routes/{id}/photos/{photoId}`).
- Añadir/borrar una foto en una ruta puramente local (nunca subida) sigue sin disparar ninguna llamada de red — mismo criterio ya establecido para metadatos.
- La subida/borrado de la foto es en segundo plano y no bloqueante: un fallo (sin conexión, error del servidor) muestra un aviso discreto y no revierte el cambio local ya guardado — mismo patrón que la re-subida de metadatos.
- Persistencia local nueva: cada foto guarda si ya tiene copia remota (y su identificador remoto), para poder borrarla del servidor más tarde sin depender de volver a listarla primero.

**Fuera de alcance (no-goals)**, a decidir explícitamente en `design.md` si conviene ampliarlo en un cambio futuro:
- Backfill: fotos que ya existían en una ruta sincronizada *antes* de este cambio no se suben retroactivamente solas.
- Descargar/ver las fotos de una ruta que solo existe en la nube (no local) — hoy `loadCloudRouteDetail` no trae fotos en absoluto.
- Botón o acción manual de "subir todas las fotos" independiente del flujo de añadir/borrar.

## Capabilities

### New Capabilities
(ninguna — este cambio amplía el comportamiento ya definido por `route-cloud-sync`, no introduce un dominio nuevo)

### Modified Capabilities
- `route-cloud-sync`: el escenario "Añadir o borrar una foto en una ruta sincronizada re-sube sus metadatos" cambia — ya no dice explícitamente que "la foto en sí no se sube"; ahora la foto se sube/borra de verdad contra el backend de fotos, además de re-subir metadatos/puntos/paradas.

## Impact

- `apps/mobile/src/routes/detail/route-detail.element.ts` — `handleAddPhoto` (línea ~433) y `handleDeletePhoto` (línea ~508): sustituir los `// TODO` por las llamadas reales.
- `apps/mobile/src/shared/http/` — nuevo servicio HTTP para `/api/routes/{id}/photos` (multipart en subida, no JSON — `fetchJson` de `external-api.service.ts` no sirve tal cual porque siempre parsea la respuesta como JSON y no construye `FormData`).
- `apps/mobile/src/routes/detail/route-detail-cloud.service.ts` o un servicio equivalente — orquestación de subida/borrado de foto, reutilizando el patrón ya usado por `autoResyncIfNeeded`/`checkIfRouteIsSynced`.
- `apps/mobile/src/shared/models/photo.types.ts`, `photo.repository.ts` y sus implementaciones (`sqlite-photo.repository.ts`, `memory-photo.repository.ts`) — nuevo campo de estado remoto por foto (id remoto y/o flag de sincronizada), con migración SQLite condicional (mismo patrón que `preview_polyline` en `routes`, ver `mejoras-fotos-mapa`).
- `openspec/specs/route-cloud-sync/spec.md` — delta al escenario de re-subida por foto.
- `apps/api/internal/httpmw/cors.go` — **no estaba previsto, pero verificando en un dispositivo Android real (WebView real, no Cypress) se encontró que el borrado de fotos nunca llegaba al servidor**: `PublicCORS` no declaraba `DELETE` en `Access-Control-Allow-Methods`, así que el preflight real lo rechazaba. Corregido (ver design.md).
