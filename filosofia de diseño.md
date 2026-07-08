
# Documento de Especificación de Producto: Filosofía de Diseño y UI/UX

**Proyecto:** Ride Tracker Mobile App
**Versión:** 1.1.0 (Especificación de Alta Precisión)
**Entorno de Uso:** Smartphone montado en manillar de motocicleta (Uso dinámico en ruta y estático post-ruta)

---

## 1. Fundamentos Estéticos y Dirección de Arte

La interfaz de la aplicación se define bajo el concepto de **"Telemetry & Freedom" (Telemetría y Libertad)**. Busca fusionar la precisión de un cuadro de instrumentos de competición (TFT/LCD) con la fluidez de un cuaderno de bitácora digital.

### 1.1. Principios de Diseño Atómico aplicados a la Conducción

1. **Legibilidad Extrema (High-Contrast Ratio):** Todos los elementos de texto clave deben superar una relación de contraste de 7:1 contra el fondo. La tipografía no debe usar remates que dificulten la lectura con vibraciones de motor monocilíndrico o bicilíndrico.
2. **Arquitectura "Anti-Glare" (Anti-reflejos):** El uso de negros puros y grises profundos minimiza la refracción lumínica en la pantalla del smartphone bajo la luz directa del sol.
3. **Zonas de Interacción Segura (Hitbox Padding):** Cualquier elemento interactivo en pantallas de ruta activa debe expandir su área de pulsación (`hitbox`) de manera invisible mediante paddings transparentes hasta alcanzar un mínimo absoluto de **56px × 56px**, garantizando que el usuario pueda interactuar usando guantes invernales de cuero pesado.

---

## 2. Paleta de Colores y Guía Cromática de Precisión

El sistema de diseño utiliza una arquitectura cromática basada en "Modo Oscuro Técnico Obligatorio". No existe variante en modo claro por motivos de seguridad vial y deslumbramiento nocturno.

| Token de Color       | Código Hexadecimal | Espacio RGBA               | Uso Específico en la Interfaz                                                       |
| :------------------- | :------------------ | :------------------------- | :----------------------------------------------------------------------------------- |
| `color-bg-base`    | `#0b0c10`         | `rgba(11, 12, 16, 1)`    | Fondo general absoluto de la aplicación.                                            |
| `color-bg-surface` | `#161a24`         | `rgba(22, 26, 36, 1)`    | Fondo de tarjetas contenedoras de rutas y widgets de estadísticas.                  |
| `color-bg-overlay` | `#222836`         | `rgba(34, 40, 54, 1)`    | Inputs de texto, botones secundarios en reposo y cabeceras de tablas.                |
| `color-neon-go`    | `#00ff66`         | `rgba(0, 255, 102, 1)`   | Estado de grabación activo (REC), velocidad óptima y filtros seleccionados.        |
| `color-neon-stop`  | `#ff3131`         | `rgba(255, 49, 49, 1)`   | Botón de pausa/parada, zonas de peligro en mapa o alertas de desconexión GPS.      |
| `color-neon-brand` | `#00d2ff`         | `rgba(0, 210, 255, 1)`   | Trazado de rutas estándar, iconos de POI (Puntos de interés) y enlaces.            |
| `color-text-max`   | `#ffffff`         | `rgba(255, 255, 255, 1)` | Dígitos del velocímetro, títulos principales y métricas en tiempo real.          |
| `color-text-mid`   | `#94a3b8`         | `rgba(148, 163, 184, 1)` | Subtítulos, unidades de medida (`km/h`, `m`, `min`) y textos de descripción. |

---

## 3. Especificación Detallada de Pantallas

### 3.1. Pantalla Principal: "El Cockpit" (Grabación)

