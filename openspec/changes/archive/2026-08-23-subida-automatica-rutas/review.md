# Review: subida-automatica-rutas

## CRÍTICO (leer primero)

- **Seguridad**: sin secretos nuevos, sin cambios de backend en absoluto (verificado — `apps/api` no aparece en el diff). Ningún endpoint nuevo, ninguna superficie de ataque nueva: se reutiliza `uploadRouteToCloud` sin cambiar su firma ni su comportamiento.
- **Separación de dominios preservada**: `cockpit/` (grabación) sigue sin importar nada de `auth`/`routes/detail` — verificado con `grep` antes de implementar (confirmó que ningún fichero de `cockpit/` importaba ya `auth` o `routes/detail`) y de nuevo al cerrar (`persistRouteOnStop` solo añade un import de `shared/app-events.ts`, mismo patrón ya usado por otros ficheros de `shared/feedback` que ese mismo fichero ya importaba). El acoplamiento real (sesión + repositorio + subida) vive en `app.element.ts`/`app-route-upload.ts`, el único punto que ya tenía ambas piezas.
- **Componente compartido tocado**: `shared/styles/overlays.css` gana clases nuevas (`.route-upload-snackbar--*`) sin modificar ninguna clase existente (`.photo-toast*` intacto) — verificado que `route-detail-cloud-upload.spec.ts` y el resto de specs que usan `photo-toast` (Cypress y Vitest) siguen en verde sin tocarlos.
- **Regla del proyecto saltada, con justificación**: ninguna. `data-cy="route-upload-snackbar"` añadido en el propio fichero al crear el elemento. JSDoc en los símbolos exportados nuevos.
- **Extracción por testabilidad, no por límite de líneas — desviación documentada de `tasks.md` 3.3**: `app-route-upload.ts` se extrajo desde el principio, antes de que `app.element.ts` se acercara a ningún límite — porque ese fichero no tiene ningún test unitario propio en todo el repo (solo se verifica vía Cypress) y la lógica nueva (sesión→snackbar→subida) sí necesitaba TDD real. Coherente con el criterio de extracción ya documentado en `CLAUDE.md`, aplicado por una razón ligeramente distinta a la prevista (testabilidad en vez de tamaño) — anotado aquí en vez de dejarlo sin explicar.
- **Tres bugs reales encontrados en la verificación E2E, ninguno en la implementación de producto** (ver detalle en Hallazgos): todos en el propio test de Cypress nuevo, corregidos antes de cerrar. La implementación de la feature en sí no cambió por ninguno de los tres.

## Mapeo Requirement → Scenario → Test

### Subir una ruta local a la cuenta del usuario (requirement existente, ampliado)
Los 6 escenarios preexistentes (subida correcta, mapa actualizado, sin sesión, sin conexión, re-subir, límite de puntos) — **sin cambios de comportamiento, verificados por regresión**: `route-detail-cloud-upload.spec.ts` (4/4) y el resto de la suite de `route-cloud-sync` en Cypress (`route-cloud-sync.cy.ts` 9/9, `route-cloud-sync-photos.cy.ts` 2/2) siguen en verde sin haberlos tocado.

- Guardar una ruta recién grabada con sesión activa la sube sola → `app-route-upload.spec.ts` ("with an active session, shows the snackbar and uploads the route"), `cockpit-auto-upload.cy.ts` (1ª prueba, contra backend real)
- Guardar sin sesión activa no intenta ninguna subida → `app-route-upload.spec.ts` ("does nothing without an active session"), `cockpit-auto-upload.cy.ts` (2ª prueba)
- Un fallo en la subida automática no se reintenta solo → `app-route-upload.spec.ts` ("a failed upload transitions the snackbar to fail(), without throwing"), `cockpit-auto-upload.cy.ts` (3ª prueba: fallo real vía stub 500, ruta sigue "no sincronizada", reintento manual posterior funciona)
- Descartar una ruta grabada nunca dispara subida (caso límite no listado explícitamente en la spec, cubierto igualmente) → `cockpit.service.spec.ts` ("never dispatches route-saved... when the recording is discarded")

