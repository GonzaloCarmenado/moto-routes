## Purpose

Define un sistema de iconos SVG único y coherente para toda la app móvil — mismo estilo visual sobrio de dos colores en cualquier icono, sea una acción (borrar, cerrar), un tipo de parada, una pestaña de navegación, un control del cockpit o un toast — sustituyendo la mezcla actual de emoji y formas CSS.

## ADDED Requirements

### Requirement: Todo icono de la app usa el estilo visual sobrio de dos colores
Cualquier icono nuevo o migrado por este cambio SHALL renderizarse como SVG inline con trazo (`stroke`) en vez de relleno, sin emoji ni glifos unicode, usando el color de texto heredado por defecto y el color de acento ámbar del proyecto (`var(--amber)`) solo para el estado activo/relevante de cada icono — mismo criterio visual ya usado por los iconos de sincronización con la nube.

#### Scenario: Un icono en estado neutro usa el color de texto heredado
- **WHEN** se renderiza un icono de este sistema sin ningún estado especial (p. ej. la papelera de borrar en reposo)
- **THEN** su color es el heredado del texto circundante, no un color fijo propio

#### Scenario: Un icono en estado relevante usa el color de acento ámbar
- **WHEN** se renderiza un icono en su estado relevante/activo (p. ej. una pestaña de nav-bar seleccionada, o una ruta ya sincronizada)
- **THEN** su color es el ámbar de acento del proyecto, no otro color

### Requirement: Las acciones de borrar y cerrar usan icono SVG, no emoji ni glifos unicode
El botón de borrar una ruta, el de borrar una foto y el de cerrar el visor de fotos SHALL mostrar un icono SVG del sistema — SHALL NOT mostrar el emoji `🗑` ni el glifo `✕`.

#### Scenario: Borrar una ruta muestra el icono SVG de papelera
- **WHEN** se abre el listado de rutas
- **THEN** el botón de borrar de cada tarjeta de ruta muestra el icono SVG de papelera, no el emoji `🗑`

#### Scenario: Borrar una foto muestra el icono SVG de papelera
- **WHEN** se abre el visor de una foto
- **THEN** el botón de borrar muestra el icono SVG de papelera, no el emoji `🗑`

#### Scenario: Cerrar el visor de fotos muestra el icono SVG de cierre
- **WHEN** se abre el visor de una foto
- **THEN** el botón de cerrar muestra el icono SVG de cierre, no el glifo `✕`

### Requirement: Cada tipo de parada del catálogo se resuelve a un icono SVG propio
La app SHALL mostrar un icono SVG distinto por cada tipo de parada del catálogo (menú de selección al marcar una parada, timeline de la ruta y marcador en el mapa), resuelto a partir del identificador del tipo (`key`) — SHALL NOT renderizar directamente el emoji devuelto por el catálogo de `apps/api`. Un tipo de parada sin icono SVG mapeado todavía SHALL mostrar un icono SVG genérico de repuesto, nunca el emoji crudo ni un hueco vacío.

#### Scenario: El menú de selección de tipo de parada muestra iconos SVG
- **WHEN** el usuario pausa la grabación y se abre el menú de tipo de parada
- **THEN** cada opción del menú muestra el icono SVG de su tipo, no el emoji del catálogo

#### Scenario: El timeline de la ruta muestra el icono SVG del tipo de cada parada
- **WHEN** se abre el timeline de una ruta con al menos una parada manual con tipo asignado
- **THEN** el delimitador de esa parada muestra el icono SVG de su tipo

#### Scenario: El mapa distingue cada tipo de parada con su icono SVG
- **WHEN** se abre el mapa de detalle de una ruta con paradas de distinto tipo
- **THEN** cada marcador de parada muestra el icono SVG de su propio tipo, distinguible del de los demás

#### Scenario: Un tipo de parada sin icono SVG mapeado usa el icono de repuesto
- **WHEN** el catálogo devuelve un tipo de parada cuyo `key` no tiene icono SVG específico todavía en el mapeo del cliente
- **THEN** la app muestra el icono SVG genérico de repuesto para ese tipo, no el emoji del catálogo ni un espacio vacío

### Requirement: Las pestañas Rutas y Perfil de la navegación principal usan icono SVG, no forma CSS
Las pestañas "Rutas" y "Perfil" de la navegación principal SHALL mostrar un icono SVG del sistema en vez de una forma dibujada solo con CSS. La pestaña "Grabar" y los controles del cockpit (iniciar/detener grabación, pausar/reanudar) quedan explícitamente fuera de este requisito — decisión confirmada con el usuario durante la implementación: son indicadores de acción/controles de media (círculo relleno, punto, barras, triángulo), no iconos de línea, y uno de ellos tiene un fix de centrado ya protegido por test de regresión que no conviene arriesgar sin necesidad real.

#### Scenario: Las pestañas Rutas y Perfil muestran icono SVG
- **WHEN** se muestra la navegación principal
- **THEN** las pestañas "Rutas" y "Perfil" muestran cada una un icono SVG propio, distinguible entre sí

#### Scenario: La pestaña Grabar y los controles del cockpit no cambian
- **WHEN** se muestra la navegación principal o los controles del cockpit
- **THEN** la pestaña "Grabar" sigue mostrando su indicador de acción (círculo relleno) y los controles del cockpit sus formas rellenas habituales, sin icono SVG de línea

### Requirement: Los toasts muestran un icono según su tipo
Un toast SHALL mostrar un icono SVG del sistema junto a su mensaje, distinto para éxito y para error — SHALL seguir funcionando (mostrando al menos el mensaje) si no se indica un tipo.

#### Scenario: Un toast de éxito muestra el icono de éxito
- **WHEN** se muestra un toast de una acción completada con éxito (p. ej. foto subida a la nube)
- **THEN** el toast muestra el icono SVG de éxito junto al mensaje

#### Scenario: Un toast de error muestra el icono de error
- **WHEN** se muestra un toast de un fallo (p. ej. no se pudo borrar una foto)
- **THEN** el toast muestra el icono SVG de error junto al mensaje

#### Scenario: Un toast sin tipo indicado sigue mostrando el mensaje
- **WHEN** se invoca el toast sin especificar tipo de icono
- **THEN** el toast muestra el mensaje igualmente, con o sin icono por defecto, sin romperse
