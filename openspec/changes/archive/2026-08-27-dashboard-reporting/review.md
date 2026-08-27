# Review — `dashboard-reporting`

## CRÍTICO (leer primero)

- **Seguridad**: sin criptografía ni parseo de tokens hecho a mano — el login reutiliza `ADMIN_STATUS_TOKEN` probándolo contra el propio `GET /admin/status` real (`apps/web/src/login/login.service.ts`), sin JWT ni backend de sesión propio. `internal/adminstatus/handler.go` **no se ha tocado** en este cambio (confirmado con `git diff` entre el commit anterior y `cdbe4e9`) — la comparación en tiempo constante de ADR-059 sigue intacta. Ningún secreto real aparece en el diff (`git show cdbe4e9 | grep` sobre patrones de secreto, sin resultados). No hay endpoint de auth nuevo, por lo que no aplica rate limiting nuevo (design.md ya lo deja como Non-Goal explícito, con justificación).
- **XSS**: todo texto de evento se inserta con `textContent`, nunca `innerHTML` (`events-list.element.ts`, `host-snapshot.element.ts`, `login-view.element.ts`), con test de regresión explícito (`events-list.element.spec.ts`, mensaje `<img onerror>` verificado como texto literal, sin nodo `<img>` creado). El secreto real vive en `sessionStorage` (no `localStorage`) — riesgo aceptado y documentado en design.md, mitigación verificada en código real, no solo en el artefacto.
- **`src/shared/` (radio de impacto)**: cambio en `apps/mobile` limitado a un test estructural nuevo (`pnpm-workspace.spec.ts`), sin tocar ningún componente compartido de `apps/mobile` existente. Dentro de `apps/web`, `src/shared/` es todo nuevo (sin radio de impacto en código previo).
- **Dependencias core**: sin dependencias nuevas de fondo — `apps/web` reutiliza el mismo stack que `apps/mobile` (TS strict + Vite + Web Components nativos, sin router ni framework nuevo, decisión 3 de design.md).
- **Reglas del proyecto saltadas**: ninguna. `data-cy` presente en todo elemento interactivo/localizable revisado (`login-input-token`, `login-button-submit`, `login-error-message`, `dashboard-button-logout`, `app-shell-private`, `events-list-item`, `events-list-empty-state`, `host-snapshot-memory/disk/timestamp/empty-state`, `reporting-button-retry`). Tokens de `tokens.css` duplicados con justificación documentada (JSDoc en `base-element.ts` y en la cabecera de `tokens.css`), no hardcodeados.

## Verificación independiente realizada esta sesión

No se aceptó el resumen de `tasks.md` como bueno — releído el código fuente real (`login.service.ts`, `session.store.ts`, `authorized-fetch.ts`, `app.element.ts`, `login-view.element.ts`, `reporting-view.element.ts`, `events-list.element.ts`, `host-snapshot.element.ts`, `internal/webui/webui.go`+test, `cmd/api/main.go` wiring, `Dockerfile`, `docker-compose*.yml`) y re-ejecutada la suite completa de cero, no solo lo nuevo:

- `apps/web`: `tsc --noEmit` limpio, `eslint src/ --max-warnings 0` limpio, Vitest 27/27, `npm run build` real (dist generado), Cypress 5/5 (`dashboard.cy.ts`) contra el stack Docker local real.
- `apps/mobile`: `tsc --noEmit` limpio, `eslint src/ --max-warnings 0` limpio, Vitest 1417/1417, Cypress **101/101** (suite completa, no solo lo nuevo de este cambio) contra el mismo stack Docker real.
- `apps/api`: `go vet ./...` limpio, `go test ./...` 283/283. `gofmt -l` marca todo el árbol por diferencia de final de línea (`core.autocrlf=true` en este checkout Windows, CRLF vs LF) — falso positivo del entorno ya documentado en la sesión de `observabilidad-produccion`, no del código de este cambio.
- `openspec validate --all --strict`: 32/32 en verde.
- Producción real (no solo local): `docker compose -f infra/docker/docker-compose.prod.yml up -d --build` ejecutado en el servidor por SSH/Tailscale (aprobación manual). `/api/ping` 200, `/dashboard/` 200, `GET /admin/status` con el `ADMIN_STATUS_TOKEN` real → 200 con datos reales (evento real `degraded_feature`), sin token → 401. Imagen anterior (`docker-api:pre-dashboard-reporting`) sigue disponible para rollback.

