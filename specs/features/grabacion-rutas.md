# Feature: Grabación de Rutas (Cockpit)

## Descripción
El Cockpit es la pantalla principal de la aplicación, visible al abrirla. Permite al motorista iniciar y detener la grabación de una ruta GPS, mostrando telemetría en tiempo real (velocidad, distancia, tiempo, altitud). Diseño "Asfalto Nocturno": cuero oscuro, ámbar como único acento vivo, tipografía signalética. Nada de HUDs, neón ni glassmorphism.

## Criterios de Aceptación
- [x] AC-001: La pantalla principal debe mostrar la velocidad actual en km/h, en reposo 0.
- [x] AC-002: Debe existir un botón maestro circular que muestre icono de grabación en reposo y icono de stop durante grabación.
- [x] AC-003: Al pulsar START, debe comenzar la grabación de la ruta: lecturas GPS cada 1 segundo.
- [x] AC-004: Durante la grabación, el botón maestro debe cambiar a estado stop y aparecer un chip con texto "En ruta".
- [x] AC-005: Durante la grabación, el grid de telemetría debe mostrar: distancia total, tiempo transcurrido, altitud actual y velocidad media.
- [x] AC-006: Para detener la grabación, el usuario debe mantener pulsado STOP durante 1.5 segundos (long press con arco SVG de progreso).
- [x] AC-007: Al detener la grabación se devuelve metadata de la ruta.
- [x] AC-008: El chip superior debe ser neutral ("Listo") en reposo, verde/ámbar ("En ruta") grabando, y ámbar tenue ("Pausada") en pausa.
- [x] AC-009: Todos los elementos interactivos deben tener un hitbox mínimo de 56×56px (para uso con guantes).
- [x] AC-010: Si no hay permiso de GPS, debe mostrar un overlay con mensaje y botón para solicitar permiso.
- [ ] AC-011: La grabación debe continuar registrando puntos GPS de forma real en segundo plano, sin necesidad de ningún toggle: al iniciar una ruta se arranca el foreground service Android (notificación persistente), y ese propio servicio (no el WebView) debe capturar la ubicación de forma nativa mientras la grabación esté activa, aunque el usuario bloquee la pantalla o use otras apps. Un foreground service que solo mantiene viva la notificación, sin captura nativa de ubicación, **no cumple** este criterio — `navigator.geolocation.watchPosition()` ejecutándose en el WebView no es una fuente fiable de puntos con la pantalla bloqueada (Chromium puede pausar/limitar el WebView en segundo plano aunque el proceso siga vivo).
- [x] AC-016: Durante la grabación existe un botón "Pausa" para detener/reanudar sin detener la ruta.
- [ ] AC-017: La app debe detectar paradas automáticas cuando el vehículo está quieto durante un tiempo mínimo.
- [ ] AC-018: La detección de parada debe ser conservative: mejor tardar hasta 30 segundos en confirmar una parada que generar falsos positivos.
- [ ] AC-019: Las paradas detectadas deben quedar registradas en la ruta con timestamp, duración y coordenadas.
- [ ] AC-020: El foreground service Android debe ser la **única** fuente de puntos GPS durante toda la grabación, desde el START hasta el STOP — no solo en segundo plano. Debe iniciar su propia captura de ubicación nativa (vía `FusedLocationProviderClient`, con intervalo objetivo de 1 segundo, análogo al usado hoy por `watchPosition()`) en el mismo instante en que arranca la grabación (AC-003), y debe detener esa captura nativa en el mismo instante en que la grabación se detiene (AC-006) o se pausa (AC-016). `navigator.geolocation.watchPosition()` deja de usarse como fuente de puntos de ruta en todo momento (foreground incluido); no hay conmutación entre dos fuentes durante una misma grabación.
- [ ] AC-021: Cada ubicación capturada de forma nativa por el foreground service debe emitirse de vuelta al lado Rust/JS vía el mecanismo de eventos de Tauri (canal/evento emitido desde el plugin Android hacia Rust y de ahí a JS — análogo al puente inverso ya existente en `recording_service.rs`/`RecordingServicePlugin.kt` para start/stop). Ese evento alimenta tanto la telemetría en vivo (velocidad, distancia, altitud) como el pipeline de persistencia existente en `cockpit.service.ts`/`cockpit-persist.service.ts` (mismo formato de punto, misma tabla `route_points`), sin crear un segundo camino de guardado paralelo ni duplicar la lógica de persistencia existente.
- [ ] AC-022: Durante una misma grabación no debe producirse ni pérdida ni duplicación de puntos GPS en `route_points`: al haber una única fuente activa (la captura nativa, ver AC-020) en todo momento mientras la grabación está en curso, no puede haber solapamiento entre `watchPosition()` y la captura nativa generando dos filas para un mismo instante.
- [ ] AC-023: Si `FusedLocationProviderClient` no está disponible en el dispositivo (Google Play Services ausente, desactualizado o deshabilitado), el foreground service debe recurrir automáticamente a `LocationManager` (proveedor `GPS_PROVIDER`) para seguir capturando puntos de forma nativa, de modo que la grabación en segundo plano no deje de registrar puntos silenciosamente por la sola ausencia de Play Services.
- [ ] AC-024: Este comportamiento (captura de puntos GPS con pantalla bloqueada) debe verificarse mediante una prueba manual en dispositivo Android real de duración prolongada — varios minutos de trayecto real con la pantalla bloqueada la mayor parte del tiempo, no una prueba corta de segundos. El bug documentado en esta spec (ruta "Prueba", 2026-07-28: `duration=64s`, 1 solo punto GPS con timestamp igual al inicio de la grabación) solo se manifestó en un trayecto real; una verificación previa de pocos segundos había dado (erróneamente) el fix por bueno.

