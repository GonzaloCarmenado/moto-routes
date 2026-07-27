# Plan de Implementación: Timeline de Ruta

## Resumen de Tareas
| # | Tarea | Archivos | AC Cubiertos | Complejidad |
|---|-------|----------|--------------|-------------|
| 1 | Tipos del dominio timeline | `route-timeline.types.ts`, `vitest.config.ts` | (soporte, sin AC directo) | Small |
| 2 | `detectStopsFromPoints()` — paradas derivadas | `route-timeline.transform.ts` (+spec) | AC-004, AC-005, AC-006, AC-007 | Small |
| 3 | Helpers de formato (hora / coords / velocidad) | `route-timeline.transform.ts` (+spec) | AC-019, AC-020, AC-021 | Small |
| 4 | `buildTimelineSegments()` — tramos de velocidad media | `route-timeline.transform.ts` (+spec) | AC-011, AC-012, AC-013 | Small |
| 5 | `buildTimelineData()` — orquestador (Salida/Llegada/paradas/fotos/edge cases) | `route-timeline.transform.ts` (+spec) | AC-002, AC-003, AC-008, AC-010, AC-014, AC-015, AC-016, AC-017 | Medium |
| 6 | Panel DOM `buildTimelinePanel()` | `route-detail-timeline.ts` (+spec) | AC-009, AC-018 (renderizado) | Medium |
| 7 | Estilos CSS del panel Timeline | `route-detail.element.css` | (presentación, sin AC de lógica) | Small |
| 8 | Integración en `<route-detail>`: 4ª pestaña, wiring, refresco al añadir/borrar foto | `route-detail.element.ts` (+spec) | AC-001, AC-009 (integración), refresco de datos | Medium |

Total: 8 pasos, 6 archivos nuevos + 3 modificados (contando `vitest.config.ts`).

---

## Paso 1: Tipos del dominio Timeline

- **Objetivo**: Definir los tipos puros que va a consumir todo el resto del feature (`route-timeline.transform.ts` y `route-detail-timeline.ts`), evitando que cada función invente su propia forma de datos.
- **AC cubiertos**: Ninguno directamente — es soporte estructural para los pasos 2-6. Sin este tipado consistente, los pasos siguientes no pueden compartir contratos.
- **Tests a escribir**: Ninguno — archivo puramente declarativo (mismo criterio que `route.types.ts`/`route-detail.types.ts`, ya excluidos de cobertura por no tener código ejecutable, ver ADR-021 punto 5).
- **Archivos a crear/modificar**:
  - `CREAR src/routes/route-timeline.types.ts`
  - `MODIFICAR vitest.config.ts` — añadir `'src/routes/route-timeline.types.ts'` a `coverage.exclude`, junto a `route-detail.types.ts`.
- **Notas**:
  - Diseño sugerido (el impl-agent puede ajustar nombres siempre que preserve la semántica):
    ```ts
    export interface TimelineStop {
      startTime: number; // epoch ms — punto donde la velocidad cae por primera vez (AC-006)
      endTime: number;   // epoch ms — punto donde vuelve a superar el umbral, o el último punto de la ruta (AC-007)
      lat: number;
      lng: number;
    }

    export interface TimelineSegment {
      startTime: number;
      endTime: number;
      avgSpeedKmh: number;
    }

    export type TimelineDelimiterKind = 'salida' | 'parada' | 'llegada';

    export interface TimelineDelimiter {
      kind: TimelineDelimiterKind;
      startTime: number;
      endTime: number; // == startTime para salida/llegada; distinto para parada
      lat: number;
      lng: number;
    }

    export interface TimelinePhotoMarker {
      photoId: string;
      time: number; // capturedAt en epoch ms
    }

    /** Fila de renderizado: un delimitador, opcionalmente seguido del tramo hasta
     * el siguiente delimitador (null tras la Llegada, el último). Las fotos que
     * caen dentro de ese tramo cronológicamente van en `photosInSegment`. */
    export interface TimelineRow {
      delimiter: TimelineDelimiter;
      segment: TimelineSegment | null;
      photosInSegment: TimelinePhotoMarker[];
    }

    export interface TimelineData {
      hasGpsData: boolean; // false si <2 route_points (AC-015)
      rows: TimelineRow[]; // vacío si !hasGpsData
      /** Fotos con capturedAt fuera de [Salida, Llegada] (antes de Salida o
       * después de Llegada) — se muestran igual, pero no caben dentro de
       * ningún tramo (constraint de la spec). */
      photosBeforeStart: TimelinePhotoMarker[];
      photosAfterEnd: TimelinePhotoMarker[];
      /** Fotos cuando `!hasGpsData` (AC-016) — no hay tramos ni delimitadores. */
      orphanPhotos: TimelinePhotoMarker[];
    }
    ```
  - No confundir con `RoutePoint` de `src/cockpit/cockpit.types.ts` (tipo de grabación en vivo) ni con `RoutePoint` de `src/shared/models/route.types.ts` (tipo persistido, con `id`/`routeId`, el que devuelve `getPointsByRouteId()`). Los pasos 2-5 consumen el segundo.

