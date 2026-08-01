# Feature: Mejoras Visuales y de Interacción del Mapa (`<route-map>`)

## Descripción
Mejora incremental del componente compartido `<route-map>` (introducido por `specs/features/mapa-ruta-maplibre.md`) para resolver problemas de legibilidad reportados por un motorista al revisar el detalle de una ruta: el estilo oscuro actual apenas distingue las calles del fondo, no hay forma de ver el mapa a pantalla completa, faltan controles de zoom visibles, los marcadores de inicio/fin son difíciles de identificar, no hay estado de carga mientras cargan las teselas, y la atribución de OpenFreeMap/OpenStreetMap está deshabilitada incumpliendo su licencia. Esta spec no rediseña el componente desde cero: añade contraste, controles e indicadores sobre la base ya construida y aprobada.

> **Feature cerrada (2026-08-01)**: verificada en dispositivo Android real (`75fe536b`) a través de 3 rondas de feedback del usuario sobre el APK instalado (Pasos 7 a 10), incluyendo los AC solo verificables manualmente (AC-002, AC-009, AC-012, AC-020). Todos los AC de este documento están cumplidos y verificados salvo AC-013/AC-014/AC-015/AC-026, retirados formalmente por decisión de producto (ver "Controles de zoom" más abajo).

## Criterios de Aceptación

### Contraste visual del estilo del mapa
- [x] AC-001: Tras el evento `load` de MapLibre, el componente aplica overrides de `paint` (vía `map.setPaintProperty`) sobre las capas de carreteras del estilo `dark` de OpenFreeMap para aumentar su contraste de color/luminosidad respecto al fondo, sin sustituir el estilo base completo por uno distinto.
- [x] AC-002: Las vías principales y secundarias son claramente distinguibles del fondo del mapa en el nivel de zoom resultante del `fitBounds` inicial (encuadre por defecto al abrir el detalle), sin necesidad de hacer zoom adicional. Se considera cumplido cuando el color resuelto de las capas de vía overrideadas mantiene un ratio de contraste de al menos 3:1 frente al color de fondo del estilo (criterio WCAG AA para elementos gráficos no textuales, aplicado aquí a la visualización cartográfica).
- [x] AC-003: Si alguna de las capas de carretera esperadas no existe en el estilo cargado (p. ej. un cambio no anunciado del estilo de terceros de OpenFreeMap), la aplicación de los overrides no lanza ninguna excepción no controlada ni impide que el trazado, los marcadores y el `fitBounds` se sigan dibujando con normalidad.
- [x] AC-004: Los colores usados en los overrides de contraste son coherentes con la paleta "Asfalto Nocturno" (tonos cálidos/neutros, sin azules fríos ni acentos neón) — no se introduce ninguna paleta ajena al sistema de diseño.

### Estado de carga (skeleton) del mapa
- [x] AC-005: Mientras el mapa se está inicializando y el evento `load` de MapLibre aún no se ha disparado, el componente muestra un placeholder visual sobre `--panel-sunken` (opcionalmente con una animación sutil tipo shimmer/pulso) en el área del mapa, en vez de dejar el contenedor vacío o producir un flash en blanco.
- [x] AC-006: El placeholder de carga se sustituye por el mapa real inmediatamente al dispararse el evento `load`, sin dejar ambos superpuestos ni un parpadeo perceptible.
- [x] AC-007: Si `prefers-reduced-motion: reduce` está activo, el placeholder de carga se muestra estático (sin animación), igual que el resto de animaciones del sistema de diseño.

### Atribución OpenFreeMap / OpenStreetMap
- [x] AC-008: El mapa muestra el control de atribución de MapLibre (`attributionControl: true` o un control de atribución compacto equivalente) con el crédito de OpenFreeMap/OpenStreetMap, revirtiendo el `attributionControl: false` actual para cumplir su requisito de licencia.
- [x] AC-009: El control de atribución se presenta de forma discreta (texto pequeño, esquina inferior, estilo coherente con "Asfalto Nocturno" vía overrides CSS del componente) sin romper la altura fija de 200px del contenedor ni solaparse de forma que impida pulsar el botón de pantalla completa o los controles de zoom.

