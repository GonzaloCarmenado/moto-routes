## Context

Ver `proposal.md` — motivación. Este documento cubre solo el cómo.

Estado relevante de `apps/api/internal/auth/`: `password.go` ya valida (`validatePassword`) y hashea (`bcrypt`) contraseñas, reutilizado tal cual. `verification_token.go`/`verification_token_store.go` (de `confirmacion-email-usuarios`, ADR-038) ya resuelven "token de un solo uso, hash sha256, invalidar el anterior al emitir uno nuevo" — el reset repite el mismo patrón, en tabla propia, no reutilizando `email_verification_tokens` (un token de reset y uno de verificación de email no deben ser intercambiables: un atacante que intercepte un email de verificación no debería poder resetear la contraseña con él). `LoginRateLimiter` ya es la pieza reutilizable para rate limiting por email. `config.RESEND_API_KEY`/`RESEND_FROM_ADDRESS`/`PUBLIC_API_BASE_URL` ya existen, sin variables nuevas.

## Goals / Non-Goals

**Goals:**
- Un usuario que olvidó su contraseña puede recuperarla sin ayuda humana, con una página usable de verdad (formulario real, no solo un enlace).
- Completar un reset no deja la cuenta en un estado peor que antes (contraseña anterior invalidada de inmediato, token de un solo uso).

**Non-Goals:**
- Invalidar tokens JWT de sesión ya emitidos al cambiar la contraseña — el esquema actual (`TokenIssuer`) es completamente stateless, sin lista de revocación ni tabla de sesiones; añadir eso es un cambio de arquitectura mayor, no justificado solo por esta spec. Una sesión ya abierta antes del reset sigue siendo válida hasta que expire (TTL de 24h, ya existente) o el propio cliente cierre sesión.
- Estilizar el resto de páginas ya existentes de `apps/api` (la de verificación de email sigue en HTML plano) — decisión explícita del usuario, eso es el siguiente cambio de frontend.
- Cualquier UI en `apps/mobile` — la página de reset la sirve `apps/api` directamente, mismo criterio que la confirmación de email.

## Decisions

### El token de reset caduca en 1 hora, más corto que el de verificación de email (24h)
`resetTokenTTL = 1 * time.Hour` (constante propia, no se reutiliza `verificationTokenTTL`). Un token de reset da control total de la cuenta (cambia la contraseña) si cae en manos ajenas — riesgo mayor que un token de verificación de email (que solo marca una cuenta como confirmada). Ventana corta estándar del sector para este tipo de enlace. El usuario siempre puede pedir uno nuevo si el suyo caduca (`POST /reset-password/request` no tiene límite de veces, solo de frecuencia — ver rate limiting).

### La cuenta afectada se determina exclusivamente por el token, nunca por ningún otro campo
`ResetPasswordConfirmHandler` (tanto `GET` como `POST`) obtiene el `user_id` únicamente de `PasswordResetTokenStore.FindByHash(hash(token))`. El formulario **no lleva ningún campo de email, username ni id de cuenta** — ni oculto ni visible — y el handler ignora explícitamente cualquier campo adicional que llegara en el `POST` (`r.ParseForm()` solo lee `password`/`password_confirmation`, nunca un identificador de cuenta). Así, aunque alguien manipulara el formulario para añadir un campo `email`/`user_id` apuntando a otra cuenta, no tiene ningún efecto: la cuenta que se modifica es siempre la dueña del token, determinada server-side. Mismo principio ya aplicado en `ConfirmVerificationHandler` (ADR-038) — se mantiene aquí explícito porque el efecto de un fallo (cambiar la contraseña de otro) es mucho más grave que el de email-verification (marcar una cuenta como verificada).

### El enlace de reset nunca contiene el email ni ningún identificador de cuenta, solo el token opaco
`GET /api/auth/reset-password/confirm?token=<token>` — la URL entera del enlace no lleva ni email ni user id en ningún parámetro, cabecera oculta ni fragmento; el único dato es el token de 256 bits generado por `generateOneTimeToken`. Quien vea el enlace (logs de proxy, historial del navegador, un reenvío accidental) no aprende de quién es la cuenta — solo alguien que además tenga el hash en la base de datos podría correlacionarlo, y el hash nunca sale de la base de datos. Mismo criterio que ya aplica al enlace de verificación de email (ADR-038).

### Tabla y tipos propios para el token de reset, no reutilizar `email_verification_tokens`
Nueva tabla `password_reset_tokens` (mismo shape que `email_verification_tokens`: `user_id`, `token_hash`, `expires_at`, `used_at`) y una interfaz `PasswordResetTokenStore` propia — no se amplía `VerificationTokenStore` con un campo "tipo de token". Con dos tablas separadas, un token filtrado o reutilizado por error solo puede servir para lo que fue emitido, y no hace falta ninguna comprobación adicional de "tipo" en cada handler. Duplica la forma de `verification_token_store.go` casi al literal — aceptado, es más simple que una abstracción genérica sobre "token de un solo uso" para dos usos con reglas de expiración/rate limit potencialmente distintas en el futuro.

