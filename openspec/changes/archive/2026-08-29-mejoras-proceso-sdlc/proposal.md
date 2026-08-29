## Why

`memory/metrics/analisis-2026-08-17-2026-08-27.md` (cambio `analisis-metricas-sdlc`, archivado) identificó tres patrones que se repitieron en el proceso de trabajo pese a estar ya documentados en `memory/context.md`, y tres hallazgos de un solo evento con impacto real (rework de un plugin nativo no cableado, un tag de release sobre el commit equivocado, producción caída por variables de entorno no sincronizadas). El propio informe concluía que, para los patrones repetidos, seguir documentando la lección no cambia el comportamiento — hace falta un chequeo automático. Este cambio aplica las seis recomendaciones concretas que el informe dejó propuestas sin implementar.

## What Changes

- **Docker no arrancado** (P1 del informe): nuevo paso en `scripts/pre-commit.sh` que comprueba, justo antes de los tests E2E de Cypress (los únicos pasos locales que dependen de un backend real), que los contenedores `api`/`postgres` de `infra/docker/docker-compose.yml` están arrancados y sanos — falla con un mensaje explícito en vez de dejar que Cypress falle más tarde con un error de conexión genérico.
- **Segundo proceso compitiendo por el puerto 1420** (P2): `.husky/pre-commit` crea un lock (directorio en `.git/`, borrado siempre al terminar, éxito o fallo) antes de invocar `scripts/pre-commit.sh`. Un segundo `git commit` mientras el primero sigue vivo aborta de inmediato con un mensaje explícito en vez de competir por el puerto y producir un fallo espurio.
- **Local en verde ≠ CI en verde, lado Go** (P3): nuevo paso en `scripts/pre-commit.sh` que ejecuta, para `apps/api`, `gofmt` (comparado contra el blob que se va a commitear, no el fichero en working tree — evita el ruido de CRLF ya documentado en Windows), `go vet ./...` y `go build ./...`; más un chequeo nuevo que localiza cada directiva `//go:embed` del código y confirma que su destino está realmente rastreado por git (`git ls-files`), no solo presente en el filesystem local — la causa raíz exacta del fallo de CI de la PR #162.
- **Mock en verde ≠ integración nativa real**: nuevo paso en `scripts/pre-commit.sh` que, por cada paquete `@tauri-apps/plugin-*` en `apps/mobile/package.json`, confirma que existe su crate `tauri-plugin-*` en `Cargo.toml` y que está registrado (`.plugin(tauri_plugin_*::init())`) en `lib.rs` — el gap exacto que causó el rework de `notificaciones-push-fcm`.
- **Tag de release sobre el commit equivocado**: `scripts/tag-release.sh <tag>` nuevo — hace `git fetch origin master` y crea/empuja el tag siempre sobre `origin/master` recién actualizado, nunca sobre el HEAD local de una rama. Sustituye a un `git tag` manual para releases.
- **Variables de entorno no sincronizadas en despliegue**: `scripts/verify-prod-env.sh <example> <real>` nuevo — compara los nombres de clave (nunca los valores) entre un fichero `.env*.example` y un `.env*` real, y falla listando lo que falta. Solo local/CI: no se ejecuta contra el servidor de producción en este cambio (requeriría SSH real, fuera de alcance — queda para cuando se use en un despliegue real).
- **BREAKING para el flujo local de commit**: cada `git commit` no docs-only pasa a tardar más (Go quality gates + verificación de plugins añadidos a la cadena existente) y puede bloquear con un lock si hay un pre-commit ya corriendo. Aceptado explícitamente — es el objetivo del cambio.

## Capabilities

Sin capabilities nuevas ni modificadas — no hay comportamiento observable nuevo en la app (móvil, API o panel web). Es tooling de proceso: hooks de git y scripts de desarrollo/despliegue. `skip_specs: true`.

## Impact

- **Modificado**: `scripts/pre-commit.sh` (nuevos pasos: Go quality gates, plugins nativos, chequeo de Docker — ver `design.md` para el orden exacto), `.husky/pre-commit` (lock file antes de invocar el script).
- **Nuevo**: `scripts/check-go-embed-tracked.sh` (o equivalente, ver design.md), `scripts/check-native-plugins.sh`, `scripts/check-docker-running.sh`, `scripts/tag-release.sh`, `scripts/verify-prod-env.sh`.
- **Leído, no modificado**: `apps/mobile/package.json`, `apps/mobile/src-tauri/Cargo.toml`/`lib.rs`, `apps/api/**/*.go`, `infra/docker/docker-compose.yml`, `infra/docker/.env.prod.example`.
- **Sin impacto en**: `.github/workflows/ci.yml` (CI ya corre estos gates de forma independiente; no se toca), código de `apps/mobile`/`apps/api`/`apps/web`, `CLAUDE.md`, `openspec/config.yaml`.
- **Documentación**: `memory/context.md` gana una entrada sobre los scripts nuevos y cuándo usarlos (`scripts/tag-release.sh` en vez de `git tag` manual). No se toca `CLAUDE.md` en este cambio.
