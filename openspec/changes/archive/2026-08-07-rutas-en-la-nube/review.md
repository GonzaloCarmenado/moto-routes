# Review — `rutas-en-la-nube`

**Veredicto: APPROVED**

## CRÍTICO (leer primero)

- **Seguridad**: sin secretos nuevos en el diff (verificado con `git diff` completo antes de este review). Sin criptografía ni parseo de tokens hecho a mano — los endpoints nuevos reutilizan `auth.RequireAuth`/`auth.TokenIssuer` ya auditados (ADR-034). El upsert de rutas (`PostgresRouteStore.Upsert`) nunca sobrescribe silenciosamente el `id` de otra cuenta — verificado con test dedicado que confirma que la ruta de la víctima queda intacta (`postgres_store_test.go::TestPostgresRouteStore_UpsertNeverOverwritesAnotherUsersRoute`). Sin rate limiting nuevo en `/api/routes/*`: **decisión explícita, no omisión** — estos no son endpoints de autenticación (login/registro/reset), son endpoints de datos ya autenticados; el único control es el límite de tamaño (`MaxPoints`), documentado en `design.md` Decisión 4 y Non-Goals. No aplica el criterio de "rate limiting en cada endpoint de auth nuevo" del contexto del proyecto porque estos no lo son.
- **Cambio en `src/shared/`, con radio de impacto real**: `src/shared/styles/tokens.css` — se añadió `margin: 0` a la regla global `h1, h2, h3, h4` (antes solo fijaba tipografía, dejaba el margen por defecto del navegador). Esto afecta a **todos** los `<h1>`–`<h4>` de la app, no solo a `route-detail`/`route-list`. Verificado por regresión funcional: los 52/52 specs de Cypress (que ejercitan diálogos con títulos en `auth/`, `cockpit/`, `perfil/`, `fotos/`) siguen en verde tras el cambio — **no se hizo inspección visual pixel a pixel de cada título de diálogo**, solo verificación funcional + la medición real (`getBoundingClientRect()` vía CDP) de los dos casos que motivaron el fix (`route-detail`, `route-list`). Riesgo residual bajo: cada título ya fijaba explícitamente su propio `margin-bottom`, así que en el peor caso el efecto visible es "un poco menos de espacio arriba de cada título", nunca un layout roto.
- **Nuevo dominio en `apps/api`**: `internal/routes/` sigue el patrón ya establecido por `internal/auth/`/`internal/stoptypes/` (store Postgres + handler + tests con `dbtest`). Sin dependencias nuevas (ni npm ni Go modules) — confirmado que no se instaló nada sin pasar antes por confirmación explícita.
- **Reglas del proyecto saltadas**: ninguna. `data-cy` en cada elemento nuevo desde su propio commit, JSDoc en símbolos exportados, sin CSS inline salvo lo ya existente, sin hardcodear tokens.

## Verificación independiente (re-ejecutada por quien revisa, no solo el resumen de la implementación)

- `go test ./...` (con Postgres real vía `dbtest`): **110/110** — `apps/api`.
- `go vet ./...`: limpio. `govulncheck`: 0 vulnerabilidades alcanzables por el código (1 en un módulo requerido pero no llamado, ya documentado como excepción existente antes de este cambio).
- `vitest run --coverage`: **917/917**, cobertura 96.29% líneas / 90.95% ramas / 94.1% funciones / 96.29% statements — todo por encima del umbral del 80%.
- `tsc --noEmit`: sin errores.
- `eslint src/` (todo `apps/mobile`, no solo los ficheros tocados): 0 errores, 0 warnings.
- `cypress run` (suite completa, backend real, sin mockear `apps/api`): **52/52** — incluye los 5 specs nuevos de `route-cloud-sync.cy.ts` y confirma cero regresiones en `auth`, `cockpit`, `perfil`, `fotos`, `route-list`, `route-detail`.
- Verificación adicional en **dispositivo Android real** (build completo de la CLI, no el atajo Gradle-only — ver gotcha nuevo en `memory/context.md`): grabar y subir una ruta real, verla sincronizada, abrir una ruta exclusiva de la nube sembrada vía API, y medir con Chrome DevTools Protocol la alineación real de los iconos nuevos (no solo capturas de pantalla).

## Cobertura de Requirements/Scenarios (spec `route-cloud-sync`)