### Marcadores de inicio y fin
- [x] AC-010: Los marcadores de inicio y fin dejan de renderizarse como círculos CSS simples y pasan a usar un icono con mejor legibilidad sobre fondo oscuro (tipo pin o bandera).
- [x] AC-011: El marcador de inicio conserva el color verde (token `--success`) y el de fin conserva el color ámbar (token `--amber`), ambos leídos como tokens del sistema — prohibido hardcodear el color en el nuevo icono.
- [x] AC-012: El nuevo icono de marcador mantiene un contraste mínimo de 3:1 (WCAG AA para elementos gráficos) respecto al mapa de fondo circundante.

### Controles de zoom — **RETIRADO (2026-08-01)**
- [x] ~~AC-013: El mapa muestra controles de zoom +/- (`maplibregl.NavigationControl` o control propio equivalente) visibles de forma permanente, sin depender de hover ni de gestos multitáctiles para descubrirlos.~~
- [x] ~~AC-014: Cada botón de zoom tiene una hitbox mínima de 56×56px, ampliando el tamaño por defecto de MapLibre (~29px) mediante CSS propio del componente.~~
- [x] ~~AC-015: Los controles de zoom se posicionan de modo que no se solapen ni compitan visualmente con el botón de pantalla completa (p. ej. zoom en una esquina distinta a la del botón de pantalla completa).~~

Implementados en el Paso 5 (`NavigationControl` en `top-left`) y verificados visualmente en dispositivo real en esta misma ronda de feedback (2026-08-01): el usuario los encontró innecesarios ("no me han gustado y no son útiles" — el pellizco para zoom ya cubre el mismo caso) y pidió quitarlos. Retirados del código (`route-map.element.ts`, `route-map.element.css`) y de los tests. AC-013/AC-014/AC-015 y su test AC-026 quedan formalmente **fuera de esta spec** — no se reintroducen sin una nueva petición explícita.

### Botón de pantalla completa
- [x] AC-016: El mapa incluye un botón integrado en la esquina superior derecha del contenedor, con hitbox mínima 56×56px y `aria-label` descriptivo que refleja el estado actual ("Ver mapa a pantalla completa" / "Salir de pantalla completa").
- [x] AC-017: Al pulsar el botón estando en modo normal, se invoca `requestFullscreen()` sobre el contenedor del mapa (Fullscreen API real, no una simulación con CSS `position: fixed`); el icono del botón cambia para reflejar la acción de salir de pantalla completa.
- [x] AC-018: Tras entrar en pantalla completa, el mapa conserva el mismo centro y nivel de zoom que tenía inmediatamente antes del cambio, y se invoca `map.resize()` para que MapLibre vuelva a medir el nuevo tamaño del contenedor.
- [x] AC-019: El mapa puede salir de pantalla completa tanto pulsando el mismo botón (ahora con icono de "salir") como pulsando Esc (comportamiento nativo del navegador vía el evento `fullscreenchange`); en ambos casos se conserva el centro/zoom previos y se vuelve a invocar `map.resize()`. **Bug encontrado en verificación real (2026-08-01) y corregido**: el botón entraba en pantalla completa pero, al pulsarlo de nuevo, no salía — `isElementFullscreen()` comparaba contra `document.fullscreenElement`, que la Fullscreen API retargeta al *host* del Shadow DOM (el propio `<route-map>`), nunca al contenedor real que llamó a `requestFullscreen()`. Corregido leyendo `ShadowRoot.fullscreenElement` (no retargetado) cuando el contenedor vive en un shadow tree — ver comentario en `route-map-fullscreen.ts`.
- [x] AC-020: Si el entorno no soporta la Fullscreen API (`document.fullscreenEnabled` es `false` o el método no existe en el contenedor), el botón de pantalla completa no se muestra, sin lanzar ningún error ni dejar un botón inoperante visible.
- [x] AC-021: La transición visual de entrada/salida de pantalla completa no aplica ninguna animación cuando `prefers-reduced-motion: reduce` está activo.

