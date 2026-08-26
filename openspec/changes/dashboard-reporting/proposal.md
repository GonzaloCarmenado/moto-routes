## Why

El endpoint `GET /admin/status` (`apps/api/internal/adminstatus`, nacido en `observabilidad-produccion`, ADR-059) ya expone eventos operacionales recientes y la última instantánea de memoria/disco del host, pero solo como JSON crudo — hoy se consulta a mano con `curl`+`jq` y un `Authorization: Bearer` pegado manualmente. No hay ninguna interfaz para leerlo. Se necesita un panel web que lo presente de forma legible, con una pantalla de login en vez de pegar el token a mano cada vez.

## What Changes

- Nueva app `apps/web/`: TypeScript + HTML + CSS + Web Components nativos con Shadow DOM, mismo patrón que `apps/mobile` pero **sin Tauri** (SPA web plana, sin empaquetado nativo). Se incorpora al `pnpm-workspace.yaml` existente y gana su propio job de CI (`quality-web`, paralelo a `quality-ts`/`quality-tauri`/Go).
- Pantalla de login que pide el secreto administrativo ya existente (`ADMIN_STATUS_TOKEN`) como contraseña de un único operador — **decisión confirmada explícitamente con el usuario durante `propose`**: sigue siendo un solo operador humano, así que se mantiene ADR-059 tal cual (secreto propio, no un rol `is_admin` sobre `user-auth`) en vez de superarla con una ADR nueva. Sin backend nuevo para el login: la app web sigue siendo estática.
- Vista privada (detrás de login) que consume `GET /admin/status` y renderiza sus datos: lista/tabla de eventos recientes (nivel, timestamp, mensaje, ruta/método) y la última instantánea de memoria/disco del host — sustituye leer el JSON a mano.
- Alcance explícitamente limitado a la parte privada. El usuario menciona que en el futuro podría haber una parte pública del dashboard — **fuera de alcance de este cambio**, no se diseña nada pensando en ella.

## Capabilities

### New Capabilities
- `web-dashboard`: scaffolding de la nueva app `apps/web` (estructura por dominio, build, integración en el workspace de pnpm y en CI) y el shell de la aplicación con enrutado protegido (todo detrás de login, sin área pública en este cambio).
- `dashboard-login`: pantalla de login de un único operador contra el secreto administrativo ya existente, gestión de sesión de navegador (mecanismo concreto — almacenamiento, expiración, logout — a definir en `design.md`) y protección de rutas (sin sesión válida, redirección a login).
- `reporting-dashboard-view`: vista privada que consume `GET /admin/status` y presenta eventos operacionales recientes e instantánea de memoria/disco del host de forma legible, en vez del JSON crudo.

### Modified Capabilities
- `monorepo-layout`: el requirement "El workspace de pnpm solo gestiona apps/mobile" pasa a admitir también `apps/web` como segundo paquete pnpm real del monorepo.

## Impact

- **Código nuevo**: `apps/web/` completo (estructura por dominio análoga a `apps/mobile/src/`, sin `src-tauri/`).
- **`pnpm-workspace.yaml`**: añade `apps/web` a `packages`.
- **`.github/workflows/ci.yml`**: nuevo job `quality-web` (tsc, ESLint, Vitest, build) — no reutiliza `quality-ts` porque ese job ya está acoplado a rutas de `apps/mobile`.
- **`apps/api/internal/adminstatus`**: hoy no envía cabeceras CORS (se llamaba solo por `curl`, nunca por `fetch()` de un navegador); al consumirse desde `apps/web` en un origen distinto, necesita CORS acotado a ese endpoint — mismo patrón ya usado para rutas públicas (`internal/httpmw/cors.go::PublicCORS`), a definir en `design.md` si aplica tal cual o necesita una variante (esta ruta no es pública, solo cambia el origen de la llamada).
- **Sin cambios en `apps/api/internal/auth`** ni en el esquema de `user-auth`: el login del dashboard no crea cuentas ni toca JWT de usuario.
- **Despliegue**: `apps/web` es una SPA estática nueva — dónde y cómo se sirve (mismo pipeline de release que `apps/mobile`, o algo distinto) se resuelve en `design.md`.
