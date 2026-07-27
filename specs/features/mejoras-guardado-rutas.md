# Feature: Mejoras de Guardado y Gestión de Rutas

## Descripción
Tres mejoras relacionadas con el ciclo de vida de una ruta ya grabada: (1) permitir ponerle un nombre a la ruta en el momento de guardarla (en vez de identificarla solo por fecha), (2) permitir añadir/editar notas de texto libre sobre una ruta ya guardada desde su pantalla de detalle, y (3) corregir un defecto visual de centrado en el botón "Grabar" de la barra de navegación inferior. Se agrupan en una sola spec por ser cambios pequeños y relacionados con la gestión de rutas guardadas, sin relación funcional entre el punto 3 y los otros dos más allá de tocarse en la misma ronda de trabajo.

## Criterios de Aceptación

### Nombre de ruta al guardar
- [x] AC-001: El diálogo "¿Guardar la ruta?" mostrado tras completar el long-press de STOP (`resolveStopDecision` en `cockpit-stop.service.ts`) incluye un campo de texto libre para introducir el nombre de la ruta, editable antes de elegir "Guardar" o "Descartar".
- [x] AC-002: Si el usuario pulsa "Guardar" con el campo de nombre vacío o solo espacios en blanco, se asigna un nombre por defecto compuesto por fecha y hora de la ruta (mismo formato ya usado en listado/detalle: día, mes abreviado y año, más hora:minuto — p.ej. "Ruta 27 jul 2026, 14:30").
- [x] AC-003: Si el usuario pulsa "Guardar" con un nombre no vacío, ese texto (recortado de espacios en los extremos) se persiste como nombre de la ruta, tal cual lo escribió.
- [x] AC-004: El nombre de la ruta se persiste en una columna nueva `name` de la tabla `routes` en SQLite, migrando instalaciones existentes mediante `ALTER TABLE` bajo demanda (mismo patrón que `preview_polyline`, ver `ensurePreviewPolylineColumn()` en `sqlite-route.repository.ts` y ADR-020), sin pérdida de datos existentes.
- [x] AC-005: El listado de rutas (`<route-list>`) muestra el nombre persistido de cada ruta en lugar del texto derivado de `createdAt` ("Ruta {fecha}") que usa actualmente.
- [x] AC-006: El detalle de ruta (`<route-detail>`) muestra el nombre persistido como título principal, en lugar del texto derivado de `createdAt` que usa actualmente.
- [x] AC-007: Las rutas guardadas antes de esta feature (columna `name` a `NULL` tras la migración) siguen mostrando en listado y detalle el nombre derivado de `createdAt` ("Ruta {fecha}") como fallback, sin romper su renderizado.
- [x] AC-008: Si el usuario elige "Descartar" en el diálogo, el nombre introducido (si lo hubiera) no se persiste en ningún sitio — se descarta junto con el resto de la ruta.
- [x] AC-009: El campo de nombre tiene un límite de 100 caracteres; el usuario no puede escribir más allá de ese límite.

