## 1. Backend: catálogo de tipos de parada (`apps/api`, Go)

- [x] 1.1 Migración `0002_create_stop_types.sql`: tabla `stop_types` (id, key, label, icon) + seed del catálogo inicial (bar/restaurante, mirador, monumento, gasolinera, alojamiento, taller/mecánico, aparcamiento, otro).
- [x] 1.2 Test en rojo: `GET /api/stop-types` sin cabecera de autorización responde 200 con la lista del catálogo.
- [x] 1.3 Implementación mínima (paquete `internal/stoptypes`: handler + repositorio) que pone 1.2 en verde. Repositorio real (`PostgresRepository`) verificado con test de integración contra Postgres.
- [x] 1.4 Test en rojo: cada elemento del catálogo incluye id, texto e icono.
- [x] 1.5 Test en rojo: con la tabla vacía, el endpoint responde 200 con lista vacía, no un error.
- [x] 1.6 Wiring en `cmd/api/main.go` (ruta pública, sin `RequireAuth`) + verificación real local (`docker compose up --build`, `curl /api/stop-types` → 200 con las 8 filas sembradas).

**Gap real encontrado y corregido durante este grupo**: al añadir un tercer paquete Go con test de integración contra Postgres (`stoptypes`), `go test ./...` (paralelo por defecto) empezó a fallar de forma intermitente porque los fixtures de `auth`/`migrate` (de `migrar-api-golang`) reseteaban tablas concretas por nombre (`DROP TABLE IF EXISTS users, schema_migrations`), sin conocer `stop_types` — y aunque se ampliara esa lista, paquetes distintos ejecutándose en paralelo contra el mismo schema `public` seguían pisándose entre sí. Corregido con un paquete nuevo `internal/dbtest` (helper compartido, no específico de este cambio) que aísla cada paquete de test en su propio schema de Postgres (`search_path` vía `pgxpool.ParseConfig`) — permite paralelismo real entre paquetes sin coordinación manual y no exige tocar el fixture cada vez que se añade una tabla. Verificado estable en 3 ejecuciones consecutivas de `go test ./...` sin `-p 1`.

## 2. Móvil: CSP y cliente HTTP hacia `apps/api`

- [x] 2.1 Añadir el host de `apps/api` a `connect-src` en `tauri.conf.json` e `index.html`; actualizar el test de regresión existente. **Corrección real durante `apply`**: el diseño original (constante de build con la IP de Tailscale de producción) se habría comiteado a un repo público — corregido a `http://localhost:8080` únicamente en ficheros versionados; el host real de producción vive en overrides locales no versionados (`.env.local`, `tauri.conf.prod.local.json`). Ver ADR-035 (actualizada) y `.gitignore`.
- [x] 2.2 Test en rojo: cliente HTTP mínimo obtiene el catálogo de `apps/api` (`fetchStopTypesFromApi`, reutiliza `fetchJson` ya existente, sin dependencia nueva).
- [x] 2.3 Implementación mínima que pone 2.2 en verde. Añadido `getApiBaseUrl()` (`shared/http/api-config.ts`) leyendo `VITE_API_BASE_URL` con fallback a `localhost:8080`, y `apps/mobile/.env.example` documentándolo.
- [x] 2.4 Test en rojo + implementación: la petición de refresco que falla (timeout/error) no lanza una excepción no controlada — `fetchJson` ya envuelve el fallo en `ExternalApiError` tipado y capturable; el catch real de la orquestación de caché se hace en el grupo 3.

## 3. Móvil: caché local del catálogo (SQLite)

- [x] 3.1 Test en rojo + esquema: tabla `stop_types_cache` (mismo patrón `CREATE TABLE IF NOT EXISTS` de `sqlite-route.repository.ts`). `IStopTypesCacheRepository` + suite de contrato compartida (mismo patrón `models/route.repository.spec.ts`), `MemoryStopTypesCacheRepository` y `SqliteStopTypesCacheRepository`.
- [x] 3.2 Test en rojo + implementación: guardar el catálogo obtenido de la API en la caché local (`replaceAll`).
- [x] 3.3 Test en rojo + implementación: leer el catálogo desde la caché local sin conexión (`getAll`, no depende de red).
- [x] 3.4 Test en rojo + implementación: `refreshStopTypesCache` obtiene el catálogo de la API y actualiza la caché.
- [x] 3.5 Test en rojo + implementación: el refresco falla (excepción de `fetchFromApi`) → la caché existente permanece sin cambios, sin propagar el error.
- [x] 3.6 Test en rojo + implementación: sin caché previa y refresco fallido → `getAll()` resuelve `[]`, sin excepción.

## 4. Móvil: marcar parada manual (`cockpit`)

