## Context

Ver `proposal.md` — motivación. Este documento cubre solo el cómo.

Estado actual relevante de `apps/api/internal/auth/`: `register.go` crea la cuenta sin ningún concepto de verificación; `login.go` solo comprueba email+contraseña; `token.go` firma JWT de sesión con `golang-jwt/jwt/v5`; `password.go` hashea con `bcrypt` (`golang.org/x/crypto`); `ratelimit.go` implementa `LoginRateLimiter`, un limitador en memoria genérico por clave de tipo `string` (no específico de login pese al nombre); `postgres_store.go` implementa `UserStore` contra la tabla `users` (migración `0001_create_users.sql`). El wiring de rutas vive en `apps/api/cmd/api/main.go`; la config, en `apps/api/internal/config/`, exclusivamente por variables de entorno (ver `Load()`).

La API ya es públicamente alcanzable por HTTPS vía Tailscale Funnel (`https://debian.taildf3dab.ts.net`, ver ADR-036), lo que permite que un enlace de email apunte directamente a un endpoint de la propia API.

## Goals / Non-Goals

**Goals:**
- Un usuario recién registrado recibe un email con un enlace que, al pulsarlo, verifica su cuenta sin necesitar ninguna app ni frontend.
- El login rechaza cuentas sin verificar (decisión confirmada con el usuario).
- Ningún secreto (API key de Resend) ni token de verificación en texto plano queda en la base de datos o en el código.

**Non-Goals:**
- Reset de contraseña (spec aparte).
- Cualquier UI, deep link a la app móvil, o página bonita de confirmación — la página que ve el usuario al confirmar es HTML mínimo, sin los tokens de diseño de `apps/mobile` (no aplica: `apps/api` no sirve frontend de la app).
- Reenvío de verificación expuesto a un frontend real todavía — el endpoint existe y es funcional, pero sin UI que lo dispare hasta la spec de frontend correspondiente.

## Decisions

### El enlace de confirmación es un GET servido directamente por `apps/api`
Un email solo puede disparar una acción sin JavaScript mediante un enlace (`GET`). Como no hay frontend todavía, `apps/api` debe poder completar la verificación por sí sola: `GET /api/auth/verify-email/confirm?token=<token>` lee el token de la query, lo valida y devuelve una respuesta `text/html` mínima ("email verificado" / "enlace no válido o caducado") sin depender de `apps/mobile`. Es un uso de `GET` para una acción con efecto (marca la cuenta como verificada), normalmente desaconsejado por CSRF/replay — aceptado aquí porque el token es de un solo uso, de alta entropía y no adivinable, y confirmar dos veces el mismo token es un no-op seguro (el segundo intento falla por "ya usado"). Alternativa descartada: exigir `POST`, que obligaría a tener un frontend ya en esta misma spec, contradiciendo la decisión ya tomada de alcance solo backend.

La solicitud/reenvío (`POST /api/auth/verify-email/request`) sí queda como `POST` con el email en el body — no se dispara desde un enlace de email, solo se necesitará desde una futura UI o de forma manual/API mientras tanto.

### Generación y almacenamiento del token: `crypto/rand` + hash SHA-256, no bcrypt
El token de verificación se genera con `crypto/rand` (256 bits, codificado en base64 URL-safe) — la misma familia de primitiva ya usada indirectamente por `golang-jwt` para las claves, nunca un generador propio. En la tabla solo se guarda `sha256(token)`, no el token en claro (igual que un password hash, para que un volcado de la tabla no permita verificar cuentas ajenas). Se usa `crypto/sha256` de la librería estándar y no `bcrypt`: a diferencia de una contraseña (baja entropía, elegida por un humano, necesita un hash lento para encarecer fuerza bruta), un token de 256 bits generado por `crypto/rand` ya tiene entropía suficiente para que una búsqueda por hash rápido sea segura — usar `bcrypt` aquí sería coste sin beneficio real (y `bcrypt` trunca a 72 bytes de entrada, innecesario para este caso). Cumple la regla de `rules.security` de "nunca criptografía hecha a mano": ambas primitivas (`crypto/rand`, `crypto/sha256`) son de la librería estándar de Go, auditadas, nunca una implementación propia.

### Envío de email: llamada REST directa a Resend con `net/http`, sin SDK nuevo
Resend expone una API REST simple (`POST https://api.resend.com/emails`, JSON, autenticación `Bearer <api-key>`). Se implementa un paquete nuevo `apps/api/internal/email/` con una interfaz `Sender` (`Send(ctx, to, subject, htmlBody) error`) y una implementación `ResendSender` sobre `net/http` estándar — sin añadir el SDK `resend-go` ni ningún cliente HTTP de terceros. Sigue la regla del proyecto de dependencias mínimas / preferir API nativa. Alternativa descartada: SDK oficial `resend-go` — se rechaza porque la superficie que necesitamos (un POST JSON con un header) no justifica una dependencia nueva; se reconsiderará si en el futuro se necesitan funcionalidades más avanzadas del proveedor (plantillas, webhooks de entrega).