* **Comportamiento en Reposo:** Muestra un gran dial circular central que simula un tacómetro. En el centro del dial se lee el dígito `0` en tamaño `54px`. Abajo, un botón masivo circular con borde `#222836` que contiene la palabra `● START` en gris.
* **Comportamiento en Grabación Activa:** El botón central se transforma instantáneamente: el borde cambia a `#ff3131` con un efecto de parpadeo (`animation-duration: 2s`). Las métricas de velocidad media, tiempo transcurrido y distancia acumulada se iluminan en `#00ff66`. El mapa se oculta en un 80% dejando paso a las macro-métricas para evitar distracciones.
* **Filtro en Segundo Plano:** Cuando el usuario minimiza la app, se despliega una barra de estado superior nativa y persistente con el icono de la app iluminado en verde neón, parpadeando suavemente para certificar que el subproceso del acelerómetro y GPS sigue en ejecución.

### 3.2. Pantalla: "Mis Rutas" e Interfaz de Filtrado

* **Estructura de Filtros Superiores:** Barra horizontal con scroll lateral (`overflow-x: auto`) sin barra de desplazamiento visible. Los filtros se dividen en píldoras táctiles (`chips`).
  * *Filtro por Tipo de Ruta:* Píldoras con iconos internos para "On-Road" (icono de asfalto/carretera limpia), "Off-Road" (icono de neumático de tacos/montaña).
  * *Filtro por Moto:* Menú desplegable instantáneo que muestra las motos del garaje del usuario mediante tarjetas horizontales compactas.
* **Listado de Rutas:** Tarjetas con una relación de aspecto de 16:9 para la miniatura del mapa (trazado simplificado en `#00d2ff` sobre fondo oscuro). Los textos informativos se alinean a la derecha de la miniatura en pantallas tipo tablet o debajo en formato móvil vertical.

### 3.3. Pantalla: "Detalle de Ruta y Paradas Multimedia"

* **El Mapa Interactivo:** Utiliza una capa personalizada estilo *Night Topography*. Las carreteras secundarias (las favoritas de los moteros) resaltan con un sutil contorno gris claro, mientras que las autopistas quedan relegadas a un plano atenuado.
* **Sistema de Paradas Vinculadas:** Las paradas se marcan en el mapa con pines circulares. Si una parada contiene fotos, el pin se sustituye por una miniatura circular de la propia imagen con un borde de `2px` en color `#00ff66`.
* **Línea de Tiempo Inferior (Timeline Drawer):** Al deslizar hacia arriba desde la base de la pantalla, se despliega un panel que organiza las paradas cronológicamente. Cada nodo de la línea de tiempo muestra la hora exacta, el tiempo que la moto estuvo completamente detenida (calculado automáticamente cuando la velocidad = 0 km/h durante más de 2 minutos) y un carrusel horizontal de imágenes asociadas a esa coordenada.

---

## 4. Guía de Iconografía y Micro-interacciones

### 4.1. Estilo de Iconos

* Se prohíbe el uso de iconos con rellenos complejos o degradados. Todos los iconos deben ser vectoriales (`SVG`), con un grosor de trazo (`stroke-width`) uniforme de `2px`, esquinas redondeadas (`stroke-linecap: round; stroke-linejoin: round;`) y un tamaño de caja base de `24px × 24px`.
* **Iconos Clave:**
  * *Cámara de fotos:* Líneas limpias con un círculo central reflectante para indicar puntos multimedia.
  * *Estación de Servicio:* Silueta clásica de surtidor para indicar paradas técnicas de repostaje.
  * *Café/Restaurante:* Icono de taza minimalista para paradas de descanso.
  * *Moto:* Silueta estilizada lateral de una motocicleta trail/sport.

### 4.2. Micro-interacciones Requeridas

* **Pulsación de Botón Principal:** Al mantener presionado el botón de parada (`STOP`), este debe requerir una pulsación continua de **1.5 segundos** (efecto *Long Press*) para evitar cancelaciones accidentales por el roce de la chaqueta o el viento. Visualmente, un arco de color `#ff3131` se irá dibujando alrededor del botón hasta completar los 360 grados antes de consolidar la detención.
* **Transiciones de Filtros:** Al activar una píldora de filtro, esta debe desplazarse `2px` hacia arriba mediante una transformación CSS y emitir una onda expansiva circular interna (`ripple effect`) de color blanco translúcido (`rgba(255,255,255,0.15)`).
