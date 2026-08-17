# Revisión — `contador-invitaciones-pendientes`

## CRÍTICO

Nada que revisar con prioridad: sin secretos, sin CSP, sin inputs de usuario, sin cambios en `src/shared/`, sin dependencias nuevas, sin cambios de backend. `design.md` deliberadamente omitido (artefacto condicional del schema `spec-driven`) — decisión tomada y comunicada al usuario en el propio `proposal.md`/resumen de la propuesta, no un olvido: sin patrón nuevo, sin dependencia, sin ambigüedad real (el único matiz de diseño, el tope "9+", ya iba en la propia propuesta).

## Verificación independiente

- `route-list-sharing.ts` — `hasPendingReceivedInvitations()` devuelve el recuento real (`number`), `buildSharingButton()` construye el badge (`1`-`9` exacto, `"9+"` por encima, sin badge con `0`). Releído contra `specs/compartir-rutas/spec.md` del propio cambio.
- `route-list-controls.ts` / `route-list.element.ts` — tipo `hasPendingShares` corregido de `boolean` a `number` en toda la cadena. Confirmado con `tsc --noEmit` (2 errores antes de corregir, 0 después) — el fallo real era solo de tipos: en runtime JS el dato ya fluía correctamente incluso con el tipo viejo, así que el test de Vitest de la tarea 3.1 no llegó a estar en rojo (documentado así en `tasks.md`, no se disfrazó).
- `route-list.element.css` — badge reutiliza el patrón de posicionamiento de `.favorite-icon--badge` ya existente; añadido `position: relative` a `.favorite-icon` (necesario para anclar el badge, no rompe el uso ya existente de esa clase en badges posicionados de forma absoluta sobre otro contenedor).
- `pnpm run docs:coverage` ejecutado a propósito antes de cerrar (70% exacto, sin bajar) — comprobación añadida tras el hallazgo de CI de la sesión anterior (`mejoras-listado-rutas`), para no repetir el mismo gate-bypass.

## Mapeo Requirement → Scenario → test

| Scenario (spec delta) | Test |
|---|---|
| Lista de invitaciones pendientes con datos suficientes (sin cambios) | Ya cubierto por `compartir-rutas` original, no tocado |
| Sin invitaciones pendientes (sin cambios) | Ídem |
| El acceso a invitaciones muestra el número real de pendientes | `route-list-sharing.spec.ts` "returns the real count..." + `route-list.element.spec.ts` "muestra el número real..." + `route-sharing.cy.ts` (extendido, 2 invitaciones reales vía backend) |
| Más de 9 invitaciones pendientes se muestran como "9+" | `route-list-sharing.spec.ts` "shows '9+' when there are more than 9..." |
| Sin invitaciones pendientes, el botón no muestra ningún número | `route-list-sharing.spec.ts` "no badge" |

5/5 escenarios del delta cubiertos (2 heredados sin cambio, 3 nuevos con test dedicado). Ninguno marcado como verificación manual.

## Hallazgos

Ninguno bloqueante. Nota de proceso, no de código: la tarea 3.1 (TDD) no llegó a un estado rojo real en runtime — el bug era puramente de tipos estáticos (TypeScript), no de comportamiento. Documentado con honestidad en `tasks.md` en vez de forzar la narrativa de "rojo→verde" donde no la hubo.

## Veredicto

**APPROVED**

10/10 tareas completas y verificadas de forma independiente. Suite completa en verde (Vitest 1185/1185, Cypress 75/75, `tsc`/ESLint limpios, `docs:coverage` 70%). Sin hallazgos de seguridad, sin desviaciones de la propuesta. Listo para archivar y abrir PR.
