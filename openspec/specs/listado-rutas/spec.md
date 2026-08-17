# listado-rutas Specification

## Purpose

Filtros combinables por estado de sincronización, buscador por nombre y ordenación configurable en el listado de rutas, para encontrar una ruta concreta más rápido cuando el listado crece.

## Requirements

### Requirement: Filtrar por estado de sincronización (local / en la nube)
La pantalla de listado de rutas, con sesión activa, SHALL ofrecer dos filtros independientes y combinables entre sí: "Solo locales" (muestra únicamente rutas no sincronizadas con la nube) y "Solo en la nube" (muestra únicamente rutas sincronizadas o exclusivas de la nube).

#### Scenario: Activar "Solo locales" oculta las rutas sincronizadas
- **WHEN** un usuario activa el filtro "Solo locales"
- **THEN** el listado muestra únicamente las rutas que no están sincronizadas con la nube, ocultando las sincronizadas y las exclusivas de la nube

#### Scenario: Activar "Solo en la nube" oculta las rutas puramente locales
- **WHEN** un usuario activa el filtro "Solo en la nube"
- **THEN** el listado muestra únicamente las rutas sincronizadas o exclusivas de la nube, ocultando las que solo existen en el dispositivo

#### Scenario: Activar ambos filtros a la vez no deja ninguna ruta visible
- **WHEN** un usuario activa "Solo locales" y "Solo en la nube" al mismo tiempo
- **THEN** el listado muestra el estado vacío de "sin resultados", porque ninguna ruta es simultáneamente local y de la nube

#### Scenario: Sin sesión activa, los filtros de local/nube no se muestran
- **WHEN** un usuario sin sesión activa abre el listado de rutas
- **THEN** los filtros "Solo locales" y "Solo en la nube" no se muestran, porque sin sesión no existe el concepto de sincronización

### Requirement: Buscar rutas por nombre
La pantalla de listado de rutas SHALL ofrecer un campo de búsqueda que filtra el listado en vivo, mientras el usuario escribe, por coincidencia parcial del nombre de la ruta, sin distinguir mayúsculas de minúsculas.

#### Scenario: Escribir en el buscador oculta las rutas sin coincidencia
- **WHEN** un usuario escribe un texto en el buscador
- **THEN** el listado muestra únicamente las rutas cuyo nombre contiene ese texto, sin distinguir mayúsculas de minúsculas, actualizándose con cada carácter escrito

#### Scenario: Ninguna ruta coincide con la búsqueda
- **WHEN** un usuario escribe un texto que ninguna ruta contiene en su nombre
- **THEN** el listado muestra el estado vacío de "sin resultados"

#### Scenario: Vaciar el buscador restaura el listado según los demás filtros activos
- **WHEN** un usuario borra el texto del buscador tras haber escrito algo
- **THEN** el listado vuelve a mostrar todas las rutas que cumplan el resto de filtros activos (favoritas, local, nube), como si nunca se hubiera buscado

### Requirement: Ordenar el listado por fecha o por nombre
La pantalla de listado de rutas SHALL ofrecer un control para ordenar el listado por fecha de creación (más reciente primero, orden por defecto) o por nombre (alfabético A-Z), aplicado sobre el resultado ya filtrado por los demás controles.

#### Scenario: Orden por fecha es el comportamiento por defecto
- **WHEN** un usuario abre el listado de rutas sin haber cambiado el orden
- **THEN** las rutas se muestran ordenadas de la más reciente a la más antigua

#### Scenario: Cambiar a orden por nombre reordena alfabéticamente
- **WHEN** un usuario selecciona ordenar por "Nombre"
- **THEN** el listado se reordena alfabéticamente de la A a la Z por el nombre de cada ruta

#### Scenario: El orden se aplica sobre el resultado ya filtrado
- **WHEN** un usuario tiene un filtro o búsqueda activos y cambia el criterio de orden
- **THEN** solo se reordenan las rutas que ya cumplían los filtros y la búsqueda activos, sin mostrar rutas ocultas por ellos

### Requirement: Los filtros, búsqueda y orden no persisten entre aperturas de la app
Los filtros de local/nube, el texto del buscador y el criterio de orden SHALL reiniciarse a su estado por defecto (sin filtros activos, buscador vacío, orden por fecha) cada vez que se crea una nueva instancia de la pantalla de listado — mismo criterio ya establecido para el filtro "Solo favoritas".

#### Scenario: Una instancia nueva del listado arranca sin filtros ni búsqueda activos
- **WHEN** se crea una nueva instancia de la pantalla de listado de rutas
- **THEN** ningún filtro de local/nube está activo, el buscador está vacío, y el orden es por fecha