## Mapeo Requirement → Scenario → Test

### `dashboard-login`

| Requirement | Scenario | Test |
|---|---|---|
| Autenticación con el secreto administrativo existente | Credencial correcta | `login.service.spec.ts` ("credencial correcta: abre sesión...") |
| Autenticación con el secreto administrativo existente | Credencial incorrecta | `login.service.spec.ts` ("credencial incorrecta (401)..."), `dashboard.cy.ts` ("credencial incorrecta") |
| Sesión de operador persiste mientras dure la sesión de navegador | Navegación repetida tras iniciar sesión | `app.element.spec.ts` ("con sesión válida: muestra el área privada") |
| Sesión de operador persiste mientras dure la sesión de navegador | Cierre de sesión explícito | `app.element.spec.ts` ("cerrar sesión..."), `dashboard.cy.ts` ("cerrar sesión") |
| Una sesión que deja de ser válida no expone datos parciales | El servidor rechaza la sesión a mitad de uso | `authorized-fetch.spec.ts`, `app.element.spec.ts` ("session-invalidated..."), `dashboard.cy.ts` ("sesión inválida por 401 simulado") |

### `web-dashboard`

| Requirement | Scenario | Test |
|---|---|---|
| La aplicación no expone ningún contenido sin sesión válida | Acceso a ruta privada sin sesión | `app.element.spec.ts` ("sin sesión: muestra login-view..."), `dashboard.cy.ts` ("sin sesión: redirige a /login") |
| La aplicación no expone ningún contenido sin sesión válida | Acceso directo a la URL raíz sin sesión | `app.element.spec.ts` ("acceso directo a la URL raíz...") |
| La aplicación no expone ningún contenido sin sesión válida | Acceso a ruta privada con sesión válida | `app.element.spec.ts` ("con sesión válida...") |

### `reporting-dashboard-view`

| Requirement | Scenario | Test |
|---|---|---|
| Listado de eventos operacionales recientes | Hay eventos disponibles | `events-list.element.spec.ts` ("con eventos: los lista todos...") |
| Listado de eventos operacionales recientes | No hay eventos registrados | `events-list.element.spec.ts` ("sin eventos: muestra el estado vacío...") |
| Instantánea de memoria y disco del host | Instantánea disponible | `host-snapshot.element.spec.ts` ("con instantánea disponible...") |
| Instantánea de memoria y disco del host | Instantánea todavía no disponible | `host-snapshot.element.spec.ts` ("sin instantánea todavía...") |
| Fallo al consultar el endpoint de reporting | Fallo de red genérico | `reporting-view.element.spec.ts` ("fallo de red: muestra el estado de error...") |

### `monorepo-layout` (MODIFIED)

| Requirement | Scenario | Test |
|---|---|---|
| El workspace de pnpm gestiona apps/mobile y apps/web | pnpm install resuelve ambos paquetes | `apps/mobile/src/shared/ci/pnpm-workspace.spec.ts` |
| El workspace de pnpm gestiona apps/mobile y apps/web | Los comandos de cada app siguen siendo independientes | `apps/mobile/src/shared/ci/pnpm-workspace.spec.ts` |

**Cobertura de escenarios: 12/12 (100%)**. Ninguno queda solo como verificación manual — todos tienen test automatizado; la verificación en producción real (7.2) es adicional, no sustituye a los tests.

## Hallazgos

Ninguno. Sin gaps (todo escenario del delta spec implementado), sin desviaciones (implementación fiel a design.md, incluida la corrección real de `base: '/dashboard/'` documentada en la sesión de implementación), sin problemas de calidad relevantes, sin cobertura faltante, sin infracciones de convenciones de frontend (estructura por dominio, separación `.element`/`.service`/`.types`, sin CSS inline, `data-cy` completo).

## Veredicto: **APPROVED**

Los 4 capabilities del delta spec están completos, con test para cada escenario, verificados de forma independiente (código releído, suite completa re-ejecutada, producción real comprobada por API con el token real). Sin hallazgos de seguridad, sin normas saltadas. `memory/context.md` y `memory/decisions.md` (ADR-060) ya actualizados en esta sesión, antes de este review.
