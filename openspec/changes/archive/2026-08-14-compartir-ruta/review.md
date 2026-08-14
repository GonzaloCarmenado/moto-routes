# Review — compartir-ruta

## CRÍTICO (leer primero)

- **Seguridad**: sin criptografía ni parseo de tokens hecho a mano — el clonado de fotos copia el ciphertext byte a byte a un `ObjectKey` nuevo (`accept.go::clonePhotos`) sin descifrar/recifrar, porque la clave AES-256-GCM es única para toda la instalación (no por usuario), documentado explícitamente en el código y en design.md/Context. Diff completo revisado explícitamente buscando `api[_-]?key|secret|password\s*[:=]|passwd|bearer [a-z0-9]{20,}|-----BEGIN|AKIA...|ghp_...|sk-...|eyJhbGci`: únicos matches son el secreto de test ya usado en otros paquetes (`routesharing-handler-test-secret`, HMAC de un `TokenIssuer` de pruebas, mismo patrón que `routes`/`auth`) y la contraseña dummy `correct-horse-battery` ya reutilizada en todos los specs Cypress existentes — sin secretos reales. **Anti-enumeración**: `CreateInvitationHandler` responde siempre el mismo mensaje genérico exista o no la cuenta destino (verificado con test dedicado `TestCreateInvitationHandler_NonexistentEmailRespondsIdenticallyWithoutCreating` y con el propio Cypress, que compara el flujo con un email inexistente y uno real). **Rate limiting**: nueva instancia de `auth.LoginRateLimiter` (reutilizada tal cual, sin lógica propia) limita invitaciones repetidas por email destino (`TestCreateInvitationHandler_RateLimited`). **Autorización**: `MarkAccepted`/`MarkDeclined`/`MarkRevoked` son `UPDATE ... WHERE status = 'pending' AND <owner> = $X` atómicos — cualquier caso no autorizado (no existe, pertenece a otra cuenta, ya no está pendiente) devuelve el mismo `ErrInvitationNotFound` → 404, nunca se distingue cuál de los casos es (verificado con tests dedicados por cada combinación inválida en `postgres_store_test.go` y con una tercera cuenta real contra el servidor en Cypress).
- **`src/shared/`**: cambios aditivos únicamente — un evento nuevo en `app-events.ts` (`view-sharing`), un export nuevo en `models/index.ts`, un servicio HTTP nuevo en `shared/http/`. Ningún fichero compartido existente cambia de comportamiento. **Excepción a anotar**: `route-list.element.ts` (dominio `routes/list`, no `shared/`, pero componente ya establecido) recibió un fix real de robustez (guardia de token/época en `fetchAndRender` — ver Hallazgos) que endurece un método ya existente, no solo añade código nuevo; el cambio es defensivo (ninguna llamada legítima puede fallar por esto) y viene con la razón documentada inline.
- **Dependencias**: ninguna dependencia npm/Cargo/Go nueva.
- **Reglas del proyecto saltadas**: ninguna sin justificar. `route-sharing.element.ts`/`route-share-dialog.element.ts` se mantienen dentro de los límites de `max-lines`/`max-statements` extrayendo helpers a nivel de módulo (`buildCardShell`, `buildActionButton`) en vez de crecer los métodos de clase.

## Veredicto: **APPROVED**

## Mapeo Requirement → Scenario → Verificación

### Capability `compartir-rutas` (nueva)

**Requirement: Compartir una ruta requiere que esté sincronizada con la cuenta del emisor**
- "La acción de compartir no está disponible en una ruta puramente local" — ✅ `route-detail-header.spec.ts` ("does not render the share button when the route does not exist on the server yet"); Cypress ("la acción de compartir no está disponible en una ruta puramente local").
- "La acción de compartir está disponible en una ruta sincronizada" — ✅ `route-detail-header.spec.ts` (dos tests: ruta local sincronizada y ruta exclusiva de la nube — ver Hallazgos, D5 corregido durante `apply`).

**Requirement: Invitar a otra cuenta por email a recibir una copia de la ruta**
- "Invitación enviada a una cuenta registrada y verificada" — ✅ `handler_test.go::TestCreateInvitationHandler_EligibleRouteAndVerifiedAccountCreatesInvitation`; Cypress end-to-end con cuenta real.
- "La respuesta no revela si el email pertenece a una cuenta registrada" — ✅ `handler_test.go::TestCreateInvitationHandler_NonexistentEmailRespondsIdenticallyWithoutCreating`; Cypress compara ambos casos con el mismo mensaje.
- "No se puede invitar al propio email" — ✅ validación en cliente (`route-share-dialog.element.spec.ts`, "compartir con el propio email muestra un error en cliente") + backstop en servidor (`handler_test.go::TestCreateInvitationHandler_SharingWithSelfRespondsIdenticallyWithoutCreating`); Cypress end-to-end.
- "Límite de invitaciones repetidas al mismo email en poco tiempo" — ✅ `handler_test.go::TestCreateInvitationHandler_RateLimited`.
- "Intentar compartir sin conexión" — ✅ cubierto de forma genérica: `route-share-dialog.element.spec.ts` ("un fallo de red muestra un error en cliente y permite reintentar") ejercita la misma ruta de código (catch de `createInvitation`) que cualquier fallo de red real.

