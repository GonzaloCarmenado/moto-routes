## Context

`scripts/deploy-prod.sh` (ADR-041) ya automatiza los pasos mecánicos del despliegue (`ssh` → `git pull --ff-only origin master` → `docker compose -f docker-compose.prod.yml up -d --build` → verificación de salud), pero alguien tiene que ejecutarlo a mano desde una máquina que ya esté en la tailnet del servidor. Automatizar quién/cuándo lo dispara se descartó tres veces (ADR-033, ADR-036, ADR-041) por la filosofía de "ceremonia manual por defecto" del proyecto (ADR-029/030) — siempre quedó anotado como deuda pendiente. Esta vez se decide deliberadamente revertir esa deuda, tras revisar esas tres ADRs con el usuario.

El repositorio es público, y tiene un segundo colaborador (`viictoryraves`) con permiso de `push` — cualquiera de los dos puede empujar hoy un tag `v*`, que ya dispara `build-and-release` (la APK de Android). Este cambio añade un segundo job al mismo trigger.

El servidor de producción es alcanzable únicamente vía Tailscale (sin puertos expuestos a Internet); el usuario del servidor (`gonzalo`) tiene `sudo NOPASSWD:ALL` (ADR-033, trade-off ya aceptado, no se revisita aquí).

## Goals / Non-Goals

**Goals:**
- Que publicar una release (tag `v*`) pueda desplegar `apps/api` en producción sin que nadie tenga que conectarse a mano por SSH.
- Que ese despliegue automático nunca toque el servidor real sin una aprobación humana explícita de una persona concreta, independientemente de quién haya disparado el tag.
- Que las credenciales nuevas usadas por este mecanismo, si se filtraran, no den más capacidad que volver a lanzar el propio script de despliegue.

**Non-Goals:**
- No se restringe el usuario `gonzalo` del servidor a una cuenta de despliegue sin `sudo` — riesgo residual documentado en Risks, decisión que se deja para un cambio aparte si se considera necesario.
- No se modifica `scripts/deploy-prod.sh` en sí — su contrato (qué hace, cómo verifica salud) no cambia.
- No se añade rollback automático si el despliegue falla — el script ya termina con código de error y dejaría la última verificación de salud como evidencia; un rollback manual sigue el mismo procedimiento ya usado en incidentes anteriores (ADR-036).

## Decisions

### Decisión 1 — Acceso de red: `tailscale/github-action` con cliente OAuth, no un auth-key de larga duración
El runner de GitHub Actions necesita alcanzar un servidor sin puertos expuestos a Internet — la única vía ya establecida en el proyecto es la tailnet. Se usa la acción oficial `tailscale/github-action` (dependencia nueva, justificada: es la única forma soportada de unir un runner efímero a una tailnet, mantenida por el propio Tailscale) para que el runner se una a la red solo durante el job.

Se usa un **cliente OAuth de Tailscale** (`TS_OAUTH_CLIENT_ID`/`TS_OAUTH_CLIENT_SECRET`) en vez de un auth-key de larga duración: el cliente OAuth genera credenciales efímeras por ejecución y se puede revocar/rotar desde el panel de Tailscale sin tocar ningún secret de GitHub; un auth-key reusable, si se filtrara, seguiría siendo válido hasta su expiración fija. El cliente OAuth se restringe a un tag dedicado (`tag:ci-deploy`), con una política ACL de Tailscale que solo permite a ese tag alcanzar el servidor de producción por el puerto 22 — ningún otro dispositivo de la tailnet, ningún otro puerto.

### Decisión 2 — Autenticación: usuario `ci-deploy` cuya shell de login es `scripts/deploy-local.sh`, no una clave con `command=` forzado

**Descartado durante la implementación**: el plan original (clave `ed25519` dedicada con `command="~/moto-routes/scripts/deploy-prod.sh"` en `authorized_keys`) asumía un `sshd` tradicional en el servidor. Verificación real (`sudo ss -tlnp | grep ':22 '` vacío; `journalctl -u tailscaled` mostrando que toda sesión entrante se autentica vía `tailscaled be-child ssh`) confirmó que este servidor **no tiene sshd propio en absoluto** — Tailscale SSH es el único punto de entrada al puerto 22, y su implementación embebida no tiene equivalente al `command=` forzado de OpenSSH: una acción `accept` concede la shell de login *completa* configurada para el usuario destino, sin forma de fijar qué comando se ejecuta a nivel de política ACL.

**Diseño corregido**: un nuevo usuario de sistema `ci-deploy` en el servidor, sin `sudo`, cuya **shell de login** (`/etc/passwd`, campo shell) se fija al script versionado `scripts/deploy-local.sh` en vez de `/bin/bash`. Auditoría del servidor confirmó que Tailscale SSH invoca `tailscaled be-child ssh --login-shell=<shell-del-usuario> ... --cmd=<comando pedido por el cliente>` — es decir, la shell configurada es quien recibe el comando del cliente como argumento (semántica `shell -c cmd`); como `deploy-local.sh` no interpreta `$1` en absoluto, cualquier comando que un cliente SSH intente pedir se ignora sin efecto, y lo único que corre siempre es el script.

`deploy-local.sh` (nuevo, distinto de `deploy-prod.sh`) está pensado para ejecutarse **ya dentro** del servidor — no hace SSH hacia fuera como `deploy-prod.sh` (que asume ejecutarse desde una máquina externa), sino `git pull --ff-only` + `docker compose up -d --build` + verificación de salud contra `localhost:8080/api/ping`. `deploy-prod.sh` no se toca ni se reutiliza aquí; sigue siendo el path manual del usuario desde fuera del servidor.