---

## Paso 2: `detectStopsFromPoints()` — paradas derivadas de los puntos persistidos

- **Objetivo**: Función pura que recorre los `route_points` ya ordenados por `timestamp` y aplica `detectStop()` de `cockpit.transform.ts` de forma secuencial, devolviendo solo las rachas que llegan a `confirmed-stop`.
- **AC cubiertos**: AC-004, AC-005, AC-006, AC-007.
- **Tests a escribir** (en `route-timeline.transform.spec.ts`, antes de implementar):
  - Racha de ≥30 puntos consecutivos con velocidad ≤3 km/h genera una `TimelineStop` → Valida AC-004, AC-005.
  - Racha de <30 puntos que vuelve a moverse antes de confirmarse NO genera ninguna parada → Valida AC-005.
  - `startTime` de la parada es el punto donde la velocidad cae por primera vez, no el punto de confirmación 30 puntos después → Valida AC-006.
  - `endTime` de la parada es el primer punto posterior que supera el umbral → Valida AC-006.
  - Ubicación de la parada = coordenadas del punto de inicio de la racha (no el de confirmación) → Valida AC-006.
  - Ruta que termina con el vehículo aún detenido (última racha nunca vuelve a `moving`): `endTime` = timestamp del último punto de la ruta → Valida AC-007.
  - Dos paradas en la misma ruta, con tramo de movimiento intermedio, se detectan ambas de forma independiente → Valida AC-004.
  - Ruta sin ninguna racha que llegue a confirmarse devuelve `[]` → Valida AC-013 (caso "sin paradas", precondición del paso 4/5).
- **Archivos a crear/modificar**:
  - `CREAR src/routes/route-timeline.transform.ts` (arranca aquí; se amplía en los pasos 3-5)
  - `CREAR src/routes/route-timeline.transform.spec.ts`
- **Notas**:
  - Firma sugerida por la spec: `detectStopsFromPoints(points: RoutePoint[]): TimelineStop[]` (usar el `RoutePoint` de `shared/models/route.types.ts`). Precondición: `points` ya viene ordenado ascendente por `timestamp` — la responsabilidad de ordenar vive en el orquestador del Paso 5, no aquí, para no ordenar dos veces el mismo array.
  - Reutilizar `detectStop()` de `../cockpit/cockpit.transform.js` tal cual (import), sin copiar su lógica — es una dependencia explícita ya documentada en la spec.
  - El bucle debe ir guardando, además del estado devuelto por `detectStop()`, el timestamp del punto donde el estado pasó de `moving`/inexistente a `possible-stop` por primera vez en cada racha (ese es el `startTime` real de AC-006, distinto del punto en el que se alcanza `confirmed-stop`).

---

## Paso 3: Helpers de formato — hora, coordenadas, velocidad

