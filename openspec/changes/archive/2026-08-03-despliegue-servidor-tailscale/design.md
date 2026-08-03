## Context

Ver `proposal.md` para el porqué. Estado real del servidor, verificado por SSH en esta misma sesión (no asumido):

- Debian 13 (trixie), kernel `6.12.100+deb13-amd64`, 8 cores, 5.6GB RAM (3.8GB libres), 209GB libres en disco.
- Alcanzable solo por Tailscale (`100.114.190.36`, interfaz `tailscale0`) y por su LAN doméstica (`192.168.1.23/24`, interfaz `wlp2s0`) — sin IP pública propia.
- Ni Docker ni Git instalados.
- PostgreSQL 17 **nativo** (gestionado por `pg_lsclusters`/systemd, no Docker) ya corriendo, con `appdb`/`appuser` creados de antemano por el usuario específicamente para este despliegue. `appdb` está vacía. `pg_hba.conf` solo permite `127.0.0.1/32` y `::1/128` con `scram-sha-256`; sin `listen_addresses` personalizado (solo loopback). Contraseña de `appuser` ya regenerada en esta sesión y verificada (`psql -h 127.0.0.1 -U appuser -d appdb` funcionando).
- Repos de Debian trixie: `docker.io` 26.1.5 disponible, pero **no** `docker-compose-plugin` (solo el paquete `docker-compose` v1, en Python, obsoleto/EOL) — comprobado con `apt-cache policy`/`search`. `git` 2.47.3 sí disponible en el repo nativo.
- Repositorio de GitHub (`crzverde/moto-routes`) es público — permite `git clone` sin credenciales.

## Goals / Non-Goals

**Goals:**
- `apps/api` corriendo en el servidor, conectado de verdad al PostgreSQL nativo existente.
- Alcanzable únicamente dentro del tailnet — ni en la LAN doméstica ni (por descontado) en internet público.
- Sobrevive a un reinicio del servidor o una caída del proceso sin intervención manual.
- Ninguna credencial real en el repositorio git.

**Non-Goals:**
- Pipeline de CI/CD que construya y despliegue automáticamente (cambio futuro).
- TLS/HTTPS — el tráfico ya viaja cifrado dentro del túnel WireGuard de Tailscale; añadir TLS encima no aporta nada a este alcance y sería sobre-ingeniería para un endpoint de prueba interno.
- Cualquier cambio a la configuración de PostgreSQL (`pg_hba.conf`/`postgresql.conf`) más allá de la contraseña de `appuser`, ya regenerada.
- Un usuario de sistema dedicado para la app o una unidad `systemd` propia del contenedor — se apoya en `docker.service` (ya gestionado por systemd) y su propia política de reinicio.

## Decisions

### Instalación de Docker: repositorio oficial de Docker, no `docker.io` de Debian
Debian trixie solo empaqueta `docker-compose` v1 (Python, obsoleto, comando `docker-compose` separado) — **no** el plugin `docker compose` v2 que ya usa todo el entorno de desarrollo local (`docker compose up`, sintaxis `services:`). Para no tener dos formas distintas de invocar Compose entre local y producción, se añade el repositorio oficial de Docker (`download.docker.com/linux/debian`) — **verificado por `curl` en esta sesión que sirve paquetes reales para `trixie`** (no solo para bookworm/bullseye, había reportes contradictorios que se comprobaron directamente en vez de asumir). Se instalan `docker-ce`, `docker-ce-cli`, `containerd.io`, `docker-buildx-plugin` y `docker-compose-plugin`. Alternativa descartada: `docker.io` + `docker-compose` v1 de Debian — más simple de instalar (sin repo de terceros) pero rompe la coherencia de comandos con el entorno local y usa una herramienta ya sin mantenimiento activo.

### Build de la imagen: clonar y construir en el propio servidor
Sin pipeline de CI/CD en este alcance, la opción más simple es clonar el repositorio (público, sin credenciales) directamente en el servidor y construir la imagen con el mismo `apps/api/Dockerfile` ya existente — sin registro de contenedores que gestionar ni credenciales nuevas.

