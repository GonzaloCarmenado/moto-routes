## Context

`apps/api` corre en producción como un único contenedor (`infra/docker/docker-compose.prod.yml`, `network_mode: host`, usuario no-root `appuser` desde [[ADR-041]]) sin ningún volumen montado salvo `env_file`. Postgres es nativo del host, no un contenedor. El logging actual es `log.Printf`/`log.Fatal` sin estructura (`cmd/api/main.go`, `internal/httpmw/recover.go`). No existe hoy ningún concepto de rol admin — todo el auth existente (`internal/auth`) emite JWT de usuario normal. El envío de email usa un cliente propio sin SDK (`internal/email/resend.go`, un único `POST /emails`). Ver proposal.md para el motivo (gap señalado en [[ADR-045]]).

## Goals / Non-Goals

**Goals:**
- Un único endpoint admin de solo lectura que agregue: eventos de error/warning recientes, última instantánea de memoria/disco del host, y fallos de entrega de email recientes.
- Que los eventos sobrevivan a un reinicio del contenedor (deploy o crash) — un panic que tumba el proceso es precisamente el caso que más interesa poder revisar después.
- Verificación real de la firma de los webhooks de Resend — un endpoint público que acepta eventos sin verificar permitiría a cualquiera inyectar fallos de entrega falsos.
- Cobertura uniforme: todo endpoint (existente o futuro) queda cubierto por la captura de errores por el mero hecho de estar montado en el router, sin necesitar código de captura repetido en cada handler.
- Espacio en disco acotado de forma explícita y configurable para el propio registro de eventos, no solo "razonablemente pequeño".

**Non-Goals:**
- Alertas push (Telegram/Discord/email) — descartado explícitamente por el usuario para este cambio; el acceso es solo bajo demanda vía el endpoint.
- Un sistema de roles/permisos de usuario genérico — el endpoint admin usa un secreto propio, no un rol nuevo en `internal/auth`.
- Métricas de aplicación (latencia, throughput, contadores por endpoint) — fuera de alcance, el pedido es errores/warnings/recursos/email, no un dashboard de rendimiento.
- Retención larga o analítica histórica — el objetivo es "qué está pasando ahora/recientemente", no un almacén de series temporales.

## Decisions

### 1. Eventos de error/warning: fichero JSONL en disco, no en memoria ni en Postgres, con tamaño máximo configurable
Se registran como líneas JSON append-only en un fichero en el volumen del contenedor (p. ej. `/var/lib/moto-api/events.jsonl`), leído por el endpoint admin (últimas N líneas). Alternativas descartadas:
- **En memoria (ring buffer)**: más simple, pero se pierde exactamente en el caso que más importa — un panic que reinicia el proceso borraría el propio evento que lo causó.
- **Tabla en Postgres**: añade migración y acopla un dato puramente operacional (no de negocio) al mismo almacén que rutas/usuarios; innecesario para "últimos N eventos".
El fichero JSONL replica el patrón ya usado en este mismo repo para métricas operacionales (`memory/metrics/events.jsonl`), aplicado aquí al servidor en vez de al SDLC. Requiere un volumen nombrado nuevo en `docker-compose.prod.yml` (hoy el contenedor no tiene ninguno) para que el fichero sobreviva a recrear el contenedor, no solo a un restart.
**Tamaño acotado explícitamente** (pedido directo del usuario, no solo mitigación de riesgo — ver spec "Tamaño máximo acotado del registro de eventos"): variable nueva `EVENTS_LOG_MAX_SIZE_BYTES` (o equivalente en nº de líneas, a decidir en implementación) que el registrador comprueba en cada escritura, descartando las líneas más antiguas antes de escribir la nueva si se supera. Sin este límite, una ráfaga de errores repetidos (p. ej. un bucle de reintentos fallando) podría llenar el disco del servidor — el mismo disco cuyo espacio libre este cambio pretende vigilar.

Ver **ADR-059** en `memory/decisions.md` para el porqué duradero de las Decisiones 2 y 3 de esta sección (alternativas descartadas y consecuencias) — no se repite aquí.

### 2. Memoria y disco del host: script del host + fichero compartido, no montar `/proc`/`/` del contenedor
`network_mode: host` comparte red, no filesystem: el contenedor no ve hoy el disco ni la memoria reales del host, solo las suyas propias (que no son lo relevante — el dato que importa es el del host, donde vive Postgres). Se descarta montar `/proc` y `/` del host dentro del contenedor (patrón habitual de exporters tipo `node_exporter`) porque revertiría parcialmente el hardening no-root de [[ADR-041]]: el proceso ganaría visibilidad de lectura sobre todo el filesystem del host por una necesidad muy acotada (dos números). En su lugar: un script pequeño en el host (mismo espíritu que `scripts/deploy-local.sh`, versionado) ejecutado por un timer/cron ya en el host, que escribe memoria/disco a un JSON pequeño en un directorio bind-mounted de solo lectura para el contenedor — el contenedor solo ve ese fichero, nunca el resto del host. El umbral de aviso (Requirement "Aviso cuando memoria o disco superan un umbral crítico") es una constante en ese mismo script o config del backend, exacto valor a decidir en tasks/implementación.

