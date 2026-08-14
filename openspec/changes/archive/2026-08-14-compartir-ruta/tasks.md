## 1. Backend (`apps/api`): esquema y modelo de invitaciones

- [x] 1.1 (TDD, en rojo primero) Migración `0008_create_route_shares.sql`: tabla `route_shares` (`id UUID`, `route_id`, `from_user_id`, `to_user_id`, `status` con default `pending`, `created_at`, `updated_at`) — ver design.md D1.
- [x] 1.2 Definir `RouteShareStore` (interfaz, paquete nuevo `internal/routesharing`): `Create`, `ListReceivedPending(userID)`, `ListSentByUser(userID)` (con email actual del destinatario vía join), `MarkAccepted`/`MarkDeclined`/`MarkRevoked` con comprobación de propiedad integrada (mismo criterio D6: "no encontrado" para cualquier caso no autorizado). **Desviación menor respecto al enunciado original**: sin `GetByID` separado — `MarkAccepted` ya devuelve la invitación completa (necesaria para el clonado) en la misma operación atómica, evitando una lectura+escritura separadas con su propia condición de carrera.
- [x] 1.3 Implementación Postgres (`PostgresRouteShareStore`) + 9 tests contra Postgres real (`internal/dbtest`, schema `test_routesharing`), cubriendo alta, rechazo de compartir consigo mismo, listados (incluye/excluye pendientes), y las 3 transiciones de estado con su condición de carrera (doble-aceptar/rechazar/revocar, y aceptar una ya revocada). 9/9 en verde.

## 2. Backend: crear invitación

- [x] 2.1 (TDD, en rojo primero) Handler que crea la invitación: exige sesión, valida que la ruta pertenece al emisor y está sincronizada, resuelve el email vía `auth.UserStore.FindUserByEmail`, rechaza el propio email, y responde siempre el mismo mensaje genérico exista o no la cuenta (design.md D2) — tests que confirman que la fila solo se crea cuando corresponde, nunca visible en la respuesta. **Añadido respecto al enunciado original**: también exige que la cuenta destino tenga el email verificado (mismo criterio que exige `LoginHandler` para poder autenticarse), mismo tratamiento silencioso que "no existe".
- [x] 2.2 Rate limiter dedicado a invitaciones (nueva instancia de `auth.LoginRateLimiter`, keyed por email destino) + wiring del handler limitado, mismo patrón que `RateLimitedRequestPasswordResetHandler`. 7/7 tests de `handler_test.go` para creación en verde.
- [x] 2.3 Rutas nuevas en `cmd/api/main.go` (bajo el middleware de sesión ya existente): `POST /api/route-shares` (crear), `GET /api/route-shares/received`/`sent` (listar), `POST /api/route-shares/{id}/accept`/`decline`/`revoke`.

## 3. Backend: listar invitaciones

- [x] 3.1 (TDD) Endpoint de invitaciones recibidas pendientes, con resumen de la ruta (nombre/fecha) suficiente para decidir sin aceptar primero.
- [x] 3.2 (TDD) Endpoint de invitaciones enviadas con su estado y el email actual de la cuenta destinataria.

## 4. Backend: aceptar / rechazar / revocar

- [x] 4.1 (TDD, en rojo primero) Aceptar: valida que la invitación existe, está `pending` y pertenece al usuario autenticado; clona metadatos + puntos + paradas reutilizando `routes.Store.Upsert` con un `route_id` nuevo (design.md D4); `is_favorite` siempre `false` en la copia (D5).
- [x] 4.2 Clonado de fotos: por cada foto de la ruta origen, copia el blob cifrado a un `ObjectKey` nuevo sin descifrar (misma clave para toda la instalación) y crea el registro de metadatos para la ruta clonada. 3/3 tests de `accept_test.go` en verde (con fakes de `routes.Store`/`photos.PhotoStore`/`photos.BlobStore`).
- [x] 4.3 (TDD) Rechazar: marca `declined`, no clona nada.
- [x] 4.4 (TDD) Revocar: exige que la invitación pertenezca al emisor autenticado y siga `pending`; cualquier otro caso, mismo error genérico que "no encontrado".
- [x] 4.5 `go test ./...` en verde (contra Postgres real). 12 paquetes, todos en verde (incluye 26 tests nuevos de `internal/routesharing`).

## 5. Modelo y servicio HTTP (`apps/mobile`)

- [x] 5.1 Tipos nuevos en `shared/models/route-sharing.types.ts` (`RouteShareStatus` union type, `ReceivedRouteShareInvitation`, `SentRouteShareInvitation`) — sin tocar `Route`/`IRouteRepository` (el clonado no toca SQLite local, la ruta clonada llega como cualquier ruta exclusiva de la nube).
- [x] 5.2 (TDD) `shared/http/route-sharing-api.service.ts`: crear invitación, listar recibidas/enviadas, aceptar/rechazar/revocar — mismo patrón que `route-cloud-api.service.ts`. 9/9 tests en verde.

## 6. UI: acción "Compartir" en `route-detail`

