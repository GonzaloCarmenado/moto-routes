# Review: sistema-iconos-svg

## CRÍTICO (leer primero)

- **Sin secretos**: revisado `git status`/`git diff --stat` completo — solo ficheros de `apps/mobile/src`, `apps/mobile/cypress` y `memory/`. Ningún `.env`, credencial ni valor sensible.
- **Cambio en `src/shared/`**: sí, sustancial — 4 módulos nuevos en `shared/icons/` (`action-icons`, `stop-type-icons`, `nav-icons`, `toast-icons`) y `shared/feedback/toast.ts` (nueva construcción DOM del toast: icono + mensaje en spans separados, en vez de `textContent`). Radio de impacto: cualquier llamador de `showToast()` (7 ficheros tocados) y cualquier consumidor de `TimelineDelimiter.category` (cambio de forma `{icon,label}` → `{key,label}`, solo 2 consumidores reales, ambos ya actualizados). Sin cambios de API pública más allá de eso — `showToast(message, variant)` mantiene su firma.
- **Sin dependencias nuevas**: ningún `package.json` tocado.
- **Ninguna regla del proyecto saltada sin justificación**: TDD real seguido en los 6 grupos (rojo confirmado antes de cada implementación, con las excepciones documentadas explícitamente en `tasks.md` — grupo 4 completo y parte de grupos 3/5 descartados/ampliados tras confirmarlo con el usuario, nunca decidido en silencio).
- **Reversión de una ADR aceptada** ([[ADR-035]]): documentada explícitamente como tal en la nueva [[ADR-046]], con el motivo del porqué la razón original ya no aplica — no se ignoró ni se contradijo en silencio.
- **Gap de verificación real, no oculto**: verificación visual manual (pantallas reales, no solo headless) no realizada — Claude-in-Chrome no estaba conectado en esta sesión. Ver Gaps.

## Verificación independiente realizada

- Releído `git diff --stat` completo (36 ficheros modificados + 9 nuevos) y el contenido de los 4 módulos de iconos nuevos, confirmando que cada uno sigue el patrón de `cloud-sync-icons.ts` (SVG inline, `viewBox="0 0 24 24"`, sin `fill`, coloreado por CSS del consumidor).
- Confirmado que `resolveStopTypeIcon` se indexa por `key` (identificador estable del catálogo), no por el emoji ni el label — coherente con `design.md` Decisión 2.
- Re-ejecutados de forma independiente, no solo confiando en el resultado de la implementación: `tsc --noEmit` (limpio), `eslint src/` (limpio, 0 warnings), `pnpm run test:coverage` (**979/979**, 96.42% líneas — por encima del umbral 80%), `pnpm run test:e2e` contra backend real vía `docker compose up` (**54/54**, incluida la verificación repetida tras corregir dos bugs reales encontrados en el propio proceso: la aserción del emoji antiguo en `cockpit-mark-stop.cy.ts`, y un bug de encadenamiento de comandos Cypress no relacionado con el código de producción). `cargo fmt --check`/`cargo clippy -- -D warnings` limpios (sin cambios Rust en este cambio, verificado igualmente).
- Confirmado con `grep` que no queda ningún emoji (`⚠️`/`📷`/`☁`/`🏔️`/etc.) en ninguna llamada a `showToast()` del código de producción, y que los dos hallazgos fuera de alcance (`route-detail-timeline.ts`, `route-detail-states.ts`) están correctamente excluidos por no ser toasts.

## Mapeo Requirement → Scenario → Verificación

