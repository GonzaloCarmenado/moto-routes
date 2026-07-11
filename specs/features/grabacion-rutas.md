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
- [x] AC-011: Debe existir un botón/toggle "Modo Invisible" que al activarse permite grabar en segundo plano.
- [x] AC-012: Con "Modo Invisible" activo, la grabación continúa aunque el usuario bloquee la pantalla o use otras apps.
- [x] AC-015: El toggle de "Modo Invisible" está disponible siempre (no requiere grabación activa).
- [x] AC-016: Durante la grabación existe un botón "Pausa" para detener/reanudar sin detener la ruta.
- [ ] AC-017: La app debe detectar paradas automáticas cuando el vehículo está quieto durante un tiempo mínimo.
- [ ] AC-018: La detección de parada debe ser conservative: mejor tardar hasta 30 segundos en confirmar una parada que generar falsos positivos.
- [ ] AC-019: Las paradas detectadas deben quedar registradas en la ruta con timestamp, duración y coordenadas.

## Comportamiento Esperado

### Escenario: Inicio de la app en reposo (Happy Path)
- **Dado** que el usuario abre la app por primera vez
- **Cuando** la app se carga completamente
- **Entonces** debe mostrar velocidad 0 km/h, chip "Listo", botón maestro con icono de grabación, todos los campos de telemetría con valor "--", botón de pausa deshabilitado

### Escenario: Iniciar grabación de ruta (Happy Path)
- **Dado** que la app está en reposo mostrando el Cockpit
- **Cuando** el usuario pulsa el botón maestro
- **Entonces** el chip cambia a "En ruta", el botón maestro cambia a estilo stop con icono de cuadrado, el botón de pausa se habilita, el GPS comienza a registrar puntos cada 1 segundo

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

### Escenario: Modo invisible
- **Dado** que la grabación está activa
- **Cuando** el usuario activa "Modo Invisible"
- **Entonces** el botón cambia a estado activo (tachado de ojo)

## Diseño Visual
Ver `specs/ui/design-system.md` para la especificación completa. Resumen:
- **Fondo**: degradado `--bg-top` a `--bg-bottom` (asfalto/cuero oscuro)
- **Velocidad**: display grande con `--font-data` (Barlow Semi Condensed), color `--ink`
- **Ámbar**: único acento vivo en `--amber`, usado en botón de grabación activo y detalles
- **Chip**: estado en esquina superior izquierda (`chip-neutral`, `chip-recording`, `chip-paused`)
- **Grid stats**: 3 tiles con `--panel` de fondo, borde superior `--rust-line`
- **Botones**: fondo `--panel`, hitbox 56×56px, transiciones suaves
- **Tipografía**: Roboto Slab (títulos), Barlow (UI), Barlow Semi Condensed (datos numéricos)