# Feature: Fotos de Ruta

## Descripción
Permite al motorista capturar fotos (desde cámara o galería) durante la grabación de una ruta o al visualizar una ruta ya guardada. Cada foto se geolocaliza — por GPS propio de la imagen o vinculándola al punto más cercano de la ruta — y se muestra en el mapa de detalle como un marcador de color distintivo. Los marcadores cercanos entre sí se agrupan en un único punto para evitar saturación visual. El feature funciona tanto en la app Tauri (Android) como en el navegador (desarrollo/testing).

## Criterios de Aceptación

### Captura de fotos — General
- [ ] AC-001: Existe un botón "Añadir foto" visible tanto en la pantalla de grabación (`<cockpit-view>`) como en la pantalla de detalle de ruta (`<route-detail>`). El botón debe tener hitbox mínima de 56×56px.
- [ ] AC-002: Al pulsar "Añadir foto", se despliega un menú con dos opciones: "Cámara" (abre la cámara del dispositivo) y "Galería" (abre el selector de imágenes del dispositivo). En navegador, ambas opciones usan un `<input type="file" accept="image/*">`, y "Cámara" añade el atributo `capture="environment"`.
- [ ] AC-003: La foto seleccionada/capturada se almacena en el sistema de archivos local de la app (app data dir de Tauri, o en memoria/base64 para navegador). No se sube a ningún servidor externo.
- [ ] AC-004: Si el usuario cancela la selección de cámara/galería, no se realiza ninguna acción y la app permanece en el estado anterior.

### Geolocalización de fotos
- [ ] AC-005: Al capturar una foto nueva con la cámara, si la imagen contiene metadatos EXIF con coordenadas GPS, se usan esas coordenadas como ubicación de la foto.
- [ ] AC-006: Al seleccionar una foto de la galería, si la imagen contiene metadatos EXIF con coordenadas GPS, se usan esas coordenadas. Si no contiene GPS, se intenta vincular al punto GPS más cercano en el tiempo de la ruta activa.
- [ ] AC-007: Si una foto no tiene GPS en EXIF y no hay ruta activa (ej: en detalle de ruta guardada sin grabación en curso), se usa la última ubicación GPS conocida de la ruta como ubicación de la foto.

### Fotos durante la grabación (Cockpit)
- [ ] AC-008: Durante la grabación activa o en pausa, el botón "Añadir foto" está habilitado y es accesible.
- [ ] AC-009: Al añadir una foto durante la grabación, se asocia automáticamente a la ruta en curso, registrando: ruta de archivo, timestamp de captura, coordenadas (lat, lon) y un ID único.
- [ ] AC-010: La foto se muestra brevemente como una miniatura de confirmación (toast o chip temporal de 2-3 segundos) en la pantalla de grabación, sin interrumpir la telemetría en tiempo real.

### Fotos en detalle de ruta guardada
- [ ] AC-011: En la pantalla de detalle de una ruta ya guardada (`<route-detail>`), el botón "Añadir foto" permite asociar nuevas fotos a esa ruta.
- [ ] AC-012: Las fotos añadidas desde el detalle de ruta quedan persistidas y asociadas a esa ruta, y se muestran inmediatamente en la galería de la ruta sin necesidad de recargar.
- [ ] AC-013: Las fotos añadidas desde el detalle de ruta que no tengan GPS propio heredan las coordenadas del punto central de la ruta (promedio de lat/lon de todos los puntos).

### Visualización de fotos en el mapa
- [ ] AC-014: En el mapa de la pantalla de detalle de ruta, cada foto se representa como un marcador puntual de un color distintivo (diferente del trazado de la ruta y de los puntos de inicio/fin). El color debe ser diferenciable del ámbar y del verde de inicio/fin — se usará un tono cobre/terracota (`--rust-line` o similar) para mantener coherencia con la paleta "Asfalto Nocturno".
- [ ] AC-015: Al pulsar un marcador de foto en el mapa, se muestra un popup/tooltip con la miniatura de la foto correspondiente.
- [ ] AC-016: Las fotos cuyas coordenadas estén a menos de 50 metros entre sí se agrupan en un único marcador de cluster. El marcador de cluster muestra el número de fotos agrupadas (ej: "3").
- [ ] AC-017: Al pulsar un marcador de cluster, se hace zoom al área o se despliega un carrusel/lista de las miniaturas de las fotos agrupadas.
- [ ] AC-018: Al hacer zoom en el mapa, los clusters se desagrupan progresivamente mostrando los marcadores individuales cuando el nivel de zoom permite distinguirlos visualmente.

