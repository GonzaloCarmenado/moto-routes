# Feature: Reorganizar dominios cockpit y routes

## Descripción
Reorganización estructural de `src/` aplicando el patrón de **organización por vistas de la app** (no por sub-responsabilidad técnica). Cada pantalla/vista funcional de la aplicación vive en su carpeta: la ventana de grabación (`cockpit/`), el listado de rutas (`routes/list/`), el detalle de ruta (`routes/detail/`), la navegación (`components/nav-bar/`) y los elementos comunes (`shared/`). Origen: issue GitHub #52. Es una spec de refactor estructural: **no introduce funcionalidad nueva ni cambia el comportamiento observable de la app**.

## Estructura objetivo

```
src/
├── cockpit/                    # 🏍️ Ventana de grabación de ruta (una sola pantalla)
│   ├── cockpit.element.ts      # <cockpit-view> — pantalla principal de grabación
│   ├── cockpit.element.css
│   ├── cockpit.service.ts      # Estado de grabación (GPS, pausas, cronómetro)
│   ├── cockpit.transform.ts    # Cálculos/formateo del cockpit
│   ├── cockpit.types.ts
│   ├── cockpit.render.ts
│   ├── gps/                    # 📡 GPS: native Android + foreground service
│   │   ├── cockpit-native-gps.service.ts/.spec.ts
│   │   └── cockpit-foreground.service.ts/.spec.ts
│   ├── persist/                # 💾 Persistencia de la ruta grabada
│   │   └── cockpit-persist.service.ts
│   ├── photo/                  # 📸 Fotos durante la grabación
│   │   └── cockpit-photo.service.ts/.spec.ts
│   ├── stop/                   # 🛑 Lógica de parada/guardado
│   │   └── cockpit-stop.service.ts/.spec.ts
│   ├── long-press/             # ⏱️ Long-press del botón de parada
│   │   └── cockpit-long-press.ts/.spec.ts
│   └── save-route-dialog/      # Dialog de guardar (componente autocontenido)
│       ├── cockpit-save-route-dialog.element.ts
│       └── cockpit-save-route-dialog.element.css
│
├── routes/                     # 📋 Rutas guardadas
│   ├── list/                   # 📄 Vista: listado de rutas
│   │   ├── route-list.element.ts
│   │   ├── route-list.element.css
│   │   ├── route-list.transform.ts
│   │   └── route-list-polyline.service.ts
│   └── detail/                 # 🔍 Vista: detalle de una ruta
│       ├── route-detail.element.ts
│       ├── route-detail.element.css
│       ├── route-detail.types.ts
│       ├── route-detail-notes.ts
│       ├── route-detail-photo.service.ts
│       ├── route-detail-timeline.ts    # Pestaña timeline del detalle
│       ├── route-timeline.transform.ts # Lógica pura del timeline
│       └── route-timeline.types.ts
│
├── components/                 # 🧭 Navegación y componentes de UI
│   ├── nav-bar/                # Navbar (barra de navegación inferior)
│   │   └── nav-bar.element.ts/.css
│   └── counter/                # Componente de ejemplo
│
└── shared/                     # 🔧 Elementos comunes a todos los dominios
    ├── base-element.ts
    ├── styles/                 # Design tokens (tokens.css)
    ├── utils/                  # Utilidades puras (geo, format, date...)
    ├── models/                 # Tipos y contratos de repositorio
    ├── repositories/           # Implementaciones SQLite/Memory
    ├── services/               # Servicios compartidos (fotos, rutas...)
    ├── feedback/               # Toast, confirm-dialog
    ├── photo-capture/          # Componente captura de foto
    ├── photo-gallery/          # Componente galería de fotos
    ├── photo-viewer/           # Componente visor de fotos
    ├── route-map/              # Componente mapa Leaflet/MapLibre
    ├── tab-bar/                # Componente pestañas
    ├── tauri/                  # Wrappers Tauri
    └── tauri-plugins/          # Declaraciones de plugins
```

> **Lógica de la organización**: `cockpit/` es UNA pantalla (la grabación activa), pero con ~20 ficheros sueltos resultaba incómodo de navegar. Por eso, además del núcleo (element/service/transform/render/types que se quedan en raíz), sus servicios se agrupan por **sub-responsabilidad funcional** siguiendo el patrón de `shared/`: `gps/` (native GPS + foreground), `persist/`, `photo/`, `stop/`, `long-press/`, `save-route-dialog/`. Cada `x.ts` queda junto a su `x.spec.ts` en su subcarpeta. `routes/` son DOS pantallas distintas (listado y detalle), por lo que se subdivide en `list/` y `detail/`. El timeline es una pestaña del detalle, no una vista independiente, así que su lógica vive dentro de `detail/`.

## Criterios de Aceptación

