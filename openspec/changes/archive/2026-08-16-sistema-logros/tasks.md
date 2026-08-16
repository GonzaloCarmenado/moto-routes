## 1. Backend: migración y catálogo inicial

- [x] 1.1 Test de schema fundido con los tests del store (postgres_store_test.go de `internal/achievements`, mismo patrón que `routesharing`: no hay convención de test de schema aislado en este repo, la migración se ejercita a través del store real — ver 2.1-2.6)
- [x] 1.2 Crear `apps/api/internal/migrate/migrations/0009_create_achievements.sql`: `CREATE TABLE achievements` (BIGSERIAL+key, no UUID — ver design.md Decisión 1 corregida), `CREATE TABLE user_achievements`, función `safe_parse_timestamptz()`, `INSERT` del catálogo inicial (3 escalones km totales 100/500/1500, 1 logro ruta larga >3600s, 3 escalones km/mes 100/300/500, 3 escalones nº rutas 5/25/100 — icono `'default'` único para las 10 filas)
- [x] 1.3 Verificado en verde junto con 2.1-2.6 (`go test ./internal/achievements/... -v`: 7/7)

## 2. Backend: paquete `internal/achievements` — cálculo de agregados y otorgamiento

- [x] 2.1 Test: query de agregados (`total_km`, `route_count`, `longest_route_seconds`, `month_km`) correcta, incluyendo fila con `created_at` no parseable (excluida solo de `month_km` vía `safe_parse_timestamptz()`, el resto de agregados no se ve afectado)
- [x] 2.2 Implementado `internal/achievements/achievements.go` + `postgres_store.go`
- [x] 2.3 Test: `CheckAndGrant` otorga una vez y no duplica en una segunda llamada
- [x] 2.4 Implementado `CheckAndGrant` en `postgres_store.go`
- [x] 2.5 Test: logro ya otorgado no se revoca al borrar la ruta que contribuyó
- [x] 2.6 Test: `single_route_duration_seconds` se cumple con una sola ruta, no por acumulación

## 3. Backend: endpoints y wiring

- [x] 3.1 Test de `handler.go`: `POST /api/achievements/check` devuelve solo los logros recién otorgados en esa llamada
- [x] 3.2 Test de `handler.go`: `GET /api/achievements` devuelve el catálogo completo con `achieved_at`/progreso
- [x] 3.3 Implementado `handler.go` (`CheckHandler`, `ListHandler`)
- [x] 3.4 Test: ambos endpoints devuelven 401 sin sesión válida
- [x] 3.5 Registradas las rutas en `apps/api/cmd/api/main.go` (CORS + `RequireAuth` + `OPTIONS` explícito para `/api/achievements/check` y `/api/achievements`)
- [x] 3.6 `go test ./...` completo en verde (190/190, 14 paquetes)

## 4. Frontend: modelo y cliente API

- [x] 4.1 Tipos `Achievement`/`AchievementProgress` en `src/shared/models/achievement.types.ts` (mismo patrón que `route-sharing.types.ts`)
- [x] 4.2 Wrapper tipado `src/shared/http/achievement-api.service.ts` (mismo patrón que `route-sharing-api.service.ts`), 6/6 tests en verde

## 5. Frontend: comprobación tras sincronización

- [x] 5.1 Test: tras `uploadRouteToCloud()` resolver con éxito, se llama a `POST /api/achievements/check`
- [x] 5.2 Test: si la comprobación de logros falla, la subida de la ruta sigue considerándose exitosa
- [x] 5.3 Hook implementado en `route-detail-cloud.service.ts` (fire-and-forget tras el `await` de subida) — bug real encontrado por el propio test: `granted.forEach(enqueueAchievementUnlock)` pasaba `(index, array)` de más como argumentos extra de `forEach`, corregido a una arrow function
- [x] 5.4 `route-detail-cloud.service.spec.ts` completo en verde (21/21) — se añadieron mocks de `achievement-api.service.js`/`achievement-unlock-overlay.element.js` y un `beforeEach` global, sin tocar ninguna aserción existente

## 6. Frontend: animación de logro desbloqueado

- [x] 6.1 Test: `enqueueAchievementUnlock(achievement)` muestra la animación inmediatamente si la cola está vacía
- [x] 6.2 Test: una segunda llamada mientras la primera animación sigue visible se encola y se muestra al cerrarse la anterior (o al pulsar "Continuar")
- [x] 6.3 Test CSS: mismo patrón que `route-map.element.css.spec.ts` (sin exención propia de `prefers-reduced-motion`, se apoya en el override global de `tokens.css`)
- [x] 6.4 Implementado `src/shared/feedback/achievement-unlock-overlay.element.ts` + `.element.css` + icono placeholder nuevo `src/shared/icons/achievement-icons.ts`
- [x] 6.5 Cola conectada al hook de 5.3

