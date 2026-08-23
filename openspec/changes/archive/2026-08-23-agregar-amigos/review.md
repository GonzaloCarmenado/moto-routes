# Review: agregar-amigos

## CRÍTICO (leer primero)

- **Seguridad**: sin secretos nuevos, sin criptografía ni parseo de tokens hecho a mano. `CreateRequestHandler` responde siempre el mismo mensaje genérico exista o no el username, sea o no elegible (propio username, ya amigos, ya pendiente) — verificado con test dedicado (`TestCreateRequestHandler_NonexistentUsernameRespondsIdenticallyWithoutCreating`, `TestCreateRequestHandler_SelfOrAlreadyRelatedRespondsIdenticallyWithoutCreating`), mismo criterio que `routesharing.CreateInvitationHandler`. Rate limiting nuevo (`RateLimitedCreateRequestHandler`, 5/15min por username) reutiliza `auth.LoginRateLimiter` ya auditado, sin lógica de límite propia. Todos los endpoints nuevos van tras `auth.RequireAuth(tokenIssuer)` (mismo JWT que el resto de la API) — no son endpoints de autenticación (no crean/validan credenciales), así que no necesitan rate limiting dedicado más allá del ya añadido al `POST` de creación, mismo criterio que `route-shares`/fotos.
- **`auth.UserStore` modificado (interfaz compartida)**: se añadió `FindUserByUsername`. Radio de impacto verificado por compilación, no solo revisión visual — ambos test doubles que implementan la interfaz (`fakeUserStore` en `auth/register_test.go` y en `routesharing/handler_test.go`) tuvieron que actualizarse o el build habría fallado; `go build ./...`/`go vet ./...` limpios tras el cambio confirman que no queda ningún otro implementador roto.
- **Componentes compartidos tocados en frontend**: `app.element.ts` (nueva vista `friends`, evento `VIEW_FRIENDS`, extracción de `buildProfileView()`/`buildSessionOnlyView()` por límite de líneas), `profile.element.ts` (nuevo listener `AUTH_LOGGED_IN`, nuevo fetch de contador). Radio de impacto verificado: `profile.element.spec.ts` (13 tests preexistentes) sigue en verde sin modificar ninguno de sus tests, y la suite Cypress completa (91/91) confirma que ninguna otra vista quedó rota por la reestructuración de `app.element.ts`.
- **Regla del proyecto saltada, con justificación**: ninguna. `data-cy` añadido en el propio `.element.ts` al crear cada elemento (no a posteriori). JSDoc en todos los símbolos exportados nuevos.
- **Desviación real sobre `design.md`, no anticipada, corregida durante la implementación — ver [[ADR-056]]**: `route-sharing.element.ts` y `friends-view.element.ts` compartían los ids de pestaña `recibidas`/`enviadas` en su `<tab-bar>`; como `app.element.ts` monta todas las vistas a la vez (solo alterna `display:none`), esto producía dos elementos con el mismo `data-cy` y rompía `route-sharing.cy.ts` (test preexistente, en verde desde hace semanas) en cuanto `friends-view` quedó montada permanentemente. Encontrado ejecutando la suite Cypress **completa** (tarea 7.1), no solo el spec nuevo — corregido namespaceando los ids de `friends-view` (`friends-amigos`/`friends-recibidas`/`friends-enviadas`) sin tocar la capability ya en producción.
- **Segunda desviación, menor, corregida durante la implementación**: `profile.element.ts` no refrescaba el contador de solicitudes pendientes tras un login interactivo dentro de una sesión de app ya abierta (el setter de `sessionRepository` no se re-dispara, misma referencia de objeto) — mismo gap de fondo ya documentado y resuelto para el bloqueo de username en `nombre-usuario`. Corregido escuchando el mismo evento `AUTH_LOGGED_IN` ya existente, sin evento nuevo.

## Mapeo Requirement → Scenario → Test

