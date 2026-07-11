# moto-routes — entrega de diseño

## Estructura

- `docs/DESIGN_PHILOSOPHY.md` — filosofía y principios de diseño.
- `docs/STYLE_GUIDE.html` — guía visual de color, tipografía y componentes (abrir en el navegador).
- `css/global.css` — CSS global con tokens y componentes reutilizables. Impórtalo en tu app.
- `screens/grabacion-ruta.html` — pantalla principal: grabación de ruta en vivo.
- `screens/detalle-ruta.html` — previsualización/ficha de una ruta guardada (mapa, estadísticas, fotos, gráfica).
- `screens/listado-rutas.html` — listado de todas las rutas guardadas.

Las tres pantallas comparten la botonera inferior (Rutas · Grabar · Perfil) y usan las clases de `css/global.css`. Ábrelas directamente en el navegador para verlas — cada una enlaza a las demás mediante la botonera y las tarjetas de ruta.

## Notas para desarrollo
- La pantalla de grabación tiene tres estados a implementar: grabando, pausada, detenida (al finalizar pasa a la ficha de ruta).
- La ficha de ruta está pensada como bloques apilables (mapa → estadísticas → gráfica → galería → notas) para poder añadir más datos sin rediseñar.
- Prevé almacenamiento por ruta para fotos subidas por el usuario (miniatura comprimida + original).
