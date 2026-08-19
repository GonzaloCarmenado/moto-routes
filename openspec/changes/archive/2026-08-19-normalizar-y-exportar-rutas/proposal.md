## Why

Los puntos GPS grabados en el móvil (`route_points`, ver `apps/api/internal/migrate/migrations/0005_create_routes.sql`) llegan con el ruido propio de un GPS de smartphone en moto: en túneles, zonas urbanas densas o bajo dosel forestal aparecen puntos sueltos desplazados de la carretera real (a veces atravesando edificios). Hoy esos puntos crudos son los que se guardan, se muestran en el mapa (`route-map.element.ts`) y los que se exportarían si el usuario quisiera sacar la ruta a otra app. No existe ningún paso de limpieza server-side. Corregirlo ahora, antes de construir exportación a formatos estándar, evita propagar ese ruido a ficheros que el usuario comparte fuera de la app.

## What Changes

- Nuevo servicio self-hosted **OSRM** (`match` endpoint, map-matching basado en HMM) en `infra/docker/docker-compose.yml`, con un extracto OSM de España pre-procesado (Geofabrik), solo para desarrollo/producción propia — no es una dependencia del pipeline de tests.
- Nuevo paso server-side en `apps/api` que, al recibir una ruta completa (`UpsertHandler` en `apps/api/internal/routes/handler.go`), llama al servicio OSRM y calcula la versión "pegada a carretera" de los puntos, sin descartar los puntos crudos originales (se conservan para poder reprocesar si el algoritmo mejora).
- Nuevo endpoint de exportación de ruta a **GPX** (formato estándar interoperable), que usa los puntos normalizados cuando existen y cae a los crudos si la ruta aún no se ha normalizado (rutas antiguas, o fallo puntual del servicio OSRM).
- Nueva acción "Exportar GPX" en el detalle de ruta (`apps/mobile/src/routes/detail/`), descarga/comparte el fichero generado por la API.

## Capabilities

### New Capabilities
- `normalizacion-gps`: servicio server-side que corrige los puntos GPS de una ruta pegándolos a la carretera más probable (map-matching vía OSRM), conservando los puntos originales.
- `exportacion-gpx`: exportación de una ruta guardada (puntos normalizados si existen) a un fichero GPX estándar, descargable/compartible desde el detalle de ruta.

### Modified Capabilities
(ninguna — no existe todavía spec principal para `routes` en `openspec/specs/`; el comportamiento actual de sincronización de rutas está documentado solo en el SDD congelado `specs/features/`, que no se toca)

## Impact

- **Infra**: `infra/docker/docker-compose.yml` (nuevo servicio `osrm`), extracto OSM de España descargado/procesado una vez (no versionado, documentar en README cómo regenerarlo).
- **Backend (`apps/api`)**: nuevo paquete `internal/mapmatch` (cliente HTTP del `/match` de OSRM); `internal/routes/postgres_store.go` y `handler.go` (paso de normalización tras el upsert); nueva migración SQL para persistir los puntos normalizados junto a los crudos; nuevo handler de exportación GPX en `internal/routes/`.
- **Frontend (`apps/mobile`)**: `src/shared/http/route-cloud-api.service.ts` (nueva llamada de exportación); `src/routes/detail/` (nuevo control de exportación, probablemente `route-detail-export.ts` siguiendo el patrón de extracción ya usado en el dominio).
- **Sin cambios** en la grabación local (`src/cockpit/gps/`) ni en el esquema SQLite del dispositivo — la normalización ocurre en el servidor, no en el móvil.
