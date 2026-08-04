## 1. Preparación y retirada del stack Java

- [x] 1.1 Resolver el Open Question de `design.md`: verificar si el paquete `golang` de los repos `apt` de Debian trixie ofrece una versión de Go suficientemente reciente, o si la etapa de build de `apps/api/Dockerfile` debe partir de la imagen oficial `golang` de Docker Hub. Decisión final (corregida durante el grupo 5 al aparecer vulnerabilidades reales alcanzables en las versiones limitadas a `go 1.24`): imagen oficial `golang:1.25-trixie` para el build, `debian:trixie-slim` se mantiene para el runtime.
- [x] 1.2 Inicializar el módulo Go (`go.mod`) en `apps/api`; retirar `pom.xml`, `mvnw`/`mvnw.cmd`, `.mvn/`, `src/main/java/**` y `src/test/java/**`.

## 2. Paridad del endpoint existente (`api-backend`)

- [x] 2.1 Test en rojo: `GET /api/ping` con PostgreSQL disponible responde 200 con un cuerpo JSON con la misma estructura que la versión Java.
- [x] 2.2 Implementación mínima (router `chi` + `net/http`, driver `pgx`) que pone 2.1 en verde.
- [x] 2.3 Test en rojo: `GET /api/ping` con PostgreSQL no disponible responde 503 sin colgarse.
- [x] 2.4 Implementación mínima que pone 2.3 en verde.
- [x] 2.5 Verificación real del binario Go directamente contra PostgreSQL local (sin pasar todavía por el `Dockerfile`/`docker-compose.yml` de `apps/api`, que se reescriben en el grupo 6): Postgres arriba responde 200, Postgres caído responde 503 sin colgarse. La verificación completa vía Docker Compose (incluida la paridad de este endpoint) se hace en 6.3, una vez exista la imagen Go.

## 3. Esquema de base de datos y migraciones

- [x] 3.1 Test en rojo + implementación del runner de migraciones propio (lee `.sql` de una carpeta en orden, aplica los pendientes, registra en `schema_migrations`).
- [x] 3.2 Migración `.sql` para la tabla de usuarios (email único, hash de contraseña, timestamps).

## 4. `user-auth`

- [x] 4.1 Test en rojo: registro con datos válidos crea la cuenta y la respuesta no incluye la contraseña en ningún formato.
- [x] 4.2 Implementación mínima del endpoint de registro (hash `bcrypt` antes de guardar) que pone 4.1 en verde.
- [x] 4.3 Test en rojo: registro rechaza un email ya existente con un error de conflicto, sin duplicar la cuenta.
- [x] 4.4 Implementación mínima (constraint único + manejo del conflicto) que pone 4.3 en verde.
- [x] 4.5 Test en rojo: registro rechaza una contraseña que no cumple la política mínima de complejidad.
- [x] 4.6 Implementación mínima de la validación que pone 4.5 en verde.
- [x] 4.7 Test en rojo: login con credenciales correctas responde con éxito y un token de sesión.
- [x] 4.8 Implementación mínima (verificación `bcrypt` + emisión JWT) que pone 4.7 en verde.
- [x] 4.9 Test en rojo: login rechaza email inexistente y contraseña incorrecta con el mismo error genérico en ambos casos.
- [x] 4.10 Implementación mínima que pone 4.9 en verde sin revelar cuál de los dos datos era incorrecto.
- [x] 4.11 Test en rojo (4 escenarios): un endpoint protegido concede acceso con token válido, y lo deniega con 401 sin token, con token expirado y con token de firma inválida.
- [x] 4.12 Implementación mínima del middleware de autenticación que pone 4.11 en verde. Cableado en `main.go` (registro, login y `GET /api/auth/me` como endpoint protegido real) y verificado end-to-end contra Postgres real (201/409/400 en registro, 401/401/200 en login+me).

## 5. `api-security`

