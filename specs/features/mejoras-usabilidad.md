# Feature: Mejoras de Usabilidad (Feedback, Confirmaciones y Galería de Fotos)

## Descripción
Mejorar la experiencia de uso de lo que ya existe: dar feedback claro y consistente (errores, confirmaciones, guardado), pedir confirmación antes de acciones importantes o destructivas (guardar/descartar una ruta, eliminar ruta/foto), y unificar la visualización de fotos en una galería/visor compartido que aparezca tanto en el detalle de ruta como en la pantalla de grabación. Se apoya en un **módulo de feedback compartido** (`toast` + `confirm-dialog`) reutilizable en todas las pantallas.

## Criterios de Aceptación

### Módulo de feedback compartido
- [ ] AC-001: Existe un módulo de feedback en `src/shared/feedback/` que expone `toast(mensaje, tipo)` con tipos `success | error | info`. El toast es transitorio (se auto-cierra: éxito/info a ~3s, error a ~5s), lleva `data-cy` distinto por tipo, y es accesible (`role="status"` para info/success, `role="alert"` para error). Sustituye al `src/shared/utils/toast.ts` actual.
- [ ] AC-002: Existe un componente `<confirm-dialog>` compartido, bloqueante: se invoca de forma imperativa y devuelve una `Promise` que resuelve con el `id` de la acción elegida (o `null` si el diálogo era cerrable y se cerró sin elegir). Acepta título, mensaje opcional y una lista de acciones configurables, cada una con `id`, `label` y `variant` (`primary | danger | neutral`). Cierra por botón, y —cuando es cerrable— por tecla ESC y por click en el overlay. Atrapa el foco mientras está abierto y lo devuelve al cerrarse. Todos sus elementos interactivos llevan `data-cy`.

### Guardar o descartar al parar una ruta
- [ ] AC-003: Al completar el long-press de parada en `<cockpit-view>`, en lugar de guardar la ruta directamente, se abre un `confirm-dialog` "¿Guardar la ruta?" con dos acciones: "Descartar" (`variant: danger`) y "Guardar" (`variant: primary`).
- [ ] AC-004: Si el usuario elige "Guardar", la ruta se persiste como `completed` (comportamiento actual) y se muestra un `toast` de éxito "Ruta guardada".
- [ ] AC-005: Si el usuario elige "Descartar", la fila de la ruta `active` (insertada al iniciar la grabación, ver [[ADR-020]]) se elimina de la base de datos junto con sus puntos, paradas y fotos asociadas; la app vuelve al estado `idle` y se muestra un `toast` "Ruta descartada".
- [ ] AC-006: El diálogo de guardar/descartar **no es cerrable sin elegir** (ni ESC ni click en overlay lo cierran): parar una ruta obliga a decidir entre guardar y descartar, para no dejar una ruta a medio persistir en estado indeterminado.

### Errores de foto consistentes
- [ ] AC-007: Todos los errores al capturar/subir/persistir una foto (formato no soportado, imagen > 20 MB, fallo al guardar el archivo, fallo al persistir en BBDD) se muestran al usuario mediante el `toast` de error compartido, con el mismo estilo y textos, tanto en la pantalla de grabación como en el detalle de ruta. Ningún error de foto se queda solo en `console.error` sin feedback visible.

### Confirmaciones destructivas
- [ ] AC-008: `<route-list>` incorpora una acción de eliminar ruta en cada tarjeta (con `data-cy`). Al pulsarla se abre un `confirm-dialog` de confirmación (acción "Eliminar" con `variant: danger`). Al confirmar, se borra la ruta con sus puntos, paradas y fotos, el listado se refresca sin recargar y se muestra un `toast` "Ruta eliminada". Al cancelar, no se borra nada.
- [ ] AC-009: Eliminar una foto desde la galería abre un `confirm-dialog` de confirmación. Al confirmar, se elimina la foto (archivo local + fila en la tabla `photos`) y la galería se refresca sin recargar. Al cancelar, no se borra nada.

