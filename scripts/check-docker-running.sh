#!/usr/bin/env bash
#
# check-docker-running.sh — comprueba que los servicios api/postgres de
# infra/docker/docker-compose.yml están arrancados antes de lanzar Cypress,
# el único paso de pre-commit que depende de un backend real (ver
# openspec/changes/mejoras-proceso-sdlc/design.md). Nace de que "Docker
# Desktop no arrancado" es el patrón más repetido del log de fallos del
# SDLC (memory/metrics/analisis-2026-08-17-2026-08-27.md, P1) — documentado
# varias veces en memory/context.md y aun así repetido: falla explícito y
# pronto en vez de dejar que Cypress falle después con un error de conexión
# genérico.

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$REPO_ROOT/infra/docker/docker-compose.yml"

REQUIRED_SERVICES=(api postgres)
missing=()

for svc in "${REQUIRED_SERVICES[@]}"; do
  status=$(docker compose -f "$COMPOSE_FILE" ps --status running --services 2>/dev/null | grep -x "$svc" || true)
  if [ -z "$status" ]; then
    missing+=("$svc")
  fi
done

if [ ${#missing[@]} -gt 0 ]; then
  echo "✗ Docker: los siguientes servicios no están 'running': ${missing[*]}"
  echo "  Arráncalos con: docker compose -f infra/docker/docker-compose.yml up -d"
  echo "  (si Docker Desktop no está arrancado, ese comando fallará con un error de conexión al daemon — arráncalo primero)"
  exit 1
fi

echo "✓ Docker: ${REQUIRED_SERVICES[*]} arrancados"
