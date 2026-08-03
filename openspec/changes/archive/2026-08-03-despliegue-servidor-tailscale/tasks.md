## 1. Preparar el servidor (Docker + Git)

- [x] 1.1 Añadir el repositorio oficial de Docker para Debian (`download.docker.com/linux/debian`, `trixie`) con su clave GPG, siguiendo la guía oficial.
- [x] 1.2 Instalar `docker-ce`, `docker-ce-cli`, `containerd.io`, `docker-buildx-plugin`, `docker-compose-plugin` vía `apt`. Docker 29.7.1, Compose v5.3.1 (misma versión de Compose que el entorno local), Git 2.47.3.
- [x] 1.3 Confirmar `docker compose version` funciona y `systemctl is-enabled docker` está en `enabled` (arranque automático tras reiniciar el servidor). `systemctl is-enabled`/`is-active docker` → `enabled`/`active`.
- [x] 1.4 Instalar `git` (paquete nativo de Debian trixie, sin repo adicional).
- [x] 1.5 Añadir al grupo `docker` al usuario `gonzalo` (`usermod -aG docker gonzalo`) para no depender de `sudo` en cada comando — confirmado con `docker ps` sin `sudo` en una sesión SSH nueva.

## 2. Clonar el repositorio y preparar la base de datos

- [x] 2.1 `git clone https://github.com/crzverde/moto-routes.git` en el servidor (repo público, sin credenciales) — clonado en `/home/gonzalo/moto-routes`.
- [x] 2.2 Guardar hash/copia de `pg_hba.conf` y `postgresql.conf` **antes** de tocar nada más (`sha256sum /etc/postgresql/17/main/{pg_hba.conf,postgresql.conf}`).
- [x] 2.3 Ejecutar el contenido de `infra/docker/postgres/init.sql` contra `appdb` para crear la tabla `healthcheck`. **Ajuste real durante `apply`**: `sudo -u postgres psql -f ~/moto-routes/infra/docker/postgres/init.sql` falla con "Permission denied" — el usuario OS `postgres` no puede leer dentro de `/home/gonzalo/` (permisos de directorio home). Resuelto pasando el SQL por stdin (`psql -d appdb <<'EOF' ... EOF`) en vez de por ruta de fichero. Tabla creada por `postgres`, no por `appuser` (al ejecutarse como superusuario) — se otorgó `GRANT ALL PRIVILEGES ON TABLE healthcheck TO appuser` explícitamente para que la app pueda usarla si en el futuro la consulta de verdad (el endpoint actual usa `SELECT now()`, no toca todavía esta tabla).
- [x] 2.4 Confirmado con `sha256sum` que `pg_hba.conf`/`postgresql.conf` son idénticos a los de 2.2 (mismos hashes exactos).

## 3. Restringir la API a la interfaz de Tailscale

- [x] 3.1 Añadir `server.address=${SERVER_ADDRESS:0.0.0.0}` a `apps/api/src/main/resources/application.properties` (default `0.0.0.0` explícito para no romper `infra/docker/docker-compose.yml` del entorno local, que nunca define `SERVER_ADDRESS`).
- [x] 3.2 Verificado en local que `docker compose up --build` (entorno de desarrollo) sigue funcionando igual tras el cambio — `curl /api/ping` → 200 con timestamp real, sin regresión.

## 4. Compose de producción y credenciales

- [x] 4.1 Crear `infra/docker/docker-compose.prod.yml`: servicio `api` únicamente, `build.context: ../../apps/api`, `network_mode: host`, `restart: unless-stopped`, `env_file: .env.prod`.
- [x] 4.2 Crear `infra/docker/.env.prod.example` (versionado): documenta `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, `SERVER_ADDRESS` sin valores reales.
- [x] 4.3 Añadir `infra/docker/.env.prod` a `.gitignore` — verificado con `git check-ignore -v`.
- [x] 4.4 En el servidor: `infra/docker/.env.prod` creado a mano vía SSH (contraseña de `appuser` regenerada por segunda vez en esta sesión, tras haber borrado la primera copia local por higiene — verificada con `psql` antes de escribirla), `chmod 600`.

## 5. Desplegar y verificar en el servidor real

- [x] 5.1 Rama `feature/despliegue-servidor-tailscale` empujada a `origin` y clonada/checkout en el servidor (necesario para que `docker-compose.prod.yml` y el `application.properties` con `server.address` llegaran allí). `docker compose -f docker-compose.prod.yml up -d --build` → `BUILD SUCCESS` (Maven dentro del build), contenedor `docker-api-1` arrancado.
- [x] 5.2 `curl http://100.114.190.36:8080/api/ping` desde esta máquina (dentro del mismo tailnet) → 200 con timestamp real de `appdb`.
- [x] 5.3 `ss -tlnp` en el servidor → el puerto 8080 solo aparece asociado a `[::ffff:100.114.190.36]`, nunca a `0.0.0.0` ni a `192.168.1.23`.
- [x] 5.4 `sudo systemctl restart docker` → el contenedor `docker-api-1` vuelve a estar `Up` sin intervención manual, `curl` vuelve a responder 200 tras el reinicio.
- [x] 5.5 `git grep DB_PASSWORD=` sobre el árbol de trabajo (excluyendo `*.example`) → sin coincidencias; `git ls-files` confirma que solo `.env.prod.example` está rastreado, nunca `.env.prod`.

## 6. Cierre

- [x] 6.1 Actualizar `memory/context.md` con el estado resultante: `apps/api` corriendo en el servidor real vía Tailscale, referencia a este cambio y a [[ADR-033]].
- [x] 6.2 Confirmar que `openspec validate --changes despliegue-servidor-tailscale --strict` pasa antes de invocar `/opsx:archive`.