### Tests (Vitest, `maplibre-gl` mockeado)
- [x] AC-022: Test: tras disparar `load` en el mock de `maplibregl.Map`, se verifica que el componente llama a `setPaintProperty` sobre al menos una capa de carretera con un valor de color distinto al del estilo original.
- [x] AC-023: Test: mientras el mock de `maplibregl.Map` no ha disparado `load`, el DOM del componente muestra el elemento de skeleton/placeholder de carga; tras disparar `load`, el placeholder deja de mostrarse.
- [x] AC-024: Test: al construir el mapa, `attributionControl` se pasa como `true` (o la configuración de control compacto equivalente), no `false`.
- [x] AC-025: Test: los marcadores de inicio/fin se construyen con la nueva estructura/clase de icono y siguen resolviendo `--success`/`--amber` como color base respectivamente.
- [x] ~~AC-026: Test: el mapa se inicializa añadiendo un `NavigationControl` (o control de zoom equivalente) vía `map.addControl`.~~ **RETIRADO (2026-08-01)** — ver "Controles de zoom" arriba.
- [x] AC-027: Test: al pulsar el botón de pantalla completa en estado normal, se invoca `requestFullscreen()` sobre el contenedor y, al simular el evento `fullscreenchange` correspondiente, se invoca `map.resize()`.
- [x] AC-028: Test: al pulsar el botón de pantalla completa estando ya en pantalla completa (o al simular la salida vía Esc), se invoca `document.exitFullscreen()` y el `aria-label`/icono del botón vuelven a su estado original.
- [x] AC-029: Test: si `document.fullscreenEnabled` es `false` (o `requestFullscreen` no existe en el contenedor), el botón de pantalla completa no se renderiza.

### Afinado de contraste tras verificación en dispositivo real (2026-08-01)
Feedback real de usuario sobre el APK instalado para el Paso 7: el color de contraste de las vías (AC-001/AC-004) se veía demasiado blanco/grueso, y los nombres de calles/ciudades del propio estilo `dark` (fuera del alcance original de AC-001, que solo cubría el trazado de vía) resultaban casi ilegibles.
- [x] AC-030: El ancho de línea de las capas de carretera overrideadas en color (AC-001) se reduce respecto al del estilo original, escalando la expresión de interpolación por zoom ya existente (no sustituyéndola por un valor fijo), preservando la progresión de grosor entre clases de vía (motorway > major > minor).
- [x] AC-031: Las capas de texto (`symbol`) de nombres de calles/carreteras y de lugares (ciudades, pueblos, países) del estilo `dark` reciben un override de `text-color` con un tono de la paleta "Asfalto Nocturno", distinguible del color de las vías (AC-001) y legible sobre el fondo oscuro.
- [x] AC-032: Test: tras `load`, se llama a `setPaintProperty` con `line-width` para al menos una capa de `ROAD_LAYER_IDS` con un valor que escala (no sustituye) la expresión existente, y con `text-color` para al menos una capa de etiqueta, con un color distinto al de las vías.

### Segunda ronda de ajustes tras probar el APK reinstalado (2026-08-01)
Nuevo feedback real de usuario, ya con los cambios del Paso 8 instalados: la atribución sigue percibiéndose como un "indicador" molesto, los marcadores de inicio/fin no señalan el punto GPS exacto (el pin flota centrado sobre él en vez de apoyar su punta), el ancho de vía (AC-030) sigue viéndose grueso, y el área de clic de los marcadores de foto es demasiado ajustada al icono visual para usarse con guantes.
- [x] AC-033: El control de atribución de OpenFreeMap/OSM (AC-008/AC-009) se muestra con opacidad reducida por defecto, quedando casi imperceptible sobre el mapa oscuro, y recupera opacidad completa al recibir foco o `hover` — sigue presente y pulsable en todo momento (no se elimina, por requisito de licencia).
- [x] AC-034: Los marcadores de inicio y fin anclan su punta inferior (no su centro) a la coordenada GPS exacta que representan, igual que el comportamiento estándar de un pin de mapa.
- [x] AC-035: El ancho de línea de las capas de carretera (AC-030) se reduce de nuevo respecto al valor fijado en el Paso 8, manteniendo el mismo mecanismo de escalado de la expresión de interpolación por zoom (no un valor fijo).
- [x] AC-036: Los marcadores de foto individuales y de cluster exponen una zona de clic invisible de al menos `--hitbox-min` (56×56px) que envuelve el icono visible sin alterar su tamaño ni posición aparente.
- [x] AC-037: Test: los marcadores de inicio/fin se construyen con `anchor: 'bottom'` (o equivalente) en las opciones de `maplibregl.Marker`; el control de atribución resuelto en CSS tiene opacidad reducida por defecto y `1` en `:hover`/`:focus-visible`; el ancho de vía sigue escalando (no fijo) con un factor menor que el del Paso 8; los marcadores de foto/cluster se construyen envolviendo el icono visible en un contenedor con hitbox `--hitbox-min`.

