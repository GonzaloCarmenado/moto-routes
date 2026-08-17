## 1. Recuento real de invitaciones pendientes

- [x] 1.1 Test en rojo en `route-list-sharing.spec.ts`: `hasPendingReceivedInvitations()` devuelve el número real de invitaciones pendientes (no `boolean`) — `0` sin sesión o sin pendientes, `false`→`0` en caso de fallo de red (best-effort, sin romper el listado).
- [x] 1.2 Implementar el cambio de tipo en `route-list-sharing.ts` (`Promise<number>` en vez de `Promise<boolean>`). Test en verde.

## 2. Badge numérico en el botón de invitaciones

- [x] 2.1 Test en rojo: `buildSharingButton(count: number)` — sin badge cuando `count === 0` (mismo comportamiento visual que hoy sin pendientes), badge con el número exacto para 1-9, "9+" para `count > 9`.
- [x] 2.2 Implementar en `route-list-sharing.ts` + CSS en `route-list.element.css` reutilizando el patrón de posicionamiento de `.favorite-icon--badge`. Test en verde.

## 3. Wiring en `route-list.element.ts` / `route-list-controls.ts`

- [x] 3.1 Test en `route-list.element.spec.ts` (no llegó a estar en rojo a nivel de runtime — JS no aplica los tipos estáticos, el flujo de datos ya era correcto; el único fallo real era de tipos, confirmado con `tsc --noEmit`, 2 errores antes de corregir) — el botón de invitaciones muestra el número real de pendientes tras `fetchAndRender()`.
- [x] 3.2 Cambiar `_hasPendingShares` a `number` en `route-list.element.ts` y `ControlsRowOptions.hasPendingShares` en `route-list-controls.ts`. Test en verde.

## 4. Verificación

- [x] 4.1 `tsc --noEmit` limpio, `eslint src/ --max-warnings 0` limpio, `vitest run --coverage` 1185/1185 (96.89%/95.21%/90.70%), `pnpm run docs:coverage` 70% (sin bajar el umbral, comprobado a propósito tras el hallazgo de la sesión anterior).
- [x] 4.2 Extendido `route-sharing.cy.ts` (test ya existente que envía 2 invitaciones reales) con la aserción del badge — Cypress completo 75/75 en verde.

## 5. Cierre

- [x] 5.1 Actualizar `memory/context.md` con el estado resultante de esta sesión.
- [x] 5.2 `memory/decisions.md` — sin ADR nueva (cambio de visibilidad puramente frontend, sin alternativas reales evaluadas ni coste de reversión relevante); confirmado tras implementar, sin cambios respecto a lo previsto.