## 7. Frontend: pantalla "Mis logros"

- [x] 7.1 Test: sin sesión activa, no llama al backend y muestra un aviso de inicio de sesión (corregido en `specs/logros/spec.md`: no existe ningún prompt "ya usado" reutilizable en el repo — `route-sharing` tampoco tiene uno — se construyó uno nuevo mínimo)
- [x] 7.2 Test: con sesión y sin ninguna ruta sincronizada, todos los logros aparecen pendientes con progreso en cero
- [x] 7.3 Test: logros conseguidos muestran su fecha; logros pendientes muestran progreso actual/umbral
- [x] 7.4 Implementado `src/achievements/achievement-list.element.ts` + `.element.css` + `.transform.ts` (formateo de progreso por tipo de requisito) siguiendo el patrón de `route-sharing.element.ts`; evento nuevo `VIEW_ACHIEVEMENTS` en `app-events.ts`; wiring completo en `app.element.ts` (vista 6ª, sub-vista de "Perfil")
- [x] 7.5 Entrada "Mis logros" añadida en `src/profile/` (extraída a `profile-achievements-link.ts` por 7.6)
- [x] 7.6 `profile.element.ts` superaba `max-lines` (300) al añadir el botón inline — extraído a `profile-achievements-link.ts` con JSDoc, mismo patrón que `profile-header.ts`/`favoritos-rutas`

## 8. Verificación end-to-end

- [x] 8.1 Cypress E2E nuevo (`cypress/e2e/achievements/achievement-unlock.cy.ts`): logro de test sembrado por SQL con umbral bajo (los 10 del catálogo real son demasiado altos para un E2E), subir una ruta vía "Subir a la nube" y confirmar la animación con título/descripción reales
- [x] 8.2 Cypress E2E: navegar a "Mis logros" y verificar el logro conseguido con fecha, más el caso sin sesión (aviso, sin llamada al backend) — contra backend real (Docker, api reconstruida con la migración 0009)
- [x] 8.3 `tsc --noEmit` limpio; `eslint src/ --max-warnings 0` limpio (0 errores, 0 warnings)
- [x] 8.4 `vitest run --coverage`: 1148/1148 tests, 96.88% líneas / 90.84% branches / 95.05% funciones — por encima del 80% en las 4 métricas
- [x] 8.5 Suite Cypress completa: 69/69 specs en verde, sin regresiones (incluye los 3 tests nuevos)
- [x] 8.6 Verificación manual en dispositivo Android real (75fe536b): logro de test sembrado por SQL, cuenta de prueba registrada vía API, `adb reverse tcp:8080` contra el Docker local. **Dos hallazgos reales del propio proceso de build/verificación, no del código de la feature**: (1) build `release` falló con `JavaVersion.parse` en `25.0.2` — mismo gotcha ya documentado en `memory/context.md` (JBR de Android Studio autoactualizado), resuelto con `JAVA_HOME` a `jdk-24`; (2) el build `release` tiene `usesCleartextTraffic="false"` (bloquea HTTP), así que contra el backend local hubo que usar `--debug` (`usesCleartextTraffic="true"`) — el build `release` solo puede probarse contra el backend real HTTPS. Animación confirmada visualmente por el usuario y verificada además por consulta directa a `user_achievements`. **Hallazgo de UX real, corregido en el momento**: el botón "Mis logros" (7.5) era un botón de texto plano al final de la pantalla de perfil, "perdido y sin icono" — rediseñado a una fila con icono+chevron justo debajo de la tarjeta de identidad (`profile-achievements-link.ts`), reinstalado y confirmado por el usuario ("brutal"). Datos de prueba (logro de test, cuentas `pruebas@gmail.com`/`device-verify-*`) limpiados de la BBDD compartida al terminar.

## 9. Cierre

- [x] 9.1 `memory/context.md` actualizado con el resumen de la sesión (correcciones de premisa, bug del `forEach`, gotchas de build Android, rediseño del acceso a "Mis logros")
- [x] 9.2 Sin ADR nueva: ninguna decisión de la implementación real cruzó el umbral (todas reutilizaron patrones ya establecidos), confirma la conclusión de `design.md`