### Reorganización de `src/cockpit/`
- [x] AC-001: El núcleo de `src/cockpit/` (ventana de grabación) permanece en raíz: `cockpit.element.ts`, `cockpit.element.css`, `cockpit.service.ts`, `cockpit.transform.ts`, `cockpit.types.ts`, `cockpit.render.ts` — son el componente principal del dominio y sus servicios/transforms propios del cockpit.
- [x] AC-009: Los servicios de `src/cockpit/` se agrupan en subcarpetas por **sub-responsabilidad funcional** (patrón de `shared/`), cada uno con su `.spec.ts` junto al fuente:
  - **`src/cockpit/gps/`**: `cockpit-native-gps.service.ts` (+spec), `cockpit-foreground.service.ts` (+spec) — GPS nativo Android y foreground service.
  - **`src/cockpit/persist/`**: `cockpit-persist.service.ts` — persistencia de la ruta grabada.
  - **`src/cockpit/photo/`**: `cockpit-photo.service.ts` (+spec) — fotos durante la grabación.
  - **`src/cockpit/stop/`**: `cockpit-stop.service.ts` (+spec) — lógica de parada/guardado.
  - **`src/cockpit/long-press/`**: `cockpit-long-press.ts` (+spec) — long-press del botón de parada.
  - **`src/cockpit/save-route-dialog/`**: `cockpit-save-route-dialog.element.ts` (+css +spec) — diálogo de guardado (ya agrupado).
  - No queda ningún fichero suelto en la raíz de `src/cockpit/` fuera de los 6 del núcleo.
  - Cada fichero `.spec.ts` se mueve a la misma subcarpeta que su fuente.

### Reorganización de `src/routes/`
- [x] AC-002: Los ficheros de `src/routes/` se organizan por vista de aplicación:
  - **`src/routes/list/`** (listado de rutas): `route-list.element.ts`, `route-list.element.css`, `route-list.transform.ts`, `route-list-polyline.service.ts`.
  - **`src/routes/detail/`** (detalle de ruta): `route-detail.element.ts`, `route-detail.element.css`, `route-detail.types.ts`, `route-detail-notes.ts`, `route-detail-photo.service.ts`, `route-detail-timeline.ts`, `route-timeline.transform.ts`, `route-timeline.types.ts`.
  - Cada fichero `.spec.ts` se mueve a la misma subcarpeta que su fuente.
  - No queda ningún fichero suelto en la raíz de `src/routes/`.

### Imports y referencias
- [x] AC-003: Todos los imports relativos de `src/cockpit/` se actualizan a las nuevas rutas (solo los que apuntan a `cockpit-save-route-dialog.*` cambian). No queda ninguna referencia a la ruta antigua `./cockpit-save-route-dialog.element.js` desde ningún archivo del proyecto.
- [x] AC-004: Todos los imports relativos de `src/routes/` se actualizan a las nuevas rutas. No queda ninguna referencia a las rutas antiguas en raíz (`./route-list.*.js`, `./route-detail*.js`, `./route-timeline.*.js`) desde ningún archivo del proyecto fuera de las nuevas subcarpetas.
- [x] AC-005: Los imports de `src/cockpit/` y `src/routes/` hacia `src/shared/` y hacia el otro dominio se actualizan a las nuevas rutas relativas si la profundidad cambió. No queda ningún import roto que apunte a una ruta inexistente.

### Invariante de comportamiento
- [x] AC-006: El refactor no cambia el comportamiento observable de la app. La suite completa de tests (`pnpm test`) sigue en verde al final (se permite tocar tests existentes solo por cambios de import, nunca se relaja una aserción), y `tsc`/ESLint/Prettier sin errores.
- [x] AC-007: Los componentes mantienen sus atributos `data-cy` intactos (los tests E2E dependen de ellos). No se modifica ningún selector ni atributo en los `.element.ts`.
- [x] AC-008: No se introduce ninguna dependencia nueva ni se modifica lógica de negocio, servicios, transforms ni CSS. Los ficheros se mueven **literalmente** (mismo contenido) salvo los imports relativos que apuntan a otra carpeta.

## Comportamiento Esperado

### Escenario: Refactor estructural sin cambio de comportamiento (invariante global)
- **Dado** el estado actual de la app con toda la suite de tests en verde
- **Cuando** se aplica la reorganización de carpetas (mover ficheros, actualizar imports)
- **Entonces** la suite de tests sigue en verde, las quality gates se mantienen, y el usuario no percibe ningún cambio visual o funcional

### Escenario: Organización por vistas visible en la estructura
- **Dado** la estructura de `src/` tras el refactor
- **Cuando** un desarrollador navega por la estructura de carpetas
- **Entonces** cada vista de la app tiene su carpeta clara: `cockpit/` (ventana de grabación), `routes/list/` (listado), `routes/detail/` (detalle de ruta), `components/nav-bar/` (navbar) y `shared/` (elementos comunes) — sin carpetas planas dispersas