| Requirement | Scenario | Verificación |
|---|---|---|
| Estilo visual sobrio de 2 colores | Icono neutro usa color heredado | Estructural: CSS de cada consumidor usa `color: var(--ink-faint)`/heredado, `stroke: currentColor` en el SVG. No hay test dedicado a "el color computado es X" (Vitest/jsdom no calcula CSS real) — mismo límite que cualquier verificación de color en este proyecto, se apoya en revisión del CSS fuente. |
| (mismo Requirement) | Icono en estado relevante usa ámbar | Igual — clases `--active`/`--synced`/`--success` etc. ya usaban `var(--amber)` antes de este cambio, heredado sin modificar esa parte. |
| Borrar/cerrar sin emoji | Borrar ruta / borrar foto / cerrar visor muestran SVG | `route-list.element.spec.ts`, `photo-viewer.element.spec.ts` — verde. |
| Tipo de parada resuelto a SVG propio | Menú / timeline / mapa / fallback | `cockpit-stop-type-dialog.element.spec.ts`, `route-detail-timeline.spec.ts`, `route-timeline.transform.spec.ts`, `route-map-stops.spec.ts`, `route-map.element.spec.ts`, `stop-type-icons.spec.ts` (fallback) — verde. Verificado además end-to-end en Cypress real (`cockpit-mark-stop.cy.ts`) contra el catálogo real de `apps/api`. |
| Nav-bar/cockpit sin forma CSS | Pestañas Rutas/Perfil | `nav-bar.element.spec.ts` — verde. **Grabar y los 4 controles del cockpit: fuera de alcance, decidido con el usuario** — no hay escenario que cubrirlos porque la spec no los incluye (ver Desviaciones). |
| Toasts con icono | Éxito / error / sin tipo (info) | `toast.spec.ts` — verde. |

Cobertura de escenarios de la spec: 6/6 requirements con al menos un test verde; el requirement de nav-bar/cockpit cubre solo Rutas/Perfil (el resto quedó fuera de alcance por decisión explícita, no por omisión).

## Hallazgos

### Gaps (pendientes, no bloqueantes)
1. **[Gap]** Verificación visual manual (capturas o dispositivo Android real) no realizada — Claude-in-Chrome no conectado en este entorno. Cypress headless confirma el comportamiento funcional (elementos presentes, clases correctas) pero no el acabado visual fino (alineación exacta, recorte, contraste real en modo oscuro). Recomendación: hacerla antes de la próxima release, no bloqueante para fusionar el código.

### Hallazgos informativos (fuera de alcance de este cambio, documentados, no corregidos)
2. **[Informativo]** `route-detail-timeline.ts` (`'📷 Foto'`, label inline de evento) y `route-detail-states.ts` (`⚠️ ${message}`, panel de error) siguen con emoji — no son toasts, no están en las 4 categorías declaradas en la spec de este cambio. Candidato para un cambio futuro.

### Desviaciones respecto a los artefactos planeados (ambas confirmadas con el usuario durante la implementación, no decididas en silencio)
3. **[Desviación]** El `record-dot` de la pestaña "Grabar" de la nav-bar no se convirtió a SVG (proposal.md lo incluía genéricamente en "tabs Rutas/Grabar/Perfil"). Motivo: es un indicador de acción, no un icono de línea, con un fix de centrado frágil ya protegido por test de regresión (AC-018) — convertirlo arriesgaba reintroducir ese bug real sin necesidad. Confirmado con el usuario antes de tocar el código.
4. **[Desviación]** El grupo 4 completo (iconos del cockpit: grabar/detener/pausar/reanudar) se descartó — son formas rellenas, convención estándar de controles de media, no arbitrarias formas CSS a "modernizar". Confirmado con el usuario antes de implementar nada del grupo 4.

No se han encontrado gaps de seguridad, tipos `any`, CSS inline injustificado, ni incumplimientos de la estructura por dominio del proyecto.

## Veredicto

**APPROVED WITH MINOR ISSUES**

Justificación: los 6 requirements de la spec están implementados y cubiertos por test (979/979 Vitest, 54/54 Cypress contra backend real, TDD rojo→verde confirmado de forma independiente en cada grupo); dos desviaciones de alcance respecto al proposal inicial, ambas explícitamente confirmadas con el usuario y bien documentadas, no ocultas; un gap real encontrado y corregido en la propia implementación (los ~10 toasts con emoji redundante); ninguna regla de seguridad ni convención del proyecto saltada. El único motivo por el que no es `APPROVED` sin matices es la verificación visual manual pendiente (bloqueada por la falta de navegador conectado en este entorno, no por un defecto del código) y los dos usos de emoji fuera de alcance ya anotados como posible trabajo futuro.
