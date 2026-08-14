# Review — favoritos-rutas

## CRÍTICO (leer primero)

- **Seguridad**: sin autenticación/autorización nueva, sin criptografía ni parseo de tokens hecho a mano, sin secretos nuevos. Diff completo revisado explícitamente (`git diff` de todo lo trackeado + ficheros nuevos) buscando `api[_-]?key|secret|password|token|bearer|-----BEGIN|AKIA...|ghp_...|sk-...`: los únicos matches son el identificador de variable `token: string`/`Bearer ${token}` (mecanismo JWT ya existente, sin tocar) y el valor dummy de test `'jwt-token'` — sin credenciales reales. El único endpoint tocado (`PUT /api/routes` vía `UpsertHandler`) ya exigía sesión antes de este cambio; `is_favorite` viaja en el mismo body autenticado, sin superficie nueva de autorización.
- **`src/shared/`**: un componente nuevo, `shared/favorite-toggle.ts` — puramente de construcción de DOM (sin IO, sin acceso a red/BBDD), usado por `route-detail` y `route-list`. Radio de impacto acotado: cualquier regresión visible solo en el icono de favorito de esos dos sitios, no en otro dominio.
- **Dependencias**: ninguna dependencia npm/Cargo/Go nueva.
- **Reglas del proyecto saltadas**: ninguna sin justificar. `route-detail.element.ts` y `route-list.element.ts` superaron `max-lines` durante la implementación y se resolvió con el patrón ya establecido de extracción a fichero propio (`route-detail-header.ts`, `route-detail-favorite.ts`, `route-list-favorite.ts`), no con una excepción de lint nueva.
- **Nota de higiene de commit (no bloquea)**: el working tree incluye cambios en `apps/mobile/src-tauri/gen/android/app/src/main/assets/assets/*` (bundle regenerado por `install-android.sh` durante la verificación manual en dispositivo, tarea 6.4) — hashes de chunk distintos, ~970 líneas de diff que no aportan nada a la revisión de este cambio. Recomendado excluir estos ficheros del commit final (`git restore` o `git add` selectivo) para no ensuciar el diff de la PR con ruido de build; se regenerarán igual en el próximo build real.

## Veredicto: **APPROVED**

## Mapeo Requirement → Scenario → Verificación

### Capability `favoritos-rutas` (nueva)

**Requirement: Marcar o desmarcar una ruta como favorita requiere sesión activa**
- Scenario "Marcar una ruta como favorita" — ✅ `route-detail.element.spec.ts:945` ("con sesión activa, marca la ruta como favorita al pulsar el icono"), `route-list.element.spec.ts:533`; verificado además contra servidor real en `routes/route-cloud-sync.cy.ts` ("marcar/desmarcar favorita con sesión activa persiste local y se re-sincroniza sola contra el servidor real").
- Scenario "Desmarcar una ruta favorita" — ✅ `route-detail.element.spec.ts:962`, `route-list.element.spec.ts:554`.
- Scenario "La acción de marcar/desmarcar no está disponible sin sesión activa" — ✅ `favorite-toggle.spec.ts:5` (unit, renderiza `<span>` sin `onToggle`); `routes/route-cloud-sync.cy.ts` ("sin sesión activa, el indicador de favorito se muestra pero como `<span>` no interactivo") end-to-end.

**Requirement: El estado de favorito se muestra siempre, tenga o no sesión activa**
- Scenario "Una ruta favorita se ve como tal aunque no haya sesión" — ✅ `favorite-toggle.spec.ts:21` ("shows the read-only indicator filled regardless of session"); Cypress cubre el mismo caso contra datos reales.

**Requirement: Marcar favorita una ruta local funciona sin conexión, y se sincroniza si la ruta ya está en la nube**
- Scenario "Marcar favorita sin conexión no bloquea la acción" — ✅ por construcción: `updateFavorite()` (`sqlite-route.repository.ts`/`memory-route.repository.ts`) escribe solo en almacenamiento local, sin ninguna llamada de red en la ruta síncrona — mismos tests de persistencia local (`route.repository.spec.ts:204`) demuestran que la escritura no depende de red. No hay un test explícito de "sin conexión simulada" porque la arquitectura no tiene ninguna rama que dependa de conectividad para este paso.
- Scenario "Marcar favorita una ruta puramente local no dispara ninguna subida" — ✅ `route-detail.element.spec.ts:994`, `route-list.element.spec.ts:592`.
- Re-subida si ya sincronizada (parte del mismo requirement, delegado al requirement MODIFIED de `route-cloud-sync`) — ✅ ver abajo.

