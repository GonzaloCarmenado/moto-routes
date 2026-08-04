## Purpose

Proporciona el catálogo de tipos de parada (bar/restaurante, mirador, monumento, gasolinera…) que la app móvil usa para que el usuario categorice una parada manual, servido por `apps/api` y cacheado localmente para funcionar sin conexión en carretera.

## ADDED Requirements

### Requirement: El catálogo de tipos de parada es de lectura pública
La API SHALL exponer el catálogo de tipos de parada en un endpoint HTTP de lectura que no exige autenticación, al ser datos de referencia no sensibles.

#### Scenario: El catálogo se obtiene sin token de sesión
- **WHEN** un cliente hace `GET` al endpoint del catálogo sin cabecera de autorización
- **THEN** la API responde con estado 200 y la lista de tipos de parada

#### Scenario: Cada tipo incluye texto e icono
- **WHEN** se inspecciona un elemento cualquiera de la respuesta del catálogo
- **THEN** incluye al menos un identificador, un texto descriptivo y un icono asociado

#### Scenario: El catálogo puede estar vacío sin que la API falle
- **WHEN** no existe ningún tipo de parada dado de alta todavía
- **THEN** la API responde con estado 200 y una lista vacía, no con un error

### Requirement: La app móvil cachea el catálogo localmente
La app SHALL guardar una copia local del catálogo de tipos de parada, de modo que el modal de selección de tipo funcione sin conexión de red durante una ruta.

#### Scenario: El modal usa la caché local sin conexión
- **WHEN** el usuario abre el modal de tipo de parada sin conexión de red disponible
- **THEN** el modal ofrece los tipos ya guardados en la caché local, sin bloquear ni fallar por falta de red

#### Scenario: Sin caché previa y sin conexión, el modal lo indica sin bloquear la app
- **WHEN** el usuario abre el modal de tipo de parada sin conexión de red y sin ninguna caché local previa (primer uso)
- **THEN** el modal indica que no hay tipos disponibles todavía, sin crashear ni impedir cerrar el modal

### Requirement: La app móvil actualiza la caché cuando hay conexión
La app SHALL intentar refrescar la caché local del catálogo cuando detecte conexión de red disponible, para reflejar cambios del catálogo del sistema sin requerir una actualización de la app.

#### Scenario: La app arranca con conexión disponible
- **WHEN** la app arranca y hay conexión de red disponible
- **THEN** la app solicita el catálogo actual a `apps/api` y actualiza la caché local si hay cambios

#### Scenario: El refresco falla sin afectar a la caché existente
- **WHEN** la petición de refresco del catálogo falla (timeout, error del servidor)
- **THEN** la caché local existente permanece sin cambios y sigue siendo usable
