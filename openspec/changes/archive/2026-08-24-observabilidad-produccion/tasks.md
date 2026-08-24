## 1. Registro estructurado de eventos (base)

- [x] 1.1 Test: un evento escrito por el registrador es legible de vuelta (nivel, mensaje, ruta/método opcional, timestamp), en un paquete nuevo `internal/opslog` (o nombre equivalente)
- [x] 1.2 Implementación mínima: escritura append-only a fichero JSONL configurable por ruta, lectura de las últimas N líneas
- [x] 1.3 Test: por debajo de `EVENTS_LOG_MAX_SIZE_BYTES` (env var nueva, ver design.md §1) los eventos se añaden sin descartar ninguno
- [x] 1.4 Test: al superar `EVENTS_LOG_MAX_SIZE_BYTES` se descartan primero los eventos más antiguos antes de escribir el nuevo, manteniendo el tamaño acotado
- [x] 1.5 Test: una ráfaga de muchos más eventos que la capacidad configurada no hace crecer el fichero por encima del límite en ningún momento
- [x] 1.6 Implementación de la rotación/truncado por tamaño máximo configurable
- [x] 1.7 Test: eventos siguen siendo legibles tras cerrar y reabrir el fichero (simula un reinicio del proceso)

## 2. Migrar el logging existente al registro nuevo

- [x] 2.1 Test: un panic recuperado por `httpmw.Recover` genera un evento de error en el registro nuevo (sin cambiar la respuesta HTTP genérica ya existente)
- [x] 2.2 Cablear `httpmw/recover.go` al registrador nuevo
- [x] 2.3 Test: una respuesta 5xx de un handler genera un evento de error (vía middleware o wrapper de respuesta)
- [x] 2.4 Implementación del middleware/wrapper que detecta 5xx y registra el evento
- [x] 2.5 Test: el aviso de "FCM_SERVICE_ACCOUNT_JSON not set" (y cualquier otro `log.Printf` de aviso equivalente en `main.go`) genera un evento de warning
- [x] 2.6 Migrar esos `log.Printf` de aviso al registrador nuevo
- [x] 2.7 Test: un endpoint nuevo de prueba, sin ninguna captura de errores propia, queda igualmente cubierto por estar montado bajo el router/middleware compartido (panic o 5xx se registran igual que en cualquier otro endpoint)
- [x] 2.8 Confirmar que el middleware de captura (2.2/2.4) se aplica a nivel de router global, no endpoint por endpoint — revisar `main.go` para que ningún grupo de rutas quede montado fuera de ese wrapping

## 3. Endpoint admin de consulta

- [x] 3.1 Test: `GET` al endpoint admin sin `Authorization: Bearer <ADMIN_STATUS_TOKEN>` válido responde 401/403 sin datos
- [x] 3.2 Test: con token válido, responde 200 con lista vacía si no hay eventos
- [x] 3.3 Implementación del handler y la comparación en tiempo constante del token (`crypto/subtle`)
- [x] 3.4 Test: con eventos registrados, responde los más recientes primero, hasta el límite configurado
- [x] 3.5 Cablear el endpoint en `main.go`, leyendo `ADMIN_STATUS_TOKEN` de `internal/config`

## 4. Memoria y disco del servidor

- [x] 4.1 Test: el endpoint admin responde "sin datos todavía" si no existe el fichero de métricas de host (antes de la primera recolección)
- [x] 4.2 Test: con el fichero de métricas presente, el endpoint devuelve memoria/disco usados y disponibles + timestamp de la medición
- [x] 4.3 Implementación del lector del fichero de métricas de host + integración en el endpoint admin
- [x] 4.4 Test: cuando la lectura de disco/memoria supera el umbral configurado, se registra un warning en el registro de eventos (§1)
- [x] 4.5 Test: una recolección posterior por debajo del umbral no repite el warning; solo se repite si vuelve a cruzarlo
- [x] 4.6 Implementación de la comparación de umbral (constante configurable, valor a fijar aquí — ver design.md Open Questions)
- [x] 4.7 Script de host nuevo (`scripts/collect-sysmetrics.sh` o equivalente, versionado) que escribe memoria/disco del host al fichero de métricas compartido
- [x] 4.8 Documentar en el propio script (comentario) el comando de instalación como timer/cron en el servidor — paso manual, no automatizado en CI (ver design.md Risks)

## 5. Fallos de entrega de email (webhook de Resend)

- [x] 5.1 Test: verificación de firma HMAC-SHA256 Svix (`svix-id`.`svix-timestamp`.`body`, base64) contra `RESEND_WEBHOOK_SECRET` — casos firma válida/inválida/ausente
- [x] 5.2 Implementación de la verificación en un paquete nuevo o dentro de `internal/email`
- [x] 5.3 Test: `POST` al webhook con firma inválida responde error sin registrar ningún evento
- [x] 5.4 Test: evento `email.bounced`/`email.delivery_delayed`/`email.failed` con firma válida registra un evento de fallo de entrega (destino, tipo, motivo) — sin loguear el contenido del email
- [x] 5.5 Test: evento no relacionado con fallo (p. ej. `email.opened`) responde 200 pero no registra fallo de entrega
- [x] 5.6 Implementación del handler del webhook y cableado en `main.go`
- [x] 5.7 Test: fallos de entrega y eventos de error/warning son consultables juntos desde el mismo endpoint admin, distinguibles por tipo

## 6. Infraestructura de despliegue

- [x] 6.1 Añadir volumen nombrado nuevo a `infra/docker/docker-compose.prod.yml` para el fichero JSONL de eventos y el directorio bind-mounted de solo lectura de métricas de host
- [x] 6.2 Añadir `ADMIN_STATUS_TOKEN`, `RESEND_WEBHOOK_SECRET` y `EVENTS_LOG_MAX_SIZE_BYTES` a `infra/docker/.env.prod.example` (comentario, sin valor real salvo el default razonable de `EVENTS_LOG_MAX_SIZE_BYTES`, que no es secreto)
- [x] 6.3 Verificar `go build`/`go vet`/`go test ./...`/`gofmt -l` en verde tras los cambios de `apps/api`

## 7. Cierre

- [ ] 7.1 Configurar manualmente en producción: timer/cron del script de métricas de host, endpoint del webhook en el panel de Resend, copiar `ADMIN_STATUS_TOKEN`/`RESEND_WEBHOOK_SECRET` reales a `.env.prod` — **pendiente**: requiere acceso real al servidor y a la cuenta de Resend, no disponible en este entorno
- [ ] 7.2 Verificación real end-to-end contra producción: provocar un warning/error controlado y confirmar que aparece en el endpoint admin; confirmar que las instantáneas de memoria/disco reflejan valores reales del host — **pendiente**, depende de 7.1
- [x] 7.3 Actualizar `memory/context.md` con el estado tras cerrar el cambio
- [x] 7.4 Revisar si alguna decisión de `design.md` (§2, §3 o §4) merece ADR nueva en `memory/decisions.md` según el criterio ya inyectado (coste de reversión alto / alternativas reales descartadas / hallazgo contraintuitivo) — **ADR-059** añadida (Decisiones 2 y 3: sin montar `/proc`/`/` del host, secreto propio en vez de rol de usuario)
