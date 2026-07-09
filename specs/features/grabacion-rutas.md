# Feature: Grabación de Rutas (Cockpit)

## Descripción
El Cockpit es la pantalla principal de la aplicación, visible al abrirla. Permite al motorista iniciar y detener la grabación de una ruta GPS, mostrando telemetría en tiempo real (velocidad, distancia, tiempo, altitud) con un diseño tipo cuadro de instrumentos de competición. Es la feature esencial de la app: sin grabación no hay rutas.

## Criterios de Aceptación
- [ ] AC-001: La pantalla principal debe mostrar un dial circular grande con la velocidad actual en km/h, en reposo muestra 0.
- [ ] AC-002: Debe existir un botón maestro circular que muestre "● START" en estado reposo y "STOP" en estado grabando.
- [ ] AC-003: Al pulsar START, debe comenzar la grabación de la ruta: lecturas GPS cada 1 segundo.
- [ ] AC-004: Durante la grabación, el botón maestro debe cambiar a estado activo (color neón verde #00ff66, animación pulse).
- [ ] AC-005: Durante la grabación, el grid de telemetría debe mostrar: velocidad media, distancia total, tiempo transcurrido, altitud actual.
- [ ] AC-006: Para detener la grabación, el usuario debe mantener pulsado STOP durante 1.5 segundos (long press con arco de progreso rojo #ff3131).
- [ ] AC-007: Al detener la grabación, se debe guardar la ruta con todos sus puntos GPS en almacenamiento local.
- [ ] AC-008: La barra de estado superior debe mostrar un indicador visual (punto verde parpadeante + texto "REC") durante la grabación.
- [ ] AC-009: Todos los elementos interactivos deben tener un hitbox mínimo de 56×56px (para uso con guantes).
- [ ] AC-010: Si no hay permiso de GPS, debe mostrar un mensaje claro y un botón para ir a ajustes.

## Comportamiento Esperado

### Escenario: Inicio de la app en reposo (Happy Path)
- **Dado** que el usuario abre la app por primera vez
- **Cuando** la app se carga completamente
- **Entonces** debe mostrar el dial con valor 0 km/h, el botón "● START" en reposo (borde gris #222836) y todos los campos de telemetría con valor "--"

### Escenario: Iniciar grabación de ruta (Happy Path)
- **Dado** que la app está en reposo mostrando el Cockpit
- **Cuando** el usuario pulsa el botón "● START"
- **Entonces** el botón cambia a "STOP" con borde y color neón verde #00ff66 más animación pulse-recording, el indicador REC aparece en la barra de estado, y el GPS comienza a registrar puntos cada 1 segundo

### Escenario: Telemetría en tiempo real durante grabación
- **Dado** que la grabación está activa
- **Cuando** pasan 3 segundos desde el inicio
- **Entonces** el dial muestra la velocidad actual (ej: 86 km/h), la velocidad media se actualiza, la distancia acumulada aumenta, el tiempo transcurrido avanza y la altitud se muestra

### Escenario: Detener grabación con long press
- **Dado** que la grabación está activa
- **Cuando** el usuario mantiene pulsado "STOP" durante 1.5 segundos
- **Entonces** la grabación se detiene, la ruta se guarda, el botón vuelve a estado reposo "● START", y el indicador REC desaparece

### Escenario: Long press cancelado
- **Dado** que la grabación está activa
- **Cuando** el usuario pulsa "STOP" pero suelta antes de 1.5 segundos
- **Entonces** la grabación continúa, no se guarda nada, y el arco de progreso vuelve a su estado inicial

### Escenario: Sin permiso de GPS
- **Dado** que la app no tiene permiso de ubicación
- **Cuando** el usuario pulsa "● START"
- **Entonces** debe mostrar un mensaje: "Se necesita permiso de GPS para grabar rutas" y un botón "Abrir ajustes"

### Escenario: Pérdida de señal GPS durante grabación
- **Dado** que la grabación está activa con buena señal
- **Cuando** la señal GPS se pierde (túnel, zona sin cobertura)
- **Entonces** el dial debe mostrar "--" en lugar de la velocidad, y tras 30 segundos sin señal debe mostrar una alerta "Señal GPS perdida. La ruta se reanudará cuando haya cobertura."

### Escenario: App minimizada durante grabación
- **Dado** que la grabación está activa
- **Cuando** el usuario minimiza la app (fondo)
- **Entonces** el GPS debe seguir grabando en segundo plano y debe aparecer una notificación persistente indicando que la grabación continúa

## Constraints
- La app debe funcionar sin conexión a internet (GPS es offline)
- Los puntos GPS deben registrarse con precisión de ~10 metros
- El almacenamiento local debe soportar rutas de hasta 8 horas continuas
- El long press de STOP debe ser >= 1.5 segundos para evitar paradas accidentales por vibraciones o roce de chaqueta
- La interfaz debe ser operable con guantes gruesos de moto (hitbox 56×56px mínimo)
- Modo oscuro obligatorio: prohibido modo claro por deslumbramiento nocturno

## Dependencias
- **GPS**: Plugin `tauri-plugin-geolocation` para acceso a GPS en Android
- **Almacenamiento nativo**: Plugin `tauri-plugin-fs` para guardar archivos de ruta
- **Permisos Android**: `ACCESS_FINE_LOCATION` y `ACCESS_BACKGROUND_LOCATION` en manifests
- **Notificaciones**: Plugin `tauri-plugin-notification` para estado en segundo plano

## Notas de Implementación
- El Cockpit actual en `src/app/app.element.ts` es un placeholder visual. Se reemplazará con lógica real.
- Se creará un servicio `src/cockpit/cockpit.service.ts` para manejar la lógica de GPS.
- Se creará un transform `src/cockpit/cockpit.transform.ts` para formatear datos de telemetría.
- Los datos de ruta se guardarán en formato GeoJSON en `tauri-plugin-fs`.
- El long press se implementará con eventos `pointerdown`/`pointerup` y un temporizador de 1.5s.
- La notificación de segundo plano requiere permisos especiales en Android 13+.
- La ruta guardada incluirá: puntos GPS (timestamp, lat, lng, alt, speed), metadata (fecha, duración, distancia total, velocidad media).