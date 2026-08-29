#!/usr/bin/env bash
#
# verify-prod-env.sh <example> <real> — compara los NOMBRES de clave (nunca
# los valores) entre un fichero *.env.example y un .env real, y falla
# listando lo que falta en el segundo. Nace del incidente real de
# v0.1.16: producción cayó varios minutos porque .env.prod en el servidor
# no tenía ADMIN_STATUS_TOKEN/RESEND_WEBHOOK_SECRET, documentados solo en
# infra/docker/.env.prod.example (ver
# openspec/changes/mejoras-proceso-sdlc/design.md, decisión D6).
#
# Solo local/CI en este cambio: no se conecta por SSH al servidor de
# producción. Para usarlo contra el .env.prod real, cópialo (o léelo por
# SSH) a un fichero local temporal y pásalo como segundo argumento —
# primer uso real contra producción queda como trabajo futuro, fuera de
# alcance de este cambio.
#
# Nota: algunas claves de infra/docker/.env.prod.example están marcadas
# "Opcional" en su propio comentario (p. ej. FCM_SERVICE_ACCOUNT_JSON,
# MAPMATCH_OSRM_URL) — que este script las liste como "falta" no es
# automáticamente un bug, requiere criterio humano leyendo el comentario
# de la clave en el propio .env.prod.example.
#
# Uso: scripts/verify-prod-env.sh infra/docker/.env.prod.example /ruta/a/.env.prod

set -uo pipefail

if [ $# -ne 2 ]; then
  echo "Uso: $0 <example> <real>" >&2
  exit 1
fi

EXAMPLE="$1"
REAL="$2"

for f in "$EXAMPLE" "$REAL"; do
  if [ ! -f "$f" ]; then
    echo "✗ No existe: $f" >&2
    exit 1
  fi
done

example_keys=$(grep -oE '^[A-Z_][A-Z0-9_]*=' "$EXAMPLE" | sed 's/=$//' | sort -u)
real_keys=$(grep -oE '^[A-Z_][A-Z0-9_]*=' "$REAL" | sed 's/=$//' | sort -u)

missing=$(comm -23 <(echo "$example_keys") <(echo "$real_keys"))

if [ -n "$missing" ]; then
  echo "✗ Faltan estas claves en $REAL (presentes en $EXAMPLE):"
  echo "$missing" | sed 's/^/  - /'
  echo "  (algunas pueden ser opcionales — comprueba el comentario de cada clave en $EXAMPLE)"
  exit 1
fi

echo "✓ Todas las claves de $EXAMPLE están presentes en $REAL"
