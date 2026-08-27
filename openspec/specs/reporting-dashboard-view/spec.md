# reporting-dashboard-view Specification

## Purpose

Presenta de forma legible los datos que hoy ya expone `GET /admin/status` (eventos operacionales recientes e instantánea de memoria/disco del host) — sustituye leer el JSON crudo a mano.

## Requirements

### Requirement: Listado de eventos operacionales recientes
La vista SHALL mostrar los eventos devueltos por el endpoint de reporting, ordenados del más reciente al más antiguo, con su nivel (error/warning) visualmente distinguible entre sí, y el mensaje, marca de tiempo y ruta/método cuando el evento los incluya.

#### Scenario: Hay eventos disponibles
- **WHEN** el endpoint de reporting devuelve uno o más eventos
- **THEN** la vista los lista todos, en el mismo orden recibido, con el nivel de cada evento distinguible de un vistazo

#### Scenario: No hay eventos registrados
- **WHEN** el endpoint de reporting devuelve una lista de eventos vacía
- **THEN** la vista muestra un estado vacío explícito, no una lista en blanco sin explicación

### Requirement: Instantánea de memoria y disco del host
La vista SHALL mostrar la última instantánea de memoria y disco del host cuando el endpoint la incluya, junto con su marca de tiempo, y SHALL mostrar un estado explícito de "sin datos todavía" cuando el endpoint no la incluya — nunca un hueco en blanco sin explicación ni un error.

#### Scenario: Instantánea disponible
- **WHEN** el endpoint de reporting incluye memoria, disco y marca de tiempo
- **THEN** la vista muestra los tres datos juntos

#### Scenario: Instantánea todavía no disponible
- **WHEN** el endpoint de reporting no incluye memoria/disco (aún no se ha recolectado ninguna instantánea)
- **THEN** la vista muestra un estado explícito de "sin datos todavía" en vez de un hueco en blanco

### Requirement: Fallo al consultar el endpoint de reporting
Un fallo de red al consultar el endpoint de reporting SHALL mostrar un mensaje de error con opción de reintentar, sin dejar la vista en un estado de carga indefinido ni con datos de una consulta anterior sin indicar que están desactualizados.

#### Scenario: Fallo de red genérico
- **WHEN** la petición al endpoint de reporting falla por un problema de red (no por sesión inválida, ver capability `dashboard-login`)
- **THEN** la vista muestra un mensaje de error y una acción para reintentar la consulta
