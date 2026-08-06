# email-verification Specification

## Purpose

Confirma que el dueño de una cuenta controla de verdad el email con el que se registró, mediante un token de un solo uso enviado por correo, antes de dejarle iniciar sesión.

## Requirements

### Requirement: El registro dispara el primer envío de verificación
Al crear una cuenta nueva, la API SHALL generar un token de verificación de un solo uso y SHALL intentar enviarlo por email a la dirección registrada. Un fallo en el envío del email NO SHALL impedir que la cuenta se cree.

#### Scenario: Registro correcto dispara el envío del email de verificación
- **WHEN** un cliente registra una cuenta con datos válidos
- **THEN** la API crea la cuenta con el email sin verificar y envía un email con un enlace o código de verificación de un solo uso

#### Scenario: Fallo de envío no bloquea la creación de la cuenta
- **WHEN** el registro es válido pero el proveedor de email no puede entregar el mensaje
- **THEN** la API crea la cuenta igualmente, dejándola sin verificar, sin devolver un error al cliente por el fallo de envío

### Requirement: Solicitud (o reenvío) de verificación sin enumerar cuentas
La API SHALL exponer una forma de solicitar un nuevo email de verificación indicando solo el email, y SHALL responder con el mismo resultado exista o no una cuenta con ese email, y exista ya o no verificación previa.

#### Scenario: Solicitud para una cuenta existente sin verificar
- **WHEN** un cliente solicita verificación para el email de una cuenta existente cuyo email no está verificado
- **THEN** la API genera un nuevo token de verificación, invalida cualquier token anterior sin usar de esa cuenta, envía el email y responde con éxito genérico

#### Scenario: Solicitud para un email sin cuenta asociada
- **WHEN** un cliente solicita verificación para un email que no tiene ninguna cuenta registrada
- **THEN** la API responde con el mismo éxito genérico que si la cuenta existiera, sin enviar ningún email ni revelar que la cuenta no existe

#### Scenario: Solicitud para una cuenta ya verificada
- **WHEN** un cliente solicita verificación para el email de una cuenta cuyo email ya está verificado
- **THEN** la API responde con el mismo éxito genérico, sin generar un token nuevo ni enviar ningún email

#### Scenario: Solicitudes repetidas se limitan
- **WHEN** un cliente solicita verificación repetidamente para el mismo email en un intervalo corto de tiempo
- **THEN** la API rechaza las solicitudes que excedan el límite con un error de límite de peticiones, sin bloquear indefinidamente futuras solicitudes legítimas pasada la ventana

### Requirement: Confirmación de un token de verificación marca la cuenta como verificada
La API SHALL aceptar el token de verificación recibido por email y, si es válido, no ha expirado y no se ha usado antes, SHALL marcar la cuenta como verificada y SHALL invalidar el token para que no pueda reutilizarse.

#### Scenario: Confirmación con un token válido
- **WHEN** un cliente confirma un token de verificación válido, no expirado y no usado previamente
- **THEN** la API marca la cuenta correspondiente como verificada y responde con éxito

#### Scenario: Confirmación rechazada por token ya usado
- **WHEN** un cliente confirma un token que ya se usó para verificar la cuenta anteriormente
- **THEN** la API rechaza la petición sin volver a marcar ni desmarcar el estado de verificación

#### Scenario: Confirmación rechazada por token expirado
- **WHEN** un cliente confirma un token cuya fecha de expiración ya ha pasado
- **THEN** la API rechaza la petición indicando que el token no es válido, sin marcar la cuenta como verificada

#### Scenario: Confirmación rechazada por token inexistente o manipulado
- **WHEN** un cliente confirma un valor que no corresponde a ningún token emitido
- **THEN** la API rechaza la petición con el mismo tipo de error que un token expirado, sin distinguir el motivo exacto
