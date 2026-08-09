## 1. Tailscale: cliente OAuth y política ACL dedicados

- [x] 1.1 (usuario, panel de Tailscale) Crear un tag nuevo `tag:ci-deploy` en la política ACL, con un `acls` que solo permita a ese tag alcanzar el servidor de producción por el puerto `22`, nada más de la tailnet. Hallazgo real durante esta tarea: la política ya tenía un `grants` comodín (`"src":["*"]`) que anulaba cualquier restricción por `acls` — corregido acotándolo a `autogroup:member`, excluyendo así a `tag:ci-deploy` del acceso general.
- [x] 1.2 (usuario, panel de Tailscale) Cliente OAuth creado, restringido al tag `tag:ci-deploy`.
- [x] 1.3 Client ID/Secret confirmados por el usuario como ya guardados en los secrets `CLIENTID`/`CLIENTSECRET` del Environment `prod` (nunca vistos por este agente) — no en ningún fichero del repositorio.

## 2. Servidor: usuario `ci-deploy` restringido a `scripts/deploy-local.sh`

Hallazgo real durante esta tarea (invalida el diseño original de clave SSH con `command=` forzado): el servidor no tiene `sshd` tradicional — `sudo ss -tlnp | grep ':22 '` no devuelve nada, todo el acceso SSH pasa por la implementación embebida de Tailscale SSH, que no soporta forzar un comando vía ACL. Ver `design.md` Decisión 2 para el diseño corregido: la restricción se aplica fijando la **shell de login** del usuario, no la clave.

- [x] 2.1 Escribir `scripts/deploy-local.sh` (nuevo, distinto de `deploy-prod.sh`): pensado para ejecutarse ya dentro del servidor — `git pull --ff-only origin master` → `docker compose -f infra/docker/docker-compose.prod.yml up -d --build` → verificación de salud (`curl`, con reintentos cortos) contra la IP de Tailscale del servidor. `deploy-prod.sh` no se modifica, sigue siendo el path manual desde fuera. Dos hallazgos reales corregidos: (1) la API solo escucha en la IP de Tailscale del servidor (`network_mode: host`, sin bind a loopback) — `localhost:8080` nunca conecta aunque el script corra en el propio servidor; (2) la IP se había hardcodeado inicialmente en el script — corregido a resolverla en tiempo de ejecución (`tailscale ip -4`), ya que este repo es público y ADR-035 prohíbe explícitamente comitear el host/IP real (mismo criterio ya aplicado en `deploy-prod.sh` y en `MOBILE_PROD_API_BASE_URL`).
- [x] 2.2 Usuario de sistema `ci-deploy` creado en el servidor (`useradd -m -N -G docker -s /home/gonzalo/moto-routes/scripts/deploy-local.sh ci-deploy`, sin `sudo`, sin contraseña). Como el repo real vive en `/home/gonzalo/moto-routes` (no en el `$HOME` de `ci-deploy`), se usan ACLs POSIX (`setfacl`) para dar acceso quirúrgico: `--x` (solo tránsito, sin listar) sobre `/home/gonzalo`, y `rwX` recursivo + ACL por defecto sobre `/home/gonzalo/moto-routes` únicamente — el resto del `$HOME` de `gonzalo` (`.ssh`, etc.) permanece inaccesible. `git safe.directory` configurado para `ci-deploy` (repo con dueño distinto). Corregido además `REMOTE_DIR` en el script: usaba `$HOME` (que para `ci-deploy` no es `/home/gonzalo`), cambiado a ruta fija.
- [x] 2.3 Bloque `ssh` con `"action":"accept"` añadido a la política ACL de Tailscale, concediendo a `tag:ci-deploy` sesión como `ci-deploy` en el servidor (`dst: ["tag:ingress"]`, el tag ya asignado al dispositivo del servidor). Dos errores de validación reales durante el guardado, corregidos: (1) `dst` no admite una IP directa en un bloque `ssh` — solo tag/grupo/autogroup, según la documentación de Tailscale; (2) `tag:ingress` no estaba declarado en `tagOwners` pese a estar ya aplicado al dispositivo — la política lo rechazaba como tag desconocido hasta declararlo. Guardado confirmado por el usuario. La verificación end-to-end de una sesión real autenticada vía el cliente OAuth (como la usará el runner efímero de GitHub Actions) queda para el grupo 5, ya que requiere las credenciales OAuth reales que este agente nunca ha tenido ni debe tener.
- [x] 2.4 Verificación real (no simulada) ejecutada dos veces: `ssh ci-deploy@debian "echo comando-ignorado"` — el comando pedido se ignoró por completo ambas veces y solo se ejecutó `deploy-local.sh` (confirmado en logs: `git pull` + `docker compose up -d --build` + recreación real de `docker-api-1` + verificación de salud en `200`). Primera ejecución reveló y corrigió dos bugs reales (servidor en la rama equivocada — ver nota de la sección; healthcheck contra la IP equivocada — ver 2.1). Segunda ejecución, ya con los fixes, completó con éxito.
- [x] 2.5 Ninguna credencial nueva de este grupo (no hay clave privada en este diseño) se comitea; el único artefacto nuevo versionado es `scripts/deploy-local.sh`, que no contiene secretos.