| Requirement / Scenario | Test(s) | Estado |
|---|---|---|
| Subida correcta | `route-detail.element.spec.ts::con sesión activa y ruta local, muestra la acción y sube la ruta al pulsarla`; `route-cloud-sync.cy.ts::subir una ruta local...` | ✅ |
| Sin sesión, sin acción de subir | `route-detail.element.spec.ts::sin sesión activa, no muestra la acción...`; `route-cloud-sync.cy.ts::sin sesión activa...` | ✅ |
| Subir sin conexión | `route-detail.element.spec.ts::muestra un error sin bloquear la pantalla si la subida falla...` | ✅ |
| Re-subir actualiza copia existente | `postgres_store_test.go::UpsertCalledTwiceReplacesDataWithoutDuplicating`; `handler_test.go::UpsertHandler_CalledTwiceWithSameIDUpdatesInsteadOfDuplicating` | ✅ (backend; el disparo repetido desde la UI se cubre indirectamente vía re-subida automática, ver más abajo) |
| Puntos excesivos rechazados | `postgres_store_test.go::UpsertRejectsRouteExceedingMaxPoints`; `handler_test.go::UpsertHandler_TooManyPointsReturns400`; `route-cloud-api.service.spec.ts::lanza RouteCloudApiError kind "too-many-points"` | ✅ backend+cliente; **sin test de UI específico para este mensaje** — mismo camino de error genérico que "subir sin conexión", cubierto por ese test. Gap menor, no bloqueante. |
| Ruta solo local / sincronizada / cloud-only en el listado, sin duplicar | `route-list-sync.transform.spec.ts` (los tres estados + orden); `route-list.element.spec.ts::indicador de sincronización...`; `route-cloud-sync.cy.ts` | ✅ |
| Sin sesión, listado igual que hoy | `route-list.element.spec.ts::sin sesión activa, no muestra ningún indicador...`; `route-list-sync.service.spec.ts` | ✅ |
| Con sesión sin conexión, listado no bloquea | `route-list-sync.service.spec.ts::con sesión activa pero sin conexión, cae a solo rutas locales` | ✅ |
| Abrir detalle de ruta solo-nube | `route-detail.element.spec.ts::con sesión activa, si el id no existe localmente...`; `route-cloud-sync.cy.ts::una ruta exclusiva de la nube...` | ✅ |
| Abrir ruta solo-nube sin conexión | `route-detail.element.spec.ts::sin conexión al abrir una ruta exclusiva de la nube...` | ✅ |
| Listado nube solo de la cuenta activa | `postgres_store_test.go::ListByUserReturnsOnlySummariesForThatUser`; `route-cloud-sync.cy.ts::aislamiento entre cuentas...` | ✅ |
| No se accede al detalle de otra cuenta | `postgres_store_test.go::GetByIDForUserReturnsNilForAnotherUsersRoute`; `handler_test.go::DetailHandler_ReturnsNotFoundWhenMissingOrOtherUsers` | ✅ backend (real, con dos cuentas Postgres reales); **sin E2E que intente explícitamente adivinar/reutilizar el id de otra cuenta** — el E2E de aislamiento verifica el listado, no un intento directo de `GET /api/routes/{id}` ajeno. Gap menor: el comportamiento ya está probado de forma real contra Postgres, solo falta el mismo intento desde el navegador. |
| Nota en ruta sincronizada re-sube sola | `route-detail.element.spec.ts::guardar una nota...dispara una re-subida`; `route-detail-cloud.service.spec.ts::autoResyncIfNeeded`; `route-cloud-sync.cy.ts::guardar una nota...la re-sube sola` (verificado contra Postgres real) | ✅ |
| Foto añadida/borrada en sincronizada re-sube metadatos | `route-detail.element.spec.ts::añadir una foto...`; `...borrar una foto...` | ✅ |
| Ruta local sin sincronizar no se sube al modificarla | `route-detail.element.spec.ts::guardar una nota en una ruta que nunca se ha subido no dispara ninguna subida real`; `autoResyncIfNeeded::si la ruta nunca se ha subido, no hace nada` | ✅ |
| Re-subida automática falla sin revertir el cambio local | `route-detail-cloud.service.spec.ts::si la re-subida falla, muestra un aviso discreto sin lanzar` | ✅ |

**Cobertura de escenarios: 18/18 con al menos un test automatizado.** Dos gaps menores señalados arriba (mensaje de error específico de "demasiados puntos" en la UI, e intento explícito de adivinar un id de otra cuenta en E2E) — ninguno bloqueante: ambos casos están cubiertos por el mismo mecanismo genérico ya probado (manejo de error uniforme; aislamiento real contra Postgres).

## Desviaciones reales encontradas durante la implementación (documentadas, no ocultas)

- El indicador de estado del listado pasó por **tres diseños** antes de convencer al usuario en dispositivo real (chip con texto → chip solo-icono en la fila de chips → icono junto al botón de eliminar → insignia final sobre la miniatura). Documentado en `design.md` Decisión 9 con el motivo real (medición de alineación, no solo gusto estético).
- El botón "Subir a la nube" (ancho completo, como en la propuesta original) se sustituyó por un icono junto al título tras verificación en dispositivo real — `design.md` Decisión 7.
- Nueva funcionalidad de re-subida automática (grupo 10 de `tasks.md`, Requirement nuevo en el spec) — no estaba en el alcance original de la propuesta, añadida a petición explícita del usuario tras probar la primera versión.
- Gap de build de Android encontrado y documentado en `memory/context.md`: ni el atajo "solo Gradle" ni, en esta sesión, el build completo de la CLI por sí solo garantizaron que el APK contuviera el frontend recién compilado — hubo que verificar el hash y repetir copiar+rebuild varias veces. No afecta al código de producción, solo al propio proceso de build/verificación.

## Convenciones de frontend

`data-cy` presente en cada elemento nuevo interactivo/localizable, añadido en el mismo commit que lo crea. Separación de ficheros respetada (`.element.ts`/`.service.ts`/`.transform.ts` en `routes/list/` y `routes/detail/`). Iconos compartidos correctamente extraídos a `src/shared/icons/` en vez de duplicados entre `route-list` y `route-detail`. Sin CSS inline nuevo. JSDoc conciso en todos los símbolos exportados.

## Conclusión

Sin gaps bloqueantes. Los dos gaps de cobertura señalados son menores y no representan riesgo real (mismo camino de código ya probado por otro escenario). El cambio en `tokens.css` es el único punto que merece atención especial por su radio de impacto, y está mitigado por la suite de regresión completa en verde. **Aprobado para archivar.**
