## CRÍTICO

- **Seguridad**: sin secretos reales en el diff (verificado con `git diff` sobre los ficheros tocados, buscando valores de `AUTH_TOKEN_SECRET`/`RESEND_API_KEY`/`MINIO_*_KEY`/`PHOTO_ENCRYPTION_KEY` — solo aparecen nombres de variable, nunca valores). El valor real de `MAPMATCH_OSRM_URL` añadido al `.env.prod` del servidor no es un secreto (`http://127.0.0.1:5000`, loopback) y ese fichero no está versionado — nunca tocó git. `osrm-routed` se corrigió para escuchar en `127.0.0.1` explícito (`--ip`) en vez del `0.0.0.0` por defecto, evitando exposición en las interfaces públicas del servidor bajo `network_mode: host` — ver [[ADR-053]].
- **`src/shared/`**: sin cambios — este cambio no toca `apps/mobile` ni `apps/api`, solo infraestructura de despliegue (`infra/docker/`) y documentación/memoria.
- **Dependencias**: sin dependencias nuevas de npm/Cargo/Go. Imagen Docker ya usada en dev (`ghcr.io/project-osrm/osrm-backend`), sin pin de versión explícito (mismo criterio que el `osrm` de dev — ninguno de los dos fija tag).
- **Reglas saltadas**: ninguna regla del proyecto se saltó. Sí hubo una desviación real del plan original a mitad de sesión (ver Desviaciones) — documentada y aprobada por el usuario en el momento, no oculta.

## Cobertura de escenarios

`skip_specs: true` — sin delta specs, sin escenarios Given/When/Then que mapear. La spec `normalizacion-gps` (`openspec/specs/normalizacion-gps/spec.md`) no cambia: su escenario "Servicio de normalización no disponible" ya cubría el estado anterior (variable vacía), y activarla no introduce comportamiento nuevo observable por esa spec.

Verificación real realizada (no hay tests automatizados de infraestructura Docker/despliegue en este repo — se verificó operacionalmente):

| Verificación | Método | Resultado |
|---|---|---|
| Sintaxis `docker-compose.prod.yml` | `docker compose config` con `.env.prod` dummy | OK |
| `osrm` arranca con datos reales (local) | `docker compose up -d osrm`, healthcheck, `/nearest` real | `healthy`, 200 con match real (Puerta del Sol) |
| `osrm` no bloquea `api` si falla | Inspección de `docker-compose.prod.yml` (`api` sin `depends_on: osrm`) | Confirmado estructuralmente |
| `osrm` arranca con datos reales (servidor de producción) | `docker compose up -d osrm` con copia temporal del compose, revertida después | `healthy`, 200 con match real, sin afectar a `api` ni a `intercom-signaling` |
| `api` sano tras activar `MAPMATCH_OSRM_URL` | `curl /api/ping` en la IP de Tailscale del servidor | 200 |
| `--ip 127.0.0.1` evita exposición pública | Log de arranque de `osrm-routed` | `IP address: 127.0.0.1` confirmado, en local y en el servidor |

## Hallazgos

- **[Desviación, aprobada explícitamente]** El `proposal.md` original decía "no se ejecuta el procesado real en el servidor... como parte de este cambio (sin acceso SSH en esta sesión)". A mitad de sesión el usuario autorizó acceso SSH real (Tailscale ACL + SSH, aprobado desde el panel web) y pidió activar la normalización de verdad. `proposal.md`, `design.md` y `memory/decisions.md` (ADR-053) se actualizaron para reflejar lo ejecutado — código y artefactos no quedaron desalineados.
- **[Desviación, aprobada explícitamente]** El plan de `design.md`/README asumía ejecutar `prepare-osm-data.sh` en el propio servidor. Al comprobar `free -h` (paso explícito ya planeado para este caso), el servidor resultó tener solo 5.6 GiB de RAM — muy por debajo de los ~11.4 GB de pico local — y aloja un servicio de otro proyecto (`intercom-signaling`). Sustituido por copiar los ficheros ya procesados vía `scp`, comunicado al usuario antes de proceder (`AskUserQuestion`). README actualizado con ambas rutas.
- **[Calidad, menor]** El `docker-compose.prod.yml` del servidor no incluye todavía el servicio `osrm` de forma oficial (git) — el contenedor corre ahí desde una copia temporal ya revertida. Sin riesgo funcional (misma definición exacta que traerá el merge, contenedor ya verificado sano), pero significa que hasta que se mergee esta PR y corra `deploy-local.sh`, el servicio `osrm` en producción no está bajo control de git/Compose oficialmente — es responsabilidad clara del siguiente despliegue, no un defecto de este cambio.
- **[Fuera de alcance, no bloqueante]** `FCM_SERVICE_ACCOUNT_JSON` tampoco está en el `.env.prod` real — notificaciones push inactivas en producción. Sin relación con este cambio, anotado en `memory/context.md` para otra sesión.

## Veredicto

**APPROVED WITH MINOR ISSUES** — el único hallazgo de calidad (servicio `osrm` en el servidor sin cobertura oficial de git hasta el merge) es autolimitante: se resuelve solo con el propio merge + próximo despliegue, sin acción adicional. Sin problemas de seguridad, sin reglas saltadas sin justificar, sin componentes compartidos afectados.