### Enviar una solicitud de amistad por nombre de usuario
- Solicitud enviada a cuenta existente → `TestCreateRequestHandler_ExistingUsernameCreatesRequest`, `TestPostgresFriendshipStore_CreatePersistsPendingRequest`, `friends.cy.ts` ("enviar una solicitud por username...")
- Respuesta no revela si el username existe → `TestCreateRequestHandler_NonexistentUsernameRespondsIdenticallyWithoutCreating`
- No enviarse a uno mismo → `friends-view.element.spec.ts` ("sending a request to the own username is rejected on the client", validación real en cliente) + `TestCreateRequestHandler_SelfOrAlreadyRelatedRespondsIdenticallyWithoutCreating`/`TestPostgresFriendshipStore_CreateRejectsFriendingSelf` (defensa en profundidad en backend)
- Ya existe amistad o solicitud pendiente en cualquier dirección → `TestPostgresFriendshipStore_CreateRejectsDuplicatePendingInEitherDirection`, `TestPostgresFriendshipStore_CreateRejectsWhenAlreadyFriends`
- Límite de solicitudes repetidas → `TestCreateRequestHandler_RateLimited`
- Sin conexión → `friends-view.element.spec.ts` ("a network failure while sending a request shows an inline error...")

### El destinatario ve sus solicitudes pendientes recibidas
- Lista con username del emisor → `TestListReceivedHandler_ReturnsPendingRequests`, `TestPostgresFriendshipStore_ListReceivedPendingIncludesRequesterUsername`, `friends.cy.ts` (2ª prueba, `cy.contains('[data-cy="friends-card-recibida"]', usernameA)`)
- Sin pendientes → `friends-view.element.spec.ts` ("shows the empty state for friends, received and sent requests when there are none")
- El acceso muestra el número real / "9+" por encima de 9 / sin badge sin pendientes → `friends-list.transform.spec.ts` (3 casos), `profile-friends-link.spec.ts` (3 casos), `friends.cy.ts` (5ª prueba, recuento real "2" contra backend)

### Aceptar una solicitud crea una amistad mutua e inmediata
- Aceptar crea la amistad para ambas cuentas → `TestPostgresFriendshipStore_MarkAcceptedRequiresPendingAndAddressee`, `TestPostgresFriendshipStore_ListAcceptedIncludesFriendFromEitherDirection`, `friends.cy.ts` (2ª prueba, verificado con `GET /api/friends` real para ambas cuentas)
- Aceptar una solicitud ya revocada o inexistente → `TestAcceptHandler_NotFoundReturns404`
- Sin conexión → `friends-view.element.spec.ts` ("a network failure while accepting shows an error toast and keeps the request pending")

### Rechazar una solicitud no crea ninguna amistad
- Rechazar solicitud pendiente → `TestDeclineHandler_MarksDeclinedAsAuthenticatedUser`, `TestPostgresFriendshipStore_MarkDeclinedRequiresPendingAndAddressee`, `friends-view.element.spec.ts` ("declining a received request calls declineFriendRequest")

### El emisor puede revocar una solicitud pendiente
- Revocar pendiente → `TestRevokeHandler_MarksRevokedAsAuthenticatedUser`, `TestPostgresFriendshipStore_MarkRevokedRequiresPendingAndRequester`, `friends.cy.ts` (3ª prueba, con verificación cruzada de que el destinatario ya no puede aceptarla — 404 real)
- No se puede revocar ya aceptada/rechazada → cubierto por el mismo `markStatus` atómico (`UPDATE ... WHERE status = pending`) que ya prueban los tests de Mark* — un segundo intento siempre falla con `ErrFriendRequestNotFound` (ver dobles llamadas en `TestPostgresFriendshipStore_MarkAcceptedRequiresPendingAndAddressee` et al.)

