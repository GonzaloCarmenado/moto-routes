## Context

Ver `proposal.md` para la motivación. Puntos de partida técnicos relevantes:

- El endpoint que este dashboard consume (`GET /admin/status`, `apps/api/internal/adminstatus/handler.go`) ya existe, ya está protegido por `ADMIN_STATUS_TOKEN` (secreto único, comparación en tiempo constante) y su comportamiento **no cambia en este cambio** — confirmado con el usuario durante `propose` que sigue siendo un único operador, así que [[ADR-059]] se mantiene tal cual, sin superseder.
- `apps/api` hoy sirve solo JSON bajo `/api/*` y `/admin/status`; no sirve ningún fichero estático.
- Producción es un único servidor Debian por Tailscale (`[[ADR-033]]`/`[[ADR-041]]`), un solo contenedor Docker para `apps/api` (`network_mode: host`), sin balanceador ni CDN — desplegado vía `scripts/deploy-local.sh` desde la rama, mismo patrón que el resto del proyecto.
- `apps/mobile` ya establece el patrón de frontend de este proyecto (TS 5.7 strict + Vite 6 + Web Components nativos con Shadow DOM, sin framework) — `apps/web` lo reutiliza tal cual, sin Tauri.

## Goals / Non-Goals

**Goals:**
- Cero infraestructura nueva más allá de lo que ya existe (mismo espíritu que [[ADR-059]]: "sin infraestructura de monitorización externa").
- Reutilizar `ADMIN_STATUS_TOKEN` como credencial del dashboard sin abrir ninguna superficie de autenticación nueva en `apps/api`.

**Non-Goals:**
- Parte pública del dashboard (fuera de alcance, ver `proposal.md`).
- Cualquier cambio al sistema de usuarios (`user-auth`) o a JWT — este cambio no lo toca en absoluto.
- Rate limiting nuevo sobre `/admin/status` — no se introduce ninguna superficie de ataque que no exista ya (ver Decisión "Sin backend nuevo para el login").

## Decisions

**1. `apps/web` se sirve desde el propio binario de `apps/api`, mismo origen — sin CORS.**
El build de `apps/web` (`dist/`) se empotra en el binario Go vía `embed.FS` (nueva etapa en `apps/api/Dockerfile`: build de Node/pnpm antes de la etapa de Go, copia `dist/` al contexto de compilación) y se sirve como estático bajo una ruta propia (p. ej. `/dashboard/*`), separada de `/api/*` y `/admin/status`. Como el navegador y la API comparten origen en producción, **no hace falta ningún CORS nuevo** — resuelve el punto que `proposal.md` dejaba abierto ("a definir en design.md si aplica tal cual [PublicCORS] o necesita una variante"): no aplica ninguna, la pregunta desaparece.
En desarrollo local, `apps/web` sigue corriendo con su propio dev server de Vite (puerto propio, recarga instantánea) — un proxy de Vite (`server.proxy`) reenvía `/api` y `/admin` a `localhost:8080`, mismo mecanismo, sin CORS tampoco.
*Alternativa descartada*: contenedor estático aparte (nginx u otro) en `docker-compose.prod.yml`, con CORS acotado al origen del dashboard. Añade un segundo servicio a desplegar/mantener por una SPA de pocas vistas para un único operador — contradice el "sin infraestructura nueva" que ya fijó [[ADR-059]] para este mismo endpoint. Revisar si el dashboard crece mucho o gana la parte pública mencionada como fuera de alcance.

**2. Sin backend nuevo para el login: la propia credencial es `ADMIN_STATUS_TOKEN`, guardada en `sessionStorage` tras validarla con una llamada real al endpoint.**
El formulario de login no golpea ningún endpoint nuevo: intenta `GET /admin/status` con la credencial introducida como `Authorization: Bearer`; 200 → sesión abierta (token guardado en `sessionStorage`, adjuntado a partir de ahí en cada petición); 401 → error genérico. No se emite ningún JWT ni token de sesión propio.
*Alternativa descartada*: backend-for-frontend que guarda el secreto real solo en el servidor y emite una cookie de sesión `httpOnly` propia. Más seguro (el secreto real nunca llega al navegador), pero añade una superficie de autenticación nueva de verdad — sesión propia, expiración, endpoint de login — para un único operador que ya confió en pegar este mismo secreto a mano por `curl`. Queda como punto de partida natural si en algún momento hay más de un operador (mismo criterio que [[ADR-059]] ya dejó escrito para ese escenario).
*Consecuencia aceptada, no ignorada*: el secreto real vive en `sessionStorage`, accesible por JavaScript. Ver Risk siguiente.

**3. Sin router nuevo como dependencia.** Con solo dos rutas (`/login`, `/reporting`), un enrutado mínimo hecho a mano (History API + un `switch` sobre el path) cubre el caso — mismo criterio de dependencias mínimas ya aplicado en `apps/mobile`. Revisar si la parte pública futura (fuera de alcance aquí) añade suficientes rutas para justificar una librería.

**4. Nuevo job de CI `quality-web`**, mismo patrón que `quality-ts` (tsc, ESLint, Vitest, Cypress contra `apps/api` real vía `docker compose`) pero apuntando a `apps/web` — no se reutiliza `quality-ts` porque ya está acoplado a rutas de `apps/mobile` (`monorepo-layout`, requirement "El pipeline de CI resuelve las nuevas rutas", sin tocar en este cambio por ser de `apps/mobile` específicamente).

## Risks / Trade-offs

- **El secreto administrativo real vive en `sessionStorage` del navegador** (Decisión 2) → si `apps/web` tuviera una vulnerabilidad XSS, el atacante obtendría el mismo secreto que ya da acceso total al endpoint por `curl` — no un token de sesión de alcance limitado. Mitigación: **ningún dato mostrado en la vista de reporting se renderiza como HTML** — mensajes de evento y rutas (que pueden contener texto influido por quien dispara el error, p. ej. una ruta con caracteres arbitrarios en un 404/500) se insertan siempre como texto plano (`textContent`, nunca `innerHTML`), cerrando la vía de XSS más obvia dentro del propio dashboard. `sessionStorage` (no `localStorage`) acota la exposición a la pestaña/sesión de navegador actual, nunca persiste indefinidamente.
- **Acoplar el deploy del frontend al del backend** (Decisión 1: mismo binario) → cualquier cambio solo en `apps/web` obliga a reconstruir y redesplegar el contenedor de `apps/api` entero. Mitigación aceptada: coherente con que ya es un despliegue de un solo contenedor para todo el backend; el volumen de cambios de un dashboard interno de un operador es bajo.
- **`embed.FS` con el build de `apps/web` desactualizado si alguien olvida reconstruirlo** → mismo tipo de gotcha ya documentado para el APK de `apps/mobile` (`memory/context.md`, "Build Android": frontend desactualizado empotrado). Mitigación: el job `quality-web` de CI y el propio `Dockerfile` reconstruyen `apps/web` como parte del mismo build, nunca se copia un `dist/` preexistente.

## Open Questions

Ninguna — las decisiones de arquitectura relevantes (modelo de login, mismo origen, sin dependencias nuevas) quedan resueltas arriba; el resto es implementación (nombres de ficheros, estructura interna) y se decide en `tasks.md`.
