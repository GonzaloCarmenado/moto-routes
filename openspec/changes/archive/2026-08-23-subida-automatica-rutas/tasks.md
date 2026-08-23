## 1. Evento de guardado y desacoplo del dominio cockpit

- [x] 1.1 `ROUTE_SAVED` nuevo en `shared/app-events.ts` (`detail: { routeId: string }`), mismo patrón que `AUTH_LOGGED_IN`.
- [x] 1.2 Test rojo + implementación: `persistRouteOnStop` despacha `ROUTE_SAVED` solo cuando `repository.save(...)` resuelve con éxito — nunca si falla, nunca desde `persistRouteOnStart`.

## 2. Componente de feedback (snackbar de subida)

- [x] 2.1 Test rojo + implementación: `shared/feedback/route-upload-snackbar.ts` — `showRouteUploadSnackbar()` monta el indicador con "Subiendo ruta…" y devuelve `{ succeed(), fail(message) }`.
- [x] 2.2 Test rojo + implementación: `succeed()` cambia el texto a "Ruta subida" y autodescarta pasado un tiempo; `fail(message)` cambia a estado de error con el mensaje y autodescarta igual.
- [x] 2.3 Estilos en `shared/styles/overlays.css` (mismo fichero que `.photo-toast`, ya cargado globalmente vía `index.css`) con tokens de `shared/styles/tokens.css`, `position: fixed` arriba, `z-index` consistente con `.photo-toast`, modo oscuro (colores por token, sin hardcodear).
- [x] 2.4 `data-cy="route-upload-snackbar"` en el propio fichero al crear el elemento.

## 3. Orquestación en app.element.ts

- [x] 3.1 Test rojo + implementación: `app.element.ts` escucha `ROUTE_SAVED`, resuelve sesión activa vía `sessionRepo.get()`; sin sesión, no hace nada (ni snackbar ni llamada de red). Implementado directamente en `app-route-upload.ts` (ver 3.3) — `app.element.ts` no tiene tests unitarios propios (sin precedente en el dominio, solo Cypress), así que la lógica testeable se extrajo desde el principio en vez de escribirla primero inline.
- [x] 3.2 Test rojo + implementación: con sesión activa, carga la ruta con `repository.getById(routeId)`, muestra el snackbar, llama a `uploadRouteToCloud` y lo resuelve a `succeed()`/`fail()` según el resultado.
- [x] 3.3 Extraído desde el principio a `app-route-upload.ts` (sin sufijo `.element`, con JSDoc explicando el porqué) — no por haber superado el límite de líneas (`app.element.ts` seguía bajo el límite), sino porque `app.element.ts` no tiene ningún test unitario propio en este dominio y la lógica de decisión (sesión→snackbar→subida) sí necesitaba TDD real.

## 4. Verificación manual y regresión

- [x] 4.1 Confirmado con test que descartar una ruta grabada (`discardStopAction`) nunca dispara `ROUTE_SAVED` ni ninguna subida (`cockpit.service.spec.ts`, garantía estructural: `discardStopAction` nunca llama a `persistRouteOnStop`).
- [x] 4.2 Confirmado que el botón manual "Subir a la nube" del detalle sigue funcionando sin cambios — `route-detail-cloud-upload.spec.ts` (4/4) en verde sin tocarlo.

## 5. E2E (Cypress, backend real)

- [x] 5.1 Grabar y guardar una ruta con sesión activa sube sola la ruta contra el backend real — verificado con `GET /api/routes` (polling real, mismo patrón que `expectSyncedField` de `route-cloud-sync.cy.ts`) que la ruta existe en el servidor sin haber pulsado ningún botón de subida.
- [x] 5.2 El snackbar de progreso es visible durante la subida y cambia a "subida" al terminar — con `res.setDelay(1200)` en el intercept (respuesta real, no mockeada, solo retrasada) para poder observar el estado "en progreso" de forma fiable antes de que resuelva.
- [x] 5.3 Sin sesión activa, grabar y guardar una ruta no dispara ninguna petición de subida (`cy.intercept` sin llamadas) ni muestra el snackbar.
- [x] 5.4 Un fallo de la subida automática deja la ruta en local como no sincronizada, sin reintento — el botón manual del detalle la sube después con normalidad. **Dos bugs reales encontrados escribiendo este test, no en la implementación**: (1) dos `cy.intercept()` apilados para la misma ruta no se sustituyen — la petición del reintento seguía cayendo en el interceptor antiguo; (2) `req.destroy()` deja que la petición se procese en el servidor real aunque el cliente nunca reciba la respuesta (el botón mostraba "sincronizada" pese al fallo simulado). Arreglado con un único interceptor con estado y `req.reply({ statusCode: 500 })` (stub real, nunca llega al backend) para la primera petición.

## 6. Cierre

- [x] 6.1 Suite completa en verde: `tsc --noEmit`, `eslint src/ --max-warnings 0`, Vitest 1356/1356 (97.18% líneas, 90.31% branches), Cypress **94/94** (suite completa, no solo lo nuevo) contra backend real (`docker compose up` en `infra/docker/` — sin cambios de backend en este cambio, imagen `api` sin reconstruir).
- [x] 6.2 `openspec sync` del delta de `route-cloud-sync` a `openspec/specs/` (requirement modificado + requirement nuevo de feedback), `openspec validate --all --strict` sin errores (28/28).
- [x] 6.3 Revisar el diff completo buscando secretos antes de abrir la PR — sin hallazgos (solo el `TEST_PASSWORD` placeholder ya usado en el resto de la suite de Cypress; cambio 100% frontend, sin tocar `apps/api`).
- [x] 6.4 Actualizado `memory/context.md` (sesión, estado actual, próximo hito, gotchas de Cypress). Sin ADR nueva — las decisiones de `design.md` reutilizan el patrón ya establecido (bus de eventos, extracción por testabilidad), y los tres bugs reales encontrados son gotchas de la herramienta Cypress, no decisiones de arquitectura del producto.
- [x] 6.5 `review.md` con veredicto **APPROVED** (independiente, tres bugs reales de test encontrados y corregidos antes de archivar), `/opsx:archive` hecho (`openspec/changes/archive/2026-08-23-subida-automatica-rutas/`), pendiente commit, push y PR de `feature/subida-automatica-rutas` a `master` — nunca directo, per `CLAUDE.md`.