### La página de confirmación es HTML + `<form>` estándar, sin JavaScript
`GET /api/auth/reset-password/confirm?token=...` renderiza un formulario con `method="POST"` hacia la misma ruta, campos `password`/`password_confirmation` y el token en un campo oculto. `POST` en la misma ruta procesa el envío (`r.ParseForm()`, ya en la librería estándar, sin dependencia nueva) y vuelve a renderizar el formulario con un mensaje de error si algo falla (contraseñas no coinciden, política débil, token inválido), o una página de éxito si todo va bien. Sin JavaScript ni `fetch`: un formulario HTML nativo funciona en cualquier navegador sin coste de mantenimiento, coherente con que esto no es la app (sin CSP de Tauri que respetar aquí).

### Estilo "Asfalto Nocturno" embebido como CSS inline en el HTML servido por Go, sin importar `tokens.css`
`apps/api` y `apps/mobile` son paquetes de build independientes (Go vs. Vite) sin pipeline compartido — no se puede `@import` el `tokens.css` real. Se copian los valores de color ya usados por la app (`--bg-top`/`--bg-bottom`/`--panel`/`--ink`/`--amber` en `oklch()`, soportado por todos los navegadores modernos) como constantes en un nuevo fichero `apps/api/internal/auth/reset_password_page.go`, con un comentario que apunta a `apps/mobile/src/shared/styles/tokens.css` como fuente de verdad — si esos valores cambian ahí, hay que actualizarlos aquí a mano (sin mecanismo de sincronización automático, aceptado por ser solo 5-6 valores). Tipografía: mismos *fallback stacks* que ya usa `--font-display`/`--font-ui` en `tokens.css` (`"Roboto Slab", "Georgia", serif` / `"Barlow", "Segoe UI", sans-serif`) — **sin auto-hospedar los ficheros `.woff2** reales: son activos de `apps/mobile` con su propio pipeline de assets, embeberlos en el binario de Go es una complejidad no justificada para una única página («nada complejo», confirmado con el usuario) — la página se ve casi igual con las fuentes de sistema del *fallback*.

### Generación/hash del token: renombrar las funciones ya existentes a genéricas, no duplicarlas
`generateVerificationToken`/`hashVerificationToken` (`verification_token.go`, de `confirmacion-email-usuarios`) ya son `crypto/rand`+`sha256` sin ninguna lógica específica de verificación de email — se renombran a `generateOneTimeToken`/`hashOneTimeToken` y se reutilizan tal cual para el token de reset, actualizando las dos únicas llamadas existentes. A diferencia del rename pendiente de `LoginRateLimiter` (ADR-038, dejado como deuda porque solo había un segundo consumidor incómodo), aquí el rename es barato (dos funciones puras, sin estado) y este mismo cambio ya introduce el segundo consumidor real — se hace ahora en vez de acumular más deuda.

### Reset exitoso también verifica el email si no lo estaba
Completar un reset ya demuestra que el usuario controla el buzón (recibió el enlace y lo abrió) — mismo nivel de prueba que confirmar un email de verificación. Evita que alguien quede con la contraseña ya cambiada pero bloqueado en el login por "email sin verificar" (ADR-038), sin necesitar un segundo email aparte.

### Rate limiting solo en la solicitud, no en la confirmación
Igual que en `confirmacion-email-usuarios`: el token de reset tiene 256 bits de entropía (mismo generador que `verification_token.go`), fuerza bruta contra `POST /reset-password/confirm` es inviable sin necesitar además un límite de intentos — el límite real que importa es cuántos tokens se pueden generar, no cuántos se pueden probar.

## Risks / Trade-offs

- **[Riesgo] Una sesión JWT abierta antes del reset sigue funcionando hasta que expira (máx. 24h)** — si el motivo del reset es que alguien más conoce la contraseña antigua y ya tiene una sesión activa, esa sesión no se revoca. → Mitigación: aceptado explícitamente como Non-Goal (ver arriba); el TTL de 24h ya acota la ventana. Si en el futuro se necesita revocación real, hace falta una tabla de sesiones o una lista de revocación — cambio de arquitectura aparte.
- **[Riesgo] Los valores de color duplicados en Go pueden desincronizarse de `tokens.css`** si la paleta cambia. → Mitigación: comentario explícito en el código apuntando a la fuente de verdad; el radio de impacto es una sola página poco visible (solo se ve al resetear contraseña), no crítico si queda desactualizada un tiempo.
- **[Riesgo] Sin autoescape automático de un motor de plantillas** (se usa `fmt.Sprintf`/`html/template` de la librería estándar, a decidir en `tasks.md` cuál de las dos) — un mensaje de error mal escapado podría introducir un XSS reflejado si se interpola texto no confiable en el HTML. → Mitigación: usar `html/template` (no `fmt.Sprintf`) para cualquier valor que provenga de la petición (ninguno hoy: los mensajes de error son literales fijos, el token nunca se refleja en el HTML de vuelta) — decisión de implementación, no un dato dinámico peligroso en este caso, pero `html/template` se usa igualmente por defecto seguro.
