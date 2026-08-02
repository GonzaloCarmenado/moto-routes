## 1. Reconocimiento inicial

- [x] 1.1 Confirmar con el usuario e instalar `cargo-audit` (`cargo install cargo-audit`) — no es dependencia de `Cargo.toml`, es herramienta de sistema (ver design.md, Decisión 1). Instalado con `--locked` (el toolchain de esta máquina, rustc 1.93.1, es más antiguo que lo que exige una dependencia transitiva sin `--locked`)
- [x] 1.2 Ejecutar `cargo audit` y guardar el listado crudo de hallazgos (sin corregir todavía). Resultado: **1 vulnerabilidad real** (`rsa 0.9.10`, RUSTSEC-2023-0071, severidad media, sin fix disponible, vía `sqlx-mysql` de `tauri-plugin-sql` — MySQL nunca se usa en runtime) + 19 avisos no bloqueantes (`unmaintained`/`unsound`/`yanked`, todos de bindings GTK3/Linux de Tauri fuera de nuestro control). **Gap encontrado en el diseño**: `cargo audit` no tiene niveles de severidad (`--deny high` no existe) — corregido en `design.md` Decisión 3 y en la spec
- [x] 1.3 Confirmar el listado ya obtenido de `pnpm audit --audit-level=low` (10 vulnerabilidades: 7 high, 3 moderate) como línea base

## 2. Tests de regresión de configuración (CSP y capabilities)

- [x] 2.1 Extender `src/shared/http/tauri-conf.spec.ts` (ya existe, mismo patrón de lectura por `readFileSync`): CSP de `tauri.conf.json` e `index.html` idénticas, y sin `unsafe-eval`/`unsafe-inline` en `script-src`
- [x] 2.2 Romper temporalmente el invariante (desincronizar una CSP, o añadir `unsafe-eval`) para confirmar que el test falla; revertir el cambio. Confirmado: `sed` añadiendo `unsafe-eval` a `index.html` hizo fallar el test de sincronización (falla antes de llegar a comprobar `unsafe-eval` por separado, orden de aserciones esperado); revertido con `git checkout`, 4/4 en verde de nuevo
- [x] 2.3 Escribir `src/shared/http/capabilities-allowlist.spec.ts`: el array `permissions` de `capabilities/default.json` no excede la lista explícita conocida (comparación exacta, no solo subconjunto — también detecta si se quita un permiso sin querer). Añadido además un segundo test: todo permiso `fs:*` sigue acotado a `$APPDATA/photos`
- [x] 2.4 Romper temporalmente el invariante (añadir un permiso no listado, `shell:allow-execute`) para confirmar que el test falla; revertido con `git checkout`, 6/6 en verde de nuevo

## 3. Resolver vulnerabilidades de pnpm audit

- [x] 3.1 Intentar `pnpm update` directo en los paquetes raíz afectados — no aplicable: `vitepress@1.6.4` ya es la última estable (siguiente publicada es `2.0.0-alpha.19`, prerelease); `vite` de nivel superior ya estaba en la versión segura `6.4.3`. El problema real era 100% transitivo (vitepress arrastrando su propia copia vieja de vite/esbuild)
- [x] 3.2 Fijado en `pnpm-workspace.yaml` → `overrides`: `postcss: 8.5.25` (el `8.5.16` anterior había quedado desactualizado), `vite: ^6.4.3` (fuerza la copia interna de vitepress a la misma versión seguro que ya usaba vitest), y `brace-expansion` acotado por padre para sus 3 líneas major en el árbol (`minimatch@3>`, `minimatch@9>`, `minimatch@10>`) en vez de forzar un único major global
- [x] 3.3 `pnpm run docs` completo sin errores (typedoc + cargo doc + vitepress build) tras los overrides — 3 warnings de typedoc preexistentes, sin relación con este cambio
- [x] 3.4 `pnpm audit --audit-level=low` → **0 vulnerabilidades** (antes 10: 7 high, 3 moderate). Ninguna excepción documentada necesaria — no quedó nada sin fix. Confirmado además: 729/729 Vitest (+4 nuevos), `tsc` y ESLint limpios tras los bumps de `brace-expansion` en las cadenas de eslint/typescript-eslint/typedoc

