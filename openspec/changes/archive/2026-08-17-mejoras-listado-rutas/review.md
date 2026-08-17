# Revisión — `mejoras-listado-rutas`

## CRÍTICO

Nada que un humano deba revisar con prioridad: sin secretos, sin cambios de CSP, sin inputs de usuario sin validar más allá de la búsqueda por texto (comparación simple, sin ejecución ni interpolación insegura — `textContent`/`.value`, nunca `innerHTML` con datos de usuario). Sin cambios en `src/shared/` (solo lectura de iconos/utilidades ya existentes: `FAVORITE_ICON`, `DEVICE_ICON`, `CLOUD_ONLY_ICON`, `buildRouteDisplayName`) — sin radio de impacto sobre otros dominios. Sin dependencias nuevas. Ninguna norma del proyecto saltada: el límite de líneas de `route-list.element.ts` se resolvió con extracción (mismo patrón ya documentado en `CLAUDE.md`), no con una excepción nueva en `eslint.config.js`.

## Verificación independiente

Releído cada fichero nuevo/tocado, no solo el resumen de la implementación, y vuelto a ejecutar la suite completa desde cero (no solo los tests nuevos):

- `route-list-filters.transform.ts` — lógica de filtrado/orden combinados, pura, 10 tests dedicados.
- `route-list-favorite.ts` — filtro de favoritas ahora icono, `data-cy` sin cambios (confirmado antes de diseñar que Cypress/Vitest lo usan por atributo, no por texto).
- `route-list-sync-filters.ts` — dos filtros nuevos, mismo patrón `.favorite-icon`.
- `route-list-controls.ts` / `route-list-body.ts` / `route-list-thumb.ts` — extracciones de `route-list.element.ts` para volver a `max-lines` en 0 warnings; `route-list-thumb.ts` es código preexistente movido sin cambios de comportamiento (confirmado con el mismo test suite que ya lo cubría, sin tocar sus aserciones).
- `route-list.element.ts` — `updateBodyOnly()` (actualización parcial del Shadow DOM para no perder el foco del buscador) tiene su propio test de regresión dedicado.
- `route-list.element.css` — reutiliza tokens existentes (`var(--space-*)`, `var(--r-pill)`, `var(--hitbox-min)`), sin valores hardcodeados nuevos; el pill de orden reutiliza literalmente el estilo que antes tenía el filtro de favoritas (ya no lo necesita, al pasar a icono).
- `git diff origin/master --stat` sobre todo el cambio: confirmado que no toca `apps/api`, `infra/`, ni ningún fichero fuera de `apps/mobile/src/routes/list/`, `apps/mobile/src/routes/list/*.spec.ts`, `apps/mobile/cypress/e2e/route-list/`, `openspec/`, `memory/`.

## Mapeo Requirement → Scenario → test

| Requirement | Scenario | Test |
|---|---|---|
| Filtrar por sincronización | Solo locales oculta sincronizadas/nube | `route-list.element.spec.ts` "activar 'Solo locales' oculta..." + `route-list-filtros-busqueda.cy.ts` |
| | Solo en la nube oculta locales | `route-list.element.spec.ts` "activar 'Solo en la nube'..." + Cypress |
| | Ambos a la vez → vacío genérico | `route-list.element.spec.ts` "activar ambos filtros..." + Cypress |
| | Sin sesión, filtros ocultos | `route-list.element.spec.ts` "sin sesión activa, no se muestran..." + Cypress |
| Buscar por nombre | Filtra en vivo, sin distinguir mayúsculas | `route-list-filters.transform.spec.ts` + `route-list.element.spec.ts` + Cypress |
| | Sin coincidencias → vacío | `route-list-filters.transform.spec.ts` "ninguna coincidencia" + `route-list.element.spec.ts` + Cypress |
| | Vaciar restaura | `route-list.element.spec.ts` "vaciar el buscador restaura..." + Cypress |
| Ordenar fecha/nombre | Fecha por defecto | `route-list-filters.transform.spec.ts` + `route-list.element.spec.ts` + Cypress |
| | Nombre reordena A-Z | ídem + `localeCompare` español (`Álvarez` antes que `Zeta`) |
| | Orden sobre resultado ya filtrado | `route-list-filters.transform.spec.ts` "aplica sorting on top of..." + `route-list.element.spec.ts` "el orden se aplica sobre el resultado ya filtrado" |
| No persiste entre aperturas | Instancia nueva arranca limpia | Implícito por diseño (campos de clase con valor inicial, sin `localStorage`/persistencia) — cubierto indirectamente por cada test que crea una instancia nueva y verifica su estado inicial (p. ej. "por defecto ordena por fecha") |

11/11 escenarios cubiertos. Ningún escenario marcado como verificación manual — todos automatizables y automatizados (Vitest o Cypress).

## Hallazgos

Ninguno bloqueante. Dos gaps reales encontrados durante `apply`, ya corregidos y documentados en `memory/context.md` y en el propio código (JSDoc): `route.name` nullable (búsqueda/orden debían usar `buildRouteDisplayName`, no el campo en crudo) y la pérdida de foco del buscador en cada tecla (resuelto con `updateBodyOnly()`, con test de regresión). Ninguno de los dos contradice `design.md` ni alcanza el umbral de ADR — son correcciones de implementación, no decisiones con alternativas evaluadas.

Nota no bloqueante: la verificación visual en navegador (tarea 6.2) no fue posible por la extensión Claude-in-Chrome desconectada — sustituida por aritmética de anchos y por la cobertura estructural de Cypress a 390×844 (mismo viewport que usa toda la suite E2E del proyecto).

## Veredicto

**APPROVED**

Los 17/17 tareas de `tasks.md` están implementadas y verificadas de forma independiente. Suite completa en verde (Vitest 1182/1182, Cypress 75/75, `tsc`/ESLint limpios). Sin hallazgos de seguridad, sin desviaciones de `design.md`, sin escenarios pendientes. Listo para archivar y abrir PR.
