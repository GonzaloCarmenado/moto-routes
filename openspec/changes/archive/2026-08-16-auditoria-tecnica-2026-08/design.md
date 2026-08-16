## Context

Ver `proposal.md` para la motivación (auditoría técnica + 3 hallazgos reales, sin bloqueantes). Contexto técnico de cada uno:

- **`buildBackButton()`**: implementación idéntica en `route-detail.element.ts:218-226`, `route-sharing.element.ts:183-191` y `achievement-list.element.ts` — mismo botón (`&larr; Volver`), solo cambia el evento de `APP_EVENTS` que dispara (`BACK_TO_LIST` en route-detail, `NAV_RUTAS` en route-sharing, `NAV_PERFIL` en achievement-list) y el `data-cy`.
- **Trío Go `writeJSON`/`writeError`/`requireUserID`**: idéntico en `internal/achievements/handler.go:14-33`, `internal/routes/handler.go:16-33`, `internal/routesharing/handler.go:22-41`, `internal/photos/handler.go:24-41`. `internal/auth/http.go` solo define su propio `writeError` (sin `writeJSON` ni `requireUserID`, porque los handlers de `auth` no operan sobre un usuario ya autenticado en la mayoría de los casos) — se deja fuera de esta extracción, ver Decisión 2.
- **Focus-trap/ESC**: `confirm-dialog.element.ts:27-54` ya implementa exactamente este patrón (`onKeyDown` con `Tab`→`trapFocus()`, `Escape`→`close()`, `previouslyFocused` restaurado al cerrar) para su propio overlay modal. `achievement-unlock-overlay.element.ts` no lo tiene — se añadió después, sin heredar el patrón ya establecido.

## Goals / Non-Goals

**Goals:**
- Eliminar la duplicación real encontrada, sin tocar comportamiento observable en las 2 extracciones.
- Dar al overlay de logro desbloqueado la misma accesibilidad de teclado que `confirm-dialog`, reutilizando el patrón ya probado, no reinventándolo.

**Non-Goals:**
- No se toca `internal/auth/` (su `writeError` propio se queda igual, ver Decisión 2).
- No se buscan más duplicaciones especulativas fuera de las 3 confirmadas por los 3 agentes de investigación — evitar sobre-alcance de una auditoría.
- No se añade ninguna dependencia nueva (npm, Cargo o Go module) — ambas extracciones son reorganización de código ya existente.

## Decisions

### 1. `buildBackButton()` → `apps/mobile/src/shared/back-button.ts`
Función pura `buildBackButton(dataCy: string, onClick: () => void): HTMLButtonElement`, mismo patrón de extracción a `.ts` suelto ya usado en el repo (`profile-header.ts`, `profile-achievements-link.ts`) — no es un componente con estado, no necesita ser un Web Component. Los 3 llamadores pasan su propio `data-cy` y su propio callback (que sigue siendo responsabilidad de cada pantalla decidir qué evento de `APP_EVENTS` disparar); la función no importa `app-events.ts` para no acoplarse a la navegación de un dominio concreto.
**Alternativa descartada**: mover también la lógica de qué evento disparar dentro del helper (p. ej. un enum "vuelve a rutas / vuelve a perfil"). Acoplaría un helper de puro DOM a la navegación de la app — mezcla dos responsabilidades sin necesidad, la función actual ya es suficientemente pequeña.

### 2. Trío Go → `apps/api/internal/apihttp/` nuevo, `auth` queda fuera
`apihttp.WriteJSON(w, status, body)`, `apihttp.WriteError(w, status, message)`, `apihttp.RequireUserID(w, r) (int64, bool)` — mismas firmas que las versiones duplicadas, solo con nombre exportado (paquete nuevo, no método de un tipo existente). `RequireUserID` sigue llamando a `auth.UserIDFromContext` internamente (el paquete `apihttp` depende de `auth`, no al revés — sin ciclo de imports). Los 4 paquetes (`achievements`, `routes`, `routesharing`, `photos`) pasan a llamar `apihttp.WriteJSON(...)` etc. en vez de sus copias locales.
`internal/auth/http.go` **no** se toca: su `writeError` sirve a handlers de registro/login/reset que a veces responden antes de tener un usuario autenticado (p. ej. "email ya registrado" con mensaje genérico) — no comparte el mismo `requireUserID` que el resto, y forzar la migración solo por unificar `writeError` no paga la pena (una función de 5 líneas, sin el trío completo).
**Alternativa descartada**: meter el trío dentro del propio paquete `auth` (ya que `RequireUserID` depende de él). Convertiría `auth` — hoy centrado en autenticación — en una dependencia de infraestructura HTTP genérica para todo el backend, mezclando responsabilidades; un paquete `apihttp` nuevo y pequeño es más claro.

### 3. Focus-trap/ESC del overlay: reutilizar el patrón de `confirm-dialog`, no una clase base compartida
Se copia el mecanismo (`onKeyDown` como propiedad de instancia con `Tab`→trap, `Escape`→cerrar, guardar/restaurar `previouslyFocused`) directamente en `achievement-unlock-overlay.element.ts`, igual que ya está en `confirm-dialog.element.ts` — **no** se extrae una clase base compartida entre ambos.
**Alternativa descartada**: crear una clase `ModalOverlayElement` de la que ambos hereden. Los dos componentes divergen en aspectos centrales (cola de varios elementos vs. instancia única, auto-cierre por temporizador vs. solo por acción del usuario, promesa resolutoria vs. ninguna) — forzar una base común ahora mismo acoplaría dos componentes con ciclos de vida genuinamente distintos por ~15 líneas de manejo de teclado compartidas. Si aparece un tercer overlay modal con el mismo patrón, entonces sí vale la pena extraerlo (regla de tres).

## Risks / Trade-offs

- **[Riesgo, alcance `shared/`] `buildBackButton` se usa en 3 dominios distintos (`routes/detail`, `routes/sharing`, `achievements`)** → Mitigación: es una función pura sin estado ni efectos secundarios propios (solo construye DOM y adjunta el callback que le pasan), cambiarla no puede romper la lógica de negocio de ningún llamador — solo su apariencia/estructura DOM, cubierta por los tests existentes de cada pantalla (ninguno se reescribe, solo se re-verifica en verde).
- **[Riesgo, paquete Go nuevo] Un paquete `internal/apihttp` mal nombrado o mal ubicado puede parecer que compite con `internal/httpmw` (middleware transversal ya existente)** → Mitigación: `httpmw` son middlewares (`Recover`, `PublicCORS`) que envuelven el router; `apihttp` son helpers de respuesta llamados desde dentro de un handler — distinción clara en el propio nombre y en el comentario de paquete.
- **[Trade-off] No se extrae una base compartida para los overlays modales (Decisión 3)** → Aceptado explícitamente; revisar si aparece un tercer caso.

## Migration Plan

- Sin migración de datos ni de BBDD — cambio puramente de código Go/TypeScript.
- Rollout: un único PR, sin flag de features (los cambios de comportamiento — foco/ESC del overlay — son mejoras aditivas, no rompen ningún flujo existente).
- Sin ADR nueva: ninguna decisión aquí alcanza el umbral arquitectónico — son extracciones de código ya escrito y la reutilización de un patrón (focus-trap) ya establecido en el propio repo.
