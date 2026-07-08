# Filosofía Visual y Design Tokens

## Propósito

Este documento define la **filosofía visual** de **Moto Routes (Ride Tracker)**. Aplicación móvil para motociclistas que combina navegación GPS, grabación de rutas y bitácora multimedia. Todo el código CSS debe usar los tokens definidos aquí.

---

## 1. Personalidad de Marca

### Concepto: "Telemetry & Freedom" (Telemetría y Libertad)

Fusiona la precisión de un **cuadro de instrumentos de competición (TFT/LCD)** con la fluidez de un **cuaderno de bitácora digital**.

### ¿Qué queremos transmitir?

- **Legibilidad Extrema**: Alto contraste (7:1 mínimo) para lectura con vibraciones y luz solar directa.
- **Precisión Técnica**: Visualización tipo cockpit de competición, datos en tiempo real.
- **Confianza**: Estética sólida, nada rebuscado. Modo oscuro obligatorio por seguridad vial.
- **Accesibilidad Física**: Zonas táctiles mínimas de 56×56px para uso con guantes de moto.

### ¿Qué NO transmitimos?

- No es "divertida" — sin colores neón excesivos ni animaciones distractivas.
- No es "minimalista extrema" — la información de telemetría tiene presencia y peso visual.
- No es "modo claro" — prohibido por deslumbramiento nocturno.
- No es "recargada" — sin sombras excesivas ni bordes decorativos innecesarios.

---

## 2. Paleta de Colores

Arquitectura cromática en **Modo Oscuro Técnico Obligatorio**. No existe variante en modo claro.

| Token CSS | Valor hex | Uso principal |
|-----------|-----------|---------------|
| `--color-bg-base` | `#0b0c10` | Fondo general absoluto de la aplicación |
| `--color-bg-surface` | `#161a24` | Tarjetas contenedoras, widgets de estadísticas |
| `--color-bg-overlay` | `#222836` | Inputs, botones secundarios, cabeceras de tabla |
| `--color-bg-elevated` | `#2e364a` | Elementos elevados, bordes de botones |

### Colores de Estado (Neón Técnico)

| Token CSS | Valor hex | Uso principal |
|-----------|-----------|---------------|
| `--color-neon-go` | `#00ff66` | Grabación activa (REC), velocidad óptima, filtros seleccionados |
| `--color-neon-stop` | `#ff3131` | Botón de parada, zonas de peligro, alertas de desconexión GPS |
| `--color-neon-brand` | `#00d2ff` | Trazado de rutas, POIs, enlaces, navegación activa |

### Texto

| Token CSS | Valor hex | Uso principal |
|-----------|-----------|---------------|
| `--color-text-max` | `#ffffff` | Dígitos del velocímetro, títulos, métricas en tiempo real |
| `--color-text-mid` | `#94a3b8` | Subtítulos, unidades de medida, descripciones |
| `--color-text-dark` | `#0f172a` | Texto sobre fondos claros (raro, solo en badges) |

### Efectos Glow

| Token CSS | Valor | Uso principal |
|-----------|-------|---------------|
| `--glow-go` | `0 0 20px rgba(0, 255, 102, 0.5), inset 0 0 10px rgba(0, 255, 102, 0.2)` | Botón REC activo |
| `--glow-stop` | `0 0 20px rgba(255, 49, 49, 0.5), inset 0 0 10px rgba(255, 49, 49, 0.2)` | Botón STOP activo |
| `--glow-brand` | `0 0 15px rgba(0, 210, 255, 0.4)` | Marcadores de ruta |

---

## 3. Tipografía

| Token CSS | Valor | Aplicación |
|-----------|-------|------------|
| `--font-sans` | `'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif` | UI general |
| `--font-mono` | `ui-monospace, 'Fira Code', monospace` | Datos de telemetría, velocidad |
| `--font-weight-black` | `900` | Velocímetro, dígitos grandes |
| `--font-weight-bold` | `700` | Títulos, énfasis fuerte |
| `--font-weight-medium` | `500` | Énfasis ligero |
| `--font-weight-regular` | `400` | Texto corrido |
| `--font-size-xs` | `0.625rem` (10px) | Timestamps, metadatos |
| `--font-size-sm` | `0.75rem` (12px) | Subtítulos, badges |
| `--font-size-base` | `0.875rem` (14px) | Texto de cuerpo |
| `--font-size-lg` | `1rem` (16px) | Títulos de tarjeta |
| `--font-size-xl` | `1.25rem` (20px) | Títulos de sección |
| `--font-size-2xl` | `1.5rem` (24px) | Títulos de página |
| `--font-size-3xl` | `2rem` (32px) | Velocímetro valor |
| `--font-size-4xl` | `4rem` (64px) | Velocímetro dígito grande |
| `--line-height-tight` | `1.1` | Velocímetro |
| `--line-height-normal` | `1.4` | Texto de cuerpo |

