## 1. Iconos de acción: papelera y cerrar

- [x] 1.1 Test en rojo: `apps/mobile/src/shared/icons/action-icons.spec.ts` — `TRASH_ICON`/`CLOSE_ICON` son strings SVG válidos (`viewBox="0 0 24 24"`, sin emoji/texto).
- [x] 1.2 Implementar `apps/mobile/src/shared/icons/action-icons.ts` (mismo patrón que `cloud-sync-icons.ts`). Test en verde.
- [x] 1.3 Test en rojo en `route-list.element.spec.ts`: el botón de borrar de una tarjeta ya no contiene el emoji `🗑`, sí el SVG de `action-icons`.
- [x] 1.4 `route-list.element.ts`: sustituir `btn.textContent = '🗑'` por `btn.innerHTML = TRASH_ICON`. Test en verde. Ajustar CSS si el `<span>`/`<button>` necesita las reglas `stroke`/`fill` ya usadas en `.sync-status-icon svg`.
- [x] 1.5 Test en rojo en `photo-viewer.element.spec.ts`: el botón de borrar no contiene `🗑`, el de cerrar no contiene `✕`, ambos usan SVG de `action-icons`.
- [x] 1.6 `photo-viewer.element.ts`: sustituir ambos `textContent` por `innerHTML` con `TRASH_ICON`/`CLOSE_ICON`. Test en verde. Ajustar CSS.

## 2. Iconos de tipo de parada (revierte ADR-035)

- [x] 2.1 Test en rojo: `apps/mobile/src/shared/icons/stop-type-icons.spec.ts` — `STOP_TYPE_ICON_BY_KEY` tiene una entrada SVG por cada una de las 8 claves reales del catálogo (`bar-restaurante`, `mirador`, `monumento`, `gasolinera`, `alojamiento`, `taller-mecanico`, `aparcamiento`, `otro`), y `resolveStopTypeIcon(key)` devuelve `STOP_TYPE_ICON_FALLBACK` para una clave desconocida.
- [x] 2.2 Implementar `apps/mobile/src/shared/icons/stop-type-icons.ts` con las 8 constantes + fallback + función `resolveStopTypeIcon`. Test en verde.
- [x] 2.3 Test en rojo en `cockpit-stop-type-dialog.element.spec.ts`: cada opción del menú usa el SVG resuelto por `resolveStopTypeIcon`, no `category.icon` crudo.
- [x] 2.4 `cockpit-stop-type-dialog.element.ts`: sustituir la interpolación de `category.icon` por `resolveStopTypeIcon(category.key)` renderizado vía `innerHTML`. Test en verde.
- [x] 2.5 Test en rojo en `route-detail-timeline.spec.ts`/`route-timeline.transform.spec.ts`: el delimitador de parada usa el SVG resuelto, no el emoji. (También `TimelineDelimiter.category` cambia de `{icon,label}` a `{key,label}` — deliberado, el transform ya no lleva el emoji.)
- [x] 2.6 `route-timeline.transform.ts`/`route-detail-timeline.ts`: mismo cambio. Test en verde.
- [x] 2.7 Test en rojo en `route-map-stops.spec.ts` (y `route-map.element.spec.ts`, cobertura de integración adicional encontrada durante la implementación): el marcador usa `innerHTML` con el SVG resuelto, no `textContent` con el emoji.
- [x] 2.8 `route-map-stops.ts`: mismo cambio. Test en verde.
- [x] 2.9 Test en rojo en `cockpit.element.spec.ts` (spec real que cubre el flujo de `cockpit-mark-stop.service.ts` end-to-end): el toast de confirmación ya no lleva el emoji concatenado en el mensaje.
- [x] 2.10 `cockpit-mark-stop.service.ts`: quitar el emoji del string del mensaje (el icono de éxito del toast, tarea del grupo 5, cubre esa señal visual). Test en verde.

## 3. Iconos de navegación principal

- [x] 3.1 Test en rojo: `apps/mobile/src/shared/icons/nav-icons.spec.ts` — `ROUTES_TAB_ICON`/`PROFILE_TAB_ICON` son SVG válidos y distintos entre sí. **Ajuste decidido con el usuario durante la implementación**: el botón "Grabar" NO se toca — su `record-dot` es un indicador de acción (círculo relleno), no un icono de línea, con un fix de centrado frágil ya protegido por test de regresión (AC-018); convertirlo arriesgaba reintroducir ese bug sin necesidad real. Solo Rutas y Perfil pasan a SVG.
- [x] 3.2 Implementar `apps/mobile/src/shared/icons/nav-icons.ts` (`ROUTES_TAB_ICON`/`PROFILE_TAB_ICON`). Test en verde.
- [x] 3.3 Test en rojo en `nav-bar.element.spec.ts`: Rutas y Perfil contienen un `<svg>`.
- [x] 3.4 `nav-bar.element.ts`: sustituir `.nav-icon-list`/`.nav-icon-profile` por los SVG nuevos (Grabar sin cambios), actualizando `nav-bar.element.css`. Test en verde.

## 4. Iconos del cockpit — descartado durante la implementación