### Una solicitud solo puede ser gestionada por sus dos partes legítimas
- Cuenta ajena no puede aceptar/rechazar → `TestAcceptHandler_NotFoundReturns404`/`TestDeclineHandler_NotFoundReturns404` (unit), `friends.cy.ts` (4ª prueba, 404 real contra backend con una tercera cuenta)
- Cuenta ajena no puede revocar → `TestRevokeHandler_NotFoundReturns404` (unit), `friends.cy.ts` (4ª prueba, 404 real)

### Listado de amigos aceptados
- Lista con al menos un amigo → `TestListFriendsHandler_ReturnsAcceptedFriends`, `TestPostgresFriendshipStore_ListAcceptedIncludesFriendFromEitherDirection`, `friends-view.element.spec.ts` ("lists accepted friends by username")
- Sin amigos → `TestPostgresFriendshipStore_ListAcceptedExcludesPending`, `friends-view.element.spec.ts` (estado vacío)

## Hallazgos

1. **[bug real, corregido antes de archivar, ver ADR-056]** Colisión de `data-cy` entre `route-sharing.element.ts` y `friends-view.element.ts` por ids de pestaña compartidos (`recibidas`/`enviadas`) — rompía `route-sharing.cy.ts`, spec preexistente ajeno a este cambio. Encontrado ejecutando la suite Cypress completa (no solo el spec nuevo), corregido namespaceando los ids del componente nuevo.
2. **[gap real, corregido antes de archivar]** `profile.element.ts` no refrescaba el badge de solicitudes pendientes tras un login interactivo con la app ya abierta. Corregido reutilizando el evento `AUTH_LOGGED_IN` ya existente (sin evento nuevo).
3. **[cobertura, corregido antes de archivar]** La primera versión de `friends-view.element.spec.ts` no cubría las 4 ramas de `catch` (fallo de red al enviar/aceptar/rechazar/revocar) — visible en el reporte de cobertura de branches de esa vista (70.45%, por debajo del resto del proyecto). Añadidos los 4 tests correspondientes; cobertura global del proyecto 97.12% líneas / 90.1% branches, sin bajar del 80% exigido en ningún eje.
4. **[calidad, aceptado, no de este cambio]** `gofmt -l` marca `cmd/api/main.go` y varios ficheros de `internal/auth` como "sin formatear" en este checkout — confirmado con `gofmt -d` que es únicamente diferencia de fin de línea (`core.autocrlf=true` en Windows, mismo artefacto de entorno ya documentado en revisiones anteriores), sin cambio de contenido real.
5. **[diseño, aceptado]** El campo `username` en `CreateRequestHandler` no se valida contra `validateUsername` antes de la búsqueda — igual que `CreateInvitationHandler` no valida el formato de email. Un username con formato inválido simplemente nunca coincide con ninguna cuenta real (el formato ya se exige en el registro), así que cae en el mismo camino "no encontrado" sin ningún caso nuevo que cubrir.

## Veredicto

**APPROVED**

Los 7 requirements y sus 21 escenarios de la spec `amigos` están cubiertos por test (Go real contra Postgres, Vitest, Cypress E2E contra backend real). Dos bugs reales encontrados durante la propia verificación de cierre (colisión de `data-cy` entre vistas, badge sin refrescar tras login interactivo) se corrigieron antes de archivar, con su causa documentada en ADR-056 para el primero. Sin problemas de seguridad, sin normas del proyecto saltadas sin justificación, sin componentes compartidos (`auth.UserStore`, `app.element.ts`, `profile.element.ts`) con radio de impacto no verificado.

**Suite completa (re-ejecutada de forma independiente antes de este veredicto)**: `go test ./...` 18/18 paquetes, `go vet`/`gofmt` limpios (salvo el artefacto de fin de línea ya documentado), `tsc --noEmit` limpio, `eslint src/ --max-warnings 0` limpio, Vitest 1342/1342 (97.12% líneas, 90.1% branches), Cypress **91/91** contra backend real (imagen `api` reconstruida con el paquete `friends`).
