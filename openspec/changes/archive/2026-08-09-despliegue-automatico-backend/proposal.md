## Why

El despliegue de `apps/api` en producción es hoy 100% manual: alguien tiene que acordarse de ejecutar `scripts/deploy-prod.sh` por SSH tras cada cambio relevante. Ya ha causado un incidente real (ADR-036: la release `v0.1.0` falló porque el servidor no se había redesplegado tras mergear `catalogo-tipos-parada`). La automatización se planteó y se descartó explícitamente tres veces (ADR-033, ADR-036, ADR-041) por la filosofía de "ceremonia manual por defecto" del proyecto (ADR-029/030) — siempre quedó anotada como deuda pendiente para "un cambio futuro dedicado". Este es ese cambio, decidido deliberadamente con el usuario tras revisar esas tres ADRs.

## What Changes

- Nuevo job en `.github/workflows/ci.yml`, disparado por el mismo trigger por tag `v*` que ya usa `build-and-release`, que ejecuta `scripts/deploy-prod.sh` contra el servidor de producción — sin reescribir el script, solo cambia quién lo invoca.
- El runner se une a la tailnet solo durante el job vía la acción oficial `tailscale/github-action`, usando un cliente OAuth de Tailscale (no un auth-key de larga duración) con un tag ACL dedicado, restringido por política de Tailscale a alcanzar el servidor de producción únicamente por el puerto 22.
- Nuevo usuario de sistema `ci-deploy` en el servidor (sin `sudo`, en el grupo `docker`), cuya shell de login se fija al nuevo script versionado `scripts/deploy-local.sh` en vez de una shell libre — así, conectarse como ese usuario ejecuta siempre ese script, sin importar qué comando pida el cliente SSH. **Nota de implementación**: el diseño original (clave SSH dedicada con `command=` forzado en `authorized_keys`) se descartó al descubrir que el servidor no tiene `sshd` tradicional — todo el acceso SSH pasa por Tailscale SSH, que no soporta forzar comandos vía ACL; ver `design.md` Decisión 2.
- Nuevo script `scripts/deploy-local.sh` (distinto de `deploy-prod.sh`): pensado para ejecutarse ya dentro del servidor (sin SSH saliente) — `git pull --ff-only` + `docker compose up -d --build` + verificación de salud local. `deploy-prod.sh` no se modifica, sigue siendo el path manual desde fuera.
- Environment de GitHub `prod` (ya creado) con "Required reviewers" = solo el usuario (`GonzaloCarmenado`) — el job de despliegue se engancha a ese entorno, así que cualquier ejecución (la dispare quien la dispare) queda pausada esperando su aprobación explícita antes de tocar el servidor real. Los secrets del cliente OAuth de Tailscale viven en ese Environment, no en el repositorio — inaccesibles hasta la aprobación. No hay clave SSH privada que guardar: la restricción de qué se ejecuta vive en el servidor, no en un secret.

**Fuera de alcance (no-goals)**:
- No se restringe el usuario del servidor (`gonzalo`, con `sudo NOPASSWD:ALL` ya aceptado en ADR-033) a una cuenta de despliegue sin privilegios — riesgo residual documentado explícitamente en `design.md`, a decidir en un cambio aparte si se considera necesario.
- No se toca `scripts/deploy-prod.sh` en sí (su lógica de pull/build/verificación de salud sigue igual) — solo gana un nuevo invocador automatizado, además del manual ya existente.
- No se cambia nada del despliegue de `apps/mobile` (build-and-release de la APK sigue igual).

## Capabilities

### New Capabilities
(ninguna — este cambio añade un mecanismo de disparo nuevo a una capacidad ya existente)

### Modified Capabilities
- `server-deployment`: se añaden requisitos nuevos sobre el disparo automatizado del despliegue desde CI (gate de aprobación humana obligatoria, alcance mínimo de las credenciales usadas) — no se modifica ningún requisito ya existente sobre lo que hace `scripts/deploy-prod.sh` en sí.

## Impact

- `.github/workflows/ci.yml` — nuevo job `deploy-prod`, condicionado al mismo trigger `refs/tags/v*`, con `environment: prod`.
- `scripts/deploy-local.sh` (nuevo) — script versionado que hace el despliegue real, ejecutado como shell de login de `ci-deploy` en el servidor.
- GitHub (fuera del repositorio, gestión manual vía web/`gh`): Environment `prod` (ya creado) con revisor obligatorio; secrets a nivel de Environment (credenciales del cliente OAuth de Tailscale — sin clave SSH, no aplica con el diseño corregido).
- Tailscale (fuera del repositorio): política ACL para el tag dedicado `tag:ci-deploy` (acceso de red al puerto 22 + bloque `ssh` con acción `accept` para abrir sesión como `ci-deploy`), y el cliente OAuth correspondiente creado en el admin panel de Tailscale.
- Servidor de producción: nuevo usuario de sistema `ci-deploy` (grupo `docker`, sin `sudo`) con shell de login fijada a `scripts/deploy-local.sh` — sin tocar `scripts/deploy-prod.sh`, la cuenta `gonzalo` ni la configuración ya existente.
- `openspec/specs/server-deployment/spec.md` — delta con los requisitos nuevos sobre el disparo automatizado.
