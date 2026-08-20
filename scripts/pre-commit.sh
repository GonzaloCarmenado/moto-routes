#!/usr/bin/env bash
#
# pre-commit.sh — ejecuta los quality gates de pre-commit con progreso visible
# (paso actual, estado, duración habitual y una estimación de lo que queda).
# Sustituye a la cadena de comandos encadenados de .husky/pre-commit, que no
# daba ninguna señal de en qué paso iba durante los ~3 minutos que tarda la
# suite completa (Cypress incluido).
#
# La estimación sale de .git/pre-commit-timings.tsv: la duración real de cada
# paso, guardada solo tras una ejecución completa con éxito (una duración
# parcial tras un fallo no es representativa). Nunca versionado — .git/ no se
# trackea — así que cada máquina construye su propio historial. Sin
# historial todavía (primera vez, o un paso nuevo) se muestra "sin
# historial" en vez de inventar un número.
#
# Termina con código ≠ 0 en el primer paso que falle (mismo comportamiento
# fail-fast que el script encadenado anterior).

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TIMINGS_FILE="$REPO_ROOT/.git/pre-commit-timings.tsv"
cd "$REPO_ROOT"

STEP_NAMES=(
  "Auditando vulnerabilidades (frontend)"
  "Auditando vulnerabilidades (Rust)"
  "Auditando vulnerabilidades (Go)"
  "ESLint (frontend)"
  "Tests frontend (Vitest)"
  "Formato Rust (cargo fmt --check)"
  "Clippy (backend)"
  "Tests backend (cargo test)"
  "Tests E2E (Cypress)"
)
TOTAL=${#STEP_NAMES[@]}

step_1() { pnpm audit --audit-level=high; }
step_2() {
  # RUSTSEC-2023-0071 (rsa, sin fix disponible): llega via sqlx-mysql, dependencia
  # transitiva de tauri-plugin-sql aunque este proyecto solo usa su feature
  # "sqlite" — la app nunca abre una conexión MySQL, así que la ruta de código
  # vulnerable (autenticación caching_sha2_password) es inalcanzable en runtime.
  # Reevaluar si tauri-plugin-sql cambia de versión. Ver design.md de
  # openspec/changes/auditoria-seguridad/ para el detalle completo.
  # RUSTSEC-2026-0235 (rkyv, out-of-bounds read, fix en >=0.8.17): llega vía el
  # feature opcional "rkyv" de rust_decimal, a su vez transitivo de sqlx (mismo
  # árbol que RUSTSEC-2023-0071). Confirmado con `cargo tree -e features -i
  # rust_decimal --target all` que este proyecto solo activa "default"/"serde"/
  # "std" de rust_decimal — el feature "rkyv" nunca se activa, así que el crate
  # vulnerable ni siquiera se compila en este build. Reevaluar si rust_decimal
  # o su feature activo cambian.
  (cd apps/mobile/src-tauri && cargo audit --ignore RUSTSEC-2023-0071 --ignore RUSTSEC-2026-0235)
}
step_3() { (cd apps/api && govulncheck ./...); }
step_4() { (cd apps/mobile && npx eslint src/ --max-warnings 0); }
step_5() { (cd apps/mobile && npx vitest run --coverage --silent); }
step_6() { (cd apps/mobile/src-tauri && cargo fmt --check); }
step_7() { (cd apps/mobile/src-tauri && cargo clippy -- -D warnings); }
step_8() { (cd apps/mobile/src-tauri && cargo test); }
step_9() { (cd apps/mobile && pnpm test:e2e); }

# Duración registrada (segundos) para el nombre de paso $1, vacío si no hay historial.
historical_duration() {
  [ -f "$TIMINGS_FILE" ] || return 0
  awk -F'\t' -v name="$1" '$1 == name { print $2 }' "$TIMINGS_FILE"
}

format_seconds() {
  local s=$1
  if [ "$s" -ge 60 ]; then
    printf '%dm%02ds' $((s / 60)) $((s % 60))
  else
    printf '%ds' "$s"
  fi
}

# Suma la duración histórica de los pasos desde el índice $1 (1-indexado) hasta el final.
remaining_estimate() {
  local from=$1 total=0 have_any=false d
  for ((i = from; i <= TOTAL; i++)); do
    d=$(historical_duration "${STEP_NAMES[$((i - 1))]}")
    if [ -n "$d" ]; then
      have_any=true
      total=$((total + d))
    fi
  done
  if [ "$have_any" = true ]; then
    format_seconds "$total"
  else
    echo "desconocido"
  fi
}

run_start=$(date +%s)
declare -a actual_durations

for ((i = 1; i <= TOTAL; i++)); do
  name="${STEP_NAMES[$((i - 1))]}"
  hist=$(historical_duration "$name")
  hist_label="sin historial"
  [ -n "$hist" ] && hist_label="~$(format_seconds "$hist")"
  remaining=$(remaining_estimate $((i + 1)))

  echo ""
  echo "▶ [$i/$TOTAL] $name — duración habitual: $hist_label · queda tras este paso: ~$remaining"

  step_start=$(date +%s)
  if ! "step_$i"; then
    step_duration=$(( $(date +%s) - step_start ))
    echo ""
    echo "✗ [$i/$TOTAL] $name — FALLÓ (tras $(format_seconds "$step_duration"))"
    exit 1
  fi
  step_duration=$(( $(date +%s) - step_start ))
  actual_durations[$i]=$step_duration
  echo "✓ [$i/$TOTAL] $name — OK ($(format_seconds "$step_duration"))"
done

# Solo se persiste si la suite completa termina con éxito — un historial
# parcial (tras un fallo) daría estimaciones erróneas en la próxima corrida.
{
  for ((i = 1; i <= TOTAL; i++)); do
    printf '%s\t%s\n' "${STEP_NAMES[$((i - 1))]}" "${actual_durations[$i]}"
  done
} > "$TIMINGS_FILE"

total_duration=$(( $(date +%s) - run_start ))
echo ""
echo "✅ Pre-commit checks superados en $(format_seconds "$total_duration")"