### Tercera ronda de ajustes: atribución colapsada por defecto (2026-08-01)
Pese a AC-033 (opacidad reducida), el control de atribución seguía apareciendo **expandido** (mostrando el texto de crédito, no solo el icono "i") en el primer render, en un mapa de 200px que el usuario no llega a arrastrar. Investigado: comportamiento propio de MapLibre (`AttributionControl` en modo `compact`), no un bug de esta app — arranca expandido y solo se colapsa cuando el mapa recibe un evento `drag` real.
- [x] AC-038: Tras el evento `load`, el control de atribución compacto queda colapsado (solo el icono "i" visible, sin el texto de crédito expandido), sin necesidad de que el usuario arrastre el mapa. Sigue pudiéndose abrir pulsándolo (comportamiento nativo de MapLibre, sin tocar).
- [x] AC-039: Test: si el control de atribución existe en el DOM con las clases de estado "expandido" de MapLibre tras `load`, el componente las retira (y retira el atributo `open`), dejándolo en su estado colapsado.

## Comportamiento Esperado

### Escenario: Ver el mapa contrastado y con controles (Happy Path)
- **Dado** que el usuario abre el detalle de una ruta con puntos GPS guardados
- **Cuando** el mapa termina de cargar (evento `load` de MapLibre disparado)
- **Entonces** ve el trazado ámbar sobre calles claramente distinguibles del fondo sin necesidad de hacer zoom, marcadores de inicio (verde) y fin (ámbar) con forma de pin/bandera, controles de zoom +/- visibles, un botón de pantalla completa en la esquina superior derecha y el crédito de atribución de OpenFreeMap/OSM discreto en una esquina

### Escenario: Estado de carga antes de que el mapa esté listo
- **Dado** que el componente `<route-map>` se acaba de montar con puntos GPS
- **Cuando** el evento `load` de MapLibre todavía no se ha disparado
- **Entonces** se muestra un placeholder sobre `--panel-sunken` en el área del mapa en vez de un contenedor vacío o un flash en blanco, y desaparece en cuanto `load` se dispara

### Escenario: Entrar en pantalla completa
- **Dado** que el mapa está renderizado en su tamaño normal de 200px de alto, centrado en un punto y con un nivel de zoom concreto
- **Cuando** el usuario pulsa el botón de pantalla completa
- **Entonces** el contenedor del mapa pasa a pantalla completa vía la Fullscreen API, el mapa conserva el mismo centro y zoom, se recalcula su tamaño (`map.resize()`), y el icono del botón cambia a "salir de pantalla completa"

### Escenario: Salir de pantalla completa con Esc
- **Dado** que el mapa está en pantalla completa
- **Cuando** el usuario pulsa la tecla Esc
- **Entonces** el navegador dispara `fullscreenchange`, el mapa vuelve a su tamaño normal de 200px, conserva el mismo centro/zoom, se recalcula su tamaño, y el icono del botón vuelve a su estado inicial

### Escenario: Fullscreen API no soportada
- **Dado** que el entorno (WebView o navegador) no soporta la Fullscreen API
- **Cuando** se renderiza `<route-map>`
- **Entonces** el botón de pantalla completa no se muestra, y el resto del mapa (contraste, marcadores, controles de zoom, atribución) funciona con normalidad

### Escenario: Usuario con `prefers-reduced-motion` activo
- **Dado** que el sistema operativo del usuario tiene activada la preferencia de movimiento reducido
- **Cuando** el mapa muestra el skeleton de carga o el usuario entra/sale de pantalla completa
- **Entonces** ninguna de esas transiciones aplica animación

### Escenario: Ruta sin puntos GPS
- **Dado** que una ruta no tiene puntos en `route_points`
- **Cuando** se abre su detalle
- **Entonces** se sigue mostrando el estado "Sin datos de GPS" ya existente (AC-010 de `mapa-ruta-maplibre.md`), sin inicializar mapa, y por tanto sin botón de pantalla completa, controles de zoom ni atribución (no hay mapa que mostrar)

