## 1. Migración y store Postgres

- [x] 1.1 Migración nueva (`000X_create_routes.sql`): tablas `routes` (id UUID PK, user_id FK, created_at, duration, total_distance, avg_speed, status, name, notes), `route_points` (id, route_id FK, timestamp, lat, lng, alt, speed) y `route_stops` (id, route_id FK, start_time, end_time, lat, lng, type, stop_category_id FK a `stop_types`) — índices por `user_id`/`route_id`.
- [x] 1.2 Test rojo→verde: `PostgresRouteStore.Upsert` — inserta una ruta nueva con sus puntos/paradas; al llamarlo dos veces con el mismo id sustituye los datos (no duplica filas en `route_points`/`route_stops`).
- [x] 1.3 Test rojo→verde: `PostgresRouteStore.ListByUser` — devuelve solo resúmenes (sin puntos) de las rutas del `user_id` dado, vacío si no ha subido ninguna.
- [x] 1.4 Test rojo→verde: `PostgresRouteStore.GetByIDForUser` — devuelve la ruta completa (puntos+paradas) si pertenece al `user_id`; `nil`/no encontrado si pertenece a otro usuario o no existe (mismo resultado en ambos casos).

## 2. Endpoints `internal/routes/`

- [x] 2.1 Test rojo→verde: `POST /api/routes` — éxito (200/201) crea la ruta; sin token (401); ruta con más puntos que el límite fijado (400, ver design.md Open Questions para el valor concreto); llamarlo dos veces con el mismo id actualiza en vez de duplicar (integración con 1.2).
- [x] 2.2 Test rojo→verde: `GET /api/routes` — devuelve solo las rutas del usuario del token; sin token (401); lista vacía si no ha subido nada.
- [x] 2.3 Test rojo→verde: `GET /api/routes/{id}` — devuelve el detalle si es del usuario; 404 (no 403) si la ruta es de otro usuario; 404 si no existe; sin token (401).
- [x] 2.4 Wiring en `cmd/api/main.go`: los tres endpoints tras `RequireAuth`, con `.With(httpmw.PublicCORS)` + ruta `OPTIONS` explícita cada uno — mismo patrón ya aplicado a los endpoints de auth tras el gap encontrado en `pantallas-auth-mobile`.
- [x] 2.5 `go vet`/`govulncheck` limpios, suite completa de `apps/api` en verde.

## 3. Cliente HTTP (`apps/mobile`)

- [x] 3.1 Test rojo→verde: `route-cloud-api.service.ts` — `uploadRoute`, `fetchCloudRoutes`, `fetchCloudRouteDetail` sobre `fetchJson` (mismo patrón que `auth-api.service.ts`), con `Authorization: Bearer` desde `ISessionRepository`.

## 4. Listado combinado local + nube

- [x] 4.1 Test rojo→verde: función pura de fusión (local `Route[]` + resumen cloud `Route[]` → lista única por `id` con estado `'local' | 'synced' | 'cloud-only'`), sin duplicar entradas.
- [x] 4.2 Integración en `route-list.element.ts`/`.service.ts`: sin sesión, comportamiento idéntico al actual (solo local); con sesión, fusiona con `fetchCloudRoutes` — un fallo de red al consultar la nube no bloquea ni rompe el listado local.
- [x] 4.3 Indicador visual por estado en `route-list.element.ts`/`.css` (`data-cy` nuevo por estado), dentro de "Asfalto Nocturno" (tokens existentes, sin hardcodear).

## 5. Subir a la nube desde el detalle

- [x] 5.1 Test rojo→verde: botón "Subir a la nube" en `route-detail` — visible solo con sesión activa y ruta de origen local; llama a `uploadRoute` con metadatos+puntos+paradas de `IRouteRepository`.
- [x] 5.2 Feedback de éxito/error reutilizando `showToast`/`toErrorMessage` ya existentes — sin duplicar el patrón de feedback.

## 6. Detalle de una ruta exclusiva de la nube

- [x] 6.1 Test rojo→verde: `route-detail` — si el id no existe en `IRouteRepository`, los datos se piden a `fetchCloudRouteDetail` en vez de al repositorio SQLite; mismo render de mapa/timeline con el resultado.
- [x] 6.2 Test rojo→verde: error de red al abrir una ruta exclusiva de la nube — mensaje de error, sin crashear ni dejar la pantalla en blanco.