**Hallazgo adicional (no relacionado con `ci-deploy` en sí)**: el checkout de producción estaba en `feature/almacenamiento-fotos-backend` en vez de `master` (residuo de pruebas de sesiones anteriores) — corregido con `git checkout master && git pull --ff-only` antes de la verificación 2.4. De no corregirse, cualquier despliegue automático habría fallado siempre en el paso `git pull --ff-only`.

## 3. GitHub: Environment `prod` con revisor obligatorio y secrets

- [x] 3.1 Environment `prod` ya creado en el repositorio, con "Required reviewers" = únicamente `GonzaloCarmenado` (`prevent_self_review: false`, deliberado — el único revisor debe poder aprobar su propio disparo).
- [x] 3.2 Secrets del Environment `prod` ya presentes: `CLIENTID`/`CLIENTSECRET` del cliente OAuth de Tailscale (grupo 1). No hay clave SSH privada que añadir — el diseño corregido (grupo 2) no la usa.
- [ ] 3.3 Test (verificación manual): intentar acceder a los secrets del Environment desde un contexto que no sea una ejecución aprobada del job `deploy-prod` (por ejemplo, otro job del mismo workflow sin `environment: prod`) y confirmar que no están disponibles.

## 4. Workflow: nuevo job `deploy-prod` en `ci.yml`

- [x] 4.1 Job `deploy-prod` añadido a `.github/workflows/ci.yml`, `needs: [quality-go]` (solo depende de la calidad del backend, no del build de Android), disparado por el mismo `if: startsWith(github.ref, 'refs/tags/v')` que ya usa `build-and-release`, con `environment: prod`.
- [x] 4.2 Pasos: `tailscale/github-action` fijado al SHA de `v4.1.3` (`780049a30b6ff5c378a9e7b389d15ece7a204888`) con `oauth-client-id: ${{ secrets.CLIENTID }}` / `oauth-secret: ${{ secrets.CLIENTSECRET }}` / `tags: tag:ci-deploy` → `ssh ci-deploy@${PROD_SERVER_HOST}` (nuevo secret del Environment `prod`, ya guardado — el host real no se hardcodea en el YAML por la misma razón de ADR-035 que en el punto 2.1) sin pasar comando explícito (la shell de login del usuario ya es `scripts/deploy-local.sh`) → `set -e` de bash hace que el job falle si `ssh` devuelve un código de salida distinto de cero.
- [ ] 4.3 El job no debe imprimir en los logs las credenciales OAuth — revisar la salida de una ejecución real (grupo 5) antes de dar la tarea por cerrada.

## 5. Verificación end-to-end real

- [ ] 5.1 Empujar un tag de prueba real (o usar el flujo de una release real ya prevista) y confirmar en la pestaña Actions que el job `deploy-prod` queda en estado "Waiting" hasta la aprobación.
- [ ] 5.2 Aprobar la ejecución y confirmar que el despliegue se completa con éxito — mismo resultado que una ejecución manual de `scripts/deploy-prod.sh` (verificación de salud `GET /api/ping` en `200`).
- [ ] 5.3 Confirmar que un segundo colaborador (o una cuenta sin permiso de aprobación) no puede aprobar la ejecución — revisar los permisos reales del Environment, no solo asumirlos.
- [ ] 5.4 Revisar el diff completo buscando secretos reales antes de abrir el PR — ninguna clave, client ID/secret o token debe aparecer en texto plano en ningún fichero versionado.

## 6. Cierre

- [ ] 6.1 Actualizar `memory/context.md` con el estado final de este cambio.
- [ ] 6.2 Añadir ADR-044 a `memory/decisions.md` documentando esta decisión, enlazando ADR-029/030/033/036/041 y explicando por qué se revierte la deuda ahora (ver design.md).
