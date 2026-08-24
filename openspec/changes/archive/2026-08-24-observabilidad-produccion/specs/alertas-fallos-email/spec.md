## Purpose

Registra los eventos de fallo de entrega de email notificados por el proveedor (Resend), para saber si un email crítico (verificación de cuenta, reset de contraseña, notificación) no ha llegado realmente a su destinatario.

## ADDED Requirements

### Requirement: Recepción verificada de eventos de fallo de entrega
La API SHALL exponer un endpoint webhook que recibe los eventos de resultado de entrega de Resend (rebote, retraso/fallo de entrega, queja), verificando la firma de cada petición antes de procesarla.

#### Scenario: Evento de rebote con firma válida
- **WHEN** Resend envía un evento de rebote (`email.bounced`) con una firma válida
- **THEN** la API registra un evento de fallo de entrega con la dirección de destino y el motivo indicado por Resend

#### Scenario: Evento de fallo o retraso de entrega con firma válida
- **WHEN** Resend envía un evento de fallo o retraso de entrega (`email.delivery_delayed` o `email.failed`) con una firma válida
- **THEN** la API registra un evento de fallo de entrega equivalente

#### Scenario: Firma inválida o ausente
- **WHEN** una petición al endpoint webhook no incluye una firma válida
- **THEN** la API rechaza la petición sin procesar su contenido ni registrar ningún evento

#### Scenario: Evento de Resend no relacionado con un fallo
- **WHEN** Resend envía un evento que no es de rebote, fallo, retraso ni queja (p. ej. apertura o clic)
- **THEN** la API acepta la petición pero no lo registra como evento de fallo de entrega

### Requirement: Consulta de fallos de entrega recientes
La API SHALL exponer, a través del mismo endpoint administrativo de `registro-errores-api`, los eventos de fallo de entrega de email más recientes, incluyendo la dirección de destino, el tipo de evento y el motivo, sin incluir el contenido del email enviado.

#### Scenario: Sin fallos de entrega registrados
- **WHEN** se consulta el endpoint administrativo y no se ha recibido ningún evento de fallo de entrega
- **THEN** la respuesta no incluye ningún fallo de entrega, sin error

#### Scenario: Fallos de entrega visibles junto al resto de eventos
- **WHEN** se han registrado tanto fallos de entrega de email como otros eventos de error/warning
- **THEN** ambos son consultables a través del mismo endpoint administrativo, distinguibles por su tipo