- **Objetivo**: Tres funciones puras de formateo, reutilizadas por el panel DOM del Paso 6, testeables de forma aislada sin montar ningún componente.
- **AC cubiertos**: AC-019, AC-020, AC-021.
- **Tests a escribir** (en `route-timeline.transform.spec.ts`):
  - `formatTimelineTime(epochMs)` devuelve `HH:mm` en formato 24h (usar `toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })`, mismo criterio que el resto de la app) → Valida AC-019.
  - `formatTimelineCoords(lat, lng)` devuelve las dos coordenadas con exactamente 4 decimales cada una (incluye caso con menos decimales de entrada, p.ej. `lat=40.4`, y caso negativo) → Valida AC-020.
  - `formatTimelineSpeed(kmh)` devuelve un entero (redondeado, sin decimales) seguido de `" km/h"` (incluye caso con decimales que redondean hacia arriba/abajo) → Valida AC-021.
- **Archivos a crear/modificar**:
  - `MODIFICAR src/routes/route-timeline.transform.ts`
  - `MODIFICAR src/routes/route-timeline.transform.spec.ts`
- **Notas**: No reimplementar el formateo de hora ya usado en el resto de la app (`toLocaleTimeString`) con otra librería — es una réplica intencionada del mismo criterio ya usado en otros sitios (p.ej. `buildDefaultRouteName` en `cockpit.transform.ts`), no una extracción a `shared/` porque no hay ADR que lo pida y solo lo usaría este dominio hasta que aparezca un segundo consumidor (mismo criterio de "esperar al segundo caso" ya aplicado en ADR-025).

---

## Paso 4: `buildTimelineSegments()` — velocidad media por tramo

- **Objetivo**: Dado el array de puntos y una lista de ventanas temporales (los "huecos" entre delimitadores: Salida→primera parada, entre paradas, última parada→Llegada, o Salida→Llegada si no hay paradas), calcular la velocidad media de cada una reutilizando `calculateDistance()`/`calculateAvgSpeed()` de `cockpit.transform.ts`.
- **AC cubiertos**: AC-011, AC-012, AC-013.
- **Tests a escribir** (en `route-timeline.transform.spec.ts`):
  - Ruta sin paradas: una sola ventana Salida→Llegada, la velocidad media coincide con la de toda la ruta (distancia Haversine acumulada / duración total) → Valida AC-013.
  - Ruta con 2 paradas: 3 ventanas, cada una con la velocidad media calculada solo con los puntos dentro de su propio rango temporal → Valida AC-011, AC-012.
  - Los límites de una ventana "fin de parada→inicio de la siguiente" usan las horas de fin/inicio ya calculadas por `detectStopsFromPoints()` (Paso 2), no los timestamps de los `route_points` adyacentes — la suma de duraciones de todos los tramos + paradas debe coincidir exactamente con la duración total de la ruta → Valida AC-012 (nota de implementación explícita de la spec).
  - Ventana de duración cero (p.ej. una parada detectada justo en el primer punto de la ruta) devuelve velocidad media `0`, reutilizando el guard `timeSeconds <= 0` ya existente en `calculateAvgSpeed()` — sin caso especial adicional → Valida la nota de implementación correspondiente.
- **Archivos a crear/modificar**:
  - `MODIFICAR src/routes/route-timeline.transform.ts`
  - `MODIFICAR src/routes/route-timeline.transform.spec.ts`
- **Notas**:
  - Firma sugerida: `buildTimelineSegments(points: RoutePoint[], windows: { startTime: number; endTime: number }[]): TimelineSegment[]`. No reimplementar Haversine ni la división distancia/tiempo — usar `calculateDistance`/`calculateAvgSpeed` importadas de `../cockpit/cockpit.transform.js` (misma dependencia ya usada en el Paso 2).
  - Este paso NO decide cuáles son las ventanas (eso lo hace el orquestador del Paso 5, combinando Salida/paradas/Llegada) — recibe la lista ya construida. Mantiene la función enfocada en un único cálculo, fácil de testear con fixtures de ventanas arbitrarias sin depender de `detectStopsFromPoints()`.