## Comportamiento Esperado

### Escenario: Inicio de la app en reposo (Happy Path)
- **Dado** que el usuario abre la app por primera vez
- **Cuando** la app se carga completamente
- **Entonces** debe mostrar velocidad 0 km/h, chip "Listo", botón maestro con icono de grabación, todos los campos de telemetría con valor "--", botón de pausa deshabilitado

### Escenario: Iniciar grabación de ruta (Happy Path)
- **Dado** que la app está en reposo mostrando el Cockpit
- **Cuando** el usuario pulsa el botón maestro
- **Entonces** el chip cambia a "En ruta", el botón maestro cambia a estilo stop con icono de cuadrado, el botón de pausa se habilita, el foreground service arranca su captura nativa de ubicación y comienza a entregar puntos cada 1 segundo vía evento Tauri (ver AC-020/AC-021)

### Escenario: Telemetría en tiempo real durante grabación
- **Dado** que la grabación está activa
- **Cuando** pasan 3 segundos desde el inicio
- **Entonces** la velocidad actual se actualiza, la velocidad media se calcula, la distancia acumulada aumenta, el tiempo transcurrido avanza y la altitud se muestra

### Escenario: Detener grabación con long press
- **Dado** que la grabación está activa
- **Cuando** el usuario mantiene pulsado STOP durante 1.5 segundos
- **Entonces** la grabación se detiene, el botón vuelve a estado reposo, el chip vuelve a "Listo", los campos de telemetría se reinician

### Escenario: Long press cancelado
- **Dado** que la grabación está activa
- **Cuando** el usuario pulsa STOP pero suelta antes de 1.5 segundos
- **Entonces** la grabación continúa, no se guarda nada, el arco de progreso vuelve a su estado inicial

### Escenario: Sin permiso de GPS
- **Dado** que la app no tiene permiso de ubicación
- **Cuando** el usuario pulsa el botón maestro
- **Entonces** debe mostrar un overlay con mensaje "Se necesita permiso de GPS para grabar rutas" y un botón "Abrir ajustes"

### Escenario: Pausar y reanudar grabación
- **Dado** que la grabación está activa
- **Cuando** el usuario pulsa el botón de pausa
- **Entonces** el chip cambia a "Pausada", el tiempo se congela, el GPS deja de registrar
- **Cuando** el usuario pulsa reanudar
- **Entonces** el chip vuelve a "En ruta", el tiempo continúa, el GPS reanuda

