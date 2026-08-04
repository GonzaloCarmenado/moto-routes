## Context

`apps/api` es hoy Java 21 + Spring Boot 3.5.13 + Maven, con un único endpoint (`GET /api/ping`) que confirma conectividad real con PostgreSQL. Corre en local vía `infra/docker/docker-compose.yml` (imagen `debian:trixie-slim` + JDK vía `apt`) y en producción vía Tailscale ([[ADR-033]]: `network_mode: host`, escucha solo en la interfaz Tailscale, PostgreSQL nativo ya existente en el servidor, sin migraciones dedicadas — tabla dummy creada a mano). Ver `proposal.md` - Why para el motivo de sustituir Java por Go.

## Goals / Non-Goals

**Goals:**
- Sustituir la implementación de `apps/api` por Go preservando el comportamiento observable del endpoint existente (requisito ya recogido en la delta de `api-backend`).
- Implementar `user-auth` y `api-security` completos según sus specs.
- Elegir una arquitectura de router/middleware en Go que no bloquee, a futuro, ni un cliente de blob storage ni un servidor de notificaciones en tiempo real — sin implementar ninguna de las dos cosas en este cambio.

**Non-Goals:**
- Implementar almacenamiento de blobs (tipo Azure Blob Storage) ni notificaciones en tiempo real (tipo SignalR/WebSockets) — solo se deja la arquitectura preparada para no tener que reescribirla cuando lleguen.
- Migrar `apps/mobile` o cualquier otra parte del monorepo.
- Introducir un sistema de roles/permisos granular más allá de "usuario autenticado sí/no" — no lo pide ninguna spec de este cambio.
- Alta disponibilidad ni múltiples réplicas de `apps/api` — sigue siendo un único contenedor, igual que en [[ADR-033]].

## Decisions

Las decisiones duraderas de arquitectura de este cambio (lenguaje/framework, router, autenticación, driver de Postgres, migraciones, rate limiting, imagen Docker final) están registradas en [[ADR-034]] (`memory/decisions.md`), con sus alternativas descartadas — no se duplican aquí.

**Extensibilidad para blob storage y notificaciones en tiempo real (sin implementar)**
- Blob storage: cualquier cliente futuro (Azure Blob Storage) se conecta detrás de una interfaz Go pequeña definida cuando se implemente esa funcionalidad — no se define ni una interfaz ni un stub en este cambio, para no construir abstracción sin un consumidor real todavía (evitar sobre-ingeniería). Lo único que este cambio garantiza es no introducir nada que lo bloquee (por ejemplo, no acoplar el router a un framework sin soporte de streaming de cuerpos grandes).
- Notificaciones en tiempo real: `chi` expone `http.Handler` estándar, compatible con `http.Hijacker` — cualquier librería de WebSockets (`nhooyr.io/websocket`, `gorilla/websocket`) podrá montarse sobre las mismas rutas cuando llegue esa funcionalidad, sin migrar de router.

## Risks / Trade-offs

- [Riesgo] La versión de Go empaquetada en los repos `apt` de Debian trixie puede ir por detrás de la última estable → Mitigación: verificar en `apply` (ver Open Questions) si hace falta la imagen oficial `golang` para la etapa de build, mismo patrón de verificación real ya aplicado en [[ADR-032]]/[[ADR-033]] en vez de asumir.
- [Riesgo] El contador de intentos de login en memoria no sobrevive a un reinicio del proceso ni se comparte entre réplicas → Mitigación: aceptado mientras el servicio sea una sola instancia (ver [[ADR-034]]); revisar con un store compartido si eso cambia.
- [Riesgo] El runner de migraciones propio no soporta rollback (`down`) ni tiene CLI → Mitigación: aceptado para el tamaño actual del esquema (una tabla nueva); revisar si las migraciones se vuelven frecuentes o necesitan revertirse a menudo.
- [Riesgo] `debian:trixie-slim` como imagen final es más pesada de lo necesario para un binario estático de Go → Mitigación: trade-off aceptado a cambio de paridad operativa con el resto del monorepo (ver [[ADR-034]]); revisar si el tamaño de imagen se vuelve un problema real (tiempo de despliegue, espacio en el servidor).
- [Riesgo] Añadir cuentas de usuario amplía la superficie de lo que puede fallar en seguridad de forma silenciosa → Mitigación: `tasks.md` debe cubrir con test automatizado cada escenario ADDED de `user-auth` y `api-security` antes de archivar, mismo gate de cobertura de AC ya exigido en todo el proyecto.

