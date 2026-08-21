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

## Servidor de producción

`docker-compose.prod.yml` ya define el servicio `osrm` (ver
`openspec/changes/desplegar-osrm-produccion`), pero el procesado de datos
en sí **no está automatizado** en el pipeline de despliegue
(`scripts/deploy-local.sh`) — es un proceso pesado (~11 GB de RAM, ver
"Requisitos de recursos" arriba) que no se quiere lanzar sin control en cada
`git push` a un servidor que ya sirve tráfico real. Se ejecuta una vez, a
mano, con tu propio usuario SSH (no `ci-deploy`, que solo tiene la shell fija
de `deploy-local.sh`, sin acceso libre — ver ADR-044).

1. **Comprobar RAM libre antes de lanzarlo** — no reintentar a ciegas si el
   servidor está ya cerca de su límite:
   ```bash
   free -h
   ```
   Si la RAM disponible es ajustada, hacerlo en una ventana de bajo uso.

2. **Ejecutar el mismo script que en local, o copiar los datos ya procesados
   — según la RAM real del servidor.** El servidor de producción actual
   (`debian`, 5.6 GiB de RAM total) **no tiene suficiente para el paso 1**:
   confirmado en la sesión `desplegar-osrm-produccion` (2026-08-21, ver
   [[ADR-053]]). Si tu servidor tampoco llega a los ~12 GB recomendados:

   ```bash
   # Desde una máquina que YA tenga ./data/spain-latest.osrm.* procesado
   # (excluye el .osm.pbf y los .log — no hacen falta en el servidor):
   scp infra/docker/osrm/data/spain-latest.osrm.* \
     usuario@servidor:/ruta/al/repo/infra/docker/osrm/data/
   ```

   Si `osrm/` en el servidor pertenece a `ci-deploy` (checkout de git vía
   `deploy-local.sh`) sin permiso de escritura para tu usuario, crear
   `./data/` a mano primero con `sudo`:
   ```bash
   sudo mkdir -p /ruta/al/repo/infra/docker/osrm/data
   sudo chown $(whoami):users /ruta/al/repo/infra/docker/osrm/data
   ```

   Si el servidor sí tiene RAM de sobra, ejecutar el mismo script que en
   local en su lugar:
   ```bash
   cd /home/gonzalo/moto-routes/infra/docker/osrm
   ./prepare-osm-data.sh
   ```
   Cualquiera de las dos vías deja los ficheros `spain-latest.osrm.*` en
   `./data/`, igual que en local.

3. **Rellenar `MAPMATCH_OSRM_URL` en el `.env.prod` del servidor** (no
   versionado, ver `infra/docker/.env.prod.example`):
   ```
   MAPMATCH_OSRM_URL=http://127.0.0.1:5000
   ```

4. **Redeploy normal** — el siguiente `deploy-local.sh` (automático en cada
   push a `master`) recrea `api` con la variable ya presente y levanta
   `osrm` con los datos ya procesados, sin ningún paso manual adicional en
   ese momento.

Para regenerar los datos más adelante (mapa desactualizado), repetir el
paso 2 — mismo criterio que en local, sin actualización incremental.