---

## 4. Espaciado (Escala de 4px)

| Token CSS | Valor | Uso principal |
|-----------|-------|---------------|
| `--space-1` | `0.25rem` | Gap mínimo |
| `--space-2` | `0.5rem` | Gap inline |
| `--space-3` | `0.75rem` | Padding compacto |
| `--space-4` | `1rem` (16px) | Padding móvil estándar |
| `--space-6` | `1.5rem` | Separación entre bloques |
| `--space-8` | `2rem` | Separación entre secciones |
| `--space-12` | `3rem` | Márgenes de layout |
| `--space-16` | `4rem` | Separación mayor |

### Accesibilidad Táctil

| Token CSS | Valor | Uso principal |
|-----------|-------|---------------|
| `--hitbox-min` | `56px` | Mínimo área táctil para guantes |
| `--padding-mobile` | `16px` | Padding lateral estándar |
| `--padding-compact` | `12px` | Padding compacto |

---

## 5. Bordes, Sombras y Radios

| Token CSS | Valor | Uso principal |
|-----------|-------|---------------|
| `--radius-sm` | `0.25rem` (4px) | Inputs, badges |
| `--radius-md` | `0.5rem` (8px) | Tarjetas pequeñas |
| `--radius-lg` | `1rem` (16px) | Tarjetas principales, modales |
| `--radius-xl` | `1.5rem` (24px) | Contenedores grandes, drawer |
| `--radius-full` | `9999px` | Píldoras, botones circulares |
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.3)` | Sutil |
| `--shadow-md` | `0 4px 6px rgba(0,0,0,0.4)` | Tarjetas |
| `--shadow-lg` | `0 10px 25px rgba(0,0,0,0.5)` | Modales, drawer |
| `--border-width` | `1px` | Borde estándar |
| `--border-width-thick` | `2px` | Timeline, marcadores |

---

## 6. Animaciones y Transiciones

| Token CSS | Valor | Uso principal |
|-----------|-------|---------------|
| `--transition-fast` | `0.15s linear` | Hover, focus |
| `--transition-smooth` | `0.25s cubic-bezier(0.4, 0, 0.2, 1)` | Apertura/cierre estándar |
| `--transition-elastic` | `0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)` | Botón maestro REC |

---

## 7. Breakpoints Responsive

| Token CSS | Valor | Dispositivo |
|-----------|-------|-------------|
| `--bp-sm` | `640px` | Móvil landscape |
| `--bp-md` | `768px` | Tablet portrait |
| `--bp-lg` | `1024px` | Desktop pequeño |

---

## 8. Áreas de la Aplicación

| Área | Propósito | Componentes principales | Notas visuales |
|------|-----------|------------------------|----------------|
| Cockpit (Grabación) | Pantalla principal en ruta | Dial circular, botón REC, grid telemetría | Fondo negro absoluto, métricas brillantes |
| Mis Rutas | Listado de rutas guardadas | Filtros chips, tarjetas de ruta | Scroll horizontal de filtros |
| Detalle de Ruta | Visualización de ruta + paradas | Mapa interactivo, timeline drawer, galería | Modo noche en mapa, pins neon |
| Navegación Inferior | Navegación global | Bottom navbar con 4-5 iconos | Sticky, glassmorphism |
| Garaje | Gestión de motos | Tarjetas de moto, selector | Miniaturas compactas |

---

## 9. Iconografía

| Propiedad | Valor |
|-----------|-------|
| Formato | SVG puro, vectorial |
| Grosor trazo | `2px`, `stroke-linecap: round`, `stroke-linejoin: round` |
| Tamaño base | `24px × 24px` (box) |
| Tamaño navbar | `22px × 22px` |
| Prohibido | Rellenos complejos, degradados, iconos de raster |

---

## 10. Reglas de Implementación

1. **Usar design tokens siempre**: NUNCA hardcodear colores, fuentes o espaciados. Usar `var(--token)`.
2. **CSS en archivos `.css` separados**, importados con `?inline` en Web Components.
3. **Mobile-first**: El estilo base es para móvil, los breakpoints añaden complejidad.
4. **Contraste WCAG AA**: Ratio mínimo 4.5:1 para texto normal, 7:1 para texto de telemetría.
5. **Hitbox mínima 56×56px** para todos los elementos interactivos en ruta.
6. **Reducir motion si el usuario lo prefiere**: Respetar `prefers-reduced-motion`.
7. **No usar `!important`**: Refactorizar en lugar de forzar.
8. **Modo oscuro obligatorio**: No existe modo claro.
9. **Scrollbar oculta**: `scrollbar-width: none` en contenedores con scroll horizontal.