### Galería de fotos en detalle de ruta
- [ ] AC-019: La sección de fotos en `<route-detail>` muestra una galería horizontal (scroll lateral) con todas las miniaturas de las fotos asociadas a la ruta, ordenadas por timestamp.
- [ ] AC-020: Al pulsar una miniatura en la galería, se abre la foto a tamaño completo en un visor/lightbox que ocupa la pantalla, con botón de cierre (X) y soporte para swipe entre fotos en móvil.
- [ ] AC-021: Si la ruta no tiene fotos asociadas, la sección muestra el placeholder existente (franjas diagonales + "Sin fotos").

### Adaptabilidad navegador / Tauri
- [ ] AC-022: En entorno Tauri (Android), "Cámara" usa el plugin `@tauri-apps/plugin-camera` (o intent nativo de cámara) y "Galería" usa `@tauri-apps/plugin-file-opener` o intent nativo de galería.
- [ ] AC-023: En entorno navegador (Vite dev), tanto "Cámara" como "Galería" usan `<input type="file" accept="image/*">` como fallback, y "Cámara" añade `capture="environment"`.
- [ ] AC-024: La detección de entorno (Tauri vs navegador) es automática y no requiere configuración manual del usuario.

### Persistencia
- [ ] AC-025: Las fotos se guardan como archivos en el sistema de archivos local (app data dir). La ruta de archivo y metadatos (ruta_id, lat, lon, timestamp) se persisten en SQLite en una tabla `photos`.
- [ ] AC-026: La tabla `photos` permite recuperar todas las fotos de una ruta mediante `route_id`, ordenadas por timestamp.

### Tests
- [ ] AC-027: Test unitario: el botón "Añadir foto" se renderiza en `<cockpit-view>` solo cuando hay grabación activa o en pausa.
- [ ] AC-028: Test unitario: el botón "Añadir foto" se renderiza en `<route-detail>` siempre que haya una ruta cargada.
- [ ] AC-029: Test unitario: el menú de opciones (Cámara/Galería) se muestra al pulsar "Añadir foto" y se oculta al cancelar.
- [ ] AC-030: Test unitario: las fotos sin GPS en EXIF heredan correctamente las coordenadas según el contexto (ruta activa vs ruta guardada).
- [ ] AC-031: Test unitario: el clustering agrupa correctamente marcadores a < 50m y los separa a >= 50m.
- [ ] AC-032: Test unitario: la galería muestra "Sin fotos" cuando no hay fotos asociadas a la ruta.
- [ ] AC-033: Test unitario: el visor/lightbox se abre con la foto correcta al pulsar una miniatura y se cierra con el botón X.

## Comportamiento Esperado

### Escenario: Añadir foto con cámara durante grabación (Happy Path)
- **Dado** que la grabación de ruta está activa en `<cockpit-view>`
- **Cuando** el usuario pulsa "Añadir foto" y selecciona "Cámara"
- **Entonces** se abre la cámara del dispositivo, el usuario captura una foto, y la foto se asocia automáticamente a la ruta en curso con timestamp y ubicación GPS actual

### Escenario: Añadir foto desde galería en ruta en pausa
- **Dado** que la grabación está en pausa
- **Cuando** el usuario pulsa "Añadir foto", selecciona "Galería" y elige una foto con GPS en EXIF
- **Entonces** la foto se asocia a la ruta usando las coordenadas del EXIF de la imagen

### Escenario: Foto de galería sin GPS vinculada a ruta activa
- **Dado** que la grabación está activa y el usuario selecciona una foto de galería sin metadatos GPS
- **Cuando** la foto se procesa
- **Entonces** se le asignan las coordenadas del último punto GPS registrado en la ruta

### Escenario: Añadir foto desde detalle de ruta guardada
- **Dado** que el usuario está en `<route-detail>` viendo una ruta guardada que tiene 2 fotos existentes
- **Cuando** pulsa "Añadir foto", selecciona "Galería" y elige una foto sin GPS
- **Entonces** la foto se asocia a la ruta con las coordenadas del punto central de la ruta, la galería se actualiza a 3 fotos, y aparece un nuevo marcador en el mapa

### Escenario: Visualizar marcadores de fotos en el mapa
- **Dado** que una ruta tiene 5 fotos geolocalizadas en ubicaciones distintas (separadas > 50m)
- **Cuando** el usuario abre el detalle de la ruta
- **Entonces** el mapa muestra 5 marcadores de color cobre/terracota en las posiciones correspondientes

### Escenario: Clustering de fotos cercanas
- **Dado** que una ruta tiene 4 fotos, 3 de ellas tomadas en un mismo mirador (a < 15m entre sí) y 1 en otro punto distante
- **Cuando** el usuario abre el detalle de la ruta con el mapa a nivel de zoom alejado
- **Entonces** se muestran 2 marcadores: uno de cluster mostrando "3" en la zona del mirador, y uno individual en el otro punto

