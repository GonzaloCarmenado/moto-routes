## Purpose

Dar al proyecto un CI/CD real en GitHub Actions que replique en un runner limpio, independiente del entorno de quien commitea, los mismos gates de calidad que ya exige `.husky/pre-commit` — y que, además, compile y publique el APK de Android como Release cuando se etiqueta una versión, sin depender del proceso manual y sujeto a gotchas de máquina local que existe hoy.

## ADDED Requirements

### Requirement: Los gates de calidad de TypeScript bloquean en cada push y pull request
El job `quality-ts` de `.github/workflows/ci.yml` SHALL ejecutarse en cada push y en cada pull request, y SHALL fallar (estado rojo en GitHub) si cualquiera de sus pasos falla: `tsc --noEmit`, cobertura de documentación (`pnpm run docs:coverage`, umbral 70%), ESLint (`--max-warnings 0`), Vitest con cobertura (umbral 80%, mismos valores que `vitest.config.ts`), y los tests E2E de Cypress (`pnpm run test:e2e`).

#### Scenario: El job falla si tsc encuentra un error de tipos
- **WHEN** el código tiene un error de tipos que `tsc --noEmit` detectaría
- **THEN** el job `quality-ts` termina en rojo antes de llegar a los pasos siguientes

#### Scenario: El job falla si ESLint encuentra un warning
- **WHEN** `eslint --max-warnings 0` encuentra al menos un warning
- **THEN** el job `quality-ts` termina en rojo
- **Nota de verificación**: comportamiento heredado directamente de `eslint --max-warnings 0`, ya verificado como gate real en `.husky/pre-commit`; no se reverifica aquí, se verifica que el job invoca el mismo comando.

#### Scenario: El job falla si la cobertura de Vitest cae por debajo del 80%
- **WHEN** `vitest run --coverage` reporta cobertura de líneas, funciones, branches o statements por debajo del 80%
- **THEN** el job `quality-ts` termina en rojo (el propio umbral ya vive en `vitest.config.ts`, el job no define uno nuevo)

#### Scenario: El job falla si algún test de Cypress falla
- **WHEN** `pnpm run test:e2e` reporta al menos un test fallido de los 39 specs existentes
- **THEN** el job `quality-ts` termina en rojo

#### Scenario: El job falla si la cobertura de documentación cae por debajo del 70%
- **WHEN** `pnpm run docs:coverage` reporta cobertura de JSDoc por debajo del umbral ya definido en `scripts/docs-coverage.mjs`
- **THEN** el job `quality-ts` termina en rojo

#### Scenario: El job pasa en verde cuando todos los gates pasan
- **WHEN** `tsc`, ESLint, Vitest, Cypress y la cobertura de docs pasan todos sus umbrales
- **THEN** el job `quality-ts` termina en verde
- **Nota de verificación**: estructura del job (pasos presentes, orden, comandos exactos) verificada por `src/shared/ci/ci-workflow.spec.ts`; el resultado real pass/fail solo se observa ejecutando el workflow en GitHub Actions — no hay equivalente Vitest/Cypress para "GitHub Actions decidió verde", igual que ya ocurre con `cargo audit` en la spec `security-audit`.

### Requirement: Los gates de calidad de Rust/Tauri bloquean en cada push y pull request
El job `quality-tauri` de `.github/workflows/ci.yml` SHALL ejecutarse en cada push y en cada pull request, y SHALL fallar si `cargo fmt --check`, `cargo clippy -- -D warnings`, `cargo test` o `cargo audit --ignore RUSTSEC-2023-0071` (misma excepción documentada que en `.husky/pre-commit`) fallan.

#### Scenario: El job falla si el código Rust no está formateado
- **WHEN** `cargo fmt --check` detecta diferencias de formato
- **THEN** el job `quality-tauri` termina en rojo

#### Scenario: El job falla si Clippy encuentra un warning
- **WHEN** `cargo clippy -- -D warnings` encuentra al menos un warning
- **THEN** el job `quality-tauri` termina en rojo

#### Scenario: El job falla si un test de Rust falla
- **WHEN** `cargo test` reporta al menos un test fallido
- **THEN** el job `quality-tauri` termina en rojo

