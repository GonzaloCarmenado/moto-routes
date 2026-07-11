# Filosofía Visual y Design Tokens

## Propósito

Este documento define la **filosofía visual** de **Moto Routes (Ride Tracker)**. Aplicación móvil para motociclistas que combina navegación GPS, grabación de rutas y bitácora multimedia. Todo el código CSS debe usar los tokens definidos aquí.

Fuente de la entrega de diseño: `moto-routes-design/` (screens de referencia, `docs/DESIGN_PHILOSOPHY.md`, `docs/STYLE_GUIDE.html`, `css/global.css`). Este documento traduce esa entrega a los tokens reales de `src/shared/styles/tokens.css`.

---

## 1. Personalidad de Marca

### Concepto: "Asfalto Nocturno"

moto-routes no es un GPS. Es un **cuaderno de bitácora**: registra el viaje mientras ocurre y lo convierte en un recuerdo con datos. El diseño evoca el asfalto de noche y el cuadro de instrumentos de una moto — negro cuero, metal oscuro, un ámbar cálido que responde como el testigo de un salpicadero. Dramático y con carácter, pero nunca futurista: nada de HUDs, glassmorphism ni neón azulado. Es mecánico, no digital.

**Palabras clave:** asfalto nocturno, cuero oscuro, cuadro de instrumentos, ámbar cálido, carretera, aventura.

### ¿Qué queremos transmitir?

- **El dato protagonista, no el adorno**: en la pantalla de grabación solo importa lo que el piloto necesita de un vistazo (velocidad, tiempo, distancia); todo lo demás es secundario y silencioso.
- **Papel, no pantalla de cristal**: fondos cálidos color papel/cuero envejecido en vez de blancos fríos o negros puros.
- **Legibilidad Extrema**: alto contraste para lectura con vibraciones y luz solar directa, cifras grandes con tipografía tabular tipo cuentakilómetros.
- **Accesibilidad Física**: zonas táctiles mínimas de 56×56px para uso con guantes de moto.
- **Modo oscuro obligatorio** por seguridad vial (sin deslumbramiento nocturno). No existe variante clara.
- **Un acento, usado con disciplina**: el ámbar es el color de la acción (grabar, dato en vivo, estado activo); el óxido es de apoyo (líneas, acabados). Nunca compiten por atención.

### ¿Qué NO transmitimos?

- No es un HUD de competición ni un panel "tech" — sin neón, sin glassmorphism, sin azules digitales.
- No es "minimalista extrema" — la información de telemetría tiene presencia y peso visual.
- No es "modo claro" — prohibido por deslumbramiento nocturno.
- No es "recargada" — sin sombras excesivas ni bordes decorativos innecesarios.

---

## 2. Paleta de Colores

Arquitectura cromática en **Modo Oscuro Técnico Obligatorio**, cálida (asfalto/cuero), no fría. No existe variante en modo claro.

| Token CSS | Uso principal |
|-----------|---------------|
| `--bg-top` / `--bg-bottom` | Degradado de fondo de toda la app (cabecera → pie) |
| `--panel` | Tarjetas, stat tiles |
| `--panel-sunken` | Superficies hundidas (thumbnails, placeholders) |
| `--bezel` | Marco/base más oscura (texto sobre ámbar, fondo de overlays) |
| `--nav-bg` | Fondo de la botonera inferior (cuando exista) |

### Texto

| Token CSS | Uso principal |
|-----------|---------------|
| `--ink` | Texto principal (nunca blanco puro) |
| `--ink-soft` | Texto secundario |
| `--ink-faint` | Etiquetas, metadatos, unidades |

### Acentos

| Token CSS | Uso principal |
|-----------|---------------|
| `--amber` / `--amber-strong` | Acento primario — el único color que "brilla": velocidad en vivo, botón de grabar, estado activo |
| `--amber-soft` / `--amber-border` | Fondo y borde tenue del acento (chips, banners) |
| `--rust-line` | Línea de óxido — borde superior de tarjetas y stat tiles, un detalle de acabado, no una superficie |
| `--danger` / `--success` / `--warning` | Estados funcionales |

### Líneas

| Token CSS | Uso principal |
|-----------|---------------|
| `--line` / `--line-strong` | Bordes y separadores |

---

## 3. Tipografía

| Token CSS | Fuente | Aplicación |
|-----------|--------|------------|
| `--font-display` | Roboto Slab (600) → fallback Georgia, serif | Titulares, nombres de ruta, marca — señalética de carretera |
| `--font-ui` | Barlow (400–700) → fallback Segoe UI, sans-serif | Interfaz, cuerpo de texto, etiquetas — legible con guantes y en movimiento |
| `--font-data` | Barlow Semi Condensed (700–800) → fallback Barlow | Cifras grandes: velocidad, distancia, tiempo. `font-variant-numeric: tabular-nums`, simula el cuentakilómetros |

Las fuentes están auto-alojadas como subset `.woff2` en `src/assets/fonts/` (solo los pesos realmente usados) porque la app es Tauri offline con CSP `font-src 'self'` — no hay dependencia de Google Fonts en runtime. Las reglas `@font-face` viven en `tokens.css`.

Las clases `.num`, `.stat-value`, `.speed-value` aplican `--font-data` + `tabular-nums` automáticamente a cualquier cifra.

---

## 4. Espaciado

Escala de 4px, más compacta que el sistema anterior:

| Token CSS | Valor |
|-----------|-------|
| `--space-1` … `--space-7` | 4 / 8 / 12 / 16 / 24 / 32 / 48 px |

### Accesibilidad Táctil