---

## Paso 5: `buildTimelineData()` — orquestador (Salida, Llegada, paradas, fotos, edge cases)

- **Objetivo**: Función principal que combina los pasos 2 y 4, añade los eventos de Salida/Llegada, posiciona las fotos dentro del tramo que les corresponde cronológicamente, y resuelve los tres edge cases de datos insuficientes (AC-015/016/017).
- **AC cubiertos**: AC-002, AC-003, AC-008, AC-010, AC-014, AC-015, AC-016, AC-017 (y el constraint de fotos fuera de rango).
- **Tests a escribir** (en `route-timeline.transform.spec.ts`):
  - ≥2 `route_points`: `rows[0].delimiter` es `kind: 'salida'` con hora/ubicación del primer punto tras ordenar por `timestamp` ascendente → Valida AC-002.
  - ≥2 `route_points`: el último `row.delimiter` es `kind: 'llegada'` con hora/ubicación del último punto → Valida AC-003.
  - `points` pasado desordenado (timestamps fuera de orden) produce el mismo resultado que ya ordenado → Valida el criterio de ordenación de AC-002/AC-003.
  - Ruta con paradas y fotos: los `rows` quedan en orden estrictamente cronológico (salida, parada(s), llegada) y cada foto aparece en `photosInSegment` del tramo cronológico que le corresponde, sin partir el tramo en dos → Valida AC-008, AC-010, AC-011 (integración con Paso 4).
  - Ruta sin ninguna foto: `rows` se calculan igual (Salida/paradas/Llegada/tramos), todas las listas `photosInSegment` vacías, sin ningún flag de error → Valida AC-014.
  - Ruta con <2 `route_points` (0 o 1) y sin fotos: `hasGpsData: false`, `rows: []`, `orphanPhotos: []` → Valida AC-015, AC-017.
  - Ruta con <2 `route_points` pero con fotos: `hasGpsData: false`, `rows: []`, `orphanPhotos` contiene las fotos ordenadas por `capturedAt` → Valida AC-016.
  - Foto con `capturedAt` anterior a la hora de Salida: aparece en `photosBeforeStart`, no dentro de ningún tramo → Valida el constraint de fotos fuera de rango.
  - Foto con `capturedAt` posterior a la hora de Llegada: aparece en `photosAfterEnd` → Valida el mismo constraint.
- **Archivos a crear/modificar**:
  - `MODIFICAR src/routes/route-timeline.transform.ts`
  - `MODIFICAR src/routes/route-timeline.transform.spec.ts`
- **Notas**:
  - Firma sugerida: `buildTimelineData(points: RoutePoint[], photos: { id: string; capturedAt: string }[]): TimelineData`. Aquí sí se ordena `points` por `timestamp` una única vez (ver nota del Paso 2) y se convierte `capturedAt` (ISO string) a epoch ms una única vez para comparar contra los timestamps de `points` (que ya son epoch ms, mismo origen que `GeolocationPosition.timestamp`).
  - El guard de AC-015 es `points.length < 2`, no `=== 0` — un único punto tampoco permite calcular ni Salida-Llegada con sentido ni ningún tramo.
  - Este es el punto de la cadena con más ramas de decisión (edge cases + posicionamiento de fotos); vigilar el límite de `max-statements`/`max-lines-per-function` (25/60, `specs/ui/frontend-conventions.md` §0) — descomponer en funciones auxiliares privadas dentro del mismo archivo si se acerca al límite (p.ej. una función privada solo para clasificar cada foto en `photosBeforeStart`/`photosAfterEnd`/`photosInSegment` de su tramo).
  - No se persiste nada — pura, sin `IRouteRepository` ni acceso a BBDD (eso ya lo resuelve `route-detail.element.ts`, que llama a esta función con los datos ya cargados en memoria).

---

## Paso 6: Panel DOM `buildTimelinePanel()`

