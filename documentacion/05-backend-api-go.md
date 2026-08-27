# 05 · Backend — API Go (`apps/api/`)

API HTTP en **Go**, con router `chi`, driver `pgx/v5` para PostgreSQL, JWT para sesiones y bcrypt
para contraseñas. Migrada desde Java/Spring Boot (ADR-034); el histórico Java solo vive en el git log
y las ADR.

## Estructura interna

```
apps/api/
├── cmd/api/main.go          # Entry point: wiring de handlers/middleware y rutas
├── Dockerfile                # Multi-stage: golang:1.25-trixie → debian:trixie-slim
├── go.mod / go.sum
└── internal/
    ├── achievements/         # Logros (check + listado)
    ├── apihttp/              # Helpers HTTP comunes
    ├── auth/                 # Registro, login, verificación email, reset contraseña, JWT, rate limit
    ├── config/               # Carga de configuración desde variables de entorno
    ├── dbtest/               # Tests de integración aislados por schema
    ├── email/                # Envío vía Resend (API REST, sin SDK)
    ├── httpmw/               # Middleware (CORS, recover)
    ├── mapmatch/             # Cliente OSRM (normalización de puntos GPS)
    ├── migrate/              # Migraciones embebidas (embed.FS)
    ├── notifications/        # FCM (push) + store de device tokens
    ├── photos/               # Fotos (cifrado AES-256 + MinIO blob store)
    ├── ping/                 # Health check
    ├── routes/               # Rutas (upsert, list, detail, GPX export)
    ├── routesharing/         # Compartir ruta (invitaciones)
    ├── secretscan/           # Test que detecta secretos hardcodeados
    ├── stoptypes/            # Catálogo de tipos de parada
    └── webui/                # Sirve el build de apps/web (dashboard-reporting) vía embed.FS
```

## Endpoints

| Método  | Ruta                                                             | Descripción                                         | Auth |
| -------- | ---------------------------------------------------------------- | ---------------------------------------------------- | ---- |
| GET      | `/api/ping`                                                    | Health check (incluye estado de Postgres)            | —   |
| GET      | `/api/stop-types`                                              | Catálogo de tipos de parada                         | —   |
| POST     | `/api/auth/register`                                           | Registro (+ envía verificación, rate-limited)      | —   |
| POST     | `/api/auth/login`                                              | Login (exige email verificado), emite JWT (TTL 24h)  | —   |
| GET      | `/api/auth/me`                                                 | Perfil del usuario autenticado                       | JWT  |
| POST     | `/api/auth/verify-email/request`                               | Reenvío de verificación (rate-limited)             | —   |
| GET      | `/api/auth/verify-email/confirm`                               | Confirma email (HTML mínimo)                        | —   |
| POST     | `/api/auth/reset-password/request`                             | Solicita reset (rate-limited)                        | —   |
| GET/POST | `/api/auth/reset-password/confirm`                             | Formulario + confirmación de reset                  | —   |
| POST     | `/api/routes`                                                  | Upsert de ruta (con normalización OSRM best-effort) | JWT  |
| GET      | `/api/routes`                                                  | Listado de rutas                                     | JWT  |
| GET      | `/api/routes/{id}`                                             | Detalle de ruta                                      | JWT  |
| GET      | `/api/routes/{id}/export.gpx`                                  | Exportación GPX 1.1                                 | JWT  |
| POST     | `/api/routes/{id}/photos`                                      | Subida de foto (cifrada)                             | JWT  |
| GET      | `/api/routes/{id}/photos`                                      | Listado de fotos                                     | JWT  |
| GET      | `/api/routes/{id}/photos/{photoId}`                            | Descarga de foto (descifra)                          | JWT  |
| DELETE   | `/api/routes/{id}/photos/{photoId}`                            | Borrado de foto                                      | JWT  |
| POST     | `/api/route-shares`                                            | Crear invitación para compartir ruta (+push FCM)    | JWT  |
| GET      | `/api/route-shares/received` · `/sent`                      | Invitaciones recibidas/enviadas                      | JWT  |
| POST     | `/api/route-shares/{id}/accept` · `/decline` · `/revoke` | Aceptar/declinar/revocar                             | JWT  |
| POST     | `/api/achievements/check`                                      | Evalúa y desbloquea logros                          | JWT  |
| GET      | `/api/achievements`                                            | Listado de logros + desbloqueados                    | JWT  |
| POST     | `/api/device-tokens`                                           | Registra token de dispositivo (FCM)                  | JWT  |
| GET      | `/admin/status`                                                | Eventos operacionales recientes + memoria/disco del host | Secreto propio (`ADMIN_STATUS_TOKEN`) |
| GET      | `/dashboard/*`                                                 | Panel web (`apps/web`), servido vía `embed.FS`, mismo origen | — (login propio del panel) |

