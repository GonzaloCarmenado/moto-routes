#!/usr/bin/env bash
#
# check-native-plugins.sh — por cada paquete @tauri-apps/plugin-* en
# apps/mobile/package.json, confirma que existe su crate tauri-plugin-* en
# Cargo.toml y que está registrado (tauri_plugin_*) en lib.rs. Unidireccional
# (JS -> Rust, no al revés): crates Rust sin paquete JS equivalente, como
# tauri-plugin-opener/tauri-plugin-log, son válidos y no deben fallar aquí
# (ver openspec/changes/mejoras-proceso-sdlc/design.md, decisión D3).
#
# Nace del rework real de notificaciones-push-fcm: @tauri-apps/plugin-notification
# se añadió como dependencia JS con tests unitarios mockeados en verde, pero el
# crate Rust nunca se añadió a Cargo.toml ni se registró en lib.rs — invisible
# para cualquier test, solo visible en dispositivo real.

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

PACKAGE_JSON="apps/mobile/package.json"
CARGO_TOML="apps/mobile/src-tauri/Cargo.toml"
LIB_RS="apps/mobile/src-tauri/src/lib.rs"

fail=0

PLUGIN_NAMES=$(node -e "
const pkg = require('./$PACKAGE_JSON');
const deps = Object.keys(pkg.dependencies || {});
for (const d of deps) {
  const m = d.match(/^@tauri-apps\/plugin-(.+)$/);
  if (m) console.log(m[1]);
}
")

if [ -z "$PLUGIN_NAMES" ]; then
  echo "✓ plugins nativos: ningún @tauri-apps/plugin-* en $PACKAGE_JSON"
  exit 0
fi

while IFS= read -r name; do
  [ -z "$name" ] && continue
  crate_name="tauri-plugin-$name"
  init_symbol="tauri_plugin_${name//-/_}"

  if ! grep -q "^$crate_name " "$CARGO_TOML" && ! grep -q "^$crate_name=" "$CARGO_TOML"; then
    echo "✗ plugin nativo: @tauri-apps/plugin-$name está en $PACKAGE_JSON pero '$crate_name' no está en $CARGO_TOML"
    fail=1
    continue
  fi

  if ! grep -q "$init_symbol" "$LIB_RS"; then
    echo "✗ plugin nativo: '$crate_name' está en $CARGO_TOML pero '$init_symbol' no aparece registrado en $LIB_RS"
    fail=1
    continue
  fi

  echo "✓ plugin nativo: @tauri-apps/plugin-$name — $crate_name (Cargo.toml) + $init_symbol (lib.rs)"
done <<< "$PLUGIN_NAMES"

exit $fail
