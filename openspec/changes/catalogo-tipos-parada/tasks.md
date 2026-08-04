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

- [ ] 4.1 Test en rojo + implementación: nuevo control de "marcar parada" visible durante una grabación activa (`data-cy` propio, hitbox 56×56px, tokens de `tokens.css`).
- [ ] 4.2 Test en rojo + implementación: pulsar el control abre el modal de selección de tipo (nuevo componente, `data-cy` propio).
- [ ] 4.3 Test en rojo + implementación: elegir un tipo en el modal persiste la parada asociada a la ruta con ese tipo (`buildStops()` deja de ser un stub).
- [ ] 4.4 Test en rojo + implementación: cerrar el modal sin elegir tipo no crea ninguna parada.
- [ ] 4.5 Test en rojo + implementación (regresión): una parada detectada automáticamente por GPS (velocidad baja) sin que el usuario pulse el control no abre el modal ni persiste nada.

## 5. Móvil: esquema de persistencia de paradas

- [ ] 5.1 Test en rojo + implementación: columna `stop_type_id` nueva en `route_stops` (patrón `ensureColumn` ya existente), `RouteStop`/`CreateRouteStop` (`shared/models/route.types.ts`) actualizados.

## 6. Móvil: timeline (`routes/detail`)

- [ ] 6.1 Test en rojo: el timeline lee las paradas reales de `route_stops` en vez de recalcularlas desde `route_points`.
- [ ] 6.2 Implementación mínima (`route-timeline.transform.ts`, `route-detail-timeline.ts`) que pone 6.1 en verde.
- [ ] 6.3 Test en rojo + implementación: una parada con tipo asignado aparece en el timeline con el icono de su tipo.
- [ ] 6.4 Test en rojo + implementación: una ruta sin ninguna parada tipada no muestra ningún delimitador de parada.

## 7. Móvil: mapa (`shared/route-map`)

- [ ] 7.1 Test en rojo + implementación: un marcador por parada con tipo asignado, con el icono correspondiente.
- [ ] 7.2 Test en rojo + implementación: paradas de distinto tipo muestran iconos distintos y distinguibles.
- [ ] 7.3 Test en rojo + implementación: una ruta sin paradas tipadas no muestra ningún marcador de parada.

## 8. Verificación end-to-end y Android real

- [ ] 8.1 Verificación real local: `apps/api` vía Docker Compose arriba, app móvil en dev, flujo completo (grabar → marcar parada → elegir tipo → guardar ruta → ver la parada en timeline y mapa).
- [ ] 8.2 Test E2E Cypress nuevo/actualizado cubriendo el modal de tipo de parada y su reflejo en el timeline.
- [ ] 8.3 **Verificación obligatoria en dispositivo Android real** (el cambio toca persistencia SQLite, la grabación GPS y el rendimiento del mapa — ver regla del proyecto): build vía `pnpm tauri android build --target aarch64 --debug` (nunca `cargo build` manual), instalar con `adb install -r`, y en el propio dispositivo grabar una ruta corta, marcar una parada real, confirmar que persiste y se ve en timeline/mapa tras guardar. Verificar con `unzip -p ... assets/index.html` que el APK contiene el frontend recién construido antes de dar la prueba por buena (gotcha documentado en `memory/context.md`).

## 9. Cierre

- [ ] 9.1 Ejecutar `openspec validate --strict` sobre el cambio y corregir cualquier aviso.
- [ ] 9.2 Actualizar `memory/context.md` (estado actual) y confirmar que [[ADR-035]] en `memory/decisions.md` queda completa, sin pendientes de esta implementación.
- [ ] 9.3 Gate de revisión (`review.md`, obligatorio en este proyecto) + `/opsx:archive` + apertura de PR (`feature/catalogo-tipos-parada` → `master`), según el flujo de Git del proyecto.