### Escenario: Ninguna referencia residual a rutas antiguas
- **Dado** el refactor aplicado
- **Cuando** se busca en el código (`grep -r`) por los nombres de fichero antiguos en rutas de import (`./cockpit-save-route-dialog`, `./route-detail-timeline`, etc.)
- **Entonces** no aparece ninguna coincidencia en imports — solo pueden quedar referencias en documentación o specs, no en código

## Constraints
- **Refactor estructural, no producto nuevo**: ningún cambio debe alterar lo que el usuario final ve o hace en la app.
- No se introduce ninguna dependencia nueva.
- No se relajan las quality gates: `pnpm test` 100% pass, `tsc` sin errores, ESLint 0 warnings, Prettier limpio.
- Los ficheros se mueven literalmente (mismo contenido) excepto imports relativos cuya ruta relativa cambia al cambiar la profundidad de carpeta.
- Los cambios afectan a toda la app (todos los dominios importan de `cockpit` y `routes`), por lo que se marcan como **CRÍTICO** en la review.
- No es una spec de HTML/CSS ni de lógica — es únicamente reorganización de ficheros e imports.
- No hay UI nueva, así que no aplica "primer paso de design tokens" ni tests E2E Cypress específicos de esta feature (los atributos `data-cy` se mantienen intactos por AC-007).

## Dependencias
- Issue GitHub #52 — origen de esta feature.
- `specs/ui/frontend-conventions.md` (sección 1) — reglas de estructura de carpetas por dominio funcional y subniveles permitidos.
- `specs/features/deuda-tecnica-auditoria.md` — spec de refactor previa que tocó imports cruzados entre `cockpit` y `routes`, sin reorganizar la estructura interna de ambas carpetas (deja constancia de que esta reorganización queda pendiente).
- `src/shared/` — patrón de referencia: cada componente en su subcarpeta (`photo-capture/`, `photo-gallery/`, `tab-bar/`, `route-map/`, `feedback/`).

## Notas de Implementación
- **Invariante central**: los ficheros se mueven con `git mv` (o equivalente) para preservar historial, y su contenido NO cambia salvo los imports relativos cuya ruta se altera por la nueva profundidad.
- **`cockpit/` agrupa por sub-responsabilidad** (una pantalla, pero ~20 ficheros incómodos): el núcleo (element/service/transform/render/types) queda en raíz; `gps/` (native-gps + foreground), `persist/`, `photo/`, `stop/`, `long-press/`, `save-route-dialog/` agrupan los servicios. Cada `x.ts` con su `x.spec.ts` en la misma subcarpeta.
- **`routes/` se divide por vista**: `list/` (listado) y `detail/` (detalle). El timeline es una pestaña del detalle, por lo que `route-timeline.transform.ts` y `route-timeline.types.ts` viven en `detail/` junto a `route-detail-timeline.ts`.
- **Imports de `cockpit/`**: al mover un servicio de la raíz a una subcarpeta (`gps/`, `persist/`, etc.), sus imports `./x.js` apuntando a la raíz → `../x.js`; sus imports `../shared/...` → `../../shared/...`. Los imports en la raíz que apuntan a un servicio movido → `./<subcarpeta>/<fichero>.js`.
- **Imports de `routes/`**: al mover ficheros de `src/routes/` a `src/routes/list/` o `src/routes/detail/`, sus imports de `../shared/` pasan a `../../shared/`. El único import cruzado `routes → cockpit` (la excepción documentada AC-001: `route-timeline.transform.ts` importa `detectStop` de `cockpit.transform.ts`) pasa de `../cockpit/cockpit.transform.js` a `../../cockpit/cockpit.transform.js`.
- **Imports same-dir que NO cambian**: `route-detail.element.ts` importa `./route-detail-photo.service.js`, `./route-detail-notes.js`, `./route-detail-timeline.js`, `./route-timeline.types.js` — al moverse todos juntos a `detail/`, estas rutas siguen siendo válidas. Igual para `route-list.element.ts` con `./route-list.transform.js` y `./route-list-polyline.service.js`.
- **Importador externo**: `src/app/app.element.ts` importa `../routes/route-list.element.js` → `../routes/list/route-list.element.js` y `../routes/route-detail.element.js` → `../routes/detail/route-detail.element.js` (su import de `../cockpit/cockpit.element.js` no cambia).
- **No debe quedar ninguna carpeta vacía**: si al mover ficheros alguna subcarpeta queda vacía, se elimina.
- La suite de tests de cada fichero movido es la verificación principal de que el comportamiento no cambió — ejecutar `pnpm test` completo tras cada dominio movido.
- **Grep de verificación tras terminar**: `grep -r "from '\./cockpit-save-route-dialog" src` debe devolver solo referencias a `./save-route-dialog/`; `grep -r "from '\./route-" src/routes` debe devolver 0 coincidencias (todo import relativo debe apuntar a `list/`, `detail/` o `../`).