- **Objetivo**: Construir el `<div slot="timeline">` con el árbol de eventos/tramos ya calculado por `buildTimelineData()`, siguiendo el mismo patrón que `buildNotasPanel()`/`buildPhotosSection()` (función que devuelve un `HTMLElement`, sin ser un custom element propio).
- **AC cubiertos**: AC-009 (unidad, el wiring completo con el visor real se cubre en el Paso 8), AC-018.
- **Tests a escribir** (en `route-detail-timeline.spec.ts`, nuevo archivo — mismo patrón que `route-detail-photo.service.spec.ts`, sin montar `<route-detail>` completo):
  - Cada evento Salida/Llegada/Parada lleva su propio `data-cy` único (`route-detail-timeline-evento-salida`, `route-detail-timeline-evento-llegada`, `route-detail-timeline-evento-parada-{n}`) → Valida AC-018.
  - Cada foto lleva `data-cy="route-detail-timeline-evento-foto-{id}"` → Valida AC-018.
  - Cada fila de velocidad media de tramo lleva `data-cy="route-detail-timeline-tramo-{n}"` → Valida AC-018.
  - Pulsar el nodo de un evento de tipo Foto invoca el callback `onPhotoClick` recibido, con el `photoId` correcto → Valida AC-009 (a nivel de unidad; el Paso 8 verifica que ese callback abre de verdad el visor).
  - `hasGpsData: false` sin fotos (`orphanPhotos: []`) renderiza un único nodo con `data-cy="route-detail-timeline-vacio"` y ningún evento de Salida/Llegada/parada/tramo → Valida AC-017.
  - `hasGpsData: false` con `orphanPhotos` no vacío renderiza esas fotos (con su propio `data-cy` de foto) junto al mensaje `route-detail-timeline-vacio` (sin duplicar mensaje) → Valida AC-016.
  - `hasGpsData: true` con `rows` no vacío NO renderiza el nodo `route-detail-timeline-vacio` → Valida el criterio negativo de AC-015 (no debe aparecer cuando sí hay datos).
- **Archivos a crear/modificar**:
  - `CREAR src/routes/route-detail-timeline.ts`
  - `CREAR src/routes/route-detail-timeline.spec.ts`
- **Notas**:
  - Firma sugerida: `buildTimelinePanel(points: RoutePoint[], photos: { id: string; capturedAt: string }[], onPhotoClick: (photoId: string) => void): HTMLElement`. Internamente llama a `buildTimelineData()` (Paso 5) y a los formateadores del Paso 3 — esta función es la única "impura" del módulo (construye DOM), el resto de `route-timeline.transform.ts` permanece pura y testeable sin jsdom.
  - El nodo devuelto lleva `section.setAttribute('slot', 'timeline')`, igual que `buildNotasPanel()`/`buildPhotosSection()` — NO es un `DocumentFragment` (no admite atributos).
  - Usar `createElement`/`appendChild`, no `innerHTML` en bucle, para la lista de filas (regla de rendimiento de `frontend-conventions.md` §8).
  - No reimplementar el `<img>`/miniatura de foto — para AC-009 basta con un nodo clicable (botón o `<div>` con `role="button"`) con el `data-cy` indicado; no hace falta renderizar la imagen en la fila de la timeline (la spec no lo pide, solo pulsar abre el visor).

---

## Paso 7: Estilos CSS del panel Timeline

- **Objetivo**: Dar apariencia visual (Asfalto Nocturno, tokens de `tokens.css`) a la lista de eventos y tramos construida en el Paso 6.
- **AC cubiertos**: Ninguno de forma directa — presentación visual, sin criterio de aceptación específico de estilo. Contribuye indirectamente a la legibilidad exigida por el modo oscuro obligatorio (`CLAUDE.md` § Diseño Visual).
- **Tests a escribir**: Ninguno (CSS no cubierto por Vitest; ESLint/Stylelint no imponen límite de líneas a `.css` en este proyecto). Si el impl-agent detecta que necesita una clase JS-driven con lógica condicional relevante (p.ej. estado "parada activa al final" con estilo distinto), esa condición debe testearse como parte de las aserciones de clase en el Paso 6, no aquí.
- **Archivos a crear/modificar**:
  - `MODIFICAR src/routes/route-detail.element.css`