- [x] 6.1 (TDD, en rojo primero) Botón "Compartir" (`route-detail-share.ts`, extraído a fichero propio desde el principio, mismo patrón que `route-detail-favorite.ts`) visible con sesión y `existsOnServer`. **Corrección real durante la implementación**: el enunciado decía "mismo gating que 'Subir a la nube' (`isSynced`)", pero `_isSynced` en `route-detail.element.ts` es `false` para una ruta exclusiva de la nube (nunca local) — un flag pensado solo para elegir el icono de "Subir"/"Ya sincronizada", no para "¿existe esta ruta en el servidor?". Habría ocultado "Compartir" precisamente en el caso que más lo necesita (una ruta ya en la nube). Añadido `existsOnServer: isSynced || !isLocalRoute` en `route-detail-header.ts`/`route-detail.element.ts`, con tests dedicados para los 3 casos (ruta local sincronizada, ruta local sin sincronizar, ruta exclusiva de la nube).
- [x] 6.2 Diálogo (`route-share-dialog.element.ts`) para introducir el email del destinatario, con validación en cliente del caso "no puedes compartir contigo mismo" (comparando contra el email de la sesión activa) antes de llamar a la API. Incluye también manejo de fallo de red (reintentable, sin perder el email escrito).
- [x] 6.3 **Desviación de implementación**: mensaje genérico mostrado como segundo paso del propio diálogo ("Invitación enviada", ver `buildSentStep`), no como un toast aparte — mismo patrón ya usado por `auth-forgot-password-dialog.element.ts` para el mismo tipo de mensaje anti-enumeración (necesita más contexto que un toast de una línea). Nunca distingue si la cuenta existe.

## 7. UI: pantalla de invitaciones

- [x] 7.1 (TDD, en rojo primero) `src/routes/sharing/route-sharing.element.ts`: dos pestañas (Recibidas/Enviadas) vía `<tab-bar>` compartido, estados vacíos dedicados para cada una. 11/11 tests en verde (incluye el caso de fallo de red al aceptar, añadido durante la revisión independiente al detectar que faltaba). Nueva vista `'sharing'` cableada en `app.element.ts` (evento `view-sharing` nuevo en `app-events.ts`, sub-vista de "Rutas" igual que el detalle).
- [x] 7.2 Icono de acceso nuevo (`route-list-sharing.ts`) en la cabecera de `route-list` (mismo nivel que el filtro "Solo favoritas"), marcado activo si hay invitaciones recibidas pendientes (comprobación best-effort, nunca bloquea el listado si falla).
- [x] 7.3 (TDD) Acciones: aceptar/rechazar en "Recibidas", revocar (solo si `pending`) en "Enviadas" — tras cualquier acción, recarga las dos listas del propio componente; el listado de rutas de `route-list` ya refresca al volver a "Rutas" (`nav-rutas`), sin necesitar ningún evento nuevo de sincronización.

## 8. Verificación end-to-end

- [x] 8.1 `pnpm exec vitest run --coverage`: 1123/1123 tests, 96.79% líneas / 90.82% branches / 95.04% funciones (umbral 80% superado en las 4 métricas). `route-sharing.types.ts` añadido a la exclusión de cobertura (`vitest.config.ts`), mismo criterio que el resto de ficheros de solo-tipos.
- [x] 8.2 `tsc --noEmit` y `eslint src/ --max-warnings 0` en verde.
- [x] 8.3 Cypress E2E nuevo (`cypress/e2e/routes/route-sharing.cy.ts`, dos cuentas reales vía API, backend real) cubriendo: crear invitación, respuesta idéntica para email inexistente, compartir con uno mismo (rechazado en cliente), compartir no disponible en ruta local, listar recibidas/enviadas, aceptar (clona metadatos+puntos+paradas; **el clonado de fotos no se re-verifica aquí** — ya cubierto con fakes reales en `accept_test.go` del backend, evita construir una petición multipart dentro del test), rechazar, revocar, intento de gestionar una invitación ajena (404 vía API con token de una tercera cuenta). 6/6 en verde, dos veces seguidas para confirmar estabilidad, y de nuevo dentro de la suite completa (66/66).
  **Dos bugs reales encontrados y arreglados durante la propia escritura del E2E, ninguno anticipado en el diseño**:
  1. `route-sharing.element.ts` solo cargaba sus datos una vez, en el momento en que `app.element.ts` monta la vista al arrancar la app (normalmente sin sesión activa todavía) — nunca se refrescaba al volver a abrir la pantalla ya con sesión. Arreglado añadiendo un listener del evento `view-sharing` (mismo patrón que `route-list.element.ts` ya usaba para `nav-rutas`), con test de regresión dedicado.
  2. Condición de carrera real en `route-list.element.ts::fetchAndRender` (y su misma forma en `route-sharing.element.ts`): el setter de `repository`/`sessionRepository` y `connectedCallback` ya disparaban la carga dos veces al arrancar (sin sesión); si esas llamadas seguían en vuelo cuando `nav-rutas`/`view-sharing` disparaba una tercera (ya con sesión), la más lenta podía resolver la última y pisar el estado correcto con datos obsoletos. Arreglado con un token/época por componente: solo la última llamada iniciada puede confirmar su resultado. Adicionalmente, dos tests del E2E se sincronizan explícitamente con `cy.intercept`+`cy.wait` sobre la petición real en vez de confiar en el polling implícito de `.should()` (insuficiente bajo la carga de Docker+Cypress de este entorno).
- [x] 8.4 `go test ./...` en verde (contra Postgres real). 12 paquetes, todos en verde.
- [x] 8.5 Verificación manual en dispositivo real: compartir una ruta, ver la invitación desde la otra cuenta, aceptarla y confirmar que la ruta clonada (con sus fotos) se ve igual que el original. Confirmado por el usuario, sin hallazgos.

## 9. Cierre

- [x] 9.1 Actualizar `memory/context.md` (§ Estado Actual del Proyecto) con un resumen de la sesión.
- [x] 9.2 Revisar el diff completo buscando cualquier string de secreto antes de abrir la PR. Sin hallazgos — solo el secreto de test ya usado en otros paquetes (`routesharing-handler-test-secret`, HMAC de un `TokenIssuer` de pruebas) y la contraseña dummy `correct-horse-battery` ya reutilizada en todos los specs Cypress existentes.