### Escenario: Grabación en segundo plano
- **Dado** que el usuario pulsa el botón maestro para iniciar una ruta
- **Cuando** la grabación arranca
- **Entonces** se inicia el foreground service Android (notificación persistente "● Grabando ruta...") sin ninguna acción adicional del usuario
- **Y** en el mismo instante, el propio foreground service arranca su captura de ubicación nativa (`FusedLocationProviderClient`, con fallback a `LocationManager` si Play Services no está disponible) — esta es la única fuente de puntos durante toda la grabación, en foreground y en background; `watchPosition()` del WebView no se usa como fuente de puntos de ruta en ningún momento
- **Y** cada punto capturado nativamente se entrega al store de la grabación en curso vía evento Tauri (plugin Android → Rust → JS), alimentando tanto la telemetría en vivo como el mismo pipeline de persistencia que usa el resto de puntos de la ruta
- **Y** si el usuario bloquea la pantalla o cambia de app, la captura nativa sigue registrando puntos de forma autónoma, sin depender de que el WebView esté activo ni requerir ninguna conmutación de fuente
- **Cuando** la ruta termina (long press STOP) o se pausa
- **Entonces** la captura nativa de ubicación se detiene junto con el foreground service (en el stop) o se pausa junto con la grabación (en la pausa), y en el stop la notificación desaparece

### Escenario: FusedLocationProviderClient no disponible
- **Dado** que el dispositivo no tiene Google Play Services disponible o está desactualizado
- **Cuando** el foreground service intenta iniciar la captura nativa de ubicación al arrancar la grabación
- **Entonces** debe recurrir automáticamente a `LocationManager` (`GPS_PROVIDER`) como fuente de puntos
- **Y** la grabación en segundo plano debe seguir registrando puntos GPS sin fallar silenciosamente

## Diseño Visual
Ver `specs/ui/design-system.md` para la especificación completa. Resumen:
- **Fondo**: degradado `--bg-top` a `--bg-bottom` (asfalto/cuero oscuro)
- **Velocidad**: display grande con `--font-data` (Barlow Semi Condensed), color `--ink`
- **Ámbar**: único acento vivo en `--amber`, usado en botón de grabación activo y detalles
- **Chip**: estado en esquina superior izquierda (`chip-neutral`, `chip-recording`, `chip-paused`)
- **Grid stats**: 3 tiles con `--panel` de fondo, borde superior `--rust-line`
- **Botones**: fondo `--panel`, hitbox 56×56px, transiciones suaves
- **Tipografía**: Roboto Slab (títulos), Barlow (UI), Barlow Semi Condensed (datos numéricos)

## Notas de Implementación
- **AC-011 corregido (2026-07-28)**: el fix de PR #47 (`RecordingService.kt` + `RecordingServicePlugin.kt` + `src-tauri/src/recording_service.rs`) arranca un foreground service Android real, pero ese servicio solo llama a `startForeground()` para mostrar la notificación — **no captura ubicación por sí mismo**. La captura de puntos GPS seguía ocurriendo enteramente en JS vía `navigator.geolocation.watchPosition()` (`src/cockpit/cockpit.service.ts`, `createBrowserGpsProvider()`), que Chromium puede pausar/limitar en el WebView en segundo plano aunque el proceso Android no muera. Esto se dio por verificado erróneamente en `memory/context.md` (sesión 2026-07-27) tras una prueba manual corta; una ruta real de 2026-07-28 ("Prueba", `duration=64s`) confirmó el bug con datos de BBDD: solo 1 punto GPS guardado, con timestamp igual al instante de inicio de la grabación.
- **Estrategia de fix decidida**: mover la captura de ubicación a código nativo Android, dentro del propio `RecordingService.kt`, vía `FusedLocationProviderClient` (con fallback a `LocationManager` si Play Services no está disponible), en vez de depender de `watchPosition()` del WebView. Los puntos capturados nativamente deben llegar de vuelta al lado Rust/JS vía el mecanismo de eventos de Tauri (canal/evento emitido desde el plugin Android hacia Rust y de ahí a JS — análogo al puente inverso ya existente para start/stop), para unificarse con el pipeline de persistencia existente en `cockpit.service.ts`/`cockpit-persist.service.ts`, sin duplicar el guardado.
- **Verificación (AC-024)**: este tipo de bug solo se manifiesta en un trayecto real de varios minutos con la pantalla bloqueada, no en pruebas cortas de segundos — cualquier verificación de este comportamiento debe hacerse con una prueba manual de duración prolongada en dispositivo Android real antes de darlo por resuelto en `memory/context.md`.