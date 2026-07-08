# Convenciones de Frontend

## Propósito

Define las reglas vinculantes para todo desarrollo de frontend. El impl-agent lee este documento al inicio de cada paso que toque UI. El review-agent lo usa para verificar cumplimiento. El plan-agent lo referencia al planificar features con interfaz.

---

## 1. Estructura de Carpetas

### Organización por dominio funcional

Los archivos se organizan por **dominio funcional** (clientes, mascotas, facturas), no por tipo técnico (components, services, models mezclados).

```
src/
├── clientes/                    # Dominio "clientes"
│   ├── clientes.element.ts      # Componente principal (HTML + lógica de este dominio)
│   ├── clientes.element.css     # Estilos del componente (archivo separado)
│   ├── clientes.form.element.ts # Sub-componente: formulario de cliente
│   ├── clientes.form.element.css
│   ├── clientes.service.ts      # Servicio de acceso a datos de clientes
│   ├── clientes.transform.ts    # Validaciones, cálculos, transformaciones de cliente
│   └── clientes.types.ts        # Tipos/interfaces específicos de cliente
│
├── mascotas/                    # Dominio "mascotas" (puede tener subniveles)
│   ├── mascotas.element.ts
│   ├── mascotas.element.css
│   ├── mascotas.service.ts
│   └── razas/                   # Sub-dominio dentro de mascotas
│       ├── razas.select.element.ts
│       └── razas.select.element.css
│
├── shared/                      # Componentes y servicios COMUNES a todos los dominios
│   ├── base-element.ts          # Clase base para todos los Web Components
│   ├── styles/
│   │   └── tokens.css           # Design tokens globales (var(--color-primary), etc.)
│   ├── utils/
│   │   └── dom.ts               # Helpers de DOM compartidos
│   └── services/
│       ├── api.service.ts       # Servicio HTTP genérico (fetch wrapper)
│       └── notification.service.ts # Servicio de notificaciones compartido
│
├── app/
│   └── app.element.ts           # Componente raíz de la aplicación
├── index.css                    # Estilos globales (reset, tipografía base)
└── main.ts                      # Entry point
```

### Reglas

- **Un dominio = una carpeta**: todo lo relacionado con "clientes" va dentro de `src/clientes/`.
- **Subniveles permitidos**: si un dominio crece, se pueden crear subcarpetas (ej: `mascotas/razas/`).
- **Componentes compartidos**: lo que usan 2 o más dominios va a `src/shared/`, nunca se duplica.
- **Nombrado**: `<dominio>.<tipo>.ext` → `clientes.service.ts`, `clientes.element.ts`, `clientes.element.css`. Formato kebab-case si son varias palabras: `detalle-cliente.element.ts`.

---

## 2. Separación de Concerns por Archivo

Cada archivo tiene una responsabilidad única. NO se mezclan en un solo archivo monstruo:

| Tipo de archivo | Responsabilidad | Ejemplo |
|----------------|-----------------|---------|
| `.element.ts` | Web Component: HTML template + lógica de interacción | `clientes.element.ts` |
| `.element.css` | Estilos de ese componente (CSS separado, importado con `?inline`) | `clientes.element.css` |
| `.service.ts` | Acceso a datos: API calls, localStorage, IndexedDB | `clientes.service.ts` |
| `.transform.ts` | Validaciones, cálculos, transformaciones de datos, formateo | `clientes.transform.ts` |
| `.types.ts` | Interfaces, types, enums del dominio | `clientes.types.ts` |
| `.spec.ts` | Tests unitarios del componente o servicio | `clientes.element.spec.ts` |

### Lo que NO se debe hacer

```
❌ clientes.element.ts con 500 líneas: HTML + CSS inline + lógica + fetch + validaciones TODO junto

✅ clientes.element.ts → solo HTML + lógica de interacción
✅ clientes.element.css → estilos en archivo separado
✅ clientes.service.ts → llamadas a API
✅ clientes.transform.ts → validaciones y transformaciones
```

