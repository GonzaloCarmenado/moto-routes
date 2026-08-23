## 1. Backend — búsqueda de usuarios

- [ ] 1.1 Test rojo + implementación: `auth.UserStore` (interfaz) gana `SearchUsernames(ctx, query string, limit int) ([]string, error)`; `PostgresUserStore` lo implementa con `ILIKE '%'||query||'%'` case-insensitive, orden alfabético, `LIMIT`. Test de integración real contra Postgres (mismo patrón que `postgres_store_test.go`), incluido el caso de más coincidencias que el límite.
- [ ] 1.2 Test rojo + implementación: `LoginRateLimiter` gana un método `Record(key string)` (mismo cuerpo que `RecordFailure` hoy) — `RecordFailure` pasa a ser un alias que lo llama, para no leer "RecordFailure" en un sitio donde no hubo ningún fallo (una búsqueda nunca falla, solo cuenta contra el límite).
- [ ] 1.3 Test rojo + implementación: nuevo paquete `internal/userdirectory`, `SearchHandler(store auth.UserStore)` — lee `q` de la query string, exige `RequireAuth` (userID del contexto), longitud mínima 1 en servidor (el mínimo de 2 es solo del cliente), limita resultados a 10, responde un array JSON de usernames.
- [ ] 1.4 Test rojo + implementación: `RateLimitedSearchHandler` — mismo patrón que `RateLimitedRefreshHandler`, clave = `userID` (no hay body que leer, se obtiene del contexto tras `RequireAuth`), 30/minuto.
- [ ] 1.5 Wiring en `main.go`: `GET /api/users/search`, protegido con `RequireAuth`.

## 2. Backend — avatar de otra cuenta

- [ ] 2.1 Test rojo + implementación: `internal/avatar/handler.go` extrae la lógica de servir el blob cifrado de `DownloadAvatarHandler` a una función interna reutilizable, parametrizada por `userID` (sin cambiar el comportamiento ni la firma pública de `DownloadAvatarHandler`).
- [ ] 2.2 Test rojo + implementación: nuevo `DownloadUserAvatarHandler(store auth.UserStore, blobStore, encryptionKey)` — resuelve `{username}` de la ruta vía `FindUserByUsername`, sirve el mismo blob que el avatar propio; 404 uniforme tanto si el username no existe como si existe pero no tiene avatar.
- [ ] 2.3 Wiring en `main.go`: `GET /api/users/{username}/avatar`, protegido con `RequireAuth`.

## 3. Backend — migrar compartir-rutas de email a username

- [ ] 3.1 Test rojo + implementación: `internal/routesharing/handler.go` — `createInvitationRequest` cambia `Email` por `Username`; `tryCreateInvitation` resuelve con `auth.UserStore.FindUserByUsername` en vez de `FindUserByEmail`. Mismo comportamiento anti-enumeración, mismo rechazo de auto-invitación, mismo rate limiting (clave pasa de email a username).
- [ ] 3.2 Revisar `route_shares` (tabla/columnas) — confirmar que no persiste el email del invitado en ningún sitio que ahora quede huérfano; si lo hace, evaluar si hace falta migración (no se asume, se comprueba el esquema real primero).
- [ ] 3.3 Actualizar los tests Go existentes de `routesharing` que construían la petición con `email` — pasan a `username`, mismos casos cubiertos.

## 4. Frontend — componente `<friend-selector>`