**Requirement: El destinatario ve sus invitaciones recibidas pendientes**
- "Lista de invitaciones pendientes con datos suficientes para decidir" — ✅ `postgres_store_test.go::TestPostgresRouteShareStore_ListReceivedPendingIncludesRouteSummaryAndSender`; `route-sharing.element.spec.ts` ("lists received invitations with the sender email and route name"); Cypress.
- "Sin invitaciones pendientes" — ✅ `route-sharing.element.spec.ts` ("shows the empty state for received invitations when there are none").

**Requirement: Aceptar una invitación clona la ruta completa como una ruta nueva e independiente**
- "Aceptar clona metadatos, puntos, paradas y fotos" — ✅ `accept_test.go::TestAcceptHandler_ClonesMetadataPointsStopsAndPhotosAsNewIndependentRoute` (con fakes reales de `routes.Store`/`photos.PhotoStore`/`photos.BlobStore`, verifica id nuevo, nombre copiado, puntos/paradas copiados, foto clonada con `ObjectKey` nuevo y mismo ciphertext); Cypress verifica metadatos/puntos/paradas end-to-end contra el servidor real y verificación manual del usuario en dispositivo real confirma fotos incluidas. **Deviación deliberada**: el clonado de fotos no se re-verifica en el propio Cypress (evitar construir una petición multipart dentro del test) — decisión explícita en tasks.md 8.3, no un gap.
- "La ruta clonada no hereda el estado de favorito del emisor" — ✅ mismo test `TestAcceptHandler_ClonesMetadataPointsStopsAndPhotosAsNewIndependentRoute` (ruta origen `IsFavorite: true`, clon verificado `IsFavorite: false`).
- "Aceptar una invitación ya revocada o inexistente" — ✅ `postgres_store_test.go::TestPostgresRouteShareStore_CannotAcceptAnAlreadyRevokedInvitation`; `accept_test.go::TestAcceptHandler_InvitationNotFoundReturns404WithoutCloning`.
- "Aceptar sin conexión" — ✅ `route-sharing.element.spec.ts` ("a network failure while accepting shows an error toast and keeps the invitation pending") — **añadido durante esta revisión**: el primer repaso del `apply` no incluía este test; detectado al mapear el spec contra los tests existentes y cerrado antes de archivar (ver Hallazgos).

**Requirement: Rechazar una invitación no clona nada**
- "Rechazar una invitación pendiente" — ✅ `postgres_store_test.go::TestPostgresRouteShareStore_MarkDeclinedRequiresPendingAndRecipient`; `route-sharing.element.spec.ts` ("declining a received invitation calls declineInvitation"); Cypress (verifica que la ruta rechazada no aparece en el listado tras aceptar la otra).

**Requirement: El emisor ve el estado de sus invitaciones enviadas y puede revocar una pendiente**
- "Lista de invitaciones enviadas con su estado" — ✅ `postgres_store_test.go::TestPostgresRouteShareStore_ListSentByUserIncludesStatusAndRecipientEmail`; `route-sharing.element.spec.ts` ("lists sent invitations with their status..."); Cypress.
- "Revocar una invitación pendiente" — ✅ `postgres_store_test.go::TestPostgresRouteShareStore_MarkRevokedRequiresPendingAndSender`; `route-sharing.element.spec.ts` ("revoking a sent invitation calls revokeInvitation"); Cypress end-to-end (estado pasa a "Revocada", verificado también vía API).
- "No se puede revocar una invitación ya aceptada o rechazada" — ✅ cubierto por el mismo guard `status = 'pending'` del `UPDATE` atómico — `TestPostgresRouteShareStore_MarkRevokedRequiresPendingAndSender` ejercita el caso equivalente (revocar dos veces: la segunda ya no está pendiente), mismo código de guarda que "ya aceptada/rechazada" tomaría.

