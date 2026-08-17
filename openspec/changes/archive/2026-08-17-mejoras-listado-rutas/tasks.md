## 1. Lógica pura de filtrado y orden combinados

- [x] 1.1 Test en rojo: `route-list-filters.transform.spec.ts` — combinación favoritas + local + nube + búsqueda + orden (fecha por defecto, nombre A-Z), incluyendo los escenarios de `specs/listado-rutas/spec.md` (ambos filtros de sync activos → vacío, búsqueda sin coincidencias → vacío, orden aplicado tras filtrar).
- [x] 1.2 Implementar `route-list-filters.transform.ts` (design.md Decisión 2) — función pura que recibe la lista ya fusionada local+nube y el estado de los 5 controles, devuelve la lista filtrada y ordenada. Test en verde.

## 2. Filtro "Solo favoritas" — de texto a icono

- [x] 2.1 Test en rojo en `route-list-favorite.spec.ts`: `buildFavoritesFilterToggle()` ya no tiene `textContent`, sí `aria-label="Solo favoritas"` y mantiene `data-cy="route-list-filtro-favoritas"` sin cambios.
- [x] 2.2 Implementar el cambio en `route-list-favorite.ts` — reutiliza `FAVORITE_ICON` de `shared/icons/favorite-icons.ts`, mismo patrón `.favorite-icon` que el botón de invitaciones. Test en verde.

## 3. Filtros nuevos "Solo locales" / "Solo en la nube"

- [x] 3.1 Test en rojo: construcción de los dos botones toggle (icono `DEVICE_ICON` / `CLOUD_ONLY_ICON` de `shared/icons/cloud-sync-icons.ts`, `data-cy="route-list-filtro-locales"` / `data-cy="route-list-filtro-nube"`, `aria-label`, ocultos sin sesión activa — Requirement "Filtrar por estado de sincronización" de la spec).
- [x] 3.2 Implementar en un fichero nuevo `route-list-sync-filters.ts` (mismo patrón que `route-list-favorite.ts`/`route-list-sharing.ts`). Test en verde.

## 4. Buscador por nombre

- [x] 4.1 Test en rojo: campo de texto `data-cy="route-list-buscador"`, filtra en vivo sin distinguir mayúsculas/minúsculas, vaciar restaura el resto de filtros activos (Requirement "Buscar rutas por nombre").
- [x] 4.2 Implementar el campo y su wiring en `route-list.element.ts` (evento `input`, sin debounce — design.md Non-Goals). Test en verde.

## 5. Control de orden fecha/nombre

- [x] 5.1 Test en rojo: control `data-cy="route-list-orden"`, por defecto fecha, alternar a nombre reordena A-Z, `localeCompare` con `sensitivity: 'base'` en español (Requirement "Ordenar el listado por fecha o por nombre").
- [x] 5.2 Implementar el control y su wiring. Test en verde.

## 6. Layout del header

- [x] 6.1 CSS en `route-list.element.css`: fila flex nueva para los 4 iconos (invitaciones, favoritas, locales, nube); fila separada para buscador + orden (design.md Decisión 6) — solo `var(--token)`, ninguna medida hardcodeada, hitbox mínima 56×56px en los 4 iconos.
- [x] 6.2 Verificación visual en el dev server a 390px de ancho: **no posible** — extensión Claude-in-Chrome no conectada (mismo bloqueo ya documentado en `limpieza-tecnica-monorepo`). Sustituida por garantía de construcción: 4 iconos × 56px + 3 gaps `var(--space-3)` (~260px) caben con margen en los 346px disponibles (390px − 2×22px de padding); verificación estructural real delegada a Cypress (grupo 8).

## 7. Límite de líneas

- [x] 7.1 Tras 1-6, comprobar el conteo real de `route-list.element.ts` contra `max-lines` (`eslint.config.js`). Si lo supera, extraer la construcción de la fila de controles a `route-list-controls.ts` (design.md, Risk) — solo si hace falta, no de antemano. **Hallazgo real**: la extracción prevista en design.md no bastó por sí sola (el fichero seguía por encima del límite); se extrajo también `route-list-body.ts` (estados vacíos) y `route-list-thumb.ts` (miniatura/backfill, código preexistente no tocado por este cambio) para dejarlo en 0 warnings de `max-lines`.

## 8. Verificación end-to-end

- [x] 8.1 Cypress nuevo en `route-list/route-list.cy.ts` (o fichero dedicado) cubriendo los escenarios reales de `specs/listado-rutas/spec.md`: filtros local/nube combinados, búsqueda con y sin resultados, cambio de orden, filtros de sync ocultos sin sesión. Fichero dedicado `route-list-filtros-busqueda.cy.ts`, 6/6 en verde contra backend real.
- [x] 8.2 Suite completa: `tsc --noEmit` limpio, `eslint src/ --max-warnings 0` limpio, `vitest run --coverage` 1182/1182 (96.93% statements, 95.20% functions, 90.80% branches — todo ≥80%), Cypress completo 75/75 en verde (13 specs, backend Docker real) — no solo los tests nuevos.

## 9. Cierre

- [x] 9.1 Actualizar `memory/context.md` con el estado resultante de esta sesión.
- [x] 9.2 `memory/decisions.md` — sin ADR nueva (ya justificado en `design.md`); confirmado que ninguna decisión de la implementación real (los dos gaps encontrados) la alcanza — son detalles de implementación, no decisiones con alternativas evaluadas.