### Notas de ruta
- [x] AC-010: En `<route-detail>`, la pestaña "Notas" (hoy un texto estático de placeholder en `buildNotasPlaceholder()`) se sustituye por un área de texto editable donde el usuario puede escribir notas libres sobre la ruta.
- [x] AC-011: Existe una acción explícita "Guardar nota" que persiste el contenido actual del área de texto asociado a esa ruta.
- [x] AC-012: Al guardar la nota con éxito se muestra un toast de éxito ("Nota guardada"), reutilizando el módulo de feedback compartido (`showToast`).
- [x] AC-013: Al abrir el detalle de una ruta que ya tiene una nota guardada, la pestaña "Notas" carga y muestra ese texto, sin acción adicional del usuario.
- [x] AC-014: Si la ruta no tiene ninguna nota guardada (`NULL`/vacío), se muestra directamente el área de texto editable vacía con un placeholder tipo "Escribe aquí tus notas sobre la ruta…" (no aplica el modo vista de AC-019, al no haber nada que ver).
- [x] AC-015: La nota se persiste en una columna nueva `notes` (tipo `TEXT`, nullable) de la tabla `routes` en SQLite, con la misma estrategia de migración `ALTER TABLE` bajo demanda que `name` (AC-004).
- [x] AC-016: Guardar una nota tras borrar todo su contenido persiste la nota como vacía/`NULL` (elimina la nota existente) sin producir ningún error.
- [x] AC-017: Si falla el guardado de la nota (p.ej. error de BBDD), se muestra un toast de error con el mismo estilo que el resto de errores de la app, y el contenido escrito en el área de texto se conserva (no se pierde) para poder reintentar.
- [x] AC-019: Si la ruta ya tiene una nota guardada (no vacía), se muestra en **modo vista**: el texto integrado visualmente en la pantalla (sin caja ni borde de campo de texto) con un icono de lápiz arriba a la derecha para editarla. Pulsar el icono cambia al área de texto editable (con el contenido actual precargado) y el botón "Guardar nota". Al guardar con éxito, si el nuevo contenido no queda vacío, se vuelve automáticamente al modo vista con el texto actualizado; si queda vacío, se mantiene el área editable (equivalente al estado de AC-014).

### Bug visual: punto del botón Grabar descentrado
- [x] AC-018: El punto central (`.record-dot`) dentro del círculo ámbar del botón "Grabar" (`nav-item--record`) de la barra de navegación inferior queda centrado tanto horizontal como verticalmente dentro del círculo, sin ninguna desviación apreciable hacia arriba, abajo o los lados.

## Comportamiento Esperado

### Escenario: Guardar una ruta con nombre personalizado (Happy Path)
- **Dado** que el usuario ha completado una grabación y aparece el diálogo "¿Guardar la ruta?"
- **Cuando** escribe "Puerto de la Bonaigua" en el campo de nombre y pulsa "Guardar"
- **Entonces** la ruta se persiste como `completed` con `name = "Puerto de la Bonaigua"`, y ese nombre aparece después tanto en el listado de rutas como en el título del detalle de esa ruta

### Escenario: Guardar una ruta sin escribir nombre
- **Dado** que el diálogo "¿Guardar la ruta?" está abierto y el campo de nombre está vacío
- **Cuando** el usuario pulsa "Guardar" directamente
- **Entonces** la ruta se persiste con un nombre por defecto basado en fecha y hora (p.ej. "Ruta 27 jul 2026, 14:30"), visible después en listado y detalle

### Escenario: Descartar una ruta tras escribir un nombre
- **Dado** que el usuario escribió "Ruta de prueba" en el campo de nombre del diálogo
- **Cuando** pulsa "Descartar" en lugar de "Guardar"
- **Entonces** la ruta (y el nombre introducido) no se persisten en ningún sitio, igual que el resto del flujo de descarte ya existente

### Escenario: Ruta antigua sin nombre persistido
- **Dado** que existe en la BBDD una ruta guardada antes de esta feature (columna `name` en `NULL` tras la migración)
- **Cuando** el usuario abre el listado o el detalle de esa ruta
- **Entonces** se muestra el nombre derivado de su fecha de creación ("Ruta {fecha}"), sin error ni hueco visual

### Escenario: Añadir una nota nueva a una ruta sin notas previas (Happy Path)
- **Dado** que el usuario está en `<route-detail>` de una ruta sin nota guardada, en la pestaña "Notas"
- **Cuando** escribe un texto en el área de notas y pulsa "Guardar nota"
- **Entonces** el texto se persiste asociado a esa ruta y aparece un toast "Nota guardada"

### Escenario: Ver una nota ya existente en modo vista
- **Dado** que la ruta ya tiene una nota guardada
- **Cuando** el usuario abre la pestaña "Notas"
- **Entonces** ve el texto de la nota integrado en la pantalla, sin caja ni borde de campo de texto, con un icono de lápiz arriba a la derecha

