#!/usr/bin/env bash
#
# check-go-quality.sh — gofmt + go vet + go build de apps/api, más
# verificación de que cada directiva //go:embed apunta a un path realmente
# rastreado por git (ver openspec/changes/mejoras-proceso-sdlc/design.md,
# decisiones D1/D2). Nacido de dos fallos que solo aparecían en CI, nunca en
# local, porque ninguno de los dos corría aquí antes de este script:
#
# - gofmt: comparado contra el fichero en working tree daba falso positivo
#   en Windows por CRLF (core.autocrlf=true) — aquí se compara contra el
#   blob que git va a commitear (git show ":<fichero>"), que ya está
#   normalizado a LF, igual que lo que CI ve al hacer checkout.
# - go:embed: un fichero puede existir en el filesystem local sin estar
#   rastreado por git (causa raíz real del fallo de CI de la PR #162) — go
#   build/vet locales nunca lo detectan porque el fichero SÍ está presente
#   en disco, solo ausente del commit.

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

fail=0

# --- gofmt contra el blob a commitear, no el working tree ---
STAGED_GO_FILES=$(git diff --cached --name-only --diff-filter=ACM -- 'apps/api/*.go')
if [ -n "$STAGED_GO_FILES" ]; then
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    # Sin argumento de fichero, gofmt lee de stdin (confirmado: el flag "-"
    # explícito para stdin no funciona en todas las plataformas/versiones).
    unformatted=$(git show ":$f" | gofmt -l 2>&1)
    if [ -n "$unformatted" ]; then
      echo "✗ gofmt: $f necesita formato (comparado contra el blob en stage, no el working tree)"
      git show ":$f" | gofmt -d | head -40
      fail=1
    fi
  done <<< "$STAGED_GO_FILES"
fi
if [ "$fail" -eq 0 ]; then
  echo "✓ gofmt: sin ficheros .go en stage con formato incorrecto"
fi

# --- go vet / go build ---
if ! (cd apps/api && go vet ./...); then
  echo "✗ go vet ./... falló"
  fail=1
else
  echo "✓ go vet ./... OK"
fi

if ! (cd apps/api && go build -o /dev/null ./...); then
  echo "✗ go build ./... falló"
  fail=1
else
  echo "✓ go build ./... OK"
fi

# --- go:embed apunta a un path realmente rastreado por git ---
EMBED_LINES=$(grep -rn '^//go:embed ' apps/api --include='*.go' || true)
if [ -n "$EMBED_LINES" ]; then
  while IFS= read -r line; do
    [ -z "$line" ] && continue
    file_path="${line%%:*}"
    rest="${line#*:}"
    rest="${rest#*:}"
    directive="${rest#//go:embed }"
    dir_of_file="$(dirname "$file_path")"
    for target in $directive; do
      target="${target#all:}"
      resolved="$dir_of_file/$target"
      tracked_count=$(git ls-files "$resolved" | wc -l | tr -d ' ')
      if [ "$tracked_count" -eq 0 ]; then
        echo "✗ go:embed: '$target' en $file_path (resuelto a $resolved) no tiene ningún fichero rastreado por git"
        fail=1
      else
        echo "✓ go:embed: '$target' en $file_path — $tracked_count fichero(s) rastreado(s)"
      fi
    done
  done <<< "$EMBED_LINES"
fi

exit $fail