- **Notas**:
  - Los estilos van en `route-detail.element.css` (no en un `.css` propio del "componente" timeline) porque el nodo devuelto por `buildTimelinePanel()` es contenido ligero (`light DOM`) que cuelga de `<tab-bar>` pero cuya hoja de estilos aplicable es la del Shadow Root de `<route-detail>` — exactamente el mismo motivo por el que `.notes-view`/`.section-label` viven hoy en ese archivo y no en uno propio de `tab-bar` (ver `src/routes/route-detail.element.ts` → `renderShadow(styles, ...)`, y `tab-bar.element.ts` que solo expone `<slot>`, sin estilos para el contenido slotted).
  - Reutilizar tokens existentes (`--panel`, `--rust-line`, `--amber`, `--ink`, `--ink-soft`, `--ink-faint`, `font-family: var(--font-ui)`/`var(--font-data)` para las cifras de velocidad) — prohibido hardcodear color/tipografía/espaciado (regla de `CLAUDE.md`).
  - Hitbox mínima 56×56px (`var(--hitbox-min)`, ya usado en `.notes-edit-btn`) para el nodo clicable de cada evento Foto, uso con guantes.
  - El mensaje de estado vacío (`route-detail-timeline-vacio`) puede reutilizar la clase `.empty-msg` ya existente en este mismo archivo (mismo criterio visual que "Ruta no encontrada"), sin duplicar estilos.

---

## Paso 8: Integración en `<route-detail>` — 4ª pestaña, wiring del visor, refresco al cambiar fotos

- **Objetivo**: Cablear todo lo anterior dentro de `route-detail.element.ts`: añadir la pestaña "Timeline" al `<tab-bar>`, conservar los `route_points` completos (con `timestamp`/`speed`, hoy descartados a `{lat,lng}`), conectar el click de un evento Foto con `openPhotoViewer`, y mantener el panel sincronizado si el usuario añade o borra una foto desde la pestaña "Fotos".
- **AC cubiertos**: AC-001 (estructura: 4ª pestaña, mapa sin cambios), AC-009 (integración real con `openPhotoViewer`).
- **Tests a escribir** (en `route-detail.element.spec.ts`, ampliando el `describe('route-detail - pestañas ...')` ya existente):
  - El `<tab-bar>` monta 4 pestañas — "Fotos", "Estadísticas", "Notas" y "Timeline" — con "Fotos" activa por defecto sin cambios (mismo test ya existente, ampliado) → Valida AC-001.
  - `<route-map>` sigue renderizándose fuera del `<tab-bar>`, con los mismos `points`, sin ningún cambio de comportamiento al añadir la pestaña Timeline → Valida AC-001 (parte "el mapa no cambia").
  - Ruta persistida vía `MemoryRouteRepository.save()` con `points` reales (con `timestamp`/`speed`) y sin ninguna parada: al pulsar la pestaña "Timeline" aparecen los `data-cy` de Salida, Llegada y un único tramo → test de integración end-to-end que ejercita Pasos 5+6+8 juntos.
  - Ruta con fotos guardadas (vía `MemoryPhotoRepository`) y al menos un evento Foto en la timeline: pulsar ese nodo abre el visor (`<photo-viewer>` aparece en `document.body` o donde corresponda) posicionado en la foto correcta → Valida AC-009 de extremo a extremo, reutilizando el mismo patrón de test ya usado para AC-011/AC-015 del mapa (`openPhotoViewer` compartido).
  - Añadir una foto nueva desde la pestaña "Fotos" y volver a "Timeline": el nuevo evento Foto aparece (el panel se reconstruye, no queda con datos obsoletos) → Valida el refresco de datos descrito en Notas.
  - Borrar una foto desde el visor y volver a "Timeline": el evento Foto correspondiente ya no aparece → mismo criterio de refresco.
  - Ruta con <2 `route_points` (0 o 1) montada en `<route-detail>`: la pestaña "Timeline" muestra el mensaje de estado vacío (`route-detail-timeline-vacio`) → test de integración de AC-015 con datos reales cargados vía `fetchAndRender()`.