### Estados de carga y vacíos
- [ ] AC-010: Las operaciones asíncronas visibles muestran un indicador de carga mientras están en curso: carga del listado de rutas, carga del detalle de ruta, y guardar/descartar una ruta. El botón de añadir foto ya tiene su estado `loading`; se mantiene y se homogeneiza visualmente con el resto.
- [ ] AC-011: Los estados vacíos son coherentes en toda la app y usan el mismo lenguaje visual (tokens, tipografía): listado sin rutas, detalle de ruta sin fotos (placeholder "Sin fotos" ya existente), etc.

### Galería y visor de fotos compartidos
- [ ] AC-012: Existe un componente de galería de fotos compartido en `src/shared/` (p. ej. `<photo-gallery>`) que muestra las miniaturas de un conjunto de fotos en una tira horizontal con scroll y `scroll-snap`, ordenadas por timestamp. Recibe las fotos (con sus URLs ya resueltas) como entrada y emite un evento al pulsar una miniatura.
- [ ] AC-013: La pantalla de detalle de ruta (`<route-detail>`) usa el componente de galería compartido, reemplazando su galería construida inline actual, sin pérdida de funcionalidad (miniaturas, apertura del visor, placeholder "Sin fotos").
- [ ] AC-014: La pantalla de grabación (`<cockpit-view>`) muestra la galería compartida con las fotos capturadas en la ruta en curso. Al añadir una foto durante la grabación, la galería se actualiza mostrando la nueva miniatura, sin interrumpir la telemetría en tiempo real ni la grabación.
- [ ] AC-015: El visor/lightbox a pantalla completa es un componente compartido y mejora la previsualización respecto al actual: permite navegar entre las fotos de la ruta (botones anterior/siguiente y swipe táctil en móvil), muestra un contador ("2 de 5"), y cierra por botón X, tecla ESC y click en el fondo. (Recoge el AC-020 que quedó pendiente en [[fotos-ruta]].)

## Comportamiento Esperado

### Escenario: Guardar una ruta al parar (Happy Path)
- **Dado** que hay una grabación activa con datos GPS registrados
- **Cuando** el usuario mantiene pulsado el botón de parada hasta completar el long-press y pulsa "Guardar"
- **Entonces** la ruta se persiste como `completed`, aparece un toast "Ruta guardada" y la app vuelve al estado inicial de grabación

### Escenario: Descartar una ruta al parar
- **Dado** que hay una grabación activa que ya insertó su fila `active` en la BBDD y una foto capturada en directo
- **Cuando** el usuario completa el long-press de parada y pulsa "Descartar"
- **Entonces** la fila de la ruta, sus puntos y la foto asociada se eliminan de la BBDD, aparece un toast "Ruta descartada", y esa ruta no aparece en el listado

### Escenario: Intentar cerrar el diálogo de guardado sin decidir
- **Dado** que el diálogo "¿Guardar la ruta?" está abierto
- **Cuando** el usuario pulsa ESC o toca fuera del diálogo
- **Entonces** el diálogo permanece abierto (no se cierra) y sigue exigiendo elegir entre Guardar y Descartar

### Escenario: Error al subir una foto demasiado grande
- **Dado** que el usuario está en el detalle de una ruta
- **Cuando** selecciona una imagen de más de 20 MB
- **Entonces** aparece un toast de error con el mensaje de límite de tamaño, y no se añade ninguna foto ni se altera la galería

### Escenario: Eliminar una ruta desde el listado
- **Dado** que el listado muestra al menos una ruta
- **Cuando** el usuario pulsa eliminar en una tarjeta y confirma en el diálogo
- **Entonces** la ruta desaparece del listado sin recargar la pantalla y aparece un toast "Ruta eliminada"

### Escenario: Cancelar la eliminación de una ruta
- **Dado** que el diálogo de confirmación de borrado está abierto
- **Cuando** el usuario pulsa "Cancelar" (o cierra el diálogo)
- **Entonces** la ruta no se borra y el listado permanece igual

### Escenario: Galería de fotos en la pantalla de grabación
- **Dado** que hay una grabación activa sin fotos aún
- **Cuando** el usuario captura una foto durante la grabación
- **Entonces** la miniatura aparece en la galería de la pantalla de grabación, y la telemetría (velocidad, tiempo, distancia) sigue actualizándose en tiempo real

### Escenario: Navegar entre fotos en el visor
- **Dado** que la ruta tiene varias fotos y el usuario abre el visor pulsando una miniatura
- **Cuando** hace swipe (o pulsa el botón siguiente)
- **Entonces** el visor muestra la siguiente foto y el contador se actualiza en consecuencia

