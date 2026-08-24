## Context

Ver proposal.md - Why para la motivación. Estado actual relevante para el "cómo":

- No existe ningún endpoint de búsqueda de usuarios en `apps/api` hoy — confirmado por búsqueda exhaustiva antes de proponer.
- `GET /api/auth/avatar` (`apps/api/internal/avatar/handler.go`) solo sirve el avatar de la cuenta autenticada (`RequireUserID` del JWT, sin segmento de usuario en la ruta) — ver otra cuenta necesita un endpoint nuevo.
- `apps/api/internal/auth/user.go` ya expone `FindUserByUsername` (case-insensitive, añadido en `nombre-usuario`/`agregar-amigos`) — reutilizable tanto para resolver el avatar ajeno como para migrar la invitación de compartir-rutas.
- `apps/api/internal/routesharing/handler.go` identifica hoy al destinatario por `email` (`FindUserByEmail`); este cambio lo migra a `username` (`FindUserByUsername`), mismo patrón que `internal/friends` ya usa.
- `profile-header.ts::buildAvatarPlaceholder` ya genera el icono SVG de avatar por defecto (silueta de persona) — es un icono generado, no un fichero de imagen estático; el selector reutiliza esa misma construcción, no un asset nuevo.
- Patrón de rate limiting ya establecido (`LoginRateLimiter`, genérico por clave string + ventana) — cada endpoint de auth nuevo instancia el suyo con su propia clave.

## Goals / Non-Goals

**Goals:**
- Un único componente de selección reutilizable, con búsqueda en vivo y confirmación visual (username + avatar) antes de confirmar a quién se selecciona.
- Reemplazar los dos puntos de entrada de texto libre que existen hoy (username exacto en amigos, email exacto en compartir-rutas) sin cambiar el comportamiento ya garantizado de creación de solicitud/invitación (anti-enumeración, autoexclusión, límites de repetición).

**Non-Goals:**
- Mostrar avatares en los listados ya existentes de amigos/solicitudes/invitaciones (`friends-view.element.ts`, `route-sharing.element.ts`) — este cambio se acota al propio selector de búsqueda, no a rediseñar esas pantallas. Candidato a spec futura si se decide ampliarlo.
- Paginación de resultados de búsqueda más allá del límite fijo de una sola página — con un límite bajo (ver Decisions) no hace falta todavía.
- Cachear avatares ajenos en el cliente entre búsquedas — cada apertura del selector vuelve a pedirlos; optimizarlo es un problema de rendimiento a medir primero, no una premisa de este cambio.

## Decisions

**Búsqueda abierta a cualquier username, no restringida a amigos existentes — ADR-058 nueva** (ver `memory/decisions.md`). Alternativa descartada: restringir la búsqueda a cuentas con las que ya existe alguna relación (amistad o solicitud/invitación previa) — más privado, pero contradice el propio propósito de "amigos" (descubrir gente nueva) y de compartir-rutas (invitar a cualquiera con cuenta, no solo a quien ya conoces dentro de la app). El coste de la opción abierta (cosecha de usernames por fuerza bruta) se mitiga con rate limiting por cuenta autenticada y un resultado acotado, nunca con restringir a quién se puede buscar.

**El endpoint de búsqueda nunca devuelve el email, solo `username`.** Aunque el buscador ya revela qué usernames existen (deliberado, ver decisión anterior), el email es un dato más sensible (vector de phishing/spam) que no aporta nada a la funcionalidad de selección — no hay ninguna razón para exponerlo aquí, a diferencia del username, que es público por diseño desde `nombre-usuario`.

**Rate limiting por cuenta autenticada (userID del JWT), no por término de búsqueda.** A diferencia de `LoginRateLimiter` en login/refresh (clave = el dato sobre el que se actúa: email, username, refresh token), aquí lo que hay que acotar es cuántas búsquedas hace una cuenta por unidad de tiempo — mismo `LoginRateLimiter` genérico, reutilizado con `userID` como clave en vez de un campo del body. Límite propuesto: 30 búsquedas/minuto (una persona escribiendo con normalidad hace muchas peticiones por el debounce; un scraper automatizado las agota rápido).

