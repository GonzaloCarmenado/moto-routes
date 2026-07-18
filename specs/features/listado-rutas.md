# Feature: Listado de Rutas

## Descripción
Vista que muestra todas las rutas guardadas en SQLite, obtenidas mediante `IRouteRepository.getAll()`. Cada ruta se muestra como una tarjeta con miniatura placeholder, nombre, fecha y badges de distancia/duración. El usuario puede navegar a esta vista desde el botón "Rutas" de la botonera inferior. El botón Rutas de la nav-bar pasa de placeholder a funcional.

## Criterios de Aceptación

### Componente `<route-list>`
- [ ] AC-001: Existe un Web Component `<route-list>` en `src/routes/route-list.element.ts` con su CSS en `route-list.element.css`.
- [ ] AC-002: El componente recibe el repositorio (`IRouteRepository`) como propiedad o lo obtiene del contexto (`app.element.ts`).
- [ ] AC-003: Al montarse (`connectedCallback`), ejecuta `repository.getAll()` y renderiza la lista.

### Tarjetas de ruta
- [ ] AC-004: Cada tarjeta sigue el diseño de `moto-routes-design/screens/listado-rutas.html`:
  - `.thumb` → placeholder con franjas diagonales (`.media-placeholder` del design system)
  - `.info` → nombre de ruta (`.name`), fecha formateada (`.date`), badges de distancia y duración
- [ ] AC-005: Si no hay rutas guardadas, se muestra un mensaje "No hay rutas guardadas todavía" centrado.
- [ ] AC-006: Las tarjetas se organizan en columna con `gap: 14px` y scroll vertical si hay más de las que caben.

### Subtítulo
- [ ] AC-007: El subtítulo muestra "X rutas guardadas · Y km recorridos" calculado con los datos reales:
  - X = `routes.length`
  - Y = suma de `totalDistance` de todas las rutas, redondeado a 1 decimal

### Navegación
- [ ] AC-008: El botón "Rutas" del `<nav-bar>` pasa a ser funcional: emite un evento `nav-rutas` que `app.element.ts` escucha para mostrar `<route-list>`.
- [ ] AC-009: Al navegar a Rutas, el botón "Rutas" se marca como activo (`nav-item--active`) y Grabar se desactiva.

### Estilo
- [ ] AC-010: Usa los tokens del sistema de diseño: `--panel`, `--panel-sunken`, `--amber`, `--ink`, `--ink-soft`, `--ink-faint`, `--font-display`, `--font-ui`, `--font-data`.
- [ ] AC-011: Las tarjetas respetan `border-radius: var(--r-lg)`, `padding: var(--space-4)`.

### Tests
- [ ] AC-012: Test unitario: `<route-list>` con repositorio vacío muestra mensaje "No hay rutas guardadas todavía".
- [ ] AC-013: Test unitario: `<route-list>` con 2 rutas renderiza 2 tarjetas.
- [ ] AC-014: Test unitario: el subtítulo muestra "2 rutas guardadas · X km recorridos" con el total correcto.
- [ ] AC-015: Test unitario: al hacer click en Rutas del nav-bar, se emite evento `nav-rutas`.

## Diseño de Componente

### Estructura de archivos
```
src/routes/
├── route-list.element.ts      # Web Component <route-list>
├── route-list.element.css     # Estilos (importa tokens.css)
└── route-list.element.spec.ts # Tests unitarios (Vitest)
```

### Modificaciones
```
src/components/nav-bar/nav-bar.element.ts → añadir evento nav-rutas
src/app/app.element.ts → añadir vista 'routes' + escuchar nav-rutas
```

### Dependencias
```
route-list.element.ts
  ├── importa IRouteRepository (src/shared/models/route.repository.ts)
  └── importa Route, formatDuration, formatDistance (transform existentes o nuevos)
```

## Comportamiento Esperado

### Escenario: Listado vacío
- **Dado** que no hay rutas guardadas en SQLite
- **Cuando** el usuario pulsa "Rutas" en la botonera
- **Entonces** se muestra el mensaje "No hay rutas guardadas todavía" centrado en la pantalla

### Escenario: Listado con rutas
- **Dado** que existen 3 rutas guardadas
- **Cuando** el usuario pulsa "Rutas"
- **Entonces** se muestran 3 tarjetas con subtítulo "3 rutas guardadas · XX.X km recorridos"

### Escenario: Navegación Rutas → Grabar
- **Dado** que el usuario está en la vista de Rutas
- **Cuando** pulsa "Grabar" en la botonera
- **Entonces** la app muestra `<cockpit-view>` y el botón Grabar se marca activo

## Notas para la implementación
- El repositorio se inyecta como propiedad (no se instancia dentro del componente).
- El formateo de fechas usa `Date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })`.
- El formateo de duración usa `formatDuration` de `cockpit.transform.ts` (si ya existe) o se crea uno en `shared/`.
- Las miniaturas son placeholders (`.media-placeholder`) porque no hay fotos todavía.
- La altura de la pantalla de listado descuenta el `--nav-height` para no solaparse con la botonera.