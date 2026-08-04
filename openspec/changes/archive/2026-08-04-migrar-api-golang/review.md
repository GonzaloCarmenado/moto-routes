# Review: migrar-api-golang

Verificación independiente: código releído completo, suite completa re-ejecutada de cero (no se acepta el resumen de la implementación como prueba), `govulncheck` re-ejecutado, y un gap real de validación de inputs encontrado y corregido durante esta propia revisión.

## CRÍTICO — leer primero

- **Seguridad de secretos**: `internal/config/config.go` exige `DATABASE_URL` y `AUTH_TOKEN_SECRET` por entorno, sin valor por defecto (`TestLoad_RequiresDatabaseURL`, `TestLoad_RequiresAuthTokenSecret`). `internal/secretscan` escanea `apps/api` en busca de DSN con credenciales embebidas (`TestScan_RealApiTreeHasNoHardcodedSecrets`, verde). `infra/docker/.env`/`.env.prod` confirmados fuera de git (`git ls-files` no los lista); `.env.example`/`.env.prod.example` solo tienen placeholders triviales. El `AUTH_TOKEN_SECRET` real de producción se generó y escribió en el propio servidor vía script remoto que nunca lo imprime — verificado que no aparece en ningún log de esta sesión.
- **Vulnerabilidad real encontrada y corregida en `apply`, no en esta revisión** (ya documentada en `design.md`/`tasks.md`/`memory/context.md`, se repite aquí porque es justo el tipo de hallazgo que este apartado existe para señalar): `pgx@v5.8.0` (inyección SQL por confusión de placeholders, `GO-2026-5004`, alcanzable desde `PostgresUserStore.FindUserByID`) y `x/text@v0.29.0` (bucle infinito, `GO-2026-5970`) — ambas fijadas inicialmente por compatibilidad con Go 1.24 del paquete `apt` de Debian trixie. Corregido subiendo a `pgx@v5.9.2`/`x/text@v0.39.0` y moviendo la etapa de build del Dockerfile a la imagen oficial `golang:1.25-trixie`. Re-verificado en esta revisión: `govulncheck ./...` → 0 vulnerabilidades alcanzables.
- **Gap encontrado en esta revisión, corregido en el momento**: `RegisterHandler` no validaba el formato del email — se podía registrar una cuenta con email vacío o sin `@`/dominio. Ninguna spec lo exige explícitamente como escenario, pero es una validación de input básica esperada (regla general del proyecto: "Validación de inputs en frontend y backend"). Corregido con `validateEmail` (`internal/auth/user.go`) + 2 tests nuevos (`TestRegisterHandler_EmptyEmailIsRejectedWithoutCreatingAnAccount`, `TestRegisterHandler_MalformedEmailIsRejectedWithoutCreatingAnAccount`), ciclo rojo→verde confirmado.
- **`src/shared/` (frontend)**: sin cambios. Los dos ficheros de frontend tocados (`ci-workflow.spec.ts`, `pre-commit-audit-gate.spec.ts`) son tests de regresión sobre `.github/workflows/ci.yml`/`.husky/pre-commit`, no componentes de dominio ni compartidos — radio de impacto nulo sobre `cockpit`/`routes`/`profile`.
- **Dependencias core nuevas**: primera vez que `apps/api` tiene dependencias de terceros (antes Maven/Spring, ahora `chi`, `pgx`, `golang-jwt`, `golang.org/x/crypto`) — todas justificadas en `design.md`/[[ADR-034]] con alternativas descartadas, confirmadas antes de instalar (`AskUserQuestion` explícito en la sesión). Ninguna dependencia de `apps/mobile` (TS/Rust) tocada.
- **Reglas del proyecto saltadas**: ninguna sin justificar. TDD real en todo el flujo (rojo confirmado antes de cada implementación, ejecutado de verdad, no solo revisado). Único ajuste post-hoc: el gap de validación de email de arriba, corregido en la misma revisión.