---

## 3. CSS en Archivos Separados

- **Prohibido CSS inline en template strings** (salvo animaciones o valores dinámicos justificados).
- **Prohibido `<style>` dentro del HTML del componente**.
- Los estilos van en `.element.css` e importados con `?inline` en el Web Component.
- Los estilos globales (reset, tipografía, scrollbar) en `src/index.css`.
- Los design tokens en `src/shared/styles/tokens.css` usando `var(--token)`.

### Ejemplo

```typescript
// clientes.element.ts
import styles from './clientes.element.css?inline';

class ClientesElement extends BaseElement {
  render() {
    const style = document.createElement('style');
    style.textContent = styles; // CSS importado, NO hardcodeado
    // ...
  }
}
```

### Excepciones permitidas

- Animaciones que dependen de JavaScript (ej: `element.style.transform = 'translateX(${x}px)'`)
- Valores dinámicos de posicionamiento (ej: tooltips que se posicionan respecto al mouse)
- En estos casos, documentar con un comentario `/* inline: necesario para animación JS */`

---

## 4. Componentización de Elementos Comunes

Antes de crear un nuevo elemento visual, el impl-agent debe preguntarse:

1. ¿Existe ya algo similar en `src/shared/` o en otro dominio?
2. ¿Este elemento se va a usar en más de un sitio en el futuro?
3. ¿Puedo extraer la parte reutilizable a `src/shared/`?

Si la respuesta a la pregunta 2 o 3 es "sí" o "probablemente", el elemento debe ir a `src/shared/`.

### Proceso de decisión

```
¿El elemento se usa en 2+ dominios?
  ├── SÍ → src/shared/<elemento>/
  └── NO → ¿Es probable que se use en el futuro?
            ├── SÍ → Preguntar al usuario: "¿Muevo este elemento a shared/ para reutilizarlo?"
            └── NO → Mantener en el dominio actual
```

### Lo que NO se debe hacer

```
❌ src/clientes/boton-guardar.element.ts
❌ src/mascotas/boton-guardar.element.ts
   → Duplicado. Debe ir en src/shared/boton-guardar.element.ts

❌ src/clientes/tabla.element.ts con columnas hardcodeadas para clientes
   → Si la tabla es genérica, debe ir en shared y recibir columnas como input
```

---

## 5. Servicios por Responsabilidad

Un servicio NO hace de todo. Se separan por responsabilidad:

| Tipo de servicio | Qué hace | Dónde va |
|-----------------|----------|----------|
| **Acceso a datos** | API calls, caché, localStorage | `dominio.service.ts` en la carpeta del dominio |
| **Transformación** | Validaciones, cálculos, formateo de fechas, mapeo de DTOs | `dominio.transform.ts` |
| **Comunes/construcción** | HTTP wrapper, notificaciones, logging, helpers genéricos | `src/shared/services/` |

### Ejemplo

```typescript
// clientes.service.ts → SOLO acceso a datos
export async function fetchClientes(): Promise<Cliente[]> { ... }
export async function saveCliente(data: ClienteDTO): Promise<Cliente> { ... }

// clientes.transform.ts → SOLO validaciones y transformaciones
export function validateCliente(data: ClienteDTO): ValidationResult { ... }
export function toClienteDisplay(dto: ClienteDTO): ClienteDisplay { ... }
export function calculateEdad(fechaNacimiento: Date): number { ... }

// clientes.element.ts → SOLO HTML + lógica de interacción
// Usa clientes.service.ts para datos y clientes.transform.ts para validar
```

---

## 6. HTML, CSS y TypeScript en Archivos Separados

Como norma:

- El HTML está en el método `render()` del `.element.ts` (template strings)
- El CSS está en el `.element.css` (importado con `?inline`)
- La lógica de negocio está en `.service.ts` y `.transform.ts`
- La lógica de interacción (event listeners, estado) está en el `.element.ts`

### Relación entre archivos