## 7. Verificación E2E real

- [x] 7.1 Nuevo `cypress/e2e/routes/route-cloud-sync.cy.ts`, backend real (mismo patrón que `auth.cy.ts`, cuenta verificada por SQL directo vía `cy.exec`):
  - Subir una ruta local con sesión → aparece como sincronizada en el listado, sin duplicarse.
  - Sin sesión, el listado y el detalle se comportan igual que antes de este cambio (sin acción de subir, sin indicadores de nube).
  - Una ruta exclusiva de la nube (sembrada directamente vía la API en el `before`) aparece en el listado y su detalle se abre igual que uno local.
  - Aislamiento entre cuentas: una segunda cuenta de prueba no ve las rutas de la primera.
- [x] 7.2 Cuentas y rutas de prueba limpiadas de la base de datos al final del spec.
- [x] 7.3 `pnpm run test:e2e` completo en verde, sin regresiones en el resto de specs.

## 8. Verificación real en dispositivo

- [x] 8.1 Build local por USB (gotchas ya documentados en `memory/context.md`). Subir una ruta real grabada en el dispositivo, verla como sincronizada, abrir una ruta exclusiva de la nube (sembrada a mano), confirmar que cockpit/grabación siguen funcionando igual sin sesión.

## 9. Cierre

- [x] 9.1 Actualizar `memory/context.md` con el estado del cambio.
- [x] 9.2 Nueva ADR en `memory/decisions.md` si la implementación confirma alguna decisión de arquitectura no anticipada en `design.md` (p. ej. el valor final del límite de puntos, o cualquier desviación real encontrada al implementar).

## 10. Refinamiento UI: iconos en vez de botón/texto, re-subida automática

- [x] 10.1 Test rojo→verde: `checkIfRouteIsSynced` (`route-detail-cloud.service.ts`) — con sesión activa, `true` si el id aparece en `fetchCloudRoutes`, `false` si no; sin sesión, `false` sin llamar a la API.
- [x] 10.2 `route-detail.element.ts` integra `_isSynced` en `loadLocalRouteData` (solo aplica a rutas locales, nunca a cloud-only).
- [x] 10.3 Test rojo→verde: icono junto al título en vez del botón de ancho completo — nube-subir (local sin sincronizar, pulsable → sube), nube-check (sincronizada, pulsable → re-sube manualmente), nada (cloud-only o sin sesión).
- [x] 10.4 Test rojo→verde: guardar una nota en una ruta ya sincronizada dispara una re-subida en segundo plano (sin toast de éxito propio, sin bloquear el guardado local); en una ruta local sin sincronizar, no dispara nada.
- [x] 10.5 Test rojo→verde: añadir/borrar una foto en una ruta ya sincronizada dispara la misma re-subida de metadatos (nunca de la foto); comentario `// TODO` explícito en el punto de enganche para cuando exista subida de fotos.
- [x] 10.6 Test rojo→verde: la re-subida automática fallando (sin conexión) no revierte el cambio local ya guardado, con un aviso discreto de error.
- [x] 10.7 `route-list.element.ts`/`.css`: indicador de estado sin texto (solo icono, mismos iconos que en el detalle) — iterado dos veces tras verificación real en dispositivo (ver design.md Decisión 9): acabó como insignia superpuesta en la esquina de la miniatura, no en la fila de chips ni junto al botón de eliminar.
- [x] 10.8 Fix CSS: centrado vertical del texto de duración dentro de su chip en `route-card`.
- [x] 10.9 Suite completa (Vitest + Cypress) en verde, sin regresiones.
- [x] 10.10 Gap real encontrado verificando en dispositivo: el `<h1>` del detalle no tenía el margen por defecto del navegador reseteado, descentrando visualmente el icono junto al título — corregido en el reset global (`tokens.css`, `h1,h2,h3,h4`). Verificado con medición real (`getBoundingClientRect()` vía Chrome DevTools Protocol contra el WebView del dispositivo), no solo visualmente.

## 11. Cierre (ronda 2)

- [x] 11.1 Actualizar `memory/context.md` con el estado final tras el refinamiento de UI.
- [x] 11.2 Ampliar/ajustar ADR-040 en `memory/decisions.md` si el refinamiento confirma alguna decisión no anticipada (p. ej. el mecanismo final de detección de `isSynced`).