## 4. Resolver vulnerabilidades de cargo audit

- [x] 4.1 `rsa`/RUSTSEC-2023-0071 no tiene fix disponible (confirmado 1.2) — nada que actualizar; pasa a excepción documentada en 5.1. Los 19 avisos `unmaintained`/`unsound`/`yanked` son todos transitivos de las bindings GTK3/Linux de Tauri (atk, gdk, gtk*, glib, event-listener, spin, proc-macro-error, unic-*) — ninguno es una dependencia que este proyecto declare directamente, sin acción posible en nuestro control
- [x] 4.2 `cargo test` (5 passed), `cargo clippy -- -D warnings` y `cargo fmt --check` en verde — sin cambios, no hubo bumps
- [x] 4.3 `cargo audit --ignore RUSTSEC-2023-0071` → exit code 0 (solo quedan los 19 avisos no bloqueantes)

## 5. Gate de auditoría en pre-commit

- [x] 5.1 Añadido `pnpm audit --audit-level=high || exit 1` y `(cd src-tauri && cargo audit --ignore RUSTSEC-2023-0071) || exit 1` (con comentario explicando la excepción) al principio de `.husky/pre-commit`, antes que ESLint/tests
- [x] 5.2 Verificado bloqueando de verdad: sustituido temporalmente el primer audit por `false`, `sh .husky/pre-commit` → exit code 1, abortó justo tras el primer paso sin llegar al resto; revertido con el original y reconfirmado en verde. **Añadido durante el gate de revisión** (gap encontrado al mapear spec↔test): `src/shared/http/pre-commit-audit-gate.spec.ts` deja esa verificación como regresión automática permanente en vez de solo manual una vez

## 6. Validación de inputs en comandos Rust (verificación, sin cambio de código esperado)

- [x] 6.1 Releído `src-tauri/src/commands/mod.rs` — los 4 tests existentes siguen presentes y pasando (confirmado en 4.2, `cargo test`: 5 passed) y cubren exactamente los 4 escenarios de la spec (ruta absoluta, path traversal, contenido vacío, nombre vacío). Sin gap.
- [x] 6.2 Confirmado por lectura directa del código: `app_info(app_handle)`, `start_foreground_service(_app_handle)`, `stop_foreground_service(_app_handle)`, `pause_recording_location(_app_handle)`, `resume_recording_location(_app_handle)` reciben únicamente `tauri::AppHandle` (inyectado por el framework, no serializable/controlable desde el frontend) — ningún `String` ni path de usuario. No requieren validación adicional.

## 7. Verificación en dispositivo Android real

- [x] 7.1 **No aplicable** (confirmado con el usuario) — ningún cambio de este audit toca código empaquetado en el APK: `capabilities/default.json` y la CSP no se modificaron (solo se verificaron con tests nuevos), los bumps de dependencias son `devDependencies` (build/lint/docs) y el gate de pre-commit es solo de desarrollo. El binario ya instalado en el dispositivo es idéntico en comportamiento al que saldría de recompilar ahora.
- [x] 7.2 **No aplicable** por el mismo motivo — no hay nada nuevo que verificar en fotos/SQLite en el dispositivo.

## 8. Cierre

- [x] 8.1 `memory/context.md` actualizado: nueva entrada de sesión con el resultado completo del audit (0 vulnerabilidades pnpm, 1 excepción documentada en cargo audit, gate nuevo en pre-commit) y la línea del stack sobre Husky corregida para reflejar que el audit ya está cableado de verdad
- [x] 8.2 No hace falta ADR nueva — todo lo hecho es aplicación directa de ADR-014 (permisos mínimos, CSP, auditoría de dependencias), sin ninguna decisión de arquitectura nueva más allá de lo que esa ADR ya cubre. Documentado explícitamente en `memory/context.md`
