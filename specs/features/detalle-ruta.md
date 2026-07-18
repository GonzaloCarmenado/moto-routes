# Feature: Detalle de Ruta

## Descripción
Vista que muestra los detalles de una ruta guardada. Se accede desde el listado de rutas al pulsar una tarjeta. Incluye un mapa placeholder, estadísticas (distancia, duración, velocidad media, desnivel), una gráfica de velocidad, galería de fotos y notas. Sigue el diseño de `moto-routes-design/screens/detalle-ruta.html`.

## Criterios de Aceptación

### Componente `<route-detail>`
- [ ] AC-001: Existe un Web Component `<route-detail>` en `src/routes/route-detail.element.ts` con su CSS en `route-detail.element.css`.
- [ ] AC-002: Recibe el repositorio (`IRouteRepository`) y el `routeId` como propiedades.
- [ ] AC-003: Al montarse, carga `repository.getById(routeId)` y renderiza los detalles.
- [ ] AC-004: Si la ruta no existe (`null`), muestra un mensaje "Ruta no encontrada" centrado.

### Mapa placeholder
- [ ] AC-005: Incluye un área de mapa (`.route-map`) con un SVG que simula un trazado de ruta con punto de inicio (verde) y final (ámbar). El trazado es un path decorativo (stroke-dasharray), no los puntos reales.

### Estadísticas
- [ ] AC-006: Muestra 4 stat-tiles en grid de 2 columnas (`.stat-grid.cols-2`):
  - Distancia: `XX.X km`
  - Duración: `Xh XXm` (formateado con `formatDuration`)
  - Vel. media: `XX km/h`
  - Desnivel: hardcodeado `-- m` (no existe el dato aún)

### Gráfica de velocidad - PENDIENTE
- [ ] AC-007: La sección de gráfica se renderiza como placeholder con el texto "Velocidad durante la ruta" y un área vacía con borde inferior. La gráfica real se implementará en una feature futura.

### Fotos - PENDIENTE
- [ ] AC-008: La sección de fotos se renderiza con el título "Fotos de la ruta" y un único placeholder "Sin fotos". Las fotos reales se implementarán en una feature futura.

### Notas - PENDIENTE
- [ ] AC-009: Si la ruta tiene campo `notes` (texto), se muestra. Si no, se oculta la sección de notas.

### Navegación
- [ ] AC-010: Al pulsar una tarjeta en `<route-list>`, se dispara un evento `view-route` con el `routeId` que `app-root` escucha para mostrar `<route-detail>`.
- [ ] AC-011: `<route-detail>` incluye un botón "← Volver" en la parte superior que emite un evento `back-to-list` para volver al listado.

### Estilo
- [ ] AC-012: Usa los tokens del sistema de diseño: `--panel`, `--amber`, `--ink`, `--ink-soft`, `--ink-faint`, `--font-display`, `--font-ui`, `--font-data`.
- [ ] AC-013: La vista tiene scroll vertical si el contenido excede la altura de la pantalla, con `padding-bottom` para la nav-bar.

### Tests
- [ ] AC-014: Test unitario: `<route-detail>` con ruta inexistente muestra "Ruta no encontrada".
- [ ] AC-015: Test unitario: `<route-detail>` con ruta existente muestra título, fecha, 4 stat-tiles y sección de mapa.
- [ ] AC-016: Test unitario: `<route-detail>` emite evento `back-to-list` al pulsar "← Volver".
- [ ] AC-017: Test unitario: al pulsar una tarjeta en `<route-list>`, se emite evento `view-route` con el routeId.

## Diseño de Componente

### Estructura de archivos
```
src/routes/
├── route-detail.element.ts      # Web Component <route-detail>
├── route-detail.element.css     # Estilos (importa tokens.css)
└── route-detail.element.spec.ts # Tests unitarios (Vitest)
```

### Modificaciones
```
src/routes/route-list.element.ts → emitir evento view-route al pulsar tarjeta
src/app/app.element.ts → añadir vista 'detail' + escuchar view-route
```

### Dependencias
```
route-detail.element.ts
  ├── importa IRouteRepository (src/shared/models/route.repository.ts)
  ├── importa formatDuration (src/cockpit/cockpit.transform.ts)
  └── recibe routeId como string
```

## Comportamiento Esperado

### Escenario: Ver detalle de una ruta existente
- **Dado** que hay 3 rutas en el listado
- **Cuando** el usuario pulsa la segunda tarjeta
- **Entonces** se muestra `<route-detail>` con los datos de esa ruta

### Escenario: Volver al listado desde el detalle
- **Dado** que el usuario está en la vista de detalle
- **Cuando** pulsa "← Volver"
- **Entonces** vuelve al listado de rutas

### Escenario: Ruta no encontrada
- **Dado** que se intenta mostrar una ruta con un ID que no existe
- **Cuando** se monta `<route-detail>`
- **Entonces** muestra "Ruta no encontrada" centrado

## Notas para la implementación
- Las secciones de gráfica, fotos y notas son placeholders. Solo el mapa, las estadísticas y el botón de volver son funcionales.
- El mapa es decorativo (SVG inline con path fijo), no usa Google Maps ni datos reales.
- El formato de fecha usa `Date.toLocaleDateString('es-ES', { day: 'numeric', 'month': 'long' })`.
- La navegación entre listado y detalle usa eventos `window.dispatchEvent` (mismo patrón que nav-bar).
- El componente NO debe depender de Tauri ni del plugin SQL.