- [x] 5.1 Test en rojo + implementación: el valor de contraseña almacenado tras un registro no coincide con el texto enviado ni permite recuperarlo (regresión sobre 4.2).
- [x] 5.2 Test en rojo: ningún fichero versionado de `apps/api` (código fuente, configuración, `Dockerfile`) contiene un secreto real.
- [x] 5.3 Implementación: clave de firma de tokens y credenciales de base de datos solo vía variables de entorno, que pone 5.2 en verde.
- [x] 5.4 Test en rojo: el login se bloquea tras superar el límite de intentos fallidos configurado dentro de la ventana de tiempo definida.
- [x] 5.5 Implementación mínima del contador en memoria (mapa + mutex) que pone 5.4 en verde. Cableado en `main.go` (5 intentos/15 min).
- [x] 5.6 Test en rojo: un error interno no controlado no expone traza de pila, ruta de fichero del servidor ni fragmentos de consulta SQL en la respuesta.
- [x] 5.7 Implementación mínima (middleware de recuperación de pánico + formato de error uniforme) que pone 5.6 en verde. Cableado en `main.go` para todo el router.
- [x] 5.8 Cablear en `.husky/pre-commit` una auditoría de vulnerabilidades del árbol de dependencias Go (`go.sum`), con la misma disciplina de excepciones documentadas que ya usan `pnpm audit`/`cargo audit`. Herramienta: `govulncheck` (oficial del equipo de Go). Al ejecutarlo por primera vez encontró 2 vulnerabilidades reales alcanzables (`GO-2026-5004` inyección SQL en `pgx@v5.8.0`, `GO-2026-5970` bucle infinito en `x/text@v0.29.0`) — corregidas subiendo a `pgx@v5.9.2`/`x/text@v0.39.0` (ver 1.1), no añadidas como excepción.
- [x] 5.9 Test en rojo + implementación: el hook bloquea el commit ante una vulnerabilidad Go real no justificada, y no bloquea ante una explícitamente ignorada y justificada — mismo patrón que `pre-commit-audit-gate.spec.ts` (extendido, no duplicado). Verificado con ejecución real: `govulncheck` salió con código 3 antes de corregir las dependencias, código 0 después.

## 6. Docker e infraestructura local

- [x] 6.1 Reescribir `apps/api/Dockerfile` (multi-stage: build `golang:1.25-trixie` → runtime `debian:trixie-slim`), usando el mecanismo corregido en 1.1.
- [x] 6.2 Actualizar `infra/docker/docker-compose.yml`/`.env.example`/`.env`/`.env.prod.example` a la nueva imagen y variables (`DATABASE_URL`, `AUTH_TOKEN_SECRET` en vez de `DB_URL`/`DB_USERNAME`/`DB_PASSWORD`); confirmado que "Docker Compose levanta la API y PostgreSQL con un único comando" de `local-dev-environment` se sigue cumpliendo.
- [x] 6.3 Verificación real: `docker compose up --build` → 200 real; registro de usuario real + `docker compose down`/`up` (sin `-v`) → login sigue funcionando (persistencia confirmada); `docker compose stop postgres` con la API arriba → 503 controlado (~7.8s, acotado — no colgado; se añadió `ConnectTimeout` en el pool de `pgx` como red de seguridad adicional, aunque el retraso real viene de la resolución DNS del propio Docker, no del timeout de conexión TCP).

## 7. CI

- [ ] 7.1 Añadir a `.github/workflows/ci.yml` los pasos equivalentes a `quality-tauri`/`quality-ts` para Go (build, test, lint, auditoría de dependencias), sin tocar los jobs existentes.
- [ ] 7.2 Actualizar `src/shared/ci/ci-workflow.spec.ts` con las aserciones nuevas del job/pasos Go.
- [ ] 7.3 Verificación real en un tag o rama de prueba en GitHub Actions antes de dar el pipeline por bueno (mismo patrón que `ci-cd-pipeline`).

## 8. Despliegue en el servidor Tailscale

- [ ] 8.1 Actualizar `infra/docker/docker-compose.prod.yml` a la nueva imagen Go, conservando el tag de la imagen Java anterior disponible para rollback.
- [ ] 8.2 Desplegar y verificar end-to-end real (`curl` desde la máquina de desarrollo, `ss -tlnp` confirmando que la API solo escucha en la interfaz Tailscale) — mismo patrón que [[ADR-033]]. La tabla de usuarios se crea sola al arrancar el contenedor (el runner de migraciones corre contra el PostgreSQL nativo igual que contra el local, sin paso manual por SSH); confirmar con `psql` que `schema_migrations` registra la migración aplicada.

## 9. Cierre

- [ ] 9.1 Ejecutar `openspec validate --strict` sobre el cambio y corregir cualquier aviso.
- [ ] 9.2 Actualizar `memory/context.md` (estado actual: `apps/api` pasa de Java a Go) y confirmar que [[ADR-034]] en `memory/decisions.md` queda completa, sin pendientes de esta implementación.
- [ ] 9.3 `/opsx:archive` y apertura de PR (`feature/migrar-api-golang` → `master`) referenciando el `review.md` archivado, según el flujo de Git del proyecto.
