# password-reset Specification

## Purpose

Permite a un usuario que ha olvidado su contraseña recuperar el acceso a su cuenta mediante un enlace de un solo uso enviado por email, sin necesitar contactar con soporte ni crear una cuenta nueva.

## Requirements

### Requirement: Solicitud de reset sin enumerar cuentas
La API SHALL exponer una forma de solicitar un reset de contraseña indicando solo el email, y SHALL responder con el mismo resultado exista o no una cuenta con ese email.

#### Scenario: Solicitud para una cuenta existente
- **WHEN** un cliente solicita un reset de contraseña para el email de una cuenta existente
- **THEN** la API genera un token de reset de un solo uso, invalida cualquier token de reset anterior sin usar de esa cuenta, envía un email con el enlace de confirmación y responde con éxito genérico

#### Scenario: Solicitud para un email sin cuenta asociada
- **WHEN** un cliente solicita un reset de contraseña para un email que no tiene ninguna cuenta registrada
- **THEN** la API responde con el mismo éxito genérico que si la cuenta existiera, sin enviar ningún email ni revelar que la cuenta no existe

#### Scenario: Solicitudes repetidas se limitan
- **WHEN** un cliente solicita un reset repetidamente para el mismo email en un intervalo corto de tiempo
- **THEN** la API rechaza las solicitudes que excedan el límite con un error de límite de peticiones

#### Scenario: El enlace enviado no contiene el email ni ningún identificador de cuenta
- **WHEN** la API envía el email con el enlace de confirmación de reset
- **THEN** el enlace contiene únicamente el token de un solo uso como dato variable, sin el email ni ningún otro identificador de la cuenta en la URL

### Requirement: El enlace de reset abre un formulario real para la contraseña nueva
La API SHALL servir, para un token de reset válido, no expirado y no usado, una página con un formulario donde introducir la contraseña nueva y su confirmación.

#### Scenario: Token válido muestra el formulario
- **WHEN** un cliente abre el enlace de reset con un token válido, no expirado y no usado
- **THEN** la API responde con una página que contiene un formulario para escribir la contraseña nueva

#### Scenario: Token inválido, expirado o ya usado no muestra el formulario
- **WHEN** un cliente abre el enlace de reset con un token inválido, expirado o ya usado
- **THEN** la API responde con una página indicando que el enlace no es válido, sin mostrar el formulario, sin distinguir el motivo exacto

### Requirement: Confirmar el reset sustituye la contraseña
Al enviar el formulario con un token válido, una contraseña nueva que cumple la política mínima y coincidente con su confirmación, la API SHALL sustituir el hash de contraseña de la cuenta y SHALL invalidar el token para que no pueda reutilizarse. Si la cuenta no tenía el email verificado, completar el reset SHALL marcarla como verificada. La API SHALL determinar la cuenta afectada exclusivamente a partir del token recibido — NUNCA a partir de un email, nombre de usuario o identificador de cuenta enviado en la petición, si lo hubiera.

#### Scenario: Reset correcto sustituye la contraseña
- **WHEN** un cliente envía el formulario con un token válido y una contraseña nueva que cumple la política mínima, coincidente con su confirmación
- **THEN** la API sustituye la contraseña de la cuenta, invalida el token, marca la cuenta como verificada si no lo estaba, y responde con una página de éxito

#### Scenario: Reset rechazado por contraseñas que no coinciden
- **WHEN** un cliente envía el formulario con una contraseña y una confirmación distintas entre sí
- **THEN** la API rechaza la petición sin cambiar la contraseña, mostrando de nuevo el formulario con el motivo

#### Scenario: Reset rechazado por contraseña débil
- **WHEN** un cliente envía el formulario con una contraseña que no cumple la política mínima de complejidad
- **THEN** la API rechaza la petición sin cambiar la contraseña, mostrando de nuevo el formulario con el motivo

#### Scenario: Reset rechazado por token ya usado, expirado o inexistente
- **WHEN** un cliente envía el formulario con un token que ya se usó, ha expirado, o no corresponde a ningún token emitido
- **THEN** la API rechaza la petición sin cambiar ninguna contraseña, con el mismo tipo de error en los tres casos

#### Scenario: Un reset completado permite iniciar sesión con la contraseña nueva
- **WHEN** un cliente inicia sesión con el email de la cuenta y la contraseña nueva justo después de completar un reset
- **THEN** la API acepta el login con normalidad

#### Scenario: Un reset completado invalida la contraseña anterior
- **WHEN** un cliente intenta iniciar sesión con el email de la cuenta y la contraseña anterior, ya reemplazada por un reset
- **THEN** la API rechaza el login con el mismo error genérico de credenciales incorrectas

#### Scenario: Un campo de cuenta añadido a mano en el formulario se ignora
- **WHEN** un cliente envía el formulario con un token válido de una cuenta, una contraseña nueva válida, y además un campo adicional que apunta a otra cuenta (por ejemplo `email` o `user_id` de otra cuenta distinta a la del token)
- **THEN** la API cambia la contraseña únicamente de la cuenta dueña del token, ignorando por completo ese campo adicional

### Requirement: El token de reset caduca pasado un tiempo corto
La API SHALL invalidar un token de reset tras un periodo de validez corto (más corto que el de un token de verificación de email), independientemente de si se ha usado o no.

#### Scenario: Token caducado se trata igual que uno inválido
- **WHEN** un cliente abre el enlace o envía el formulario de reset con un token cuyo periodo de validez ya ha pasado
- **THEN** la API lo rechaza exactamente igual que un token inexistente o ya usado, sin cambiar ninguna contraseña
