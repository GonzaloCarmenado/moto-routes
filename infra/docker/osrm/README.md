# Datos OSM para OSRM (normalizar-y-exportar-rutas)

El servicio `osrm` de `docker-compose.yml` ajusta a carretera los puntos GPS
de una ruta al sincronizarla (ver `openspec/changes/normalizar-y-exportar-rutas`
y `memory/decisions.md`, ADR-051). Necesita el extracto OSM de España ya
procesado en `./data/` — no se versiona (varios GB, ver `.gitignore`).

## Generarlo

```bash
./prepare-osm-data.sh
```

Descarga `spain-latest.osm.pbf` de Geofabrik y ejecuta `osrm-extract` +
`osrm-partition` + `osrm-customize` con la imagen oficial `osrm-backend`,
dejando los ficheros `spain-latest.osrm.*` en `./data/` listos para que
`docker compose up osrm` los monte de solo lectura.

## Requisitos de recursos

- **Disco**: ~4 GB libres (el `.pbf` son ~1.4 GB; los ficheros derivados
  suman varios GB más).
- **RAM**: `osrm-extract` sobre España completa llegó a picos de ~11.4 GB.
  Con WSL2/Docker Desktop en su límite por defecto (la mitad de la RAM del
  host, con un tope de 8 GB en versiones recientes) el proceso muere por
  falta de memoria (`exit 137`) sin más explicación en el log. Si pasa,
  subir el límite en `%USERPROFILE%\.wslconfig`:

  ```ini
  [wsl2]
  memory=12GB
  ```

  y reiniciar WSL (`wsl --shutdown`) antes de reintentar — esto también para
  cualquier contenedor Docker que estuviera corriendo, hay que volver a
  levantarlo (`docker compose up -d`) después.

## Regenerarlo (datos OSM desactualizados)

Borrar `./data/spain-latest.osm.pbf` y volver a ejecutar el script — vuelve a
descargar el extracto más reciente de Geofabrik y reprocesa todo desde cero.
No hay actualización incremental.

## Pendiente: servidor de producción

Este procedimiento se ha ejecutado en local. Falta repetirlo en el servidor
(ver `infra/docker/docker-compose.prod.yml`, que usa `network_mode: host` —
el servicio `osrm` ahí necesitaría el mismo tratamiento que `MINIO_ENDPOINT`,
apuntando `MAPMATCH_OSRM_URL` a `http://127.0.0.1:5000`).