### Nuevo `infra/docker/docker-compose.prod.yml`, no reutilizar `docker-compose.yml`
El compose de desarrollo local (`infra/docker/docker-compose.yml`) levanta su propio `postgres` en Docker — reutilizarlo en el servidor intentaría publicar el puerto 5432, que ya ocupa el PostgreSQL nativo. `docker-compose.prod.yml` define **solo** el servicio `api`: `network_mode: host` (para que `127.0.0.1` dentro del contenedor sea el loopback real del host, alcanzando el PostgreSQL nativo sin tocar `pg_hba.conf`), `restart: unless-stopped`, y `env_file` apuntando a un `.env.prod` que vive solo en el servidor.

### La API solo escucha en la interfaz de Tailscale
Con `network_mode: host`, Spring Boot expondría por defecto el puerto 8080 en **todas** las interfaces (`0.0.0.0`), incluida la LAN doméstica — justo lo que Tailscale existe para evitar. Se añade `server.address=${SERVER_ADDRESS:0.0.0.0}` a `apps/api/src/main/resources/application.properties` (con `0.0.0.0` como valor por defecto para no romper el entorno de desarrollo local, que nunca define `SERVER_ADDRESS`); `docker-compose.prod.yml` define `SERVER_ADDRESS=100.114.190.36` explícitamente. Así la propia aplicación, no un firewall aparte, es la que limita su superficie de exposición — coherente con el principio de permisos/exposición mínima ya aplicado en ADR-014.

### Credenciales: `.env.prod` local al servidor, nunca en git
Mismo patrón que `infra/docker/.env` de la spec local: `infra/docker/.env.prod.example` versionado (documenta `DB_URL`/`DB_USERNAME`/`DB_PASSWORD`/`SERVER_ADDRESS` sin valores reales), `infra/docker/.env.prod` añadido a `.gitignore`, creado a mano por SSH directamente en el servidor con la contraseña real ya regenerada — nunca transmitido por otro canal ni versionado.

### Tabla dummy: reutilizar el mismo `infra/docker/postgres/init.sql`, ejecutado a mano
No hay mecanismo `docker-entrypoint-initdb.d` en un PostgreSQL nativo. En vez de duplicar el SQL, se ejecuta el mismo fichero ya existente (`psql -h 127.0.0.1 -U appuser -d appdb -f infra/docker/postgres/init.sql`) una sola vez tras clonar el repo en el servidor — misma fuente de verdad que el entorno local, sin divergencia de esquema.

## Risks / Trade-offs

- **[Riesgo] Añadir el repositorio oficial de Docker introduce una clave GPG y un repo de terceros en un servidor doméstico** → Mitigación: es el propio método documentado oficialmente por Docker para Debian, la alternativa (`docker.io` + `docker-compose` v1) tiene peor mantenimiento a largo plazo; verificado que el repo sirve paquetes reales para `trixie` antes de decidirlo.
- **[Riesgo] `server.address` mal configurado dejaría la API expuesta en la LAN sin que nadie lo note** → Mitigación: el escenario de spec correspondiente exige verificar con `ss -tlnp` en el propio servidor que el puerto solo aparece en la IP de Tailscale, no solo confiar en la configuración declarada.
- **[Riesgo] Reutilizar la contraseña regenerada de `appuser` en texto plano durante el despliegue** → Mitigación: solo se escribe en `.env.prod` (permisos de fichero restringidos, `chmod 600`) directamente en el servidor por SSH, nunca se pega en un commit, PR, o log versionado.
- **[Trade-off] Sin pipeline de CI/CD** — cada actualización futura de `apps/api` requiere repetir `git pull` + `docker compose -f docker-compose.prod.yml up -d --build` a mano en el servidor. Aceptado explícitamente por alcance (ver Non-Goals); candidato claro para un cambio futuro dedicado.
