# Review — `hardening-despliegue-servidor`

## CRÍTICO (leer primero)

- **Sin secretos ni cambios de autenticación/autorización.** El cambio no toca `internal/auth/`, no añade ninguna credencial ni variable de entorno nueva. Los únicos datos de conexión al servidor (`SERVER_HOST`, `SERVER_USER`, `PUBLIC_API_URL`) se resuelven en runtime desde variables de entorno o `scripts/.env.deploy.local` (gitignored), nunca versionados — verificado con `git diff master..feature/hardening-despliegue-servidor` buscando secretos reales, contraseñas, API keys y bloques `BEGIN PRIVATE KEY`: sin hallazgos. La IP de Tailscale y el hostname de Funnel que aparecen en `docs/informe-tecnico-seguridad.md`/`scripts/deploy-prod.sh` ya eran públicos en ADRs anteriores (ADR-033/036/038) antes de este cambio — no es información nueva expuesta.
- **Sin cambios en `src/shared/` ni en `apps/mobile`.** El cambio es exclusivamente `apps/api/Dockerfile`, `scripts/deploy-prod.sh` (nuevo), `.gitignore`, y documentación/memoria. Sin radio de impacto sobre frontend o componentes compartidos.
- **Tres bugs reales encontrados y corregidos en esta revisión, antes del despliegue real** (ninguno de seguridad, todos de correctitud del script):
  1. `scripts/deploy-prod.sh` construía el comando remoto como `cd '$REMOTE_DIR'` con `REMOTE_DIR="~/moto-routes"` — con comillas simples, `~` no se expande y el `cd` habría fallado en el primer uso real contra el servidor. Verificado el bug y el fix con una simulación de las dos capas de shell (local construye el string → `ssh` → shell remoto lo reparsea desde cero) antes de tocar el servidor de verdad.
  2. Un backtick dentro de un `echo "..."` con comillas dobles ejecutaba de verdad `` `chmod 600` `` como sustitución de comandos en vez de imprimirlo literalmente (comprobado con un caso mínimo reproducido en bash).
  3. Variable `REPO_DIR` calculada y nunca usada — código muerto, eliminado.
  Los tres corregidos antes del primer despliegue real de esta sesión contra producción (commit `3005523` en adelante).
- **Desviación documentada del propio `tasks.md` (4.2)**: el script hace `git pull --ff-only origin master`, que todavía no incluye este cambio (no fusionado). Siguiendo el mismo patrón ya usado en ADR-034/038/039 (desplegar desde la rama sin fusionar para verificar antes de mergear), la verificación real de este cambio se hizo con `git checkout feature/hardening-despliegue-servidor` manual en el servidor + `docker compose up -d --build`, **no** con una invocación literal de `scripts/deploy-prod.sh` de principio a fin. El script en sí (su lógica de pull+build+verify) queda revisado por código y con sintaxis validada (`bash -n`), pero su **Scenario "El script falla si el servicio no queda sano" no tiene verificación de ejecución real** — ver tabla de cobertura.

## Cobertura Requirement → Scenario → Verificación

| Requirement | Scenario | Verificación | Estado |
|---|---|---|---|
| El contenedor de la API se ejecuta con un usuario no-root | El proceso de la API no corre como root en producción | `docker exec docker-api-1 id` en el servidor real → `uid=999(appuser) gid=999(appuser)`. (`docker exec ... ps` no sirve: `debian:trixie-slim` no trae `procps`; se usó `id` y `docker top docker-api-1`, que usa el `ps` del host) | ✅ Verificado en producción real |
| El contenedor de la API se ejecuta con un usuario no-root | La API sigue respondiendo tras el cambio de usuario | `curl https://debian.taildf3dab.ts.net/api/ping` → `200` tras el rebuild con el usuario no-root | ✅ Verificado en producción real |
| El despliegue de producción se realiza con un script versionado que verifica la salud | El script despliega y verifica la salud del servicio | **No ejecutado literalmente** (ver Desviación arriba) — se ejecutaron manualmente los mismos tres pasos (pull/checkout, `docker compose up -d --build`, verificación `curl`) contra el servidor real con éxito. La lógica del script (`scripts/deploy-prod.sh`) fue revisada línea a línea, dos bugs corregidos, sintaxis validada con `bash -n` | ⚠️ Verificado por equivalencia manual, no por ejecución directa del script |
| El despliegue de producción se realiza con un script versionado que verifica la salud | El script falla si el servicio no queda sano | **Sin verificación de ejecución real** — el camino de fallo (`curl -fsS` no responde 200 → `exit 1`) se apoya en `set -euo pipefail` y en la lógica ya usada en scripts previos del proyecto, pero no se ha forzado un fallo real (p. ej. parando el contenedor a mitad) para confirmar el código de salida y el mensaje | ❌ Gap — no verificado, riesgo bajo (lógica simple, patrón ya usado) |

**Objetivo de cobertura**: 2/4 escenarios verificados en producción real, 1/4 verificado por equivalencia manual (mismo resultado, distinto mecanismo de invocación), 1/4 sin verificar (gap, bajo riesgo).

## Hallazgos

### Gap
- **`scripts/deploy-prod.sh` nunca se ha ejecutado como una sola invocación de principio a fin contra el servidor real** (ver Desviación en CRÍTICO). Recomendación: la primera vez que se use de verdad para un despliegue futuro (ya con este cambio fusionado a `master`), prestar atención a si falla en el paso de `ssh`/`git pull` por algo no cubierto en esta revisión (p. ej. permisos, rama distinta de `master` en el servidor).
- **Escenario "el script falla si el servicio no queda sano" sin verificación de ejecución real** — riesgo bajo (lógica simple: `curl -fsS` + `set -e`), pero no confirmado con un fallo real inducido.

### Calidad (ya corregido durante esta revisión, no queda deuda)
- Los tres bugs de `scripts/deploy-prod.sh` (tilde sin expandir, backtick ejecutado, variable sin usar) y la basura de tool-call al final de `docs/informe-tecnico-seguridad.md` — corregidos antes del despliegue real, ver CRÍTICO.
- Desalineamiento `design.md`/código (`addgroup`/`adduser` documentado vs. `groupadd`/`useradd` implementado) — corregido el texto del diseño para reflejar el código ya verificado.

### Convenciones de proyecto
- Sin desviaciones — el cambio no toca `apps/mobile`, no introduce CSS ni componentes, no requiere `data-cy`.

## Veredicto

**APPROVED WITH MINOR ISSUES**

Los dos requisitos de usuario no-root están verificados de punta a punta en producción real. El requisito del script versionado está funcionalmente correcto y verificado por equivalencia (los mismos pasos, ejecutados a mano, funcionan en el servidor real), pero con dos gaps de verificación menores y no bloqueantes: (1) el script en sí no se ha invocado literalmente como una sola llamada — solo puede hacerlo tras fusionar, porque hace `git pull origin master`; (2) su camino de fallo no se ha forzado nunca de verdad. Ninguno de los dos es un problema de seguridad ni de datos — son gaps de verificación de un script de infraestructura sencillo, con la lógica ya revisada por código. Recomendación: la próxima vez que se use `scripts/deploy-prod.sh` de verdad (ya con `master` al día), confirmar que corre sin intervención manual.
