# Review — `despliegue-servidor-tailscale`

Verificación independiente: re-comprobado en el servidor real (no solo aceptado el resumen de la implementación), en esta misma revisión, justo antes de escribir este documento:

- `curl http://[tailscale-ip-redactada]:8080/api/ping` → 200, `{"healthy":true,"databaseTime":"2026-08-03T13:51:40...","error":null}`.
- `docker ps` en el servidor → `docker-api-1` `Up`.
- `ss -tlnp | grep 8080` → `[::ffff:[tailscale-ip-redactada]]:8080` únicamente (ni `0.0.0.0` ni `192.168.1.23`).
- `sha256sum` de `pg_hba.conf`/`postgresql.conf` → idénticos a la copia tomada antes de empezar cualquier cambio.
- `git grep DB_PASSWORD=` sobre el árbol de trabajo (excluyendo `*.example`) → sin coincidencias. `git ls-files | grep .env.prod` → solo `.env.prod.example` rastreado.
- El commit de implementación (`f75f01a`) pasó el `pre-commit` completo de `apps/mobile` (auditoría, ESLint, Vitest, Clippy, rustfmt, `cargo test`, Cypress) de verdad — no se usó `--no-verify`.

## CRÍTICO — leer primero

- **Sin secretos en código**: la contraseña real de `appuser` (regenerada dos veces en esta sesión) vive únicamente en `infra/docker/.env.prod` en el propio servidor (`chmod 600`), nunca en un fichero versionado. Verificado explícitamente con `git grep` y `git ls-files`.
- **Acceso a un servidor de producción real por SSH**: toda la sesión SSH quedó documentada en `memory/context.md`/`design.md` — comandos ejecutados, nunca destructivos sobre lo ya existente (el PostgreSQL nativo no se tocó salvo el `ALTER USER` de contraseña, explícitamente pedido/aceptado por el usuario, y la creación de una tabla nueva vacía).
- **Cambios en `src/shared/`**: ninguno — este cambio no toca ningún fichero de `apps/mobile/src/`.
- **Dependencias nuevas**: ninguna de código (ni npm, ni Cargo, ni Maven). Software de sistema nuevo en el servidor (Docker CE, Git) fuera del repositorio — instalado desde el repositorio oficial de Docker, verificado antes que soporta `trixie` de verdad (`curl` directo a `download.docker.com`, no solo documentación).
- **Configuración de PostgreSQL**: `pg_hba.conf`/`postgresql.conf` verificados byte a byte idénticos antes/después (hash `sha256sum`), tal y como exige el requisito correspondiente de la spec.

## Cobertura de Requirement/Scenario (`server-deployment`)

| Requirement | Scenario | Verificación | Estado |
|---|---|---|---|
| Solo alcanzable vía Tailscale | Responde por la IP de Tailscale | `curl http://[tailscale-ip-redactada]:8080/api/ping` desde la máquina de desarrollo (mismo tailnet), repetido varias veces incluida esta revisión → 200 | ✅ E2E real |
| Solo alcanzable vía Tailscale | No escucha en la LAN doméstica | `ss -tlnp` en el servidor, repetido en esta revisión → único bind es `[::ffff:[tailscale-ip-redactada]]:8080` | ✅ E2E real |
| Conecta al Postgres nativo sin alterar su config | Conexión real contra la BBDD existente | `curl /api/ping` devuelve `databaseTime` real, leído de una consulta contra la instancia nativa (no una nueva en Docker) | ✅ E2E real |
| Conecta al Postgres nativo sin alterar su config | La configuración de Postgres no cambia | `sha256sum` de `pg_hba.conf`/`postgresql.conf` antes de tocar nada y de nuevo en esta revisión → idénticos byte a byte | ✅ E2E real |
| El contenedor se recupera solo | Vuelve tras reiniciar Docker | `sudo systemctl restart docker` + `docker ps`/`curl` posteriores → contenedor `Up`, endpoint respondiendo, sin intervención manual | ✅ E2E real |
| Credenciales fuera del repositorio | Sin credenciales del servidor en git | `git grep`/`git ls-files` (ver arriba) | ✅ Verificado |

**Cobertura: 6/6 escenarios con verificación real en el propio servidor**, no solo local ni solo estructural — a diferencia de `entorno-api-docker`, aquí no queda ningún escenario pendiente de un entorno inalcanzable (el entorno *es* el servidor real, y se pudo llegar a él).

## Hallazgos

- **[gap de la propuesta inicial, resuelto durante `apply`]** La propuesta asumía Docker ya instalado y un Postgres "por confirmar" — la investigación real por SSH mostró lo contrario en ambos puntos antes de escribir `design.md`/`tasks.md`, así que el propio diseño ya reflejaba la realidad del servidor, no la suposición inicial. Sin impacto en el resultado final.
- **[calidad, resuelto durante `apply`]** `sudo -u postgres psql -f ~/moto-routes/...` falló por permisos del directorio home — resuelto pasando el SQL por stdin. Documentado en `tasks.md` (2.3) para que no se repita el mismo tropiezo en un futuro despliegue de otra tabla.
- **[higiene operativa, sin impacto en el resultado]** La contraseña de `appuser` se regeneró dos veces en la sesión (la primera copia local se borró por precaución de higiene antes de guardarla en el `.env.prod` del servidor). Sin consecuencia real — nadie llegó a depender de la primera contraseña — pero deja constancia de que manipular secretos generados a mano en una sesión larga es un punto donde es fácil perder el valor; para un futuro cambio con más secretos, considerar generarlos y consumirlos en el mismo paso sin borrarlos hasta confirmar que están guardados donde corresponde.
- **[deuda, ya anotada en el propio diseño]** Sin pipeline de CI/CD de despliegue — cada actualización futura de `apps/api` en el servidor requiere repetir `git pull` + `docker compose -f docker-compose.prod.yml up -d --build` a mano. Fuera de alcance explícito de este cambio (decidido con el usuario), candidato claro para un cambio futuro dedicado.

Sin hallazgos de tipo desviación, cobertura o convenciones de frontend — el único código de aplicación tocado es una propiedad de configuración con default seguro, ya verificada sin regresión en el entorno local.

## Veredicto

**APPROVED**

Los 6 escenarios de la única capability nueva (`server-deployment`) tienen verificación real contra el servidor de producción de verdad, ejecutada en esta misma revisión, no solo aceptada del resumen de la implementación. Ningún hallazgo de seguridad, ningún componente compartido crítico tocado, y las únicas anotaciones son deuda ya reconocida explícitamente por el propio diseño (sin CI/CD de despliegue) o detalles operativos sin consecuencia (regeneración de contraseña).