## Trazabilidad Requirement → Scenario → Test

### `api-backend` (ADDED)
| Requirement | Scenario | Test | Estado |
|---|---|---|---|
| La migración preserva el comportamiento observable | Endpoint responde igual (200) | `internal/ping/handler_test.go::TestHandler_HealthyReturns200WithDatabaseTime` + verificación manual real (Docker local y producción, `curl` → 200) | ✅ |
| La migración preserva el comportamiento observable | Comportamiento ante DB no disponible (503) | `internal/ping/handler_test.go::TestHandler_UnhealthyReturns503WithError` + verificación manual real (`docker compose stop postgres` → 503, ~7.8s, no colgado) | ✅ |

### `api-security` (ADDED)
| Requirement | Scenario | Test | Estado |
|---|---|---|---|
| Contraseñas nunca en texto plano | Valor almacenado no coincide con el enviado | `internal/auth/password_storage_test.go::TestRegisterThenPersist_StoredPasswordIsNeverThePlaintext` (integración, Postgres real) | ✅ |
| Secretos vía variables de entorno | No hay secretos hardcodeados | `internal/secretscan/scan_test.go::TestScan_RealApiTreeHasNoHardcodedSecrets` + `internal/config/config_test.go::TestLoad_Requires*` | ✅ |
| Intentos de login fallidos acotados | Login bloqueado tras superar el límite | `internal/auth/ratelimit_test.go::TestRateLimitedLoginHandler_BlocksAfterTooManyFailedAttempts` | ✅ |
| Respuestas de error sin fuga interna | Error interno no expone detalles | `internal/httpmw/recover_test.go::TestRecover_UnhandledPanicReturns500WithoutInternalDetails` | ✅ |
| Auditoría de vulnerabilidades bloquea el commit | Commit bloqueado con vulnerabilidad no justificada | Verificación manual real: `govulncheck` salió con código 3 antes de corregir `pgx`/`x-text` (ver CRÍTICO); regresión estructural en `pre-commit-audit-gate.spec.ts` | ✅ |
| Auditoría de vulnerabilidades bloquea el commit | Commit no bloqueado con vulnerabilidad justificada | No exercised con una excepción Go real — hoy no hay ninguna vulnerabilidad Go pendiente que la necesite (mismo motivo por el que no se fabrica una excepción falsa). El mecanismo (`\|\| exit 1` condicional) es idéntico al ya probado con `pnpm`/`cargo` | ⚠️ No ejercido con caso real, mecanismo ya probado por precedente — no bloqueante |

### `local-dev-environment` (MODIFIED)
| Requirement | Scenario | Test | Estado |
|---|---|---|---|
| Imágenes base coinciden con Debian 13 | Imagen de Postgres es trixie | Sin cambios respecto a antes de este cambio (`postgres:16-trixie`) | ✅ (preexistente) |
| Imágenes base coinciden con Debian 13 | Imagen de la API se basa en Debian 13, con Go | Inspección manual de `apps/api/Dockerfile` (`FROM debian:trixie-slim AS runtime`) + verificación E2E real (Docker local y producción) | ✅ — sin test automatizado, mismo patrón que la versión Java (tampoco lo tenía) |