**Requirement: Una invitación solo puede ser gestionada por sus dos partes legítimas**
- "Una cuenta ajena intenta aceptar o rechazar una invitación que no es suya" — ✅ `postgres_store_test.go::TestPostgresRouteShareStore_MarkAcceptedRequiresPendingAndRecipient` (caso `otherID`); `accept_test.go::TestAcceptHandler_InvitationNotFoundReturns404WithoutCloning`; Cypress con una tercera cuenta real (`404` vía API).
- "Una cuenta ajena intenta revocar una invitación que no envió" — ✅ `postgres_store_test.go::TestPostgresRouteShareStore_MarkRevokedRequiresPendingAndSender` (casos `otherID` y el propio destinatario `toID`); Cypress con la tercera cuenta.

## Hallazgos

Sin hallazgos de tipo gap, desviación, calidad o convenciones de frontend sin resolver antes de archivar. Dos hallazgos reales, ambos ya corregidos durante `apply`/esta revisión (no quedan pendientes):

- **[Corregido] Gap de cobertura real: "Aceptar sin conexión" sin test.** Al mapear el spec completo contra los tests existentes en esta revisión, se detectó que el manejo de errores de `handleAccept()` (`route-sharing.element.ts`) — ya implementado correctamente, con `try/catch` y `showToast` — no tenía ningún test que lo ejercitara. Añadido `route-sharing.element.spec.ts::"a network failure while accepting shows an error toast and keeps the invitation pending"` antes de archivar. 11/11 en verde tras el añadido.
- **[Corregido] Condición de carrera real en `route-list.element.ts`/`route-sharing.element.ts`, encontrada escribiendo el propio Cypress E2E.** El setter de `repository`/`sessionRepository` y `connectedCallback` ya disparaban `fetchAndRender()` dos veces al arrancar la app (sin sesión activa todavía); si esas llamadas seguían en vuelo cuando la navegación real (`nav-rutas`/`view-sharing`) disparaba una tercera ya con sesión, la más lenta podía resolver la última y sobrescribir con datos obsoletos el resultado correcto. Arreglado con un token/época por componente (`_fetchToken`): solo la última llamada iniciada puede confirmar su resultado. Ninguna de las dos clases estaba cubierta por un test de regresión antes de este cambio; `route-sharing.element.spec.ts` ahora sí lo tiene ("regresión: refresca al recibir view-sharing..."). `route-list.element.ts` no tiene un test de regresión dedicado a la propia condición de carrera (difícil de reproducir de forma determinista en Vitest sin control fino de microtasks) — su corrección se apoya en la lógica ya revisada (mismo patrón que `route-sharing.element.ts`, donde sí hay test) y en que el Cypress E2E completo (66/66, dos veces seguidas) ya no muestra el síntoma.

Sin hallazgos de convenciones de frontend: estructura por dominio respetada (`routes/sharing/` nuevo, `routes/detail/route-detail-share.ts` y `routes/list/route-list-sharing.ts` como extracciones ya establecidas, `shared/http/route-sharing-api.service.ts` para lo genuinamente compartido), `data-cy` presente en todo elemento interactivo o localizable, CSS sin hardcodear color/espaciado/radio (tamaños de icono en `px` consistentes con el resto del proyecto, patrón preexistente), JSDoc conciso en todo símbolo exportado nuevo.

## Independiente, re-ejecutado en esta revisión (no solo el resumen de la implementación)

- `go test ./...` (`apps/api`, contra Postgres real vía Docker, imagen reconstruida para incluir la migración `0008_create_route_shares.sql`): **12/12 paquetes**, incluye 26 tests nuevos en `internal/routesharing`.
- `tsc --noEmit`: 0 errores.
- `eslint src/ --max-warnings 0`: 0 warnings.
- `vitest run --coverage`: **1123/1123** tests, 96.79% líneas / 90.82% branches / 95.04% funciones (umbral 80% superado en las 4 métricas).
- Cypress E2E completo (`cypress run`, contra `apps/api` real): **66/66**, incluyendo el spec nuevo `route-sharing.cy.ts` (6/6, ejecutado dos veces seguidas para confirmar estabilidad tras los dos arreglos de condición de carrera).
- Verificación manual en dispositivo real (tarea 8.5): confirmada por el usuario — compartir, ver invitación desde la otra cuenta, aceptar, ruta clonada con sus fotos idéntica al original, sin hallazgos.
- Lectura completa del código nuevo/modificado: backend (`routesharing/` completo, migración, wiring en `main.go`), frontend (`routes/sharing/`, `routes/detail/route-detail-share.ts`, `routes/detail/route-share-dialog.element.ts`, `routes/list/route-list-sharing.ts`, `shared/http/route-sharing-api.service.ts`, `shared/models/route-sharing.types.ts`, cambios en `app.element.ts`/`app-events.ts`/`route-detail-header.ts`/`route-detail.element.ts`/`route-list.element.ts`).
