# 02 · Stack tecnológico, lenguajes y versiones

## Visión general por aplicación

| Ámbito | Tecnología / Lenguaje |
|--------|----------------------|
| Frontend móvil | TypeScript 5.7 (strict) + Vite 6 + Web Components nativos |
| Backend móvil/desktop | Rust (stable, edition 2021) + Tauri 2 |
| API backend | Go 1.25 (chi, pgx/v5) |
| BBDD backend | PostgreSQL 16 (imagen `postgres:16-trixie`) |
| BBDD local móvil | SQLite vía `@tauri-apps/plugin-sql` |
| Gestores de paquetes | pnpm (workspace `apps/mobile`) + Cargo + Go modules |
| Orquestación local | Docker Compose |
| CI/CD | GitHub Actions |

## `apps/mobile/` — App móvil

### Dependencias de producción (`package.json`)

| Paquete | Versión | Uso |
|---------|---------|-----|
| `@tauri-apps/api` | ^2.0.0 | API JS de Tauri (invoke, event, window) |
| `@tauri-apps/plugin-dialog` | ^2.7.2 | Diálogos nativos (guardar/abrir) |
| `@tauri-apps/plugin-fs` | ^2.5.1 | Acceso al filesystem (fotos en `$APPDATA/photos`) |
| `@tauri-apps/plugin-notification` | ^2.3.3 | Notificaciones locales |
| `@tauri-apps/plugin-sql` | ^2.4.0 | SQLite |
| `exifr` | ^7.1.3 | Lectura de metadatos EXIF de las fotos |
| `maplibre-gl` | ^5.24.0 | Mapa (tiles de OpenFreeMap) |

> Hay un **plugin propio de cámara** (`@tauri-apps/plugin-camera`, en
> `src/shared/tauri-plugins/plugin-camera`) implementado internamente porque Tauri no trae un plugin
> de cámara oficial — se expone igual que un paquete npm mediante alias en `vite.config.ts` y
> `tsconfig.json`.

### Dependencias de desarrollo

| Paquete | Versión | Uso |
|---------|---------|-----|
| `@tauri-apps/cli` | ^2.0.0 | CLI de Tauri (dev/build/android) |
| `@testing-library/cypress` | ^10.1.3 | Helpers de testing E2E |
| `@types/node` | ^26.1.1 | Tipos Node |
| `@vitest/coverage-v8` | ^3.0.0 | Cobertura de tests |
| `cypress` | ^15.19.0 | Tests E2E |
| `eslint` | ^9.0.0 | Linting |
| `eslint-plugin-jsdoc` | ^63.3.2 | JSDoc obligatorio en exports |
| `jsdom` | ^25.0.0 | Entorno de tests Vitest |
| `prettier` | ^3.0.0 | Formato |
| `start-server-and-test` | ^3.0.11 | Levanta Vite para Cypress |
| `typescript` | ^5.7.0 | Compilador |
| `typescript-eslint` | ^8.0.0 | ESLint para TS |
| `vite` | ^6.0.0 | Bundler |
| `vitest` | ^3.0.0 | Tests unitarios |
## `apps/api/` — API backend (Go)

| Dependencia | Versión | Uso |
|-------------|---------|-----|
| `github.com/go-chi/chi/v5` | v5.3.1 | Router HTTP |
| `github.com/golang-jwt/jwt/v5` | v5.3.1 | Tokens JWT de sesión |
| `github.com/google/uuid` | v1.6.0 | UUIDs |
| `github.com/jackc/pgx/v5` | v5.9.2 | Driver PostgreSQL |
| `github.com/minio/minio-go/v7` | v7.2.1 | Cliente S3/MinIO (fotos) |
| `golang.org/x/crypto` | v0.54.0 | bcrypt |
| `golang.org/x/oauth2` | v0.36.0 | OAuth2 para FCM (cuenta de servicio) |

- `go.mod` declara `go 1.25.0`; el CI usa Go **1.26.6**.

## Rust (`src-tauri/Cargo.toml`)