## Constraints
- No se sustituye el estilo `dark` de OpenFreeMap por un estilo de terceros distinto: el contraste se logra mediante overrides de `paint` sobre las capas ya existentes del estilo cargado, para no perder la coherencia visual ni depender de un nuevo host de teselas/estilo.
- La Fullscreen API tiene soporte variable entre navegadores/WebViews (prefijos vendor en Safari/iOS, soporte incierto en algunos WebViews Android embebidos en Tauri) — el botón debe degradar de forma segura (AC-020) en vez de asumir soporte universal.
- Los controles de zoom y el botón de pantalla completa deben respetar la hitbox mínima de 56×56px (uso con guantes de moto) aunque MapLibre los genere por defecto más pequeños — requiere overrides CSS explícitos, no basta con la configuración por defecto de `NavigationControl`.
- El contenedor mantiene su altura fija de 200px en el flujo normal del detalle de ruta; solo cambia de tamaño real durante el estado de pantalla completa.
- Los tests deben seguir mockeando `maplibre-gl` (jsdom no soporta WebGL/canvas), igual que ya hace `mapa-ruta-maplibre.md`; los mocks existentes deben ampliarse para simular `setPaintProperty`, `addControl`, `resize`, y el ciclo de vida de eventos `load`/`fullscreenchange` sin depender de una implementación real del navegador.
- No se modifican el color/grosor del trazado (`--amber`, 4px), ni la lógica de marcadores/clustering de fotos ya construida por `mejoras-fotos-mapa` — esta spec solo toca legibilidad del estilo base y controles de interacción del mapa.

## Dependencias
- `specs/features/mapa-ruta-maplibre.md` — spec base de `<route-map>` (renderizado de trazado, ciclo de vida del mapa, transform lat/lng, estado sin datos GPS). Esta spec la amplía, no la sustituye ni duplica sus AC ya cumplidos.
- `specs/features/mejoras-fotos-mapa.md` — marcadores de foto y clustering ya construidos sobre `<route-map>`; deben seguir funcionando sin cambios tras esta mejora (regresión a cubrir en tests).
- `specs/ui/design-system.md` — tokens (`--success`, `--amber`, `--panel-sunken`, `--hitbox-min`, `prefers-reduced-motion`) y principios de "Asfalto Nocturno" que deben respetarse en los overrides de contraste y en los nuevos controles.
- `src/routes/route-detail.element.ts` — único consumidor actual de `<route-map>`; no requiere cambios funcionales propios más allá de seguir montando el componente igual que hoy.

## Notas de Implementación
- Investigar en implementación qué capas concretas del estilo `https://tiles.openfreemap.org/styles/dark` corresponden a vías principales/secundarias (inspeccionando el style JSON público) antes de decidir qué `layer-id`s recibirán `setPaintProperty`; documentar los IDs encontrados como comentario en el código, ya que un estilo de terceros puede renombrarlos en el futuro (de ahí AC-003).
- El botón de pantalla completa y los controles de zoom deben vivir dentro del mismo Shadow DOM que el resto de `<route-map>`, consumiendo `tokens.css` igual que los marcadores existentes — nunca estilos globales de `index.css`.
- Considerar que `map.resize()` debe invocarse tanto al entrar como al salir de pantalla completa, en el próximo frame tras el cambio de layout (el contenedor cambia de tamaño de forma asíncrona respecto al evento `fullscreenchange`).
- El skeleton de carga puede reutilizar el patrón visual `.media-placeholder` (franjas diagonales) ya documentado en `specs/ui/design-system.md` §7, o una variante propia sobre `--panel-sunken`; en cualquier caso debe convivir con `data-cy="route-map-container"` ya existente sin romper los tests E2E actuales.
- El control de atribución de MapLibre expone opciones de estilo (`compact: true`) pensadas justo para minimizar su huella visual — evaluar esa opción antes de reimplementar un control de atribución propio.

## Fuera de alcance (features futuras)
- Snap-to-road / map-matching / suavizado del trazado GPS (ya descartado en `mapa-ruta-maplibre.md`).
- Mapa offline (teselas empaquetadas / Protomaps PMTiles).
- Gráfica de velocidad real y galería de fotos completa — cubiertas por otras specs (`mejoras-fotos-mapa.md`).
- Cambios en el color/grosor del trazado, en la lógica de clustering de fotos, o en el popup de marcador de foto individual — ya construidos y fuera del alcance de esta mejora.
- Uso de `<route-map>` fuera del detalle de ruta (p. ej. previsualización en listado) — sigue siendo un componente embebido solo en `<route-detail>`.
