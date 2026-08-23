## Why

Hoy subir una ruta recién grabada a la nube es una acción completamente manual: el usuario tiene que abrir el detalle de la ruta y pulsar el icono "Subir a la nube" (`route-detail-cloud-upload.ts`) — la propia spec `route-cloud-sync` lo dice explícitamente ("una ruta que nunca se ha subido... sigue siendo puramente local hasta que el usuario decida subirla la primera vez"). Esto contrasta con el resto del flujo de sincronización, que ya es automático una vez la ruta está subida por primera vez (`autoResyncIfNeeded` re-sube sola al editar notas, favoritos o fotos). El usuario quiere ese mismo automatismo desde el principio — que la ruta se intente subir sola nada más guardarse — con feedback visible de que está en marcha, como al subir una historia de Instagram, sin tener que acordarse de pulsar nada ni quedarse a ciegas mientras dura la subida.

## What Changes

- Al terminar de grabar y guardar una ruta (`confirmSaveRecording`), si hay sesión activa, la app intenta subirla a la nube automáticamente — sin ninguna acción del usuario.
- Snackbar nuevo, persistente, en la parte superior de la app: aparece con "Subiendo ruta…" mientras dura la subida, cambia a "Ruta subida" al terminar con éxito (o a un mensaje de error si falla), y se autodescarta poco después — distinto del toast flotante existente (`shared/feedback/toast.ts`), que vive abajo y es efímero.
- Si la subida automática falla (sin conexión, error del servidor, límite de puntos), la ruta queda intacta en local (el guardado local es independiente y ya sucedió antes) y marcada como no sincronizada — **sin ningún reintento automático**. El botón manual "Subir a la nube" del detalle se mantiene sin cambios como vía de reintento o re-subida forzada.
- Sin sesión activa al terminar de grabar, no se intenta nada — mismo comportamiento que hoy (la acción de subir tampoco existe sin sesión).

## Capabilities

### New Capabilities
(ninguna)

### Modified Capabilities
- `route-cloud-sync`: el requirement "Subir una ruta local a la cuenta del usuario" gana un disparador automático (además del botón manual, que no desaparece) y un nuevo requirement sobre el feedback visible durante la subida (snackbar superior con progreso/éxito/error).

## Impact

- **Frontend, dominio `cockpit`**: `apps/mobile/src/cockpit/persist/cockpit-persist.service.ts::persistRouteOnStop` — al confirmar el guardado local con éxito, despacha un evento nuevo en el bus (`shared/app-events.ts`) con el id de la ruta recién guardada. El dominio `cockpit` sigue sin importar nada de auth/nube (misma separación de dominios ya existente) — solo anuncia el hecho, no orquesta la subida.
- **Frontend, orquestación**: `apps/mobile/src/app/app.element.ts` — único punto que ya tiene tanto `IRouteRepository` como `ISessionRepository` disponibles a la vez (mismo patrón que usa para wiring de vistas) — escucha el evento nuevo, comprueba sesión activa, y si la hay dispara la subida reutilizando `uploadRouteToCloud` (`apps/mobile/src/routes/detail/route-detail-cloud.service.ts`, ya existente, sin cambios de firma) y gestiona el snackbar nuevo.
- **Frontend, componente nuevo**: `apps/mobile/src/shared/feedback/` — snackbar de progreso de subida (nombre exacto a decidir en design.md), paralelo a `toast.ts` pero con estado mutable (progreso → éxito/error) en vez de un mensaje fijo que se autodescarta.
- **Sin cambios de backend**: `POST /api/routes` (upsert) ya soporta perfectamente que la primera subida llegue sola — no hay nada que cambiar en `apps/api`.
- **Sin cambios en el botón manual**: `route-detail-cloud-upload.ts`/`buildSyncIconButton` siguen igual, como vía de reintento tras un fallo automático o de re-subida forzada.
- **E2E nuevo**: `apps/mobile/cypress/e2e/routes/` — spec nuevo o ampliación de uno existente, verificando que grabar+guardar con sesión activa sube sola la ruta contra el backend real, con el snackbar visible durante el proceso.