Cada ruta pública que la app llama por `fetch()` cross-origin lleva `PublicCORS` y su ruta `OPTIONS`
para el preflight. `/admin/status` y `/dashboard/*` son la excepción: nunca llevan `PublicCORS` — el
panel se sirve desde el mismo origen que la API (ver `dashboard-reporting`, design.md), así que no lo
necesita.

## Middleware y seguridad

- `httpmw.Recover` (panic → 500) y `httpmw.PublicCORS` (CORS para orígenes de la app).
- `auth.RequireAuth(tokenIssuer)` valida el JWT Bearer.
- **Rate limiting** por ventana deslizante (`LoginRateLimiter`, genérico por clave `string`):
  - Login: 5 intentos / 15 min · Registro: 5 / 15 min · Verificación: 3 / 15 min ·
    Reset contraseña: 3 / 15 min · Compartir ruta: 5 / 15 min.
- **Anti-enumeración**: registro/login/reset devuelven la misma respuesta exista o no la cuenta.
- **`secretscan`**: test de regresión que detecta secretos hardcodeados en ficheros versionados.

## Autenticación

- `users.password_hash` con **bcrypt** (`golang.org/x/crypto`).
- Tokens de sesión **JWT** (`golang-jwt/jwt/v5`), firmados con `AUTH_TOKEN_SECRET`, TTL 24 h.
- Verificación de email y reset usan **tokens de alta entropía** (`crypto/rand` 256 bits) persistidos
  como **hash SHA-256** (nunca en claro), de un solo uso y con expiración.

## Fotos (MinIO + cifrado)

- Binarios en **MinIO** (S3 compatible) vía `minio-go/v7`; metadatos en `route_photos`.
- Cifrado **AES-256** en el backend antes de subir (clave `PHOTO_ENCRYPTION_KEY`, 32 bytes base64).
  Sin rotación de clave: perderla hace irrecuperables las fotos (ADR-042).
- En producción las credenciales MinIO de `apps/api` están acotadas a un único bucket.

## Email (Resend)

- API REST de Resend con `net/http` estándar (sin SDK), `RESEND_API_KEY` + `RESEND_FROM_ADDRESS`.
- Remitente con dominio verificado propio (SPF/DKIM/DMARC).

## Normalización GPS (OSRM)

- Al sincronizar una ruta, `mapmatch.Client` llama a OSRM (`MAPMATCH_OSRM_URL`) para ajustar los
  puntos GPS a la carretera, en bloques, con timeout de 5 s por llamada. **Best-effort**: si OSRM no
  está disponible, la ruta se guarda igualmente. Los resultados se persisten en
  `route_points.matched_lat/matched_lng`.

## Exportación GPX

- `GET /api/routes/{id}/export.gpx` genera un documento **GPX 1.1** (`http://www.topografix.com/GPX/1/1`)
  con puntos, paradas y metadatos.

## Testing

- `go test ./...`: unitarios + integración **real contra Postgres**, aislada por schema
  (`internal/dbtest` crea un schema por test y lo descarta).
- `govulncheck ./...`: 0 vulnerabilidades alcanzables.
- `gofmt` + `go vet` en CI.
