# Informe Técnico y de Seguridad — Moto Routes

> Auditoría realizada el 2026-08-07. Incluye verificación en vivo del servidor de producción vía SSH por Tailscale.
> Documento de análisis: no altera código ni infraestructura.

---

## 1. Resumen ejecutivo

Moto Routes es una app móvil (Tauri 2 / TypeScript / Rust) para motociclistas con una API backend propia (Go 1.25 + PostgreSQL) desplegada en un servidor Debian 13 doméstico, alcanzable en exclusiva por Tailscale y expuesta públicamente mediante Tailscale Funnel con TLS.

**Puntos fuertes de seguridad:** contraseñas con bcrypt, JWT HS256 firmados, tokens de un solo uso con 256 bits de entropía almacenados como hash SHA-256, rate limiting real en login (verificado en vivo: 5×401 → 429), anti-enumeración de cuentas, sin secretos en el repositorio, superficie de red mínima (UFW deny por defecto, solo interfaz Tailscale), PostgreSQL solo loopback con scram-sha-256, CSP estricta en el cliente, fichero `.env.prod` con permisos 600.

**Hallazgos relevantes de la auditoría en vivo:**

1. **El servidor está desactualizado respecto a `master`**: el contenedor corriendo fue construido el `2026-08-06T19:09Z`; `schema_migrations` llega solo a `0004`; el endpoint `POST/GET /api/routes` (migración `0005`, sesión `rutas-en-la-nube` del 2026-08-07 ya mergeada a `master`) devuelve **404**. Falta redesplegar (`git pull` + `docker compose up -d --build`).
2. El contenedor Docker de la API corre como **root** (no hay `USER` en el `Dockerfile`).
3. El servicio **MinIO** (`minio.service`, loopback `127.0.0.1:9000/9001`) está activo sin documentación ni uso en código (provisión anticipada para blob storage, ya conocida).

---

## 2. Arquitectura general

- **Monorepo** `apps/` con dos aplicaciones:
  - `apps/mobile/` — aplicación móvil/desktop: frontend TypeScript 5.7 strict + Vite 6 + Web Components nativos (Shadow DOM), backend nativo Rust con Tauri 2; targets Android (minSdk 24) y desktop.
  - `apps/api/` — API backend en Go 1.25 (migrada desde Java/Spring Boot, ADR-034).
- **BBDD local (móvil)**: SQLite vía `@tauri-apps/plugin-sql` (`moto-routes.db`).
- **BBDD servidor**: PostgreSQL 17 nativo en el servidor (no en contenedor), escuchando solo en loopback.
- **Orquestación**: `infra/docker/` con `docker-compose.yml` (dev local) y `docker-compose.prod.yml` (producción, `network_mode: host`).
- **Red**: despliegue accesible solo por Tailscale (IP 100.114.190.36, MagicDNS `debian`); exposición pública vía **Tailscale Funnel** (`https://debian.taildf3dab.ts.net`) con TLS gestionado por Tailscale.
- **Metodología**: Spec-Driven Development con OpenSpec (`openspec/`); ADRs en `memory/decisions.md`.

---

## 3. Stack de Frontend (`apps/mobile/`)

| Capa | Tecnología |
|---|---|
| Framework app | **Tauri 2** (`@tauri-apps/api` ^2.0.0) |
| Idioma | TypeScript 5.7 (strict), Rust (edition 2021) |
| Bundler | Vite 6 |
| UI | Web Components nativos (Custom Elements v1, Shadow DOM), sin framework |
| Estilos | CSS con design tokens (`src/shared/styles/tokens.css`), tema "Asfalto Nocturno" |
| Mapa | MapLibre GL ^5.24 (tiles OpenFreeMap) |
| BBDD local | SQLite vía `@tauri-apps/plugin-sql` |
| Fotos | `exifr` (metadatos), plugin-fs, galería/visor propios |
| API externa VE | vPIC (NHTSA) para datos de vehículo (`profile/`) |
| Testing | Vitest 3 (cobertura ≥80%), Cypress 15 (E2E), cargo test/clippy/fmt |
| Lint/Format | ESLint 9 (strictTypeChecked), Prettier 3, rustfmt, Clippy (-D warnings) |
| Plugins Tauri | plugin-fs, plugin-sql |

