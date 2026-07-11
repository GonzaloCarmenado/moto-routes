# moto-routes — Filosofía de diseño

## 1. Idea central
moto-routes no es un GPS. Es un **cuaderno de bitácora**: registra el viaje mientras ocurre y lo convierte en un recuerdo con datos. El diseño evoca el **asfalto de noche y el cuadro de instrumentos de una moto** — negro cuero, metal oscuro, un ámbar cálido que responde como el testigo de un salpicadero. Dramático y con carácter, pero nunca futurista: nada de HUDs, glassmorphism ni neón azulado. Es mecánico, no digital.

**Palabras clave:** asfalto nocturno, cuero oscuro, cuadro de instrumentos, ámbar cálido, carretera, aventura.

## 2. Principios

1. **El dato protagonista, no el adorno.** En la pantalla de grabación solo importa lo que el piloto necesita de un vistazo: velocidad, tiempo, distancia. Todo lo demás es secundario y silencioso.
2. **Papel, no pantalla de cristal.** Fondos cálidos color papel/cuero envejecido en vez de blancos fríos o negros puros. Texturas topográficas muy sutiles evocan el mapa físico sin volverse ruido.
3. **Tipografía de señalética.** Un slab serif robusto para títulos (como los rótulos de carretera y las placas de cuero grabadas) combinado con una sans-serif de carretera para la interfaz — legible a pleno sol, en movimiento, con guantes puestos.
4. **Los números se leen como un cuentakilómetros.** Las cifras grandes (velocidad, km, tiempo) usan una fuente semicondensada con números tabulares: estable, sin saltos, fácil de leer de reojo.
5. **Un acento, usado con disciplina.** El óxido/rust es el color de la acción (grabar, botón primario, estado activo). El verde topográfico es de apoyo (rutas, mapas, estados completados). Nunca compiten por atención.
6. **Modular, no cerrado.** La ficha de ruta se construye por bloques apilables (mapa, estadísticas, fotos, gráfica). Se pueden añadir o quitar módulos sin rediseñar la pantalla — pensado para crecer con más datos de sensores en el futuro.
7. **Botonera inferior como ancla.** Grabar es la acción central y siempre accesible, destacada visualmente sobre Rutas y Perfil. El resto de la navegación es secundaria a esa función.

## 3. Sistema de color
- **Asfalto/cuero** (`--bg-top`, `--bg-bottom`, `--panel`, `--panel-sunken`): superficies oscuras cálidas, nunca negro puro ni gris frío.
- **Tinta clara** (`--ink`, `--ink-soft`, `--ink-faint`): textos sobre fondo oscuro, nunca blanco puro.
- **Ámbar** (`--amber`, `--amber-strong`): acción primaria, velocidad en vivo, botón de grabar — el único color que "brilla" (glow cálido sutil, nunca neón azul).
- **Línea de óxido** (`--rust-line`): borde superior de tarjetas y stat tiles, un detalle de acabado, no un color de superficie.
- Sombras cálidas y profundas — el contraste viene de la luz ámbar, no de sombras frías.

## 4. Tipografía
- **Roboto Slab** — titulares, nombres de ruta, marca. Peso de letra de carretera.
- **Barlow** — interfaz, cuerpo de texto, etiquetas.
- **Barlow Semi Condensed (tabular)** — cifras grandes: velocidad, distancia, tiempo. Simula el cuentakilómetros.

## 5. Componentes clave
- **Stat tile**: bloque etiqueta + valor + unidad, la unidad base de cualquier dato en la app.
- **Chip de estado**: "En ruta" / "Pausada" / etiquetas neutras.
- **Placeholder de medios**: franjas diagonales + etiqueta monoespaciada, para mapas y fotos aún no cargados — deja claro qué debe ir ahí sin simular contenido real.
- **Botonera inferior**: Rutas · Grabar (destacado, circular, elevado) · Perfil.

## 6. Notas de producto para desarrollo
- La pantalla de grabación debe soportar tres estados: **grabando**, **pausada**, **detenida** (finalizada → pasa a previsualización).
- La ficha de ruta debe planificarse como lista de secciones (mapa, estadísticas, galería, gráfica) que puede reordenarse o ampliarse sin romper el layout.
- Las fotos subidas por el usuario necesitan almacenamiento por ruta: prever miniaturas comprimidas para el listado y galería de la ficha, y la imagen original para la vista ampliada.
- El listado de rutas prioriza reconocimiento visual rápido: miniatura + nombre + fecha + distancia/duración.
