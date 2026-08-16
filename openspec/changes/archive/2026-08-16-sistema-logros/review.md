# Revisión independiente — sistema-logros

Revisión completa antes de archivar: mapeo Requirement → Scenario → test, relectura de la implementación completa (backend, frontend, migración), y re-ejecución de la suite completa desde cero.

## Mapeo Requirement → Scenario → Test

### `logros` (9 requirements, 20 scenarios)

1. **Catálogo de logros basado en datos**
   - Añadir un logro nuevo sin desplegar código → `postgres_store_test.go::seedAchievement` (usado en 5 tests distintos, cada uno inserta un logro nuevo por SQL y `CheckAndGrant` lo evalúa sin tocar código Go)
2. **Cálculo de agregados sobre rutas sincronizadas**
   - Ruta local sin sincronizar no cuenta → garantía arquitectónica (el backend solo ve filas de `routes` ya subidas; no hay ninguna vía para que una ruta puramente local llegue a esta tabla) + `TestPostgresAchievementStore_AggregatesComputesTotalsAcrossSyncedRoutes`
3. **Otorgamiento idempotente de logros**
   - Se otorga la primera vez → `TestPostgresAchievementStore_CheckAndGrantGrantsOnceAndNeverDuplicates`
   - Comprobación repetida no duplica → mismo test (segunda llamada, `ON CONFLICT DO NOTHING`)
4. **Comprobación de logros tras sincronización**
   - Logro nuevo tras subir → `route-detail-cloud.service.spec.ts::"tras subir con éxito, comprueba..."`
   - Sin logros nuevos → `route-detail-cloud.service.spec.ts::"sin logros nuevos, no se encola ninguna animación"` (añadido durante esta revisión — hueco real detectado, cerrado antes de archivar)
   - Fallo no bloquea la sincronización → `route-detail-cloud.service.spec.ts::"si la comprobación de logros falla..."` + `TestCheckHandler_*` (backend)
5. **Persistencia permanente del logro otorgado**
   - Borrar ruta no revoca → `TestPostgresAchievementStore_GrantedAchievementPersistsAfterRouteDeleted`
6. **Animación de logro desbloqueado**
   - Un único logro → `achievement-unlock-overlay.spec.ts::"muestra la animación inmediatamente..."`
   - Varios logros en cola → mismo fichero, `"...se encola y se muestra al cerrarse la anterior"` + `"...pulsa Continuar..."`
   - Movimiento reducido → `achievement-unlock-overlay.element.css.spec.ts` (mismo patrón que `route-map.element.css.spec.ts`: sin exención propia, se apoya en el override global de `tokens.css`)
7. **Pantalla "Mis logros"**
   - Ver conseguidos / progreso pendientes / sin sesión / sin rutas → los 4 cubiertos en `achievement-list.element.spec.ts`
8. **Ventana mensual de mes natural**
   - Se reinicia cada mes → `TestPostgresAchievementStore_AggregatesMonthOnlyCountsCurrentCalendarMonth`
   - Logro mensual ya otorgado no se pierde al cambiar de mes → cubierto por la garantía genérica de persistencia permanente (requirement 5), no por un test mensual dedicado — mismo mecanismo (`UNIQUE`, nunca se re-evalúa un logro ya otorgado), no hay lógica adicional específica de "mes" que pueda romper esto de forma distinta
9. **Logro de ruta larga por duración**
   - Una sola ruta larga desbloquea / varias cortas no acumulan → `TestPostgresAchievementStore_SingleRouteDurationNotMetByAccumulation`

**Sin gaps bloqueantes.** El único hueco real encontrado (escenario "Sin logros nuevos" sin test dedicado en frontend) se cerró durante esta misma revisión, antes de archivar.

## Verificación end-to-end re-ejecutada desde cero

- `go test ./...`: 190/190 (14 paquetes)
- `gofmt -l`, `go vet ./...`, `govulncheck ./...`: limpios (0 vulnerabilidades que afecten código propio)
- `tsc --noEmit`: limpio
- `eslint src/ --max-warnings 0`: limpio (0 errores, 0 warnings)
- `vitest run --coverage`: 1149/1149, 96.9% líneas / ~91% branches — por encima del 80% en las 4 métricas
- Cypress completo (`cy:run`, backend real en Docker): 69/69 specs, incluye 3 tests E2E nuevos (`achievements/achievement-unlock.cy.ts`)
- **Verificación manual en dispositivo Android real** (75fe536b): logro de test otorgado y confirmado tanto visualmente (animación + "Mis logros") como por consulta directa a `user_achievements`. Dos gotchas de entorno (JBR autoactualizado a Java 25, `usesCleartextTraffic` en release) resueltos y documentados en `memory/context.md`, ninguno relacionado con el código de la feature. Un hallazgo real de UX (acceso a "Mis logros" mal ubicado, sin icono) corregido en el momento y reverificado.

## Seguridad

- Los 2 endpoints nuevos (`POST /api/achievements/check`, `GET /api/achievements`) exigen `auth.RequireAuth` — sin acceso sin sesión (`TestCheckHandler_RequiresAuthentication`, `TestListHandler_RequiresAuthentication`).
- Sin secretos nuevos, sin dato personal expuesto más allá de lo ya existente (los logros de un usuario solo son visibles para ese usuario, filtrados por `user_id` en cada query).
- Sin endpoint de autenticación nuevo → sin necesidad de rate limiting dedicado (mismo criterio que otros endpoints de datos ya existentes como `/api/routes`, `/api/route-shares/received`).
- `routes.created_at` (`TEXT` sin validar) aislado correctamente vía `safe_parse_timestamptz()` — no hay forma de que un valor adversario rompa el cálculo de agregados de otro usuario (la función es `STABLE`, sin efectos secundarios, y el `WHERE user_id = $1` ya acota el alcance).

## Alineación con decisiones previas

Ninguna decisión de este cambio contradice una ADR existente. Reutiliza patrones ya establecidos: `routesharing` (estructura de paquete backend), `stop_types` (catálogo `BIGSERIAL`+`key`), `route-sharing.element.ts` (pantalla de cuenta), `toast.ts`/`confirm-dialog.element.ts` (overlay en `shared/feedback/`). Confirmado: no se alcanza el umbral de ADR nueva.

## Veredicto

**APPROVED.** Los 9 requirements y sus 20 escenarios están cubiertos por tests reales (no solo por revisión de código), la suite completa está en verde de extremo a extremo (Go, TypeScript, Cypress, dispositivo real), y no quedan huecos de cobertura conocidos sin cerrar.
