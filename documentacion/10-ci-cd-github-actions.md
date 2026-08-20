# 10 · CI/CD — GitHub Actions

Dos workflows en `.github/workflows/`: `ci.yml` y `docs.yml`.

## `ci.yml` (CI + build + release + deploy)

Disparadores: `push` a `master`, `push` de tags `v*`, y `pull_request` a `master`. Concurrencia:
cancela runs en curso solo en PRs.

### Jobs

| Job | Nombre | Cuándo | Qué hace |
|-----|--------|--------|----------|
| `quality-ts` | Quality gates — TypeScript | push/PR | Instala deps (pnpm 11, Node 24), cachea binario Cypress, cobertura de docs (TypeDoc ≥70%), `tsc --noEmit`, ESLint (`--max-warnings 0`), Vitest con cobertura, levanta `apps/api` real en Docker y ejecuta Cypress E2E, y para el contenedor |
| `quality-tauri` | Quality gates — Tauri (Rust) | push/PR | Instala deps Linux de Tauri, Rust stable, cache, `cargo fmt --check`, Clippy (`-D warnings`), `cargo test`, `cargo audit` (con 2 excepciones documentadas) |
| `quality-go` | Quality gates — Go | push/PR | Postgres service (16-trixie), Go 1.26.6, `gofmt --check`, `go vet`, `go build`, levanta MinIO con `docker run`, `go test ./...` (con `DATABASE_URL`/`MINIO_*`), `govulncheck` |
| `build-and-release` | Build & release Android APK | solo tags `v*` (needs: los 3 quality) | NDK r29, JDK 17, Rust target `aarch64-linux-android`, inyecta `google-services.json` y el host de API desde secrets, fija la versión desde el tag, `pnpm tauri android build --target aarch64`, verifica assets frescos, tamaño ≤20MB, versionName, sin sourcemaps, y publica GitHub Release con el APK |
| `deploy-prod` | Deploy apps/api to production | solo tags `v*` (needs: `quality-go`) | Se une a la tailnet con `tailscale/github-action` (tag `tag:ci-deploy`) y ejecuta `scripts/deploy-local.sh` por SSH al usuario restringido `ci-deploy` |

### Entorno de aprobación

`deploy-prod` usa `environment: prod` → exige la **aprobación manual de un revisor** en GitHub
(Settings > Environments) antes de tocar el servidor; ningún secret está disponible hasta esa
aprobación.

### Secrets de GitHub utilizados

| Secret | Uso |
|--------|-----|
| `MOBILE_PROD_API_BASE_URL` | Host real de `apps/api` horneado en el bundle JS y en la CSP del APK release |
| `GOOGLE_SERVICES_JSON_BASE64` | `google-services.json` (Firebase) en base64, inyectado al build Android |
| `CLIENTID` / `CLIENTSECRET` | OAuth de Tailscale para unir el runner efímero a la tailnet |
| `PROD_SERVER_HOST` | Host del servidor para el SSH del job `deploy-prod` |

> Ningún secret se expone en el repo; solo se referencian por nombre.

### Firma del APK

El APK release se firma con el **keystore de depuración efímero** generado en el runner (sin firma de
release real — ADR-031). Actualizar una instalación previa puede requerir desinstalar antes por el
keystore que rota entre runners.

## `docs.yml` (documentación)

- Disparadores: `push` a `master` y PRs.
- Instala deps (pnpm 11, Node 24), deps Linux de Tauri, `Swatinem/rust-cache`, y ejecuta
  `pnpm run docs` (VitePress + TypeDoc + cargo doc).

## Relación con el pre-commit local

`ci.yml` replica en un runner limpio los mismos gates de `.husky/pre-commit` (auditorías + ESLint +
Vitest + Clippy + rustfmt + cargo test + Cypress) más el build y publicación del APK. Los jobs de
calidad son el gate visible en cada PR (junto con la disciplina documentada de rama + PR de ADR-029).