- [x] 4.1 Control de "marcar parada" (`cockpit.render.ts::buildMarkStopButton`, `data-cy="cockpit-mark-stop"`, hitbox `var(--hitbox-min)`, tokens), visible solo con grabación activa. Test en `cockpit.element.spec.ts`.
- [x] 4.2 Pulsar el control abre `<cockpit-stop-type-dialog>` (nuevo componente, cerrable — a diferencia de `cockpit-save-route-dialog`, elegir tipo es opcional) con el catálogo cacheado. 7 tests propios del componente + test de integración en `cockpit.element.spec.ts`.
- [x] 4.3 Elegir un tipo llama a `service.addManualStop(id)` (nuevo método de `CockpitService`, guarda en `state.manualStops` con el último punto GPS) y `buildStops()`/`buildMetadata()` dejan de ser stubs — persisten de verdad en `route_stops` con `stopCategoryId`. Verificado end-to-end (marcar → `confirmSaveRecording` → `getStopsByRouteId`) en `cockpit.service.spec.ts`.
- [x] 4.4 Cerrar el modal (cancelar, click fuera, ESC) resuelve `null` y no llama a `addManualStop` — 3 tests en el propio componente del modal.
- [x] 4.5 Regresión: la detección automática GPS (`detectStop()`/`stopState`) no cambia — nunca llama a `addManualStop` ni abre el modal; `addManualStop` es la única vía de escritura de `manualStops`, y solo la dispara el control manual. Test explícito: "does not persist any stop when no manual stop was marked".

**Gap real encontrado y corregido durante este grupo**: al completar la UI, `cockpit.element.ts` y `cockpit.service.ts` superaron el límite de 300 líneas del proyecto (ESLint `max-lines`, ya bloqueaba el pre-commit). Corregido con extracciones que ya seguían el patrón existente del dominio (no ad-hoc): `gps/cockpit-browser-gps.service.ts` (createBrowserGpsProvider, ya vivía inline en cockpit.service.ts), `mark-stop/cockpit-mark-stop.service.ts` (orquestación del flujo, mismo patrón que `stop/cockpit-stop.service.ts`), `cockpit.transform.ts::buildPhotoCaptureContext` (lógica pura, extraída de `handlePhotoCapture`), y `shared/repositories/sqlite-stop-types-cache.factory.ts` (fallback SQLite→memoria, reutilizado también en `app.element.ts`, eliminando una duplicación real entre ambos ficheros). 804/804 tests, 96% cobertura global.

## 5. Móvil: esquema de persistencia de paradas

- [x] 5.1 Test en rojo + implementación: columna `stop_type_id` nueva en `route_stops` (patrón `ensurePreviewPolylineColumn` ya existente — `ensureColumn` genérico está hardcodeado a `routes`, así que se replicó como método dedicado). `RouteStop`/`CreateRouteStop` ganan `stopCategoryId: number | null` (no `stopType`, para no colisionar con el `StopType`='manual'|'auto' ya existente en `route.types.ts` — mismo motivo por el que el catálogo se llama `StopCategory`, no `StopType`, en `shared/stop-types/`). Adelantada desde el grupo 4: 4.3 la necesitaba para poder persistir de verdad. Actualizados `MemoryRouteRepository`, el mock de test compartido y las 4 aserciones de recuento de `ALTER TABLE` ya existentes que se habrían roto sin el nuevo `hasStopTypeIdColumn` en el mock.

## 6. Móvil: timeline (`routes/detail`)

- [x] 6.1 Test en rojo: el timeline lee las paradas reales de `route_stops` en vez de recalcularlas desde `route_points`.
- [x] 6.2 Implementación mínima (`route-timeline.transform.ts`, `route-detail-timeline.ts`) que pone 6.1 en verde. Eliminado `detectStopsFromPoints`/`TimelineStop` (recálculo por GPS, confirmado sin otros usos); nuevo `TimelineStopInput` (forma reducida de `RouteStop` para la timeline) y `buildStopDelimiters(stops, categoriesById)`. `buildTimelineData`/`buildTimelinePanel` reciben ahora las paradas reales y el catálogo resuelto en vez de recalcular nada. `route-detail.element.ts` añade `getStopsByRouteId` al `Promise.all` existente y un setter `stopTypesCacheRepository` (mismo patrón que `cockpit-view`, inyectado desde `app.element.ts`).
- [x] 6.3 Test en rojo + implementación: una parada con tipo asignado aparece en el timeline con el icono de su tipo. Las paradas manuales son instantáneas (un único punto GPS), así que se sustituyó el antiguo `→ hora de fin` (paradas-intervalo, ya no existen) por icono + etiqueta de la categoría.
- [x] 6.4 Test en rojo + implementación: una ruta sin ninguna parada tipada no muestra ningún delimitador de parada. `buildStopDelimiters` descarta cualquier parada cuyo `stopCategoryId` sea `null` o no exista en el catálogo cacheado (caché desactualizada respecto al id guardado).