**Comunicación con la API**: el frontend usa `fetch()` nativo (capa `shared/http/external-api.service.ts` → `fetchJson` con timeout de 8s, errores tipados). El WebView llama a `apps/api` por HTTP/HTTPS cross-origin, con CORS habilitado explícitamente en la API.

---

## 4. Stack de Backend (`apps/api/`)

| Capa | Tecnología |
|---|---|
| Lenguaje | **Go 1.25.0** |
| Router | `go-chi/chi/v5` v5.3.1 |
| Driver BBDD | `jackc/pgx/v5` v5.9.2 (pgxpool) |
| JWT | `golang-jwt/jwt/v5` v5.3.1 |
| Hashing | `golang.org/x/crypto` v0.54.0 (**bcrypt**) |
| Migraciones | Runner propio con `embed.FS` + tabla `schema_migrations` (0001..0005) |
| Email | **Resend** API (dominio `motor-routes.com`) — cliente propio con `net/http`, sin SDK |
| Servidor HTTP | `net/http` estándar + chi, `http.ListenAndServe` |
| Middleware propios | `httpmw.Recover`, `httpmw.PublicCORS`, `auth.RequireAuth`, rate limiters en memoria |

**Endpoints** (registrados en `cmd/api/main.go`):

| Método | Ruta | Autenticación | CORS | Rate limit |
|---|---|---|---|---|
| GET | `/api/ping` | pública | no | no |
| GET | `/api/stop-types` | pública | sí | no |
| POST | `/api/auth/register` | pública | sí | sí (5/15min/email) |
| POST | `/api/auth/login` | pública | sí | sí (5 fallidos/15min) |
| GET | `/api/auth/me` | **Bearer JWT** | sí | no |
| POST | `/api/auth/verify-email/request` | pública | sí | sí (3/15min) |
| GET | `/api/auth/verify-email/confirm` | pública (token en URL) | no | no |
| POST | `/api/auth/reset-password/request` | pública | sí | sí (3/15min) |
| GET/POST | `/api/auth/reset-password/confirm` | pública (token en URL/form) | no | no |
| POST | `/api/routes` | **Bearer JWT** | sí | no |
| GET | `/api/routes` | **Bearer JWT** | sí | no |
| GET | `/api/routes/{id}` | **Bearer JWT** | sí | no |

---

## 5. Cómo se guardan las contraseñas

**(Fuente: `apps/api/internal/auth/password.go`, migraciones SQL)**

- **Algoritmo: bcrypt** (`golang.org/x/crypto/bcrypt`) con `bcrypt.DefaultCost` (coste 10).
- La contraseña **nunca se almacena en claro**: se guarda el hash bcrypt en la columna `password_hash TEXT NOT NULL` de la tabla `users`.
- **Política mínima de complejidad**: longitud mínima de 8 caracteres (`minPasswordLength = 8`), sin reglas de composición (para no empujar a contraseñas predecibles).
- Verificación en login: `bcrypt.CompareHashAndPassword`.
- El hash bcrypt incorpora salt aleatorio por contraseña (genera automáticamente).
- `email` único en la tabla `users`.

**Esquema de `users` (migración 0001 + 0003):**

```sql
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- 0003:
ALTER TABLE users ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT false;
```

---

## 6. Cómo se generan los tokens

### 6.1 Tokens de sesión (JWT)

**(Fuente: `apps/api/internal/auth/token.go`)**

- **Algoritmo**: HS256 (HMAC-SHA256), firma simétrica con secreto `AUTH_TOKEN_SECRET` (variable de entorno, sin valor por defecto).
- **Claims**: `uid` (ID de usuario) + `iat` + `exp`.
- **TTL**: 24 horas (`tokenTTL = 24 * time.Hour`).
- **Verificación**: comprueba método de firma (solo HMAC), firma y expiración; devuelve `uid`.
- **Transmisión**: `Authorization: Bearer <token>` en el header; emitido por `POST /api/auth/login`.
- **Emitido por**: `auth.TokenIssuer{Secret: cfg.TokenSigningKey, TTL: tokenTTL}`.
- Secreto: configurado en `infra/docker/.env.prod` (no versionado), requerido en `config.Load()`.

### 6.2 Tokens de un solo uso (verificación de email y reset de contraseña)

