# web-dashboard Specification

## Purpose

Panel web interno de Moto Routes para consultar herramientas operativas (empezando por el reporting de `apps/api`). En este cambio, la aplicación es exclusivamente privada: no existe ningún contenido ni ruta accesible sin sesión.

## Requirements

### Requirement: La aplicación no expone ningún contenido sin sesión válida
Cualquier ruta de la aplicación web SHALL exigir una sesión de operador válida (ver capability `dashboard-login`) antes de mostrar contenido. Sin sesión válida, cualquier URL solicitada SHALL redirigir a la pantalla de login sin revelar ningún dato de las vistas privadas.

#### Scenario: Acceso a una ruta privada sin sesión
- **WHEN** se solicita cualquier ruta de la aplicación distinta de login sin una sesión válida
- **THEN** la aplicación redirige a la pantalla de login sin renderizar el contenido de esa ruta

#### Scenario: Acceso directo a la URL raíz sin sesión
- **WHEN** se abre la URL raíz de la aplicación sin una sesión válida
- **THEN** la aplicación redirige a la pantalla de login, sin una pantalla intermedia que muestre estructura o datos de las vistas privadas

#### Scenario: Acceso a una ruta privada con sesión válida
- **WHEN** se solicita una ruta de la aplicación con una sesión de operador válida
- **THEN** la aplicación renderiza el contenido de esa ruta con normalidad