```
clientes.element.ts ──importa──→ clientes.element.css
       │
       ├──usa──→ clientes.service.ts (fetch, save, delete)
       ├──usa──→ clientes.transform.ts (validate, format, calculate)
       └──usa──→ clientes.types.ts (interfaces)
```

---

## 7. Preferencias de Implementación

### Lo que SÍ se debe hacer

- Usar `var(--token)` de `tokens.css` en todo momento
- Mobile-first: estilos base para móvil, `@media (min-width: ...)` para añadir complejidad
- Usar `aria-label`, `aria-live`, roles cuando sea necesario
- Respetar `prefers-reduced-motion` para animaciones
- Usar `data-cy` en todo elemento interactivo

### Lo que NO se debe hacer

- Estilos inline (salvo excepciones documentadas en punto 3)
- Hardcodear colores, fuentes, espaciados
- Duplicar lógica entre dominios → extraer a shared
- Mezclar responsabilidades en un solo archivo (service + transform + element en uno solo)
- Importar directamente de otros dominios (ej: `clientes` importando de `mascotas`) → usar shared
- Dependencias circulares entre carpetas

---

## 8. Rendimiento (Performance)

### Bundle Size

- El límite de warning del bundle es 200KB (`chunkSizeWarningLimit` en vite.config.ts). Si se supera, revisar.
- No añadir dependencias innecesarias. Preguntarse: "¿puedo implementar esto con APIs nativas del navegador?"
- Usar imports dinámicos para funcionalidad no crítica: `await import('./heavy-element.js')`

### Web Components

- No registrar todos los componentes en `main.ts`. Registrar solo los que se usan en la vista actual.
- Diferir lógica pesada de `connectedCallback` a `requestAnimationFrame` o `setTimeout` si bloquea el render.
- Evitar `innerHTML` en bucles. Preferir `createElement` + `appendChild` para inserciones múltiples.

### CSS

- Mantener los selectores CSS planos (máx 2 niveles de profundidad). Selectores profundos fuerzan al navegador a recalcular.
- Evitar animaciones que disparen `layout` (usar `transform` y `opacity` en lugar de `left`/`top`/`width`).

### Red

- Diferir la carga de datos no críticos (lazy load de imágenes, infinite scroll en listados).
- Cachear respuestas de API cuando tenga sentido (service worker o localStorage).

---

## 9. Accesibilidad (a11y)

### Reglas mínimas WCAG AA

- **Contraste**: Ratio mínimo 4.5:1 para texto normal, 3:1 para texto grande (>=18px o >=14px bold).
- **Teclado**: Todo elemento interactivo debe ser operable con teclado (Tab, Enter, Escape, flechas).
- **Focus visible**: No eliminar `outline` sin proporcionar un estilo de focus alternativo visible.

### Web Components

- Usar `role` adecuado en componentes personalizados. Ej: `<app-table role="grid">`.
- Usar `aria-label` en botones sin texto visible (iconos). Ej: `<button aria-label="Cerrar modal">X</button>`.
- Usar `aria-live="polite"` para regiones que se actualizan dinámicamente (listados, notificaciones).
- Gestionar el foco manualmente en modales (trampa de foco) y navegación SPA (mover foco al contenido nuevo).

---

## 10. ¿Cuándo preguntar al usuario?

El impl-agent debe preguntar al usuario antes de:

1. **Crear un componente nuevo** si sospecha que puede ser compartido (ej: un botón, una tabla, un modal) → "¿Quieres que ponga este componente en shared/ para reutilizarlo?"

2. **Duplicar lógica** que ya existe en otro dominio → "Ya existe una función similar en X. ¿Refactorizo a shared/ y la reutilizo aquí?"

3. **Añadir una dependencia externa** (npm install) → "Necesito instalar X para esto. ¿Estás de acuerdo?"

4. **Crear una estructura de carpetas profundamente anidada** (más de 2 niveles) → "La estructura está creciendo. ¿Mantengo subniveles en este dominio o reorganizo?"
