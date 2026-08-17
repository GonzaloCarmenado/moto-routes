## Context

`route-list.element.ts` es un Web Component con Shadow DOM (sin framework), estado en campos de la clase, re-render manual en cada cambio. Hoy solo tiene un filtro (`_showFavoritesOnly: boolean`), aplicado con `.filter()` sobre la lista ya fusionada local+nube antes de renderizar. El orden es fijo: `sqlite-route.repository.ts::getAll()` ordena por `created_at DESC`, y `route-list-sync.transform.ts` reordena por `createdAt` (string ISO, `localeCompare`) tras fusionar local+nube, para que las rutas solo-en-la-nube no queden siempre al final.

El botón de invitaciones (`route-list-sharing.ts`) y el filtro de favoritas (`route-list-favorite.ts`) se construyen como fragmentos DOM independientes y se insertan uno tras otro en `buildHeader()` (`route-list.element.ts`), sin un contenedor de fila compartido — de ahí que hoy se apilen verticalmente. `.favorite-icon` (usada por el botón de invitaciones) ya usa `var(--hitbox-min)` (56×56px) — no hace falta ninguna excepción a la regla de hitbox para replicar el mismo patrón en los iconos nuevos.

Ver `proposal.md` para el porqué; las 4 decisiones de alcance (icono vs texto, toggles independientes vs selector de 3 estados, búsqueda en vivo vs con confirmación, orden simple vs con asc/desc) ya se decidieron con el usuario antes de proponer.

## Goals / Non-Goals

**Goals:**

- Un único punto que combine favoritas + local + nube + búsqueda + orden sobre la lista ya fusionada, en vez de encadenar filtros sueltos dentro del componente.
- Mantener todo en memoria/cliente — sin IPC, sin queries SQL nuevas, sin llamadas a la API.
- No romper ningún test existente que dependa de `data-cy="route-list-filtro-favoritas"` (Cypress y Vitest ya lo usan por atributo, no por texto — confirmado por grep antes de diseñar esto).

**Non-Goals:**

- Sin persistencia entre aperturas de la app para ningún control nuevo (búsqueda, orden, local, nube) — mismo criterio ya vigente para "Solo favoritas".
- Sin normalización de acentos/diacríticos en la búsqueda — limitación conocida, ver Risks.
- Sin cambios al indicador por tarjeta de estado de sincronización (`route-cloud-sync`, ya correcto) ni a la regla que evita mostrarlo sin sesión.
- Sin debounce en la búsqueda — el dataset ya está en memoria (mismo origen que el filtro de favoritas existente), filtrar en cada tecla es una operación pura sobre un array ya cargado, sin coste de red que amortiguar.

## Decisions

### 1. Un campo de estado por control, no un objeto `_filters`

`_showLocalOnly: boolean`, `_showCloudOnly: boolean`, `_searchQuery: string`, `_sortBy: 'date' | 'name'` como campos de clase nuevos, mismo patrón que el `_showFavoritesOnly` ya existente. **Alternativa descartada**: agruparlos en un único objeto `_listControls` — añade indirección sin beneficio real para 4 primitivos independientes, y rompe la consistencia con el campo de favoritas ya establecido.

### 2. Lógica combinada extraída a un fichero puro nuevo, no inline en el componente

Nuevo `route-list-filters.transform.ts` (dominio `routes/list`, sufijo `.transform.ts` porque es lógica pura sin efectos, mismo criterio que `route-list.transform.ts` o `route-detail.transform.ts`) exporta una función única que aplica favoritas → local/nube → búsqueda → orden, en ese orden, sobre la lista ya fusionada. **Alternativa descartada**: mantenerlo inline en `route-list.element.ts` — el fichero ya tiene 4 constructores de UI nuevos que añadir (búsqueda, orden, 2 iconos); sumar la lógica de filtrado empuja el fichero por encima del límite genérico de 300 líneas (`eslint.config.js`) para lógica que es pura y testeable por separado sin necesidad de Shadow DOM — mismo patrón de extracción ya documentado en `CLAUDE.md` (p. ej. `route-detail-notes.ts`, `profile-header.ts`).

### 3. "Solo locales" y "Solo en la nube" como toggles independientes, combinación vacía es un estado válido