**Resultados acotados a 10 por búsqueda, longitud mínima de 2 caracteres antes de buscar (cliente).** Un límite bajo de resultados reduce el valor de cada petición para cosechar usernames en bloque; el mínimo de 2 caracteres (cliente, no servidor — el servidor igualmente acota aunque llegue una query de 1 carácter) evita disparar una búsqueda por cada pulsación de tecla al empezar a escribir.

**`GET /api/users/{username}/avatar` reutiliza el mismo `BlobStore` cifrado y la misma clave de objeto determinista (`avatars/{userID}`, ver ADR-055) que el avatar propio** — solo cambia la resolución de `userID` (por JWT vs por `FindUserByUsername` del segmento de ruta). Mismo criterio 404 unificado que ya usa el avatar propio para "no existe": aquí además cubre "username inexistente", sin necesidad de distinguirlo (el username ya se sabe que existe si vino de una búsqueda previa).

**El selector no resuelve avatares en la propia respuesta de búsqueda — el cliente pide cada avatar por separado tras recibir los usernames.** Alternativa descartada: devolver la imagen (o su URL firmada) embebida en la respuesta de búsqueda — descartada por simplicidad: reutiliza tal cual el endpoint de descarga ya existente (mismo patrón que el avatar propio, que tampoco se embebe en `GET /api/auth/me`), a costa de una petición HTTP más por resultado visible — aceptable con el límite de 10 resultados.

## Risks / Trade-offs

- [Riesgo] Un nuevo endpoint de búsqueda abierta es, por diseño, una superficie de enumeración deliberada de usernames (no de emails). Mitigación: rate limiting por cuenta + resultados acotados (ver Decisions); igual que el propio username ya es visible hoy en listados de amigos/solicitudes de cualquier cuenta con la que se tenga relación, esto no es un dato nuevo expuesto, solo una forma más eficiente de encontrarlo — decisión confirmada explícitamente con el usuario antes de proponer.
- [Riesgo] `<friend-selector>` vive en `src/shared/` y lo consumen dos dominios distintos (`friends/`, `routes/detail/`) → cambios futuros sobre el componente tienen radio de impacto en ambos. Mitigación: contrato de props/eventos simple y estable (username de entrada excluida, evento de selección con el username elegido), cubierto por tests propios del componente antes de integrarlo en cada dominio.
- [Riesgo] Migrar compartir-rutas de email a username es un cambio de contrato de `POST /api/route-shares` — cualquier cliente antiguo (versión de APK ya publicada) que siga enviando `email` dejaría de funcionar. Mitigación: aceptado explícitamente (ver proposal.md, BREAKING) — mismo criterio ya usado en `renovacion-token-sesion` para el cambio de TTL: la API y el cliente de esta app se despliegan juntos, sin terceros consumiéndola.

## Migration Plan

1. Backend: nuevo endpoint de búsqueda + nuevo endpoint de avatar ajeno (aditivos, no rompen nada existente).
2. Backend: `POST /api/route-shares` cambia de `email` a `username` — despliegue simultáneo con el cliente nuevo (ver riesgo de compatibilidad arriba, aceptado).
3. Frontend: `<friend-selector>` nuevo, sin consumidores todavía (no rompe nada al desplegarse solo).
4. Frontend: `friends-view.element.ts` adopta el selector.
5. Frontend: `route-share-dialog.element.ts` adopta el selector y cambia a username.
6. Sin rollback destructivo: revertir el backend a la versión anterior (`email` en route-shares) requeriría revertir también el cliente a la vez, ya que no hay compatibilidad cruzada entre versiones — mismo criterio que el resto de despliegues de esta app (sin terceros consumiendo la API).
