## Why

`apps/api` en producción solo registra con `log.Printf`/`log.Fatal` sin estructura ni persistencia consultable (`cmd/api/main.go`, `httpmw/recover.go`) — un panic recuperado, un 5xx o un aviso degradado (p. ej. "FCM_SERVICE_ACCOUNT_JSON not set") solo se ven si alguien está mirando `docker compose logs` en ese instante. No hay ninguna visibilidad del estado del host (memoria, disco) ni de si un email enviado por Resend acaba rebotando o fallando en destino — el fallo se descubre hoy porque un usuario reporta "no me llegó el email", no porque el sistema lo señale.

[[ADR-045]] ya dejó documentado este gap tras un incidente real (Tailscale Funnel dejó de resolver en público durante casi dos días sin que nada lo detectara) y lo marcó como "candidato claro para un cambio futuro". Este cambio lo cierra, ampliado al alcance pedido: llamadas fallidas, warnings, memoria, disco y fallos de entrega de email.

## What Changes

- El logging de `apps/api` pasa de `log.Printf`/`log.Fatal` sin estructura a un registro estructurado de eventos (error/warning) con contexto (ruta, código de estado, mensaje), persistido en el propio servidor de forma que sobrevive a un reinicio del contenedor.
- Nuevo endpoint admin (`GET /admin/status` o similar, ver design.md) que devuelve: los últimos eventos de error/warning, memoria disponible/usada del host, espacio en disco disponible/usado del host, y los últimos fallos de entrega de email — protegido con un secreto propio (no reutiliza el JWT de usuario, no existe rol admin hoy).
- Nuevo endpoint webhook (`POST /api/webhooks/resend` o similar) que recibe los eventos de Resend (`email.bounced`, `email.delivery_delayed`, `email.failed`, `email.complained` — confirmado que Resend los ofrece vía webhooks firmados con Svix) y los deja disponibles en el mismo registro de eventos.
- Recolección periódica de memoria/disco del host (el contenedor de `api` no ve el disco del host directamente bajo el `docker-compose.prod.yml` actual — ver design.md para el mecanismo elegido).
- **Sin cambios de requisito en ninguna capability existente** — es observación pasiva, no toca el comportamiento de amigos/rutas/auth.

## Capabilities

### New Capabilities
- `registro-errores-api`: captura y consulta de llamadas fallidas y warnings del backend, con el endpoint admin para verlos.
- `metricas-recursos-servidor`: estado de memoria y espacio en disco del servidor de producción, consultable en el mismo endpoint admin.
- `alertas-fallos-email`: recepción de eventos de fallo de entrega de Resend (bounce, delay, fallo, queja) vía webhook, consultables en el mismo endpoint admin.

### Modified Capabilities
(ninguna — ver arriba)

## Impact

- `apps/api/cmd/api/main.go`: wiring del logger estructurado, del recolector de métricas y del nuevo router admin/webhook.
- `apps/api/internal/httpmw/recover.go` y cualquier otro `log.Printf` existente (`main.go`, handlers): migran al registro estructurado nuevo.
- `apps/api/internal/email/resend.go`: posible extensión o paquete hermano nuevo para el webhook de Resend (reutiliza el patrón "sin SDK, net/http estándar" ya establecido aquí).
- `infra/docker/docker-compose.prod.yml`, `.env.prod.example`: variables nuevas (secreto del endpoint admin, secreto de verificación del webhook de Resend) y, según el mecanismo elegido en design.md, un volumen o script adicional para exponer memoria/disco del host.
- `openspec/specs/server-deployment/`: sin cambio de requisitos (el health-check post-deploy ya existente es distinto de este registro continuo), pero es contexto relacionado a revisar.
