# 11 · Inicialización en local

Guía paso a paso para levantar **Moto Routes** en una máquina nueva. Los comandos están escritos para
Windows/PowerShell (entorno actual del proyecto), salvo los scripts que son Bash (se ejecutan con
Git Bash / WSL).

## 1. Requisitos previos

| Herramienta | Versión de referencia | Notas |
|-------------|----------------------|-------|
| Node.js | 24 (CI usa 24) | |
| pnpm | 11 (CI usa 11) | `corepack enable` o `npm i -g pnpm@11` |
| Rust | stable (toolchain `stable`) | con `clippy` y `rustfmt` |
| Go | 1.25+ (CI usa 1.26.6) | para `apps/api` |
| Docker + Docker Compose | reciente | para la infraestructura local |
| Git | reciente | |
| *(solo Android)* Android SDK/NDK | NDK r29 (`29.0.13846066`), SDK 36 | ver `src-tauri/.cargo/config.toml` |
| *(solo Android)* JDK | 17 (Temurin en CI) | local: gotcha con JBR autoactualizado a Java 25 → apuntar `JAVA_HOME` a un JDK 17/24 |
| *(solo Android)* Tailscale | cliente instalado | para acceder a la API de producción en un móvil real |

## 2. Clonar e instalar dependencias (frontend/móvil)

```powershell
git clone <repo-url> moto-routes
cd moto-routes

# Instala las dependencias del workspace (raíz + apps/mobile) con el lockfile
pnpm install --frozen-lockfile

# (opcional, para documentación) instala también está en el workspace de la raíz
```

El workspace pnpm (`pnpm-workspace.yaml`) incluye `apps/mobile` y `apps/web`; el `package.json` de la
raíz solo gestiona `docs:*` y `husky`.

## 3. Levantar la infraestructura (Postgres + MinIO + API)

```powershell
cd infra/docker

# 1) Crear el .env local desde la plantilla (valores de desarrollo ya incluidos)
cp .env.example .env

# 2) Generar la clave de cifrado de fotos (requisito para que la API arranque)
#    En PowerShell:
$key = [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Max 256 }))
#    o en Git Bash: openssl rand -base64 32
#    y poner el resultado en PHOTO_ENCRYPTION_KEY= dentro de .env

# 3) Levantar los servicios
docker compose up -d --build
```

Servicios levantados: `postgres` (5432), `minio` (9000/9001), `minio-init` (crea el bucket), `api`
(8080). `osrm` arranca solo si existe el extracto OSM en `infra/docker/osrm/data/` (opcional).

Comprobar que la API responde:

```powershell
curl.exe -sf http://localhost:8080/api/ping
```

## 4. Arrancar la app móvil (desarrollo)

```powershell
cd apps/mobile

# Solo el frontend (Vite en http://localhost:1420)
pnpm dev

# O la app Tauri completa (desktop):
pnpm tauri:dev

# Android (emulador/dispositivo):
pnpm tauri:android
```

Para que la app hable con la API local, el valor por defecto ya es
`VITE_API_BASE_URL=http://localhost:8080` (plantilla en `apps/mobile/.env.example`). Si necesitas otro
host, crea `apps/mobile/.env.local` (no versionado).

## 4b. Arrancar el panel web (desarrollo)

```powershell
cd apps/web
pnpm dev   # Vite en http://localhost:4200
```

`vite.config.ts` reenvía `/api` y `/admin` a `http://localhost:8080` (la API local del paso 3) vía
`server.proxy` — sin CORS en ningún entorno, mismo origen que en producción (donde `apps/web` se sirve
directamente desde el binario de `apps/api` bajo `/dashboard/`, ver 05-backend-api-go.md). Para apuntar
a otra API, sobrescribe `WEB_DEV_API_PROXY_TARGET` como variable de entorno antes de `pnpm dev`.

## 5. Tests, lint y build

Desde `apps/mobile/`:

```powershell
pnpm test            # Vitest (unitarios)
pnpm test:coverage   # Vitest con cobertura (umbral 80%)
pnpm test:e2e        # Cypress (levanta Vite y usa la API local de Docker)
pnpm lint            # ESLint
pnpm format          # Prettier
pnpm build           # tsc + vite build
pnpm rust:test       # cargo test
pnpm rust:lint       # cargo clippy -- -D warnings
pnpm rust:format     # cargo fmt --check
```

Desde `apps/web/` (mismos comandos que `apps/mobile`, sin los de Rust/Tauri):

```powershell
pnpm test            # Vitest (unitarios)
pnpm test:coverage   # Vitest con cobertura (umbral 80%)
pnpm test:e2e        # Cypress (levanta Vite; en modo web sin sesión no llama a la API)
pnpm lint            # ESLint
pnpm build           # tsc + vite build
```

Desde `apps/api/`:

```powershell
go test ./...       # unit + integración (requiere DATABASE_URL y MinIO, ver ci.yml)
go build ./...
go vet ./...
```

El hook de pre-commit (Husky) ejecuta **toda** la suite de calidad automáticamente al commitear
(auditorías + ESLint + Vitest + Clippy + rustfmt + cargo test + Cypress).

## 6. Scripts disponibles (raíz)

| Script | Uso |
|--------|-----|
| `pnpm docs` | Genera la documentación (VitePress + TypeDoc + cargo doc) |
| `scripts/deploy-prod.sh` | Despliega a producción por SSH (desde máquina de desarrollo) |
| `scripts/deploy-local.sh` | Despliega ejecutándose dentro del servidor (shell de `ci-deploy`) |
| `apps/mobile/scripts/setup-android.sh` | Prepara el entorno Android |
| `apps/mobile/scripts/install-android.sh` | Compila e instala el APK en el dispositivo |
| `apps/mobile/scripts/pull-db.ps1/.cmd` | Exporta/inspecciona la SQLite del dispositivo |

## 7. Build de producción (APK Android)

```powershell
cd apps/mobile

# Requiere ANDROID_HOME/NDK configurados y JAVA_HOME a un JDK válido (17/24)
pnpm tauri android build --target aarch64
```

En CI (recomendado para releases) este build lo hace `build-and-release`, inyectando
`google-services.json` y el host real de la API desde secrets, y publicando el APK como GitHub
Release. Ver 10-ci-cd-github-actions.md.

## 8. Gotchas conocidos (documentados en `memory/context.md`)

- **Android**: apuntar `JAVA_HOME` a un JDK compatible (JBR de Android Studio se autoactualiza a
  Java 25 y rompe Gradle). NDK r29 y `minSdk 24`.
- `pnpm tauri android build` a veces no recopia `dist/` dentro de `gen/android/.../assets`; en CI se
  fuerza la sincronización de assets y se verifica el hash del bundle empaquetado.
- La clave de cifrado de fotos (`PHOTO_ENCRYPTION_KEY`) debe ser de 32 bytes en base64.
- Para desarrollo local no hace falta una cuenta real de Resend ni un proyecto Firebase: ambos son
  best-effort/opcionales (ver 07 y 05).
