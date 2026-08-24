#!/usr/bin/env bash
#
# collect-sysmetrics.sh — escribe una instantánea de memoria y disco del host
# a un fichero JSON pequeño, para que el contenedor de apps/api la lea sin
# necesitar acceso al filesystem del host (ver
# openspec/changes/observabilidad-produccion/design.md, Decisión 2: montar
# /proc y / del host dentro del contenedor revertiría el hardening no-root
# de ADR-041 por una necesidad muy acotada — dos números).
#
# Pensado para ejecutarse periódicamente vía un timer/cron del propio host
# (no de CI, ver design.md Risks) — instalación manual, un paso más de
# configuración de producción como el resto de este proyecto (usuarios de
# MinIO, ACLs de Tailscale). Ejemplo de cron, cada minuto:
#
#   * * * * * /home/gonzalo/moto-routes/scripts/collect-sysmetrics.sh
#
# El destino por defecto coincide con SYSMETRICS_PATH/el bind mount de
# infra/docker/docker-compose.prod.yml (mismo path dentro y fuera del
# contenedor, montado ahí de solo lectura) — sobreescribible con el primer
# argumento.
#
# Escritura atómica (fichero temporal + mv), mismo criterio que el propio
# registrador de eventos de apps/api (internal/opslog): el contenedor nunca
# debe poder leer un JSON a medio escribir.

set -euo pipefail

OUTPUT_PATH="${1:-/var/lib/moto-api/metrics/sysmetrics.json}"
TMP_PATH="${OUTPUT_PATH}.tmp"
# Partición donde vive el checkout real del repositorio (REMOTE_DIR de
# scripts/deploy-local.sh) — el disco que importa vigilar, no una partición
# arbitraria del host.
WATCHED_PATH="/home/gonzalo/moto-routes"

# Memoria: /proc/meminfo está en kB. MemAvailable (no MemFree) es la
# estimación real del kernel de memoria disponible para procesos nuevos,
# teniendo en cuenta caché/buffers reclamables.
mem_total_kb="$(awk '/^MemTotal:/ {print $2}' /proc/meminfo)"
mem_available_kb="$(awk '/^MemAvailable:/ {print $2}' /proc/meminfo)"
mem_total_bytes=$((mem_total_kb * 1024))
mem_used_bytes=$(((mem_total_kb - mem_available_kb) * 1024))

disk_line="$(df -B1 --output=used,size "$WATCHED_PATH" | tail -n 1)"
disk_used_bytes="$(echo "$disk_line" | awk '{print $1}')"
disk_total_bytes="$(echo "$disk_line" | awk '{print $2}')"

timestamp="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

mkdir -p "$(dirname "$OUTPUT_PATH")"
cat > "$TMP_PATH" <<JSON
{
  "timestamp": "${timestamp}",
  "memory": {"usedBytes": ${mem_used_bytes}, "totalBytes": ${mem_total_bytes}},
  "disk": {"usedBytes": ${disk_used_bytes}, "totalBytes": ${disk_total_bytes}}
}
JSON
mv "$TMP_PATH" "$OUTPUT_PATH"
