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