**Gap real encontrado y corregido durante este grupo**: al añadir `getStopsByRouteId` y el nuevo parámetro `categoriesById` a `buildTimelinePanel`, la función superó el límite `max-params` (4) de ESLint y `app.element.ts::render()` superó `max-statements` (25). Corregido agrupando los datos de entrada en un objeto `TimelinePanelInput` (`route-detail-timeline.ts`) y extrayendo la construcción de `<route-detail>` a `buildRouteDetailView()` en `app.element.ts`, mismo patrón de extracción ya usado en los grupos 1 y 4. 804/804 tests.

## 7. Móvil: mapa (`shared/route-map`)

- [x] 7.1 Test en rojo + implementación: un marcador por parada con tipo asignado, con el icono correspondiente. Nuevo `route-map-stops.ts::addStopMarkers`, mismo patrón que `route-map-photos.ts::addPhotoMarkers` (hitarea `--hitbox-min`, `data-cy`) pero sin clustering — las paradas son muy poco numerosas frente a las fotos. `<route-map>` gana los setters `stops`/`stopCategoriesById`, reutilizando en `route-detail.element.ts` los mismos `_routeStops`/`_categoriesById` ya resueltos para la timeline (Grupo 6).
- [x] 7.2 Test en rojo + implementación: paradas de distinto tipo muestran iconos distintos y distinguibles. El icono es el emoji de la categoría (`StopCategory.icon`, ya distinto por tipo en el seed del catálogo) — sin lógica adicional de asignación de icono por tipo.
- [x] 7.3 Test en rojo + implementación: una ruta sin paradas tipadas no muestra ningún marcador de parada. Mismo criterio de descarte que `buildStopDelimiters` (Grupo 6): `stopCategoryId` null o ausente del catálogo resuelto → sin marcador.

## 8. Verificación end-to-end y Android real

- [x] 8.1 Verificación real local: `apps/api` vía Docker Compose arriba, app móvil en dev, flujo completo (grabar → marcar parada → elegir tipo → guardar ruta → ver la parada en timeline y mapa). `docker compose up -d --build` en `infra/docker/`; `curl http://localhost:8080/api/stop-types` → 200 con las 8 categorías sembradas. Flujo completo verificado a través del test E2E de 8.2 (backend real, sin mocks).
- [x] 8.2 Test E2E Cypress nuevo/actualizado cubriendo el modal de tipo de parada y su reflejo en el timeline. Nuevo `cypress/e2e/cockpit/cockpit-mark-stop.cy.ts` (2 tests): marcar una parada real (GPS stubeado — ver más abajo) con un tipo del catálogo real de `apps/api` y verla en el timeline con icono+etiqueta tras guardar; y regresión de que cancelar el modal no persiste nada. Corre contra el backend real (`cy.intercept` solo para sincronizar con `cy.wait`, sin stub de datos) — primera vez que la suite E2E ejercita la integración `apps/mobile`→`apps/api` de verdad. 41/41 tests E2E (suite completa), 814/814 unitarios, `tsc`/`eslint` limpios.
- [ ] 8.3 **Verificación obligatoria en dispositivo Android real** (el cambio toca persistencia SQLite, la grabación GPS y el rendimiento del mapa — ver regla del proyecto): build vía `pnpm tauri android build --target aarch64 --debug` (nunca `cargo build` manual), instalar con `adb install -r`, y en el propio dispositivo grabar una ruta corta, marcar una parada real, confirmar que persiste y se ve en timeline/mapa tras guardar. Verificar con `unzip -p ... assets/index.html` que el APK contiene el frontend recién construido antes de dar la prueba por buena (gotcha documentado en `memory/context.md`). **Pendiente — requiere dispositivo físico, a cargo del usuario.**

**Gap real encontrado y corregido durante este grupo**: `apps/api` no enviaba cabeceras CORS. El `GET /api/stop-types` funcionaba perfectamente por `curl`/tests de integración Go, pero el navegador bloqueaba en silencio el `fetch` cross-origin real desde `apps/mobile` — `refreshStopTypesCache` (best-effort) lo capturaba como un fallo de red normal, dejando la caché vacía sin ningún error visible. Nadie lo había detectado porque ningún test anterior (unitarios con `fetchFromApi` mockeado, Cypress sin backend real) ejercitaba la petición HTTP real contra un origen distinto. Corregido con `internal/httpmw/cors.go::PublicCORS` (cabecera `Access-Control-Allow-Origin: *`, aplicada solo a esta ruta pública) — ver [[ADR-035]] (punto 5, añadido). Exactamente el tipo de gap que la verificación E2E con backend real (en vez de mockeado) está pensada para atrapar.

## 9. Cierre

- [ ] 9.1 Ejecutar `openspec validate --strict` sobre el cambio y corregir cualquier aviso.
- [ ] 9.2 Actualizar `memory/context.md` (estado actual) y confirmar que [[ADR-035]] en `memory/decisions.md` queda completa, sin pendientes de esta implementación.
- [ ] 9.3 Gate de revisión (`review.md`, obligatorio en este proyecto) + `/opsx:archive` + apertura de PR (`feature/catalogo-tipos-parada` → `master`), según el flujo de Git del proyecto.