- [x] 4.1-4.4 **Grupo completo descartado, decidido con el usuario**: `.icon-record-dot`/`.icon-stop`/`.icon-pause`/`.icon-play` en `cockpit.render.ts` son formas rellenas (punto, barras, triángulo, cuadrado redondeado) — convención estándar de controles de media (play/pausa/stop van rellenos, no en contorno, casi universalmente). Mismo criterio ya decidido para el `record-dot` de la nav-bar (grupo 3): se quedan como están, sin ningún cambio, fuera de alcance de este cambio. No se crea `shared/icons/cockpit-icons.ts`.

## 5. Iconos de toast (capacidad nueva)

- [x] 5.1 Test en rojo: `apps/mobile/src/shared/icons/toast-icons.spec.ts` — `TOAST_SUCCESS_ICON`/`TOAST_ERROR_ICON`, SVG válidos.
- [x] 5.2 Implementar `apps/mobile/src/shared/icons/toast-icons.ts`. Test en verde.
- [x] 5.3 Test en rojo en `toast.spec.ts`: un toast `variant: 'success'` incluye el SVG de éxito; uno `variant: 'error'` incluye el de error; uno `variant: 'info'` no incluye ninguno de los dos (sin cambio de comportamiento); el mensaje de texto sigue presente en los tres casos.
- [x] 5.4 `showToast()` en `toast.ts`: construir el nodo icono condicionalmente por `variant` y el nodo mensaje, en vez de `toast.textContent = message`. Actualizado `overlays.css` (`.photo-toast__icon`, reutilizando `stroke`/`color` del resto del sistema). Test en verde.
- [x] 5.5 **Gap real confirmado durante la implementación (no anticipado en `design.md`)**: además de `cockpit-mark-stop.service.ts` (ya limpiado en el grupo 2), otros 8 llamadores de `showToast()` en 6 ficheros concatenaban `⚠️`/`📷`/`☁` dentro del mensaje. Tests actualizados (4 aserciones en `route-detail.element.spec.ts` y `cockpit-stop.service.spec.ts` con el emoji baked-in, más una en `cockpit.element.spec.ts`) y confirmados en rojo antes de tocar el código fuente.
- [x] 5.6 Emoji quitados en: `cockpit.element.ts` (3 sitios), `route-list.element.ts`, `route-detail-cloud.service.ts` (3 sitios), `route-detail-cloud-upload.ts` (2 sitios), `route-detail-notes.ts`, `cockpit-stop.service.ts`, `route-detail.element.ts` (2 sitios). Todos los specs afectados en verde (102/102 en el barrido conjunto). **Hallazgo adicional fuera de alcance, no corregido**: `route-detail-timeline.ts:175` (`'📷 Foto'`, label inline del timeline) y `route-detail-states.ts:31` (`⚠️ ${message}`, panel de estado de error) también llevan emoji — no son toasts, no están en las 4 categorías de la spec de este cambio (papelera/cerrar, tipos de parada, nav-bar, toasts). Dejados tal cual, anotados como posible cambio futuro en `memory/context.md`.

## 6. Verificación real y cierre

- [x] 6.1 Suite completa: `tsc --noEmit` limpio, ESLint limpio (0 warnings, corregido un `max-statements` real en `route-detail-timeline.ts` extrayendo `buildDelimiterLabel`), Vitest con cobertura 979/979 (96.42% líneas), Cypress E2E completo 54/54 contra backend real (`docker compose up`) — encontró y corrigió dos bugs reales de verdad: la propia spec `cockpit-mark-stop.cy.ts` (aserción del emoji antiguo) y un bug de encadenamiento de comandos Cypress (reutilizar una referencia `cy.get()` guardada tras llamar `.find()` desplaza el "subject" de las aserciones siguientes — corregido re-consultando el selector en cada expectativa). `cargo fmt`/`clippy` limpios (sin cambios Rust en este cambio).
- [ ] 6.2 **No verificable en este entorno**: la extensión Claude-in-Chrome no está conectada, así que no se pudo hacer la verificación visual manual (capturas o dispositivo Android real) de listado de rutas, visor de fotos, menú de tipo de parada, timeline, mapa, nav-bar y toasts, para confirmar que ningún icono se ve cortado/mal alineado/con color equivocado en modo oscuro real. Pendiente para una sesión con navegador o dispositivo disponible — Cypress headless (54/54 verde) ya confirma el comportamiento funcional, no el acabado visual fino.
- [x] 6.3 Nueva entrada en `memory/decisions.md` ([[ADR-046]]): reversión parcial de [[ADR-035]] (tipos de parada dejan de ser emoji), citando este cambio. **Nota de proceso**: la rama de este cambio se había creado desde un `master` desactualizado (antes de fusionar `sincronizar-version-app`/PR #115) — detectado antes de escribir la ADR (habría colisionado con ADR-045 ya existente en esa rama hermana), corregido con `git merge feature/sincronizar-version-app --ff-only` antes de continuar. Esta ADR queda numerada 046, sin colisión.
- [x] 6.4 Actualizar `memory/context.md` con el resultado de este cambio y el estado pendiente de la verificación visual del punto 6.2.
