# Plan de Implementación: Grabación de Rutas (Cockpit)

## Resumen de Tareas

| # | Tarea | Archivos | AC Cubiertos | Complejidad |
|---|-------|----------|--------------|-------------|
| # | Tarea | Issue | Archivos | AC Cubiertos | Complejidad |
|---|-------|-------|----------|--------------|-------------|
| 1 | Estructura del dominio cockpit + types | [#1](https://github.com/GonzaloCarmenado/moto-routes/issues/1) | `src/cockpit/cockpit.types.ts` | AC-001, AC-002, AC-005 | Small |
| 2 | Transform de telemetría (cálculos y formateo) | [#2](https://github.com/GonzaloCarmenado/moto-routes/issues/2) | `src/cockpit/cockpit.transform.ts`, `src/cockpit/cockpit.transform.spec.ts` | AC-001, AC-005 | Small |
| 3 | Servicio GPS mockeable + estado de grabación | [#3](https://github.com/GonzaloCarmenado/moto-routes/issues/3) | `src/cockpit/cockpit.service.ts`, `src/cockpit/cockpit.service.spec.ts` | AC-003, AC-006, AC-007, AC-010 | Medium |
| 4 | Componente Cockpit: dial, botón START/STOP, grid telemetría | [#4](https://github.com/GonzaloCarmenado/moto-routes/issues/4) | `src/cockpit/cockpit.element.ts`, `src/cockpit/cockpit.element.css`, `src/cockpit/cockpit.element.spec.ts` | AC-001, AC-002, AC-004, AC-005, AC-008, AC-009 | Large |
| 5 | Long press en STOP + guardado de ruta | [#5](https://github.com/GonzaloCarmenado/moto-routes/issues/5) | `src/cockpit/cockpit.element.ts`, `src/cockpit/cockpit.service.ts`, `src/cockpit/cockpit.element.spec.ts` | AC-006, AC-007 | Medium |
| 6 | Manejo de permisos GPS + pérdida de señal | [#6](https://github.com/GonzaloCarmenado/moto-routes/issues/6) | `src/cockpit/cockpit.service.ts`, `src/cockpit/cockpit.element.ts`, `src/cockpit/cockpit.service.spec.ts` | AC-010 | Small |
| 7 | Botón Pausa/Reanudar manual | [#7](https://github.com/GonzaloCarmenado/moto-routes/issues/7) | `src/cockpit/cockpit.element.ts`, `src/cockpit/cockpit.service.ts`, `src/cockpit/cockpit.element.spec.ts` | AC-016, AC-019 | Medium |
| 8 | Algoritmo de detección automática de paradas | [#8](https://github.com/GonzaloCarmenado/moto-routes/issues/8) | `src/cockpit/cockpit.transform.ts`, `src/cockpit/cockpit.transform.spec.ts` | AC-017, AC-018, AC-019 | Medium |
| 9 | Modo Invisible (foreground service + notificación) | [#9](https://github.com/GonzaloCarmenado/moto-routes/issues/9) | `src-tauri/gen/android/.../MainActivity.kt`, `src-tauri/AndroidManifest.xml`, `src/cockpit/cockpit.element.ts` | AC-011, AC-012, AC-013, AC-014, AC-015 | Large |
| 10 | Integración Cockpit en app-root + main.ts | [#10](https://github.com/GonzaloCarmenado/moto-routes/issues/10) | `src/app/app.element.ts`, `src/main.ts` | AC-001, AC-002 | Small |
| 11 | Tests E2E con Cypress | [#11](https://github.com/GonzaloCarmenado/moto-routes/issues/11) | `cypress/e2e/cockpit/`, `cypress/fixtures/gps-data.json` | Todos | Medium |

---

## Paso 1: Estructura del dominio cockpit + types

- **Objetivo**: Crear la carpeta del dominio funcional `cockpit/` con los tipos compartidos.
- **AC cubiertos**: AC-001, AC-002, AC-005
- **Tests a escribir**: No aplica (solo tipos, no hay lógica que testear)
- **Archivos a crear**:
  - `CREAR src/cockpit/cockpit.types.ts`
- **Notas**:
  - Tipos: `RoutePoint`, `RouteMetadata`, `CockpitState`, `RecordingStatus`, `StopDetectionState`
  - `RecordingStatus`: `'idle' | 'recording' | 'paused'`
  - `StopDetectionState`: `'moving' | 'possible-stop' | 'confirmed-stop'`
  - `RoutePoint`: `{ timestamp: number, lat: number, lng: number, alt: number, speed: number }`
  - `RouteMetadata`: `{ date: string, duration: number, totalDistance: number, avgSpeed: number, stops: Stop[] }`
  - `Stop`: `{ startTime: number, endTime?: number, lat: number, lng: number, type: 'manual' | 'auto' }`

---

## Paso 2: Transform de telemetría

- **Objetivo**: Implementar funciones de cálculo y formateo de datos de telemetría (velocidad media, distancia entre puntos, tiempo formateado).
- **AC cubiertos**: AC-001, AC-005
- **Tests a escribir**:
  - Test: `calculateDistance` entre dos puntos GPS → Valida precisión cálculo
  - Test: `formatDuration` formatea segundos a "MM:SS" o "HH:MM:SS" → Valida AC-005
  - Test: `calculateAvgSpeed` con distancia y tiempo → Valida AC-005
  - Test: `formatSpeed` con valor en km/h → Valida AC-001
- **Archivos a crear**:
  - `CREAR src/cockpit/cockpit.transform.ts`
  - `CREAR src/cockpit/cockpit.transform.spec.ts`
- **Notas**:
  - Usar fórmula Haversine para distancia entre coordenadas GPS
  - El formateo debe ser funcional (sin efectos secundarios), fácil de testear

---

## Paso 3: Servicio GPS mockeable + estado de grabación

- **Objetivo**: Implementar servicio que maneje el estado de grabación, lecturas GPS y persistencia de rutas. Debe ser inyectable/testeable con un mock de GPS.
- **AC cubiertos**: AC-003, AC-006, AC-007, AC-010
- **Tests a escribir**:
  - Test: `startRecording` cambia estado a 'recording' y comienza a acumular puntos → Valida AC-003
  - Test: `stopRecording` cambia a 'idle' y devuelve la ruta completa → Valida AC-006, AC-007
  - Test: `addPoint` registra punto GPS y actualiza métricas → Valida AC-003
  - Test: `saveRoute` persiste ruta en almacenamiento local (mock de Tauri fs) → Valida AC-007
  - Test: `checkPermissions` detecta si hay permiso GPS → Valida AC-010
  - Test: `pauseRecording` / `resumeRecording` control de pausa → Valida AC-016
- **Archivos a crear**:
  - `CREAR src/cockpit/cockpit.service.ts`
  - `CREAR src/cockpit/cockpit.service.spec.ts`
- **Notas**:
  - El servicio no debe depender de Web Components ni del DOM. Solo lógica de datos.
  - Usar callback `onPoint(callback: (point: RoutePoint) => void)` para notificar al componente.
  - La persistencia usa `@tauri-apps/plugin-fs` (mockeable).
  - El GPS mock debe poder simular puntos con velocidad variable.

---

## Paso 4: Componente Cockpit (dial + botón + grid)

- **Objetivo**: Implementar el Web Component `<cockpit-view>` con el dial circular, botón maestro START/STOP, grid de telemetría y barra de estado REC. Aplicar design tokens.
- **AC cubiertos**: AC-001, AC-002, AC-004, AC-005, AC-008, AC-009
- **Tests a escribir**:
  - Test: componente renderiza dial con valor 0 en reposo → Valida AC-001
  - Test: componente renderiza botón "● START" en reposo → Valida AC-002
  - Test: al pulsar START, botón cambia a "STOP" con clase activa → Valida AC-002, AC-004
  - Test: barra de estado muestra REC durante grabación → Valida AC-008
  - Test: hitbox del botón es >= 56px → Valida AC-009
  - Test: grid telemetría muestra "--" en reposo y valores durante grabación → Valida AC-005
- **Archivos a crear/modificar**:
  - `CREAR src/cockpit/cockpit.element.ts`
  - `CREAR src/cockpit/cockpit.element.css`
  - `CREAR src/cockpit/cockpit.element.spec.ts`
- **Notas**:
  - Seguir `specs/ui/frontend-conventions.md`: CSS separado, importado con `?inline`
  - Usar `var(--token)` de `src/shared/styles/tokens.css`
  - Hitbox mínimo 56×56px con `min-width`/`min-height`
  - El dial usa el token `--color-text-max` para el valor y `--color-text-mid` para la unidad
  - El botón activo usa `--color-neon-go` y animación `pulse-recording`
  - El botón reposo usa borde `--color-bg-elevated`

---

## Paso 5: Long press en STOP + guardado de ruta

- **Objetivo**: Implementar la lógica de long press (1.5s) para detener la grabación de forma segura, con arco de progreso visual.
- **AC cubiertos**: AC-006, AC-007
- **Tests a escribir**:
  - Test: mantener pulsado STOP 1.5s detiene grabación y guarda ruta → Valida AC-006, AC-007
  - Test: soltar antes de 1.5s no detiene grabación → Valida AC-006
  - Test: arco de progreso visual aumenta con el tiempo de pulsación → Valida AC-006
- **Archivos a modificar**:
  - `MODIFICAR src/cockpit/cockpit.element.ts`
  - `MODIFICAR src/cockpit/cockpit.element.css`
  - `MODIFICAR src/cockpit/cockpit.service.ts`
- **Notas**:
  - Eventos `pointerdown`/`pointerup`/`pointerleave`
  - setTimeout de 1.5s para confirmar
  - Arco SVG circular que se va rellenando con `stroke-dasharray`/`stroke-dashoffset`
  - El arco usa `--color-neon-stop` (#ff3131)

---

## Paso 6: Manejo de permisos GPS + pérdida de señal

- **Objetivo**: Gestionar la solicitud de permisos de ubicación al pulsar START y manejar la pérdida de señal durante la grabación.
- **AC cubiertos**: AC-010
- **Tests a escribir**:
  - Test: sin permiso, al pulsar START muestra mensaje y botón "Abrir ajustes" → Valida AC-010
  - Test: pérdida de señal muestra "--" en velocidad → Valida AC-010
  - Test: tras 30s sin señal muestra alerta → Valida AC-010
- **Archivos a modificar**:
  - `MODIFICAR src/cockpit/cockpit.element.ts`
  - `MODIFICAR src/cockpit/cockpit.service.ts`
- **Notas**:
  - Usar `tauri-plugin-geolocation` para permisos en Android
  - Tauri 2 tiene `checkPermissions()` y `requestPermissions()` en el plugin
  - La alerta de 30s sin señal se gestiona desde el servicio con un contador

---

## Paso 7: Botón Pausa/Reanudar manual

- **Objetivo**: Añadir botón de pausa manual durante la grabación, que detiene el registro GPS sin finalizar la ruta.
- **AC cubiertos**: AC-016, AC-019
- **Tests a escribir**:
  - Test: botón pausa visible durante grabación → Valida AC-016
  - Test: al pausar, se registra parada manual con timestamp → Valida AC-016, AC-019
  - Test: al reanudar, se registra fin de parada → Valida AC-019
  - Test: pausa + 30s registra parada forzada → Valida AC-019
- **Archivos a modificar**:
  - `MODIFICAR src/cockpit/cockpit.element.ts`
  - `MODIFICAR src/cockpit/cockpit.element.css`
  - `MODIFICAR src/cockpit/cockpit.service.ts`
- **Notas**:
  - Icono ⏸/▶ con label "Pausa"/"Reanudar"
  - Hitbox 56×56px
  - La pausa no detiene el temporizador de telemetría (el tiempo sigue corriendo)

---

## Paso 8: Algoritmo de detección automática de paradas

- **Objetivo**: Implementar el algoritmo conservativo de detección de paradas (30 segundos a < 3 km/h).
- **AC cubiertos**: AC-017, AC-018, AC-019
- **Tests a escribir**:
  - Test: velocidad < 3km/h durante 10s → NO registra parada (semáforo) → Valida AC-017, AC-018
  - Test: velocidad < 3km/h durante 35s → registra parada → Valida AC-017, AC-018
  - Test: sin dato GPS no resetea contador → Valida AC-018
  - Test: parada confirmada + reanudación registra fin con duración → Valida AC-019
  - Test: semáforo corto (<30s) no genera parada fantasma → Valida AC-018
- **Archivos a crear/modificar**:
  - `MODIFICAR src/cockpit/cockpit.transform.ts`
  - `MODIFICAR src/cockpit/cockpit.transform.spec.ts`
  - `MODIFICAR src/cockpit/cockpit.service.ts`
- **Notas**:
  - El algoritmo se implementa como función pura en `cockpit.transform.ts` para testearlo aisladamente
  - El servicio llama a la función en cada tick de GPS (1s)
  - Estados: `moving` → `possible-stop` (contador < 30s) → `confirmed-stop` (contador >= 30s)

---

## Paso 9: Modo Invisible (foreground service + notificación)

- **Objetivo**: Implementar el toggle "Modo Invisible" que activa un foreground service de Android para grabación en segundo plano con notificación persistente.
- **AC cubiertos**: AC-011, AC-012, AC-013, AC-014, AC-015
- **Tests a escribir**:
  - Test: toggle invisible visible solo durante grabación → Valida AC-015
  - Test: al activar, se muestra notificación → Valida AC-013 (mock Tauri notification)
  - Test: notificación incluye botón "Volver" → Valida AC-013
  - Test: al desactivar, vuelve al cockpit con datos → Valida AC-014
- **Archivos a crear/modificar**:
  - `MODIFICAR src-tauri/gen/android/app/src/main/AndroidManifest.xml` (añadir foreground service)
  - `MODIFICAR src-tauri/gen/android/app/src/main/java/com/motoroutes/app/MainActivity.kt` (foreground service)
  - `CREAR src-tauri/gen/android/app/src/main/java/com/motoroutes/app/RecordingService.kt`
  - `MODIFICAR src/cockpit/cockpit.element.ts`
  - `MODIFICAR src/cockpit/cockpit.element.css`
  - Notas:
  - El foreground service es código nativo Android (Kotlin/Java)
  - El servicio debe ser iniciado desde Rust (Tauri) mediante un comando invoke
  - La notificación debe mostrar: icono app, "Moto Routes ● Grabando ruta...", botón "Volver"
  - Toggle con icono "ojo" o "incógnito", label "Modo Invisible"

---

## Paso 10: Integración Cockpit en app-root + main.ts

- **Objetivo**: Reemplazar el placeholder actual de `app-root` con el nuevo `<cockpit-view>` para que sea la pantalla principal.
- **AC cubiertos**: AC-001, AC-002
- **Tests a escribir**: No aplica (es integración, los tests unitarios ya cubren los componentes)
- **Archivos a modificar**:
  - `MODIFICAR src/app/app.element.ts` (reemplazar HTML del placeholder por `<cockpit-view>`)
  - `MODIFICAR src/main.ts` (importar cockpit-view)
- **Notas**:
  - El placeholder actual en `app.element.ts` se sustituye por `<cockpit-view></cockpit-view>`
  - Se elimina `app.element.css` si ya no se usa (los estilos van en cockpit.element.css)

---

## Paso 11: Tests E2E con Cypress

- **Objetivo**: Añadir tests E2E para validar los flujos completos de grabación de rutas en un navegador (con GPS mockeado).
- **AC cubiertos**: Todos
- **Tests a escribir**:
  - Test E2E: inicio reposo → dial 0, botón START → Valida AC-001, AC-002
  - Test E2E: iniciar grabación → botón STOP, REC visible → Valida AC-002, AC-004, AC-008
  - Test E2E: long press STOP → guarda ruta → Valida AC-006, AC-007
  - Test E2E: toggle modo invisible → notificación → Valida AC-011, AC-013
- **Archivos a crear**:
  - `CREAR cypress/e2e/cockpit/cockpit.cy.ts`
  - `CREAR cypress/e2e/cockpit/cockpit-navigation.cy.ts`
  - `CREAR cypress/fixtures/gps-data.json`
- **Notas**:
  - Seguir docs/07-cypress-e2e.md para convenciones
  - Añadir `data-cy="cockpit-start-btn"`, `data-cy="cockpit-stop-btn"` etc.
  - Mockear GPS con `cy.intercept` o similar
  - Tests autocontenidos y paralelizables

---

# Fase 2 (2026-07-28): AC-011 corregido, AC-020 a AC-024 — captura GPS nativa en el foreground service

## Contexto y arquitectura reutilizada (no se reinventa el puente Tauri↔Android)

El puente Rust↔Kotlin para arrancar/parar el foreground service **ya existe y funciona** (PR #47, ver cierre de AC-012/013 en `grabacion-rutas.review.md`):

- `src-tauri/src/recording_service.rs`: `RecordingServiceHandle<R>` envuelve un `PluginHandle<R>` obtenido vía `PluginApi::register_android_plugin("com.motoroutes.app", "RecordingServicePlugin")`, con métodos `start()`/`stop()` que llaman a `run_mobile_plugin::<()>("start"/"stop", ())`.
- `src-tauri/gen/android/.../RecordingServicePlugin.kt`: `@TauriPlugin` con comandos `start`/`stop` que delegan en `MainActivity.startRecordingService()`/`stopRecordingService()`.
- `src-tauri/gen/android/.../RecordingService.kt`: `Service` real que solo llama a `startForeground()` para mostrar la notificación — **no captura ubicación**. Ya declarado en `AndroidManifest.xml` con `android:foregroundServiceType="location"` y permisos `ACCESS_FINE_LOCATION`/`ACCESS_BACKGROUND_LOCATION`/`FOREGROUND_SERVICE_LOCATION` (verificado, sin cambios necesarios en el manifest).
- `src/cockpit/cockpit-foreground.service.ts`: `ForegroundServiceProvider` (`start()`/`stop()`) inyectado en `cockpit.service.ts`, invocado desde `startRecordingAction`/`prepareStopAction` vía `triggerForegroundService()`.
- `src/cockpit/cockpit.service.ts`: usa `createBrowserGpsProvider()` (envuelve `navigator.geolocation.watchPosition()`) como única fuente de puntos hoy — esto es lo que hay que dejar de usar.
- `src/cockpit/cockpit-persist.service.ts`: pipeline de persistencia (`persistRouteOnStart`/`persistRouteOnStop`) — **no requiere ningún cambio**, ya consume `CockpitState.points` sin que le importe de dónde vinieron.

Esta fase añade el sentido **inverso** (Kotlin → Rust → JS, continuo) usando el mecanismo idiomático de Tauri 2 para mobile plugins: `tauri::ipc::Channel`. Se verificó directamente en el código fuente de la versión ya fijada en `Cargo.lock` (`tauri = 2.11.5`, `C:\Users\<user>\.cargo\registry\src\index.crates.io-*\tauri-2.11.5\src\ipc\channel.rs` y `src\plugin\mobile.rs`, no se asume por documentación externa):

- `Channel::<T>::new(closure)` se **autorregistra** en un mapa interno (`CHANNELS`) usado por `run_mobile_plugin`, indexado por `channel.id()`.
- `Channel<T>` implementa `Serialize` como el string `"__CHANNEL__:<id>"` — se puede meter como campo de un struct que se pasa como `payload` a `run_mobile_plugin::<()>("start", StartArgs { channel })`.
- En Kotlin, un comando de plugin puede declarar un argumento de tipo `Channel` (del SDK Android de Tauri) que se deserializa a partir de ese mismo string; llamar a su método de envío en Kotlin dispara vía JNI la función `send_channel_data`, que busca el canal por id en `CHANNELS` y ejecuta el `closure` original que le pasamos a `Channel::new(...)` en Rust — ahí es donde emitimos el evento Tauri hacia JS con `app_handle.emit(...)`.

**Riesgo señalado explícitamente**: la firma exacta del lado Kotlin (`app.tauri.plugin.Channel`, si requiere anotar el argumento con `@InvokeArg`, y el nombre exacto del método para enviar datos — `send(...)` es lo esperado pero no se pudo verificar contra fuente local, a diferencia del lado Rust que sí se inspeccionó directamente) **no está confirmada por inspección de código en este repo** — la librería Android de Tauri es un `.aar` compilado, no hay fuente Kotlin del SDK vendida en el proyecto. Los pasos 16-17 deben verificarse por compilación real (Gradle) y build Android, no se puede dar por buena la firma solo por este plan.

## Resumen de Tareas — Fase 2

| # | Tarea | Archivos | AC Cubiertos | Complejidad |
|---|-------|----------|--------------|-------------|
| 12 | Fix de duplicación de watch en pausa/reanudación + extensión de `ForegroundServiceProvider` con pause/resume [x] | `cockpit.service.ts`, `cockpit-foreground.service.ts`, `shared/tauri/commands.ts` + specs | AC-020, AC-022 | Medium |
| 13 | `NativeGpsProvider`: `GpsProvider` que escucha el evento Tauri de ubicación [x] | `cockpit-native-gps.service.ts` + spec | AC-020, AC-021, AC-022 | Small |
| 14 | Wiring en `cockpit.element.ts`: seleccionar provider nativo en Android [x] | `cockpit.element.ts` + spec | AC-020 | Small |
| 15 | Puente Rust: `Channel` + emisión de evento + comandos pause/resume [x] | `recording_service.rs`, `commands/mod.rs`, `lib.rs` | AC-021 | Small (sin test unitario real) |
| 16 | `RecordingServicePlugin.kt`: recibir el canal, comandos pause/resume [x] | `RecordingServicePlugin.kt` | AC-021 | Small (sin test unitario real) |
| 17 | `RecordingService.kt`: captura real con `FusedLocationProviderClient` + fallback `LocationManager` [x] | `RecordingService.kt`, `build.gradle.kts` | AC-011 (corregido), AC-020, AC-023 | Medium (sin test unitario real) |
| 18 | Regresión completa + build Android [x] | (ninguno nuevo — ejecución de suite existente + `tauri android build`) | AC-011, AC-020, AC-021, AC-022, AC-023 | Small |
| 19 | Verificación manual prolongada en dispositivo real | (ninguno — prueba manual, no automatizable) | AC-024 | — |

---

## Paso 12: Fix de duplicación de watch en pausa/reanudación + pause/resume en `ForegroundServiceProvider` [x]

- **Objetivo**: Antes de introducir la fuente nativa, corregir un bug ya presente en el código actual: `resumeRecordingAction` llama a `loop.startWatch(...)` sin que `pauseRecordingAction` haya llamado antes a `loop.stopWatch()` — cada ciclo pausa/reanuda dejaba un watch de GPS colgado sin limpiar, duplicando `addPoint()` por cada punto tras la primera reanudación. Este bug amenaza directamente AC-022 ("no debe producirse... duplicación de puntos GPS") independientemente de si la fuente es `watchPosition()` o la nueva captura nativa, así que se corrige aquí, antes de cambiar de fuente. De paso, se añade la capacidad de pausar/reanudar la captura nativa en el propio Android (sin parar el foreground service ni la notificación — AC-016 ya implementado exige que la notificación siga viva durante la pausa).
- **AC cubiertos**: AC-020 (parte "se pausa"), AC-022
- **Tests a escribir (RED antes que GREEN)**:
  - Test: `pauseRecording()` durante `recording` invoca la función de limpieza devuelta por `gps.watchPosition(...)` (el mock de cleanup se llama exactamente 1 vez) → Valida AC-022
  - Test: tras `pauseRecording()` + `resumeRecording()`, `gps.watchPosition` se ha llamado exactamente 2 veces en total (1 al iniciar + 1 al reanudar) y solo hay 1 callback "vivo" recibiendo puntos (verificar que un punto emitido tras reanudar no se procesa dos veces en `state.points`) → Valida AC-022
  - Test: `pauseRecording()` llama a `foregroundService.pauseLocationUpdates()` exactamente 1 vez → Valida AC-020
  - Test: `resumeRecording()` llama a `foregroundService.resumeLocationUpdates()` exactamente 1 vez → Valida AC-020
  - Test: `pauseRecording()`/`resumeRecording()` sin `foregroundService` inyectado no lanzan (backwards-compat, mismo patrón que `triggerForegroundService`) → Valida robustez
  - Test (commands.ts): `pauseRecordingLocation()`/`resumeRecordingLocation()` invocan `invoke('pause_recording_location'/'resume_recording_location')` y absorben el error si el comando no existe (web/desktop) → Valida que el wrapper sigue el mismo patrón que `startForegroundService`/`stopForegroundService`
- **Archivos a crear/modificar**:
  - `MODIFICAR src/cockpit/cockpit.service.ts` (`pauseRecordingAction` añade `loop.stopWatch()` + `triggerLocationPause(foregroundService, true)`; `resumeRecordingAction` añade `triggerLocationPause(foregroundService, false)` antes de `loop.startWatch(...)`)
  - `MODIFICAR src/cockpit/cockpit.service.spec.ts` (actualizar `createMockForegroundService()` con `pauseLocationUpdates`/`resumeLocationUpdates`, añadir los tests de arriba)
  - `MODIFICAR src/cockpit/cockpit-foreground.service.ts` (`ForegroundServiceProvider` gana `pauseLocationUpdates(): Promise<void>` y `resumeLocationUpdates(): Promise<void>`; nueva función `triggerLocationPause(provider, paused)` con el mismo patrón fire-and-forget que `triggerForegroundService`)
  - `CREAR src/cockpit/cockpit-foreground.service.spec.ts` (no existía spec dedicado; cubrir `triggerForegroundService` y `triggerLocationPause` con un provider mock, y `createTauriForegroundServiceProvider()` mockeando `../shared/tauri/commands.js`)
  - `MODIFICAR src/shared/tauri/commands.ts` (`pauseRecordingLocation()`/`resumeRecordingLocation()`, mismo patrón try/catch que `startForegroundService`/`stopForegroundService`, invocando comandos Tauri nuevos `pause_recording_location`/`resume_recording_location` — implementados en Rust en el Paso 15; hasta entonces el wrapper simplemente absorbe el rechazo, igual que hoy hace para cualquier plataforma sin el plugin)
  - `CREAR src/shared/tauri/commands.spec.ts` (no existía; mockear `@tauri-apps/api/core`'s `invoke` con `vi.mock`)
- **Notas**:
  - Este paso es puramente TS y no depende de que exista todavía ningún código Rust/Kotlin nuevo — los wrappers ya están diseñados para no romper nada si el comando no existe aún (mismo patrón que el resto de `commands.ts`).
  - Documentar en un comentario en `cockpit.service.ts` que el pause/resume de watch ya NO es "comportamiento preexistente intencional" (como decía el comentario viejo) sino que se corrige aquí — actualizar ese comentario en vez de dejarlo contradictorio con el nuevo código.

---

## Paso 13: `NativeGpsProvider` — `GpsProvider` que escucha el evento Tauri de ubicación [x]

- **Objetivo**: Implementar un `GpsProvider` (misma interfaz existente, sin tocar su forma) cuya fuente de `watchPosition()` sea el evento Tauri `recording-service://location` en vez de `navigator.geolocation.watchPosition()`, con fallback explícito a un `GpsProvider` de navegador para `getCurrentPosition`/`checkPermissions`/`requestPermissions` (esas operaciones son one-shot y no tienen el problema de segundo plano, no hace falta nativizarlas) y para el propio `watchPosition()` cuando no se está en un WebView Android real.
- **AC cubiertos**: AC-020, AC-021, AC-022
- **Tests a escribir**:
  - Test: `watchPosition(callback)` se suscribe a `listen('recording-service://location', ...)` (mockear `@tauri-apps/api/event`) y, al recibir un payload `{ lat, lng, alt, speed, timestamp }`, invoca `callback` con un objeto compatible con `GeolocationPosition` cuyos `coords.latitude/longitude/altitude/speed` y `timestamp` coinciden con el payload (speed se propaga tal cual, en m/s — la conversión a km/h ya la hace `createRecordingLoop.startWatch()`, no debe convertirse dos veces) → Valida AC-021
  - Test: la función de limpieza devuelta por `watchPosition()` llama a `unlisten()` (la promesa que devuelve `listen(...)`) → Valida AC-020 (permite que `loop.stopWatch()` corte la escucha al pausar/parar)
  - Test: `getCurrentPosition()`, `checkPermissions()`, `requestPermissions()` delegan exactamente en las funciones equivalentes de un `GpsProvider` de fallback inyectado (mock) → Valida que no hay regresión en AC-010
  - Test: `isAndroidTauri()` devuelve `true` solo si `isTauri()` es `true` y `navigator.userAgent` contiene "Android" (mockear `navigator.userAgent` y el helper `isTauri`) → Valida el criterio de selección de plataforma usado en el Paso 14
- **Archivos a crear**:
  - `CREAR src/cockpit/cockpit-native-gps.service.ts`
  - `CREAR src/cockpit/cockpit-native-gps.service.spec.ts`
- **Notas**:
  - No se añade ninguna dependencia npm nueva: la detección de plataforma se hace con `isTauri()` (ya existe en `src/shared/services/photo-capture-adapter.service.ts`) combinado con un sniff de `navigator.userAgent` — se descarta usar `@tauri-apps/plugin-os` (`platform()`) porque no es una dependencia instalada hoy y añadirla requiere confirmación explícita del usuario (regla de `frontend-conventions.md` §10.3); no se pide en este plan, se señala como alternativa futura si el sniff de user-agent resulta frágil.
  - El tipo del payload del evento (`NativeLocationEvent`: `{ lat, lng, alt, speed, timestamp }`) se define localmente en este archivo, **distinto** de `RoutePoint` de `cockpit.types.ts` — `RoutePoint.speed` ya está en km/h (post-conversión) en el resto del dominio, mientras que el payload que cruza el puente Kotlin→Rust→JS lleva `speed` crudo en m/s (igual que `Location.speed` de Android y que `GeolocationCoordinates.speed` del navegador). Reutilizar `RoutePoint` para el wire format sería confuso y probablemente introduciría un bug de doble conversión.
  - El objeto `GeolocationPosition`-like que fabrica el adaptador solo necesita rellenar los campos que `createRecordingLoop.startWatch()` lee de verdad (`timestamp`, `coords.latitude/longitude/altitude/speed`); el resto de campos de `GeolocationCoordinates` (accuracy, altitudeAccuracy, heading) se rellenan con valores por defecto seguros (0/null). Si `tsc` exige métodos adicionales del tipo `GeolocationPosition` (p.ej. `toJSON`), resolver con un cast explícito documentado, no con `any`.

---

## Paso 14: Wiring en `cockpit.element.ts` — seleccionar el provider nativo en Android [x]

- **Objetivo**: Sustituir el uso incondicional de `createBrowserGpsProvider()` en `initService()` por una selección explícita entre `createNativeGpsProvider()` (Android+Tauri) y `createBrowserGpsProvider()` (resto), sin tocar el resto del flujo de `cockpit.service.ts` (blast radius mínimo: `CockpitService`/`createCockpitService` no cambian su firma).
- **AC cubiertos**: AC-020
- **Tests a escribir**:
  - Test: extraer la selección a una función pura testeable, p.ej. `selectGpsProvider(isAndroid: boolean, native: GpsProvider, browser: GpsProvider): GpsProvider`, y testear que devuelve `native` cuando `isAndroid` es `true` y `browser` en caso contrario → Valida AC-020 sin necesidad de montar el Web Component completo
  - Test: `cockpit.element.spec.ts` — con `isAndroidTauri()` mockeado a `true`, `initService()` termina construyendo el servicio con el provider nativo (se puede verificar indirectamente comprobando que se suscribió al evento Tauri en vez de a `navigator.geolocation.watchPosition`, o exponiendo un seam de test ya existente en el patrón del archivo) → Valida AC-020
  - Test: con `isAndroidTauri()` en `false` (entorno web/desktop), sigue usándose el provider de navegador (sin regresión) → Valida compatibilidad
- **Archivos a modificar**:
  - `MODIFICAR src/cockpit/cockpit.element.ts` (`initService()` usa `selectGpsProvider(isAndroidTauri(), createNativeGpsProvider(), createBrowserGpsProvider())`)
  - `MODIFICAR src/cockpit/cockpit.element.spec.ts`
- **Notas**:
  - `selectGpsProvider` puede vivir en `cockpit-native-gps.service.ts` (ya exporta `isAndroidTauri`) para no crear un archivo nuevo solo para una función de 3 líneas.
  - No se toca `cockpit-persist.service.ts` en ningún paso de esta fase — el pipeline de persistencia sigue recibiendo `CockpitState.points` exactamente igual, solo cambia de dónde vienen esos puntos.

---

## Paso 15: Puente Rust — `Channel`, emisión de evento y comandos pause/resume [x]

- **Objetivo**: Extender `recording_service.rs` para que `start()` construya un `tauri::ipc::Channel` que reemite cada punto recibido como evento Tauri (`recording-service://location`), y añadir `pause()`/`resume()` sin canal (solo señalizan al plugin Android que pause/reanude la captura, sin tocar la notificación).
- **AC cubiertos**: AC-021
- **Tests**: no aplica test unitario real — `recording_service.rs` no tiene tests hoy (código `#[cfg(target_os = "android")]` no ejecutable en el runner de CI de escritorio) y este proyecto no tiene harness de JNI. Verificación: `cargo build`, `cargo clippy -- -D warnings`, `cargo fmt --check` deben pasar en cualquier plataforma (el código nuevo debe compilar también en la rama no-Android, aunque sea no-op); la verificación real ocurre en el Paso 18 (build Android) y Paso 19 (dispositivo real).
- **Archivos a modificar**:
  - `MODIFICAR src-tauri/src/recording_service.rs`:
    - Nuevo struct `LocationPoint { lat: f64, lng: f64, alt: f64, speed: f64, timestamp: i64 }` con `#[derive(Serialize, Deserialize, Clone)]` (nombres de campo idénticos al `NativeLocationEvent` de TS — sin `rename_all`, ya coinciden).
    - `RecordingServiceHandle<R>` pasa a guardar también el `AppHandle<R>` recibido en `setup()` (hoy solo guarda el `PluginHandle<R>`), para poder emitir eventos desde `start()`.
    - `start()` construye `let channel = tauri::ipc::Channel::<serde_json::Value>::new(move |body| { ...deserializar a LocationPoint y app.emit("recording-service://location", point)... Ok(()) })` y lo pasa como `run_mobile_plugin::<()>("start", StartArgs { channel })` (nuevo struct `#[derive(Serialize)] struct StartArgs { channel: Channel<serde_json::Value> }`).
    - Nuevos métodos `pause()`/`resume()` → `run_mobile_plugin::<()>("pause"/"resume", ())`.
    - Requiere `use tauri::Emitter;` para que `.emit()` esté disponible en `AppHandle`.
  - `MODIFICAR src-tauri/src/commands/mod.rs`: nuevos comandos `pause_recording_location`/`resume_recording_location`, mismo patrón que `start_foreground_service`/`stop_foreground_service` (no-op fuera de Android vía `try_state`).
  - `MODIFICAR src-tauri/src/lib.rs`: registrar los 2 comandos nuevos en `invoke_handler`.
- **Notas**:
  - Verificado por inspección directa de `tauri-2.11.5` (ver sección de contexto arriba) que `Channel::new(closure)` se autorregistra para `run_mobile_plugin`, así que no hace falta ningún paso adicional de registro manual en Rust.
  - Si `serde_json::from_str::<LocationPoint>` falla (payload inesperado de Kotlin), ignorar el punto silenciosamente (no debe poder tirar el proceso) — mismo criterio defensivo que el resto del puente (`.map_err(|e| e.to_string())`).

---

## Paso 16: `RecordingServicePlugin.kt` — recibir el canal, comandos pause/resume [x]

- **Objetivo**: Actualizar el plugin Kotlin para aceptar el nuevo argumento `channel` en `start`, guardarlo donde `RecordingService` pueda leerlo, y añadir los comandos `pause`/`resume` que reenvían la orden al servicio en ejecución.
- **AC cubiertos**: AC-021
- **Tests**: no aplica (sin harness de test Kotlin/JNI en este proyecto). Verificación: compilación Gradle en el Paso 18.
- **Archivos a modificar**:
  - `MODIFICAR src-tauri/gen/android/app/src/main/java/com/motoroutes/app/RecordingServicePlugin.kt`:
    - Nueva clase de argumentos para `start` con un campo `channel` (verificar en la compilación real si el SDK de Tauri Android requiere anotar la clase con `@InvokeArg`, y el tipo exacto — `app.tauri.plugin.Channel` es la hipótesis de partida).
    - `start(invoke)` parsea los argumentos, guarda la referencia al canal en un sitio accesible desde `RecordingService` (p.ej. `companion object` de `RecordingServicePlugin` o del propio `RecordingService`), y sigue llamando a `MainActivity.startRecordingService()`.
    - `stop(invoke)` limpia la referencia al canal antes de parar el servicio.
    - Nuevos comandos `pause(invoke)`/`resume(invoke)` que llaman a nuevos métodos de `MainActivity` (`pauseRecordingLocationUpdates()`/`resumeRecordingLocationUpdates()`).
  - `MODIFICAR src-tauri/gen/android/app/src/main/java/com/motoroutes/app/MainActivity.kt`: nuevos métodos `pauseRecordingLocationUpdates()`/`resumeRecordingLocationUpdates()` que envían un `Intent` a `RecordingService` con una nueva `action` (`ACTION_PAUSE`/`ACTION_RESUME`), mismo patrón ya usado para `ACTION_STOP`.
- **Notas**:
  - Riesgo señalado en la sección de contexto: la firma exacta de `Channel` en Kotlin no está verificada por fuente local. Si el nombre del método de envío o la forma de declarar el argumento difieren de lo asumido aquí, ajustar en este mismo paso sin bloquear — es un detalle de implementación, no de diseño.
  - **Riesgo resuelto (2026-07-28)**: se localizó el fuente Kotlin real de `tauri-android` vendido dentro del crate `tauri = "2.11.5"` en el cargo registry local (`~/.cargo/registry/src/.../tauri-2.11.5/mobile/android/src/main/java/app/tauri/plugin/Channel.kt` y `Plugin.kt`), no solo la especificación en `.aar` compilado. Confirma exactamente la hipótesis: `class Channel(val id: Long, ...) { fun send(data: JSObject); fun sendObject(data: Any) }`, y el patrón de argumento es `@InvokeArg class XArgs { lateinit var channel: Channel }` + `invoke.parseArgs(XArgs::class.java)` (mismo patrón que `RegisterListenerArgs` en `Plugin.kt` del propio SDK). Implementado tal cual; `pnpm tauri android build` compiló sin errores a la primera, sin necesitar ninguna iteración sobre la firma.

---

## Paso 17: `RecordingService.kt` — captura real con `FusedLocationProviderClient` + fallback `LocationManager` [x]

- **Objetivo**: Hacer que el foreground service capture ubicación de verdad, con intervalo objetivo de 1 segundo, y la reenvíe al canal guardado por el plugin. Maneja `ACTION_PAUSE`/`ACTION_RESUME` deteniendo/reanudando solo la captura (la notificación y el propio `Service` siguen vivos).
- **AC cubiertos**: AC-011 (corregido), AC-020, AC-023
- **Tests**: no aplica test unitario real — mismo motivo que Pasos 15-16 (sin harness Android/JNI en este proyecto; incluso con Robolectric no se probaría el comportamiento real de `FusedLocationProviderClient` con pantalla bloqueada). Verificación: `cargo build`/Gradle (compilación, Paso 18) + prueba manual prolongada en dispositivo real (Paso 19) — el mismo criterio que ya se aplicó al cerrar AC-012/AC-013 en la Fase 1 (ver `grabacion-rutas.review.md`).
- **Archivos a modificar**:
  - `MODIFICAR src-tauri/gen/android/app/src/main/java/com/motoroutes/app/RecordingService.kt`:
    - En `onCreate()` o al primer `onStartCommand()` sin `ACTION_STOP`: comprobar disponibilidad de Play Services vía `GoogleApiAvailability.getInstance().isGooglePlayServicesAvailable(this)`; si `== ConnectionResult.SUCCESS`, usar `FusedLocationProviderClient` (`LocationServices.getFusedLocationProviderClient(this)`) con `LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 1000L).build()` y un `LocationCallback`; si no, usar `LocationManager.requestLocationUpdates(LocationManager.GPS_PROVIDER, 1000L, 0f, listener)` (AC-023).
    - Cada `Location` recibida se envía al canal guardado por el plugin (si es no nulo) como `{ lat: location.latitude, lng: location.longitude, alt: location.altitude, speed: location.speed, timestamp: location.time }`.
    - Nuevas ramas en `onStartCommand()` para `ACTION_PAUSE` (deregistrar el listener/callback de ubicación activo, sin llamar a `stopForeground`/`stopSelf`) y `ACTION_RESUME` (volver a registrar).
    - `ACTION_STOP` (ya existente) debe además deregistrar el listener de ubicación activo antes de `stopForeground`/`stopSelf`, para no dejar un callback húerfano.
  - `MODIFICAR src-tauri/gen/android/app/build.gradle.kts`: añadir `implementation("com.google.android.gms:play-services-location:21.3.0")` (o la versión estable vigente en el momento de implementar).
- **Notas**:
  - `AndroidManifest.xml` **no requiere cambios** — ya declara `android:foregroundServiceType="location"` en el `<service>` y los permisos `ACCESS_FINE_LOCATION`/`ACCESS_COARSE_LOCATION`/`ACCESS_BACKGROUND_LOCATION`/`FOREGROUND_SERVICE_LOCATION` desde el fix de PR #47 (verificado por lectura directa del manifest en este plan).
  - Este es el paso de mayor riesgo técnico de toda la fase: nueva dependencia externa (Play Services Location), dos rutas de captura (Fused vs LocationManager) y gestión de ciclo de vida (pause/resume/stop) dentro de un `Service` no vinculado (`onBind` devuelve `null`). Cualquier fuga de `LocationCallback`/`LocationListener` sin deregistrar en `onDestroy()` debe evitarse explícitamente (añadir limpieza también en `onDestroy()` como red de seguridad, no solo en `ACTION_STOP`).

---

## Paso 18: Regresión completa + build Android [x]

**Estado (2026-07-28)**: 457/457 tests TS pasan (49 nuevos: 8 en `commands.spec.ts`, 12 en `cockpit-foreground.service.spec.ts`, 5 en `cockpit.service.spec.ts`, 10 en `cockpit-native-gps.service.spec.ts`, 2 en `cockpit.element.spec.ts`, más ajustes al mock existente), cobertura global 94.81% líneas / 89.53% ramas / 93.7% funciones (≥80% en todas las métricas). `tsc --noEmit` y `eslint src/` sin errores. `cargo build`, `cargo clippy -- -D warnings`, `cargo fmt --check` y `cargo test` sin errores/warnings en `src-tauri/`. `pnpm tauri android build --target aarch64 --debug` compiló sin errores **a la primera** (la firma de `Channel`/`@InvokeArg` en Kotlin se verificó por inspección directa del código fuente de `tauri-android` vendido dentro del crate `tauri-2.11.5` en el cargo registry local, no solo por hipótesis — ver Notas del Paso 16) e instalado con `adb install -r` en el dispositivo conectado. **Pendiente el Paso 19** (verificación manual prolongada en trayecto real con pantalla bloqueada) antes de dar AC-011/AC-020 a AC-023 por definitivamente cerrados.

- **Objetivo**: Confirmar que toda la suite existente sigue en verde tras los cambios de los Pasos 12-17, y que el proyecto compila de extremo a extremo (TS + Rust + Android).
- **AC cubiertos**: AC-011, AC-020, AC-021, AC-022, AC-023 (cierre por compilación/regresión; la verificación funcional real es el Paso 19)
- **Tests**: no se escriben tests nuevos en este paso — se ejecuta la suite completa (`pnpm test:coverage`, `pnpm lint`, `pnpm rust:test`, `pnpm rust:lint`, `pnpm rust:format`) y se confirma 100% pass rate + cobertura ≥80%.
- **Archivos**: ninguno nuevo.
- **Notas**:
  - `pnpm tauri android build --target aarch64 --debug` debe compilar sin error — si la firma de `Channel` en Kotlin (Paso 16) estuviera mal, Gradle fallaría aquí, no antes (mismo criterio ya usado para verificar el puente start/stop en la Fase 1).
  - Instalar en dispositivo (`adb install -r ...`) como paso previo obligatorio al Paso 19.

---

## Paso 19: Verificación manual prolongada en dispositivo real (AC-024) — no automatizable

- **Objetivo**: Confirmar en un trayecto real, con la pantalla bloqueada la mayor parte del tiempo, que `route_points` recibe puntos distribuidos a lo largo de toda la duración de la ruta (no un único punto con el timestamp de inicio, que es el bug documentado en la spec del 2026-07-28).
- **AC cubiertos**: AC-024 (y confirmación funcional final de AC-011, AC-020, AC-021, AC-022, AC-023)
- **Tests**: **no automatizable** — ningún test unitario ni E2E de Cypress puede reproducir de forma fiable "Chromium/Android suspende el WebView en segundo plano con la pantalla bloqueada durante varios minutos". Se documenta aquí en vez de inventar un test que no probaría nada real, siguiendo el mismo criterio que ya dejó registrado `grabacion-rutas.review.md` para el cierre de AC-012/AC-013.
- **Procedimiento**:
  1. Grabar una ruta real de varios minutos (no segundos) con la pantalla bloqueada la mayor parte del trayecto.
  2. Verificar en la BBDD del dispositivo (`adb shell run-as com.motoroutes.app`, o exportar y abrir el `.db`) que `route_points` tiene múltiples filas con `timestamp` distribuidos a lo largo de la duración real de la ruta, no un único punto igual al inicio.
  3. Repetir, si es posible, en un dispositivo o entorno sin Google Play Services disponible (o con él deshabilitado) para verificar el fallback a `LocationManager` (AC-023) — si no hay un dispositivo así disponible, documentarlo como limitación de la verificación, no darlo por probado.
  4. Actualizar `memory/context.md` con el resultado **solo** tras esta verificación prolongada — no dar el fix por bueno con una prueba corta, que es exactamente el error ya cometido una vez con este mismo bug (ver Notas de Implementación de la spec).
- **Notas**: Este paso cierra el ciclo SDD de esta fase — hasta que no se complete y documente, AC-011/AC-020 a AC-024 no deben marcarse como `[x]` en `specs/features/grabacion-rutas.md`.