## Constraints
- Todo el feedback y los diálogos usan el módulo compartido; no se crean overlays/alertas a medida por pantalla (el overlay de permiso GPS del cockpit es una excepción preexistente y queda fuera de alcance).
- Los diálogos y toasts respetan la filosofía visual "Asfalto Nocturno" (tokens de `tokens.css`, modo oscuro, hitbox mínima 56×56px en botones), `prefers-reduced-motion`, y contraste WCAG AA.
- El módulo de feedback y la galería/visor compartidos viven en `src/shared/`; su introducción y cualquier cambio posterior se marcan como CRÍTICO en la review por afectar a varias pantallas.
- Descartar o eliminar una ruta/foto es una operación destructiva: siempre pasa por confirmación (AC-006 es la variante "obligatoria" del flujo de parada; AC-008/AC-009 son confirmaciones cancelables).
- Todos los elementos interactivos nuevos llevan `data-cy` siguiendo la convención `<contexto>-<tipo>-<accion>` (ver `docs/07-cypress-e2e.md`).
- Ninguna operación destructiva se ejecuta de forma optimista antes de confirmar.

## Dependencias
- **[[mejoras-tecnicas]]**: se beneficia (no depende estrictamente) de que la clase base, los tokens semánticos y el helper de DOM ya estén unificados. El `toast.ts` actual se mueve a `src/shared/feedback/` como parte de AC-001, lo que se solapa con AC-004 de la spec técnica (mover estilos inline a CSS): conviene coordinar el orden para no tocar el mismo archivo dos veces.
- **[[fotos-ruta]]**: esta spec continúa el trabajo de fotos. AC-015 recoge explícitamente el AC-020 pendiente (swipe en el visor). Los otros pendientes de fotos-ruta (popup de marcador AC-015, desagrupación de cluster al zoom AC-018) **no** entran en esta spec salvo que se decida ampliar alcance.
- **Persistencia** (`IRouteRepository` / `IPhotoRepository`): el borrado de rutas/fotos ya está soportado por `delete()` en ambos repositorios; AC-005/AC-008/AC-009 se apoyan en ellos.

## Notas de Implementación
- **AC-002 (`confirm-dialog`)**: puede implementarse como Web Component que se monta en `document.body` (como el visor de fotos actual) y expone una función helper `confirmDialog(opts): Promise<string | null>` que lo crea, lo abre y resuelve al elegir acción. El foco debe moverse al primer botón al abrir y volver al elemento que lo invocó al cerrar.
- **AC-005 (descartar)**: como la ruta se inserta `active` al arrancar la grabación (patrón insertar-activa/actualizar-al-parar de [[ADR-020]]), descartar = `repository.delete(routeId)`. Verificar que el `ON DELETE CASCADE` de la tabla `photos` (y puntos/paradas) borra lo asociado; si algún repositorio no cascada, borrarlo explícitamente.
- **AC-012/AC-013/AC-014 (galería compartida)**: extraer la galería que hoy vive inline en `route-detail.element.ts` (`buildPhotoGallery`, `buildPhotoThumbnail`) a un componente `src/shared/photo-gallery/`. El cockpit necesitará cargar las fotos de la ruta en curso por su `routeId` (ya pre-generado) y refrescar al añadir; cuidar de no romper la optimización de render in-place del cockpit (no reconstruir todo el DOM en cada tick, ver el comentario sobre `structuralChange` en `cockpit.element.ts`).
- **AC-015 (visor con swipe)**: extraer el visor de `route-detail.element.ts` (`openViewer`) a un componente compartido `<photo-viewer>` con navegación por índice; el swipe táctil puede hacerse con eventos `touchstart`/`touchend` comparando desplazamiento horizontal, respetando `prefers-reduced-motion` para las transiciones.
- **Estados de carga (AC-010)**: reutilizar/estandarizar un patrón de spinner (puede vivir en el módulo de feedback o en `shared/`), evitando duplicar el markup de carga por pantalla.
- Coordinar con [[mejoras-tecnicas]] AC-004/AC-005: los estilos de toast y visor deben acabar en CSS con tokens, no inline.