**(Fuente: `apps/api/internal/auth/verification_token.go`, `password_reset_token_store.go`)**

- **Generación**: `crypto/rand` con 32 bytes (256 bits), codificado base64 **URL-safe** (apto para enlaces).
- **Almacenamiento**: se guarda solo el **hash SHA-256** del token (`token_hash`), nunca el token en claro — así un volcado de BBDD no permite canjear tokens ajenos.
- **Verificación de email** (`email_verification_tokens`): TTL **24h**, un solo uso (`used_at`), invalidado al usarse.
- **Reset de contraseña** (`password_reset_tokens`): TTL **1 hora** (más corto que verificación porque da control total de la cuenta), un solo uso.
- Al completar un reset, se verifica además el email si no lo estaba.

---

## 7. Cómo se filtran las llamadas (seguridad de la API)

### 7.1 Autenticación (middleware)

**(Fuente: `apps/api/internal/auth/middleware.go`)**

- `auth.RequireAuth(issuer)` exige cabecera `Authorization: Bearer <token>` válido y no expirado.
- Si falta, está malformado, expirado o la firma no es válida → `401 Unauthorized` con mensaje genérico `missing or invalid token` (no revela el motivo concreto).
- Deja el `userID` en el contexto para los handlers (`UserIDFromContext`).
- Endpoints protegidos: `/api/auth/me`, `/api/routes*`. Rutas `OPTIONS` para CORS preflight van sin el middleware (no llevan token).

### 7.2 CORS

**(Fuente: `apps/api/internal/httpmw/cors.go`)**

- `PublicCORS`: `Access-Control-Allow-Origin: *`, métodos `GET, POST, OPTIONS`, headers `Content-Type, Authorization`.
- Responde `204` a preflight `OPTIONS`.
- Justificación documentada: con **auth por Bearer header** (no por cookie), `*` es seguro — el navegador no adjunta el token automáticamente; solo viaja si el propio JS lo pone. El proyecto **no usa cookies de sesión**.
- El WebView de Tauri en `localhost:1420` (dev) y `tauri://localhost` (prod) puede llamar a `apps/api` cross-origin.

### 7.3 Rate limiting

**(Fuente: `apps/api/internal/auth/ratelimit.go`, `login.go`)**

- **En memoria** (mapa + mutex, single instance). Limitaciones conocidas: se pierde al reiniciar y no escala a réplicas (aceptado, ADR-034).
- Login: **5 intentos fallidos por email cada 15 min** → `429 Too Many Requests`.
- Registro: 5 intentos / 15 min / email. Verificación: 3 / 15 min. Reset password request: 3 / 15 min.
- **Verificado en vivo durante esta auditoría**:

```
# 7 intentos de login con email inexistente:
401 401 401 401 401 429 429
```

- El rate limiter solo cuenta **fallos** (status 401). Registro cuenta todos los intentos.

### 7.4 Anti-enumeración de cuentas

- **Login**: email inexistente y contraseña incorrecta devuelven el **mismo error** `invalid email or password` (401).
- **Registro**: email duplicado devuelve 409 `email already registered` (revela que existe — debilidad conocida y mitigada con rate limit; decisión documentada en config de OpenSpec).
- **Reset password / verificación**: responden **éxito genérico siempre**, exista o no la cuenta (no revela si el email está registrado).
- **Login con email sin verificar**: 403 `email not verified...` (solo se revela tras haber demostrado conocer la contraseña).

### 7.5 Validación de entrada y errores

- Validación de email y política de contraseña en `register`.
- Errores internos devuelven 500 genérico `could not process the request` (no filtran internals).
- `httpmw.Recover` global para controlar pánicos.

### 7.6 Configuración de secretos

**(Fuente: `apps/api/internal/config/config.go`)**

- 100% desde variables de entorno. **Obligatorias** (arranque falla si faltan):
  - `DATABASE_URL` (DSN PostgreSQL)
  - `AUTH_TOKEN_SECRET` (clave de firma JWT)
  - `RESEND_API_KEY`
  - `RESEND_FROM_ADDRESS`
  - `PUBLIC_API_BASE_URL` (validada con prefijo `https://`)
  - `SERVER_ADDRESS` (default `0.0.0.0:8080`; en producción IP Tailscale)