### 3. Endpoint admin protegido por secreto propio, no por el JWT de usuario ni por las credenciales de Postgres
No existe rol admin hoy y crear uno de verdad (tabla de roles, checks en todos los endpoints existentes) es una superficie mucho mayor que lo que pide este cambio — **confirmado explícitamente con el usuario** entre esta alternativa y añadir un flag `is_admin` a una cuenta real de `user-auth`; se descarta esta segunda por ahora. Se usa un secreto estático nuevo (`ADMIN_STATUS_TOKEN`, env var, mismo patrón que el resto de secretos de `infra/docker/.env.prod`) comparado en tiempo constante (`crypto/subtle.ConstantTimeCompare`, evita timing attack) contra un header `Authorization: Bearer <token>` — sin JWT, sin sesión, sin librería nueva.
**Explícitamente no se reutilizan las credenciales de Postgres** (`DATABASE_URL`) para autenticar este endpoint, aunque a primera vista parezcan "el usuario admin que ya existe": son dos secretos con radio de impacto muy distinto — el de Postgres abre lectura/escritura de toda la base de datos (rutas, usuarios, amistades), mientras que `ADMIN_STATUS_TOKEN` solo abre una consulta de solo lectura sobre este registro operacional. Mezclarlos ampliaría innecesariamente qué puede hacer alguien que solo necesita ver los errores recientes, y complicaría rotar uno sin afectar al otro.
Es información operativa sensible (rutas que fallan, direcciones de email de destino de fallos), así que igualmente cuenta como "seguridad" bajo el criterio de `apps/api` (envío/exposición de datos personales) aunque no haya contraseñas ni tokens de sesión de por medio.

### 4. Verificación de firma del webhook de Resend: HMAC manual, sin SDK de Svix
Resend firma sus webhooks con el esquema estándar de Svix (confirmado: header `svix-id` presente en cada entrega, documentación completa de verificación no expuesta públicamente sin cuenta — el esquema Svix es público y estable: `svix-id` + `svix-timestamp` + `svix-signature`, HMAC-SHA256 en base64 sobre `{svix-id}.{svix-timestamp}.{body}` con el secreto del endpoint). Se implementa con `crypto/hmac`+`crypto/sha256` de la librería estándar de Go, mismo criterio que `internal/email/resend.go` ("sin SDK, la superficie usada es mínima"). Esto NO es la excepción de "nunca crypto manual" del criterio de seguridad del proyecto — esa regla cubre hashing de contraseñas, firma/verificación de JWT y tokens de un solo uso (verificación de email, reset de contraseña), donde un fallo sutil compromete cuentas de usuario; verificar un HMAC de webhook con la librería estándar de criptografía (no una implementación propia de SHA-256) es el mismo nivel de rigor que cualquier comparación de firma HMAC de la industria. Secreto nuevo: `RESEND_WEBHOOK_SECRET` (env var, `infra/docker/.env.prod`, generado desde el panel de Resend al crear el endpoint del webhook).

### 5. Los "avisos degradados" existentes emiten al mismo registro, no un sistema paralelo
Los `log.Printf` de aviso ya existentes en `main.go` (p. ej. "FCM_SERVICE_ACCOUNT_JSON not set") y el `log.Printf` de panic recuperado en `httpmw/recover.go` se migran a la función de registro estructurado nueva en vez de crear un segundo mecanismo de logging en paralelo — un único punto de entrada para error/warning.

## Risks / Trade-offs

- **[Riesgo] El fichero JSONL de eventos puede crecer sin límite** → mitigado con rotación simple por tamaño/número de líneas al escribir (truncar las más antiguas), documentado en tasks.md; no se implementa un logrotate externo nuevo.
- **[Riesgo] El script de host para memoria/disco no es parte de `scripts/deploy-local.sh` ni de la CI, así que instalarlo (timer/cron) en el servidor es un paso manual** → igual que el resto de configuración de producción de este proyecto (creación de usuarios de MinIO, ACLs de Tailscale), se documenta el paso exacto en tasks.md como acción manual explícita, no se automatiza dentro de este cambio.
- **[Riesgo] `ADMIN_STATUS_TOKEN` es un secreto único (no por usuario, no revocable individualmente)** → aceptable para el alcance actual (un único operador humano, el propio usuario); si en el futuro hay más de un operador, se revisará entonces — no se sobre-construye un sistema de roles para un caso de uso de una sola persona.
- **[Riesgo] Un webhook de Resend mal configurado (secreto equivocado) haría que todo evento se rechace silenciosamente** → deliberadamente **no** se registra ningún evento ante una firma inválida (ver spec "alertas-fallos-email", escenario "Firma inválida o ausente": la API rechaza sin registrar nada) — permitir que una petición sin verificar deje rastro en el registro abriría una vía de ruido/inyección desde fuera, sin autenticar. La mitigación real es operativa, no de código: la tarea de cierre (§7.2) incluye enviar un evento de prueba real desde el panel de Resend tras configurar `RESEND_WEBHOOK_SECRET` y confirmar 200, precisamente para detectar un secreto mal copiado antes de darlo por cerrado.

## Migration Plan

1. Añadir el volumen nombrado y las variables de entorno nuevas (`ADMIN_STATUS_TOKEN`, `RESEND_WEBHOOK_SECRET`) a `docker-compose.prod.yml`/`.env.prod.example` — no rompe nada existente, son aditivos.
2. Desplegar el cambio de `apps/api` (mismo tag/release habitual, ver flujo de versión de este repo).
3. Configurar manualmente en el servidor: el timer/cron del script de memoria/disco, y en el panel de Resend el endpoint del webhook + copiar `RESEND_WEBHOOK_SECRET` a `.env.prod`.
4. Sin rollback especial: si algo falla, el resto de la API sigue funcionando igual (el registro de eventos y el endpoint admin son aditivos, no interceptan ni bloquean ninguna petición existente salvo el propio panic recovery, que ya existía).

## Open Questions

- Umbral exacto de "crítico" para memoria/disco (p. ej. 85% / 90%) — no cambia la spec ni las tasks, se fija como constante durante la implementación y se puede ajustar después sin reabrir este cambio.