- [ ] 4.1 Test rojo + implementación: `shared/http/user-search-api.service.ts` — `searchUsers(apiBaseUrl, token, query)`, mapeo de errores mismo criterio que `friends-api.service.ts` (401/429/network/unknown).
- [ ] 4.2 Test rojo + implementación: `shared/http/avatar-api.service.ts` (o servicio nuevo si no encaja) gana `resolveUserAvatarUrl(apiBaseUrl, token, username)` — mismo patrón que la resolución de avatar propio ya existente, apuntando al endpoint nuevo de avatar ajeno.
- [ ] 4.3 Test rojo + implementación: `shared/friend-selector/friend-selector.element.ts` — input de búsqueda con debounce (300ms, mínimo 2 caracteres en cliente), lista de resultados con avatar (fallback al icono de `profile-header.ts::buildAvatarPlaceholder`, reutilizado tal cual) y username, evento `FRIEND_SELECTOR_SELECTED_EVENT` al elegir uno.
- [ ] 4.4 Test rojo + implementación: propiedad `excludeUsername` — filtra ese username de los resultados mostrados, sin llamada de red aparte.
- [ ] 4.5 Test rojo + implementación: estado vacío ("sin resultados") y estado de error de red, sin bloquear el resto del componente.
- [ ] 4.6 `data-cy` en cada elemento interactivo/localizable (`friend-selector-input`, `friend-selector-result`, `friend-selector-empty`, `friend-selector-error`), añadidos al crear cada uno.

## 5. Frontend — adopción en amigos

- [ ] 5.1 Test rojo + implementación: `friends-view.element.ts` sustituye el input de texto exacto de `buildSendForm()` por `<friend-selector excludeUsername="...">`, escuchando `FRIEND_SELECTOR_SELECTED_EVENT` para completar `handleSend()` con el username elegido.
- [ ] 5.2 Confirmar que el chequeo de autoexclusión existente (comparar contra `_ownUsername`) sigue funcionando como defensa en profundidad aunque el selector ya excluya la propia cuenta de los resultados.

## 6. Frontend — adopción en compartir-rutas

- [ ] 6.1 Test rojo + implementación: `route-share-dialog.element.ts` sustituye el `<input type="email">` por `<friend-selector excludeUsername="...">`.
- [ ] 6.2 Test rojo + implementación: `shared/http/route-sharing-api.service.ts` cambia el payload de invitación de `email` a `username`.
- [ ] 6.3 Actualizar los tests Vitest existentes de `route-share-dialog.element.spec.ts` que construían el escenario con un input de email — pasan al nuevo flujo de selector.

## 7. Verificación end-to-end

- [ ] 7.1 Cypress nuevo (`cypress/e2e/friends/friend-selector.cy.ts` o ampliar `friends.cy.ts`, backend real): buscar un username parcial muestra resultados con avatar/placeholder; seleccionar uno completa el envío de la solicitud; la propia cuenta nunca aparece en los resultados.
- [ ] 7.2 Cypress: el mismo selector, en el diálogo de compartir ruta, crea una invitación por username en vez de por email — actualizar/ampliar `route-sharing.cy.ts`.
- [ ] 7.3 Cypress: límite de búsquedas por cuenta (rate limit) — mismo patrón que los tests de rate limit ya existentes en otros specs de auth.
- [ ] 7.4 Verificación manual en dispositivo Android real: escribir en el selector con guantes/dedo grueso, confirmar hitbox mínima (56×56px) en cada resultado de la lista.

## 8. Cierre

- [ ] 8.1 Suite completa en verde: `tsc --noEmit`, `eslint src/ --max-warnings 0`, Vitest, Cypress completo (no solo lo nuevo), `go build`/`go vet`/`go test ./...`, `gofmt -l` verificado archivo por archivo (no solo confiar en el listado completo — ver gotcha real de la sesión anterior, `memory/metrics/events.jsonl`).
- [ ] 8.2 `openspec sync` de los tres deltas (`selector-amigos`, `amigos`, `compartir-rutas`) a `openspec/specs/`, `openspec validate --all --strict` sin errores.
- [ ] 8.3 Revisar el diff completo buscando secretos antes de abrir la PR.
- [ ] 8.4 Actualizar `memory/context.md` (estado actual, resultado de la verificación manual del grupo 7). ADR-058 ya escrita en `design.md`, sin ADR nueva salvo que surja una decisión durante `apply`.