- Sin valores por defecto para secretos; sin secretos en código versionado.

---

## 8. Seguridad del servidor de producción (verificación en vivo por SSH vía Tailscale)

Fecha de la verificación: 2026-08-07. Acceso: `ssh gonzalo@debian` (Tailscale SSH, sin SSH tradicional expuesto).

### 8.1 Red y firewall

- **UFW activo**, política por defecto: `deny (incoming)`, `allow (outgoing)`, `deny (routed)`.
- Única regla de entrada: `ALLOW IN` en interfaz `tailscale0`.
- **Puertos en escucha** (verificado con `ss -tlnp`):
  - `100.114.190.36:8080` → la API (solo IP Tailscale, **no** LAN ni 0.0.0.0).
  - `100.114.190.36:443` y `[fd7a:...]:443` → Funnel de Tailscale (TLS).
  - `127.0.0.1:5432` y `[::1]:5432` → PostgreSQL (solo loopback).
  - `127.0.0.1:9000/9001` → MinIO (solo loopback).
  - `127.0.0.1:631` → CUPS (local).

### 8.2 Exposición pública

- **Tailscale Funnel activo**: `https://debian.taildf3dab.ts.net` → proxy a `http://100.114.190.36:8080` (verificado: `GET /api/ping` → 200 a través de la URL pública de Funnel).
- La IP del tailnet (`100.114.190.36`) es privada (CGNAT). Sin Funnel un usuario fuera del tailnet no podría acceder (decisión ADR-033/036).

### 8.3 PostgreSQL

- Versión nativa: PostgreSQL 17.10 (Debian), no contenedor.
- `pg_hba.conf`: conexiones TCP solo en loopback (`127.0.0.1/32`, `::1/128`) con **`scram-sha-256`**; acceso local con `peer`.
- Usuario `appuser` y BBDD `appdb` creados por el usuario para el despliegue.
- Escuchando solo en 127.0.0.1 y ::1.

### 8.4 Contenedor de la API

- Imagen: `docker-api` (local), contenedor `docker-api-1`.
- `network_mode: host` → usa directamente la interfaz Tailscale; el puerto 8080 aparece en `100.114.190.36:8080`.
- `restart: unless-stopped`.
- Entorno (nombres de variables, no valores): `AUTH_TOKEN_SECRET`, `DATABASE_URL`, `PUBLIC_API_BASE_URL`, `RESEND_API_KEY`, `RESEND_FROM_ADDRESS`, `SERVER_ADDRESS`.
- **Hallazgo**: el `Dockerfile` no define `USER` → el proceso corre como root dentro del contenedor (mejora recomendada: usuario no-root).
- **Dockerfile multi-stage**: `golang:1.25-trixie` (build, CGO_ENABLED=0) → `debian:trixie-slim` + `ca-certificates` (runtime). Binario estático.

### 8.5 Ficheros de secretos

- `infra/docker/.env.prod` en el servidor: permisos `-rw-------` (600), correcto.
- `.env.prod.example` versionado con placeholders; `.env.prod` **no** está en git.
- No se encontraron secretos reales en ficheros versionados.

### 8.6 Migraciones aplicadas (estado actual del servidor)

| Migración | Estado |
|---|---|
| 0001_create_users.sql | ✅ aplicada |
| 0002_create_stop_types.sql | ✅ aplicada |
| 0003_add_email_verification.sql | ✅ aplicada |
| 0004_add_password_reset.sql | ✅ aplicada |
| **0005_create_routes.sql** | ❌ **NO aplicada** (servidor con imagen de 2026-08-06, anterior al merge) |

**Consecuencia directa verificada**: `GET /api/routes` devuelve **404** en el servidor actual. El frontend en producción espera este endpoint (rondas de `rutas-en-la-nube`). **Acción pendiente: redesplegar.**

### 8.7 Servicios activos (verificado)

- `docker.service` ✅
- `postgresql@17-main.service` ✅
- `minio.service` ✅ (loopback 9000/9001) — sin documentar en ADRs, sin consumidor en código.
- `tailscaled` ✅ (Funnel en `:443`)

### 8.8 Estado de datos

- Tabla `users`: **0 registros** (sin cuentas de prueba residuales).

---

