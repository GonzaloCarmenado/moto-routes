## Why

El único workflow de CI que existe (`.github/workflows/docs.yml`) falla siempre (falta de dependencias de sistema para `cargo doc` en el target desktop, sin relación con este cambio) y no ejecuta ningún gate de calidad. Todo el enforcement real del proyecto — ESLint, `tsc`, Vitest con cobertura, Clippy, `cargo fmt`, `cargo test`, auditoría de dependencias, Cypress E2E — vive únicamente en `.husky/pre-commit`, que se puede saltar con `--no-verify` (permiso que ya existe en el repo) y que además nunca se ejecuta sobre el código de otros colaboradores hasta que hacen `git commit` en su propia máquina. La ADR-021 ya documentó un caso real de gates rotos sin detectar durante semanas (`clippy.toml` con una clave inválida, iconos placeholder que rompían la build de Windows) precisamente porque no había ninguna verificación server-side independiente del entorno de quien commiteaba. Además, `master` no tiene branch protection (confirmado en la sesión de ADR-029): nada impide mergear una PR con gates en rojo.

Se necesita un CI real en GitHub Actions que replique los gates del pre-commit de forma determinista en un runner limpio, más un pipeline de release que compile y publique el APK de Android — hoy un proceso 100% manual y sujeto a los gotchas de la máquina local de desarrollo (documentados en `memory/context.md` § Build Android).

## What Changes

- **Un único workflow `.github/workflows/ci.yml` con 3 jobs** (no 3 ficheros separados: GitHub Actions solo permite `needs:` — la dependencia real entre "quality gates" y "release" — dentro del mismo fichero; entre ficheros distintos habría que usar `workflow_run`, más lento y frágil, lo contrario de "eficiente"). Cada job sigue teniendo su propio informe/check independiente en la PR — eso no depende de estar en ficheros separados.
  - **Job `quality-ts`**: en cada push y PR — `tsc --noEmit`, `pnpm run docs:coverage` (umbral 70% ya definido en `scripts/docs-coverage.mjs`), `eslint --max-warnings 0`, `vitest run --coverage` (umbral 80% ya en `vitest.config.ts`), `pnpm run test:e2e` (Cypress, 39 specs). Cache de pnpm vía `actions/setup-node` (mismo patrón que ya usa `docs.yml`).
  - **Job `quality-tauri`**: en cada push y PR — `cargo fmt --check`, `cargo clippy -- -D warnings`, `cargo test`, `cargo audit --ignore RUSTSEC-2023-0071` (misma excepción documentada que ya usa `.husky/pre-commit`). Cache de Cargo (registry + target) vía acción dedicada de caché de Rust.
  - **Job `build-and-release`**: `needs: [quality-ts, quality-tauri]` + `if:` acotado a tags `v*` — instala Android SDK/NDK/Rust target `aarch64-linux-android`, compila el APK con `pnpm tauri android build --target aarch64 --debug` (mismo comando que en local — nunca `cargo build` manual, ver `memory/context.md`), y lo publica como asset de un GitHub Release. Corre en `ubuntu-latest`.
- **Corrección necesaria en `src-tauri/.cargo/config.toml`**: el linker de `aarch64-linux-android` está hardcodeado a una ruta absoluta de Windows de esta máquina en concreto (`D:\Android\Sdk\ndk\...`) — inservible en cualquier runner. Se resuelve sobreescribiendo `CARGO_TARGET_AARCH64_LINUX_ANDROID_LINKER` como variable de entorno del workflow, sin tocar el fichero (sigue haciendo falta tal cual para builds locales en esta máquina).
- **`docs.yml` no se toca en este cambio** — su fallo (dependencias de sistema para el target desktop) es preexistente y no forma parte de esta propuesta; si se aborda, es un cambio aparte.

**Fuera de alcance** (confirmado con el usuario): firma de release con keystore real — el release usa el mismo APK debug que ya se genera en local, sin secretos nuevos que gestionar. Limitación aceptada: cada build en un runner efímero genera un keystore de debug distinto, así que `adb install -r` sobre una instalación previa de un release anterior puede fallar por incompatibilidad de firma (hay que desinstalar entre releases) — documentado, no se resuelve aquí.

## Capabilities

### New Capabilities
- `ci-cd`: pipeline de integración continua (gates de calidad TS/Tauri en cada push/PR) y de entrega continua (build + release del APK Android en tags de versión).

### Modified Capabilities
(ninguna — no hay spec-level behavior de la aplicación afectado; es tooling de CI/CD)

## Impact

- `.github/workflows/ci.yml` — nuevo, 3 jobs (`quality-ts`, `quality-tauri`, `build-and-release`).
- `src-tauri/.cargo/config.toml` — sin cambios (se sobreescribe vía env var en el workflow, no en el fichero).
- `docs/` — posible mención nueva del pipeline de CI/CD en la documentación navegable (`docs/06-seguridad.md` ya referencia el pre-commit; puede necesitar una nota de que ahora también corre en CI).
- `memory/context.md` / `memory/decisions.md` — nueva entrada de sesión y ADR si el diseño toma alguna decisión de arquitectura relevante (p. ej. versionado del release, gestión del `versionCode` de Android en CI).
- Sin cambios en `src/`, `src-tauri/src/` ni en el comportamiento de la app — es tooling puro.
