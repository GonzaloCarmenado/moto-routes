## 1. Test estructural del workflow (RED primero)

- [x] 1.1 Escrito `src/shared/ci/ci-workflow.spec.ts` (22 aserciones, sin parser de YAML — texto plano, mismo patrón que `pre-commit-audit-gate.spec.ts`)
- [x] 1.2 RED confirmado: 4/22 fallan porque `.github/workflows/ci.yml` no existía

## 2. Job quality-ts

- [x] 2.1 Creado `.github/workflows/ci.yml` con el job `quality-ts` completo (5 pasos + cache pnpm)
- [x] 2.2 Aserciones de `quality-ts` en verde

## 3. Job quality-tauri

- [x] 3.1 Añadido el job `quality-tauri`. **Gap encontrado**: para compilar en `ubuntu-latest` hace falta instalar las dependencias Linux de Tauri (`libwebkit2gtk-4.1-dev`, `libgtk-3-dev`, etc.) — es la misma causa raíz que ya rompe `docs.yml` (`cargo doc` sin esas dependencias); aquí sí se instalan explícitamente antes de `cargo clippy`/`cargo test`. `cargo-audit` se instala vía `taiki-e/install-action@v2` (binario precompilado) en vez de `cargo install --locked` (compilar desde fuente tarda varios minutos, contradice "eficiente")
- [x] 3.2 Aserciones de `quality-tauri` en verde

## 4. Job build-and-release

- [x] 4.1 Añadido el job `build-and-release`: `needs: [quality-ts, quality-tauri]`, `if: startsWith(github.ref, 'refs/tags/v')`, `runs-on: ubuntu-latest`
- [x] 4.2 Toolchain: `actions/setup-java@v4` (temurin 17), `sdkmanager` para `platforms;android-36`/`ndk;29.0.13846066`/`build-tools;36.0.0`, `actions/cache@v4` sobre esos directorios, `dtolnay/rust-toolchain@stable` con target `aarch64-linux-android`, `Swatinem/rust-cache@v2`
- [x] 4.3 `CARGO_TARGET_AARCH64_LINUX_ANDROID_LINKER` fijado vía `$GITHUB_ENV` apuntando al NDK instalado en el runner (API 24, `linux-x86_64`) — `src-tauri/.cargo/config.toml` sin tocar
- [x] 4.4 `pnpm tauri android build --target aarch64 --debug`
- [x] 4.5 Paso de verificación del hash del bundle (mismo comando de `memory/context.md`) añadido, falla el job si no coincide
- [x] 4.6 Renombrado a `moto-routes-<tag>-arm64-debug.apk` y publicado vía `softprops/action-gh-release@v2`, con nota en el body del Release sobre la limitación de firma de debug
- [x] 4.7 Test estructural completo: **22/22 en verde**. `tsc --noEmit` y ESLint del propio fichero de test limpios

## 5. Verificación real en GitHub Actions (no solo estructural)

- [x] 5.1 PR #87 abierta. Confirmado en GitHub real: `quality-ts` y `quality-tauri` terminan en verde con **todos** sus pasos en éxito (incluido Cypress E2E completo en `ubuntu-latest`, sin necesitar Xvfb ni configuración adicional), `build-and-release` se salta correctamente (push normal, sin tag) — ver `gh run view 30761009506 --json`
- [x] 5.2 No hizo falta: 0 diferencias entre local y CI en el primer intento real, nada que corregir ni ningún umbral que relajar
- [ ] 5.3 Desde una rama aparte de prueba, empujar un tag `v0.0.1-test`, confirmar que `build-and-release` se dispara, compila, y publica el Release con el asset correctamente nombrado — revisar el resultado y borrar el tag/release de prueba antes de mergear esta PR

## 6. Cierre

- [ ] 6.1 Actualizar `memory/context.md` con el resultado (CI real funcionando, decisiones de runner/Java/NDK, limitación de firma aceptada)
- [ ] 6.2 Añadir ADR a `memory/decisions.md` — hay decisiones de arquitectura reales aquí (job único vs 3 workflows, sin firma de release, trigger por tag) que superan el umbral de "solo reafirma una ADR existente"