| Crate | Versión | Uso |
|-------|---------|-----|
| `tauri` | 2 (feature `protocol-asset`) | Framework |
| `tauri-build` | 2 | Build script |
| `tauri-plugin-opener` | 2 | Abrir enlaces |
| `tauri-plugin-log` | 2 | Logging |
| `tauri-plugin-sql` | 2 (feature `sqlite`) | SQLite |
| `tauri-plugin-fs` | 2 | Filesystem |
| `tauri-plugin-notification` | 2 | Notificaciones |
| `tauri-plugin-dialog` | 2 | Diálogos |
| `serde` / `serde_json` | 1 | (De)serialización |
| `thiserror` | 2 | Errores tipados |
| `tracing` / `tracing-subscriber` | 0.1 / 0.3 | Logging |

Perfil `release`: `panic = abort`, `codegen-units = 1`, `lto = true`, `opt-level = "s"`,
`strip = true` (bundle minificado, sin símbolos).

## Configuración Tauri

- `identifier`: `com.motoroutes.app`; `productName`: "Moto Routes".
- Ventana: 400×800 (mín. 360×640).
- **CSP estricta** (sin `unsafe-eval`/`unsafe-inline` en script), `assetProtocol` con scope
  `$APPDATA/photos/**`.
- Android: `minSdkVersion` 24.

## Raíz del monorepo (`package.json`)

Solo scripts de documentación transversal + Husky (sin dependencias de la app):

| Paquete | Versión | Uso |
|---------|---------|-----|
| `husky` | ^9.0.0 | Git hooks |
| `typedoc` | ^0.28.20 | Documentación de API TS |
| `typedoc-plugin-coverage` | ^4.0.3 | Umbral de cobertura de docs |
| `vitepress` | 1.6.4 | Sitio de documentación |

## Overrides de seguridad (`pnpm-workspace.yaml`)

El workspace fija versiones parcheadas por encima de lo que traen los consumidores, para eliminar
vulnerabilidades conocidas sin esperar a que se propaguen: `postcss 8.5.25`, `vite ^6.4.3`,
`brace-expansion` (1.1.18 / 2.1.4 / 5.0.9 por major del padre), `js-yaml ^4.3.1`, `nanoid ^3.3.17`.
El detalle y los GHSA asociados están comentados en el propio fichero.

## Android (nativo, generado por Tauri)

| Elemento | Versión |
|----------|---------|
| `compileSdk` / `targetSdk` | 36 |
| `minSdk` | 24 |
| NDK | r29 (`29.0.13846066`) |
| JDK en CI | 17 (Temurin) |
| Kotlin | vía AGP (plugin `org.jetbrains.kotlin.android`) |
| `androidx.webkit` | 1.14.0 |
| `play-services-location` | 21.3.0 |
| `firebase-bom` | 34.9.0 (+ `firebase-messaging`) |

Plugins de Gradle Android: `com.android.application`, `org.jetbrains.kotlin.android`, `rust` (Tauri)
y `com.google.gms.google-services` (Firebase).

## Servicios / infraestructura

| Servicio | Imagen / tecnología |
|----------|---------------------|
| PostgreSQL | `postgres:16-trixie` |
| MinIO | `minio/minio` (S3 compatible) |
| OSRM | `ghcr.io/project-osrm/osrm-backend` (map matching) |
| Resend | API REST de email (sin SDK) |
| FCM | Firebase Cloud Messaging (HTTP v1, sin SDK Admin) |
| vPIC | API de NHTSA para marcas/modelos de vehículos |
| Mapas | tiles de `https://tiles.openfreemap.org` |

## Lenguajes de programación

| Lenguaje | Uso | Detalle |
|----------|-----|---------|
| TypeScript | Frontend (Web Components) | 5.7, strict, `noUncheckedIndexedAccess`, tipos estrictos |
| Rust | Backend nativo Tauri | stable, edition 2021 |
| Go | API backend | 1.25 (CI 1.26.6) |
| Kotlin | Capa nativa Android (FCM, notificaciones) | generado en `gen/android/` |
| SQL | Migraciones (PostgreSQL) y esquemas SQLite | — |
| HTML/CSS | Plantillas y estilos (Shadow DOM + design tokens) | — |