## 9. Seguridad del frontend / cliente

### 9.1 CSP estricta

**(Fuente: `apps/mobile/index.html`, `src-tauri/tauri.conf.json`)**

```text
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: asset: https://asset.localhost https://tiles.openfreemap.org;
connect-src 'self' ipc: http://ipc.localhost https://tiles.openfreemap.org https://vpic.nhtsa.dot.gov http://localhost:8080;
worker-src 'self' blob:;
font-src 'self'
```

- **Sin `unsafe-eval`**, sin `unsafe-inline` en scripts (sí en styles para Shadow DOM).
- `connect-src` limita dominios de red: tiles, vPIC, y la API. En producción el host real de la API se inyecta vía `--config` en CI (secret `MOBILE_PROD_API_BASE_URL`), nunca versionado.
- `assetProtocol` acotado a `$APPDATA/photos/*`.

### 9.2 Layer HTTP del cliente

`fetchJson` (`src/shared/http/external-api.service.ts`):

- Timeout de 8 s con `AbortController`.
- Errores tipados: `network`, `timeout`, `invalid-json`, `http-error` (solo con `checkStatus: true`).
- Los servicios de auth (`auth-api.service.ts`) y rutas en la nube (`route-cloud-api.service.ts`) mandan el token en `Authorization: Bearer`.

### 9.3 Persistencia de sesión en cliente

- SQLite local (`sqlite-session.repository.ts`) con tabla `session` (fila única), o `MemorySessionRepository` en web.
- En Tauri real se usa `@tauri-apps/plugin-sql` (sesión persistente entre reinicios).
- Al recibir `401` se limpia la sesión local.

---

## 10. Comunicación app → API (cómo se alcanza el backend)

1. **Base URL**: `getApiBaseUrl()` → `VITE_API_BASE_URL` (inyectada en build) o default `http://localhost:8080` en dev.
2. **En producción (release CI)**: se inyecta `https://debian.taildf3dab.ts.net` (Funnel) como `VITE_API_BASE_URL` y en `connect-src` del CSP.
3. **Rutas autenticadas** (`/api/auth/me`, `/api/routes*`): header `Authorization: Bearer <jwt>`.
4. **CORS**: la API responde con `Access-Control-Allow-Origin: *`, permitiendo al WebView `tauri://localhost` hacer fetch.
5. Protocolo: HTTPS en producción (Funnel), HTTP en dev local.

---

## 11. Recomendaciones y hallazgos priorizados

| # | Hallazgo | Severidad | Acción recomendada |
|---|---|---|---|
| 1 | **Servidor desactualizado**: falta migración 0005, `/api/routes` → 404 | 🔴 Alta | Redesplegar `master` en el servidor (`git pull && docker compose up -d --build`) |
| 2 | Contenedor API corre como **root** | 🟠 Media | Añadir `USER` no-root en `Dockerfile` |
| 3 | **MinIO** activo sin documentación ni uso | 🟡 Baja | Documentar ADR (¿provisión anticipada para blob storage?) o deshabilitar |
| 4 | Rate limiting en memoria | 🟡 Baja | Aceptable hoy (1 instancia); revisar si se escala a réplicas |
| 5 | `CORS: *` con auth por Bearer | 🟢 Info | Seguro actualmente (sin cookies); revisar si algún día se usan cookies |
| 6 | Registro revela email duplicado (409) | 🟢 Info | Decisión ya documentada; mitigada con rate limit |
| 7 | Despliegue manual sin automatizar | 🟡 Baja | Documentado (ADR-033); considerar script versionado |

---

## 12. Referencias

- ADRs relevantes: ADR-029 (flujo git), ADR-030 (Project), ADR-031 (CI/CD), ADR-032 (monorepo), ADR-033 (despliegue Tailscale), ADR-034 (migración Go + seguridad), ADR-035 (catálogo/CORS), ADR-036 (release rota/Funnel), ADR-037 (GPS), ADR-038 (verificación email + Resend), ADR-039 (reset contraseña), ADR-040 (rutas en la nube).
- `docs/06-seguridad.md` — políticas documentadas del proyecto.
- `apps/api/internal/...` — código de autenticación, tokens, CORS, rate limiting.
- `memory/context.md` — estado del proyecto y lecciones aprendidas.