**Requirement: El listado se puede filtrar para ver solo las rutas favoritas**
- Scenario "Activar el filtro oculta las rutas no favoritas" — ✅ `route-list.element.spec.ts:624`; Cypress `route-list/route-list.cy.ts` ("activar el filtro oculta las rutas no favoritas; desactivarlo restaura el listado completo").
- Scenario "El filtro no tiene favoritas que mostrar" — ✅ `route-list.element.spec.ts:641`; Cypress ("muestra un estado vacío dedicado cuando no hay ninguna favorita con el filtro activo") — `data-cy="route-list-empty-favoritas"`, distinto de `route-list-empty`.
- Scenario "Desactivar el filtro restaura el listado completo" — ✅ `route-list.element.spec.ts:654` y el mismo test Cypress combinado citado arriba.

### Capability `route-cloud-sync` (modificada)

**Requirement: Una ruta ya sincronizada se actualiza sola en la nube al modificarla localmente**
- Scenario "Marcar o desmarcar favorita una ruta sincronizada la re-sube sola" — ✅ unit: `route-detail.element.spec.ts:976`, `route-list.element.spec.ts:571`; end-to-end contra servidor real: `routes/route-cloud-sync.cy.ts` ("marcar/desmarcar favorita..." y "marcar favorita desde el listado (sin entrar al detalle)..."), ambos verifican `is_favorite` directamente en la respuesta del servidor.
- Scenario "Modificar una ruta puramente local no la sube" (favorito) — ✅ mismos tests citados arriba de "no dispara ninguna subida".
- Scenario "La re-subida... falla sin bloquear ni deshacer el cambio local" — ✅ cubierto indirectamente: favoritos reutiliza `triggerAutoResync`/`autoResyncIfNeeded` (`route-detail-sync-triggers.ts`, sin cambios de comportamiento en este mecanismo) tal cual, mecanismo ya probado para notas/fotos antes de este cambio (decisión D3 del design: "cero mecanismo de sincronización nuevo"). No hay un test que simule explícitamente un fallo de red específico para favoritos — es consistente con que el propio mecanismo reutilizado no distingue el campo que dispara la re-subida.

## Hallazgos

Sin hallazgos de tipo gap, desviación, calidad o cobertura que bloqueen el archivado. Dos notas menores, ninguna bloqueante:

- **[Minor] Sin test explícito de fallo de red para la re-subida de favoritos.** `route-detail-sync-triggers.ts` (sin cambios). No es un gap de este cambio — es una consecuencia esperada de reutilizar el mecanismo genérico ya existente (D3) sin bifurcar comportamiento por campo. Si en el futuro se decide bifurcar el manejo de errores por tipo de campo, sí haría falta un test dedicado.
- **[Minor] Ruido de build en el working tree.** Ver nota de higiene de commit en CRÍTICO — excluir `gen/android/.../assets/*` regenerado del commit final.

Sin hallazgos de convenciones de frontend: estructura por dominio respetada (`shared/favorite-toggle.ts` para lo compartido, extracciones a `route-detail-favorite.ts`/`route-detail-header.ts`/`route-list-favorite.ts` sin duplicar lógica entre `list`/`detail`), CSS sin hardcodear color/espaciado/radio (tamaños de icono en `px` son consistentes con el resto del proyecto — patrón preexistente en todos los `*.element.css`, no una excepción nueva), `data-cy` presente en todo elemento interactivo o localizable (`route-detail-btn-favorito`, `route-card-btn-favorito`, `route-list-filtro-favoritas`, `route-list-empty-favoritas`), JSDoc conciso en todo símbolo exportado nuevo.

## Independiente, re-ejecutado en esta revisión (no solo el resumen de la implementación)

- `go test ./...` (`apps/api`, contra Postgres real vía Docker, imagen reconstruida para incluir la migración `0007_add_route_favorite.sql`): **113/113**.
- `tsc --noEmit`: 0 errores.
- `eslint src/ --max-warnings 0`: 0 warnings.
- `vitest run --coverage`: **1086/1086** tests, 374/374 suites, `success: true` (umbral 80% superado en las 4 métricas).
- Cypress E2E completo (`pnpm run test:e2e`, contra `apps/api` real): **60/60**, incluyendo los 3 tests nuevos de filtro en `route-list.element.cy.ts` y los 2 tests nuevos de favorito con sesión real en `routes/route-cloud-sync.cy.ts`.
- `cargo`: sin ejecutar — ningún fichero de `src-tauri/src` ni `Cargo.toml` cambia en este diff (confirmado con `git diff --stat`/`git status` filtrando `gen/android`), el cambio no toca Rust.
- Verificación manual en dispositivo real (tarea 6.4): confirmada por el usuario — marcar/desmarcar desde detalle y lista, filtro, persistencia tras reinicio y re-sincronización tras reconectar, sin hallazgos.
- Lectura completa del código nuevo/modificado: backend (`handler.go`, `routes.go`, `postgres_store.go`, migración), modelo/repositorios (`route.types.ts`, `route.repository.ts`, `sqlite-route.repository.ts`, `memory-route.repository.ts`), componente compartido (`favorite-toggle.ts`), wiring de UI (`route-detail-header.ts`, `route-detail-favorite.ts`, `route-list-favorite.ts`, `route-detail.element.ts`, `route-list.element.ts`) y CSS de ambos componentes.
