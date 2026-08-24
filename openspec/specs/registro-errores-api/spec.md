# registro-errores-api Specification

## Purpose

Registra y expone las llamadas fallidas y los avisos degradados del backend en producción, para poder saber qué está pasando sin depender de estar mirando los logs del contenedor en el instante exacto en que ocurre.

## Requirements

### Requirement: Captura de eventos de error y warning
La API SHALL registrar un evento estructurado (nivel `error` o `warning`, marca de tiempo, mensaje, y ruta/método cuando aplique) para: cualquier panic recuperado por el middleware existente, cualquier respuesta con código 5xx, y cualquier aviso explícito de degradación emitido por el backend (p. ej. una integración opcional deshabilitada por falta de configuración).

#### Scenario: Fallo interno no controlado
- **WHEN** un handler produce un panic
- **THEN** la API registra un evento de error con el mensaje del panic recuperado, y sigue respondiendo el 500 genérico ya existente sin exponer detalles internos en la respuesta HTTP

#### Scenario: Respuesta de error del servidor
- **WHEN** un handler responde con un código 5xx
- **THEN** la API registra un evento de error con la ruta, el método y el código de estado

#### Scenario: Aviso de funcionalidad degradada
- **WHEN** el backend detecta en arranque o en tiempo de ejecución que una funcionalidad opcional está deshabilitada o degradada (p. ej. notificaciones push sin configurar)
- **THEN** la API registra un evento de warning con ese mensaje, sin interrumpir el arranque ni la petición en curso

### Requirement: Cobertura uniforme de todos los endpoints
La captura de errores y excepciones SHALL aplicarse de forma transversal a todos los endpoints expuestos por la API (existentes y futuros) mediante el middleware/wrapper compartido, sin requerir código de captura adicional en cada handler nuevo.

#### Scenario: Endpoint nuevo sin manejo de errores propio
- **WHEN** se añade un endpoint nuevo que no implementa ninguna captura de excepciones propia y ese handler produce un panic o responde 5xx
- **THEN** el evento se registra igualmente, con el mismo comportamiento que cualquier otro endpoint existente

#### Scenario: Todos los endpoints existentes quedan cubiertos al desplegar este cambio
- **WHEN** se despliega este cambio
- **THEN** ningún endpoint existente de la API queda excluido de la captura de errores (verificable por estar montado bajo el middleware/wrapper compartido, no por una lista mantenida a mano)

### Requirement: Tamaño máximo acotado del registro de eventos
El almacenamiento de eventos de error/warning SHALL tener un tamaño máximo configurable; al alcanzarlo, la API SHALL descartar los eventos más antiguos para dar cabida a los nuevos, sin crecer sin límite ni agotar el espacio en disco del servidor.

#### Scenario: Escritura por debajo del límite
- **WHEN** el almacenamiento de eventos está por debajo del tamaño máximo configurado
- **THEN** los eventos nuevos se añaden con normalidad, sin descartar ninguno existente

#### Scenario: Escritura al alcanzar el límite
- **WHEN** registrar un evento nuevo haría que el almacenamiento superase el tamaño máximo configurado
- **THEN** la API descarta primero los eventos más antiguos hasta volver a estar dentro del límite, y a continuación registra el evento nuevo

#### Scenario: Una ráfaga de errores no agota el disco
- **WHEN** se producen muchos más eventos de error en un periodo corto que la capacidad configurada del almacenamiento (p. ej. un bucle de fallos repetido)
- **THEN** el espacio ocupado por el registro de eventos permanece acotado al tamaño máximo configurado en todo momento

### Requirement: Consulta de eventos recientes
La API SHALL exponer los eventos de error/warning más recientes (hasta un límite fijo) a través de un endpoint administrativo, ordenados del más reciente al más antiguo, protegido por un secreto propio distinto de la sesión de un usuario normal.

#### Scenario: Sin eventos registrados todavía
- **WHEN** se consulta el endpoint y no se ha registrado ningún evento desde que arrancó el registro
- **THEN** la API responde una lista vacía, no un error

#### Scenario: Acceso sin autorización
- **WHEN** se consulta el endpoint sin el secreto administrativo válido
- **THEN** la API responde con un error de autorización sin devolver ningún evento ni indicar si el secreto era parcialmente correcto

#### Scenario: Eventos disponibles tras un reinicio del servicio
- **WHEN** el contenedor de la API se reinicia (por un despliegue o por un fallo) después de haberse registrado eventos
- **THEN** los eventos registrados antes del reinicio siguen disponibles a través del endpoint tras el reinicio

#### Scenario: Volumen alto de eventos
- **WHEN** el número de eventos registrados supera el límite fijo de eventos devueltos
- **THEN** la API devuelve solo los más recientes hasta ese límite, sin fallar ni degradar el tiempo de respuesta de forma no acotada
