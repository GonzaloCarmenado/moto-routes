# metricas-recursos-servidor Specification

## Purpose

Expone el estado de memoria y espacio en disco del servidor de producción, para detectar degradación de recursos antes de que provoque una caída del servicio.

## Requirements

### Requirement: Instantánea de memoria del servidor
La API SHALL exponer, a través del endpoint administrativo de `registro-errores-api`, la última instantánea conocida de memoria usada y disponible del host de producción, junto con la marca de tiempo de esa medición.

#### Scenario: Instantánea disponible
- **WHEN** se consulta el endpoint tras al menos una recolección de memoria
- **THEN** la respuesta incluye el porcentaje o cantidad de memoria usada/disponible y la marca de tiempo de la medición

#### Scenario: Instantánea todavía no disponible
- **WHEN** se consulta el endpoint antes de que se haya completado la primera recolección (p. ej. justo tras un despliegue)
- **THEN** la API responde explícitamente que no hay datos de memoria todavía, sin inventar un valor ni devolver un error

### Requirement: Instantánea de espacio en disco del servidor
La API SHALL exponer, a través del mismo endpoint administrativo, la última instantánea conocida de espacio en disco usado y disponible del host de producción, junto con la marca de tiempo de esa medición.

#### Scenario: Instantánea disponible
- **WHEN** se consulta el endpoint tras al menos una recolección de disco
- **THEN** la respuesta incluye el espacio usado/disponible y la marca de tiempo de la medición

#### Scenario: Instantánea todavía no disponible
- **WHEN** se consulta el endpoint antes de que se haya completado la primera recolección
- **THEN** la API responde explícitamente que no hay datos de disco todavía, sin inventar un valor ni devolver un error

### Requirement: Aviso cuando memoria o disco superan un umbral crítico
La API SHALL registrar un evento de warning en `registro-errores-api` cuando la memoria usada o el espacio en disco usado del host superen un umbral configurable, para que aparezca junto al resto de avisos sin necesitar una consulta aparte.

#### Scenario: Disco por encima del umbral
- **WHEN** una recolección de disco mide un uso por encima del umbral configurado
- **THEN** la API registra un evento de warning indicando el recurso afectado y el valor medido

#### Scenario: Memoria por encima del umbral
- **WHEN** una recolección de memoria mide un uso por encima del umbral configurado
- **THEN** la API registra un evento de warning indicando el recurso afectado y el valor medido

#### Scenario: Recurso por debajo del umbral tras haber estado por encima
- **WHEN** una recolección posterior mide el mismo recurso de nuevo por debajo del umbral
- **THEN** la API no repite el warning en cada recolección sana; solo vuelve a registrar un warning si el recurso cruza el umbral de nuevo