### Feedback visible mientras dura una subida automática (requirement nuevo)
- El indicador aparece al empezar → `route-upload-snackbar.spec.ts` ("mounts with the progress message"), `cockpit-auto-upload.cy.ts` (1ª prueba, con `res.setDelay(1200)` para observarlo de forma fiable antes de que resuelva)
- El indicador refleja el éxito → `route-upload-snackbar.spec.ts` ("succeed() switches the text and state to success"), `cockpit-auto-upload.cy.ts` (1ª prueba)
- El indicador refleja un fallo → `route-upload-snackbar.spec.ts` ("fail(message) switches the text and state to error")
- El resto de la app sigue usable mientras el indicador está visible → verificado por construcción, no por un test dedicado: `route-upload-snackbar.ts` no atrapa el foco, no tiene overlay ni backdrop, `position: fixed` sin bloquear clics en el resto de la pantalla (a diferencia de `confirm-dialog.element.ts`/`achievement-unlock-overlay.element.ts`, que sí lo hacen deliberadamente por ser modales) — mismo patrón no bloqueante que `photo-toast`, ya verificado indirectamente por toda la suite E2E que interactúa con la app mientras un toast está en pantalla.
- El indicador desaparece por sí solo → `route-upload-snackbar.spec.ts` ("auto-dismisses after succeed()"/"after fail()"/"does not auto-dismiss while still in progress")

## Hallazgos

1. **[bug real de test, corregido antes de cerrar]** `cy.visitWithSeed({}, { onBeforeLoad: stubGpsPermissionGranted })` ignora en silencio el segundo argumento (el comando solo lee `options` del primer parámetro) — el stub de permisos GPS nunca se aplicaba, rompiendo el flujo de grabación en el test nuevo. Corregido usando `cy.visit('/', { onBeforeLoad: stubGpsPermissionGranted })` puro, igual que `cockpit.cy.ts` — este spec no necesitaba la capacidad de seed de `visitWithSeed`.
2. **[bug real de test, corregido antes de cerrar]** Dos `cy.intercept()` definidos por separado para la misma ruta no se sustituyen entre sí de forma fiable — la petición del reintento manual (tras el fallo simulado) seguía cayendo en el interceptor antiguo de `forceNetworkError`. Corregido con un único interceptor con estado (contador de intentos).
3. **[bug real de test, corregido antes de cerrar]** `req.destroy()` dentro de un handler de `cy.intercept` deja que la petición HTTP se procese igualmente en el **servidor real** — el cliente nunca recibe respuesta (efecto local correcto: snackbar de error), pero el servidor sí creó la ruta, así que el botón manual de "Subir a la nube" ya mostraba "sincronizada" pese al fallo "simulado", invalidando la premisa del test. Corregido con `req.reply({ statusCode: 500, ... })` (stub real, la petición nunca sale del navegador) solo en el primer intento.
4. **[calidad, aceptado, no de este cambio]** Mismo artefacto de `gofmt`/CRLF ya documentado en revisiones anteriores no aplica aquí (cambio 100% frontend, sin ficheros Go tocados).

## Veredicto

**APPROVED**

El requirement modificado y el requirement nuevo de la spec `route-cloud-sync`, con sus 10 escenarios combinados (6 preexistentes sin cambios + 3 nuevos del disparador automático + 4 del indicador de progreso, uno compartido), están cubiertos por test — Vitest con TDD real en cada pieza nueva, Cypress E2E contra backend real verificando el flujo completo (grabar → guardar → subir sola → snackbar → aparece en el servidor), incluido el caso de fallo con reintento manual posterior. Tres bugs reales, los tres en el propio test E2E nuevo (nunca en la implementación de producto), se encontraron y corrigieron durante el cierre, con su causa documentada para no repetirlos. Separación de dominios (`cockpit` sin auth/nube) verificada y preservada. Sin problemas de seguridad, sin cambios de backend, sin normas del proyecto saltadas sin justificación.

**Suite completa (re-ejecutada de forma independiente antes de este veredicto)**: `tsc --noEmit` limpio, `eslint src/ --max-warnings 0` limpio, Vitest 1356/1356 (97.18% líneas, 90.31% branches), Cypress **94/94** contra backend real (suite completa, no solo lo nuevo).