Ya decidido con el usuario (dos iconos independientes, no un selector de 3 estados). Activar ambos a la vez produce una lista vacía (ningún estado es simultáneamente local y nube) — se acepta como comportamiento correcto, reutilizando el mismo estado vacío genérico que ya usa cualquier combinación de filtros sin resultados (no el estado vacío específico de "sin favoritas", que solo aplica a ese filtro). **Alternativa descartada**: desactivar mutuamente el otro icono al activar uno — contradice la propia decisión de "combinables", tomada explícitamente con el usuario.

### 4. Búsqueda: substring case-insensitive simple, sin normalizar diacríticos

`route.name.toLowerCase().includes(query.toLowerCase())`. **Alternativa descartada**: normalización Unicode (`.normalize('NFD')` + strip de diacríticos) para que "ruta" encuentre "Ruta a Málaga" buscando "malaga" sin tilde — descartada por ahora: no hay ninguna utilidad de normalización de texto precedente en el proyecto, y añadirla no estaba en el alcance pedido. Documentado como limitación conocida, no bloqueante.

### 5. Orden por nombre con `localeCompare` sensible al idioma; orden por fecha reutiliza el comparador ISO ya existente

`a.route.name.localeCompare(b.route.name, 'es', { sensitivity: 'base' })` para alfabético correcto en español (ignora mayúsculas/tildes al ordenar, aunque la búsqueda del punto 4 sí las distinga — son operaciones distintas con criterios distintos, no hace falta que compartan normalización). El orden por fecha no cambia: reutiliza tal cual el `createdAt.localeCompare()` ya usado en `route-list-sync.transform.ts`.

### 6. Layout: fila de iconos (invitaciones, favoritas, local, nube) separada de la fila de búsqueda+orden

Los 4 controles tipo icono comparten una fila flex nueva en el header. Búsqueda (campo de texto de ancho variable) y orden (selector pequeño) van en su propia fila debajo. **Alternativa descartada**: todo en una única fila — a 390px de ancho (referencia de diseño/Cypress de este proyecto) no caben 4 iconos de 56×56px + un campo de texto utilizable + un selector de orden sin comprimir el campo de búsqueda por debajo de un tamaño usable con guantes.

### 7. data-cy

`route-list-filtro-favoritas` se mantiene sin cambios (ya usado por Cypress/Vitest, confirmado antes de diseñar). Nuevos: `route-list-filtro-locales`, `route-list-filtro-nube`, `route-list-buscador`, `route-list-orden` — mismo patrón `route-list-<algo>` ya establecido en el fichero.

Sin ADR nueva: ninguna de estas decisiones alcanza el umbral de `rules.design` (ADR-048) — revertir cualquiera de ellas no exige tocar varios módulos ni migrar datos, y las alternativas reales ya vividas (icono vs texto, toggles vs selector, búsqueda en vivo vs con confirmación) se decidieron con el usuario antes de proponer, no se descubrieron implementando.

## Risks / Trade-offs

- **Búsqueda sin normalizar acentos** (Decisión 4) → una búsqueda "malaga" no encuentra "Málaga". Aceptado como limitación conocida y documentada, no en el alcance pedido por el usuario.
- **Quitar el texto "Solo favoritas" reduce la afordancia visual para quien no reconozca el icono de estrella** → mitigado con `aria-label` (accesibilidad, ya patrón establecido en el botón de invitaciones) y con que la estrella ya es el icono usado por card para "favorito" en todo el resto de la app — no es un icono nuevo sin precedente visual.
- **Combinación local+nube vacía puede confundir si no hay ningún indicio visual de "0 resultados por combinación de filtros"** (Decisión 3) → mitigado reutilizando el estado vacío genérico ya existente en el componente, sin necesidad de un mensaje nuevo por esta combinación específica.
- **`route-list.element.ts` puede superar el límite de líneas incluso tras extraer el filtrado** (4 constructores de UI nuevos: buscador, orden, 2 iconos) → si ocurre, extraer también la construcción de UI de la fila de controles a su propio fichero (`route-list-controls.ts`, mismo patrón que `route-list-favorite.ts`/`route-list-sharing.ts`), decidido en `apply` según el conteo real, no de antemano.