### Escenario: Editar una nota ya existente
- **Dado** que la ruta ya tiene una nota guardada, mostrada en modo vista al abrir la pestaña "Notas"
- **Cuando** el usuario pulsa el icono de editar, modifica el texto en el área editable que aparece y pulsa "Guardar nota"
- **Entonces** la nota persistida se actualiza con el nuevo contenido, la pantalla vuelve al modo vista mostrando el texto actualizado, y al volver a abrir el detalle de esa ruta se muestra igual

### Escenario: Borrar el contenido de una nota
- **Dado** que la ruta tiene una nota guardada con texto, mostrada en modo vista
- **Cuando** el usuario pulsa el icono de editar, borra todo el contenido del área de texto y pulsa "Guardar nota"
- **Entonces** la nota queda vacía/`NULL` en BBDD, sin error, se mantiene el área de texto editable (ya no hay nada que ver) con su placeholder, y la próxima vez que se abra el detalle aparece igual de vacía

### Escenario: Error al guardar una nota
- **Dado** que el usuario ha escrito una nota y pulsa "Guardar nota"
- **Cuando** la persistencia en BBDD falla
- **Entonces** aparece un toast de error y el texto escrito permanece en el área de texto para poder reintentar guardarlo

### Escenario: Punto del botón Grabar centrado en la nav-bar
- **Dado** que la barra de navegación inferior está visible en cualquier pantalla
- **Cuando** el usuario observa el botón circular ámbar "Grabar"
- **Entonces** el punto central se percibe centrado dentro del círculo, sin desviación hacia arriba respecto al centro geométrico del botón

## Constraints
- Guardar una ruta (elección "Guardar" del diálogo) siempre persiste un nombre no vacío: personalizado o el valor por defecto de fecha/hora (AC-002/AC-003); nunca se guarda `name` como `NULL` o cadena vacía.
- El nombre de ruta tiene un límite de 100 caracteres (AC-009); las notas no tienen límite explícito más allá del que impone `TEXT` en SQLite.
- Las migraciones de esquema (`name`, `notes`) siguen el patrón ya establecido de `ALTER TABLE ... ADD COLUMN` verificando primero `PRAGMA table_info` — nunca se recrea la tabla ni se pierden filas existentes.
- Esta spec no introduce la posibilidad de renombrar una ruta después de guardada — el nombre solo se define en el momento de guardar (fuera de alcance; se podría añadir en una iteración futura).
- El editor de notas no exige confirmación de tipo "destructiva" al guardar vacío (AC-016): a diferencia de eliminar una ruta o una foto, sobreescribir/vaciar una nota es una acción de edición normal y reversible reescribiendo el texto.
- Los nuevos elementos interactivos (campo de nombre, área de notas, botón "Guardar nota") llevan `data-cy` siguiendo la convención `<contexto>-<tipo>-<accion>` del proyecto.
- El fix del punto de la nav-bar es puramente visual (CSS); no cambia ninguna funcionalidad ni estructura del DOM del componente `<nav-bar>`.

## Dependencias
- **`grabacion-rutas`** (`cockpit-stop.service.ts`, `resolveStopDecision`, `CockpitService.confirmSaveRecording`/`discardStop`): el nombre se introduce en el mismo diálogo que ya gestiona guardar/descartar; `confirmSaveRecording` necesita poder recibir el nombre elegido.
- **`mejoras-usabilidad`** (`<confirm-dialog>`, módulo `toast`): el diálogo de guardar/descartar y el feedback de guardado de nota reutilizan estos componentes compartidos; `<confirm-dialog>` no soporta hoy un campo de texto embebido, por lo que esta feature amplía su capacidad o añade una variante.
- **`detalle-ruta`** (`route-detail.element.ts`, pestaña "Notas" ya existente como placeholder desde `mejoras-fotos-mapa`): el editor de notas sustituye a `buildNotasPlaceholder()`.
- **`botonera-navegacion`** (`nav-bar.element.ts`/`.css`): el fix del punto centrado se aplica sobre este componente existente.
- **Persistencia** (`IRouteRepository`, `sqlite-route.repository.ts`, `route.types.ts`): `Route`/`CreateRoute` necesitan los campos nuevos `name` y `notes`, y el repositorio necesita una vía para actualizar cada uno de forma independiente (ver Notas de Implementación).

