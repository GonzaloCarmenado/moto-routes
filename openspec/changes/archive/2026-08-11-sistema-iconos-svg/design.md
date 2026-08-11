## Context

Ver `proposal.md` - Why. El único sistema de iconos SVG real de la app hoy es `apps/mobile/src/shared/icons/cloud-sync-icons.ts`: exports de `string` con SVG inline (`viewBox="0 0 24 24"`, sin `fill`, con `path`/`rect`/`line`), consumidos vía `element.innerHTML = ICON_CONST` y coloreados por CSS externo (`stroke: currentColor`, `stroke-width: 2`, `stroke-linecap/linejoin: round`, con `color: var(--amber)` en las clases de estado relevante). Ese patrón — icono como string exportado, color resuelto por CSS del consumidor, nunca hardcodeado en el SVG — es el que se replica en todo este cambio.

El catálogo de tipos de parada (`apps/api/internal/migrate/migrations/0002_create_stop_types.sql`) tiene 8 filas fijas con columna `key` estable (`bar-restaurante`, `mirador`, `monumento`, `gasolinera`, `alojamiento`, `taller-mecanico`, `aparcamiento`, `otro`) — el mapeo cliente-side de este cambio se indexa por ese `key`, nunca por el `icon` (emoji) ni por el `label`, porque `key` es el único campo pensado como identificador estable.

## Goals / Non-Goals

**Goals:**
- Un solo lugar por dominio de icono (`shared/icons/*.ts`) del que cualquier componente importa, nunca SVG inline duplicado en el propio componente.
- Ningún emoji ni glifo unicode nuevo se introduce; los que ya existen (papelera, cierre, tipos de parada) se retiran de donde este cambio los toca.
- El catálogo de `apps/api` no cambia — el mapeo tipo→icono vive solo en `apps/mobile`.

**Non-Goals:**
- No se reescribe `cloud-sync-icons.ts`, `photo-capture` (cámara/galería) ni el avatar de `profile-header.ts` — ya cumplen el estilo, fuera de alcance.
- No se añade una pantalla de ajustes para elegir estilo de icono, ni theming adicional — un solo estilo, sin variantes.
- No se toca el componente de ejemplo `counter.element.ts`.

## Decisions

**1. Cinco ficheros nuevos en `shared/icons/`, uno por dominio — mismo patrón que `cloud-sync-icons.ts`, sin un "icon registry" genérico centralizado.** `action-icons.ts` (papelera, cerrar), `stop-type-icons.ts` (mapeo `key`→SVG + fallback), `nav-icons.ts` (Rutas/Grabar/Perfil), `cockpit-icons.ts` (grabar/detener/pausar/reanudar), `toast-icons.ts` (éxito/error). Alternativa descartada: un único `icons.ts` con todos los exports — descartado por el mismo criterio de "estructura por dominio funcional" ya aplicado al resto del proyecto (cada consumidor real importa de un fichero con nombre reconocible, no de un fichero fuente de 40 exports).

**2. El mapeo de tipo de parada es `Record<string, string>` indexado por `key`, con una constante `STOP_TYPE_ICON_FALLBACK` para cualquier `key` no reconocida.** Las 8 claves actuales del catálogo se mapean explícitamente; cualquier tipo nuevo que se dé de alta en `apps/api` en el futuro (sin requerir una release nueva de la app, ver `stop-types-catalog`) cae en el fallback hasta que una release de la app añada su icono específico — nunca un hueco vacío ni el emoji crudo. Alternativa descartada: derivar el icono a partir del propio emoji (`icon` del catálogo) con una tabla emoji→SVG — descartado, acopla el cliente a que el backend nunca cambie el emoji de una categoría existente, más frágil que acoplarse al `key` (pensado como identificador estable).

**3. Los iconos de toast se activan solo para `variant: 'success' | 'error'`; `variant: 'info'` sigue sin icono, sin cambio de comportamiento respecto a hoy.** `showToast()` ya recibe `variant` como parámetro obligatorio (`success`/`error`/`info`) — no hace falta ningún parámetro nuevo, solo renderizar el icono correspondiente cuando `variant` sea `success` o `error`. El escenario de la spec "toast sin tipo indicado sigue mostrando el mensaje" cubre `info` (que ya existe como variante "sin icono fuerte", usada para progreso) — no se añade una cuarta variante "sin tipo".

**4. `showToast()` construye un nodo icono (`innerHTML` de un `<span class="photo-toast__icon">`) además del texto, en vez de seguir usando `toast.textContent = message`.** Cambia a `toast.append(iconSpan, messageSpan)` o equivalente — sigue siendo un único elemento raíz, mismo mecanismo de montaje en `document.body`, mismo `dismiss()` devuelto. Los estilos nuevos van en `src/shared/styles/overlays.css` (donde ya viven `.photo-toast--*`), reutilizando el mismo `stroke`/`color` que el resto del sistema.

**5. Los iconos de tipo de parada dejan de usar `textContent`/interpolación de string y pasan a `innerHTML` con el SVG correspondiente**, en los tres consumidores (`cockpit-stop-type-dialog.element.ts`, `route-detail-timeline.ts`, `route-map-stops.ts`) y en el toast de `cockpit-mark-stop.service.ts` (que hoy concatena el emoji dentro del *mensaje* de texto — pasa a usar `showToast(message, 'success')` sin el emoji embebido, dejando que el icono de éxito del toast haga ese trabajo, ya que un emoji de categoría dentro de un toast genérico de confirmación no aporta información que el propio mensaje de texto no dé ya).

**6. Sin ADR de arquitectura nueva sobre el estilo SVG en sí (ya sentado por `cloud-sync-icons.ts`)**, pero sí una entrada nueva en `memory/decisions.md` documentando la reversión parcial de [[ADR-035]] (los tipos de parada dejan de ser emoji) — mismo criterio que otras reversiones ya documentadas (p. ej. [[ADR-044]] sobre [[ADR-033]]/[[ADR-036]]/[[ADR-041]]).

## Risks / Trade-offs

- **[Riesgo] Un tipo de parada nuevo dado de alta en `apps/api` sin una release de la app que le añada icono específico se ve con el icono genérico de repuesto, indistinguible de otros tipos nuevos.** → Mitigación: es el comportamiento explícitamente decidido (Decision 2), coherente con que el catálogo ya está pensado para poder crecer sin exigir una release (ver `stop-types-catalog`); el usuario decide si acepta ese icono genérico temporalmente o prioriza una release rápida.
- **[Riesgo] Cambio visual amplio y simultáneo (papelera, tipos de parada, nav-bar, cockpit, toasts) — mayor superficie de regresión visual que una migración incremental.** → Mitigación: cada dominio de icono es un fichero independiente y cada componente se migra en su propia tarea de `tasks.md`, verificable por separado (Cypress ya cubre la mayoría de estos flujos con `data-cy`, que no cambia).
- **[Riesgo] `shared/`, radio de impacto**: los cinco ficheros nuevos viven en `shared/icons/`, consumidos por `cockpit/`, `routes/`, `components/nav-bar/` y `shared/feedback/` — cualquier fallo de tipos o de export ahí rompe varios dominios a la vez. → Mitigación: cada fichero nuevo es independiente (sin imports cruzados entre ellos), y cada uno lleva su propio `*.spec.ts` verificando el contenido SVG esperado, mismo patrón que si `cloud-sync-icons.ts` lo tuviera (no lo tiene hoy — se añade también para los ficheros nuevos, sin retrofit del existente, fuera de alcance).
