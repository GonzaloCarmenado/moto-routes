## Why

La app mezcla hoy tres estilos de icono distintos sin ningún criterio unificado: emoji (papelera de borrar, cierre del visor de fotos, iconos de tipo de parada), formas puras de CSS (nav-bar, controles del cockpit) y SVG inline sobrio (sincronización con la nube, cámara/galería, avatar). El usuario ha pedido explícitamente que todos los iconos de la app converjan al tercer estilo — SVG inline de 2 colores (`stroke="currentColor"`/`var(--amber)`), ya establecido y probado en `apps/mobile/src/shared/icons/cloud-sync-icons.ts` — para que la interfaz se vea coherente en todas partes, no solo en la sincronización de rutas.

Esto revierte parcialmente [[ADR-035]], que decidió deliberadamente emoji para los iconos de tipo de parada "sin pipeline de assets ni dependencia nueva". Esa razón ya no aplica: la app tiene hoy un sistema de iconos SVG real y probado (`cloud-sync-icons.ts`, iconos de `photo-capture`) que no existía cuando se tomó esa decisión — extenderlo a los tipos de parada no añade ningún pipeline ni dependencia nueva, reutiliza uno ya existente. Confirmado explícitamente con el usuario antes de proponer este cambio (preguntado si incluir tipos de parada revirtiendo la ADR, y si añadir iconos nuevos a los toasts — ambas veces confirmó que sí).

## What Changes

- Nuevo módulo de iconos compartido (ampliación de `apps/mobile/src/shared/icons/`, mismo patrón que `cloud-sync-icons.ts`) con los iconos que hoy faltan en ese estilo: papelera (borrar), cerrar (✕), tipos de parada (uno por categoría del catálogo), tabs de nav-bar (Rutas/Grabar/Perfil), controles de cockpit (grabar/pausar/reanudar/detener), y éxito/error para toasts.
- **BREAKING (visual, no de comportamiento)**: la papelera de borrar ruta (`route-list.element.ts`) y borrar foto (`photo-viewer.element.ts`) dejan de mostrar el emoji `🗑` y pasan a SVG. El botón de cerrar del visor de fotos deja el glifo `✕` y pasa a SVG.
- Los tipos de parada (menú de selección, timeline, marcador en el mapa) dejan de renderizar el emoji de `category.icon` directamente y pasan a resolverlo contra un mapeo cliente-side (identificador de categoría → icono SVG del nuevo módulo) — **revierte [[ADR-035]]** en la parte de "iconos como emoji"; el resto de esa ADR (icono como columna `TEXT` servida por `apps/api`, sin pipeline de assets en el backend) no cambia, el mapeo vive solo en el cliente.
- Nav-bar (`nav-bar.element.ts`) y controles del cockpit (`cockpit.render.ts`) dejan sus formas CSS puras y pasan a usar los SVG del nuevo módulo.
- **Nueva capacidad**: los toasts (`shared/feedback/toast.ts`) muestran un icono (éxito/error) junto al texto — hoy no muestran ninguno.

## Capabilities

### New Capabilities
- `app-icon-system`: sistema de iconos SVG compartido de la app — estilo visual (2 colores, sobrio), qué iconos existen, dónde se usa cada uno (papelera, cerrar, tipos de parada, nav-bar, cockpit, toasts), y el mapeo de tipo de parada → icono SVG que reemplaza el renderizado directo del emoji.

### Modified Capabilities
(ninguna — `stop-types-catalog`, `cockpit-manual-stops` y `route-stop-types-display` ya especifican "un icono asociado"/"el icono correspondiente" de forma agnóstica al formato; su comportamiento observable no cambia, solo la representación visual, que es responsabilidad de la nueva capability)

## Impact

- `apps/mobile/src/shared/icons/`: nuevos ficheros de iconos (mismo patrón que `cloud-sync-icons.ts`), y un nuevo mapeo tipo-de-parada → icono.
- `apps/mobile/src/routes/list/route-list.element.ts`, `apps/mobile/src/shared/photo-viewer/photo-viewer.element.ts`: papelera y cierre a SVG.
- `apps/mobile/src/cockpit/stop-type-dialog/cockpit-stop-type-dialog.element.ts`, `apps/mobile/src/routes/detail/route-detail-timeline.ts`, `apps/mobile/src/shared/route-map/route-map-stops.ts`, `apps/mobile/src/cockpit/mark-stop/cockpit-mark-stop.service.ts`: renderizado de tipo de parada a SVG.
- `apps/mobile/src/components/nav-bar/nav-bar.element.ts`, `apps/mobile/src/cockpit/cockpit.render.ts`: iconos de nav-bar/cockpit a SVG.
- `apps/mobile/src/shared/feedback/toast.ts` (y su `.element.css`): icono nuevo de éxito/error.
- Sin cambios en `apps/api` ni en el esquema de la base de datos — el catálogo de tipos de parada sigue sirviendo lo mismo que hoy.
- Nueva ADR en `memory/decisions.md` documentando la reversión parcial de [[ADR-035]].
- Fuera de alcance: los caracteres `-`/`+` del componente de ejemplo `counter.element.ts` (no son iconos del dominio de la app).
