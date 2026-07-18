# Feature: Botonera de Navegación Inferior

## Descripción
Barra de navegación fija en la parte inferior de la app con tres botones (Rutas, Grabar, Perfil). Solo el botón Grabar tiene funcionalidad: redirige a la vista del cockpit (`<cockpit-view>`). Los otros dos botones son placeholder visuales que no navegan a ninguna vista todavía. La barra usa los tokens del sistema de diseño (`--nav-bg`, `--nav-height`, `--amber`, `--hitbox-min`) y sigue la referencia visual de `moto-routes-design/screens/listado-rutas.html`.

## Criterios de Aceptación

### Componente `<nav-bar>`
- [ ] AC-001: Existe un Web Component `<nav-bar>` en `src/components/nav-bar/nav-bar.element.ts` con su CSS en `nav-bar.element.css`.
- [ ] AC-002: El componente se importa y se monta en `src/app/app.element.ts` (`<app-root>`), fuera del `<cockpit-view>`, de forma que sea visible en todas las pantallas futuras.
- [ ] AC-003: La barra se posiciona fija al fondo de la pantalla (`position: fixed; bottom: 0`), con altura `var(--nav-height)` y fondo `var(--nav-bg)`.

### Tres botones
- [ ] AC-004: La barra contiene tres botones con `data-cy`:
  - `data-cy="nav-rutas"` — icono de lista (3 barras horizontales), texto "Rutas", **sin acción** (placeholder)
  - `data-cy="nav-grabar"` — icono de círculo (grabación), texto "Grabar", **redirige al cockpit**
  - `data-cy="nav-perfil"` — icono de silueta (círculo con borde), texto "Perfil", **sin acción** (placeholder)
- [ ] AC-005: El botón Grabar (central) tiene un tratamiento visual destacado: fondo circular ámbar elevado por encima de la barra, siguiendo el diseño de `.nav-item-record` del mockup.
- [ ] AC-006: Cada botón cumple la hitbox mínima de `var(--hitbox-min)` (56×56px) para uso con guantes.

### Navegación
- [ ] AC-007: Al pulsar "Grabar", la app navega a la vista del cockpit. `app.element.ts` debe tener una variable de estado que controle qué vista se muestra.
- [ ] AC-008: Los botones "Rutas" y "Perfil" no producen ningún cambio de vista ni error; simplemente no tienen event listener asignado.

### Estilo
- [ ] AC-009: La barra usa los tokens del sistema de diseño definidos en `specs/ui/design-system.md`: `--nav-bg`, `--amber`, `--bezel`, `--ink-faint`, `--ink-soft`.
- [ ] AC-010: El botón activo (Grabar cuando se está en cockpit) tiene el texto y el icono en color `var(--amber)`. Los botones inactivos usan `var(--ink-faint)`.
- [ ] AC-011: La barra respeta `padding-bottom: env(safe-area-inset-bottom)` para dispositivos con notch.

### Tests
- [ ] AC-012: Test unitario: `<nav-bar>` renderiza tres botones con los `data-cy` correctos.
- [ ] AC-013: Test unitario: al hacer click en "Grabar", se emite un evento `nav-grabar` o se actualiza el estado del `<app-root>` para mostrar el cockpit.
- [ ] AC-014: Test unitario: los botones "Rutas" y "Perfil" no disparan ningún evento ni cambian el DOM.

## Diseño de Componente

### Estructura de archivos
```
src/components/nav-bar/
├── nav-bar.element.ts      # Web Component <nav-bar>
├── nav-bar.element.css     # Estilos (importa tokens.css)
└── nav-bar.element.spec.ts # Tests unitarios (Vitest)
```

### Modificación en app.element.ts
```
src/app/app.element.ts → añadir <nav-bar> y lógica de vista actual
```

### Dependencias
```
app.element.ts
  ├── importa <nav-bar>         (componente nuevo)
  └── importa <cockpit-view>    (ya existe)
```

## Comportamiento Esperado

### Escenario: App inicia con nav-bar visible
- **Dado** que la app arranca
- **Cuando** se renderiza el `<app-root>`
- **Entonces** la botonera inferior es visible con los tres botones, y el botón Grabar aparece activo/ámbar

### Escenario: Navegar al cockpit desde la nav
- **Dado** que la app está en cualquier vista
- **Cuando** el usuario pulsa el botón "Grabar"
- **Entonces** la app muestra `<cockpit-view>` y el botón Grabar se marca como activo

### Escenario: Botones placeholder no hacen nada
- **Dado** que la app está en la vista del cockpit
- **Cuando** el usuario pulsa "Rutas" o "Perfil"
- **Entonces** no ocurre ningún cambio de vista, no se lanza ningún error en consola

## Notas para la implementación
- La navegación entre vistas se hará con una variable de estado simple (`currentView: 'cockpit' | 'routes' | 'profile'`) en `app.element.ts`. No se necesita un router complejo para 3 vistas.
- El botón Grabar siempre está activo porque es la única vista implementada.
- Los iconos se implementan como SVG inline (no dependencias externas), siguiendo el diseño de `listado-rutas.html`.
- Este componente NO debe depender de Tauri ni del plugin SQL.
- La barra debe respetar el `--nav-height` de 84px definido en `tokens.css`, que ya incluye espacio para safe-area.
- El `<nav-bar>` se comunica con el `<app-root>` mediante un evento custom (`nav-grabar`) o mediante una callback pasada como propiedad.