El acceso de red (Decisión 1) sigue igual: la política ACL de Tailscale restringe `tag:ci-deploy` al puerto 22 del servidor. Se añade además un bloque `ssh` con `"action":"accept"` (no `"check"`, que exige reautenticación interactiva en navegador y es inviable en CI) que concede a `tag:ci-deploy` una sesión como el usuario `ci-deploy` — sin este bloque, el acceso de red no basta para abrir sesión SSH. El `dst` de ese bloque usa el tag ya asignado al dispositivo del servidor (`tag:ingress`), no su IP: los bloques `ssh` de Tailscale solo aceptan tag/grupo/autogroup como destino, nunca una IP directa.

**Nota (ADR-035, ya vigente en el proyecto)**: el host/IP real del servidor nunca vive en un fichero versionado — este repo es público. `scripts/deploy-local.sh` resuelve su propia IP de Tailscale en tiempo de ejecución (`tailscale ip -4`), nunca hardcodeada. El job `deploy-prod` del workflow toma el host al que conectarse desde un nuevo secret del Environment `prod` (`PROD_SERVER_HOST`), mismo patrón ya usado por `MOBILE_PROD_API_BASE_URL` en `build-and-release`.

### Decisión 3 — Gate de aprobación: GitHub Environment `prod` con revisor obligatorio
El repositorio tiene un segundo colaborador con permiso de `push`, así que restringir "quién puede tocar producción" no puede depender solo de quién empuja el tag. El Environment de GitHub `prod` (ya creado, con los secrets `CLIENTID`/`CLIENTSECRET` del cliente OAuth de Tailscale) está configurado con **Required reviewers = únicamente `GonzaloCarmenado`**. El nuevo job de despliegue declara `environment: prod`; GitHub pausa automáticamente cualquier ejecución que llegue a ese job hasta que un revisor autorizado la apruebe — y los secrets del Environment **no están disponibles a la ejecución hasta la aprobación**, no solo el paso se pausa visualmente. Con el diseño de Decisión 2, no hay clave SSH privada que guardar como secret: la autenticación de red es Tailscale (OAuth) y la restricción de "qué se ejecuta" vive en el servidor (shell de login de `ci-deploy`), no en un secret de GitHub.

Esto preserva la "ceremonia manual por defecto" del proyecto en su forma esencial (nada toca producción sin que una persona lo apruebe explícitamente) mientras automatiza el trabajo mecánico repetitivo — no es una contradicción de ADR-029/030, es la forma de tener ambas cosas.

### Decisión 4 — Toda la lógica de despliegue vive en un script versionado, no en el YAML
El job nuevo se limita a: unirse a la tailnet y ejecutar `ssh ci-deploy@debian` (sin pasar ningún comando explícito — la shell de login del usuario ya es `deploy-local.sh`, ver Decisión 2). Ningún paso del workflow reimplementa `git pull`/`docker compose`/verificación de salud — esa lógica vive en `scripts/deploy-local.sh`, un único sitio versionado y revisable igual que cualquier otro cambio de código.

## Risks / Trade-offs

- **[Riesgo] `ci-deploy` sin `sudo` sigue siendo equivalente a root vía el grupo `docker`** → `deploy-local.sh` necesita ejecutar `docker compose`, lo que exige que `ci-deploy` pertenezca al grupo `docker` — pertenecer a ese grupo es, en la práctica, equivalente a `root` (es un vector de escalada de privilegios ampliamente documentado: el socket de Docker permite montar cualquier ruta del host). Aunque `ci-deploy` no tiene `sudo` ni contraseña, la shell de login fija limita *qué comando* puede lanzar la sesión — pero ese comando (`docker compose up`) ya corre con capacidad efectiva de root sobre el host. Este diseño no elimina ese riesgo de fondo — solo evita que se dispare sin aprobación humana explícita y evita reutilizar la cuenta personal `gonzalo` (que además de `docker` tiene `sudo NOPASSWD:ALL`, ADR-033) para automatización. Documentado explícitamente para no ocultarlo, no resuelto aquí.
- **[Riesgo] Supply-chain de la propia `tailscale/github-action`** → Se fija a un SHA de commit concreto en el workflow (no una etiqueta flotante como `v3`), mismo criterio que ya deberían seguir otras acciones de terceros del proyecto.
- **[Riesgo] Un colaborador con permiso de escritura empuja un tag malicioso o accidental** → Mitigado por el gate de aprobación (Decisión 3): el tag dispara la ejecución, pero no el despliegue real. El riesgo de fondo (una cuenta de colaborador comprometida) ya existía para `build-and-release` y no es nuevo de este cambio.
- **[Trade-off] Un despliegue real siempre requiere que el usuario esté disponible para aprobar** → Aceptado deliberadamente: es exactamente el punto del gate (Decisión 3), coherente con la filosofía del proyecto. Si en el futuro se quiere desplegar sin esa dependencia, sería una decisión nueva y explícita, no un efecto secundario de este cambio.

**ADR nueva**: esta decisión revierte deliberadamente la deuda documentada en ADR-033/036/041 — se registrará como ADR-044 en `memory/decisions.md` al archivar este cambio, enlazando las tres ADRs previas y explicando por qué ahora sí.