## Notas de Implementación
- **Nombre de ruta**: `Route`/`CreateRoute` (en `route.types.ts`) ganan `name: string`. `SqliteRouteRepository` necesita una migración `ensureNameColumn()` análoga a `ensurePreviewPolylineColumn()`, y su `save()`/upsert debe incluir la columna `name`. `CockpitService.confirmSaveRecording()` pasa hoy sin parámetros — necesitará aceptar el nombre elegido para incluirlo en el `CreateRoute` que persiste.
- **Diálogo con campo de texto**: `<confirm-dialog>` (`src/shared/feedback/confirm-dialog.element.ts`) no soporta hoy un input embebido en sus `ConfirmDialogOptions` — habrá que decidir en la fase de plan si se amplía ese componente compartido (con el cuidado de "CRÍTICO en review" que ya aplica a cambios en `shared/`, ver `mejoras-usabilidad.md`) o si se construye un diálogo específico para este caso reutilizando su CSS/patrón de foco.
- **Notas**: `Route`/`CreateRoute` ganan `notes: string | null`. Igual que el nombre, columna nueva vía `ALTER TABLE routes ADD COLUMN notes TEXT;` verificada con `PRAGMA table_info`. Puede seguirse el patrón ya existente de `updatePreviewPolyline(routeId, polyline)` en `IRouteRepository`, añadiendo un método equivalente para notas (o para ambos campos nuevos) en vez de forzar un `save()` completo solo para persistir texto.
- **Modo vista/edición de notas (AC-019)**: el panel de notas alterna entre dos sub-vistas dentro del mismo contenedor, sin recargar datos (`route.notes` ya está en memoria). El botón "Guardar nota" solo debe disparar el cambio de vuelta a modo vista cuando la persistencia tiene éxito — en error (AC-017) el DOM del modo edición no se reconstruye, para no perder el texto escrito. `data-cy` sugeridos: `route-detail-btn-editar-nota` (icono lápiz) y `route-detail-texto-nota` (texto en modo vista).
- **Fallback de nombre para rutas antiguas (AC-007)**: la lógica de "Ruta {fecha}" ya existe tanto en `route-list.element.ts` como en `route-detail.element.ts` (`title.textContent = 'Ruta ' + ...`); basta con usar `route.name` si existe y no está vacío, cayendo a ese mismo cálculo si es `null`.
- **Bug del punto de la nav-bar**: en `nav-bar.element.css`, `.nav-item--record::before` (el círculo, 56×56px) es un elemento de flujo dentro de un botón `flex column`, mientras que `.record-dot` (el punto, 16×16px) se posiciona con `position: absolute; top: 20px` relativo al propio botón (`position: relative` en `.nav-item--record`, que tiene `padding: 4px` heredado de `.nav-item`). Ese `top: 20px` no tiene en cuenta el padding superior del botón, por lo que el punto queda ~4px por encima del centro real del círculo. Al implementar, verificar el centrado calculando el desplazamiento respecto a la caja real del círculo (o centrando el punto respecto al propio `::before` en vez de respecto al botón completo), no solo ajustar el número a ojo.
- **Formato de fecha/hora por defecto (AC-002)**: usar `Date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })` (ya usado en `route-list.element.ts`) combinado con la hora (`toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })`), para poder distinguir varias rutas guardadas el mismo día.
