#!/usr/bin/env bash
# Descarga y procesa el extracto OSM de España para el servicio osrm de
# docker-compose.yml (ver openspec/changes/normalizar-y-exportar-rutas,
# design.md Decisión 1). Genera los ficheros .osrm* en ./data (gitignored,
# varios GB) — se regenera con este script, nunca se versiona.
#
# Requiere ~4 GB libres para el .osm.pbf y unos 10-12 GB de RAM disponibles
# para osrm-extract con el grafo de España completo (ver memory/decisions.md,
# ADR-051, Consecuencias) — en esta máquina hizo falta subir el límite de
# memoria de WSL2/Docker Desktop (~/.wslconfig, memory=12GB) para completarlo
# sin que el proceso muriera por falta de memoria (exit 137).
#
# Uso: ./prepare-osm-data.sh
set -euo pipefail

cd "$(dirname "$0")/data"

PBF_URL="https://download.geofabrik.de/europe/spain-latest.osm.pbf"
PBF_FILE="spain-latest.osm.pbf"
OSRM_IMAGE="ghcr.io/project-osrm/osrm-backend"

if [ ! -f "$PBF_FILE" ]; then
    echo "Descargando extracto OSM de España desde Geofabrik..."
    curl -L -o "$PBF_FILE" "$PBF_URL"
fi

echo "osrm-extract (perfil car)..."
docker run --rm -v "$(pwd):/data" "$OSRM_IMAGE" osrm-extract -p /opt/car.lua "/data/$PBF_FILE"

echo "osrm-partition..."
docker run --rm -v "$(pwd):/data" "$OSRM_IMAGE" osrm-partition /data/spain-latest.osrm

echo "osrm-customize..."
docker run --rm -v "$(pwd):/data" "$OSRM_IMAGE" osrm-customize /data/spain-latest.osrm

echo "Listo. Los ficheros spain-latest.osrm.* en ./data están listos para el servicio osrm de docker-compose.yml."
