#!/usr/bin/env bash
#
# deploy-local.sh — despliega apps/api ejecutándose EN el propio servidor de
# producción (a diferencia de deploy-prod.sh, que se ejecuta desde fuera y
# hace SSH hacia el servidor). Pensado como shell de login de un usuario
# restringido (p. ej. ci-deploy): quien se conecta como ese usuario obtiene
# siempre esta ejecución, nunca una shell libre — ver
# openspec/changes/despliegue-automatico-backend/design.md.
#
# Pasos: git pull --ff-only origin master → docker compose -f
# docker-compose.prod.yml up -d --build → verificación de salud contra la IP
# de Tailscale del propio servidor — la API solo escucha ahí (network_mode:
# host, sin bind a loopback), así que localhost:8080 nunca conecta aunque el
# script corra en el propio servidor. La IP se resuelve en tiempo de
# ejecución (`tailscale ip -4`), nunca hardcodeada: este repo es público
# (ver ADR-035, mismo criterio ya aplicado en scripts/deploy-prod.sh).
#
# Termina con código ≠ 0 si cualquier paso falla o la verificación de salud
# no responde 200.

set -euo pipefail

# Ruta fija, no $HOME: este script es la shell de login de ci-deploy, cuyo
# $HOME (/home/ci-deploy) no es el mismo directorio que el checkout real del
# repositorio (que vive en /home/gonzalo/moto-routes, ver ADR-033/041). Ambos
# usuarios comparten ese directorio vía ACLs POSIX (ver design.md Decisión 2).
REMOTE_DIR="/home/gonzalo/moto-routes"
COMPOSE_FILE="infra/docker/docker-compose.prod.yml"
TAILSCALE_IP="$(tailscale ip -4)"
HEALTH_URL="http://${TAILSCALE_IP}:8080/api/ping"

echo "==> Desplegando en $REMOTE_DIR (ejecución local en el servidor)"

echo "==> [1/3] git pull --ff-only origin master"
cd "$REMOTE_DIR"
git pull --ff-only origin master

echo "==> [2/3] docker compose -f $COMPOSE_FILE up -d --build"
docker compose -f "$COMPOSE_FILE" up -d --build

echo "==> [3/3] Verificando salud: $HEALTH_URL"
# El contenedor recién recreado tarda un instante en aceptar conexiones;
# varios intentos cortos evitan un falso negativo justo tras el restart.
healthy=false
for _ in 1 2 3 4 5; do
  if curl -fsS -o /dev/null --max-time 5 "$HEALTH_URL"; then
    healthy=true
    break
  fi
  sleep 2
done

if [ "$healthy" = true ]; then
  echo "OK: el servicio responde 200 tras el despliegue."
else
  echo "ERROR: la verificación de salud no respondió 200. Revisa el contenedor en el servidor." >&2
  exit 1
fi

echo "==> Despliegue completado con éxito."