#### Scenario: El job falla si aparece una vulnerabilidad de Rust nueva y no exceptuada
- **WHEN** `cargo audit --ignore RUSTSEC-2023-0071` reporta una vulnerabilidad real cuyo ID no está en la excepción documentada
- **THEN** el job `quality-tauri` termina en rojo
- **Nota de verificación**: verificado ejecutando `cargo audit` real, igual que en la spec `security-audit` — no hay equivalente Vitest/Cypress para el árbol de dependencias de Rust.

### Requirement: El build y release de Android solo se dispara con un tag de versión
El job `build-and-release` de `.github/workflows/ci.yml` SHALL ejecutarse únicamente cuando se empuja un tag que cumple el patrón `v*` (p. ej. `v0.2.0`) — nunca en un push normal a `master` ni en una PR. SHALL depender (`needs:`) de que `quality-ts` y `quality-tauri` hayan pasado antes de compilar.

#### Scenario: Un push normal a master no dispara el job de release
- **WHEN** se hace push directo de commits a `master` sin ningún tag
- **THEN** el job `build-and-release` no se ejecuta (se salta por su condición `if:`)

#### Scenario: Un tag de versión dispara el job de release
- **WHEN** se empuja un tag que cumple `v*` (p. ej. `git push origin v0.2.0`)
- **THEN** el job `build-and-release` se ejecuta

#### Scenario: El release no compila si los gates de calidad no han pasado
- **WHEN** `quality-ts` o `quality-tauri` para ese mismo commit terminan en rojo
- **THEN** el job `build-and-release` no se ejecuta, por su dependencia `needs: [quality-ts, quality-tauri]`

#### Scenario: El APK resultante se publica como asset del GitHub Release
- **WHEN** el build de Android (`pnpm tauri android build --target aarch64 --debug`) termina con éxito
- **THEN** el `.apk` generado queda adjunto como asset descargable en el Release de GitHub asociado al tag
- **Nota de verificación**: verificado con un tag real de prueba (`v0.0.1-test`) durante la implementación de este cambio — el Release se creó con el asset `moto-routes-v0.0.1-test-arm64-debug.apk` adjunto, confirmado con `gh release view` y borrado después. No automatizable con Vitest/Cypress, requiere publicar un release de verdad.

### Requirement: El linker de Android en CI no depende de la ruta local de ninguna máquina de desarrollo
El job `build-and-release` de `.github/workflows/ci.yml` SHALL fijar `CARGO_TARGET_AARCH64_LINUX_ANDROID_LINKER` como variable de entorno del propio job, apuntando al NDK instalado en el runner — SHALL NOT depender de ninguna ruta hardcodeada en `src-tauri/.cargo/config.toml` (que sigue existiendo tal cual para builds locales en Windows).

#### Scenario: El build de Android en CI no falla por una ruta de linker inexistente
- **WHEN** se ejecuta `pnpm tauri android build --target aarch64 --debug` en el runner del job `build-and-release`
- **THEN** el linker usado es el del NDK instalado en ese runner (vía la variable de entorno del job), no la ruta `D:\Android\Sdk\...` de `src-tauri/.cargo/config.toml`

### Requirement: pnpm y Cargo reutilizan caché entre ejecuciones
Los tres jobs de `.github/workflows/ci.yml` SHALL cachear las dependencias de pnpm (vía `actions/setup-node` con `cache: pnpm`, mismo patrón que `docs.yml`), y `quality-tauri`/`build-and-release` SHALL además cachear el registro y los artefactos compilados de Cargo, para no reinstalar/recompilar desde cero en cada ejecución.

#### Scenario: Los tres jobs declaran caché de pnpm
- **WHEN** se inspecciona la configuración de `actions/setup-node` en los jobs `quality-ts`, `quality-tauri` y `build-and-release`
- **THEN** los tres declaran `cache: pnpm`
- **Nota de verificación**: `src/shared/ci/ci-workflow.spec.ts` verifica esto leyendo el YAML del workflow desde disco.

#### Scenario: quality-tauri y build-and-release declaran caché de Cargo
- **WHEN** se inspecciona la configuración de los jobs `quality-tauri` y `build-and-release`
- **THEN** ambos incluyen un paso de caché de Cargo (registro + `target/`)