| Token CSS | Valor | Uso |
|-----------|-------|-----|
| `--hitbox-min` | 56px | Mínimo área táctil para guantes de moto |
| `--nav-height` | 84px | Altura reservada para la botonera inferior (incluye safe-area) |

---

## 5. Bordes, Sombras y Radios

| Token CSS | Valor | Uso |
|-----------|-------|-----|
| `--r-sm` | 8px | Placeholders, etiquetas pequeñas |
| `--r-md` | 14px | Tarjetas pequeñas, chips grandes |
| `--r-lg` | 20px | Tarjetas principales |
| `--r-pill` | 999px | Botones, chips, píldoras |
| `--shadow-card` | — | Sombra cálida sutil de tarjetas |
| `--shadow-btn` | — | Sombra de botones |

Sombras cálidas y profundas — el contraste viene de la luz ámbar, no de sombras frías ni de glow neón.

---

## 6. Animaciones y Transiciones

| Token CSS | Valor | Uso |
|-----------|-------|-----|
| `--transition-fast` | 0.15s ease | Hover, focus, pulsación de botones |
| `--transition-smooth` | 0.25s cubic-bezier(0.4, 0, 0.2, 1) | Apertura/cierre estándar |
| `--transition-elastic` | 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) | Micro-interacciones con rebote |

`prefers-reduced-motion: reduce` se respeta globalmente (regla en `tokens.css`, ver §10).

---

## 7. Componentes clave

- **Stat tile** (`.stat-tile` / `.stat-grid`): bloque etiqueta + valor + unidad, la unidad base de cualquier dato en la app. Borde superior de óxido (`--rust-line`).
- **Chip de estado** (`.chip`, `.chip-recording` / `.chip-paused` / `.chip-neutral`): "En ruta" / "Pausada" / etiquetas neutras.
- **Banner de velocidad media** (`.avg-speed-banner`): dato agregado destacado con fondo ámbar tenue.
- **Controles de grabación** (`.record-controls`, `.control-btn`): botón circular ámbar (acción primaria) + botón secundario de pausa (contorno).
- **Placeholder de medios** (`.media-placeholder`): franjas diagonales + etiqueta monoespaciada, para mapas y fotos aún no cargados.
- **Botonera inferior** (`.bottom-nav`, `.nav-item`, `.nav-item-record`): Rutas · Grabar (destacado, circular, elevado) · Perfil. **Documentada pero no implementada todavía** — no hay routing ni más pantallas montadas en `src/`; se añadirá cuando exista navegación entre vistas.

---

## 8. Áreas de la aplicación

| Área | Estado | Componentes principales | Notas visuales |
|------|--------|--------------------------|-----------------|
| Cockpit (Grabación) | **Implementado** (`src/cockpit/`) | Chip de estado, velocidad en vivo, stat-grid, banner de vel. media, controles de grabación, modo invisible, overlay GPS | Fondo asfalto/cuero, ámbar como único acento vivo |
| Mis Rutas | Pendiente — mockup en `moto-routes-design/screens/listado-rutas.html` | Tarjetas de ruta (`.route-card`) | Reconocimiento visual rápido: miniatura + nombre + fecha + distancia/duración |
| Detalle de Ruta | Pendiente — mockup en `moto-routes-design/screens/detalle-ruta.html` | Mapa, stat-grid, gráfica de velocidad, galería de fotos, notas | Ficha construida por bloques apilables, ampliable sin rediseñar |
| Navegación Inferior | Pendiente (sin routing todavía) | `.bottom-nav` | Rutas · Grabar (destacado) · Perfil |

---

## 9. Iconografía

| Propiedad | Valor |
|-----------|-------|
| Formato | SVG puro, vectorial, trazo (sin rellenos complejos ni degradados) |
| Grosor trazo | `2px`, `stroke-linecap: round`, `stroke-linejoin: round` |
| Tamaño base | `24px × 24px` |

---

## 10. Reglas de Implementación

1. **Usar design tokens siempre**: NUNCA hardcodear colores, fuentes o espaciados. Usar `var(--token)`.
2. **CSS en archivos `.css` separados**, importados con `?inline` en Web Components.
3. **Shadow DOM ⇒ nada de global.css mágico**: `src/index.css` estiliza el DOM ligero (`<body>`, `<app-root>`), pero **sus reglas nunca alcanzan el contenido de un Shadow DOM**. Cualquier regla que deba aplicar dentro de un componente (`h1`-`h4`, `.num`/`.stat-value`, `prefers-reduced-motion`, etc.) vive en `tokens.css`, que cada `*.element.css` importa con `@import` — así sí llega dentro del shadow root. No asumas que una regla en `index.css` es "global" solo porque el archivo se llama así.
4. **Mobile-first**: el estilo base es para móvil, los breakpoints añaden complejidad.
5. **Contraste WCAG AA**: ratio mínimo 4.5:1 para texto normal, 3:1 para texto grande.
6. **Hitbox mínima 56×56px** para todos los elementos interactivos en ruta.
7. **Reducir motion si el usuario lo prefiere**: respetar `prefers-reduced-motion` (regla global en `tokens.css`).
8. **No usar `!important`**: salvo la excepción ya documentada de `prefers-reduced-motion`.
9. **Modo oscuro obligatorio**: no existe modo claro.
10. **Componentes compartidos solo con 2+ consumidores**: mientras Cockpit sea el único dominio implementado, sus clases de componente (`.chip`, `.stat-tile`, `.control-btn`, etc.) viven en `cockpit.element.css`. Se promueven a `src/shared/` cuando una segunda pantalla los reutilice (ver `specs/ui/frontend-conventions.md` §4).