### `user-auth` (ADDED)
| Requirement | Scenario | Test | Estado |
|---|---|---|---|
| Registro con email y contraseña | Registro correcto | `internal/auth/register_test.go::TestRegisterHandler_ValidDataCreatesAccountWithoutPasswordInResponse` | ✅ |
| Registro con email y contraseña | Email duplicado rechazado | `TestRegisterHandler_DuplicateEmailIsRejectedWithoutCreatingASecondAccount` | ✅ |
| Registro con email y contraseña | Contraseña débil rechazada | `TestRegisterHandler_WeakPasswordIsRejectedWithoutCreatingAnAccount` | ✅ |
| Login emite token válido | Login correcto devuelve token | `internal/auth/login_test.go::TestLoginHandler_ValidCredentialsReturnAToken` | ✅ |
| Login emite token válido | Credenciales incorrectas → mismo error genérico | `TestLoginHandler_UnknownEmailAndWrongPasswordReturnTheSameGenericError` | ✅ |
| Endpoints protegidos exigen token válido | Acceso concedido con token válido | `internal/auth/middleware_test.go::TestRequireAuth_ValidTokenGrantsAccess` | ✅ |
| Endpoints protegidos exigen token válido | Acceso denegado sin token | `TestRequireAuth_MissingTokenIsDenied` | ✅ |
| Endpoints protegidos exigen token válido | Acceso denegado con token expirado | `TestRequireAuth_ExpiredTokenIsDenied` | ✅ |
| Endpoints protegidos exigen token válido | Acceso denegado con firma inválida | `TestRequireAuth_InvalidSignatureIsDenied` | ✅ |

**Cobertura de escenarios: 15/16 con test automatizado o verificación manual real documentada (100% con evidencia), 1/16 (excepción justificada de auditoría) no ejercido por no existir hoy un caso real — no bloqueante.**

## Verificación independiente ejecutada en esta revisión

- `go build ./...`, `go vet ./...`, `gofmt -l .` (limpio) — apps/api completo.
- `go test ./... -v` con `DATABASE_URL` real (Postgres vía Docker): **23/23 tests en verde** (incluye integración real contra Postgres para migraciones y `PostgresUserStore`).
- `go test ./... -cover`: `auth` 82.0%, `config` 100%, `httpmw` 100%, `migrate` 75.6%, `ping` 71.4%, `secretscan` 88.9%, `cmd/api` 0% (solo wiring, sin lógica propia — cubierto por la verificación E2E real, no por unit tests, mismo patrón que `MotoRoutesApiApplication` en la versión Java).
- `govulncheck ./...`: 0 vulnerabilidades alcanzables.
- `openspec validate --strict migrar-api-golang`: válido.
- CI real en GitHub Actions (PR #92, run 30890742046): `quality-go`/`quality-tauri`/`quality-ts` en verde.
- Despliegue real en producción (servidor Tailscale): `curl` → 200, `ss -tlnp` confirma solo Tailscale, registro/login/`me` reales, `schema_migrations` confirma migración aplicada sola, `systemctl restart docker` → recuperación automática, `pg_hba.conf`/`postgresql.conf` sin tocar.

## Hallazgos por categoría

- **Gap** (corregido en esta revisión): `RegisterHandler` sin validación de formato de email — ver CRÍTICO.
- **Desviación**: ninguna respecto a las specs.
- **Calidad**: ninguna relevante. Código Go idiomático, sin `panic`/`recover` fuera del middleware dedicado, sin lógica duplicada entre `register.go`/`login.go`/`me.go` (comparten `writeError`, `UserStore`, `TokenIssuer`).
- **Cobertura**: `cmd/api` al 0% de cobertura unitaria es esperado (wiring puro); todo lo demás por encima del 71%. No hay un umbral de cobertura Go decidido en ninguna ADR/spec (a diferencia del 80% de Vitest) — informativo, no bloqueante.
- **Convenciones de frontend**: no aplica, cambio 100% backend salvo dos ficheros de test de regresión ya cubiertos arriba.

## Veredicto

**APPROVED WITH MINOR ISSUES**

Un solo issue menor, no bloqueante: el escenario de "excepción justificada" de la auditoría Go no tiene un caso real que lo ejercite todavía (no hay ninguna vulnerabilidad Go pendiente hoy). Se resolverá de forma natural la primera vez que `govulncheck` reporte algo real sin fix disponible, mismo patrón que `RUSTSEC-2023-0071` en Rust.

Todo lo demás — incluida la vulnerabilidad real de `pgx`/`x-text` encontrada durante `apply` y el gap de validación de email encontrado durante esta propia revisión — se corrigió en el momento, con su ciclo TDD real, antes de este veredicto.