- **Archivos a crear/modificar**:
  - `MODIFICAR src/routes/route-detail.element.ts`
  - `MODIFICAR src/routes/route-detail.element.spec.ts`
- **Notas**:
  - `fetchAndRender()` hoy hace `this._points = points.map((p) => ({ lat: p.lat, lng: p.lng }))`, descartando `timestamp`/`speed`/`id`. Añadir un nuevo campo `this._routePoints: RoutePoint[] = points` (el array completo, del tipo de `shared/models/route.types.ts`) — **sin tocar** `_points` ni su uso actual en `buildMap()`/`addPhotoToRoute()` (constraint: el mapa no cambia de comportamiento).
  - En `buildTabBar()`: añadir `{ id: 'timeline', label: 'Timeline' }` al array `tabs`, y `tabBar.appendChild(this.buildTimelinePanel())` (nuevo método privado que llama a `buildTimelinePanel()` del Paso 6, pasando `this._routePoints`, `this._photos`, y un callback `(photoId) => { const idx = this.toGalleryPhotos().findIndex((p) => p.id === photoId); if (idx !== -1) this.openPhotoViewerAt(idx); }` — mismo patrón exacto ya usado en `buildMap()` para `ROUTE_MAP_PHOTO_SELECT_EVENT`, sin introducir una tercera implementación distinta de "buscar índice por id y abrir el visor").
  - Guardar la referencia del panel construido en un nuevo campo privado `_timelinePanelEl: HTMLElement | null`, igual que `_fotosPanelEl`, para poder reconstruirlo con `replaceWith()` (mismo patrón que `rerenderPhotosSection()`) cada vez que cambien `this._photos` — esto es necesario porque `buildTabBar()` solo se ejecuta una vez en `fetchAndRender()`, y el propio contrato de `<tab-bar>` (paneles nunca se destruyen al cambiar de pestaña) significa que si no se reconstruye explícitamente, la timeline queda con la foto añadida/borrada desfasada. Añadir la llamada a este refresco en los mismos puntos donde hoy se llama a `rerenderPhotosSection()`: al final de `handleAddPhoto()` (rama `addedAny`) y al final de `handleDeletePhoto()` (tras confirmar el borrado).
  - No se necesita ninguna llamada nueva a `IRouteRepository`/`IPhotoRepository` — todo sale de datos ya cargados por `fetchAndRender()` (constraint de la spec: "sin peticiones adicionales").

---

## Puntos abiertos para el usuario (no bloquean el plan, pero conviene decidir antes o durante el Paso 8)

- La spec no dice explícitamente si el panel Timeline debe refrescarse cuando se añade/borra una foto desde la pestaña "Fotos" en la misma sesión (solo dice que no hace falta recalcular "salvo que cambien los datos de la ruta", lo cual implica que SÍ hay que hacerlo si cambian). El Paso 8 asume que sí y lo implementa con el mismo patrón que `rerenderPhotosSection()`. Si el usuario prefiere que la Timeline solo se recalcule al volver a entrar en el detalle de la ruta (recarga completa), es un cambio menor de una línea en el Paso 8 (quitar las dos llamadas a `rerenderTimelinePanel()`), pero conviene confirmarlo explícitamente ya que no hay un AC que lo cubra literalmente.
- Ninguna otra ambigüedad detectada: los 21 AC quedan cubiertos por los Pasos 2-8, y las 3 dependencias de datos (`detectStop`, `calculateDistance`/`calculateAvgSpeed`, `getPointsByRouteId`/`getByRouteId`) ya existen y se reutilizan sin modificarlas, tal como fija la spec.
