## Context

Ver `proposal.md` — Why. La auditoría de seguridad del servidor (2026-08-07) confirmó tres hallazgos sobre los que versan estos artefactos: el contenedor corre como `root`, MinIO está sin documentar, y el servidor arrastra un patrón de despliegue manual que ya rompió producción una vez (ADR-036). El despliegue actual es una secuencia recordada (`git pull` + `docker compose -f docker-compose.prod.yml up -d --build`), sin verificación automatizada de salud tras desplegar.

## Goals / Non-Goals

**Goals:**
- Que el proceso de `apps/api` en el contenedor de producción corra como usuario sin privilegios.
- Un script versionado y reproducible (`scripts/deploy-prod.sh`) que despliegue y verifique el servicio, sustituyendo al paso manual.
- Documentar MinIO en una ADR para que deje de ser un servicio "huérfano" en el servidor.

**Non-Goals:**
- Automatizar el despliegue vía webhook/GitHub Action → contradiría ADR-029/030/036 (ceremonia manual por defecto). El script sigue siendo una invocación manual, solo que reproducible.
- Cambiar `ci-cd` ni `.github/workflows/ci.yml`.
- Tocar `apps/mobile` ni la lógica de negocio de la API.
- Añadir ningún secreto ni variable de entorno nueva.

## Decisions

### D1. Usuario no-root definido en la imagen (`apps/api/Dockerfile`)
- **Decisión**: En la etapa runtime se crea un usuario/grupo sin privilegios (`appuser`), se ajustan permisos del binario y del directorio de trabajo, y se cambia con `USER appuser`. Se usa `groupadd`/`useradd` (paquete `passwd`, ya presente en `debian:trixie-slim` sin instalación adicional).
- **Alternativas**: `distroless`/`scratch` con `nonroot` — ya descartado en ADR-034 (paridad operativa de `debian:trixie-slim` para diagnóstico vía `docker exec`); imagen `gcr.io/distroless/static-debian12:nonroot` exigiría cambiar la base del runtime, rompiendo esa paridad. `USER 65532:65532` con UID numérico evita el paso `adduser` pero da peor diagnóstico (`nobody` en `ps`) y no cuadra con el patrón existente.
- **Consecuencia**: `network_mode: host` y `env_file` de `docker-compose.prod.yml` se mantienen intactos; el usuario no-root no necesita NFS ni puertos privilegiados (la API escucha en `:8080`, >1024).

### D2. Script `scripts/deploy-prod.sh` (Bash, SSH por Tailscale)
- **Decisión**: Script Bash ejecutable desde la máquina de desarrollo que: (1) hace `ssh` por Tailscale al servidor (`gonzalo@debian`, ya verificado funcional en ADR-033/034 y en esta auditoría), (2) en el servidor ejecuta `git pull --ff-only origin master && docker compose -f docker-compose.prod.yml up -d --build`, (3) desde local comprueba `curl -sf` contra `https://debian.taildf3dab.ts.net/api/ping` (URL pública de Funnel, no la IP interna — usable también desde fuera del tailnet), (4) termina con código de error ≠ 0 si cualquier paso falla o la salud no responde `200`.
- **Alternativas**: Webhook/GitHub Action con `ssh` — descartada (ADR-029/030/036). `tailscale ssh` interactivo con `ssh-agent` — el script asume que el agente ya está autenticado (precedente real de ADR-033). Script PowerShell `.ps1` nativo — la mayoría de documentación y precedentes del proyecto usan Bash (scripts/ ya tiene `.sh` para Android), y el servidor es Debian; se mantiene Bash.
- **Parámetros**: los datos de conexión (`SERVER_HOST`, `SERVER_USER`, `PUBLIC_API_URL`) **no llevan valores reales versionados** — el repo es público y el host Tailscale ya se redacta en docs (ADR-033/035). El script los resuelve por orden: (1) variables de entorno al invocar, (2) fichero no versionado `scripts/.env.deploy.local` (gitignored, mismo patrón que `infra/docker/.env.prod`), (3) fallo con mensaje claro si falta.

### D3. ADR-041 — documentar MinIO
- **Decisión**: Nueva ADR en `memory/decisions.md` documentando MinIO: origen (provisión anticipada para blob storage), estado actual (servicio `systemd` `minio.service`, usuario `minio-user`, solo loopback `127.0.0.1:9000/9001`, **sin código consumidor**), y la regla de que su uso real exige un cambio con su propia ADR/OpenSpec.
- **Alternativa**: quitar MinIO del servidor — rechazada: el usuario confirmó en una auditoría previa que es provisión intencionada; eliminarlo sería destructivo y prematuro mientras el blob storage sigue pendiente (ADR-034).

### D4. Sin dependencias nuevas
- No se añade ninguna dependencia npm/Cargo. El Dockerfile usa utilidades de `debian:trixie-slim` (addgroup/adduser ya disponibles); el script usa Bash + `ssh` + `curl` estándar.

## Risks / Trade-offs

- [**El contenedor no-root deja de poder escribir donde antes podía**] → La API no persiste nada en el contenedor (Postgres es externo vía loopback, sin volúmenes en `docker-compose.prod.yml`); solo necesita lectura del binario y escribir en `/tmp` si el runtime lo usa. Se verificará con el despliegue real.
- [**El script asume Tailscale SSH ya autenticado con `gonzalo` sin password**] → Misma asunción que todos los despliegues previos (ADR-033/034); si falla la autenticación, el script falla con mensaje claro y termina ≠ 0. Documentado en el propio script.
- [**Redesplegar con imagen nueva puede aplicar migraciones (0005) y cambiar comportamiento**] → Es el objetivo del cambio (activar `/api/routes`). Rollback: imagen anterior etiquetada antes del despliegue (`docker tag docker-api docker-api:pre-hardening`), mismo patrón que ADR-034/038.
- [**`network_mode: host` + usuario no-root**] → No interfiere: no se necesitan puertos <1024 (la API usa 8080) ni modificaciones de red.

## Migration Plan

1. Etiquetar la imagen actual en el servidor para rollback (`docker tag docker-api:latest docker-api:pre-hardening`).
2. Cambiar `apps/api/Dockerfile` (D1) y crear `scripts/deploy-prod.sh` (D2).
3. Ejecutar `scripts/deploy-prod.sh` — pull + rebuild + up + verificación `/api/ping`.
4. Verificar en el servidor: proceso no-root (`docker exec <c> ps -o user= -p 1`), migración `0005` aplicada, `/api/routes` responde (con y sin token).
5. Añadir ADR-041 a `memory/decisions.md` (D3).
6. Actualizar `memory/context.md` con el cierre del cambio (patrón establecido).

## Open Questions

Ninguna. Las decisiones pendientes (qué hacer con `docker-api:pre-go-migration`/`pre-reset-contrasena` ya etiquetadas, o si MinIO debe recibir credenciales de Funnel) no afectan a los specs ni al enfoque de este cambio.