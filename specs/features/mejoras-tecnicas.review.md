# Revisión: Mejoras Técnicas

## 📋 Ficheros Tocados

| Archivo | Tipo | Descripción del cambio |
|---------|------|------------------------|
| `src/shared/base-element.ts` | MODIFICADO | Nuevo helper `renderShadow(styles, ...nodes)` (AC-006) |
| `src/shared/base-element.spec.ts` | CREADO | Tests del helper |
| `src/app/app.element.ts` | MODIFICADO | `extends BaseElement`; `render()` en vez de `buildUI`; layout inline → index.css; `showView('cockpit')` inicial |
| `src/components/nav-bar/nav-bar.element.ts` | MODIFICADO | `extends BaseElement`; `renderShadow`; eventos por constante; iconos inline → clases |
| `src/components/nav-bar/nav-bar.element.css` | MODIFICADO | Clases de iconos (`.nav-icon-*`) |
| `src/routes/route-list.element.ts` | MODIFICADO | `extends BaseElement`; `render(): void` leyendo `_routes`; `dispatchAppEvent` |
| `src/routes/route-detail.element.ts` | MODIFICADO | `extends BaseElement`; `render(): void` leyendo `_route`; visor/miniaturas/back-btn inline → clases; `dispatchAppEvent` |
| `src/routes/route-detail.element.css` | MODIFICADO | `.back-btn__arrow`, `.detail-photo-capture` |
| `src/shared/route-map/route-map.element.ts` | MODIFICADO | `extends BaseElement`; `renderShadow` |
| `src/shared/route-map/route-map.element.css` | MODIFICADO | `.route-map-marker--photo` / `--cluster` |
| `src/shared/route-map/route-map-photos.ts` | MODIFICADO | Marcadores inline → clases; color por token |
| `src/shared/app-events.ts` | CREADO | Constantes + tipos de evento + `dispatchAppEvent` (AC-002) |
| `src/shared/app-events.spec.ts` | CREADO | Tests |
| `src/shared/services/photo-persist.service.ts` | CREADO | Pipeline compartido de foto (AC-007) |
| `src/shared/services/photo-persist.service.spec.ts` | CREADO | Tests |
| `src/cockpit/cockpit-photo.service.ts` | MODIFICADO | Delega en `persistCapturedPhoto` |
| `src/routes/route-detail-photo.service.ts` | MODIFICADO | Delega en `persistCapturedPhoto` |
| `src/cockpit/cockpit.render.ts` / `.element.css` | MODIFICADO | Icono de pausa inline → clase `.icon-pause` |
| `src/shared/utils/toast.ts` | MODIFICADO | Estilos inline → clases de `overlays.css`; colores por token |
| `src/shared/styles/overlays.css` | CREADO | Estilos globales de toast y visor (overlays en document.body) |
| `src/shared/styles/tokens.css` | MODIFICADO | Nuevos `--danger-soft`, `--scrim` |
| `src/index.css` | MODIFICADO | Import de `overlays.css`; layout de `app-root` |
| `src/shared/utils/dom.ts` | ELIMINADO | Código muerto (AC-003) |
| `vitest.config.ts` | MODIFICADO | Quitada la exclusión de `dom.ts` |

## 📝 Resumen de Cambios
- Clase base unificada: los 9 custom elements extienden ahora `BaseElement`, con un helper `renderShadow` que elimina el boilerplate de montaje de Shadow DOM.
- Eventos de navegación centralizados y tipados; sin strings literales sueltos.
- Pipeline de persistencia de foto deduplicado en un único servicio compartido.
- CSS inline movido a hojas de estilo con tokens; código muerto eliminado.

## ✅ Cumplimiento de AC

| AC | Estado | Notas |
|----|--------|-------|
| AC-001 | ✅ Cumplido | 9/9 componentes extienden BaseElement |
| AC-002 | ✅ Cumplido | `app-events.ts`; grep confirma 0 literales de evento en src |
| AC-003 | ✅ Cumplido | `dom.ts` eliminado; sin imports colgando |
| AC-004 | ✅ Cumplido (con excepción justificada) | Estilos estáticos movidos a CSS. Se mantiene inline solo el posicionamiento **dinámico** calculado en runtime: menú de `<photo-capture>` (posición según rect del botón), `strokeDasharray` del arco de long-press, y el toggle de `display` en `showView` — todos con comentario que lo justifica |
| AC-005 | ✅ Cumplido (con excepción justificada) | Colores por token; único literal restante = `AMBER_FALLBACK` en route-map (ver CRÍTICO) |
| AC-006 | ✅ Cumplido | `renderShadow` en BaseElement, adoptado por nav-bar/route-list/route-detail/route-map |
| AC-007 | ✅ Cumplido | `persistCapturedPhoto` compartido; ambos wrappers delegan |

## 🔴 CRÍTICO

### Seguridad
✅ Sin incidencias. No se tocan secretos, CSP ni validación de inputs (la validación de foto sigue intacta en el pipeline compartido).

### Componentes Comunes Afectados
⚠️ Cambios en `src/shared/`: `base-element.ts` (usado por TODOS los componentes), nuevo `app-events.ts`, nuevo `photo-persist.service.ts`, nuevo `overlays.css`, y `tokens.css`. Riesgo controlado: son extracciones/adiciones cubiertas por 222 tests verdes + verificación visual en la app real (cockpit y listado renderizan y navegan correctamente). `base-element.renderShadow` tiene tests propios.

### Actualizaciones Core
✅ Ninguna dependencia nueva. Cambio de config: `vitest.config.ts` (quita exclusión de `dom.ts` ya borrado).

### Normas Saltadas
✅ Ninguna. Se refuerzan las convenciones de CLAUDE.md (sin CSS inline, colores por token, componentes compartidos en `shared/`).

## ⚠️ Issues Encontrados

### ISSUE-001: `AMBER_FALLBACK` es un literal de color (excepción a AC-005)
- **Severidad**: BAJA (justificada, no requiere acción)
- **AC afectado**: AC-005
- **Descripción**: `src/shared/route-map/route-map.element.ts` mantiene `const AMBER_FALLBACK = '#d4880f'` como fallback del color de la línea de ruta.
- **Justificación**: MapLibre valida sus *paint properties* con su propio parser de color (no el motor CSS del navegador) y no acepta `var(--token)`. Por eso existe toda la maquinaria de conversión oklch→rgb (`route-map.transform.ts`); el fallback literal es la red de seguridad si la resolución del token falla. No es un `var(--token, #fallback)` de CSS.

### ISSUE-002: `app-root` sin cobertura de tests unitarios
- **Severidad**: BAJA
- **Descripción**: `app.element.ts` (shell de la app) no tiene tests unitarios; su layout se movió a `index.css`. Se verificó **visualmente** con Cypress + screenshots (cockpit, listado, navegación e iconos correctos), pero no queda un test automatizado permanente.
- **Recomendación**: Añadir un test E2E de layout/navegación del shell en una iteración futura (fuera del alcance de este refactor).

## 📊 Veredicto
- [x] **APPROVED**

Todos los AC cumplidos (dos con excepciones documentadas y justificadas). Gates verdes: ESLint 0 warnings, 222 tests, cobertura 85.69% (≥80%), build OK, Clippy/rustfmt/cargo test limpios (pre-commit hook superado). Refactor sin cambio de comportamiento, confirmado por la suite completa y por verificación visual en la app real.