### Escenario: Desagrupación de cluster al hacer zoom
- **Dado** que hay un cluster de 3 fotos agrupadas
- **Cuando** el usuario hace zoom suficiente en el mapa
- **Entonces** el cluster se desagrupa y se muestran los 3 marcadores individuales

### Escenario: Navegar fotos en lightbox con swipe
- **Dado** que la galería de una ruta tiene 4 fotos
- **Cuando** el usuario pulsa la segunda miniatura y luego hace swipe a la derecha
- **Entonces** se muestra la tercera foto a tamaño completo en el lightbox

### Escenario: Cancelar selección de imagen
- **Dado** que el menú Cámara/Galería está abierto
- **Cuando** el usuario pulsa fuera del menú o el botón cancelar del selector de archivos
- **Entonces** el menú se cierra y no se añade ninguna foto

### Escenario: Entorno navegador — fallback input file
- **Dado** que la app se ejecuta en el navegador (Vite dev, sin Tauri)
- **Cuando** el usuario pulsa "Añadir foto" y selecciona "Cámara"
- **Entonces** se abre un `<input type="file" accept="image/*" capture="environment">` que permite seleccionar una imagen del sistema de archivos

## Constraints
- Las fotos deben almacenarse localmente — no se contempla subida a servidor ni sincronización en la nube en esta feature.
- El formato de imagen aceptado es JPEG y PNG. Otros formatos se rechazan con un mensaje al usuario.
- Tamaño máximo de foto: 20 MB por imagen. Si se excede, se muestra un mensaje de error.
- El número máximo de fotos por ruta es 100. Si se alcanza, el botón "Añadir foto" se deshabilita con tooltip "Límite de fotos alcanzado".
- En navegador, las fotos se almacenan en memoria (no hay acceso al sistema de archivos real). Se advierte que los datos no persisten entre sesiones.
- La ubicación GPS de las fotos debe ser lo más precisa posible (GPS del dispositivo durante grabación, EXIF de la imagen, o punto de ruta más cercano).
- El color del marcador de foto en el mapa debe ser diferenciable del ámbar (ruta) y del verde (inicio) — se usará un tono cobre/terracota.

## Dependencias
- **Feature `grabacion-rutas`**: La captura de fotos durante grabación depende del estado del Cockpit (activo/pausa) y de los datos GPS en tiempo real.
- **Feature `detalle-ruta`**: La galería de fotos y los marcadores en el mapa se integran en `<route-detail>`. La sección de fotos actualmente es un placeholder ("Sin fotos").
- **Feature `persistencia-rutas`**: La tabla `photos` debe integrarse con el repositorio SQLite existente (`IRouteRepository` o un nuevo `IPhotoRepository`).
- **Plugin Tauri `camera`** (o alternativa nativa): Para acceder a la cámara del dispositivo en Android.
- **Plugin Tauri `file-opener`** o `dialog`: Para acceder a la galería/selector de archivos en Android.
- **Biblioteca de clustering para mapa**: Se usará Leaflet.markercluster o similar (según lo que use el mapa actual — ver `mapa-ruta-leaflet`).
- **Biblioteca EXIF**: Para leer metadatos GPS de imágenes (ej: `exifr` o `exif-js`).
- **Lightbox/Visor de imágenes**: Componente para ver fotos a pantalla completa con swipe (puede ser nativo o una biblioteca ligera).

## Notas de Implementación
- La tabla `photos` en SQLite debe tener: `id TEXT PRIMARY KEY`, `route_id TEXT NOT NULL`, `file_path TEXT NOT NULL`, `latitude REAL`, `longitude REAL`, `captured_at TEXT` (ISO 8601), `created_at TEXT`.
- La detección Tauri vs navegador se hace con `window.__TAURI_INTERNALS__` o el helper oficial `@tauri-apps/api/core`.
- En Tauri Android, el menú Cámara/Galería debería usar intents nativos si es posible, cayendo a plugins de Tauri si no.
- El almacenamiento de archivos en Tauri usa `appDataDir` (`@tauri-apps/api/path`). Las fotos se copian a un subdirectorio `photos/` dentro del data dir.
- El clustering debe ser configurable (radio de 50m ajustable). No se debe reinventar la rueda: si el mapa usa Leaflet, usar `Leaflet.markercluster`.
- La galería horizontal usa scroll nativo con `overflow-x: auto` y snap points (`scroll-snap-type: x mandatory`) para comportamiento móvil nativo.
- El lightbox debe implementarse como Web Component reutilizable (`<photo-viewer>`) con soporte para teclado (ESC para cerrar, ← → para navegar) y gestos táctiles (swipe, pinch-to-zoom).
- Tener en cuenta permisos de cámara en Android (ya deberían estar en `capabilities/default.json` si se usó el plugin de cámara de Tauri).