## Migration Plan

1. Desarrollar el servicio Go en paralelo dentro de `apps/api` (mismo directorio, sustituyendo el árbol Java) en la rama de este cambio, sin tocar el servicio Java en producción hasta tener paridad verificada.
2. Verificar paridad de comportamiento localmente vía Docker Compose (mismo patrón de verificación end-to-end real ya usado en `entorno-api-docker`): `GET /api/ping` con Postgres arriba y con Postgres caído, antes y después, comparando código de estado y forma del cuerpo de respuesta.
3. El runner de migraciones se ejecuta automáticamente al arrancar el binario Go (antes de aceptar tráfico), contra cualquier PostgreSQL al que se conecte — local o el nativo de producción por igual. A diferencia de la tabla dummy de [[ADR-033]] (creada a mano por `psql`, porque `docker-entrypoint-initdb.d` es un mecanismo exclusivo de Docker que no aplica a un Postgres nativo), la tabla de usuarios NO requiere ningún paso manual por SSH: el propio arranque del contenedor en el servidor la aplica igual que en local.
4. Desplegar en el servidor Tailscale sustituyendo la imagen en `docker-compose.prod.yml` y repitiendo la verificación real end-to-end de [[ADR-033]] (`curl` desde la máquina de desarrollo, `ss -tlnp` para confirmar que solo escucha en la interfaz Tailscale).
5. **Rollback**: si el servicio Go falla la verificación en producción, revertir `docker-compose.prod.yml` a la imagen Java anterior (se conserva el tag hasta confirmar que Go es estable) y reiniciar — no hay infraestructura de blue/green ni de réplicas todavía, el rollback es un redespliegue de la imagen previa.

## Open Questions

Ninguna pendiente. La única abierta al proponer el cambio (¿paquete `apt` de Debian trixie o imagen oficial `golang` de Docker Hub para la etapa de build?) se resolvió en `apply`, y con una corrección posterior a la primera decisión:

1. Verificado con `docker run debian:trixie-slim` que el repo `apt` de trixie ofrece `golang-go 2:1.24~2` — inicialmente se optó por el paquete `apt`, igual que ya hacía el JDK, fijando `go.mod` a `go 1.24`.
2. **Corrección real encontrada al correr `govulncheck` sobre el código ya escrito** (no detectable antes de tener código): las versiones de `pgx`/`golang.org/x/text` compatibles con `go 1.24` (`pgx@v5.8.0`, `x/text@v0.29.0`) tienen vulnerabilidades reales y alcanzables desde nuestro propio código — `GO-2026-5004` (inyección SQL por confusión de placeholders en `pgx`, alcanzable desde `PostgresUserStore.FindUserByID`) y `GO-2026-5970` (bucle infinito en `x/text` con entrada inválida). Las versiones que corrigen ambas (`pgx@v5.9.2`, `x/text@v0.39.0`) exigen `go 1.25`, y Debian trixie solo empaqueta `golang-1.24` en su repo `apt` (confirmado con `apt-cache search '^golang-1\.'`) — no hay paquete `apt` de trixie que sirva. La seguridad gana sobre la preferencia por `apt`: la etapa de build pasa a partir de la imagen oficial `golang:1.25-trixie` (confirmado que el tag existe con `docker manifest inspect`) — sigue siendo Debian trixie, solo cambia de dónde sale el compilador. `go.mod` queda en `go 1.25`. La etapa de runtime final sigue siendo `debian:trixie-slim` sin cambios (la spec de `local-dev-environment` solo fija la imagen final, no la de build). `govulncheck ./...` queda en 0 vulnerabilidades alcanzables tras el ajuste.
