#!/usr/bin/env bash
#
# tag-release.sh <tag> — crea y empuja un tag de release apuntando siempre a
# origin/master recién fetcheado, nunca al HEAD local de la rama en la que
# se esté trabajando (ver openspec/changes/mejoras-proceso-sdlc/design.md,
# decisión D5). Nace del incidente real de v0.1.14: el tag se puso sobre la
# punta local de una rama de feature en vez de sobre el commit de merge real
# tras un `gh pr merge`, y el APK resultante salió sin dos features que ya
# estaban en master.
#
# Uso: scripts/tag-release.sh v0.1.20

set -euo pipefail

if [ $# -ne 1 ]; then
  echo "Uso: $0 <tag>" >&2
  exit 1
fi

TAG="$1"

echo "Actualizando origin/master..."
git fetch origin master

TARGET_COMMIT=$(git rev-parse origin/master)
echo "Tagueando $TAG sobre origin/master ($TARGET_COMMIT)"

git tag "$TAG" "$TARGET_COMMIT"
git push origin "$TAG"

echo "✓ $TAG creado y empujado, apuntando a $TARGET_COMMIT (origin/master)"