La interfaz `Sender` permite un `FakeSender` en tests (igual que `UserStore` ya se mockea en `register_test.go`), sin llamadas HTTP reales en `go test`.

### Rate limiting: reutilizar `LoginRateLimiter` con una segunda instancia
`LoginRateLimiter` (`ratelimit.go`) ya es genérico por clave `string` pese a su nombre — se instancia una segunda vez en `main.go` para el endpoint de solicitud de verificación (`NewLoginRateLimiter(maxAttempts, window)`, límites propios, ej. 3 solicitudes / 15 min por email), sin duplicar la lógica de ventana deslizante. No se renombra el tipo en este cambio para no ampliar el diff; queda anotado como limpieza menor posible en una sesión futura, no bloqueante.

### Migración `0003_add_email_verification.sql`
```sql
ALTER TABLE users ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE email_verification_tokens (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_verification_tokens_user_id ON email_verification_tokens(user_id);
```
`used_at IS NULL` distingue un token todavía válido de uno ya canjeado; `expires_at` se compara en Go, no con una constraint. Al pedir un reenvío para una cuenta con un token sin usar, se invalida (se marca `used_at`) antes de emitir uno nuevo, para que solo el último enlace enviado funcione.

### Configuración nueva en `config.Load()`
- `RESEND_API_KEY` (secreto, obligatoria — igual que `AUTH_TOKEN_SECRET`, sin valor por defecto).
- `PUBLIC_API_BASE_URL` (ej. `https://debian.taildf3dab.ts.net`) para construir la URL absoluta del enlace de confirmación en el email — no se puede derivar de la petición entrante de forma fiable, y el mismo problema de URL relativa ya causó el incidente de ADR-036, así que se fija explícitamente igual que `MOBILE_PROD_API_BASE_URL`.

### `email_verified` no se expone en las respuestas existentes de `register`/`login`
`registerResponse` y `loginResponse` no cambian de forma (evita romper ningún cliente ya integrado); `MeHandler` (`me.go`), que si expone el estado completo de la cuenta, añade `email_verified` a su respuesta — es el punto natural donde un futuro frontend consultaría si debe mostrar un aviso de "verifica tu email".

## Risks / Trade-offs

- **[Riesgo] `GET` con efecto secundario (verificación) puede quedar en logs de proxy/navegador o precargarse por un antivirus/escáner de enlaces de email, consumiendo el token antes de que el usuario lo abra.** → Mitigación: el token es de un solo uso; si se consume por un prefetch, el usuario simplemente pide un reenvío (`POST /api/auth/verify-email/request`, ya diseñado para eso). No se bloquea el flujo, solo obliga a un reintento — aceptado como trade-off conocido del propio patrón "enlace de email", no exclusivo de este proyecto.
- **[Riesgo] Envío best-effort en el registro: si Resend está caído o mal configurado, la cuenta queda creada pero sin verificar y sin que el cliente se entere del fallo de envío.** → Mitigación: el endpoint de reenvío cubre este caso; se añade un log de servidor (no ruidoso al cliente) cuando el envío falla, para poder diagnosticarlo por SSH igual que ya se hace con otros incidentes de producción (ver ADR-036).
- **[Riesgo] `PUBLIC_API_BASE_URL` mal configurada (URL relativa o IP interna de Tailscale sin Funnel) generaría enlaces de email rotos para cualquiera fuera del tailnet del desarrollador** — mismo patrón exacto que ya causó el incidente de `MOBILE_PROD_API_BASE_URL` en ADR-036. → Mitigación: `config.Load()` rechaza el arranque si `PUBLIC_API_BASE_URL` no empieza por `https://` (mismo tipo de validación mínima que ya falló por su ausencia en ADR-036, esta vez sí presente desde el principio).
- **[Riesgo/decisión ya aceptada] El login ahora puede rechazar a un usuario ya registrado antes de este cambio (`email_verified` no existía, migración lo pone a `false` por defecto para todas las cuentas existentes).** → Mitigación: dado que hoy el único usuario real es el propio desarrollador (fase de desarrollo, sin usuarios externos todavía, confirmado por el contexto de la sesión), no hace falta backfill ni migración de datos especial — se verifica la cuenta de prueba manualmente tras desplegar. Si en el futuro hay usuarios reales antes de un cambio así, haría falta un plan de comunicación explícito (fuera de alcance aquí).
